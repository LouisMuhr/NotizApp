/**
 * brainstorm-worker.mjs
 *
 * Node.js-Helper für den Brainstorm-Worker.
 * Wird vom brainstorm-prompt.md via Claude Code aufgerufen.
 *
 * Befehle:
 *   node bridge/worker/brainstorm-worker.mjs fetch
 *     → Liest Notizen mit feeds_threads=true + aktive Threads aus Supabase, gibt JSON auf stdout aus.
 *
 *   node bridge/worker/brainstorm-worker.mjs write <json-datei-oder-inline-json>
 *     → Schreibt Synthese-Ergebnis (neue Threads, Updates) nach Supabase.
 *
 * Credentials (wird automatisch geladen):
 *   1. Umgebungsvariablen:  SUPABASE_URL, SUPABASE_SERVICE_KEY, DEVICE_ID
 *   2. Fallback EXPO_PUBLIC_* Variablen aus NotizApp/.env
 *   3. bridge/worker/.env (für lokale Nutzung)
 *
 * Hinweis: SUPABASE_SERVICE_KEY = service_role-Key aus dem Supabase-Dashboard.
 *          Der anon-Key hat ggf. keine PATCH/UPDATE-Rechte wenn RLS strenger wird.
 *          Für den MVP mit `using (true)` RLS reicht auch der anon-Key.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// .env laden (minimaler Parser, kein dotenv-Paket nötig)
// ---------------------------------------------------------------------------

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

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const DEVICE_ID =
  process.env.DEVICE_ID || process.env.EXPO_PUBLIC_DEVICE_ID;

if (!SUPABASE_URL || !SERVICE_KEY || !DEVICE_ID) {
  console.error('[brainstorm-worker] Fehlende Credentials.');
  console.error(
    'Benötigt: SUPABASE_URL, SUPABASE_SERVICE_KEY (oder EXPO_PUBLIC_*), DEVICE_ID',
  );
  console.error('Status:', {
    SUPABASE_URL: !!SUPABASE_URL,
    SERVICE_KEY: !!SERVICE_KEY,
    DEVICE_ID: !!DEVICE_ID,
  });
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase REST API Helfer
// ---------------------------------------------------------------------------

function authHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function sbGet(resource) {
  const url = `${SUPABASE_URL}/rest/v1/${resource}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`GET ${resource} → HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function sbPost(resource, body, upsert = false) {
  const url = `${SUPABASE_URL}/rest/v1/${resource}`;
  const headers = {
    ...authHeaders(),
    Prefer: upsert ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${resource} → HTTP ${res.status}: ${await res.text()}`);
  }
}

async function sbBatchPost(resource, body, upsert = false) {
  const url = `${SUPABASE_URL}/rest/v1/${resource}`;
  const headers = {
    ...authHeaders(),
    Prefer: upsert ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${resource} (batch) → HTTP ${res.status}: ${await res.text()}`);
  }
}

async function sbBatchPatch(resource, items) {
  // Supabase REST-API unterstützt kein echtes Batch-PATCH mit verschiedenen IDs.
  // Deshalb: individuelle PATCH-Requests pro Item (gefiltert nach id).
  for (const item of items) {
    const { id, ...fields } = item;
    const url = `${SUPABASE_URL}/rest/v1/${resource}&id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...authHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      throw new Error(`PATCH ${resource} id=${id} → HTTP ${res.status}: ${await res.text()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Subkommando: fetch
// Liest Notizen mit feeds_threads=true (Input für den Worker) + aktive Threads.
// ---------------------------------------------------------------------------

async function cmdFetch() {
  const [notes, threads] = await Promise.all([
    sbGet(
      `notes?device_id=eq.${encodeURIComponent(DEVICE_ID)}&feeds_threads=eq.true&order=created_at.asc&select=id,title,content,created_at,updated_at`,
    ),
    sbGet(
      `threads?device_id=eq.${encodeURIComponent(DEVICE_ID)}&status=eq.active&order=updated_at.desc&select=id,title,summary,thought_count,last_synthesized_at`,
    ),
  ]);

  const output = {
    feed_notes: notes,
    active_threads: threads,
    device_id: DEVICE_ID,
    fetched_at: new Date().toISOString(),
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Subkommando: write
// ---------------------------------------------------------------------------

/**
 * Erwartet JSON (Dateiname oder Inline-JSON-String) mit:
 * {
 *   new_threads: [{ id?, title, summary, note_count: number }],
 *   thread_updates: [{ id, summary, note_count, status?: string }],
 * }
 */
async function cmdWrite(arg) {
  if (!arg) {
    console.error('[brainstorm-worker] write: kein Argument. Nutze: write <json-datei|json-string>');
    process.exit(1);
  }

  let results;
  try {
    if (arg.trimStart().startsWith('{')) {
      results = JSON.parse(arg);
    } else {
      results = JSON.parse(readFileSync(arg, 'utf8'));
    }
  } catch (err) {
    console.error('[brainstorm-worker] write: JSON-Fehler:', err.message);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const stats = {
    threads_created: 0,
    threads_updated: 0,
    threads_deduplicated: 0,
    errors: [],
  };

  try {
    // Idempotenz: Existierende Thread-Titel laden
    let existingTitles = new Set();
    try {
      const existing = await sbGet(
        `threads?device_id=eq.${encodeURIComponent(DEVICE_ID)}&select=title`,
      );
      existingTitles = new Set(existing.map(t => t.title));
    } catch (err) {
      stats.errors.push(`Failed to load existing titles: ${err.message}`);
    }

    // === BATCH 1: Neue Threads ===
    const newThreadsToInsert = [];

    for (const t of results.new_threads ?? []) {
      if (existingTitles.has(t.title)) {
        stats.threads_deduplicated++;
        continue;
      }
      newThreadsToInsert.push({
        id: t.id ?? randomUUID(),
        device_id: DEVICE_ID,
        title: t.title,
        summary: t.summary ?? '',
        status: 'active',
        thought_count: t.note_count ?? 0,
        last_synthesized_at: now,
        created_at: now,
        updated_at: now,
      });
      stats.threads_created++;
    }

    if (newThreadsToInsert.length > 0) {
      try {
        await sbBatchPost('threads', newThreadsToInsert, true);
      } catch (err) {
        stats.errors.push(`Batch INSERT threads: ${err.message}`);
      }
    }

    // === BATCH 2: Thread-Updates ===
    const threadUpdates = [];

    for (const u of results.thread_updates ?? []) {
      threadUpdates.push({
        id: u.id,
        device_id: DEVICE_ID,
        summary: u.summary,
        thought_count: u.note_count,
        status: u.status ?? 'active',
        last_synthesized_at: now,
        updated_at: now,
      });
      stats.threads_updated++;
    }

    if (threadUpdates.length > 0) {
      try {
        await sbBatchPatch(
          `threads?device_id=eq.${encodeURIComponent(DEVICE_ID)}`,
          threadUpdates,
        );
      } catch (err) {
        stats.errors.push(`Batch UPDATE threads: ${err.message}`);
      }
    }
  } catch (err) {
    stats.errors.push(`Unexpected error: ${err.message}`);
  }

  if (stats.errors.length > 0) {
    console.error('[brainstorm-worker] Fehler:', stats.errors);
  }
  console.log('[brainstorm-worker] Fertig:', JSON.stringify(stats));
}

// ---------------------------------------------------------------------------
// Subkommando: add
// Fügt eine Notiz mit feeds_threads=true direkt in Supabase ein.
// ---------------------------------------------------------------------------

async function cmdAdd(content) {
  if (!content) {
    console.error('[brainstorm-worker] add: kein Inhalt. Nutze: add "Dein Gedanke"');
    process.exit(1);
  }
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    device_id: DEVICE_ID,
    title: '',
    content,
    category: 'Allgemein',
    is_pinned: false,
    checklist: '[]',
    created_at: now,
    updated_at: now,
    reminder_at: null,
    reminder_recurrence: 'once',
    reminder_weekday: null,
    reminder_day_of_month: null,
    notification_id: null,
    feeds_threads: true,
  };
  await sbPost('notes', row);
  console.log(`[brainstorm-worker] Notiz gespeichert: "${content}" (id: ${row.id})`);
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

const cmd = process.argv[2];
if (cmd === 'fetch') {
  await cmdFetch();
} else if (cmd === 'write') {
  await cmdWrite(process.argv[3]);
} else if (cmd === 'add') {
  await cmdAdd(process.argv[3]);
} else {
  console.error('Nutzung: node brainstorm-worker.mjs [fetch | write <json> | add "Notiz"]');
  process.exit(1);
}
