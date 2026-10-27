import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tier = 'free' | 'basic' | 'pro';

interface ProfileRow {
  id: string;
  tier: Tier;
  ai_last_run: string | null;
  ai_runs_today: number;
  ai_day_reset: string | null;
}

// ---------------------------------------------------------------------------
// Rate-limit check — returns nextAllowedAt ISO string or null (= allowed)
// ---------------------------------------------------------------------------

function checkRateLimit(profile: ProfileRow): string | null {
  const { tier, ai_last_run, ai_runs_today, ai_day_reset } = profile;
  const now = new Date();

  if (!ai_last_run) return null; // never run → always allowed

  const lastRun = new Date(ai_last_run);

  if (tier === 'free') {
    const nextAllowed = new Date(lastRun.getTime() + 7 * 24 * 60 * 60 * 1000);
    return nextAllowed > now ? nextAllowed.toISOString() : null;
  }

  if (tier === 'basic') {
    const nextAllowed = new Date(lastRun.getTime() + 24 * 60 * 60 * 1000);
    return nextAllowed > now ? nextAllowed.toISOString() : null;
  }

  if (tier === 'pro') {
    const todayUtc = now.toISOString().slice(0, 10);
    if (ai_day_reset === todayUtc && ai_runs_today >= 10) {
      const midnight = new Date(todayUtc);
      midnight.setUTCDate(midnight.getUTCDate() + 1);
      return midnight.toISOString();
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Profile update helper
// ---------------------------------------------------------------------------

/**
 * Bucht den Lauf, BEVOR die teure Anthropic-Anfrage laeuft ("claim").
 *
 * Der PATCH filtert zusaetzlich auf den gelesenen ai_last_run-Wert. Damit gewinnt
 * bei zwei parallelen Requests genau einer: der zweite matcht keine Zeile mehr,
 * bekommt 0 Rows zurueck und wird abgewiesen. Ohne diesen Filter wuerden beide
 * den Rate-Limit-Check passieren (Read-dann-Write-Race).
 *
 * Gibt true zurueck, wenn der Lauf fuer diesen Request reserviert wurde.
 */
async function claimRun(
  supabaseUrl: string,
  serviceKey: string,
  uid: string,
  profile: ProfileRow,
): Promise<boolean> {
  const now = new Date().toISOString();
  const todayUtc = now.slice(0, 10);
  const isNewDay = profile.ai_day_reset !== todayUtc;
  const runsToday = isNewDay ? 1 : (profile.ai_runs_today ?? 0) + 1;

  const lastRunFilter = profile.ai_last_run === null
    ? 'ai_last_run=is.null'
    : `ai_last_run=eq.${encodeURIComponent(profile.ai_last_run)}`;

  const r = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${uid}&${lastRunFilter}`,
    {
      method: 'PATCH',
      headers: { ...sbHeaders(serviceKey), Prefer: 'return=representation' },
      body: JSON.stringify({
        ai_last_run: now,
        ai_runs_today: runsToday,
        ai_day_reset: todayUtc,
      }),
    },
  );

  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Gibt einen reservierten Lauf wieder frei — nur fuer Fehler, bei denen uns
 * nichts berechnet wurde (z. B. Anthropic antwortet gar nicht erst).
 */
async function releaseRun(
  supabaseUrl: string,
  serviceKey: string,
  uid: string,
  profile: ProfileRow,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${uid}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({
        ai_last_run: profile.ai_last_run,
        ai_runs_today: profile.ai_runs_today ?? 0,
        ai_day_reset: profile.ai_day_reset,
      }),
    });
  } catch {
    // Best effort — ein nicht freigegebener Lauf ist unschoen, aber harmlos.
  }
}

// ---------------------------------------------------------------------------
// Auth — Token gegen Supabase verifizieren (Signatur + Ablauf)
// ---------------------------------------------------------------------------

/**
 * Prueft das Access-Token beim Supabase-Auth-Server und gibt die User-ID zurueck,
 * oder null wenn das Token ungueltig/abgelaufen ist.
 *
 * Bewusst per /auth/v1/user statt lokaler Signaturpruefung: funktioniert mit
 * HS256 wie mit den neueren asymmetrischen Signing-Keys, ohne JWT-Secret im Env.
 */
async function verifyToken(
  supabaseUrl: string,
  serviceKey: string,
  token: string,
): Promise<string | null> {
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const user: any = await r.json();
    return typeof user?.id === 'string' && user.id ? user.id : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CORS / Supabase helpers
// ---------------------------------------------------------------------------

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sbHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function sbGet(url: string, serviceKey: string, path: string) {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: sbHeaders(serviceKey) });
  if (!r.ok) throw new Error(`supabase GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbPost(url: string, serviceKey: string, path: string, body: any, prefer = 'return=minimal') {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...sbHeaders(serviceKey), Prefer: prefer },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`supabase POST ${path}: ${r.status} ${await r.text()}`);
}

async function sbPatch(url: string, serviceKey: string, path: string, body: any) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(serviceKey), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`supabase PATCH ${path}: ${r.status} ${await r.text()}`);
}

async function sbDelete(url: string, serviceKey: string, path: string) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { ...sbHeaders(serviceKey), Prefer: 'return=minimal' },
  });
  if (!r.ok) throw new Error(`supabase DELETE ${path}: ${r.status} ${await r.text()}`);
}

/**
 * Structured Outputs: Die API garantiert genau ein JSON-Objekt in dieser Form.
 * Ohne Schema haengte das Modell gelegentlich eine "Korrektur" samt zweitem JSON an,
 * und der ganze Lauf scheiterte am Parsen.
 */
const strObj = (fields: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(fields),
  properties: fields,
});
const SYNTHESIS_SCHEMA = strObj({
  new_threads: {
    type: 'array',
    items: strObj({
      id: { type: 'string' },
      title: { type: 'string' },
      summary: { type: 'string' },
      note_ids: { type: 'array', items: { type: 'string' } },
    }),
  },
  thread_updates: {
    type: 'array',
    items: strObj({
      id: { type: 'string' },
      summary: { type: 'string' },
      note_ids: { type: 'array', items: { type: 'string' } },
    }),
  },
  similarities: {
    type: 'array',
    // `reason` steht vor `label`: Das Modell muss erst begruenden, dann benennen.
    // Gespeichert wird es nicht.
    items: strObj({
      thread_id_1: { type: 'string' },
      thread_id_2: { type: 'string' },
      reason: { type: 'string' },
      label: { type: 'string' },
    }),
  },
});

/**
 * Sprache der KI-Ausgabe (Titel, Summary, Label) — analog zum `locale`-Parameter
 * in parse-note.ts. Die Notizen selbst bleiben in der Sprache des Nutzers, nur
 * Titel/Summary/Label sollen zur App-Sprache passen statt immer Deutsch zu sein.
 */
type Locale = 'de' | 'en';

const LOCALE_STRINGS: Record<Locale, { lang: string; titleLen: string }> = {
  de: { lang: 'Deutsch', titleLen: '3-6 Worte' },
  en: { lang: 'English', titleLen: '3-6 words' },
};

function systemPrompt(locale: Locale): string {
  const { lang, titleLen } = LOCALE_STRINGS[locale];
  return `Du bist ein Brainstorm-Synthese-Agent für Velm.
Deine Aufgabe: Neue Notizen (new_notes) thematisch in "Threads" einsortieren und deren Zusammenfassungen schreiben.
Antworte auf ${lang}: Titel, Summary und similarities-Label auf ${lang} — unabhängig davon, in welcher Sprache die Notizen selbst geschrieben sind.

Du erhältst JSON mit:
- new_notes: Notizen, die noch in keinem Thread stecken — nur diese verteilst du
- active_threads: bestehende aktive Threads (id, title, summary, note_titles = Titel der Notizen, die schon drinstecken)
- existing_similarities: die bisherigen Verbindungen zwischen bestehenden Threads
IDs sind kurze Referenzen: Notizen heißen n1, n2, …, bestehende Threads t1, t2, … Verwende sie exakt so.

Antworte NUR mit einem einzigen validen JSON-Objekt, ohne Markdown, ohne Erklärungen. Exaktes Format:
{
  "new_threads": [
    {
      "id": "<eigene Kurz-ID: neu-1, neu-2, …>",
      "title": "Titel (${titleLen}, ${lang})",
      "summary": "Fließtext 2-4 Sätze ${lang}",
      "note_ids": ["<Notiz-ID, z.B. n4>"]
    }
  ],
  "thread_updates": [
    {
      "id": "<Thread-ID aus active_threads, z.B. t2>",
      "summary": "Aktualisierte Summary",
      "note_ids": ["<nur die neu hinzukommenden Notiz-IDs>"]
    }
  ],
  "similarities": [
    {
      "thread_id_1": "<t… oder neu-…>",
      "thread_id_2": "<anderer Thread, t… oder neu-…>",
      "reason": "Ein Satz: Welcher Ordner oder welcher konkrete Bezug verbindet beide?",
      "label": "Oberkategorie (1-3 Worte, ${lang})"
    }
  ]
}

Was ist ein Thread?
Ein Thread = EIN konkretes Vorhaben, Projekt, Problem oder EINE Fragestellung (z.B. "Umzug nach Leipzig", "Idee: Budget-App", "Jobwechsel ja/nein").
- Alles, was dieses eine Vorhaben betrifft, gehört in denselben Thread: Planung, Kosten, Ausrüstung, Probleme und Rückschläge, offene Fragen, nächste Schritte. Ein neuer Aspekt ist KEIN neuer Thread. Auch ein Problem, das im Rahmen eines Vorhabens auftritt (z.B. die Kaution beim Umzug), gehört zu diesem Vorhaben.
- Verschiedene Vorhaben sind verschiedene Threads, auch wenn sie zur selben Kategorie gehören: Zwei verschiedene App-Ideen sind zwei Threads (die du über similarities verbindest), nicht ein gemeinsamer Thread "App-Ideen".
- Eine Notiz gehört zu einem Vorhaben, wenn sie es erkennbar betrifft: Sie nennt es, bezieht sich darauf oder ergibt ohne es keinen Sinn. Gehört sie nur zum selben Lebensbereich, ist sie ein eigenes Vorhaben — benachbarte Themen werden über similarities verbunden, nicht zusammengelegt.
- Erwähnt eine einzelne Notiz zwei Vorhaben (z.B. "Jobwechsel erst nach dem Umzug?"), macht sie daraus nicht ein Vorhaben: Sie kommt in den Thread, zu dem sie am meisten beiträgt, und die beiden Threads werden verbunden.
- Titel-Probe: Nennt ein Titel zwei verschiedene Vorhaben (z.B. "Umzug und Jobwechsel"), sind es zwei Threads. Mehrere Aspekte EINES Vorhabens im Titel sind in Ordnung (z.B. "Umzug: Wohnung und Kaution").
  Stellen die Notizen selbst einen Zusammenhang her (z.B. das eine ist ausdrücklich Voraussetzung für das andere), sind es Aspekte EINES Vorhabens. Einen gemeinsamen Zweck, den die Notizen nicht nennen, denkst du dir nicht dazu.
- Ein Thread ist also weder eine Kategorie (zu grob) noch ein einzelner Aspekt (zu fein).

Schritt 1 — Notizen verteilen. JEDE Notiz landet in GENAU EINEM Thread oder wird ignoriert, niemals in zwei.
- Ignorieren (keinem Thread zuordnen, keinen Thread anlegen):
  - Notizen ohne inhaltliche Aussage (einzelnes Wort, "ok", "ja", "erledigen")
  - Notizen, die nur aus einem Link/einer URL bestehen, ohne eigenen Text dazu
- A) Gehört sie zum Vorhaben eines bestehenden Threads, auch als neuer Aspekt davon (Kosten, Probleme, Details, nächste Schritte)? → in diesen Thread (thread_updates). Dafür KEINEN zusätzlichen neuen Thread anlegen.
  Prüfe dafür title, summary UND note_titles: Eine Notiz nennt ein Vorhaben oft anders als der Thread-Titel (z.B. "die Spar-App" für einen Thread "Budget-Tracker-Idee").
- B) Kein bestehender Thread passt, aber sie gehört zum selben Thema wie andere Notizen aus new_notes? → ein gemeinsamer neuer Thread
- C) Passt nirgends dazu? → eigener neuer Thread
- Passt eine Notiz zu zwei Threads, wähle den, zu dessen Kern sie am meisten beiträgt.
- Kontrolle vor der Antwort: Jede Notiz aus new_notes mit inhaltlicher Aussage steckt in genau einem Thread — notfalls in einem eigenen. Keine note_id darf zweimal vorkommen, weder in zwei new_threads noch in new_threads UND thread_updates.

Schritt 2 — Threads schreiben
- thread_updates nur für Threads, die in diesem Lauf Notizen bekommen. Threads ohne neue Notizen weglassen.
- note_ids in thread_updates = nur die neu hinzukommenden Notizen (die bisherigen bleiben automatisch erhalten)
- Titel neuer Threads: ${titleLen}, ${lang}, deckt das Thema des GANZEN Threads ab, nicht nur der ersten Notiz
- Neue Threads bekommen eigene Kurz-IDs (neu-1, neu-2, …), die du auch in similarities verwendest

Summary-Qualität:
- ${lang}, Fließtext, keine Bullet-Points, 2-4 Sätze
- Nur was in den Notizen steht. Nichts erfinden, ausschmücken oder schlussfolgern, keine Wertungen oder Begründungen, die nicht in den Notizen stehen, und keine Angaben verändern (Zahlen, Bedingungen, Reihenfolgen).
- Verdichten statt nacherzählen: Beginne mit dem Kern (worum geht es, wo steht es), dann die wichtigsten Punkte zusammengefasst. Nicht eine Notiz pro Satz in Eingangsreihenfolge.
- Beschreibe das Thema selbst ("Es geht um …"), nicht die Notizen als Objekte ("Die Notiz sagt …")
- Bei thread_updates die Summary als Ganzes neu schreiben: bisherige Summary + neue Notizen zu EINEM Text verdichten. Nicht die alte Summary übernehmen und einen Satz anhängen. Auch danach höchstens 4 Sätze — fasse Bisheriges knapper, um Platz für Neues zu schaffen; Wichtiges darf nicht verloren gehen. Nur wenn ein Thread ≥5 neue Notizen bekommt, darf ein Satz "Neu hinzugekommen ist …" zusammenfassen, was dazukam.
- Beispiel. Notizen: "Wohnung in der Südstadt besichtigt, zu dunkel" · "Umzugsfirma: Angebot über 900 €" · "Nach dem Umzug 2 Wochen Zeit für die Ummeldung"
  Schlecht (nacherzählt, mit erfundener Wertung): "Eine Wohnung in der Südstadt wurde besichtigt, war aber zu dunkel. Eine Umzugsfirma hat ein Angebot über 900 € gemacht. Die Ummeldung muss innerhalb von zwei Wochen erfolgen. Der Umzug ist ein spannender Neuanfang."
  Gut: "Es geht um den anstehenden Umzug, für den noch die passende Wohnung fehlt – die in der Südstadt war zu dunkel. Für den Transport liegt ein Angebot über 900 € vor, nach dem Einzug bleiben zwei Wochen für die Ummeldung."

Thread-Verbindungen (similarities):
Erkenne thematische Verbindungen zwischen Threads für den Knowledge-Graph. Berücksichtige dabei ALLE Threads — die bestehenden active_threads UND die in diesem Lauf neu erstellten/aktualisierten. Verwende für neue Threads die Kurz-IDs (neu-…), die du oben vergeben hast.
- similarities ist die VOLLSTÄNDIGE Liste aller Verbindungen und ersetzt die bisherige: Übernimm jede Verbindung aus existing_similarities, die weiterhin passt, und ergänze neue. Was du nicht zurückgibst, wird gelöscht.
- Ordner-Test: Stell dir vor, der Nutzer sortiert seine Threads in Ordner für Lebensbereiche, etwa "Projekte & Ideen", "Geld & Finanzen", "Gesundheit & Fitness", "Reisen & Freizeit", "Wohnen", "Arbeit & Beruf", "Familie & Freunde", "Lernen". Zwei Threads, die im selben Ordner landen, verbindest du — auch wenn es verschiedene Vorhaben sind.
- Verbinde außerdem Threads, die sich konkret aufeinander beziehen (z.B. eine Reise zu einem Ereignis, um das es im anderen Thread geht).
- Eine fehlende Verbindung ist genauso ein Fehler wie eine falsche. Bist du unsicher, ob zwei Threads in denselben Ordner gehören, verbinde sie.
- NICHT verbinden, wenn die Gemeinsamkeit nur ein Aspekt ist, der auf fast alles zutrifft ("beide kosten Geld", "beide brauchen Planung", "beide verbessern mich selbst"). Das label ist deshalb nie ein Allgemeinbegriff wie "Ziele", "Planung", "Organisation" oder "Selbstverbesserung".
  Richtig: "Budget-App" ↔ "Vokabeltrainer-Spiel" → "App-Ideen". Falsch: "Morgenroutine" ↔ "Spanisch lernen" → "Selbstverbesserung".
- NICHT verbinden: Threads die hauptsächlich nur eine URL/einen Link enthalten (kein inhaltliches Thema)
- reason: in einem Satz, welcher Ordner oder welcher konkrete Bezug beide verbindet
- label = der gemeinsame Ordner oder Bezug (1-3 Worte, ${lang})
- Jedes Paar nur EINMAL (nicht thread_id_1/thread_id_2 gespiegelt wiederholen)
- Keine sinnvollen Verbindungen? → "similarities": []`;
}

export default async function handler(req: any, res: any) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const locale: Locale = body.locale === 'en' ? 'en' : 'de';

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
      res.status(500).json({
        error: 'missing env',
        have: { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_KEY: !!SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY: !!ANTHROPIC_API_KEY },
      });
      return;
    }

    // user_id aus Supabase JWT — Token MUSS serverseitig verifiziert werden.
    // Ein reiner base64-Decode wäre faelschbar: dieser Endpoint arbeitet mit dem
    // Service-Role-Key, RLS greift hier also nicht.
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) { res.status(401).json({ error: 'missing auth token' }); return; }

    const userId = await verifyToken(SUPABASE_URL, SUPABASE_SERVICE_KEY, token);
    if (!userId) { res.status(401).json({ error: 'invalid token' }); return; }

    // -----------------------------------------------------------------------
    // Rate-limit check
    // -----------------------------------------------------------------------
    const uid = encodeURIComponent(userId);

    const loadProfile = async (): Promise<ProfileRow[] | null> => {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=*`,
        { headers: sbHeaders(SUPABASE_SERVICE_KEY) },
      );
      return r.ok ? r.json() : null;
    };

    // E8: Ist die DB kurz nicht erreichbar, darf daraus keine 7-Tage-Sperre werden.
    let profileRows = await loadProfile();
    if (profileRows === null) { res.status(503).json({ error: 'profile_unavailable' }); return; }

    if (profileRows.length === 0) {
      // Trigger hat noch nicht gegriffen — Row jetzt anlegen und erneut lesen
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: { ...sbHeaders(SUPABASE_SERVICE_KEY), Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ id: userId }),
      });
      profileRows = await loadProfile();
      if (profileRows === null || profileRows.length === 0) { res.status(503).json({ error: 'profile_unavailable' }); return; }
    }

    let profile: ProfileRow = profileRows[0];

    const nextAllowedAt = checkRateLimit(profile);
    if (nextAllowedAt) {
      res.status(429).json({ error: 'limit_reached', next_allowed_at: nextAllowedAt });
      return;
    }

    // Lauf sofort reservieren — schliesst das Read-dann-Write-Fenster, in dem
    // zwei parallele Requests beide den Check oben passieren wuerden.
    let claimed = await claimRun(SUPABASE_URL, SUPABASE_SERVICE_KEY, uid, profile);
    if (!claimed) {
      // A6: Claim-Race verloren → Profil frisch lesen und genau einmal erneut versuchen.
      const fresh = await loadProfile();
      if (fresh && fresh.length > 0) {
        profile = fresh[0];
        const limited = checkRateLimit(profile);
        if (limited) { res.status(429).json({ error: 'limit_reached', next_allowed_at: limited }); return; }
        claimed = await claimRun(SUPABASE_URL, SUPABASE_SERVICE_KEY, uid, profile);
      }
      if (!claimed) {
        // Zweimal verloren: kein echtes Limit, sondern Ueberlappung — kurz warten lassen.
        res.status(429).json({
          error: 'busy',
          next_allowed_at: new Date(Date.now() + 10_000).toISOString(),
        });
        return;
      }
    }

    // Ab hier ist der Lauf gebucht. Entscheidung 2 / O1: Fehler auf UNSERER
    // Seite (Netz, KI-Antwort unbrauchbar, DB) geben den Lauf zurueck; "keine
    // Notizen" und ein erfolgreich geschriebenes Ergebnis verbrauchen ihn.
    let consumed = false;
    try {
      const [allFeedNotes, activeThreads, threadNoteIds, existingLinks] = await Promise.all([
        sbGet(SUPABASE_URL, SUPABASE_SERVICE_KEY,
          `notes?user_id=eq.${uid}&feeds_threads=eq.true&archived_at=is.null&order=created_at.asc&select=id,title,content,created_at,updated_at`),
        sbGet(SUPABASE_URL, SUPABASE_SERVICE_KEY,
          `threads?user_id=eq.${uid}&status=eq.active&order=updated_at.desc&select=id,title,summary,thought_count,note_ids,updated_at`),
        sbGet(SUPABASE_URL, SUPABASE_SERVICE_KEY,
          `threads?user_id=eq.${uid}&select=note_ids`),
        sbGet(SUPABASE_URL, SUPABASE_SERVICE_KEY,
          `thread_similarities?user_id=eq.${uid}&select=thread_id_1,thread_id_2,label`),
      ]);

      // Nur Notizen, die noch in keinem Thread stecken (auch keinem archivierten),
      // gehen an das Modell. Muss es neue Notizen selbst aus allen heraussuchen,
      // sortiert es bereits einsortierte regelmaessig ein zweites Mal ein.
      const assignedBefore = new Set<string>(threadNoteIds.flatMap((t: any) => t.note_ids ?? []));
      const feedNotes = allFeedNotes.filter((n: any) => !assignedBefore.has(n.id));

      if (!allFeedNotes.length) {
        consumed = true;
        res.status(200).json({ message: 'no_feed_notes', threads_created: 0, threads_updated: 0 });
        return;
      }
      if (!feedNotes.length) {
        // Alles schon einsortiert: kein KI-Aufruf, also auch kein verbrauchter Lauf.
        await releaseRun(SUPABASE_URL, SUPABASE_SERVICE_KEY, uid, profile);
        consumed = true;
        res.status(200).json({ message: 'no_new_notes', threads_created: 0, threads_updated: 0 });
        return;
      }

      // Das Modell sieht nur kurze Referenzen (n1, t1), keine UUIDs: Lange IDs abzuschreiben
      // oder fuer neue Threads selbst zu erfinden fuehrte zu Verwechslungen und ungueltigen
      // UUIDs, an denen der ganze Lauf scheiterte. Zurueckuebersetzt wird beim Schreiben.
      const noteIdByRef = new Map<string, string>();
      feedNotes.forEach((n: any, i: number) => noteIdByRef.set(`n${i + 1}`, n.id));
      const threadIdByRef = new Map<string, string>();
      const refByThreadId = new Map<string, string>();
      activeThreads.forEach((t: any, i: number) => {
        threadIdByRef.set(`t${i + 1}`, t.id);
        refByThreadId.set(t.id, `t${i + 1}`);
      });

      // Bestehende Threads bekommen die Titel ihrer Notizen als Kontext: Nennt eine neue
      // Notiz ein Vorhaben anders als der Thread-Titel ("Kuehlschrank-App" vs. "Rezept-App"),
      // findet das Modell den Thread sonst nicht und spaltet einen neuen ab.
      const noteById = new Map<string, any>(allFeedNotes.map((n: any) => [n.id, n]));
      const noteTitle = (n: any) => {
        const text = (n.title || n.content || '').trim().replace(/\s+/g, ' ');
        return text.length > 60 ? `${text.slice(0, 60)}…` : text;
      };

      // Anthropic API
      const input = JSON.stringify({
        new_notes: feedNotes.map((n: any, i: number) => ({ ...n, id: `n${i + 1}` })),
        active_threads: activeThreads.map((t: any, i: number) => ({
          id: `t${i + 1}`,
          title: t.title,
          summary: t.summary,
          note_titles: (t.note_ids ?? [])
            .map((id: string) => noteById.get(id))
            .filter(Boolean)
            .slice(-15)
            .map(noteTitle),
        })),
        // Die Verbindungen werden bei jedem Lauf komplett neu geschrieben. Ohne die
        // bestehenden im Blick vergass das Modell sie und gute Verbindungen verschwanden.
        existing_similarities: existingLinks
          .filter((s: any) => refByThreadId.has(s.thread_id_1) && refByThreadId.has(s.thread_id_2))
          .map((s: any) => ({
            thread_id_1: refByThreadId.get(s.thread_id_1),
            thread_id_2: refByThreadId.get(s.thread_id_2),
            label: s.label,
          })),
      });
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 4096,
          system: systemPrompt(locale),
          messages: [{ role: 'user', content: input }],
          output_config: { format: { type: 'json_schema', schema: SYNTHESIS_SCHEMA } },
        }),
      });

      if (!anthropicRes.ok) {
        console.error('[synthesize] anthropic', anthropicRes.status, await anthropicRes.text().catch(() => ''));
        throw new SynthesisError('ai_unavailable');
      }

      const anthropicData: any = await anthropicRes.json();
      // Erster Textblock, nicht blind content[0]: Bei Modellen mit Thinking steht davor ein thinking-Block.
      const rawText: string = (anthropicData.content ?? []).find((b: any) => b?.type === 'text')?.text ?? '';

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[synthesize] no JSON in AI response', rawText.slice(0, 300));
        throw new SynthesisError('ai_response_invalid');
      }

      let synthesis: { new_threads?: any[]; thread_updates?: any[]; similarities?: any[] };
      try {
        synthesis = JSON.parse(jsonMatch[0]);
      } catch (e: any) {
        console.error('[synthesize] JSON parse error', e?.message, rawText.slice(0, 300));
        throw new SynthesisError('ai_response_invalid');
      }

      // Ergebnisse schreiben
      const now = new Date().toISOString();
      let threads_created = 0;
      let threads_updated = 0;

      // Keine Notiz darf beim Schreiben verloren gehen: Wir halten pro bestehendem
      // Thread fest, welche Notizen dazukommen, und vereinigen sie am Ende mit dem
      // aktuellen Bestand. Die KI kann einem Thread so Notizen geben, aber nie nehmen.
      const activeById = new Map<string, any>(activeThreads.map((t: any) => [t.id, t]));
      const activeByTitle = new Map<string, any>(activeThreads.map((t: any) => [t.title, t]));
      const addedNoteIds = new Map<string, string[]>();
      const summaries = new Map<string, string>();
      const addNotes = (threadId: string, noteIds: string[]) => {
        addedNoteIds.set(threadId, [...(addedNoteIds.get(threadId) ?? []), ...noteIds]);
      };

      // Jede Notiz landet in hoechstens einem Thread. Bestehende Threads werden zuerst
      // bedient: Steckt die KI eine Notiz zusaetzlich in einen neuen Thread, gewinnt
      // der bestehende. Unbekannte Referenzen (vom Modell erfunden) fallen weg.
      const assigned = new Set<string>();
      const claimNotes = (refs: unknown): string[] => (Array.isArray(refs) ? refs : [])
        .map((r) => noteIdByRef.get(String(r)))
        .filter((id): id is string => !!id && !assigned.has(id) && !!assigned.add(id));

      // Thread-Updates — nur fuer aktive Threads, die die KI auch gesehen hat.
      for (const u of synthesis.thread_updates ?? []) {
        const id = threadIdByRef.get(String(u.id));
        if (!id || !activeById.has(id)) continue;
        addNotes(id, claimNotes(u.note_ids));
        if (typeof u.summary === 'string' && u.summary.trim()) summaries.set(id, u.summary);
      }

      // Neue Threads — gleicher Titel oder gleiche ID wie ein aktiver Thread:
      // Notizen dort einhaengen statt den Thread (und damit die Notizen) zu verwerfen.
      // Die UUID vergibt immer der Server; die Kurz-ID des Modells zeigt fuer
      // `similarities` auf sie. Bleibt keine Notiz uebrig, entfaellt der Thread.
      const toInsert: any[] = [];
      for (const t of synthesis.new_threads ?? []) {
        const noteIds = claimNotes(t.note_ids);
        const ref = t.id == null ? null : String(t.id);
        const existingThread = activeById.get(threadIdByRef.get(ref ?? '') ?? '') ?? activeByTitle.get(t.title);
        if (existingThread) {
          addNotes(existingThread.id, noteIds);
          if (ref && !threadIdByRef.has(ref)) threadIdByRef.set(ref, existingThread.id);
          continue;
        }
        if (!noteIds.length) continue;
        const id = randomUUID();
        if (ref) threadIdByRef.set(ref, id);
        toInsert.push({
          id,
          user_id: userId,
          title: t.title,
          summary: t.summary ?? '',
          status: 'active',
          thought_count: noteIds.length,
          note_ids: noteIds,
          last_synthesized_at: now,
          created_at: now,
          updated_at: now,
        });
      }

      if (toInsert.length > 0) {
        await sbPost(SUPABASE_URL, SUPABASE_SERVICE_KEY, 'threads', toInsert, 'resolution=merge-duplicates,return=minimal');
        threads_created = toInsert.length;
      }

      for (const [id, added] of addedNoteIds) {
        if (!added.length) continue; // ohne neue Notiz kein Umschreiben
        const noteIds = [...new Set<string>([...(activeById.get(id).note_ids ?? []), ...added])];
        const patch: any = {
          user_id: userId,
          note_ids: noteIds,
          thought_count: noteIds.length,
          last_synthesized_at: now,
          updated_at: now,
        };
        if (summaries.has(id)) patch.summary = summaries.get(id);
        await sbPatch(SUPABASE_URL, SUPABASE_SERVICE_KEY,
          `threads?user_id=eq.${uid}&id=eq.${encodeURIComponent(id)}&status=eq.active`, patch);
        threads_updated++;
      }

      // -----------------------------------------------------------------------
      // Thread-Verbindungen (similarities) — komplett neu aufbauen
      // -----------------------------------------------------------------------
      let similarities_written = 0;
      const allThreads: any[] = await sbGet(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `threads?user_id=eq.${uid}&status=eq.active&select=id`,
      );
      const validIds = new Set<string>(allThreads.map((t: any) => t.id));

      const seenPairs = new Set<string>();
      const simRows = (synthesis.similarities ?? [])
        .map((s: any) => ({
          a: threadIdByRef.get(String(s.thread_id_1)),
          b: threadIdByRef.get(String(s.thread_id_2)),
          label: s.label ?? '',
        }))
        .filter(({ a, b }) => {
          if (!a || !b || a === b) return false;
          if (!validIds.has(a) || !validIds.has(b)) return false;
          const key = [a, b].sort().join('|');
          if (seenPairs.has(key)) return false;
          seenPairs.add(key);
          return true;
        })
        .map(({ a, b, label }) => ({
          user_id: userId,
          thread_id_1: a,
          thread_id_2: b,
          label,
        }));

      await sbDelete(SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `thread_similarities?user_id=eq.${uid}`);
      if (simRows.length > 0) {
        await sbPost(SUPABASE_URL, SUPABASE_SERVICE_KEY, 'thread_similarities', simRows);
        similarities_written = simRows.length;
      }

      consumed = true;
      res.status(200).json({ ok: true, threads_created, threads_updated, similarities_written });
    } catch (e: any) {
      if (!consumed) await releaseRun(SUPABASE_URL, SUPABASE_SERVICE_KEY, uid, profile);
      const code = e instanceof SynthesisError ? e.code : 'synthesis_failed';
      if (!(e instanceof SynthesisError)) console.error('[synthesize] failed', e?.message || e);
      res.status(500).json({ error: code });
    }
  } catch (e: any) {
    // X2: keine internen Details an den Client
    console.error('[synthesize] crash', e?.message || e);
    try { res.status(500).json({ error: 'internal' }); }
    catch { res.status(500).end('internal'); }
  }
}

/** Fehler, deren Code an den Client darf (ohne Rohdaten). */
class SynthesisError extends Error {
  constructor(public code: 'ai_unavailable' | 'ai_response_invalid') { super(code); }
}
