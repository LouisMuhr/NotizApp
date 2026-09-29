/**
 * KI-Strukturierung diktierter Notizen (Pro): Claude zerlegt ein Diktat in
 * Titel, Inhalt, Checkliste, Kategorie und Erinnerung.
 *
 * Structured Outputs erzwingen das Schema; die inhaltliche Pruefung (Kategorie
 * aus der Liste, gueltiges Datum, Wochentag passend zur Wiederholung) macht
 * sanitizeStructured() — dem Modell wird dabei nichts geglaubt.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as z from 'zod/v4';

/** Eine Stelle zum Tauschen, falls Haiku bei Zeitangaben nicht reicht (z. B. 'claude-sonnet-5'). */
export const PARSE_NOTE_MODEL = 'claude-haiku-4-5';

export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';

export interface StructuredNote {
  title: string;
  content: string;
  checklist: string[];
  category: string;
  /** `at` ist lokale Zeit des Geraets ("YYYY-MM-DDTHH:mm"), die App rechnet sie um. */
  reminder: { at: string; recurrence: Recurrence; weekday: number | null; dayOfMonth: number | null } | null;
}

export interface ParseNoteInput {
  transcript: string;
  /** Vom Titel-Knopf diktiert — bleibt unveraendert. */
  title: string;
  categories: string[];
  /** Lokale Geraetezeit "YYYY-MM-DDTHH:mm". */
  localNow: string;
  locale: 'de' | 'en';
}

export class ParseNoteAiError extends Error {
  code: 'ai_unavailable' | 'ai_response_invalid';
  constructor(code: 'ai_unavailable' | 'ai_response_invalid') {
    super(code);
    this.code = code;
  }
}

const RawSchema = z.object({
  title: z.string(),
  content: z.string(),
  checklist: z.array(z.string()),
  category: z.string(),
  reminder: z
    .object({
      at: z.string(),
      recurrence: z.enum(['once', 'daily', 'weekly', 'monthly']),
      weekday: z.number().nullable(),
      day_of_month: z.number().nullable(),
    })
    .nullable(),
});
type RawStructured = z.infer<typeof RawSchema>;

const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const SYSTEM_PROMPT = `Du strukturierst eine diktierte Notiz fuer eine Notiz-App. Das Diktat stammt aus einer Spracherkennung und kann Erkennungsfehler enthalten.

Felder:
- title: kurze Ueberschrift (max. ca. 6 Woerter) in der Sprache des Diktats. Ist "fixed_title" gesetzt, gib ihn exakt so zurueck.
- content: der eigentliche Text. Behalte den Wortlaut des Nutzers bei, korrigiere nur offensichtliche Erkennungsfehler und Satzzeichen. Erfinde nichts dazu. Nur die reine Zeitangabe der Erinnerung ("erinner mich morgen um 9 Uhr") und Punkte, die in die Checkliste wandern, gehoeren NICHT mehr in content. Worum es bei der Erinnerung geht (WOFUER, WORAN, WAS mitzunehmen ist) bleibt IMMER in content: "Erinner mich morgen um 9 an den Zahnarzttermin, Versicherungskarte mitnehmen" → content "Zahnarzttermin, Versicherungskarte mitnehmen". Der Titel ersetzt den Inhalt nie. Leerer String ist nur erlaubt, wenn das Diktat ausser Zeitangabe wirklich nichts enthaelt.
- checklist: nur wenn das Diktat eine Aufzaehlung von Dingen oder Aufgaben enthaelt (Einkaufsliste, To-dos, Packliste). Ein Eintrag pro Punkt, kurz. Sonst leeres Array.
- category: exakt einer der Werte aus "categories". Passt keiner eindeutig, nimm "Allgemein".
- reminder: nur wenn der Nutzer ausdruecklich erinnert werden will oder einen Termin mit Zeitpunkt nennt. Sonst null.
  - at: lokaler Zeitpunkt "YYYY-MM-DDTHH:mm". Datum IMMER aus der Kalendertabelle ablesen, nicht selbst rechnen. Ohne Uhrzeit: 09:00.
  - recurrence: "once" (einmalig), "daily" (taeglich), "weekly" (jede Woche an einem Wochentag), "monthly" (jeden Monat an einem Tag).
  - weekday: nur bei "weekly": 1=Sonntag, 2=Montag, 3=Dienstag, 4=Mittwoch, 5=Donnerstag, 6=Freitag, 7=Samstag. Sonst null. "at" muss auf genau diesen Wochentag fallen.
  - day_of_month: nur bei "monthly": 1-31. Sonst null.
  - Bei "weekly"/"monthly"/"daily" ist "at" das naechste Vorkommen.

Die Notiz wird nie automatisch fuer Threads/KI-Synthese freigegeben — dafuer gibt es kein Feld.`;

/** Kalender der naechsten 14 Tage, damit das Modell Daten nachschlaegt statt rechnet. */
export function buildCalendar(localNow: string): string {
  const [y, m, d] = localNow.slice(0, 10).split('-').map(Number);
  const lines: string[] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const iso = day.toISOString().slice(0, 10);
    const label = i === 0 ? ' (heute)' : i === 1 ? ' (morgen)' : i === 2 ? ' (uebermorgen)' : '';
    lines.push(`${iso} ${WEEKDAYS_DE[day.getUTCDay()]}${label}`);
  }
  return lines.join('\n');
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // Timeout knapp unter dem Vercel-Limit; ein Retry wuerde es sprengen.
  client ??= new Anthropic({ timeout: 8000, maxRetries: 0 });
  return client;
}

/** Ruft Claude auf und liefert die rohe (schema-valide) Struktur. */
export async function structureWithClaude(input: ParseNoteInput): Promise<RawStructured> {
  const userPayload = {
    now: input.localNow,
    calendar: buildCalendar(input.localNow),
    categories: input.categories,
    fixed_title: input.title || null,
    dictation: input.transcript,
  };

  let message;
  try {
    message = await getClient().messages.parse({
      model: PARSE_NOTE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
      output_config: { format: zodOutputFormat(RawSchema) },
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error('[parse-note] anthropic error', e.status);
      throw new ParseNoteAiError('ai_unavailable');
    }
    // Parse-/Validierungsfehler des SDK
    console.error('[parse-note] invalid ai response', (e as Error)?.name);
    throw new ParseNoteAiError('ai_response_invalid');
  }

  if (message.stop_reason !== 'end_turn' || !message.parsed_output) {
    console.error('[parse-note] unusable ai response', message.stop_reason);
    throw new ParseNoteAiError('ai_response_invalid');
  }
  return message.parsed_output;
}

const LOCAL_DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function isValidLocal(at: string): boolean {
  const m = LOCAL_DT.exec(at);
  if (!m) return false;
  const [, y, mo, d, h, mi] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && h < 24 && mi < 60;
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/**
 * Prueft die Modellantwort gegen die Eingabe. Liefert null, wenn nichts
 * Brauchbares uebrig bleibt (dann speichert die App das Diktat unveraendert).
 */
export function sanitizeStructured(raw: RawStructured, input: ParseNoteInput): StructuredNote | null {
  const title = input.title ? input.title.slice(0, 200) : clean(raw.title, 200);
  let content = clean(raw.content, 20000);
  const checklist = (Array.isArray(raw.checklist) ? raw.checklist : [])
    .map((s) => clean(s, 300))
    .filter(Boolean)
    .slice(0, 50);
  const category = input.categories.includes(raw.category) ? raw.category : 'Allgemein';

  let reminder: StructuredNote['reminder'] = null;
  const r = raw.reminder;
  if (r && isValidLocal(r.at)) {
    const [, y, mo, d] = LOCAL_DT.exec(r.at)!.map(Number);
    const dateWeekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 1; // Expo: 1=So
    const inPast = r.at <= input.localNow; // gleiches Format → lexikografisch vergleichbar
    if (!(r.recurrence === 'once' && inPast)) {
      reminder = {
        at: r.at,
        recurrence: r.recurrence,
        // Wochentag/Monatstag kommen aus `at` (per Kalendertabelle abgelesen), nicht aus den
        // Zahlen des Modells: die verwechselt es (Montag → 3 = Dienstag). "at ist das naechste
        // Vorkommen" macht beides eindeutig.
        weekday: r.recurrence === 'weekly' ? dateWeekday : null,
        dayOfMonth: r.recurrence === 'monthly' ? d : null,
      };
    }
  }

  // Modell hat den ganzen Satz als Erinnerungssatz verworfen: lieber das rohe
  // Diktat behalten als den Inhalt verlieren (Nutzer loescht Ueberfluessiges, nicht Fehlendes).
  if (reminder && !content && checklist.length === 0) content = clean(input.transcript, 20000);

  if (!title && !content && checklist.length === 0) return null;
  return { title, content, checklist, category, reminder };
}
