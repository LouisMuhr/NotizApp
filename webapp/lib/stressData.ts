import { GraphData, Note, Similarity, Thread } from '@/types';

// Nur für die Entwicklung: generierter Graph, um Darstellung und Leistung mit vielen Threads zu prüfen.
// Aufruf: http://localhost:3000/?stress=40 (wirkt nur ohne Login und nur mit `next dev`).

const TOPICS: Array<[string, string[]]> = [
  ['Kochen', ['Sauerteig', 'Ramen', 'Gewürze', 'Meal Prep', 'Fermentieren']], ['Laufen', ['Intervalle', 'Laufschuhe', 'Halbmarathon', 'Pace', 'Regeneration']],
  ['Finanzen', ['ETF-Sparplan', 'Budget', 'Steuern', 'Notgroschen', 'Versicherungen']], ['Wohnung', ['Umzug', 'Möbel', 'Pflanzen', 'Licht', 'Ordnung']],
  ['Lesen', ['Romane', 'Sachbücher', 'Leseliste', 'Zitate', 'Bibliothek']], ['Fotografie', ['Objektive', 'Lightroom', 'Streetfotos', 'Licht', 'Komposition']],
  ['Programmieren', ['TypeScript', 'Tests', 'Refactoring', 'Datenbanken', 'APIs']], ['Karriere', ['Gehalt', 'Bewerbung', 'Mentoring', 'Feedback', 'Ziele']],
  ['Musik', ['Gitarre', 'Playlists', 'Konzerte', 'Akkorde', 'Gehörbildung']], ['Garten', ['Tomaten', 'Kompost', 'Beete', 'Aussaat', 'Kräuter']],
  ['Philosophie', ['Stoizismus', 'Ethik', 'Freiheit', 'Sinn', 'Bewusstsein']], ['Familie', ['Geburtstage', 'Geschenke', 'Besuche', 'Traditionen', 'Fotos']],
  ['Schlaf', ['Abendroutine', 'Koffein', 'Träume', 'Schlafdauer', 'Licht']], ['Meditation', ['Atmung', 'Achtsamkeit', 'Apps', 'Retreat', 'Stille']],
  ['Startup-Ideen', ['Marktgröße', 'Pricing', 'MVP', 'Interviews', 'Wettbewerb']], ['Design', ['Typografie', 'Farben', 'Raster', 'Icons', 'Weißraum']],
  ['Italien-Reise', ['Rom', 'Toskana', 'Zugfahrt', 'Gelato', 'Unterkünfte']], ['Sprachen', ['Spanisch', 'Vokabeln', 'Grammatik', 'Tandem', 'Podcasts']],
  ['Geschichte', ['Antike', 'Mittelalter', 'Kalter Krieg', 'Quellen', 'Museen']], ['Psychologie', ['Biases', 'Motivation', 'Gewohnheiten', 'Emotionen', 'Stress']],
  ['Ernährung', ['Protein', 'Zucker', 'Frühstück', 'Wasser', 'Vitamine']], ['Auto', ['Service', 'Reifen', 'Versicherung', 'E-Auto', 'Laden']],
  ['Freunde', ['Treffen', 'Geschenkideen', 'Spieleabend', 'Gespräche', 'Urlaub']], ['Klima', ['CO₂', 'Solar', 'Wärmepumpe', 'Ernährung', 'Mobilität']],
  ['KI-Tools', ['Prompts', 'Agenten', 'Modelle', 'Automatisierung', 'Datenschutz']], ['Schreiben', ['Blog', 'Struktur', 'Stil', 'Entwürfe', 'Feedback']],
  ['Fitness', ['Krafttraining', 'Mobilität', 'Trainingsplan', 'Klimmzüge', 'Dehnen']], ['Haushalt', ['Putzplan', 'Einkauf', 'Reparaturen', 'Wäsche', 'Vorräte']],
  ['Filme & Serien', ['Watchlist', 'Regie', 'Sci-Fi', 'Dokus', 'Kritiken']], ['Kunst', ['Museen', 'Skizzen', 'Malerei', 'Ausstellungen', 'Farben']],
  ['Marketing', ['Zielgruppe', 'Newsletter', 'SEO', 'Social Media', 'Branding']], ['Mathe', ['Statistik', 'Wahrscheinlichkeit', 'Lineare Algebra', 'Beweise', 'Rätsel']],
  ['Vorsorge', ['Arzttermine', 'Rücken', 'Augen', 'Zähne', 'Impfungen']], ['Wandern', ['Alpen', 'Ausrüstung', 'Touren', 'Hütten', 'Wetter']],
  ['Podcast-Notizen', ['Interviews', 'Gäste', 'Highlights', 'Zitate', 'Empfehlungen']], ['Nebenprojekt', ['Roadmap', 'Bugs', 'Features', 'Nutzer', 'Launch']],
  ['Weiterbildung', ['Kurse', 'Zertifikate', 'Workshops', 'Lernplan', 'Konferenzen']], ['Zeitmanagement', ['Kalender', 'Prioritäten', 'Fokuszeit', 'Meetings', 'Pausen']],
  ['Kreativität', ['Ideenfindung', 'Brainstorming', 'Skizzenbuch', 'Inspiration', 'Flow']], ['Minimalismus', ['Ausmisten', 'Kapselgarderobe', 'Digital Detox', 'Konsum', 'Raum']],
];
const KINDS = ['Idee', 'Frage', 'Erkenntnis', 'Zitat', 'Link', 'Todo', 'Beobachtung', 'Notiz'];
const CATS = ['Arbeit', 'Lernen', 'Ideen', 'Persönlich', 'Reisen', 'Gesundheit', 'Finanzen', 'Projekte'];
const LABELS = ['Gewohnheiten', 'Gesundheit', 'Lernen', 'Kreativität', 'Planung', 'Geld & Zeit', 'Werkzeuge', 'Routinen', 'Fokus', 'Struktur'];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stressData(nThreads: number): GraphData {
  const R = rng(9), pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const now = '2026-10-20T10:00:00Z';
  const threads: Thread[] = [], notes: Note[] = [], similarities: Similarity[] = [];
  TOPICS.slice(0, Math.max(1, Math.min(nThreads, TOPICS.length))).forEach(([title, words], i) => {
    const id = `stress-t${i}`, cat = CATS[i % CATS.length], count = Math.round(4 + 34 * Math.pow(R(), 2.2)), noteIds: string[] = [];
    for (let k = 0; k < count; k++) {
      const w = pick(words), nid = `${id}-n${k}`;
      noteIds.push(nid);
      notes.push({ id: nid, threadId: id, threadIds: [id], title: `${pick(KINDS)}: ${w}`, content: `Beispielinhalt zu „${w}".`, category: R() < 0.7 ? cat : pick(CATS), createdAt: now, updatedAt: now });
    }
    threads.push({ id, title, summary: `Alles rund um ${title}: ${words.slice(0, 3).join(', ')} und mehr.`, status: 'active', isPinned: false, noteCount: count, noteIds, lastSynthesizedAt: now, createdAt: now, updatedAt: now });
  });
  const seen = new Set<string>();
  threads.forEach((t, i) => {
    for (let j = 0; j < (R() < 0.5 ? 1 : 2); j++) {
      const o = Math.floor(R() * threads.length), key = [i, o].sort().join('-');
      if (o === i || seen.has(key)) continue;
      seen.add(key);
      similarities.push({ id: `stress-s${key}`, threadId1: t.id, threadId2: threads[o].id, label: pick(LABELS), explanation: `${t.title} und ${threads[o].title} hängen über gemeinsame Themen zusammen.` });
    }
  });
  return { threads, notes, similarities };
}
