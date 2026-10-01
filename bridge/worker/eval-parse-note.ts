/**
 * Qualitaets-Check fuer die KI-Sprachnotizen (bridge/api/_lib/parseNoteAi.ts)
 * gegen die ECHTE Anthropic-API. Kostet pro Lauf ca. 30 × 0,25 Cent (< 10 Cent).
 *
 *   ANTHROPIC_API_KEY=... node bridge/worker/eval-parse-note.ts
 *   (oder Key in bridge/worker/.env; Node >= 23.6 fuehrt .ts direkt aus)
 *
 * Prueft pro Diktat nur harte Erwartungen (Checkliste ja/nein, Wiederholung,
 * Datum, Wochentag). Titel/Inhalt werden zum Anschauen ausgegeben.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { structureWithClaude, sanitizeStructured, PARSE_NOTE_MODEL } from '../api/_lib/parseNoteAi.ts';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY fehlt (Umgebung oder bridge/worker/.env).');
  process.exit(1);
}

// Fester „Jetzt“-Zeitpunkt: Donnerstag, 24.09.2026, 10:00 (lokal).
const NOW = '2026-09-24T10:00';
const CATEGORIES = ['Allgemein', 'Arbeit', 'Privat', 'Ideen', 'Einkauf'];

interface Expect {
  checklist?: boolean;
  category?: string;
  recurrence?: 'once' | 'daily' | 'weekly' | 'monthly' | null; // null = kein Reminder
  at?: string; // erwartetes "YYYY-MM-DDTHH:mm"
  weekday?: number;
  dayOfMonth?: number;
}

const CASES: Array<[string, Expect]> = [
  ['Einkaufen Milch, Eier, Brot und Butter', { checklist: true, category: 'Einkauf', recurrence: null }],
  ['Ich muss noch Milch Eier und Käse kaufen, erinnere mich morgen um 18 Uhr', { checklist: true, category: 'Einkauf', recurrence: 'once', at: '2026-09-25T18:00' }],
  ['Erinnere mich übermorgen an den Zahnarzttermin', { recurrence: 'once', at: '2026-09-26T09:00' }],
  // „Nächsten Freitag“ an einem Donnerstag ist mehrdeutig (25.09. oder 02.10.) — nur Art prüfen.
  ['Nächsten Freitag um 14 Uhr Meeting mit Jonas vorbereiten', { category: 'Arbeit', recurrence: 'once' }],
  ['Diesen Freitag Präsentation abschicken, erinner mich um 9', { category: 'Arbeit', recurrence: 'once', at: '2026-09-25T09:00' }],
  ['Jeden Montag um 8 Uhr Wochenplanung machen', { recurrence: 'weekly', weekday: 2 }],
  ['Erinnere mich jeden Sonntag Abend um 20 Uhr die Pflanzen zu gießen', { recurrence: 'weekly', weekday: 1 }],
  ['Jeden Tag um 7 Uhr Vitamine nehmen', { recurrence: 'daily' }],
  ['Am Ersten jeden Monats die Miete überweisen', { recurrence: 'monthly', dayOfMonth: 1 }],
  ['Jeden 15. im Monat Stromzähler ablesen, erinnere mich um 10 Uhr', { recurrence: 'monthly', dayOfMonth: 15 }],
  ['In zwei Wochen Reifen wechseln lassen', { recurrence: 'once', at: '2026-10-08T09:00' }],
  ['Heute Abend um 19 Uhr Mama anrufen', { recurrence: 'once', at: '2026-09-24T19:00' }],
  ['Heute um 8 Uhr früh war ich joggen, war super', { recurrence: null }],
  ['Idee für die App: man könnte Notizen per Sprache in Kategorien sortieren', { category: 'Ideen', recurrence: null, checklist: false }],
  ['Packliste Urlaub: Sonnencreme, Ladekabel, Reisepass, Badehose', { checklist: true }],
  ['To-dos für heute: Bericht fertig schreiben, Rechnung bezahlen, Paket abholen', { checklist: true }],
  ['Ich habe heute ein gutes Gespräch mit meinem Chef gehabt über die Beförderung', { checklist: false, recurrence: null }],
  ['Der Titel des Buches war Der Schwarm, das muss ich mir merken', { recurrence: null, checklist: false }],
  ['Am 3. Oktober ist Feiertag, erinnere mich am Tag davor den Wecker auszuschalten', { recurrence: 'once', at: '2026-10-02T09:00' }],
  ['Erinnerung Dienstag halb neun Physiotherapie', { recurrence: 'once', at: '2026-09-29T08:30' }],
  ['Viertel nach drei morgen Paket zur Post bringen', { recurrence: 'once', at: '2026-09-25T15:15' }],
  ['Ich muss morgen um halb drei zum Zahnarzt', { recurrence: 'once', at: '2026-09-25T14:30' }],
  ['Heute um halb vier Besprechung mit Jonas', { recurrence: 'once', at: '2026-09-24T15:30' }],
  ['Übermorgen früh um sieben Mama anrufen', { recurrence: 'once', at: '2026-09-26T07:00' }],
  ['Morgen nachts um halb eins Sternschnuppen anschauen', { recurrence: 'once', at: '2026-09-25T00:30' }],
  ['Das Update ins Berglauf schreiben und den Call for checken, erinnere mich morgen um 9', { recurrence: 'once', at: '2026-09-25T09:00' }],
  ['Geburtstag von Lena am 12. Oktober, erinnere mich eine Woche vorher', { recurrence: 'once', at: '2026-10-05T09:00' }],
  ['Buy milk, eggs and bread', { checklist: true, category: 'Einkauf', recurrence: null }],
  ['Remind me tomorrow at 6 pm to call the dentist', { recurrence: 'once', at: '2026-09-25T18:00' }],
  ['Every Monday at 9 am team standup notes', { recurrence: 'weekly', weekday: 2 }],
  ['Remind me on the first of every month to pay rent', { recurrence: 'monthly', dayOfMonth: 1 }],
  ['Next Wednesday lunch with Sarah at noon', { recurrence: 'once', at: '2026-09-30T12:00' }],
  ['Project idea: a habit tracker that uses voice input', { category: 'Ideen', recurrence: null }],
  ['äh also ich wollte noch sagen dass ähm wir morgen um zehn den Workshop haben', { category: 'Arbeit', recurrence: 'once', at: '2026-09-25T10:00' }],
  ['Einkaufen gehen', { recurrence: null }],
];

let passed = 0;
for (const [dictation, exp] of CASES) {
  const input = { transcript: dictation, title: '', categories: CATEGORIES, localNow: NOW, locale: 'de' as const };
  let out;
  try {
    out = sanitizeStructured(await structureWithClaude(input), input);
  } catch (e) {
    console.log(`✗ FEHLER  ${dictation}\n    ${(e as Error).message}\n`);
    continue;
  }
  const problems: string[] = [];
  if (!out) problems.push('leeres Ergebnis');
  else {
    if (exp.checklist !== undefined && (out.checklist.length > 0) !== exp.checklist)
      problems.push(`checklist ${out.checklist.length > 0 ? 'vorhanden' : 'fehlt'}`);
    if (exp.category && out.category !== exp.category) problems.push(`category ${out.category} ≠ ${exp.category}`);
    if (exp.recurrence !== undefined) {
      const rec = out.reminder?.recurrence ?? null;
      if (rec !== exp.recurrence) problems.push(`recurrence ${rec} ≠ ${exp.recurrence}`);
    }
    if (exp.at && out.reminder?.at !== exp.at) problems.push(`at ${out.reminder?.at} ≠ ${exp.at}`);
    if (exp.weekday && out.reminder?.weekday !== exp.weekday) problems.push(`weekday ${out.reminder?.weekday} ≠ ${exp.weekday}`);
    if (exp.dayOfMonth && out.reminder?.dayOfMonth !== exp.dayOfMonth) problems.push(`dayOfMonth ${out.reminder?.dayOfMonth} ≠ ${exp.dayOfMonth}`);
  }
  if (problems.length === 0) passed++;
  console.log(`${problems.length ? '✗' : '✓'} ${dictation}`);
  if (out) {
    console.log(`    Titel: ${out.title} | Kategorie: ${out.category} | Checkliste: ${JSON.stringify(out.checklist)}`);
    console.log(`    Inhalt: ${out.content || '—'} | Erinnerung: ${out.reminder ? JSON.stringify(out.reminder) : '—'}`);
  }
  if (problems.length) console.log(`    → ${problems.join(', ')}`);
  console.log('');
}
console.log(`${PARSE_NOTE_MODEL}: ${passed}/${CASES.length} ohne Abweichung`);
