/**
 * Qualitaets-Check fuer die Diktat-Strukturierung (bridge/api/_lib/parseNoteAi.ts)
 * gegen die ECHTE Anthropic-API. Ruft structureWithClaude() + sanitizeStructured()
 * direkt auf — kein Supabase/HTTP noetig, da parseNoteAi.ts keinen DB-Zustand braucht.
 *
 *   node --experimental-transform-types bridge/worker/eval-parse-note.ts run <label>
 *
 * Laeuft gegen PARSE_NOTE_MODEL aus parseNoteAi.ts (Produktionsmodell, aktuell Haiku 4.5).
 * Jeder Testfall hat ein festes "now" (localNow), damit Datums-Erwartungen (morgen,
 * uebermorgen, naechster Dienstag) deterministisch pruefbar sind. Keys aus
 * bridge/worker/.env (ANTHROPIC_API_KEY).
 *
 * Bericht nach bridge/worker/logs/parse-note-<zeit>-<label>.md + .json (Kennzahlen).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { structureWithClaude, sanitizeStructured, PARSE_NOTE_MODEL } from '../api/_lib/parseNoteAi.ts';
import type { ParseNoteInput, StructuredNote } from '../api/_lib/parseNoteAi.ts';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY noetig (Umgebung oder bridge/worker/.env).');
  process.exit(1);
}

const args = process.argv.slice(2);
const [command, label = 'run'] = args;

const CATEGORIES = ['Allgemein', 'Arbeit', 'Privat', 'Einkaufen', 'Gesundheit'];
/** Fixer Ankerpunkt, damit "morgen"/"uebermorgen"/Wochentage deterministisch sind.
 *  2026-10-27 ist ein Dienstag. */
const NOW = '2026-10-27T10:00:00'.slice(0, 16);

interface Case {
  name: string;
  transcript: string;
  title?: string;
  /** Nur Report-Label ("[EN]" im Testfall-Namen) — beeinflusst den API-Call nicht,
   *  die Sprache steckt im transcript selbst. */
  locale?: 'de' | 'en';
  /** Erwartungen; undefined = nicht geprueft. */
  expect: {
    /** true = sanitizeStructured() soll null liefern (ganzes Diktat ohne verwertbaren Inhalt verworfen). */
    discarded?: boolean;
    reminder: boolean;
    at?: string; // "YYYY-MM-DDTHH:mm"
    recurrence?: 'once' | 'daily' | 'weekly' | 'monthly';
    contentContains?: string[];
    contentExcludes?: string[];
    checklistLength?: number;
    category?: string;
    /** true = reminderAmbiguous soll gesetzt sein (mehrere Zeitpunkte im Diktat, reminder bleibt null). */
    ambiguous?: boolean;
  };
}

const CASES: Case[] = [
  {
    name: 'Eindeutige Uhrzeit (24h)',
    transcript: 'Morgen um 15 Uhr brauche ich eine Erinnerung für den Arzttermin.',
    expect: { reminder: true, at: '2026-10-28T15:00', recurrence: 'once', contentContains: ['Arzttermin'] },
  },
  {
    name: 'Halb drei nachmittags',
    transcript: 'Erinnere mich morgen um halb drei an den Zahnarzt.',
    expect: { reminder: true, at: '2026-10-28T14:30', recurrence: 'once', contentContains: ['Zahnarzt'] },
  },
  {
    name: 'Viertel vor drei, ohne Tageszeit',
    transcript: 'Übermorgen viertel vor drei Teammeeting nicht vergessen.',
    expect: { reminder: true, at: '2026-10-29T14:45', recurrence: 'once' },
  },
  {
    name: 'Vormittags-Heuristik (sieben = 7 Uhr)',
    transcript: 'Erinnere mich morgen um sieben an den Zug.',
    expect: { reminder: true, at: '2026-10-28T07:00', recurrence: 'once', contentContains: ['Zug'] },
  },
  {
    name: 'Wöchentliche Erinnerung an Wochentag',
    transcript: 'Erinnere mich jeden Montag um 9 Uhr an die Wochenplanung.',
    expect: { reminder: true, recurrence: 'weekly' },
  },
  {
    name: 'Tägliche Erinnerung',
    transcript: 'Erinnere mich jeden Tag um 8 Uhr, Tabletten zu nehmen.',
    expect: { reminder: true, recurrence: 'daily', at: '2026-10-28T08:00' },
  },
  {
    name: 'Checkliste ohne Erinnerung',
    transcript: 'Einkaufsliste: Milch, Eier, Butter und Brot.',
    expect: { reminder: false, checklistLength: 4 },
  },
  {
    name: 'Erinnerung + separate Checkliste (danach)',
    transcript: 'Erinnere mich morgen um 9 an den Zahnarzttermin, und danach einkaufen: Milch und Eier.',
    expect: { reminder: true, at: '2026-10-28T09:00', checklistLength: 2, contentContains: ['Zahnarzttermin'] },
  },
  {
    name: 'Kein Datum/Zeit genannt (kein Reminder)',
    transcript: 'Idee für die Steuererklärung: Belege aus dem Homeoffice sammeln.',
    expect: { reminder: false },
  },
  {
    name: 'Nachts-Zeit explizit',
    // NOW ist 10 Uhr morgens; 00:30 Uhr liegt damit in der Vergangenheit, "heute Nacht"
    // meint daher sinnvollerweise die kommende Nacht (28., nicht 27.).
    transcript: 'Erinnere mich heute Nacht um halb eins, die Wäsche rauszuhängen.',
    expect: { reminder: true, at: '2026-10-28T00:30', recurrence: 'once' },
  },
  {
    name: 'Monatliche Erinnerung an Tag',
    transcript: 'Erinnere mich jeden Monat am 1. an die Miete überweisen.',
    expect: { reminder: true, recurrence: 'monthly' },
  },
  {
    name: 'Kategorie-Zuordnung (Gesundheit)',
    transcript: 'Termin beim Hausarzt wegen der Rückenschmerzen vereinbaren.',
    expect: { reminder: false, category: 'Gesundheit' },
  },
  {
    name: 'Anglizismus-Korrektur (Berglauf → Backlog)',
    transcript: 'Für das Projekt müssen wir noch den Berglauf aufräumen vor dem Sprint.',
    expect: { reminder: false, contentContains: ['Backlog'] },
  },
  {
    name: 'Mittag ohne Tageszeit',
    transcript: 'Erinnere mich morgen um zwölf an das Mittagessen mit Anna.',
    expect: { reminder: true, at: '2026-10-28T12:00', recurrence: 'once' },
  },
  {
    name: 'Relative Zeitangabe "in einer Woche"',
    // NOW = Dienstag 2026-10-27 → in einer Woche = 2026-11-03.
    transcript: 'Erinnere mich in einer Woche um 10 Uhr an die Rückmeldung beim Vermieter.',
    expect: { reminder: true, at: '2026-11-03T10:00', recurrence: 'once', contentContains: ['Vermieter'] },
  },
  {
    name: '"Nächsten Dienstag" bei NOW=Dienstag (Grenzfall: heute oder in 7 Tagen?)',
    // NOW ist selbst ein Dienstag. "Naechsten Dienstag" ist damit absichtlich mehrdeutig:
    // reminder=true wird erwartet, "at" wird NICHT geprueft (beide Lesarten vertretbar).
    transcript: 'Erinnere mich nächsten Dienstag um 11 Uhr an den Steuerberater.',
    expect: { reminder: true, recurrence: 'once', contentContains: ['Steuerberater'] },
  },
  {
    name: 'Zwei Termine in einem Diktat (keine Zeit raten, als mehrdeutig markieren)',
    transcript: 'Morgen um 9 Uhr Zahnarzt, und übermorgen um 14 Uhr Friseur.',
    expect: { reminder: false, ambiguous: true },
  },
  {
    name: '"Punkt acht" = exakt 20:00, nicht 8:00',
    transcript: 'Erinnere mich morgen Punkt acht Uhr abends an den Film.',
    expect: { reminder: true, at: '2026-10-28T20:00', recurrence: 'once' },
  },
  {
    name: 'Vage Zeitangabe "so gegen halb neun"',
    transcript: 'Erinnere mich morgen so gegen halb neun abends an die Serie.',
    expect: { reminder: true, at: '2026-10-28T20:30', recurrence: 'once' },
  },
  {
    name: 'Stottern/Wiederholung (Spracherkennungs-Rauschen)',
    transcript: 'Ich muss ich muss morgen um um 10 Uhr zum zum Friseur gehen.',
    expect: { reminder: true, at: '2026-10-28T10:00', recurrence: 'once', contentContains: ['Friseur'] },
  },
  {
    name: 'Vergangene Zeit genannt (gestern) — kein gültiger Reminder',
    transcript: 'Gestern um 15 Uhr war der Arzttermin, das muss ich noch dokumentieren.',
    expect: { reminder: false },
  },
  {
    name: 'Explizites Kalenderdatum weit in der Zukunft',
    transcript: 'Erinnere mich am 15. November um 10 Uhr an die Steuererklärung.',
    expect: { reminder: true, at: '2026-11-15T10:00', recurrence: 'once' },
  },
  {
    name: 'Lange Checkliste ohne passende Kategorie',
    transcript: 'Packliste für den Umzug: Kartons, Klebeband, Luftpolsterfolie, Handwagen, Etiketten, Müllsäcke.',
    expect: { reminder: false, checklistLength: 6, category: 'Allgemein' },
  },

  // --- Englisch (locale: 'en') — Spiegel der haertesten deutschen Faelle ---
  {
    name: '[EN] Eindeutige Uhrzeit (24h)',
    locale: 'en',
    transcript: 'Remind me tomorrow at 3pm about the dentist appointment.',
    expect: { reminder: true, at: '2026-10-28T15:00', recurrence: 'once', contentContains: ['dentist'] },
  },
  {
    name: '[EN] Half past two (half two = 14:30, nicht 2:00)',
    locale: 'en',
    transcript: 'Remind me tomorrow at half past two in the afternoon to call the bank.',
    expect: { reminder: true, at: '2026-10-28T14:30', recurrence: 'once', contentContains: ['bank'] },
  },
  {
    name: '[EN] Quarter to three, ohne Tageszeit',
    locale: 'en',
    transcript: 'Day after tomorrow quarter to three, team meeting.',
    expect: { reminder: true, at: '2026-10-29T14:45', recurrence: 'once' },
  },
  {
    name: '[EN] Wöchentliche Erinnerung',
    locale: 'en',
    transcript: 'Remind me every Monday at 9am to plan the week.',
    expect: { reminder: true, recurrence: 'weekly' },
  },
  {
    name: '[EN] Checkliste ohne Erinnerung',
    locale: 'en',
    transcript: 'Shopping list: milk, eggs, butter and bread.',
    expect: { reminder: false, checklistLength: 4 },
  },
  {
    name: '[EN] Erinnerung + separate Checkliste',
    locale: 'en',
    transcript: 'Remind me tomorrow at 9 about the dentist appointment, and afterwards buy milk and eggs.',
    expect: { reminder: true, at: '2026-10-28T09:00', checklistLength: 2, contentContains: ['dentist'] },
  },
  {
    name: '[EN] Kein Datum/Zeit genannt',
    locale: 'en',
    transcript: 'Idea for the tax return: collect receipts from the home office.',
    expect: { reminder: false },
  },
  {
    name: '[EN] Stottern/Wiederholung',
    locale: 'en',
    transcript: 'I need I need to go to to the hairdresser tomorrow at at 10am.',
    expect: { reminder: true, at: '2026-10-28T10:00', recurrence: 'once', contentContains: ['hairdresser'] },
  },
  {
    name: '[EN] Vergangene Zeit (yesterday) — kein gültiger Reminder',
    locale: 'en',
    transcript: 'Yesterday at 3pm was the doctor appointment, I still need to document that.',
    expect: { reminder: false },
  },
  {
    name: '[EN] Explizites Kalenderdatum weit in der Zukunft',
    locale: 'en',
    transcript: 'Remind me on November 15th at 10am about the tax return.',
    expect: { reminder: true, at: '2026-11-15T10:00', recurrence: 'once' },
  },

  // --- Haerteste Grenzfaelle ---
  {
    name: 'Selbstkorrektur mitten im Diktat (3 Uhr → eigentlich 4 Uhr)',
    transcript: 'Erinnere mich morgen um drei Uhr, nein warte, um vier Uhr an den Kundentermin.',
    expect: { reminder: true, at: '2026-10-28T16:00', recurrence: 'once', contentContains: ['Kundentermin'] },
  },
  {
    name: 'Lang + verschachtelt: zwei Themen, Zeit, Checkliste gemischt',
    transcript: 'Also ich muss noch an den Monatsbericht denken, der ist bis Freitag faellig, und ausserdem erinnere mich morgen um 10 Uhr an den Steuerberater-Termin, und danach noch einkaufen gehen: Kaffee, Zucker und Filter fuer die Kaffeemaschine, und nicht vergessen das Auto zur Inspektion zu bringen naechste Woche.',
    expect: { reminder: true, at: '2026-10-28T10:00', checklistLength: 4, contentContains: ['Steuerberater'] },
  },
  {
    name: 'Elliptisch/Stichworte ohne ganzen Satz',
    transcript: 'Zahnarzt morgen 14 Uhr.',
    expect: { reminder: true, at: '2026-10-28T14:00', recurrence: 'once', contentContains: ['Zahnarzt'] },
  },
  {
    name: 'Gemischte Zeitformate im selben Diktat (20 Uhr vs. 8 abends)',
    transcript: 'Erinnere mich morgen um 20 Uhr, also acht Uhr abends, an das Konzert.',
    expect: { reminder: true, at: '2026-10-28T20:00', recurrence: 'once' },
  },
  {
    name: 'Checkliste mit Mengenangaben (Einheiten bleiben am Item)',
    transcript: 'Einkaufsliste: zwei Kilo Kartoffeln, ein Liter Milch, drei Dosen Tomaten.',
    expect: { reminder: false, checklistLength: 3 },
  },
  {
    name: '"Diesen Dienstag" bei NOW=Dienstag (Grenzfall analog zu "naechsten")',
    transcript: 'Erinnere mich diesen Dienstag um 16 Uhr an den Rueckruf.',
    expect: { reminder: true, recurrence: 'once', contentContains: ['Rückruf'] },
  },
  {
    name: 'Deutsch mit eingestreuten englischen Fachbegriffen (kein Sprachwechsel)',
    transcript: 'Wir muessen das Deployment nochmal reviewen, bevor das naechste Release rausgeht.',
    expect: { reminder: false, contentContains: ['Deployment'] },
  },
  {
    name: 'Leeres/nutzloses Diktat (nur Fuellwort)',
    transcript: 'Ähm.',
    expect: { discarded: true, reminder: false },
  },
  {
    name: 'Erinnerung gewuenscht, aber OHNE jede Zeitangabe',
    // Server setzt Default 24h nach Aufnahme (NOW + 24h), nicht das Modell.
    transcript: 'Erinnere mich bitte daran, die Versicherung zu kuendigen.',
    expect: { reminder: true, at: '2026-10-28T10:00', recurrence: 'once', contentContains: ['Versicherung'] },
  },
  {
    name: 'Diktat nennt eine Kategorie, die NICHT in der Liste steht',
    transcript: 'Das ist fuer die Kategorie Hobby: neue Angelruten anschauen.',
    expect: { reminder: false, category: 'Allgemein' },
  },
  {
    name: 'Sehr kurze Checkliste mit nur einem Punkt (kein Satz, nur Stichwort)',
    transcript: 'To-do: Reifen wechseln.',
    expect: { reminder: false, checklistLength: 1 },
  },
  {
    name: 'Widerspruch: "jeden Tag" aber nur einmalig gemeint (umgangssprachliche Uebertreibung)',
    // "Jeden Tag" ist hier rhetorische Uebertreibung ("dauernd"), kein Wiederholungsmuster mit
    // konkreter Uhrzeit — unklarer Fall, reminder wird nicht geprueft, nur dass nichts abstuerzt.
    transcript: 'Ich muss jeden Tag an das kaputte Fenster denken, das nervt total.',
    expect: { reminder: false },
  },
];

interface Result { case: Case; structured: StructuredNote | null; seconds: string; error?: string }

async function runCase(c: Case): Promise<Result> {
  const input: ParseNoteInput = {
    transcript: c.transcript,
    title: c.title ?? '',
    categories: CATEGORIES,
    localNow: NOW,
  };
  const started = Date.now();
  try {
    const raw = await structureWithClaude(input);
    const structured = sanitizeStructured(raw, input);
    return { case: c, structured, seconds: ((Date.now() - started) / 1000).toFixed(1) };
  } catch (e: any) {
    return { case: c, structured: null, seconds: ((Date.now() - started) / 1000).toFixed(1), error: e?.message ?? String(e) };
  }
}

function judge(r: Result): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const s = r.structured;
  if (r.error) return { ok: false, notes: [`Fehler: ${r.error}`] };
  if (!s) {
    if (r.case.expect.discarded) return { ok: true, notes: [] };
    return { ok: false, notes: ['Keine strukturierte Notiz (alles verworfen)'] };
  }
  if (r.case.expect.discarded) return { ok: false, notes: ['Erwartet: verworfen (null), ist aber strukturiert worden'] };

  const e = r.case.expect;
  let ok = true;

  const hasReminder = s.reminder !== null;
  if (hasReminder !== e.reminder) { ok = false; notes.push(`reminder erwartet=${e.reminder}, ist=${hasReminder}`); }

  if (e.at && s.reminder?.at !== e.at) { ok = false; notes.push(`at erwartet=${e.at}, ist=${s.reminder?.at ?? 'null'}`); }
  if (e.recurrence && s.reminder?.recurrence !== e.recurrence) { ok = false; notes.push(`recurrence erwartet=${e.recurrence}, ist=${s.reminder?.recurrence ?? 'null'}`); }
  if (e.ambiguous !== undefined && s.reminderAmbiguous !== e.ambiguous) { ok = false; notes.push(`reminderAmbiguous erwartet=${e.ambiguous}, ist=${s.reminderAmbiguous}`); }

  if (e.contentContains) {
    for (const needle of e.contentContains) {
      if (!s.content.toLowerCase().includes(needle.toLowerCase())) { ok = false; notes.push(`content sollte "${needle}" enthalten: "${s.content}"`); }
    }
  }
  if (e.contentExcludes) {
    for (const needle of e.contentExcludes) {
      if (s.content.toLowerCase().includes(needle.toLowerCase())) { ok = false; notes.push(`content sollte "${needle}" NICHT enthalten: "${s.content}"`); }
    }
  }
  if (e.checklistLength !== undefined && s.checklist.length !== e.checklistLength) {
    ok = false; notes.push(`checklist Länge erwartet=${e.checklistLength}, ist=${s.checklist.length} (${JSON.stringify(s.checklist)})`);
  }
  if (e.category && s.category !== e.category) { ok = false; notes.push(`category erwartet=${e.category}, ist=${s.category}`); }

  return { ok, notes };
}

async function run(label: string) {
  const results: Array<Result & { verdict: { ok: boolean; notes: string[] } }> = [];
  for (const c of CASES) {
    const r = await runCase(c);
    results.push({ ...r, verdict: judge(r) });
  }

  const passed = results.filter((r) => r.verdict.ok).length;
  const model = PARSE_NOTE_MODEL;

  const L: string[] = [];
  L.push(`# Parse-Note-Eval: ${label}`, '');
  L.push(`- Zeit: ${new Date().toLocaleString('de-DE')} · Modell \`${model}\``);
  L.push(`- Ergebnis: **${passed}/${CASES.length}** Testfälle bestanden`, '');
  L.push('| Testfall | Ergebnis | Details |', '|---|---|---|');
  for (const r of results) {
    const mark = r.verdict.ok ? '✅' : '❌';
    L.push(`| ${r.case.name} | ${mark} (${r.seconds}s) | ${r.verdict.notes.join('; ') || '–'} |`);
  }
  L.push('');

  for (const r of results) {
    L.push(`### ${r.case.name}`, '', `Diktat: _"${r.case.transcript}"_`, '');
    L.push('```json', JSON.stringify(r.structured ?? { error: r.error }, null, 2), '```', '');
  }

  const logs = resolve(here, 'logs');
  mkdirSync(logs, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const file = resolve(logs, `parse-note-${stamp}-${label}.md`);
  writeFileSync(file.slice(0, -3) + '.json', JSON.stringify({ label, model, passed, total: CASES.length }, null, 2), 'utf8');
  writeFileSync(file, L.join('\n'), 'utf8');
  console.log(L.join('\n'));
  console.log(`\nBericht: ${file}`);
}

function compare(prefixes: string[]) {
  const logs = resolve(here, 'logs');
  const all: any[] = readdirSync(logs).filter((f) => f.startsWith('parse-note-') && f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(logs, f), 'utf8')));
  console.log('| Label-Präfix | Läufe | Ø bestanden |');
  console.log('|---|---|---|');
  for (const pre of prefixes) {
    const xs = all.filter((m) => m.label.startsWith(pre));
    const avg = xs.length ? xs.reduce((a, x) => a + x.passed, 0) / xs.length : NaN;
    console.log(`| ${pre} | ${xs.length} | ${avg.toFixed(1)}/${xs[0]?.total ?? '?'} |`);
  }
}

if (command === 'compare') { compare(args.slice(1)); process.exit(0); }
if (command === 'run') await run(label);
else { console.error('Befehl: run <label> | compare <label-präfix> …'); process.exit(1); }
