-- ============================================================================
-- Velm / NotizApp — Migration 2026-09-24 (KI-Sprachnotizen, Pro)
-- Fuer BESTEHENDE Projekte im Supabase SQL-Editor ausfuehren.
-- Neue Projekte: supabase-schema.sql enthaelt denselben Stand.
-- ============================================================================

-- Tageszaehler fuer /api/parse-note (30 Laeufe pro UTC-Tag, nur Service-Role schreibt)
alter table public.profiles add column if not exists voice_ai_runs_today int not null default 0;
alter table public.profiles add column if not exists voice_ai_day_reset date;
