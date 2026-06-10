-- NotizApp Supabase schema
-- Run this in the Supabase SQL editor of a fresh project.
--
-- Multi-user setup: every row belongs to a Supabase Auth user (auth.users).
-- RLS restricts each user to their OWN rows via auth.uid() = user_id.
-- The Bridge API / workers use the service-role key and bypass RLS.

-- ============================================================================
-- notes
-- ============================================================================

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  category text not null default 'Allgemein',
  is_pinned boolean not null default false,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reminder_at timestamptz,
  reminder_recurrence text default 'once',
  reminder_weekday int,
  reminder_day_of_month int,
  source text default 'app',
  feeds_threads boolean not null default false
);

create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists notes_updated_at_idx on public.notes (updated_at desc);

alter publication supabase_realtime add table public.notes;

alter table public.notes enable row level security;

create policy "own notes read"   on public.notes for select using (auth.uid() = user_id);
create policy "own notes insert" on public.notes for insert with check (auth.uid() = user_id);
create policy "own notes update" on public.notes for update using (auth.uid() = user_id);
create policy "own notes delete" on public.notes for delete using (auth.uid() = user_id);


-- ============================================================================
-- BrainstormApp: thoughts, threads, thought_threads, thread_similarities
-- ============================================================================
-- Atomare Gedanken (separat von "notes" um die alte Notiz-Funktion nicht zu
-- brechen). Werden vom Capture-Layer (Voice/Quick-Add) erzeugt und vom
-- Brainstorm-Worker zu Threads gruppiert.

create table if not exists public.thoughts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  source text not null default 'app',  -- 'app' | 'voice' | 'share' | 'bridge'
  raw_audio_url text,                   -- optional, falls Audio behalten werden soll
  created_at timestamptz not null default now(),
  processed_at timestamptz              -- gesetzt sobald der Worker den Thought verarbeitet hat
);

create index if not exists thoughts_user_idx
  on public.thoughts (user_id, created_at desc);

create index if not exists thoughts_unprocessed_idx
  on public.thoughts (user_id)
  where processed_at is null;

-- KI-gebildete Gruppen
create table if not exists public.threads (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null default 'active',  -- 'active' | 'archived'
  is_pinned boolean not null default false,
  thought_count int not null default 0,
  note_ids uuid[] not null default '{}',  -- zugeordnete Notizen (Quelle für den Graph)
  last_synthesized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists threads_user_idx
  on public.threads (user_id, updated_at desc);

-- M:N: ein Thought kann zu mehreren Threads gehören, ein Thread enthält viele Thoughts.
-- Kein eigenes user_id — Scoping erfolgt über thought_id/thread_id (beide user-scoped).
create table if not exists public.thought_threads (
  thought_id uuid not null references public.thoughts(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  relevance real default 1.0,
  created_at timestamptz not null default now(),
  primary key (thought_id, thread_id)
);

create index if not exists thought_threads_thread_idx
  on public.thought_threads (thread_id);

-- Ähnlichkeits-Kanten zwischen Threads (vom similarity-worker erzeugt).
create table if not exists public.thread_similarities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id_1 uuid not null references public.threads(id) on delete cascade,
  thread_id_2 uuid not null references public.threads(id) on delete cascade,
  label text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists thread_similarities_user_idx
  on public.thread_similarities (user_id);

-- Realtime aktivieren (UI bekommt Updates ohne Polling)
alter publication supabase_realtime add table public.thoughts;
alter publication supabase_realtime add table public.threads;
alter publication supabase_realtime add table public.thought_threads;

-- RLS: jede Zeile gehört einem auth.users-User; nur eigene Zeilen sichtbar.
alter table public.thoughts enable row level security;
alter table public.threads enable row level security;
alter table public.thought_threads enable row level security;
alter table public.thread_similarities enable row level security;

create policy "own thoughts read"   on public.thoughts for select using (auth.uid() = user_id);
create policy "own thoughts insert" on public.thoughts for insert with check (auth.uid() = user_id);
create policy "own thoughts update" on public.thoughts for update using (auth.uid() = user_id);
create policy "own thoughts delete" on public.thoughts for delete using (auth.uid() = user_id);

create policy "own threads read"    on public.threads for select using (auth.uid() = user_id);
create policy "own threads insert"  on public.threads for insert with check (auth.uid() = user_id);
create policy "own threads update"  on public.threads for update using (auth.uid() = user_id);
create policy "own threads delete"  on public.threads for delete using (auth.uid() = user_id);

create policy "own similarities read"   on public.thread_similarities for select using (auth.uid() = user_id);
create policy "own similarities insert" on public.thread_similarities for insert with check (auth.uid() = user_id);
create policy "own similarities update" on public.thread_similarities for update using (auth.uid() = user_id);
create policy "own similarities delete" on public.thread_similarities for delete using (auth.uid() = user_id);

-- thought_threads: über die verknüpften Threads des Users scopen.
create policy "own tt read" on public.thought_threads for select
  using (exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid()));
create policy "own tt insert" on public.thought_threads for insert
  with check (exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid()));
create policy "own tt update" on public.thought_threads for update
  using (exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid()));
create policy "own tt delete" on public.thought_threads for delete
  using (exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid()));

-- ============================================================================
-- Phase 3e: Abo-Modell & KI-Rate-Limiting — profiles-Tabelle
-- ============================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  tier          text not null default 'free',   -- 'free' | 'basic' | 'pro'
  ai_last_run   timestamptz,
  ai_runs_today int not null default 0,
  ai_day_reset  date,
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- Service-role (Bridge API) darf schreiben:
create policy "profiles: service insert"
  on public.profiles for insert
  with check (true);

-- Trigger: Row automatisch anlegen bei jedem neuen User (auch anonym)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Für bestehende User (bereits eingeloggte Accounts) nachholen:
-- INSERT INTO public.profiles (id)
-- SELECT id FROM auth.users
-- ON CONFLICT DO NOTHING;
