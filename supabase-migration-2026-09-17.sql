-- ============================================================================
-- Velm / NotizApp — Migration 2026-09-17 (Vor-Launch-Audit, Fix-Liste Stufe 1/2)
-- Fuer BESTEHENDE Projekte im Supabase SQL-Editor ausfuehren.
-- Neue Projekte: supabase-schema.sql enthaelt denselben Stand.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- S9: Archiv wird synchronisiert statt remote geloescht
-- ---------------------------------------------------------------------------
alter table public.notes add column if not exists archived_at timestamptz;
create index if not exists notes_user_archived_idx on public.notes (user_id, archived_at);

-- S10: DELETE-Events per Realtime mit user_id-Filter brauchen die ganze alte Zeile
alter table public.notes replica identity full;

-- ---------------------------------------------------------------------------
-- E1: Client darf profiles nicht mehr schreiben (tier/Limit-Zaehler nur Service-Role)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: own update" on public.profiles;

-- ---------------------------------------------------------------------------
-- O5 / X1: persoenlicher Bookmarklet-Schluessel (nur Hash gespeichert)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists bookmarklet_token_hash text;
create unique index if not exists profiles_bookmarklet_token_hash_idx
  on public.profiles (bookmarklet_token_hash) where bookmarklet_token_hash is not null;

-- ---------------------------------------------------------------------------
-- A1 / E11 / K3: Migration anonym → Konto als EINE Transaktion
-- Aufruf nur mit Service-Role (Bridge /api/migrate-user).
-- ---------------------------------------------------------------------------
create or replace function public.migrate_user(from_uid uuid, to_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_notes int; n_thoughts int; n_threads int; n_sims int;
begin
  if from_uid = to_uid then
    raise exception 'from_uid and to_uid must differ';
  end if;

  update public.notes set user_id = to_uid where user_id = from_uid;
  get diagnostics n_notes = row_count;

  update public.thoughts set user_id = to_uid where user_id = from_uid;
  get diagnostics n_thoughts = row_count;

  update public.threads set user_id = to_uid where user_id = from_uid;
  get diagnostics n_threads = row_count;

  update public.thread_similarities set user_id = to_uid where user_id = from_uid;
  get diagnostics n_sims = row_count;

  -- Limit-Zaehler zusammenfuehren, damit ein Sign-in das Kontingent nicht zuruecksetzt (E11)
  insert into public.profiles (id) values (to_uid) on conflict do nothing;
  update public.profiles p
     set ai_last_run   = greatest(p.ai_last_run, f.ai_last_run),
         ai_day_reset  = greatest(p.ai_day_reset, f.ai_day_reset),
         ai_runs_today = case
                           when p.ai_day_reset = f.ai_day_reset then p.ai_runs_today + f.ai_runs_today
                           when coalesce(p.ai_day_reset, date '1970-01-01') > coalesce(f.ai_day_reset, date '1970-01-01') then p.ai_runs_today
                           else f.ai_runs_today
                         end
    from public.profiles f
   where p.id = to_uid and f.id = from_uid;

  return jsonb_build_object(
    'notes', n_notes, 'thoughts', n_thoughts, 'threads', n_threads, 'similarities', n_sims
  );
end;
$$;

revoke all on function public.migrate_user(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hinweis (manuell, nicht per SQL):
--   * Vercel-Env MCP_BEARER_TOKEN und BRIDGE_USER_ID werden von den Endpunkten
--     nicht mehr gelesen — den kompromittierten Token trotzdem rotieren/loeschen.
--   * Vercel-Env BOOKMARKLET_MIN_TIER (optional, Default 'basic').
-- ---------------------------------------------------------------------------
