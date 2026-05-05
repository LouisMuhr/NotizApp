/**
 * similarity-worker.mjs
 *
 * Befehle:
 *   node bridge/worker/similarity-worker.mjs fetch
 *     → Gibt alle aktiven Threads (id, title, summary) als JSON aus.
 *
 *   node bridge/worker/similarity-worker.mjs write <json>
 *     → Schreibt Similarity-Paare in die thread_similarities Tabelle.
 *       Erwartet: [{"thread_id_1": "...", "thread_id_2": "...", "label": "..."}]
 *
 *   node bridge/worker/similarity-worker.mjs clear
 *     → Löscht alle bestehenden Similarity-Einträge (vor neuem Lauf sinnvoll).
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(resolve(__dirname, '.env'));
loadDotEnv(resolve(__dirname, '../../.env'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BRIDGE_USER_ID = process.env.BRIDGE_USER_ID || process.env.DEVICE_ID;

if (!SUPABASE_URL || !SERVICE_KEY || !BRIDGE_USER_ID) {
  console.error('[similarity-worker] Fehlende Credentials (SUPABASE_URL, SUPABASE_SERVICE_KEY, BRIDGE_USER_ID).');
  process.exit(1);
}

function authHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function sbGet(resource) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${resource} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbPost(resource, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${resource} → ${res.status}: ${await res.text()}`);
}

async function sbDelete(resource) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`DELETE ${resource} → ${res.status}: ${await res.text()}`);
}

async function cmdFetch() {
  const threads = await sbGet(
    `threads?user_id=eq.${encodeURIComponent(BRIDGE_USER_ID)}&status=eq.active&select=id,title,summary&order=updated_at.desc`,
  );
  process.stdout.write(JSON.stringify({ threads, user_id: BRIDGE_USER_ID }, null, 2) + '\n');
}

async function cmdWrite(arg) {
  if (!arg) {
    console.error('[similarity-worker] write: kein Argument. Nutze: write <json-string>');
    process.exit(1);
  }

  let pairs;
  try {
    const raw = arg.trimStart().startsWith('[') ? arg : arg.slice(arg.indexOf('['));
    pairs = JSON.parse(raw);
  } catch (err) {
    console.error('[similarity-worker] write: JSON-Fehler:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(pairs) || pairs.length === 0) {
    console.log('[similarity-worker] Keine Paare zum Schreiben.');
    return;
  }

  const rows = pairs.map(({ thread_id_1, thread_id_2, label }) => ({
    user_id: BRIDGE_USER_ID,
    thread_id_1,
    thread_id_2,
    label: label ?? '',
  }));

  await sbPost('thread_similarities', rows);
  console.log(`[similarity-worker] ${rows.length} Similarity-Paare gespeichert.`);
}

async function cmdClear() {
  await sbDelete(`thread_similarities?user_id=eq.${encodeURIComponent(BRIDGE_USER_ID)}`);
  console.log('[similarity-worker] Alle Einträge gelöscht.');
}

const cmd = process.argv[2];
if (cmd === 'fetch')       await cmdFetch();
else if (cmd === 'write')  await cmdWrite(process.argv[3]);
else if (cmd === 'clear')  await cmdClear();
else {
  console.error('Nutzung: node similarity-worker.mjs [fetch | write <json> | clear]');
  process.exit(1);
}
