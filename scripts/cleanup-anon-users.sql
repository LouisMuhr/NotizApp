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

-- HINWEIS ZU DEN TYPEN: `user_id` ist nicht in allen Tabellen `uuid` — in
-- mindestens einer Installation ist `thread_similarities.user_id` vom Typ
-- `text` (Abweichung von supabase-schema.sql). Alle Vergleiche unten casten
-- daher beide Seiten auf `text`; das funktioniert fuer beide Typen.
-- Welche Spalten betroffen sind, zeigt:
--
--   select table_name, column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public' and column_name = 'user_id'
--    order by table_name;

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
  select count(*) as cnt from public.notes where user_id::text = u.id::text
) n on true
where u.is_anonymous;

-- ── Schritt 1a: Probelauf ───────────────────────────────────────────────────
-- Zaehlt, was Schritt 1b loeschen wuerde. Identische Bedingung, nur select.
select count(*) as wuerde_geloescht
from auth.users u
where u.is_anonymous
  and not exists (select 1 from public.notes               where user_id::text = u.id::text)
  and not exists (select 1 from public.thoughts            where user_id::text = u.id::text)
  and not exists (select 1 from public.threads             where user_id::text = u.id::text)
  and not exists (select 1 from public.thread_similarities where user_id::text = u.id::text);

-- ── Schritt 1b: leere anonyme User (Sorte B) ────────────────────────────────
-- Karteileichen aus App-Starts ohne jede Nutzung. Risikolos, sofort ausfuehrbar:
-- es haengen keine Daten daran.
delete from auth.users u
where u.is_anonymous
  and not exists (select 1 from public.notes               where user_id::text = u.id::text)
  and not exists (select 1 from public.thoughts            where user_id::text = u.id::text)
  and not exists (select 1 from public.threads             where user_id::text = u.id::text)
  and not exists (select 1 from public.thread_similarities where user_id::text = u.id::text);

-- ── Schritt 2: anonyme User mit Daten (Sorte A) ─────────────────────────────
-- ERST NACH KARENZZEIT ausfuehren (Empfehlung: 60-90 Tage nach dem Rollout der
-- Lokal-first-Version). Bis dahin behalten noch nicht aktualisierte Geraete
-- ihre Cloud-Kopie.
--
-- `on delete cascade` raeumt notes, thoughts, threads, thread_similarities und
-- profiles mit ab. Vor dem Ausfuehren das Intervall bewusst pruefen.
--
-- ACHTUNG: Der Cascade greift nur, wo `user_id` ein echter Foreign Key auf
-- auth.users(id) ist. Ist eine Spalte `text` (siehe Typ-Hinweis oben), gibt es
-- dort keinen FK — die Zeilen bleiben dann als Waisen liegen und muessen
-- separat geloescht werden. Vorher pruefen:
--
--   select tc.table_name
--     from information_schema.table_constraints tc
--     join information_schema.key_column_usage kcu
--       on tc.constraint_name = kcu.constraint_name
--    where tc.constraint_type = 'FOREIGN KEY'
--      and kcu.column_name = 'user_id' and tc.table_schema = 'public';
--
-- delete from auth.users u
-- where u.is_anonymous
--   and u.last_sign_in_at < now() - interval '60 days';

-- ── Schritt 3: Migrationsfunktion entfernen ─────────────────────────────────
-- `migrate_user` wurde nur fuer den Uebergang anonym → Konto gebraucht. Nachdem
-- Schritt 2 gelaufen ist, gibt es nichts mehr zu migrieren.
--
-- drop function if exists public.migrate_user(uuid, uuid);
