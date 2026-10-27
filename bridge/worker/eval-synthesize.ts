/**
 * Qualitaets-Check fuer die Thread-Synthese (bridge/api/synthesize.ts) gegen die
 * ECHTE Anthropic-API und einen echten Test-Account. Ruft den Produktions-Handler
 * auf (Prompt + Schreiblogik), nur die Token-Pruefung wird auf den Test-User umgebogen.
 *
 *   node --experimental-transform-types bridge/worker/eval-synthesize.ts seed
 *   node --experimental-transform-types bridge/worker/eval-synthesize.ts run <label>
 *
 * Optional: --email <adresse> (Default unten; muss "+test" enthalten, weil `run`
 * die Threads des Accounts loescht). --prompt <datei> ersetzt den System-Prompt
 * (alte Versionen liegen in bridge/worker/synthesis-prompts/). --model <id> / --effort <stufe>
 * testen ein anderes Modell (max_tokens dann 16000). --locale de|en (Default de) waehlt die
 * Sprache der KI-Ausgabe (Titel/Summary/Label), wie im echten Request-Body. Keys aus bridge/worker/.env.
 *
 * `seed` legt 20 Notizen mit bekannter Soll-Gruppierung an (feste IDs, idempotent).
 * `run` setzt Threads, Verbindungen und Rate-Limit des Accounts zurueck, synthetisiert
 * und schreibt einen Bericht nach bridge/worker/logs/synthesis-<zeit>-<label>.md.
 * --scenario incremental: erst ohne die Notizen aus WAVE_2 synthetisieren, dann mit
 * allen ein zweites Mal (wie im echten Betrieb, wo jeder Lauf alle Notizen bekommt).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import handler from '../api/synthesize.ts';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
if (!SUPABASE_URL || !SERVICE_KEY || !process.env.ANTHROPIC_API_KEY) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_KEY und ANTHROPIC_API_KEY noetig (Umgebung oder bridge/worker/.env).');
  process.exit(1);
}

const args = process.argv.slice(2);
const emailIdx = args.indexOf('--email');
const EMAIL = emailIdx >= 0 ? args.splice(emailIdx, 2)[1] : 'louismuhr8+test1@gmail.com';
const promptIdx = args.indexOf('--prompt');
const PROMPT_OVERRIDE = promptIdx >= 0
  ? readFileSync(resolve(args.splice(promptIdx, 2)[1]), 'utf8').replace(/\r\n/g, '\n')
  : null;
const modelIdx = args.indexOf('--model');
const MODEL_OVERRIDE = modelIdx >= 0 ? args.splice(modelIdx, 2)[1] : null;
// --thinking <budget>: Thinking mit festem Budget (Haiku 4.5; neuere Modelle nehmen stattdessen --effort).
const thinkingIdx = args.indexOf('--thinking');
const THINKING = thinkingIdx >= 0 ? Number(args.splice(thinkingIdx, 2)[1]) : 0;
const effortIdx = args.indexOf('--effort');
const EFFORT = effortIdx >= 0 ? args.splice(effortIdx, 2)[1] : null;
const localeIdx = args.indexOf('--locale');
const LOCALE = localeIdx >= 0 ? args.splice(localeIdx, 2)[1] : 'de';
const scenarioIdx = args.indexOf('--scenario');
const SCENARIO = scenarioIdx >= 0 ? args.splice(scenarioIdx, 2)[1] : 'cold';
if (SCENARIO !== 'cold' && SCENARIO !== 'incremental') {
  console.error('--scenario cold | incremental');
  process.exit(1);
}
const [command, label = 'run'] = args;
if (!EMAIL.includes('+test')) {
  console.error(`Abbruch: ${EMAIL} ist kein Test-Account (+test fehlt) — "run" loescht dessen Threads.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Testdaten mit Soll-Gruppierung
// ---------------------------------------------------------------------------

type Group = 'habit' | 'rezept' | 'finanzen' | 'laufen' | 'ernaehrung' | 'portugal' | 'geschenk' | 'link' | 'junk';

interface SeedNote { n: number; group: Group; also?: Group; daysAgo: number; title: string; content: string }

const GROUP_NAMES: Record<Group, string> = {
  habit: 'Habit-Tracker-App',
  rezept: 'Kühlschrank-/Rezept-App',
  finanzen: 'Finanzen & Sparen',
  laufen: 'Halbmarathon-Training',
  ernaehrung: 'Ernährung',
  portugal: 'Portugal-Urlaub',
  geschenk: 'Geschenk Mama (isoliert)',
  link: 'Nur ein Link',
  junk: 'Inhaltsleer (soll ignoriert werden)',
};

const NOTES: SeedNote[] = [
  { n: 1, group: 'habit', daysAgo: 20, title: 'App-Idee: Gewohnheiten', content: 'Eine App, die Gewohnheiten nicht mit Streaks trackt, sondern mit einem Wochenrückblick. Streaks machen Druck, ein Rückblick motiviert eher.' },
  { n: 2, group: 'habit', daysAgo: 17, title: 'Habit-App Onboarding', content: 'Beim ersten Start nur drei Gewohnheiten erlauben. Wer mit zehn anfängt, hört nach einer Woche auf.' },
  { n: 3, group: 'habit', daysAgo: 6, title: 'Monetarisierung Habit-App', content: 'Basis kostenlos, Pro für Statistiken und Export. Kein Abo unter 3 € im Monat, das wirkt unseriös. Vielleicht Einmalkauf testen.' },
  { n: 4, group: 'rezept', daysAgo: 15, title: 'Rezept-App', content: 'Rezepte danach filtern, was gerade im Kühlschrank ist. Foto vom Kühlschrank machen → Vorschläge bekommen.' },
  { n: 5, group: 'rezept', daysAgo: 4, title: '', content: 'Für die Kühlschrank-App: Haltbarkeit mitschätzen, damit zuerst verbraucht wird, was bald schlecht wird.' },
  { n: 6, group: 'finanzen', daysAgo: 19, title: 'ETF-Sparplan', content: 'Sparplan von 150 auf 250 € erhöhen, sobald die Gehaltserhöhung durch ist. MSCI World plus 20 % Emerging Markets.' },
  { n: 7, group: 'finanzen', daysAgo: 12, title: 'Notgroschen', content: 'Erst den Notgroschen auf drei Netto-Monatsgehälter auffüllen, bevor mehr in ETFs geht. Tagesgeldkonten vergleichen.' },
  { n: 8, group: 'finanzen', daysAgo: 2, title: 'Freistellungsauftrag', content: 'Freistellungsauftrag bei der neuen Bank einrichten, sonst zahle ich auf die Zinsen Steuern.' },
  { n: 9, group: 'laufen', daysAgo: 18, title: 'Halbmarathon Trainingsplan', content: '12-Wochen-Plan: drei Läufe pro Woche, ein langer Lauf am Sonntag, jede Woche einen Kilometer mehr.' },
  { n: 10, group: 'laufen', daysAgo: 13, title: 'Laufschuhe', content: 'Neue Laufschuhe vor dem Training kaufen, die alten haben über 800 km. Laufanalyse im Sportgeschäft machen lassen.' },
  { n: 11, group: 'laufen', daysAgo: 3, title: 'Knie', content: 'Nach dem langen Lauf am Sonntag wieder Knieschmerzen außen. Physio fragen, ob das IT-Band ist.' },
  { n: 12, group: 'ernaehrung', daysAgo: 10, title: 'Mehr Protein', content: 'Ziel: 120 g Protein am Tag. Skyr zum Frühstück, Linsen statt Nudeln.' },
  { n: 13, group: 'ernaehrung', daysAgo: 5, title: 'Meal Prep', content: 'Sonntags für drei Tage vorkochen, dann esse ich unter der Woche weniger Fast Food.' },
  { n: 14, group: 'portugal', daysAgo: 16, title: 'Portugal im Mai', content: 'Lissabon vier Tage, dann mit dem Mietwagen an die Algarve. Unterkünfte früh buchen, im Mai ist schon viel voll.' },
  { n: 15, group: 'portugal', daysAgo: 9, title: 'Lissabon Tipps', content: 'Von Anna: LX Factory, Pastéis de Belém, Sonnenuntergang am Miradouro da Senhora do Monte.' },
  { n: 16, group: 'portugal', also: 'laufen', daysAgo: 1, title: 'Lissabon Halbmarathon?', content: 'Im März ist der Lissabon-Halbmarathon. Könnte Urlaub und Laufziel verbinden – dann aber die Reise vorziehen.' },
  { n: 17, group: 'junk', daysAgo: 8, title: '', content: 'ok' },
  { n: 18, group: 'junk', daysAgo: 7, title: 'erledigen', content: '' },
  { n: 19, group: 'link', daysAgo: 11, title: '', content: 'https://example.com/artikel/produktiver-arbeiten' },
  { n: 20, group: 'geschenk', daysAgo: 14, title: 'Geschenk Mama', content: 'Mama hat im November Geburtstag. Idee: zusammen einen Töpferkurs machen statt etwas zu kaufen.' },
];

/** Erwartete Verbindungen; `optional` = vertretbar, aber kein Muss. */
const EXPECTED_LINKS: Array<{ a: Group; b: Group; optional?: boolean }> = [
  { a: 'habit', b: 'rezept' },
  { a: 'laufen', b: 'ernaehrung' },
  { a: 'laufen', b: 'portugal', optional: true },
];

/** Kommen im Szenario "incremental" erst im zweiten Lauf dazu (5 × bestehendes Thema, 1 × neues). */
const WAVE_2 = [3, 5, 8, 11, 16, 20];

const noteId = (n: number) => `5e000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const byId = new Map(NOTES.map((s) => [noteId(s.n), s]));
const noteLabel = (id: string) => {
  const s = byId.get(id);
  if (!s) return `?? ${id}`;
  const text = s.title || s.content;
  return `N${String(s.n).padStart(2, '0')} ${text.length > 50 ? text.slice(0, 50) + '…' : text}`;
};

// ---------------------------------------------------------------------------
// Supabase-Helfer (Service-Key)
// ---------------------------------------------------------------------------

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

async function sb(method: string, path: string, body?: unknown, prefer = 'return=minimal'): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { ...headers, Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

async function resolveUserId(): Promise<string> {
  const data = await sb('GET', '/auth/v1/admin/users?per_page=1000');
  const user = (data.users ?? []).find((u: any) => u.email === EMAIL);
  if (!user) throw new Error(`Kein User mit ${EMAIL}`);
  return user.id;
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed(userId: string) {
  const now = Date.now();
  const rows = NOTES.map((s) => {
    const at = new Date(now - s.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return {
      id: noteId(s.n), user_id: userId, title: s.title, content: s.content,
      category: 'Allgemein', source: 'app', feeds_threads: true, archived_at: null,
      created_at: at, updated_at: at,
    };
  });
  await sb('POST', '/rest/v1/notes', rows, 'resolution=merge-duplicates,return=minimal');
  console.log(`${rows.length} Notizen fuer ${EMAIL} angelegt/aktualisiert.`);
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

interface Pass { res: any; aiRequest: any; aiResponse: any; seconds: string }

/** Ein Lauf des Produktions-Handlers; Token-Pruefung auf den Test-User umgebogen. */
async function synthesizeOnce(userId: string): Promise<Pass> {
  await sb('PATCH', `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, { ai_last_run: null, ai_runs_today: 0, ai_day_reset: null });

  const realFetch = globalThis.fetch;
  let aiRequest: any = null;
  let aiResponse: any = null;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith(`${SUPABASE_URL}/auth/v1/user`)) {
      return new Response(JSON.stringify({ id: userId }), { status: 200 });
    }
    if (url.startsWith('https://api.anthropic.com')) {
      const body = JSON.parse(init.body);
      if (PROMPT_OVERRIDE !== null) body.system = PROMPT_OVERRIDE;
      // Andere Modelle denken ggf. mit: Denk-Tokens zaehlen gegen max_tokens.
      if (MODEL_OVERRIDE) { body.model = MODEL_OVERRIDE; body.max_tokens = 16000; }
      if (EFFORT) body.output_config = { ...(body.output_config ?? {}), effort: EFFORT };
      if (THINKING) { body.thinking = { type: 'enabled', budget_tokens: THINKING }; body.max_tokens = Math.max(body.max_tokens, THINKING + 8192); }
      init = { ...init, body: JSON.stringify(body) };
    }
    const res = await realFetch(input, init);
    if (url.startsWith('https://api.anthropic.com')) {
      aiRequest = JSON.parse(init.body);
      aiResponse = await res.clone().json().catch(() => null);
    }
    return res;
  }) as typeof fetch;

  const res: any = { statusCode: 0, body: undefined, setHeader() {}, status(s: number) { res.statusCode = s; return res; }, json(b: any) { res.body = b; return res; }, end(b?: any) { res.body = b; return res; } };
  const started = Date.now();
  try {
    await handler({ method: 'POST', headers: { authorization: 'Bearer eval' }, body: { locale: LOCALE } }, res);
  } finally {
    globalThis.fetch = realFetch;
  }
  return { res, aiRequest, aiResponse, seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

const aiText = (p: Pass): string => (p.aiResponse?.content ?? []).find((b: any) => b?.type === 'text')?.text ?? '';

/** Notizen, die das Modell selbst in mehrere Threads gesteckt hat (vor der Server-Bereinigung). */
function aiDoubleAssignments(p: Pass): string[] {
  try {
    const input = JSON.parse(p.aiRequest.messages[0].content);
    const notes: any[] = input.new_notes ?? input.feed_notes ?? [];
    const seedOf = new Map(notes.map((n) => [String(n.id), NOTES.find((s) => s.title === n.title && s.content === n.content)]));
    const out = JSON.parse(aiText(p).match(/\{[\s\S]*\}/)![0]);
    const count = new Map<string, number>();
    for (const t of [...(out.new_threads ?? []), ...(out.thread_updates ?? [])]) {
      for (const r of new Set<string>((t.note_ids ?? []).map(String))) count.set(r, (count.get(r) ?? 0) + 1);
    }
    return [...count].filter(([, c]) => c > 1).map(([r]) => {
      const s = seedOf.get(r);
      return s ? noteLabel(noteId(s.n)) : r;
    });
  } catch {
    return ['(Antwort nicht auswertbar)'];
  }
}

async function setFeeds(uid: string, ns: number[], value: boolean) {
  const ids = ns.map(noteId).join(',');
  await sb('PATCH', `/rest/v1/notes?user_id=eq.${uid}&id=in.(${ids})`, { feeds_threads: value });
}

const loadThreads = (uid: string): Promise<any[]> =>
  sb('GET', `/rest/v1/threads?user_id=eq.${uid}&select=id,title,summary,status,note_ids&order=title.asc`);

async function run(userId: string) {
  const uid = encodeURIComponent(userId);

  // Gleicher Startpunkt fuer jeden Lauf: keine Threads, alle Notizen im Feed.
  await sb('DELETE', `/rest/v1/thread_similarities?user_id=eq.${uid}`);
  await sb('DELETE', `/rest/v1/threads?user_id=eq.${uid}`);
  await setFeeds(uid, NOTES.map((s) => s.n), true);

  const passes: Pass[] = [];
  let before: any[] = [];
  if (SCENARIO === 'incremental') {
    await setFeeds(uid, WAVE_2, false);
    try {
      passes.push(await synthesizeOnce(userId));
    } finally {
      await setFeeds(uid, WAVE_2, true);
    }
    before = await loadThreads(uid);
  }
  passes.push(await synthesizeOnce(userId));

  const threads = await loadThreads(uid);
  const sims: any[] = await sb('GET', `/rest/v1/thread_similarities?user_id=eq.${uid}&select=thread_id_1,thread_id_2,label`);
  const titleOf = new Map(threads.map((t) => [t.id, t.title]));
  const threadsOfNote = new Map<string, string[]>();
  for (const t of threads) for (const id of t.note_ids ?? []) threadsOfNote.set(id, [...(threadsOfNote.get(id) ?? []), t.id]);
  const wave2Ids = new Set(SCENARIO === 'incremental' ? WAVE_2.map(noteId) : []);

  const prompt: string = passes[0].aiRequest?.system ?? '';
  const promptHash = createHash('sha1').update(prompt).digest('hex').slice(0, 8);
  const L: string[] = [];
  const M: Record<string, any> = {
    label, scenario: SCENARIO, model: passes[0].aiRequest?.model, effort: EFFORT, promptHash,
    threads: threads.length,
    inputTokens: passes.reduce((a, p) => a + (p.aiResponse?.usage?.input_tokens ?? 0), 0),
    outputTokens: passes.reduce((a, p) => a + (p.aiResponse?.usage?.output_tokens ?? 0), 0),
    aiDoubles: passes.reduce((a, p) => a + aiDoubleAssignments(p).length, 0),
    failed: passes.some((p) => p.res.statusCode !== 200),
    cleanGroups: 0, contentGroups: 0, ignoredOk: true,
  };

  L.push(`# Synthese-Eval: ${label}`, '');
  L.push(`- Zeit: ${new Date().toLocaleString('de-DE')} · Account ${EMAIL} · Szenario **${SCENARIO}**`);
  L.push(`- Modell: ${passes[0].aiRequest?.model ?? '?'}${EFFORT ? ` (effort ${EFFORT})` : ''} · Prompt-Hash \`${promptHash}\`${PROMPT_OVERRIDE !== null ? ' (per --prompt)' : ''}`);
  passes.forEach((p, i) => {
    const u = p.aiResponse?.usage;
    const name = passes.length > 1 ? `Lauf ${i + 1}` : 'Lauf';
    L.push(`- ${name}: ${p.seconds} s · ${u ? `${u.input_tokens} in / ${u.output_tokens} out` : 'keine Usage'}${p.aiResponse?.stop_reason === 'max_tokens' ? ' · **abgeschnitten (max_tokens)**' : ''} · HTTP ${p.res.statusCode} \`${JSON.stringify(p.res.body)}\``);
    const doubles = aiDoubleAssignments(p);
    if (doubles.length) L.push(`  - ⚠️ KI hat doppelt vergeben (Server bereinigt): ${doubles.join('; ')}`);
  });
  L.push('');

  L.push(`## Threads (${threads.length})`, '');
  for (const t of threads) {
    L.push(`### ${t.title}`, '', t.summary || '_(keine Summary)_', '');
    for (const id of t.note_ids ?? []) L.push(`- ${noteLabel(id)}${wave2Ids.has(id) ? ' 🆕' : ''}`);
    L.push('');
  }

  L.push(`## Verbindungen (${sims.length})`, '');
  for (const s of sims) L.push(`- ${titleOf.get(s.thread_id_1)} ↔ ${titleOf.get(s.thread_id_2)} — _${s.label}_`);
  if (!sims.length) L.push('_(keine)_');
  L.push('');

  // Abgleich mit der Soll-Gruppierung
  const threadsOfGroup = (g: Group) => new Set(NOTES.filter((s) => s.group === g).flatMap((s) => threadsOfNote.get(noteId(s.n)) ?? []));
  L.push('## Abgleich mit dem Soll', '');
  L.push('| Soll-Gruppe | Ergebnis | Threads |', '|---|---|---|');
  for (const g of Object.keys(GROUP_NAMES) as Group[]) {
    const members = NOTES.filter((s) => s.group === g && !s.also);
    const placed = members.filter((s) => threadsOfNote.has(noteId(s.n)));
    const ts = [...new Set(members.flatMap((s) => threadsOfNote.get(noteId(s.n)) ?? []))];
    const foreign = ts.flatMap((tid) => threads.find((t) => t.id === tid)?.note_ids ?? [])
      .filter((id: string) => { const s = byId.get(id); return s && s.group !== g && s.also !== g; });
    let verdict: string;
    if (g === 'junk' || g === 'link') verdict = placed.length === 0 ? '✅ ignoriert' : `❌ ${placed.length} einsortiert`;
    else if (placed.length < members.length) verdict = `❌ ${members.length - placed.length} Notiz(en) ohne Thread`;
    else if (ts.length > 1) verdict = `⚠️ auf ${ts.length} Threads verteilt`;
    else if (foreign.length) verdict = `⚠️ vermischt mit ${foreign.map(noteLabel).map((x) => x.slice(0, 3)).join(', ')}`;
    else verdict = '✅ eigener Thread';
    if (g === 'junk' || g === 'link') { if (placed.length) M.ignoredOk = false; }
    else { M.contentGroups++; if (verdict.startsWith('✅')) M.cleanGroups++; }
    L.push(`| ${GROUP_NAMES[g]} | ${verdict} | ${ts.map((id) => titleOf.get(id)).join(', ') || '–'} |`);
  }
  const bridgeNote = NOTES.find((s) => s.also)!;
  L.push('', `Grenzfall ${noteLabel(noteId(bridgeNote.n))} (Soll: ${GROUP_NAMES[bridgeNote.group]} oder ${GROUP_NAMES[bridgeNote.also!]}) → ${(threadsOfNote.get(noteId(bridgeNote.n)) ?? []).map((id) => titleOf.get(id)).join(', ') || '❌ ohne Thread'}`, '');

  const groupsOfThread = (tid: string) => new Set((threads.find((t) => t.id === tid)?.note_ids ?? [])
    .flatMap((id: string) => { const s = byId.get(id); return s ? [s.group, ...(s.also ? [s.also] : [])] : []; }));
  M.unexpectedLinks = [];
  M.selfLinks = 0;
  for (const s of sims) {
    const A = groupsOfThread(s.thread_id_1), B = groupsOfThread(s.thread_id_2);
    const ok = EXPECTED_LINKS.some((e) => (A.has(e.a) && B.has(e.b)) || (A.has(e.b) && B.has(e.a)));
    if (ok) continue;
    if ([...A].some((g) => B.has(g))) { M.selfLinks++; continue; }
    M.unexpectedLinks.push(`${titleOf.get(s.thread_id_1)} ↔ ${titleOf.get(s.thread_id_2)} (${s.label})`);
  }
  M.expectedLinks = 0;
  M.requiredLinks = EXPECTED_LINKS.filter((e) => !e.optional).length;
  L.push('| Erwartete Verbindung | Ergebnis |', '|---|---|');
  for (const e of EXPECTED_LINKS) {
    const A = threadsOfGroup(e.a), B = threadsOfGroup(e.b);
    const hit = sims.find((s) => (A.has(s.thread_id_1) && B.has(s.thread_id_2)) || (B.has(s.thread_id_1) && A.has(s.thread_id_2)));
    const sameThread = [...A].some((id) => B.has(id));
    if (hit && !e.optional) M.expectedLinks++;
    const verdict = hit ? `✅ „${hit.label}"` : sameThread ? 'ℹ️ im selben Thread' : e.optional ? '➖ fehlt (optional)' : '❌ fehlt';
    L.push(`| ${GROUP_NAMES[e.a]} ↔ ${GROUP_NAMES[e.b]}${e.optional ? ' _(optional)_' : ''} | ${verdict} |`);
  }
  L.push('');

  if (SCENARIO === 'incremental') {
    const beforeById = new Map(before.map((t) => [t.id, t]));
    L.push('## Zweiter Lauf', '');
    L.push(`Nach Lauf 1: ${before.length} Threads (${before.map((t) => t.title).join(', ')})`, '');

    const multi = [...threadsOfNote].filter(([, ts]) => ts.length > 1);
    M.doubleAssigned = multi.length;
    // Abspaltung = neue Notiz, deren Thema es nach Lauf 1 schon gab, landet in einem neuen Thread.
    const groupsBefore = new Set(before.flatMap((t: any) => (t.note_ids ?? []).map((id: string) => byId.get(id)?.group)));
    M.splits = WAVE_2.filter((n) => {
      const s = NOTES.find((x) => x.n === n)!;
      const ts = threadsOfNote.get(noteId(n)) ?? [];
      const existed = groupsBefore.has(s.group) || (s.also ? groupsBefore.has(s.also) : false);
      return existed && ts.length > 0 && ts.every((t) => !beforeById.has(t));
    }).length;
    M.lostWave2 = WAVE_2.filter((n) => !threadsOfNote.has(noteId(n))).length;
    L.push(multi.length
      ? `❌ **Doppelt einsortiert:** ${multi.map(([id, ts]) => `${noteLabel(id)} → ${ts.map((t) => titleOf.get(t)).join(' + ')}`).join('; ')}`
      : '✅ Keine Notiz in mehreren Threads', '');

    L.push('| Neue Notiz | gelandet in | |', '|---|---|---|');
    for (const n of WAVE_2) {
      const ts = threadsOfNote.get(noteId(n)) ?? [];
      const kind = ts.length === 0 ? '–' : ts.map((t) => (beforeById.has(t) ? 'bestehender Thread' : 'neuer Thread')).join(', ');
      L.push(`| ${noteLabel(noteId(n))} | ${ts.map((t) => titleOf.get(t)).join(', ') || '❌ ohne Thread'} | ${kind} |`);
    }
    L.push('');

    const hasNew = (t: any) => (threads.find((x) => x.id === t.id)?.note_ids ?? []).some((id: string) => wave2Ids.has(id));
    const untouched = before.filter((t) => !hasNew(t));
    const rewritten = untouched.filter((t) => threads.find((x) => x.id === t.id)?.summary !== t.summary);
    L.push(`Threads ohne neue Notiz: ${untouched.length}, davon Summary trotzdem umgeschrieben: ${rewritten.length}${rewritten.length ? ` ⚠️ (${rewritten.map((t) => t.title).join(', ')})` : ' ✅'}`, '');

    // "Angehaengt" = neue Summary beginnt mit (fast) der kompletten alten.
    const updatedBefore = before.filter(hasNew);
    const appended = updatedBefore.filter((t) => {
      const now = threads.find((x) => x.id === t.id)?.summary ?? '';
      return now.startsWith(t.summary.slice(0, Math.floor(t.summary.length * 0.9)));
    });
    const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    M.updated = updatedBefore.length;
    M.appended = appended.length;
    M.rewrittenUntouched = rewritten.length;
    const maxSentences = Math.max(0, ...updatedBefore.map((t) => sentences(threads.find((x) => x.id === t.id)?.summary ?? '')));
    L.push(`Aktualisierte Threads: ${updatedBefore.length}, davon nur angehängt: ${appended.length}${appended.length ? ` ⚠️ (${appended.map((t) => t.title).join(', ')})` : ' ✅'} · längste Summary: ${maxSentences} Sätze`, '');

    for (const t of updatedBefore) {
      const now = threads.find((x) => x.id === t.id)!;
      L.push(`**Summary vorher/nachher — ${t.title}**`, '', `- Vorher: ${t.summary}`, `- Nachher: ${now.summary}`, '');
    }
  }

  const reportEnd = L.length;
  L.push('<details><summary>Prompt</summary>', '', '```text', prompt, '```', '</details>', '');
  passes.forEach((p, i) => {
    L.push(`<details><summary>Rohe KI-Antwort${passes.length > 1 ? ` Lauf ${i + 1}` : ''}</summary>`, '', '```json', aiText(p) || JSON.stringify(p.aiResponse), '```', '</details>', '');
  });

  const logs = resolve(here, 'logs');
  mkdirSync(logs, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const file = resolve(logs, `synthesis-${stamp}-${label}.md`);
  writeFileSync(file.slice(0, -3) + '.json', JSON.stringify(M, null, 2), 'utf8');
  writeFileSync(file, L.join('\n'), 'utf8');
  console.log(L.slice(0, reportEnd).join('\n'));
  console.log(`\nBericht: ${file}`);
}

// ---------------------------------------------------------------------------
// compare <label-praefix> … — Kennzahlen mehrerer Laeufe nebeneinander
// ---------------------------------------------------------------------------

function compare(prefixes: string[]) {
  const logs = resolve(here, 'logs');
  const all: any[] = readdirSync(logs).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(logs, f), 'utf8')));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const fmt = (xs: any[], key: string) => {
    const vals = xs.map((x) => x[key]).filter((v) => typeof v === 'number');
    return vals.length ? `${avg(vals).toFixed(1)} (${vals.join('/')})` : '–';
  };
  const sum = (xs: any[], key: string) => xs.reduce((a, x) => a + (x[key] ?? 0), 0);
  const rows: Array<[string, (xs: any[]) => string]> = [
    ['Läufe', (xs) => String(xs.length)],
    ['Abgestürzt', (xs) => String(xs.filter((x) => x.failed).length)],
    ['Threads', (xs) => fmt(xs, 'threads')],
    ['Themen sauber (von 7)', (xs) => fmt(xs, 'cleanGroups')],
    ['Leer/Link ignoriert', (xs) => `${xs.filter((x) => x.ignoredOk).length}/${xs.length}`],
    ['Erwartete Verbindungen (von 2)', (xs) => fmt(xs, 'expectedLinks')],
    ['Unerwartete Verbindungen', (xs) => fmt(xs.map((x) => ({ n: x.unexpectedLinks?.length ?? 0 })), 'n')],
    ['Verbindung zu eigenem Teil', (xs) => fmt(xs, 'selfLinks')],
    ['Abspaltungen (von 5)', (xs) => fmt(xs, 'splits')],
    ['Neue Notiz verloren', (xs) => fmt(xs, 'lostWave2')],
    ['KI-Doppelvergaben', (xs) => fmt(xs, 'aiDoubles')],
    ['Updates nur angehängt', (xs) => (xs.some((x) => x.scenario === 'incremental') ? `${sum(xs, 'appended')}/${sum(xs, 'updated')}` : '–')],
    ['Tokens in/out (Ø)', (xs) => `${avg(xs.map((x) => x.inputTokens)).toFixed(0)} / ${avg(xs.map((x) => x.outputTokens)).toFixed(0)}`],
  ];
  const groups = prefixes.map((pre) => all.filter((m) => m.label.startsWith(pre)));
  console.log(`| | ${prefixes.join(' | ')} |`);
  console.log(`|---|${prefixes.map(() => '---').join('|')}|`);
  for (const [name, f] of rows) console.log(`| ${name} | ${groups.map(f).join(' | ')} |`);
  console.log('');
  groups.forEach((xs, i) => {
    const links = xs.flatMap((x) => x.unexpectedLinks ?? []);
    if (links.length) console.log(`Unerwartet in ${prefixes[i]}: ${links.join('; ')}`);
  });
}

if (command === 'compare') { compare(args.slice(1)); process.exit(0); }

const userId = await resolveUserId();
if (command === 'seed') await seed(userId);
else if (command === 'run') await run(userId);
else { console.error('Befehl: seed | run <label> [--scenario cold|incremental] [--prompt <datei>] [--model <id>] [--effort <stufe>] | compare <label-praefix> …'); process.exit(1); }
