-- Cleanup verwaister anonymer Supabase-User (Altlast aus dem frueheren Modell,
-- in dem die App beim ersten Start ungefragt einen anonymen User anlegte).
--
-- NICHT automatisch ausfuehren. Manuell im Supabase SQL-Editor mit
-- Service-Role, in der unten beschriebenen Reihenfolge und Staffelung.
--
-- Hintergrund: seit dem Umstieg auf das Lokal-first-Modell meldet die App eine
-- vorgefundene anonyme Session beim Start nur noch ab (siehe
-- src/sync/legacyAnon.ts) — der Remote-User bleibt bestehen. Dieses Skript
-- raeumt die Zurueckgebliebenen ab.
--
-- WICHTIG: Ein Geraet, das noch nicht aktualisiert hat, synchronisiert weiter
-- gegen seinen anonymen User. Wird der geloescht, verliert es die Remote-Daten
-- (die lokalen Notizen bleiben). Deshalb Schritt 2 erst nach einer Karenzzeit,
-- in der der Grossteil der Installationen aktualisiert wurde.

-- ── Schritt 0: Bestandsaufnahme ─────────────────────────────────────────────
-- Erst schauen, dann loeschen. Zeigt, wie viele anonyme User es gibt und wie
-- viele davon ueberhaupt Daten haben.
select
  count(*)                                              as anon_total,
  count(*) filter (where n.cnt > 0)                     as mit_notizen,
  count(*) filter (where coalesce(n.cnt, 0) = 0)        as leer,
  count(*) filter (where u.last_sign_in_at < now() - interval '60 days') as inaktiv_60d
from auth.users u
left join lateral (
  select count(*) as cnt from public.notes where user_id = u.id
) n on true
where u.is_anonymous;

-- ── Schritt 1: leere anonyme User (Sorte B) ─────────────────────────────────
-- Karteileichen aus App-Starts ohne jede Nutzung. Risikolos, sofort ausfuehrbar:
-- es haengen keine Daten daran.
delete from auth.users u
where u.is_anonymous
  and not exists (select 1 from public.notes             where user_id = u.id)
  and not exists (select 1 from public.thoughts          where user_id = u.id)
  and not exists (select 1 from public.threads           where user_id = u.id)
  and not exists (select 1 from public.thread_similarities where user_id = u.id);

-- ── Schritt 2: anonyme User mit Daten (Sorte A) ─────────────────────────────
-- ERST NACH KARENZZEIT ausfuehren (Empfehlung: 60-90 Tage nach dem Rollout der
-- Lokal-first-Version). Bis dahin behalten noch nicht aktualisierte Geraete
-- ihre Cloud-Kopie.
--
-- `on delete cascade` raeumt notes, thoughts, threads, thread_similarities und
-- profiles mit ab. Vor dem Ausfuehren das Intervall bewusst pruefen.
--
-- delete from auth.users u
-- where u.is_anonymous
--   and u.last_sign_in_at < now() - interval '60 days';

-- ── Schritt 3: Migrationsfunktion entfernen ─────────────────────────────────
-- `migrate_user` wurde nur fuer den Uebergang anonym → Konto gebraucht. Nachdem
-- Schritt 2 gelaufen ist, gibt es nichts mehr zu migrieren.
--
-- drop function if exists public.migrate_user(uuid, uuid);
