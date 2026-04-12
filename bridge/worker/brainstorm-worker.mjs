/**
 * brainstorm-worker.mjs
 *
 * Node.js-Helper für den Brainstorm-Worker.
 * Wird vom brainstorm-prompt.md via Claude Code aufgerufen.
 *
 * Befehle:
 *   node bridge/worker/brainstorm-worker.mjs fetch
 *     → Liest unverarbeitete Thoughts + aktive Threads aus Supabase, gibt JSON auf stdout aus.
 *
 *   node bridge/worker/brainstorm-worker.mjs write <json-datei-oder-inline-json>
 *     → Schreibt Synthese-Ergebnis (neue Threads, Updates, processed-Markierungen) nach Supabase.
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
    if (!process.env[key]) process.env[key] = val; // env hat Vorrang
  }
}

// Reihenfolge: lokale Worker-.env > NotizApp/.env > EXPO_PUBLIC_* Variablen
loadDotEnv(resolve(__dirname, '.env'));
loadDotEnv(resolve(__dirname, '../../.env'));  // NotizApp/.env

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

async function sbPatch(resource, body) {
  const url = `${SUPABASE_URL}/rest/v1/${resource}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...authHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PATCH ${resource} → HTTP ${res.status}: ${await res.text()}`);
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

async function sbBatchPatch(resource, body) {
  const url = `${SUPABASE_URL}/rest/v1/${resource}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...authHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PATCH ${resource} (batch) → HTTP ${res.status}: ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Subkommando: fetch
// ---------------------------------------------------------------------------

async function cmdFetch() {
  const [unprocessed, threads] = await Promise.all([
    sbGet(
      `thoughts?device_id=eq.${encodeURIComponent(DEVICE_ID)}&processed_at=is.null&order=created_at.asc&select=id,content,source,created_at`,
    ),
    sbGet(
      `threads?device_id=eq.${encodeURIComponent(DEVICE_ID)}&status=eq.active&order=updated_at.desc&select=id,title,summary,thought_count,last_synthesized_at`,
    ),
  ]);

  // Kürzlich verarbeitete Thoughts als Kontext (letzte 7 Tage, max. 30)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentProcessed = await sbGet(
    `thoughts?device_id=eq.${encodeURIComponent(DEVICE_ID)}&processed_at=not.is.null&created_at=gte.${since}&order=created_at.desc&limit=30&select=id,content,created_at`,
  );

  const output = {
    unprocessed_thoughts: unprocessed,
    active_threads: threads,
    recent_processed_thoughts: recentProcessed,
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
 *   new_threads: [{ id, title, summary, thought_ids: string[] }],
 *   thread_updates: [{ id, summary, thought_count, new_thought_ids: string[], status?: string }],
 *   processed_thought_ids: string[]
 * }
 *
 * Optimierungen:
 * - Batch-Operations: Alle neue Threads in 1 POST, alle thought_threads in 1 POST,
 *   alle processed_at Updates in 1 PATCH (statt N einzelne Requests)
 * - Idempotenz: Prüft Duplikat-Titel und überspringt
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
    thoughts_linked: 0,
    thoughts_processed: 0,
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
    const newThreadsById = new Map(); // Für thought_threads Zuordnung

    for (const t of results.new_threads ?? []) {
      // Idempotenz-Check: Skip if Titel existiert bereits
      if (existingTitles.has(t.title)) {
        stats.threads_deduplicated++;
        continue;
      }

      const threadId = t.id ?? randomUUID();
      newThreadsToInsert.push({
        id: threadId,
        device_id: DEVICE_ID,
        title: t.title,
        summary: t.summary ?? '',
        status: 'active',
        thought_count: (t.thought_ids ?? []).length,
        last_synthesized_at: now,
        created_at: now,
        updated_at: now,
      });
      newThreadsById.set(threadId, t.thought_ids ?? []);
      stats.threads_created++;
    }

    // Batch-POST: Alle neuen Threads auf einmal
    if (newThreadsToInsert.length > 0) {
      try {
        await sbBatchPost('threads', newThreadsToInsert, true);
      } catch (err) {
        stats.errors.push(`Batch INSERT threads: ${err.message}`);
      }
    }

    // === BATCH 2: Thread-Updates ===
    const threadUpdates = [];
    const updateThoughtsMap = new Map(); // thread_id → thought_ids

    for (const u of results.thread_updates ?? []) {
      threadUpdates.push({
        id: u.id,
        device_id: DEVICE_ID,
        summary: u.summary,
        thought_count: u.thought_count,
        status: u.status ?? 'active', // Für Pruning: kann 'dormant' sein
        last_synthesized_at: now,
        updated_at: now,
      });
      if ((u.new_thought_ids ?? []).length > 0) {
        updateThoughtsMap.set(u.id, u.new_thought_ids);
      }
      stats.threads_updated++;
    }

    // Batch-PATCH: Alle Thread-Updates auf einmal
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

    // === BATCH 3: Thought-Thread-Links ===
    const allThoughtThreadLinks = [];

    // Links aus neuen Threads
    for (const [threadId, thoughtIds] of newThreadsById.entries()) {
      for (const thoughtId of thoughtIds) {
        allThoughtThreadLinks.push({
          thought_id: thoughtId,
          thread_id: threadId,
          relevance: 1.0,
          created_at: now,
        });
        stats.thoughts_linked++;
      }
    }

    // Links aus Thread-Updates
    for (const [threadId, thoughtIds] of updateThoughtsMap.entries()) {
      for (const thoughtId of thoughtIds) {
        allThoughtThreadLinks.push({
          thought_id: thoughtId,
          thread_id: threadId,
          relevance: 1.0,
          created_at: now,
        });
        stats.thoughts_linked++;
      }
    }

    // Batch-POST: Alle thought_threads auf einmal
    if (allThoughtThreadLinks.length > 0) {
      try {
        await sbBatchPost('thought_threads', allThoughtThreadLinks, true);
      } catch (err) {
        stats.errors.push(`Batch INSERT thought_threads: ${err.message}`);
      }
    }

    // === BATCH 4: Mark Processed ===
    const thoughtIdsToProcess = results.processed_thought_ids ?? [];
    if (thoughtIdsToProcess.length > 0) {
      try {
        // Batch-Update: Alle Thoughts mit device_id markieren, deren ID in der Liste
        const processedUpdates = thoughtIdsToProcess.map(id => ({
          id,
          device_id: DEVICE_ID,
          processed_at: now,
        }));
        await sbBatchPatch(
          `thoughts?device_id=eq.${encodeURIComponent(DEVICE_ID)}`,
          processedUpdates,
        );
        stats.thoughts_processed = thoughtIdsToProcess.length;
      } catch (err) {
        stats.errors.push(`Batch UPDATE thoughts (processed_at): ${err.message}`);
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
    content,
    source: 'app',
    raw_audio_url: null,
    created_at: now,
    processed_at: null,
  };
  await sbPost('thoughts', row);
  console.log(`[brainstorm-worker] Thought gespeichert: "${content}" (id: ${row.id})`);
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
  console.error('Nutzung: node brainstorm-worker.mjs [fetch | write <json> | add "Gedanke"]');
  process.exit(1);
}
