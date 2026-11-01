import { GraphData, Note, Thread } from '@/types';

// Beispiel-Graph für Besucher ohne Login (Startseite). Wie bei der echten Synthese steckt jede Notiz in
// genau einem Thread; Zusammenhänge zwischen Threads laufen über KI-Verbindungen (similarities).

type DemoNote = Omit<Note, 'threadId' | 'createdAt' | 'updatedAt'> & { threadIds: string[]; date: string };

const NOTES: DemoNote[] = [
  { id: 'demo-n1',  threadIds: ['demo-t1'], date: '2026-09-02', category: 'Arbeit', title: 'Pomodoro-Technik',
    content: '25 Minuten fokussiert arbeiten, dann 5 Minuten Pause. Nach 4 Runden eine längere Pause von 15–30 Minuten.\n\nFunktioniert gut für tiefe Arbeit.' },
  { id: 'demo-n2',  threadIds: ['demo-t1'], date: '2026-09-05', category: 'Arbeit', title: 'Deep Work Regeln',
    content: 'Feste Zeiten ohne Ablenkung einplanen. Telefon stumm, Benachrichtigungen aus. Wichtige Aufgaben morgens zuerst.' },
  { id: 'demo-n3',  threadIds: ['demo-t1'], date: '2026-09-14', category: 'Persönlich', title: 'Wöchentliches Review',
    content: 'Jeden Sonntag 30 Minuten: Was lief gut? Was nicht? Was sind die Top-3 Ziele für nächste Woche?' },
  { id: 'demo-n4',  threadIds: ['demo-t4'], date: '2026-09-20', category: 'Persönlich', title: 'Handy raus aus dem Schlafzimmer',
    content: 'Wecker statt Handy. Seitdem schlafe ich schneller ein und starte ohne Newsfeed in den Tag.' },
  { id: 'demo-n5',  threadIds: ['demo-t2'], date: '2026-08-28', category: 'Lernen', title: 'Atomic Habits – Kernthese',
    content: '1 % täglich besser werden. Systeme schlagen Ziele. Identitätsbasierte Gewohnheiten formen, wer wir sind.' },
  { id: 'demo-n6',  threadIds: ['demo-t2'], date: '2026-09-08', category: 'Lernen', title: 'Feynman-Methode',
    content: 'Ein Konzept wirklich verstehen: Es jemandem ohne Vorkenntnisse erklären. Lücken erkennen, nachschlagen, vereinfachen.' },
  { id: 'demo-n7',  threadIds: ['demo-t2'], date: '2026-09-11', category: 'Lernen', title: 'Spaced Repetition',
    content: 'Karten kurz halten. Täglich 10–15 Minuten genügen für dauerhaftes Behalten.' },
  { id: 'demo-n8',  threadIds: ['demo-t2'], date: '2026-09-17', category: 'Ideen', title: 'Zettelkasten-Prinzip',
    content: 'Eine Idee pro Notiz, Verbindungen statt Ordner. Genau das sollte eine Notiz-App automatisch können.' },
  { id: 'demo-n9',  threadIds: ['demo-t3'], date: '2026-09-03', category: 'Ideen', title: 'Second Brain App',
    content: 'Persönliche Wissensdatenbank mit Graph-Ansicht. Notizen, Threads, KI-Zusammenfassungen.' },
  { id: 'demo-n10', threadIds: ['demo-t3'], date: '2026-09-22', category: 'Ideen', title: 'Browser-Bookmarklet',
    content: 'Mit einem Klick Textstellen von Webseiten speichern, ohne Copy-Paste.' },
  { id: 'demo-n11', threadIds: ['demo-t3'], date: '2026-10-01', category: 'Ideen', title: 'Sprachnotizen mit KI',
    content: 'Diktieren, KI macht Titel, Checkliste und Erinnerung daraus.' },
  { id: 'demo-n12', threadIds: ['demo-t4'], date: '2026-09-09', category: 'Persönlich', title: 'Morgenroutine',
    content: 'Glas Wasser, 10 Minuten Licht draußen, erst dann Kaffee.' },
  { id: 'demo-n13', threadIds: ['demo-t4'], date: '2026-09-25', category: 'Persönlich', title: 'Schlaf-Tracking Erkenntnisse',
    content: 'Spätes Essen kostet messbar Tiefschlaf. Alkohol noch mehr.' },
  { id: 'demo-n14', threadIds: ['demo-t4'], date: '2026-10-04', category: 'Persönlich', title: 'Zone-2-Training',
    content: '3× pro Woche 45 Minuten locker, so dass man sich noch unterhalten kann.' },
  { id: 'demo-n15', threadIds: ['demo-t5'], date: '2026-10-06', category: 'Reisen', title: 'Kirschblüte in Kyoto',
    content: 'Ende März bis Anfang April. Philosophenweg früh morgens, bevor es voll wird.' },
  { id: 'demo-n16', threadIds: ['demo-t5'], date: '2026-10-09', category: 'Reisen', title: 'JR Pass – lohnt sich das?',
    content: 'Seit der Preiserhöhung nur bei vielen Shinkansen-Fahrten. Einzeltickets durchrechnen.' },
  { id: 'demo-n17', threadIds: ['demo-t5'], date: '2026-10-12', category: 'Lernen', title: 'Japanisch lernen mit Anki',
    content: 'Hiragana und Katakana zuerst, dann 10 neue Vokabeln pro Tag.' },
  { id: 'demo-n18', threadIds: ['demo-t5'], date: '2026-10-15', category: 'Reisen', title: 'Packliste minimal',
    content: 'Handgepäck reicht: 3 Shirts, Merino, Waschmittel-Blätter, Adapter Typ A.' },
];

const THREADS: Array<Omit<Thread, 'noteIds' | 'noteCount' | 'status' | 'createdAt' | 'updatedAt'>> = [
  { id: 'demo-t1', title: 'Fokus & Produktivität', isPinned: false, lastSynthesizedAt: '2026-10-20T10:00:00Z',
    summary: 'Methoden und Gewohnheiten, um konzentriert zu arbeiten und die Woche bewusst zu planen.' },
  { id: 'demo-t2', title: 'Lernen & Wissen', isPinned: false, lastSynthesizedAt: '2026-10-20T10:00:00Z',
    summary: 'Wie man Neues wirklich versteht und behält: Bücher, Lerntechniken und Wiederholung.' },
  { id: 'demo-t3', title: 'Projektideen', isPinned: true, lastSynthesizedAt: '2026-10-20T10:00:00Z',
    summary: 'Ideen für eigene Werkzeuge rund um Notizen und Wissensmanagement.' },
  { id: 'demo-t4', title: 'Gesundheit & Energie', isPinned: false, lastSynthesizedAt: '2026-10-20T10:00:00Z',
    summary: 'Schlaf, Bewegung und Routinen, die über den Tag Energie geben.' },
  { id: 'demo-t5', title: 'Japan-Reise 2027', isPinned: false, lastSynthesizedAt: '2026-10-20T10:00:00Z',
    summary: 'Planung für drei Wochen Japan im Frühling: Route, Bahn, Sprache und Gepäck.' },
];

export const DEMO_DATA: GraphData = {
  threads: THREADS.map(t => {
    const noteIds = NOTES.filter(n => n.threadIds.includes(t.id)).map(n => n.id);
    return {
      ...t, status: 'active', noteIds, noteCount: noteIds.length,
      createdAt: '2026-08-28T08:00:00Z', updatedAt: '2026-10-20T10:00:00Z',
    };
  }),
  notes: NOTES.map(({ date, ...n }) => ({
    ...n, threadId: n.threadIds[0], createdAt: `${date}T09:00:00Z`, updatedAt: `${date}T09:00:00Z`,
  })),
  similarities: [
    { id: 'demo-s1', threadId1: 'demo-t1', threadId2: 'demo-t2', label: 'Selbstoptimierung',
      explanation: 'Beide Threads drehen sich um persönliches Wachstum durch Methoden und Wissen.' },
    { id: 'demo-s2', threadId1: 'demo-t2', threadId2: 'demo-t3', label: 'Wissensmanagement',
      explanation: 'Lerntechniken wie der Zettelkasten fließen direkt in die Projektideen ein.' },
    { id: 'demo-s3', threadId1: 'demo-t1', threadId2: 'demo-t4', label: 'Energie & Rhythmus',
      explanation: 'Konzentration hängt an Schlaf und Routinen: wer ausgeruht ist, arbeitet fokussierter.' },
    { id: 'demo-s4', threadId1: 'demo-t2', threadId2: 'demo-t5', label: 'Sprachenlernen',
      explanation: 'Japanisch für die Reise wird mit denselben Techniken gelernt wie im Lernen-Thread: Karteikarten und Wiederholung.' },
  ],
};
