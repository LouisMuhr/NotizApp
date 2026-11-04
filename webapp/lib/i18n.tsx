'use client';

// Zweisprachige Webapp (DE/EN). Die Sprache folgt der App: die App legt sie bei jedem Wechsel als
// `user_metadata.locale` am Supabase-User ab (eigentlich für die Mail-Vorlagen, src/context/LanguageContext.tsx).
// Ohne Login gilt die Browsersprache. Kein Umschalter im Web — eingestellt wird in der App.

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { NoteError } from '@/lib/noteDraft';

export type Locale = 'de' | 'en';

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

const de = {
  dateLocale: 'de-DE',
  common: {
    close: 'Schließen', cancel: 'Abbrechen', save: 'Speichern', saving: 'Speichert…',
    untitled: 'Ohne Titel', noTitle: '(kein Titel)',
    notes: (n: number) => plural(n, 'Notiz', 'Notizen'),
    threads: (n: number) => plural(n, 'Thread', 'Threads'),
    loadingGraph: 'Graph wird geladen…',
  },
  topbar: {
    tagline: 'Second Brain', search: 'Suchen…', noHits: 'keine Treffer', hits: (n: number) => `${n} Treffer`,
    login: 'Anmelden', register: 'Konto erstellen', newNote: '＋ Notiz', bookmarklet: '🔖 Bookmarklet',
    logout: 'Abmelden', account: 'Konto', language: 'Sprache', showList: 'Thread-Liste zeigen', showGraph: 'Graph zeigen',
    synthStart: '✦ Synthese starten', synthRunning: '✦ Synthese läuft …', synthShort: '✦ Synthese',
    synthLimitTitle: 'Synthese-Limit deines Tarifs', overview: '← Übersicht',
  },
  intro: {
    scatter: { kicker: 'Deine Notizen', title: (n: number) => `${n} Gedanken, kreuz und quer.`,
      body: 'Notiert zwischendurch, im Zug, beim Lesen. Ohne Ordner, ohne System.' },
    gather: { kicker: 'Velm sortiert', title: () => 'Was zusammengehört, findet sich.',
      body: 'Velm liest mit und bündelt deine Notizen zu Threads. Du legst weder Ordner noch Tags an.' },
    connect: { kicker: 'Velm verbindet', title: () => 'Und entdeckt, was du übersehen hast.',
      body: 'Auch zwischen Themen, die auf den ersten Blick nichts miteinander zu tun haben.' },
    skip: 'Überspringen →',
  },
  hero: { line1: 'Du schreibst.', line2: 'Velm verbindet.',
    body: 'Notizen landen, wie sie kommen. Velm ordnet sie zu Threads und findet die Verbindungen dazwischen.' },
  guest: {
    kicker: 'Beispiel-Graph', body: 'Das sind Beispiel-Notizen. Fahr über Threads und Verbindungen oder klick sie an.',
    tryIt: 'Probier’s aus: Wirf eine Notiz hinein', allDone: 'Alles einsortiert. So läuft das mit deinen eigenen Notizen.',
    placedIn: '→ einsortiert in', thinking: '✦ Velm denkt …', start: 'Kostenlos starten →', haveAccount: 'Ich habe schon ein Konto',
    replayIntro: '↺ Intro noch einmal ansehen', replayShort: '↺ Intro',
  },
  spotlight: { kicker: '✦ Verbindung entdeckt', explore: 'Selbst erkunden →' },
  empty: { title: 'Dein Graph ist noch leer.',
    body: 'Erstelle in der Velm-App Notizen und starte unter „Threads“ die Synthese. Sobald Threads entstanden sind, erscheinen sie hier.' },
  list: {
    count: (n: number) => plural(n, 'Thread', 'Threads'), countOf: (shown: number, total: number) => `${shown} von ${total} Threads`,
    none: 'Kein Thread passt zur Suche.',
  },
  thread: { kicker: 'Thread', summary: 'KI-Zusammenfassung', noSummary: 'Noch keine Zusammenfassung.', connections: 'KI-Verbindungen', pinned: '📌 Angeheftet' },
  sim: { kicker: '✦ KI-Verbindung', why: 'Warum diese Verbindung?', noExplanation: 'Keine Erklärung verfügbar.' },
  noteView: {
    noContent: 'Kein Inhalt.', createdAt: (date: string) => `Erstellt am ${date}`,
    deleteQ: 'Diese Notiz wirklich löschen?', delete: 'Löschen', deleteFinal: 'Endgültig löschen',
  },
  noteCreate: {
    heading: 'Neue Notiz', title: 'Titel', titlePh: 'Notiz-Titel…', content: 'Inhalt', contentPh: 'Was möchtest du festhalten?',
    category: 'Kategorie', thread: 'Thread', threadAuto: 'Automatisch (bei der Synthese)',
    include: 'In Threads einbeziehen', includeHint: 'Velm sortiert die Notiz bei der Synthese in einen Thread ein',
    reminder: 'Erinnerung', reminderNone: 'Keine', reminderPhone: 'Klingelt auf deinem Handy in der Velm-App.',
    recurrence: { once: 'Einmalig', daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich' },
    when: 'Wann', time: 'Uhrzeit', weekday: 'Wochentag', dayOfMonth: 'Tag im Monat', dayOfMonthSuffix: '. des Monats',
    /** Index = Expo-Wochentag − 1 (So … Sa) */
    weekdaysShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    create: 'Erstellen', creating: 'Wird erstellt…', created: 'Notiz gespeichert.', shortcut: 'Strg + Enter',
  },
  noteErrors: {
    empty: 'Gib einen Titel oder einen Inhalt ein.',
    title_too_long: 'Der Titel ist zu lang (höchstens 500 Zeichen).',
    content_too_long: 'Der Inhalt ist zu lang (höchstens 50.000 Zeichen).',
    reminder_incomplete_once: 'Bitte wähle für die Erinnerung Datum und Uhrzeit aus.',
    reminder_incomplete_recurring: 'Bitte wähle für die Erinnerung eine Uhrzeit aus.',
    reminder_past: 'Der Zeitpunkt der Erinnerung liegt in der Vergangenheit.',
    reminder_invalid: 'Die Erinnerung ist ungültig. Bitte prüfe Datum und Uhrzeit.',
    unauthorized: 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an — deine Eingaben bleiben stehen.',
    network: 'Keine Verbindung. Die Notiz wurde nicht gespeichert, bitte versuch es erneut.',
    internal: 'Speichern fehlgeschlagen. Bitte versuch es erneut.',
  } satisfies Record<NoteError, string>,
  deleteErrors: {
    unauthorized: 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an — die Notiz wurde nicht gelöscht.',
    network: 'Keine Verbindung. Die Notiz wurde nicht gelöscht.',
    internal: 'Löschen fehlgeschlagen. Bitte versuch es erneut.',
  },
  synth: {
    errors: {
      ai_unavailable: 'Die KI ist gerade nicht erreichbar. Dein Lauf wurde nicht verbraucht.',
      ai_response_invalid: 'Die KI-Antwort war unbrauchbar. Dein Lauf wurde nicht verbraucht.',
      synthesis_failed: 'Die Synthese ist fehlgeschlagen. Dein Lauf wurde nicht verbraucht.',
      profile_unavailable: 'Dein Profil konnte gerade nicht geladen werden. Bitte später erneut versuchen.',
      internal: 'Unerwarteter Serverfehler. Bitte später erneut versuchen.',
      not_signed_in: 'Nicht angemeldet.',
      network: 'Keine Verbindung zum Server. Bitte später erneut versuchen.',
    } as Record<string, string>,
    limit: 'Limit erreicht.', limitUntil: (when: string) => `Limit erreicht. ${when}.`,
    noNew: 'Keine neuen Notizen zum Verarbeiten.',
    nothingAssigned: 'Aus deinen Notizen ließ sich noch kein Thread bilden. Notizen mit nur einem Wort oder nur einem Link werden übersprungen. Dein Lauf wurde nicht verbraucht.',
    busy: 'Gerade ausgelastet – bitte gleich noch einmal versuchen.',
    created: (n: number) => `${plural(n, 'Thread', 'Threads')} erstellt`,
    updated: (n: number) => `${plural(n, 'Thread', 'Threads')} aktualisiert`,
    nothingNew: 'Fertig — nichts Neues.',
    inMinutes: (n: number) => n === 1 ? 'In 1 Minute verfügbar' : `In ${n} Minuten verfügbar`,
    from: (when: string) => `Ab ${when} verfügbar`,
  },
  login: {
    close: 'Schließen', fillAll: 'Bitte alle Felder ausfüllen.',
    notConfirmed: 'Dein Konto ist noch nicht bestätigt. Gib den Code aus der Mail ein oder fordere einen neuen an.',
    loginFailed: 'Anmeldung fehlgeschlagen.', invalidCredentials: 'E-Mail oder Passwort ist falsch.',
    pwMismatch: 'Passwörter stimmen nicht überein.', pwShort: 'Passwort muss mind. 6 Zeichen lang sein.',
    registerFailed: 'Registrierung fehlgeschlagen.', exists: 'Für diese Adresse gibt es schon ein Konto. Melde dich an.',
    enterCode: 'Bitte den Code aus der Mail eingeben.', codeInvalid: 'Der Code ist ungültig oder abgelaufen. Fordere bei Bedarf einen neuen an.',
    codeSent: 'Neuer Code ist unterwegs.', tooMany: 'Zu viele Versuche. Bitte warte kurz und versuch es dann erneut.',
    networkError: 'Keine Verbindung. Bitte prüfe dein Internet.',
    almost: 'Fast geschafft',
    codeText: (email: string) => [`Wir haben einen 6-stelligen Code an `, email, ` geschickt. Gib ihn hier ein. Das geht auch später in der Velm-App unter Einstellungen → Konto → Anmelden.`] as const,
    codeLabel: 'Bestätigungscode', confirming: 'Wird bestätigt…', confirm: 'Konto bestätigen →',
    resendIn: (s: number) => `Neuer Code in ${s} s`, resend: 'Code erneut senden', otherEmail: 'Andere E-Mail-Adresse',
    tabLogin: 'Anmelden', tabRegister: 'Registrieren', name: 'Name', namePh: 'Max Mustermann', email: 'E-Mail',
    emailPh: 'name@beispiel.de', password: 'Passwort', passwordConfirm: 'Passwort bestätigen',
    creating: 'Konto wird erstellt…', loggingIn: 'Anmelden…', create: 'Konto erstellen →', login: 'Anmelden →',
    or: 'oder', demo: 'Demo-Zugang verwenden', haveAccount: 'Bereits ein Konto?', noAccount: 'Noch kein Konto?',
    footnote: 'Daten bleiben lokal gespeichert.',
  },
  bookmarklet: {
    back: '← Zurück zum Graph', name: 'Velm Bookmarklet', sub: 'Text markieren → Notiz speichern',
    needsAccount: 'Das Bookmarklet braucht ein echtes Velm-Konto. Bitte melde dich mit deinem Konto an.',
    checkingTier: 'Abo wird geprüft…', tierUnknown: 'Dein Abo konnte nicht geprüft werden. Bitte lade die Seite neu.',
    tierLocked: 'Das Bookmarklet ist ab dem Basic-Plan verfügbar. Upgraden kannst du in der Velm-App unter Einstellungen → Mein Abo.',
    intro: 'Zieh diesen Button in deine Lesezeichen-Leiste. Markiere danach auf einer Webseite Text und klick ihn — es öffnet sich ein kleines Fenster, in dem du Titel, Kategorie und optional eine Erinnerung festlegst.',
    dragHint: '← in die Lesezeichen-Leiste ziehen', howTo: 'Zeigen, wie das Ziehen funktioniert',
    demoCaption: 'Button mit der Maus greifen und in die Lesezeichen-Leiste ziehen.',
    noBar: 'Keine Lesezeichen-Leiste zu sehen? Einblenden mit Strg + Umschalt + B (Mac: ⌘ + Umschalt + B).',
    loginNote: (email: string) => `Gespeichert wird mit deinem Login in diesem Browser (angemeldet als ${email}) — im Lesezeichen steckt kein Schlüssel. Hast du noch ein älteres Velm-Bookmarklet, ersetze es durch dieses.`,
    // Speicherfenster
    saveHeading: 'In Velm speichern', defaultTitle: 'Notiz aus Bookmarklet', sourcePrefix: 'Quelle', sourceTip: (url: string) => `Wird als Quelle angehängt: ${url}`,
    planTitle: 'Ab dem Basic-Plan', planBody: 'Upgraden kannst du in der Velm-App unter Einstellungen → Mein Abo.',
    openedDirectly: 'Dieses Fenster öffnet sich über das Velm-Bookmarklet. Markiere Text auf einer Webseite und klick das Lesezeichen.',
    setup: 'Bookmarklet einrichten →', saved: 'Gespeichert', canClose: 'Du kannst dieses Fenster jetzt schließen.', closing: 'Fenster schließt sich…',
    titlePh: 'Titel', textPhLink: 'Eigene Gedanken dazu… (sonst wird nur der Link gespeichert)', textPh: 'Notiz…',
    category: 'Kategorie', ai: 'KI darf darauf zugreifen', aiSub: 'Für Threads und Synthese verwenden',
    reminder: 'Erinnerung', reminderSub: 'Benachrichtigung in der App', shortcut: 'Strg + Enter speichert',
    errors: {
      unauthorized: 'Deine Anmeldung ist abgelaufen. Bitte lade die Seite neu und melde dich erneut an.',
      tier_required: 'Das Bookmarklet ist ab dem Basic-Plan verfügbar.',
      account_required: 'Dafür brauchst du ein bestätigtes Velm-Konto.',
      network: 'Keine Verbindung. Bitte prüfe dein Internet und versuch es erneut.',
      rate_limited: 'Du hast heute schon 50 Notizen per Bookmarklet gespeichert. Morgen geht es weiter.',
      content_too_long: 'Der Text ist zu lang (höchstens 50.000 Zeichen). Bitte kürze ihn.',
      invalid_reminder: 'Das Datum der Erinnerung ist ungültig.',
      default: 'Speichern fehlgeschlagen. Bitte versuch es erneut.',
    } as Record<string, string>,
  },
};

type Dict = typeof de;
// Funktionen und Tupel brauchen dieselbe Form, Texte dürfen abweichen
type Widen<T> = T extends (...a: infer A) => infer R ? (...a: A) => R extends readonly unknown[] ? readonly [string, string, string] : string
  : T extends readonly string[] ? readonly string[] : T extends string ? string : { [K in keyof T]: Widen<T[K]> };

const en: Widen<Dict> = {
  dateLocale: 'en-US',
  common: {
    close: 'Close', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
    untitled: 'Untitled', noTitle: '(no title)',
    notes: (n: number) => plural(n, 'note', 'notes'),
    threads: (n: number) => plural(n, 'thread', 'threads'),
    loadingGraph: 'Loading graph…',
  },
  topbar: {
    tagline: 'Second Brain', search: 'Search…', noHits: 'no matches', hits: (n: number) => plural(n, 'match', 'matches'),
    login: 'Sign in', register: 'Create account', newNote: '＋ Note', bookmarklet: '🔖 Bookmarklet',
    logout: 'Sign out', account: 'Account', language: 'Language', showList: 'Show thread list', showGraph: 'Show graph',
    synthStart: '✦ Run synthesis', synthRunning: '✦ Synthesis running …', synthShort: '✦ Synthesis',
    synthLimitTitle: 'Synthesis limit of your plan', overview: '← Overview',
  },
  intro: {
    scatter: { kicker: 'Your notes', title: (n: number) => `${n} thoughts, all over the place.`,
      body: 'Jotted down in between, on the train, while reading. No folders, no system.' },
    gather: { kicker: 'Velm sorts', title: () => 'What belongs together finds each other.',
      body: 'Velm reads along and bundles your notes into threads. You never create folders or tags.' },
    connect: { kicker: 'Velm connects', title: () => 'And spots what you missed.',
      body: 'Even between topics that seem unrelated at first glance.' },
    skip: 'Skip →',
  },
  hero: { line1: 'You write.', line2: 'Velm connects.',
    body: 'Notes land as they come. Velm groups them into threads and finds the connections between them.' },
  guest: {
    kicker: 'Example graph', body: 'These are example notes. Hover over threads and connections or click them.',
    tryIt: 'Try it: drop a note in', allDone: 'All sorted. That’s how it works with your own notes.',
    placedIn: '→ sorted into', thinking: '✦ Velm is thinking …', start: 'Start for free →', haveAccount: 'I already have an account',
    replayIntro: '↺ Watch the intro again', replayShort: '↺ Intro',
  },
  spotlight: { kicker: '✦ Connection found', explore: 'Explore on your own →' },
  empty: { title: 'Your graph is still empty.',
    body: 'Create notes in the Velm app and run the synthesis under “Threads”. As soon as threads exist, they show up here.' },
  list: {
    count: (n: number) => plural(n, 'thread', 'threads'), countOf: (shown: number, total: number) => `${shown} of ${total} threads`,
    none: 'No thread matches your search.',
  },
  thread: { kicker: 'Thread', summary: 'AI summary', noSummary: 'No summary yet.', connections: 'AI connections', pinned: '📌 Pinned' },
  sim: { kicker: '✦ AI connection', why: 'Why this connection?', noExplanation: 'No explanation available.' },
  noteView: {
    noContent: 'No content.', createdAt: (date: string) => `Created on ${date}`,
    deleteQ: 'Really delete this note?', delete: 'Delete', deleteFinal: 'Delete permanently',
  },
  noteCreate: {
    heading: 'New note', title: 'Title', titlePh: 'Note title…', content: 'Content', contentPh: 'What do you want to keep?',
    category: 'Category', thread: 'Thread', threadAuto: 'Automatic (during synthesis)',
    include: 'Include in threads', includeHint: 'Velm sorts the note into a thread during synthesis',
    reminder: 'Reminder', reminderNone: 'None', reminderPhone: 'Rings on your phone in the Velm app.',
    recurrence: { once: 'Once', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' },
    when: 'When', time: 'Time', weekday: 'Weekday', dayOfMonth: 'Day of month', dayOfMonthSuffix: ' of the month',
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    create: 'Create', creating: 'Creating…', created: 'Note saved.', shortcut: 'Ctrl + Enter',
  },
  noteErrors: {
    empty: 'Enter a title or some content.',
    title_too_long: 'The title is too long (500 characters max).',
    content_too_long: 'The content is too long (50,000 characters max).',
    reminder_incomplete_once: 'Please pick a date and time for the reminder.',
    reminder_incomplete_recurring: 'Please pick a time for the reminder.',
    reminder_past: 'The reminder time is in the past.',
    reminder_invalid: 'The reminder is invalid. Please check date and time.',
    unauthorized: 'Your session has expired. Please sign in again — your input is kept.',
    network: 'No connection. The note was not saved, please try again.',
    internal: 'Saving failed. Please try again.',
  },
  deleteErrors: {
    unauthorized: 'Your session has expired. Please sign in again — the note was not deleted.',
    network: 'No connection. The note was not deleted.',
    internal: 'Deleting failed. Please try again.',
  },
  synth: {
    errors: {
      ai_unavailable: 'The AI is unavailable right now. Your run was not used up.',
      ai_response_invalid: 'The AI response was unusable. Your run was not used up.',
      synthesis_failed: 'The synthesis failed. Your run was not used up.',
      profile_unavailable: 'Your profile could not be loaded right now. Please try again later.',
      internal: 'Unexpected server error. Please try again later.',
      not_signed_in: 'Not signed in.',
      network: 'No connection to the server. Please try again later.',
    },
    limit: 'Limit reached.', limitUntil: (when: string) => `Limit reached. ${when}.`,
    noNew: 'No new notes to process.',
    nothingAssigned: 'Your notes didn’t form a thread yet. Notes with a single word or just a link are skipped. Your run was not used up.',
    busy: 'Busy right now – please try again in a moment.',
    created: (n: number) => `${plural(n, 'thread', 'threads')} created`,
    updated: (n: number) => `${plural(n, 'thread', 'threads')} updated`,
    nothingNew: 'Done — nothing new.',
    inMinutes: (n: number) => n === 1 ? 'Available in 1 minute' : `Available in ${n} minutes`,
    from: (when: string) => `Available from ${when}`,
  },
  login: {
    close: 'Close', fillAll: 'Please fill in all fields.',
    notConfirmed: 'Your account isn’t confirmed yet. Enter the code from the email or request a new one.',
    loginFailed: 'Sign-in failed.', invalidCredentials: 'Email or password is incorrect.',
    pwMismatch: 'Passwords don’t match.', pwShort: 'Password must be at least 6 characters.',
    registerFailed: 'Sign-up failed.', exists: 'There is already an account for this address. Please sign in.',
    enterCode: 'Please enter the code from the email.', codeInvalid: 'The code is invalid or expired. Request a new one if needed.',
    codeSent: 'A new code is on its way.', tooMany: 'Too many attempts. Please wait a moment and try again.',
    networkError: 'No connection. Please check your internet.',
    almost: 'Almost there',
    codeText: (email: string) => [`We sent a 6-digit code to `, email, `. Enter it here. You can also do this later in the Velm app under Settings → Account → Sign in.`] as const,
    codeLabel: 'Confirmation code', confirming: 'Confirming…', confirm: 'Confirm account →',
    resendIn: (s: number) => `New code in ${s} s`, resend: 'Resend code', otherEmail: 'Different email address',
    tabLogin: 'Sign in', tabRegister: 'Sign up', name: 'Name', namePh: 'Jane Doe', email: 'Email',
    emailPh: 'name@example.com', password: 'Password', passwordConfirm: 'Confirm password',
    creating: 'Creating account…', loggingIn: 'Signing in…', create: 'Create account →', login: 'Sign in →',
    or: 'or', demo: 'Use demo access', haveAccount: 'Already have an account?', noAccount: 'No account yet?',
    footnote: 'Data stays stored locally.',
  },
  bookmarklet: {
    back: '← Back to the graph', name: 'Velm Bookmarklet', sub: 'Select text → save a note',
    needsAccount: 'The bookmarklet needs a real Velm account. Please sign in with your account.',
    checkingTier: 'Checking your plan…', tierUnknown: 'Your plan could not be checked. Please reload the page.',
    tierLocked: 'The bookmarklet is available from the Basic plan. You can upgrade in the Velm app under Settings → My plan.',
    intro: 'Drag this button to your bookmarks bar. Then select text on any web page and click it — a small window opens where you set the title, category and optionally a reminder.',
    dragHint: '← drag to the bookmarks bar', howTo: 'Show how dragging works',
    demoCaption: 'Grab the button with the mouse and drag it to the bookmarks bar.',
    noBar: 'Can’t see a bookmarks bar? Show it with Ctrl + Shift + B (Mac: ⌘ + Shift + B).',
    loginNote: (email: string) => `Notes are saved with your sign-in in this browser (signed in as ${email}) — the bookmark contains no key. If you still have an older Velm bookmarklet, replace it with this one.`,
    saveHeading: 'Save to Velm', defaultTitle: 'Note from bookmarklet', sourcePrefix: 'Source', sourceTip: (url: string) => `Attached as source: ${url}`,
    planTitle: 'From the Basic plan', planBody: 'You can upgrade in the Velm app under Settings → My plan.',
    openedDirectly: 'This window opens via the Velm bookmarklet. Select text on a web page and click the bookmark.',
    setup: 'Set up the bookmarklet →', saved: 'Saved', canClose: 'You can close this window now.', closing: 'Window is closing…',
    titlePh: 'Title', textPhLink: 'Your own thoughts on it… (otherwise only the link is saved)', textPh: 'Note…',
    category: 'Category', ai: 'AI may access it', aiSub: 'Use for threads and synthesis',
    reminder: 'Reminder', reminderSub: 'Notification in the app', shortcut: 'Ctrl + Enter saves',
    errors: {
      unauthorized: 'Your session has expired. Please reload the page and sign in again.',
      tier_required: 'The bookmarklet is available from the Basic plan.',
      account_required: 'You need a confirmed Velm account for this.',
      network: 'No connection. Please check your internet and try again.',
      rate_limited: 'You already saved 50 notes via bookmarklet today. More tomorrow.',
      content_too_long: 'The text is too long (50,000 characters max). Please shorten it.',
      invalid_reminder: 'The reminder date is invalid.',
      default: 'Saving failed. Please try again.',
    },
  },
};

export type Messages = Widen<Dict>;
const DICTS: Record<Locale, Messages> = { de, en };
/** Nur für Tests (gleiche Schlüssel in beiden Sprachen) */
export const __dicts = DICTS;

export function normalizeLocale(v: unknown): Locale | null {
  return v === 'de' || v === 'en' ? v : null;
}

/** Browsersprache: Deutsch, wenn sie vorn steht, sonst Englisch (wie `detectDeviceLocale` in der App). */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'de';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return (langs[0] ?? '').toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Zuletzt genutzte Sprache (vom Konto oder per Umschalter) — gilt auch nach dem Abmelden weiter. */
const STORE_KEY = 'velm_locale';
function storedLocale(): Locale | null {
  try { return normalizeLocale(localStorage.getItem(STORE_KEY)); } catch { return null; }
}
function storeLocale(l: Locale) {
  try { localStorage.setItem(STORE_KEY, l); } catch {}
}
/** Konto vor gemerkter Sprache vor Browsersprache */
function resolve(u: User | null | undefined): Locale {
  const fromAccount = normalizeLocale(u?.user_metadata?.locale);
  if (fromAccount) { storeLocale(fromAccount); return fromAccount; }
  return storedLocale() ?? detectBrowserLocale();
}

type Ctx = { locale: Locale; t: Messages; setLocale: (l: Locale) => void };
const Ctx = createContext<Ctx>({ locale: 'de', t: de, setLocale: () => {} });

/**
 * Löst die Sprache auf, bevor etwas gerendert wird (kein Aufblitzen der falschen Sprache).
 * Die Session (lokal) gibt den Startwert, `getUser()` holt danach den frischen Wert vom Server —
 * die Session kann eine ältere Sprache tragen, wenn sie in der App gerade erst umgestellt wurde.
 * Beim Zurückkehren in den Tab wird erneut gefragt.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => supabase.auth.getUser()
      .then(({ data }) => { if (alive && data.user) setLocaleState(resolve(data.user)); })
      .catch(() => {});
    supabase.auth.getSession()
      .then(({ data: { session } }) => { if (!alive) return; setLocaleState(resolve(session?.user)); if (session) refresh(); })
      .catch(() => { if (alive) setLocaleState(resolve(null)); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (alive) setLocaleState(resolve(session?.user)); });
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; sub.subscription.unsubscribe(); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  useEffect(() => { if (locale) document.documentElement.lang = locale; }, [locale]);

  /** Umschalter im Web: sofort umstellen, merken, und angemeldet auch am Konto ablegen (Mail-Vorlagen,
   *  nächster Besuch). Die App selbst behält ihre eigene Einstellung. */
  const setLocale = (l: Locale) => {
    setLocaleState(l); storeLocale(l);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) return supabase.auth.updateUser({ data: { locale: l } });
    }).catch(() => {});
  };

  if (!locale) return null;
  return <Ctx.Provider value={{ locale, t: DICTS[locale], setLocale }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
