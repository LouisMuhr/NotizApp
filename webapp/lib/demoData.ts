import { GraphData, Note, Thread } from '@/types';
import type { Locale } from '@/lib/i18n';

// Beispiel-Graph für Besucher ohne Login (Startseite). Wie bei der echten Synthese steckt jede Notiz in
// genau einem Thread; Zusammenhänge zwischen Threads laufen über KI-Verbindungen (similarities).
// Zwei Sprachen mit denselben IDs — Intro, Spotlight und Chips verweisen nur auf IDs.

type Text = { title: string; content: string; category: string };
type DemoNote = { id: string; threadIds: string[]; date: string; de: Text; en: Text };

const NOTES: DemoNote[] = [
  { id: 'demo-n1', threadIds: ['demo-t1'], date: '2026-09-02',
    de: { category: 'Arbeit', title: 'Pomodoro-Technik', content: '25 Minuten fokussiert arbeiten, dann 5 Minuten Pause. Nach 4 Runden eine längere Pause von 15–30 Minuten.\n\nFunktioniert gut für tiefe Arbeit.' },
    en: { category: 'Work', title: 'Pomodoro technique', content: 'Work focused for 25 minutes, then take a 5-minute break. After 4 rounds, a longer break of 15–30 minutes.\n\nWorks well for deep work.' } },
  { id: 'demo-n2', threadIds: ['demo-t1'], date: '2026-09-05',
    de: { category: 'Arbeit', title: 'Deep Work Regeln', content: 'Feste Zeiten ohne Ablenkung einplanen. Telefon stumm, Benachrichtigungen aus. Wichtige Aufgaben morgens zuerst.' },
    en: { category: 'Work', title: 'Deep work rules', content: 'Block fixed times without distractions. Phone on silent, notifications off. Important tasks first thing in the morning.' } },
  { id: 'demo-n3', threadIds: ['demo-t1'], date: '2026-09-14',
    de: { category: 'Persönlich', title: 'Wöchentliches Review', content: 'Jeden Sonntag 30 Minuten: Was lief gut? Was nicht? Was sind die Top-3 Ziele für nächste Woche?' },
    en: { category: 'Personal', title: 'Weekly review', content: 'Every Sunday, 30 minutes: What went well? What didn’t? What are the top 3 goals for next week?' } },
  { id: 'demo-n4', threadIds: ['demo-t4'], date: '2026-09-20',
    de: { category: 'Persönlich', title: 'Handy raus aus dem Schlafzimmer', content: 'Wecker statt Handy. Seitdem schlafe ich schneller ein und starte ohne Newsfeed in den Tag.' },
    en: { category: 'Personal', title: 'Phone out of the bedroom', content: 'Alarm clock instead of phone. Since then I fall asleep faster and start the day without a news feed.' } },
  { id: 'demo-n5', threadIds: ['demo-t2'], date: '2026-08-28',
    de: { category: 'Lernen', title: 'Atomic Habits – Kernthese', content: '1 % täglich besser werden. Systeme schlagen Ziele. Identitätsbasierte Gewohnheiten formen, wer wir sind.' },
    en: { category: 'Learning', title: 'Atomic Habits – core idea', content: 'Get 1% better every day. Systems beat goals. Identity-based habits shape who we are.' } },
  { id: 'demo-n6', threadIds: ['demo-t2'], date: '2026-09-08',
    de: { category: 'Lernen', title: 'Feynman-Methode', content: 'Ein Konzept wirklich verstehen: Es jemandem ohne Vorkenntnisse erklären. Lücken erkennen, nachschlagen, vereinfachen.' },
    en: { category: 'Learning', title: 'Feynman technique', content: 'To really understand a concept, explain it to someone with no background. Spot the gaps, look them up, simplify.' } },
  { id: 'demo-n7', threadIds: ['demo-t2'], date: '2026-09-11',
    de: { category: 'Lernen', title: 'Spaced Repetition', content: 'Karten kurz halten. Täglich 10–15 Minuten genügen für dauerhaftes Behalten.' },
    en: { category: 'Learning', title: 'Spaced repetition', content: 'Keep cards short. 10–15 minutes a day is enough for lasting retention.' } },
  { id: 'demo-n8', threadIds: ['demo-t2'], date: '2026-09-17',
    de: { category: 'Ideen', title: 'Zettelkasten-Prinzip', content: 'Eine Idee pro Notiz, Verbindungen statt Ordner. Genau das sollte eine Notiz-App automatisch können.' },
    en: { category: 'Ideas', title: 'Zettelkasten principle', content: 'One idea per note, connections instead of folders. That’s exactly what a notes app should do automatically.' } },
  { id: 'demo-n9', threadIds: ['demo-t3'], date: '2026-09-03',
    de: { category: 'Ideen', title: 'Second Brain App', content: 'Persönliche Wissensdatenbank mit Graph-Ansicht. Notizen, Threads, KI-Zusammenfassungen.' },
    en: { category: 'Ideas', title: 'Second brain app', content: 'Personal knowledge base with a graph view. Notes, threads, AI summaries.' } },
  { id: 'demo-n10', threadIds: ['demo-t3'], date: '2026-09-22',
    de: { category: 'Ideen', title: 'Browser-Bookmarklet', content: 'Mit einem Klick Textstellen von Webseiten speichern, ohne Copy-Paste.' },
    en: { category: 'Ideas', title: 'Browser bookmarklet', content: 'Save passages from web pages with one click, no copy-paste.' } },
  { id: 'demo-n11', threadIds: ['demo-t3'], date: '2026-10-01',
    de: { category: 'Ideen', title: 'Sprachnotizen mit KI', content: 'Diktieren, KI macht Titel, Checkliste und Erinnerung daraus.' },
    en: { category: 'Ideas', title: 'Voice notes with AI', content: 'Dictate, and the AI turns it into a title, checklist and reminder.' } },
  { id: 'demo-n12', threadIds: ['demo-t4'], date: '2026-09-09',
    de: { category: 'Persönlich', title: 'Morgenroutine', content: 'Glas Wasser, 10 Minuten Licht draußen, erst dann Kaffee.' },
    en: { category: 'Personal', title: 'Morning routine', content: 'Glass of water, 10 minutes of daylight outside, only then coffee.' } },
  { id: 'demo-n13', threadIds: ['demo-t4'], date: '2026-09-25',
    de: { category: 'Persönlich', title: 'Schlaf-Tracking Erkenntnisse', content: 'Spätes Essen kostet messbar Tiefschlaf. Alkohol noch mehr.' },
    en: { category: 'Personal', title: 'Sleep tracking insights', content: 'Late meals measurably cost deep sleep. Alcohol even more.' } },
  { id: 'demo-n14', threadIds: ['demo-t4'], date: '2026-10-04',
    de: { category: 'Persönlich', title: 'Zone-2-Training', content: '3× pro Woche 45 Minuten locker, so dass man sich noch unterhalten kann.' },
    en: { category: 'Personal', title: 'Zone 2 training', content: '3× a week, 45 easy minutes, at a pace where you can still hold a conversation.' } },
  { id: 'demo-n15', threadIds: ['demo-t5'], date: '2026-10-06',
    de: { category: 'Reisen', title: 'Kirschblüte in Kyoto', content: 'Ende März bis Anfang April. Philosophenweg früh morgens, bevor es voll wird.' },
    en: { category: 'Travel', title: 'Cherry blossoms in Kyoto', content: 'Late March to early April. Philosopher’s Path early in the morning, before it gets crowded.' } },
  { id: 'demo-n16', threadIds: ['demo-t5'], date: '2026-10-09',
    de: { category: 'Reisen', title: 'JR Pass – lohnt sich das?', content: 'Seit der Preiserhöhung nur bei vielen Shinkansen-Fahrten. Einzeltickets durchrechnen.' },
    en: { category: 'Travel', title: 'JR Pass – worth it?', content: 'Since the price increase, only with lots of Shinkansen rides. Do the math on single tickets.' } },
  { id: 'demo-n17', threadIds: ['demo-t5'], date: '2026-10-12',
    de: { category: 'Lernen', title: 'Japanisch lernen mit Anki', content: 'Hiragana und Katakana zuerst, dann 10 neue Vokabeln pro Tag.' },
    en: { category: 'Learning', title: 'Learning Japanese with Anki', content: 'Hiragana and katakana first, then 10 new words a day.' } },
  { id: 'demo-n18', threadIds: ['demo-t5'], date: '2026-10-15',
    de: { category: 'Reisen', title: 'Packliste minimal', content: 'Handgepäck reicht: 3 Shirts, Merino, Waschmittel-Blätter, Adapter Typ A.' },
    en: { category: 'Travel', title: 'Minimal packing list', content: 'Carry-on is enough: 3 shirts, merino, detergent sheets, type A adapter.' } },
];

type ThreadText = { title: string; summary: string };
const THREADS: Array<{ id: string; isPinned: boolean; de: ThreadText; en: ThreadText }> = [
  { id: 'demo-t1', isPinned: false,
    de: { title: 'Fokus & Produktivität', summary: 'Methoden und Gewohnheiten, um konzentriert zu arbeiten und die Woche bewusst zu planen.' },
    en: { title: 'Focus & productivity', summary: 'Methods and habits for working with focus and planning the week deliberately.' } },
  { id: 'demo-t2', isPinned: false,
    de: { title: 'Lernen & Wissen', summary: 'Wie man Neues wirklich versteht und behält: Bücher, Lerntechniken und Wiederholung.' },
    en: { title: 'Learning & knowledge', summary: 'How to truly understand and retain new things: books, study techniques and repetition.' } },
  { id: 'demo-t3', isPinned: true,
    de: { title: 'Projektideen', summary: 'Ideen für eigene Werkzeuge rund um Notizen und Wissensmanagement.' },
    en: { title: 'Project ideas', summary: 'Ideas for your own tools around notes and knowledge management.' } },
  { id: 'demo-t4', isPinned: false,
    de: { title: 'Gesundheit & Energie', summary: 'Schlaf, Bewegung und Routinen, die über den Tag Energie geben.' },
    en: { title: 'Health & energy', summary: 'Sleep, exercise and routines that give you energy throughout the day.' } },
  { id: 'demo-t5', isPinned: false,
    de: { title: 'Japan-Reise 2027', summary: 'Planung für drei Wochen Japan im Frühling: Route, Bahn, Sprache und Gepäck.' },
    en: { title: 'Japan trip 2027', summary: 'Planning three weeks in Japan in spring: route, trains, language and luggage.' } },
];

type SimText = { label: string; explanation: string };
// Verbindungen zeigen auf konkrete Notizen statt auf Oberbegriffe — erst das wirkt wie eine Entdeckung.
const SIMS: Array<{ id: string; threadId1: string; threadId2: string; de: SimText; en: SimText }> = [
  { id: 'demo-s1', threadId1: 'demo-t1', threadId2: 'demo-t2',
    de: { label: 'Kurz schlägt lang', explanation: '25 Minuten Pomodoro, 10–15 Minuten Karteikarten am Tag: In beiden Threads funktionieren kurze, regelmäßige Einheiten besser als lange Sessions.' },
    en: { label: 'Short beats long', explanation: '25-minute Pomodoros, 10–15 minutes of flashcards a day: in both threads, short regular sessions work better than long ones.' } },
  { id: 'demo-s2', threadId1: 'demo-t2', threadId2: 'demo-t3',
    de: { label: 'Zettelkasten als Produkt', explanation: 'Beim Zettelkasten-Prinzip notierst du „Verbindungen statt Ordner — genau das sollte eine Notiz-App automatisch können“. Die Second-Brain-App aus deinen Projektideen ist dieser Satz als Produkt.' },
    en: { label: 'Zettelkasten as a product', explanation: 'Under the Zettelkasten principle you wrote “connections instead of folders — that’s exactly what a notes app should do automatically”. The second brain app from your project ideas is that sentence turned into a product.' } },
  { id: 'demo-s3', threadId1: 'demo-t1', threadId2: 'demo-t4',
    de: { label: 'Der Fokus beginnt am Abend', explanation: 'Deine Deep-Work-Regeln legen die wichtigen Aufgaben auf den Morgen. Dein Schlaf-Tracking zeigt aber: spätes Essen und Alkohol kosten Tiefschlaf. Ob der Fokus-Morgen gelingt, entscheidet sich am Abend davor.' },
    en: { label: 'Focus starts the night before', explanation: 'Your deep work rules put the important tasks in the morning. But your sleep tracking shows that late meals and alcohol cost deep sleep. Whether the focused morning works out is decided the evening before.' } },
  { id: 'demo-s4', threadId1: 'demo-t2', threadId2: 'demo-t5',
    de: { label: 'Anki ist Spaced Repetition', explanation: 'Die Vokabelkarten für Japanisch sind dieselbe Methode wie „Spaced Repetition“ im Lern-Thread. 10 neue Wörter am Tag passen genau in die 10–15 Minuten, die du dort notiert hast.' },
    en: { label: 'Anki is spaced repetition', explanation: 'The Japanese flashcards are the same method as “spaced repetition” in the learning thread. 10 new words a day fit exactly into the 10–15 minutes you noted there.' } },
  { id: 'demo-s5', threadId1: 'demo-t4', threadId2: 'demo-t5',
    de: { label: 'Morgenlicht gegen Jetlag', explanation: 'Deine Morgenroutine mit 10 Minuten Licht draußen hilft auch, die innere Uhr nach dem Flug umzustellen. In Kyoto passt sie zum Philosophenweg früh morgens, bevor es voll wird.' },
    en: { label: 'Morning light against jet lag', explanation: 'Your morning routine with 10 minutes of daylight also helps reset your body clock after the flight. In Kyoto it pairs with the Philosopher’s Path early in the morning, before it gets crowded.' } },
];

/** „Probier's aus": Notizen, die Besucher per Chip in den Beispiel-Graphen werfen. Das Ziel steht fest —
 *  das zeigt, was die Synthese tut, ohne KI-Aufruf (kostet nichts, klappt immer). */
const TRY: Array<{ id: string; threadId: string; de: Text; en: Text }> = [
  { id: 'demo-try-1', threadId: 'demo-t5',
    de: { category: 'Reisen', title: 'Ramen-Laden in Osaka', content: 'Kleiner Laden hinter dem Bahnhof Namba, nur acht Plätze. Vor 11 Uhr da sein.' },
    en: { category: 'Travel', title: 'Ramen shop in Osaka', content: 'Tiny place behind Namba station, only eight seats. Be there before 11 am.' } },
  { id: 'demo-try-2', threadId: 'demo-t4',
    de: { category: 'Persönlich', title: 'Mittagsschlaf, 20 Minuten', content: 'Kurzer Powernap nach dem Mittag, Wecker auf 20 Minuten. Länger macht mich nur müde.' },
    en: { category: 'Personal', title: '20-minute nap', content: 'Short power nap after lunch, alarm set to 20 minutes. Longer only makes me tired.' } },
  { id: 'demo-try-3', threadId: 'demo-t1',
    de: { category: 'Arbeit', title: 'Zwei-Minuten-Regel', content: 'Was weniger als zwei Minuten dauert, sofort erledigen statt aufschreiben.' },
    en: { category: 'Work', title: 'Two-minute rule', content: 'If it takes less than two minutes, do it right away instead of writing it down.' } },
  { id: 'demo-try-4', threadId: 'demo-t3',
    de: { category: 'Ideen', title: 'Newsletter per Weiterleitung speichern', content: 'Abschnitte aus Newslettern per Mail weiterleiten, Velm macht daraus eine Notiz.' },
    en: { category: 'Ideas', title: 'Save newsletters by forwarding', content: 'Forward newsletter sections by email, and Velm turns them into a note.' } },
];

export type DemoTryNote = Omit<Note, 'createdAt' | 'updatedAt'>;

function build(locale: Locale): { data: GraphData; tryNotes: DemoTryNote[] } {
  const threads: Thread[] = THREADS.map(t => {
    const noteIds = NOTES.filter(n => n.threadIds.includes(t.id)).map(n => n.id);
    return {
      id: t.id, isPinned: t.isPinned, ...t[locale], lastSynthesizedAt: '2026-10-20T10:00:00Z',
      status: 'active', noteIds, noteCount: noteIds.length,
      createdAt: '2026-08-28T08:00:00Z', updatedAt: '2026-10-20T10:00:00Z',
    };
  });
  const notes: Note[] = NOTES.map(n => ({
    id: n.id, threadIds: n.threadIds, threadId: n.threadIds[0], ...n[locale],
    createdAt: `${n.date}T09:00:00Z`, updatedAt: `${n.date}T09:00:00Z`,
  }));
  return {
    data: { threads, notes, similarities: SIMS.map(s => ({ id: s.id, threadId1: s.threadId1, threadId2: s.threadId2, ...s[locale] })) },
    tryNotes: TRY.map(n => ({ id: n.id, threadId: n.threadId, ...n[locale] })),
  };
}

// Pro Sprache ein festes Objekt: die Startseite erkennt den Beispiel-Graphen an der Identität
const DEMOS: Record<Locale, ReturnType<typeof build>> = { de: build('de'), en: build('en') };
export const demoFor = (locale: Locale) => DEMOS[locale];

/** Beispiel-Graph mit einer zusätzlich einsortierten Notiz (neues Objekt → der Graph gleitet ins neue Layout). */
export function withDemoNote(data: GraphData, n: DemoTryNote): GraphData {
  const now = new Date().toISOString();
  return {
    ...data,
    notes: [...data.notes, { ...n, threadIds: [n.threadId], createdAt: now, updatedAt: now }],
    threads: data.threads.map(t => t.id === n.threadId ? { ...t, noteIds: [...t.noteIds, n.id], noteCount: t.noteCount + 1 } : t),
  };
}

/** Erstbesuch: Nach dem Intro fliegt die Kamera zu dieser Verbindung und hebt die zwei Notizen hervor,
 *  aus denen sie entsteht. */
export const DEMO_SPOTLIGHT = { similarityId: 'demo-s3', noteIds: ['demo-n2', 'demo-n13'] as [string, string] };
