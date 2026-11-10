-- Abo-Abgleich mit RevenueCat (Google Play). Siehe bridge/api/_lib/billing.ts.
-- tier_source: 'manual' = per Hand vergeben (Admin/Test), 'revenuecat' = aus einem Store-Abo.
-- Ein Store-Abgleich setzt einen 'manual'-Tier nie herunter.
-- Geschrieben wird nur von der Bridge (Service-Role); profiles hat weiterhin keine Client-Update-Policy.

alter table public.profiles
  add column if not exists tier_source text not null default 'manual'
    check (tier_source in ('manual', 'revenuecat')),
  add column if not exists tier_expires_at timestamptz,
  add column if not exists billing_synced_at timestamptz;
