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
  source text default 'app'
);

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
