# Plan: NotizApp → BrainstormApp

## Context

Du verlierst flüchtige Gedanken, weil du sie nicht schnell genug festhalten kannst — und wenn du sie aufschreibst, fehlen die Verbindungen zwischen ihnen. Eine flache Notiz-Liste löst keines der beiden Probleme.

Wir bauen die bestehende NotizApp so um, dass **Brainstorming das Hauptthema** wird:
- **Capture (Problem 1):** Reibungsarme Erfassung über Sprachaufnahme + Quick-Add. Die bestehende Notiz-App wird zum reinen "Inbox-Eingang", der Gedanken in die DB schiebt.
- **Connect (Problem 2):** Eine KI-Pipeline gruppiert verwandte Gedanken automatisch zu **Threads** (z.B. „App-Idee Brainstorm", „Philosophie zu Zeit") und generiert pro Thread eine wachsende Zusammenfassung. Du siehst nicht mehr einzelne Notizen, sondern lebende Gedanken-Stränge.

Die bestehende Notiz-Funktionalität bleibt funktionsfähig (kein Pivot, kein Risiko), aber sie wird der zweite Tab — der Brainstorm-Bereich kommt nach vorne.

---

## Antwort auf deine Kostenfrage (wichtig)

**Kurz:** Ja, das geht ohne API-Kosten über dein Pro-Abo hinaus. Aber: Dein Claude.ai-Pro-Abo erlaubt **keinen direkten API-Zugang** für Code — die Anthropic-API wird separat per Token abgerechnet. Es gibt aber drei kostenlose Wege, die alle innerhalb deines Abos bleiben:

| Option | Wie | Vorteil | Nachteil |
|---|---|---|---|
| **A. Claude Code Cron (Empfohlen)** | Lokaler Cron-Job auf deinem PC, der Claude Code (Pro-Abo) regelmäßig anweist, deine Gedanken aus Supabase zu lesen, Threads zu bilden und zurückzuschreiben | Volles Opus-Modell, keine Token-Limits, null Setup mit fremdem API-Key | Läuft nur wenn dein PC läuft (Threads aktualisieren sich z.B. einmal pro Stunde, nicht in Echtzeit) |
| **B. Gemini Free Tier** | Vercel-Endpoint im `bridge/`-Ordner ruft Google Gemini Flash auf (kostenloser Tier: ~1500 Anfragen/Tag) | Immer verfügbar, auch wenn PC aus ist | Anderes Modell, separater API-Key, Rate-Limit |
| **C. Lokale Embeddings** | sentence-transformers im Vercel-Endpoint clustert nach semantischer Ähnlichkeit ohne LLM | Fully free, fully cloud | Keine echten Zusammenfassungen, nur Gruppierung |

**Empfehlung für den MVP:** **Option A (Claude Code Cron)** alleine. Begründung:
- Latenz ist für „Gedanken" kein Problem — eine Aktualisierung pro Stunde reicht für die Verknüpfungs-Erkennung absolut.
- Du nutzt die volle Power von Claude Opus, das beim Synthetisieren deutlich besser ist als Gemini Flash.
- Null neue Accounts, null neue Secrets, null Risiko Free-Tier-Limit zu überschreiten.
- Dein bestehendes `bridge/`-Pattern zeigt, dass du mit dieser Art von Automation komfortabel bist.

In einer späteren Ausbaustufe kannst du Option B als „Instant-Refresh"-Button auf dem Handy ergänzen, wenn du dort sofort neue Verknüpfungen sehen willst.

---

## Architektur-Übersicht

```
┌─────────────────────────────────────────────┐
│  Mobile App (Expo/RN)                       │
│  ┌──────────┐  ┌─────────┐  ┌────────────┐  │
│  │ Threads  │  │ Inbox   │  │ Capture    │  │
│  │ (neu,    │  │ (alte   │  │ FAB        │  │
│  │ primär)  │  │ Notizen)│  │ Voice/Text │  │
│  └────┬─────┘  └────┬────┘  └─────┬──────┘  │
└───────┼─────────────┼─────────────┼─────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────┐
│  Supabase (bestehend, erweitert)            │
│  • notes (bestehend → wird "Inbox")         │
│  • thoughts (neu, atomare Gedanken)         │
│  • threads (neu, KI-gebildete Gruppen)      │
│  • thought_threads (neu, M:N-Verknüpfung)   │
└──────────────┬──────────────────────────────┘
               │
               │ liest neue thoughts, schreibt threads
               ▼
┌─────────────────────────────────────────────┐
│  Brainstorm-Worker (lokal, dein PC)         │
│  • Claude Code Cron alle 1h                 │
│  • Skill: liest neue thoughts → clustered → │
│    schreibt threads + Zusammenfassung       │
└─────────────────────────────────────────────┘
```

---

## Datenmodell

### Neue Supabase-Tabellen ([supabase-schema.sql](NotizApp/supabase-schema.sql) erweitern)

```sql
-- Atomare Gedanken (separat von "notes" um die alte Funktion nicht zu brechen)
create table if not exists public.thoughts (
  id uuid primary key,
  device_id text not null,
  content text not null,
  source text not null default 'app', -- 'app' | 'voice' | 'share' | 'bridge'
  raw_audio_url text,                  -- optional, wenn Sprachaufnahme behalten
  created_at timestamptz not null default now(),
  processed_at timestamptz,            -- wann hat der Worker den Gedanken gesehen
  embedding vector(384)                -- optional, für spätere Embeddings
);
create index thoughts_device_idx on public.thoughts (device_id, created_at desc);
create index thoughts_unprocessed_idx on public.thoughts (device_id) where processed_at is null;

-- KI-gebildete Threads
create table if not exists public.threads (
  id uuid primary key,
  device_id text not null,
  title text not null,
  summary text not null default '',
  status text not null default 'active', -- 'active' | 'archived'
  thought_count int not null default 0,
  last_synthesized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index threads_device_idx on public.threads (device_id, updated_at desc);

-- M:N Verknüpfung (ein Gedanke kann zu mehreren Threads gehören)
create table if not exists public.thought_threads (
  thought_id uuid not null references public.thoughts(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  relevance real default 1.0,
  primary key (thought_id, thread_id)
);

alter publication supabase_realtime add table public.thoughts;
alter publication supabase_realtime add table public.threads;

-- RLS analog zu notes (permissive für single-device)
alter table public.thoughts enable row level security;
alter table public.threads enable row level security;
alter table public.thought_threads enable row level security;
create policy "all" on public.thoughts for all using (true) with check (true);
create policy "all" on public.threads for all using (true) with check (true);
create policy "all" on public.thought_threads for all using (true) with check (true);
```

> **Hinweis zum `vector(384)` Feld:** Optional. Erfordert die `pgvector`-Extension in Supabase (`create extension vector;`). Für den MVP nicht zwingend nötig, weil der Claude-Code-Worker direkt clustert. Lass das Feld weg, wenn du keinen Aufwand willst.

### Neue TypeScript-Modelle ([NotizApp/src/models/](NotizApp/src/models/))

Neue Datei `Thought.ts`:
```typescript
export interface Thought {
  id: string;
  content: string;
  source: 'app' | 'voice' | 'share' | 'bridge';
  rawAudioUrl: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Thread {
  id: string;
  title: string;
  summary: string;
  status: 'active' | 'archived';
  thoughtCount: number;
  lastSynthesizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadWithThoughts extends Thread {
  thoughts: Thought[];
}
```

---

## Code-Änderungen pro Bereich

### 1. Sync-Layer (Mirror des bestehenden Patterns)

Neue Datei [NotizApp/src/sync/remoteThoughts.ts](NotizApp/src/sync/remoteThoughts.ts) — analog zu [NotizApp/src/sync/remoteNotes.ts](NotizApp/src/sync/remoteNotes.ts):
- `pullThoughts(deviceId)`, `insertThought(deviceId, thought)`, `subscribeThoughts(deviceId, onInsert)`
- `pullThreads(deviceId)`, `subscribeThreads(deviceId, onChange)` (auch UPDATE-Events, nicht nur INSERT — Threads wachsen)
- `getThreadWithThoughts(threadId)` für die Detail-Ansicht

Wichtig: Das bestehende `subscribeRemote` in [remoteNotes.ts:95-123](NotizApp/src/sync/remoteNotes.ts#L95-L123) ist unser Vorbild — gleiche Channel-Pattern, aber `event: '*'` statt `'INSERT'` für Threads.

### 2. State-Management

Neue Datei [NotizApp/src/context/ThoughtsContext.tsx](NotizApp/src/context/ThoughtsContext.tsx):
- Spiegelt den Aufbau von [NotesContext.tsx](NotizApp/src/context/NotesContext.tsx) (lokales State + AsyncStorage + Supabase Realtime)
- Methoden: `addThought(content, source)`, `archiveThread(id)`, `refreshThreads()`
- AsyncStorage-Keys: `@brainstorm_thoughts`, `@brainstorm_threads`, `@brainstorm_thought_threads`

In [App.tsx:38](NotizApp/App.tsx#L38) den `<NotesProvider>` zu `<NotesProvider><ThoughtsProvider>` schachteln.

### 3. Capture-Layer (zwei Eingabe-Wege)

#### a) Sprachaufnahme + on-device Transkript
- Dependencies: `expo-av` (Aufnahme) + `@react-native-voice/voice` (kostenloses on-device Speech-to-Text via OS)
- Neue Komponente [NotizApp/src/components/VoiceCaptureSheet.tsx](NotizApp/src/components/VoiceCaptureSheet.tsx): Bottom-Sheet mit großem Mikro-Button, Live-Transkript, "Speichern" → `addThought(transcript, 'voice')`
- Kein Whisper-API-Call → null Kosten, läuft komplett lokal auf dem Handy

#### b) Quick-Text via Share-Sheet
- Expo Module: `expo-share-extension` (iOS/Android Share-Target)
- Wenn User aus jeder anderen App "Teilen" → "Brainstorm" wählt, wird Text als neuer Thought gespeichert
- Kein Home-Screen-Widget im MVP (das verlangt Custom Native Code in Expo, sehr aufwändig)

#### c) Floating-Action-Button in der App
- Neue Komponente [NotizApp/src/components/QuickCaptureFAB.tsx](NotizApp/src/components/QuickCaptureFAB.tsx) — globaler Button auf jedem Screen, der das Voice-Sheet öffnet
- Tap = Voice, Long-Press = Text-Input

### 4. UI/Navigation-Umbau

[NotizApp/src/navigation/AppNavigator.tsx](NotizApp/src/navigation/AppNavigator.tsx) — `HomeTabs` umstrukturieren:

```
NEU:                    BISHER:
┌──────────────┐        ┌──────────────┐
│ 1. Threads ★ │        │ 1. Notizen   │
│ 2. Inbox     │   →    │ 2. Archiv    │
│ 3. Archiv    │        │ 3. Settings  │
│ 4. Settings  │        └──────────────┘
└──────────────┘
```

- "Threads" wird Tab #1 (Standard-Landing) — neuer Screen [NotizApp/src/screens/ThreadsScreen.tsx](NotizApp/src/screens/ThreadsScreen.tsx)
- "Notizen" wird zu "Inbox" umbenannt (`Tab.Screen name="Inbox"` in [AppNavigator.tsx:51](NotizApp/src/navigation/AppNavigator.tsx#L51)) — bestehender HomeScreen bleibt unverändert
- Neuer Screen [NotizApp/src/screens/ThreadDetailScreen.tsx](NotizApp/src/screens/ThreadDetailScreen.tsx) — zeigt Thread-Title, KI-Summary oben, dann chronologische Liste aller verknüpften Thoughts darunter
- Stack im Root-Navigator um `ThreadDetail` ergänzen ([AppNavigator.tsx:101-116](NotizApp/src/navigation/AppNavigator.tsx#L101-L116))

`ThreadsScreen` ist optisch eine vertikale Liste von Karten, jede Karte zeigt: Thread-Title (groß), erste 2 Zeilen Summary, "X Gedanken · Y neu", letzte Aktualisierung. Wiederverwendbar: das bestehende [GradientCard.tsx](NotizApp/src/components/GradientCard.tsx) als Container.

### 5. Brainstorm-Worker (das KI-Herz, lokal auf deinem PC)

**Setup:** Ein Claude Code Cron-Job, der alle 60 Minuten via dein Pro-Abo läuft. Dafür gibt es die Tools `CronCreate` / `schedule` in deiner Claude Code Umgebung.

Neue Datei [NotizApp/bridge/worker/brainstorm-prompt.md](NotizApp/bridge/worker/brainstorm-prompt.md) — ein Markdown-File, das der Cron-Job als Prompt an Claude Code übergibt. Inhalt sinngemäß:

```markdown
Du bist mein Brainstorm-Synthese-Agent. Mache folgendes:

1. Lies alle Thoughts aus Supabase (Tabelle `thoughts`) wo `processed_at IS NULL`.
2. Lies alle aktiven Threads (Tabelle `threads` mit `status='active'`).
3. Für jeden neuen Thought:
   a) Entscheide, ob er in einen bestehenden Thread passt (Title + Summary lesen).
   b) Wenn ja: füge ihn zu `thought_threads` hinzu, aktualisiere Thread-Summary
      so dass sie den neuen Gedanken integriert.
   c) Wenn nein, aber er hat Bezug zu anderen unprocessed Thoughts: erstelle einen
      neuen Thread.
   d) Wenn er völlig isoliert ist: leg einen Single-Thought-Thread an mit 
      "Entwurf"-Status, damit er nicht verloren geht.
4. Markiere jeden verarbeiteten Thought mit `processed_at = now()`.
5. Optional: Wenn ein Thread > 5 neue Thoughts hat, schreibe eine kurze 
   "Was hier neu hinzugekommen ist"-Notiz in das Summary.
```

**Setup-Skript:** Ein einmaliger Bash-Skript [NotizApp/bridge/worker/setup-cron.sh](NotizApp/bridge/worker/setup-cron.sh) der den Claude Code Cron registriert. Nutzt das `CronCreate` Tool / `schedule` Skill der Claude Code Umgebung.

**Trigger-Endpoint (optional, später):** Ein neuer Vercel-Endpoint [NotizApp/bridge/api/synthesize.ts](NotizApp/bridge/api/synthesize.ts) — analog zu [bridge/api/note.ts](NotizApp/bridge/api/note.ts) aufgebaut — der vom Handy aus per Button getriggert werden kann (z.B. „Jetzt synthetisieren"). Für den MVP **weglassen**, der Cron reicht.

---

## Workflow-Regeln (zwischen User & Claude vereinbart)

- **Ein Slice nach dem anderen.** Erst wenn Slice N getestet und in main gemerged ist, beginnt Slice N+1.
- **Branch pro Slice.** Naming: `slice-1-data-foundation`, `slice-2-capture`, `slice-3-threads-ui`, `slice-4-worker`, `slice-5-polish`. Branch wird vom aktuellen `main` abgezweigt.
- **Check-in nach jedem Slice.** Sobald Claude einen Slice für fertig hält, meldet sich Claude im Chat mit „Slice X fertig — hier ist was zu testen" und einer kurzen Test-Anleitung. Erst nach gemeinsamem Test + User-OK wird der Branch in main gemerged.
- **Kein Slice-Skip, keine parallelen Slices.** Auch wenn ein Slice klein wirkt: Branch + Test + Merge bleibt der Loop.

## Implementation Order (MVP-Slices, jede Slice ist testbar)

1. **Slice 1 — Daten-Fundament**
   - Supabase-Schema erweitern (3 neue Tabellen)
   - `Thought.ts` Modell anlegen
   - `remoteThoughts.ts` Sync-Layer
   - `ThoughtsContext.tsx` Provider
   - In `App.tsx` einbinden
   - **Test:** Manuell einen Eintrag in Supabase einfügen → Realtime-Update kommt in der App an (mit `console.log`)

2. **Slice 2 — Capture-Layer**
   - `QuickCaptureFAB.tsx` Komponente
   - `VoiceCaptureSheet.tsx` mit `expo-av` + `@react-native-voice/voice`
   - FAB in den bestehenden HomeScreen einbauen, damit du sofort testen kannst
   - **Test:** Knopf drücken, sprechen, Transkript sehen, speichern → erscheint in Supabase

3. **Slice 3 — Threads-UI**
   - `ThreadsScreen.tsx` (Liste, vorerst leer)
   - `ThreadDetailScreen.tsx`
   - Navigation umbauen (Threads als Tab #1)
   - **Test:** Tab existiert, ist leer (weil Worker noch nicht läuft)

4. **Slice 4 — Brainstorm-Worker**
   - `brainstorm-prompt.md` schreiben
   - Cron-Job manuell einmal laufen lassen, prüfen ob Threads erzeugt werden
   - Cron registrieren (z.B. stündlich)
   - **Test:** 5-10 Test-Thoughts manuell anlegen, Worker laufen lassen, Threads in der App sehen

5. **Slice 5 — Polish**
   - Share-Sheet (`expo-share-extension`) für Quick-Text aus anderen Apps
   - Inbox-Tab umbenennen
   - Pinning/Archiv für Threads
   - Eventuell: Manuell-Button „Thought zu Thread hinzufügen" für Edge-Cases

---

## Kritische Dateien (zum Bearbeiten)

| Datei | Was passiert |
|---|---|
| [NotizApp/supabase-schema.sql](NotizApp/supabase-schema.sql) | 3 Tabellen + RLS + Realtime-Publikation hinzufügen |
| [NotizApp/src/models/Note.ts](NotizApp/src/models/Note.ts) | NEU danebenstellen: `src/models/Thought.ts` |
| [NotizApp/src/sync/remoteNotes.ts](NotizApp/src/sync/remoteNotes.ts) | NEU danebenstellen: `src/sync/remoteThoughts.ts` |
| [NotizApp/src/context/NotesContext.tsx](NotizApp/src/context/NotesContext.tsx) | NEU danebenstellen: `src/context/ThoughtsContext.tsx` |
| [NotizApp/App.tsx](NotizApp/App.tsx#L38) | `<ThoughtsProvider>` einschachteln |
| [NotizApp/src/navigation/AppNavigator.tsx](NotizApp/src/navigation/AppNavigator.tsx) | Tab-Reihenfolge ändern, Threads als Tab #1, ThreadDetail in Stack |
| [NotizApp/src/screens/](NotizApp/src/screens/) | NEU: `ThreadsScreen.tsx`, `ThreadDetailScreen.tsx` |
| [NotizApp/src/components/](NotizApp/src/components/) | NEU: `QuickCaptureFAB.tsx`, `VoiceCaptureSheet.tsx`, `ThreadCard.tsx` |
| [NotizApp/bridge/worker/](NotizApp/bridge/) | NEU: `brainstorm-prompt.md`, `setup-cron.sh` |
| [NotizApp/package.json](NotizApp/package.json) | Neue Deps: `expo-av`, `@react-native-voice/voice`, später `expo-share-extension` |

## Wiederverwendbare bestehende Bausteine

- [GradientCard.tsx](NotizApp/src/components/GradientCard.tsx) als Container für Thread-Karten
- [supabaseClient.ts](NotizApp/src/sync/supabaseClient.ts) Sync-Pattern + `isSyncConfigured()` Check
- [getDeviceId()](NotizApp/src/sync/deviceId.ts) für die device_id (gleicher Wert wie für Notes)
- [haptics.ts](NotizApp/src/utils/haptics.ts) für Touch-Feedback in Capture-Flow
- [theme.ts](NotizApp/src/theme/theme.ts) Dark-Mode Farben
- Das gesamte Sync-Pattern aus [NotesContext.tsx:50-141](NotizApp/src/context/NotesContext.tsx#L50-L141) ist 1:1 als Vorlage für ThoughtsContext nutzbar

---

## Verification (Wie wir wissen, dass es funktioniert)

### Smoke-Test pro Slice
- **Nach Slice 1:** Direkt in der Supabase Web-Console einen Eintrag in `thoughts` machen, in der App Console-Log sehen, dass Realtime ihn empfängt.
- **Nach Slice 2:** Voice-FAB drücken, „Das ist ein Test-Gedanke" sagen, Speichern, in Supabase sehen.
- **Nach Slice 3:** Threads-Tab öffnet sich ohne Fehler (Liste leer ist OK).
- **Nach Slice 4:** Manuell 5 thematisch zusammenhängende Thoughts via Voice eingeben, Worker laufen lassen, prüfen dass mindestens 1 Thread mit ≥2 Thoughts entstanden ist.
- **Nach Slice 5:** Aus Browser/anderer App Text teilen → erscheint im nächsten Synthese-Lauf in einem Thread.

### End-to-End "Echter Tag"-Test
1. Über 24h hinweg jeden Gedanken den du hast direkt einsprechen (Voice-FAB)
2. Stündlicher Cron läuft im Hintergrund
3. Am nächsten Morgen Threads-Tab öffnen
4. **Erfolgs-Kriterium:** Mindestens 1 Thread enthält mehrere Gedanken, die du selbst nicht aktiv miteinander verknüpft hast — die KI hat eine Verbindung erkannt, die für dich Sinn ergibt.

### Was wir explizit NICHT bauen (Scope-Schutz)
- Kein Multi-User / kein Auth-Umbau (RLS bleibt permissive, single-device)
- Kein Graph-View (du hast AI-Threads gewählt)
- Keine Whisper-API (on-device Voice reicht)
- Kein Native-Widget (zu aufwändig in Expo, Share-Sheet ist die pragmatische Alternative)
- Kein Gemini / kein Anthropic-API-Call aus der App heraus (nur Claude Code Cron lokal)
- Keine Migration der bestehenden Notes zu Thoughts (sie bleiben in `notes`, sind die Inbox)
