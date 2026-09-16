/**
 * seed-demo.mjs
 *
 * Seeds curated, neutral DEMO notes + threads for store screenshots into a
 * SINGLE, explicitly named demo account. English content.
 *
 * Safety:
 *   - Target account MUST be passed via DEMO_USER_ID (no implicit fallback to
 *     BRIDGE_USER_ID / private account).
 *   - Idempotent: every row has a fixed UUID (DEMO_* below) and is upserted, so
 *     re-running updates instead of duplicating.
 *   - Cleanup: `node scripts/seed-demo.mjs clean` deletes exactly these rows.
 *
 * Usage (PowerShell):
 *   $env:DEMO_USER_ID="<uuid>"; node scripts/seed-demo.mjs seed
 *   $env:DEMO_USER_ID="<uuid>"; node scripts/seed-demo.mjs clean
 *
 * Credentials are read like the brainstorm worker: bridge/worker/.env → NotizApp/.env
 * (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(resolve(__dirname, '../bridge/worker/.env'));
loadDotEnv(resolve(__dirname, '../.env'));

const BASE = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '')
  .trim()
  .replace(/\/$/, '');
const KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const USER_ID = (process.env.DEMO_USER_ID || '').trim();

if (!BASE || !KEY) {
  console.error('[seed-demo] Missing SUPABASE_URL / SUPABASE_SERVICE_KEY.');
  process.exit(1);
}
if (!USER_ID) {
  console.error('[seed-demo] DEMO_USER_ID is required (no implicit fallback).');
  console.error('  $env:DEMO_USER_ID="<uuid>"; node scripts/seed-demo.mjs seed');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// Fixed (valid hex) UUIDs → idempotent upsert / targeted cleanup.
// "de"=demo, "0a"=notes / "00"=threads marker block.
const N = (n) => `de000a00-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const T = (n) => `de000700-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

const now = new Date().toISOString();
const tomorrow10 = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
})();

const cl = (...items) =>
  items.map(([text, checked], i) => ({ id: `${i}`, text, checked: !!checked }));

const NOTES = [
  {
    id: N(1), title: 'Weekly plan', category: 'Work', is_pinned: true,
    content: 'Focus week — ship the new release.',
    checklist: cl(['Prep sprint review', true], ['Finalize designs', false], ['Send newsletter', false]),
    feeds_threads: true,
  },
  {
    id: N(2), title: 'Weekend groceries', category: 'Shopping', is_pinned: false,
    content: '', checklist: cl(['Milk', true], ['Coffee', false], ['Olive oil', false], ['Bread', false]),
    feeds_threads: false,
  },
  {
    id: N(3), title: 'Call the dentist', category: 'General', is_pinned: false,
    content: 'Book the check-up appointment.', checklist: [],
    reminder_at: tomorrow10, feeds_threads: false,
  },
  {
    id: N(4), title: 'Book ideas', category: 'Ideas', is_pinned: false,
    content: 'Short story about a lighthouse keeper.\nA collection of letters never sent.\nNotes on quiet mornings.',
    checklist: [], feeds_threads: true,
  },
  {
    id: N(5), title: 'Trip to Lisbon', category: 'Personal', is_pinned: false,
    content: 'Five days in late spring.',
    checklist: cl(['Flight', false], ['Hotel', true], ['Book city tour', false]),
    feeds_threads: true,
  },
  {
    id: N(6), title: 'Workout split', category: 'General', is_pinned: false,
    content: 'Mon: push · Wed: pull · Fri: legs. Keep it simple, stay consistent.',
    checklist: [], feeds_threads: true,
  },
  {
    id: N(7), title: '', category: 'General', is_pinned: false,
    content: 'Mornings feel clearer when I plan the day the night before.',
    checklist: [], feeds_threads: true,
  },
  {
    id: N(8), title: '', category: 'General', is_pinned: false,
    content: 'Would love to see Sintra and the coast, not just the city center.',
    checklist: [], feeds_threads: true,
  },
];

const THREADS = [
  {
    id: T(1), title: 'Productivity & Focus',
    summary: 'Building a calmer, more consistent week — planning ahead, training regularly, and protecting focus.',
    note_ids: [N(1), N(6), N(7)],
  },
  {
    id: T(2), title: 'Travel planning 2026',
    summary: 'Shaping a spring trip to Lisbon — logistics plus the wish to explore beyond the city center.',
    note_ids: [N(5), N(8)],
  },
];

function noteRow(n) {
  return {
    id: n.id,
    user_id: USER_ID,
    title: n.title,
    content: n.content,
    category: n.category,
    is_pinned: n.is_pinned,
    checklist: n.checklist,
    created_at: now,
    updated_at: now,
    reminder_at: n.reminder_at ?? null,
    reminder_recurrence: 'once',
    reminder_weekday: null,
    reminder_day_of_month: null,
    source: 'demo-seed',
    feeds_threads: n.feeds_threads,
  };
}

function threadRow(t) {
  return {
    id: t.id,
    user_id: USER_ID,
    title: t.title,
    summary: t.summary,
    status: 'active',
    thought_count: t.note_ids.length,
    note_ids: t.note_ids,
    is_pinned: false,
    last_synthesized_at: now,
    created_at: now,
    updated_at: now,
  };
}

async function upsert(table, rows) {
  const res = await fetch(`${BASE}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert ${table} → HTTP ${res.status}: ${await res.text()}`);
}

async function del(table) {
  // delete only demo rows for this user (source marker for notes, id prefix for threads)
  const filter =
    table === 'notes'
      ? `user_id=eq.${USER_ID}&source=eq.demo-seed`
      : `user_id=eq.${USER_ID}&id=in.(${THREADS.map((t) => t.id).join(',')})`;
  const res = await fetch(`${BASE}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  });
  if (!res.ok) throw new Error(`delete ${table} → HTTP ${res.status}: ${await res.text()}`);
}

const cmd = process.argv[2] || 'seed';

if (cmd === 'seed') {
  await upsert('notes', NOTES.map(noteRow));
  await upsert('threads', THREADS.map(threadRow));
  console.log(`[seed-demo] Seeded ${NOTES.length} notes + ${THREADS.length} threads → user ${USER_ID}`);
} else if (cmd === 'clean') {
  await del('threads');
  await del('notes');
  console.log(`[seed-demo] Removed demo notes + threads for user ${USER_ID}`);
} else {
  console.error('Usage: node scripts/seed-demo.mjs [seed | clean]   (requires DEMO_USER_ID)');
  process.exit(1);
}
