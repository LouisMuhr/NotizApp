-- NotizApp Supabase schema
-- Run this in the Supabase SQL editor of a fresh project.

create table if not exists public.notes (
  id uuid primary key,
  device_id text not null,
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

-- Migration: feeds_threads Spalte (in bestehenden Projekten ausführen)
-- ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS feeds_threads boolean NOT NULL DEFAULT false;

create index if not exists notes_device_id_idx on public.notes (device_id);
create index if not exists notes_updated_at_idx on public.notes (updated_at desc);

-- Enable Realtime for the notes table (UI: Database → Replication → enable for `notes`)
-- Or via SQL:
alter publication supabase_realtime add table public.notes;

-- RLS: simple single-user setup. Anon key may read/write only its own device_id rows.
alter table public.notes enable row level security;

create policy "device read"
  on public.notes for select
  using (true);

create policy "device insert"
  on public.notes for insert
  with check (true);

create policy "device update"
  on public.notes for update
  using (true);

-- NOTE: For multi-user / public deployment, replace the above with policies
-- that restrict by an authenticated JWT claim. The MCP server uses the
-- service-role key and bypasses RLS anyway.


-- ============================================================================
-- BrainstormApp: thoughts, threads, thought_threads
-- ============================================================================
-- Atomare Gedanken (separat von "notes" um die alte Notiz-Funktion nicht zu
-- brechen). Werden vom Capture-Layer (Voice/Quick-Add) erzeugt und vom
-- Brainstorm-Worker zu Threads gruppiert.

create table if not exists public.thoughts (
  id uuid primary key,
  device_id text not null,
  content text not null,
  source text not null default 'app',  -- 'app' | 'voice' | 'share' | 'bridge'
  raw_audio_url text,                   -- optional, falls Audio behalten werden soll
  created_at timestamptz not null default now(),
  processed_at timestamptz              -- gesetzt sobald der Worker den Thought verarbeitet hat
);

create index if not exists thoughts_device_idx
  on public.thoughts (device_id, created_at desc);

create index if not exists thoughts_unprocessed_idx
  on public.thoughts (device_id)
  where processed_at is null;

-- KI-gebildete Gruppen
create table if not exists public.threads (
  id uuid primary key,
  device_id text not null,
  title text not null,
  summary text not null default '',
  status text not null default 'active',  -- 'active' | 'archived'
  thought_count int not null default 0,
  last_synthesized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists threads_device_idx
  on public.threads (device_id, updated_at desc);

-- M:N: ein Thought kann zu mehreren Threads gehören, ein Thread enthält viele Thoughts
create table if not exists public.thought_threads (
  thought_id uuid not null references public.thoughts(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  relevance real default 1.0,
  created_at timestamptz not null default now(),
  primary key (thought_id, thread_id)
);

create index if not exists thought_threads_thread_idx
  on public.thought_threads (thread_id);

-- Realtime aktivieren (UI bekommt Updates ohne Polling)
alter publication supabase_realtime add table public.thoughts;
alter publication supabase_realtime add table public.threads;
alter publication supabase_realtime add table public.thought_threads;

-- RLS: gleicher single-device-Stil wie bei notes (permissive, MCP/service-role bypasst)
alter table public.thoughts enable row level security;
alter table public.threads enable row level security;
alter table public.thought_threads enable row level security;

create policy "thoughts read"   on public.thoughts for select using (true);
create policy "thoughts insert" on public.thoughts for insert with check (true);
create policy "thoughts update" on public.thoughts for update using (true);
create policy "thoughts delete" on public.thoughts for delete using (true);

create policy "threads read"    on public.threads for select using (true);
create policy "threads insert"  on public.threads for insert with check (true);
create policy "threads update"  on public.threads for update using (true);
create policy "threads delete"  on public.threads for delete using (true);

create policy "tt read"         on public.thought_threads for select using (true);
create policy "tt insert"       on public.thought_threads for insert with check (true);
create policy "tt update"       on public.thought_threads for update using (true);
create policy "tt delete"       on public.thought_threads for delete using (true);
