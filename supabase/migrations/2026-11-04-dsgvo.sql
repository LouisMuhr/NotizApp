-- DSGVO-Fixes vor dem Launch (Audit docs/audit/dsgvo-2026-11-04.md, Punkte M1, S1, S2).
-- Auf Projekt NotizApp (eu-central-1) eingespielt am 2026-11-04.

-- M1: Kontoloeschung muss alle Inhalte mitnehmen. Ohne Cascade scheitert der
-- Admin-Delete des Auth-Users an jeder uebrig gebliebenen Zeile.
-- thread_similarities und thought_threads haengen per Cascade an threads/thoughts.
alter table public.notes   drop constraint notes_user_fk,
  add constraint notes_user_fk   foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.thoughts drop constraint thoughts_user_fk,
  add constraint thoughts_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.threads drop constraint threads_user_fk,
  add constraint threads_user_fk  foreign key (user_id) references auth.users(id) on delete cascade;

-- S1: SECURITY-DEFINER-Funktionen nicht ueber /rest/v1/rpc aufrufbar machen.
-- Trigger und Event-Trigger feuern weiterhin (EXECUTE wird beim Feuern nicht geprueft).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- S2: ungenutzte Spalte (Bookmarklet nutzt seit dem Umzug in die Webapp das Login-Token).
alter table public.profiles drop column if exists bookmarklet_token_hash;

-- S2: anonyme Alt-User aus der Zeit vor lokal-first (ohne Notizen/Threads), einmalig.
delete from auth.users where is_anonymous;

-- NOCH NICHT EINGESPIELT (braucht deine Freigabe, laeuft als taeglicher Job):
-- Nie bestaetigte Registrierungen nach 30 Tagen loeschen, wie in der Datenschutzerklaerung zugesagt.
-- Unbestaetigte Konten syncen nie (accountState: nur `secured` hat eine UID) — es gehen keine Inhalte verloren.
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'delete-unconfirmed-signups',
--     '17 3 * * *',
--     $$delete from auth.users where email_confirmed_at is null and not is_anonymous
--       and created_at < now() - interval '30 days'$$
--   );
--   Rueckweg: select cron.unschedule('delete-unconfirmed-signups');

-- Rueckweg, falls noetig:
--   alter table public.notes drop constraint notes_user_fk,
--     add constraint notes_user_fk foreign key (user_id) references auth.users(id);
--   (analog thoughts_user_fk, threads_user_fk)
--   grant execute on function public.handle_new_user() to public, anon, authenticated;
--   grant execute on function public.rls_auto_enable() to public, anon, authenticated;
--   alter table public.profiles add column bookmarklet_token_hash text;
--   Geloeschte anonyme User sind nicht wiederherstellbar (hatten keine Inhalte).
