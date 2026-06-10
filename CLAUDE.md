# NotizApp – CLAUDE.md

> **Meta:** After every significant code change, update this file to reflect the new state.
> Keep it under 200 lines — compress or merge sections if it grows beyond that.

## Project Overview

NotizApp is a German-language note-taking mobile app built with React Native / Expo.
It supports notes with checklists, categories, reminders, pinning, archiving, and
optional Supabase sync across devices. A secondary "Thoughts/Brainstorm" feature
(atomare Gedanken → Threads) lives alongside the main notes flow.

A companion **bridge** Vercel serverless API (`bridge/`) exposes note data via HTTP
and a browser bookmarklet. A **webapp** (`webapp/`) is a Next.js graph visualizer
for notes and threads.

---

## Repository Layout

```
c:/NotizApp/
├── NotizApp/              # Main Expo app (primary working directory)
│   ├── App.tsx            # Root component, provider tree
│   ├── src/
│   │   ├── components/    # FilterBar, GradientCard, NoteCard,
│   │   │                  #   QuickCaptureFAB, VoiceCaptureSheet
│   │   ├── context/       # NotesContext, ThoughtsContext, ThemeContext
│   │   ├── models/        # Note.ts, Thought.ts (pure TypeScript types)
│   │   ├── navigation/    # AppNavigator (Stack + BottomTabs)
│   │   ├── screens/       # HomeScreen, EditorScreen, NoteDetailScreen,
│   │   │                  #   ArchiveScreen, SettingsScreen,
│   │   │                  #   ThreadsScreen, ThreadDetailScreen
│   │   ├── storage/       # noteStorage.ts, thoughtStorage.ts (AsyncStorage)
│   │   ├── sync/          # supabaseClient, remoteNotes, remoteThoughts, deviceId
│   │   ├── theme/         # theme.ts, typography.ts, categoryAccents.ts, gradients.ts
│   │   └── utils/         # notifications, haptics, …
│   ├── bridge/            # Vercel serverless bridge API + worker
│   │   ├── api/           # Serverless functions (note.ts, thought.ts)
│   │   ├── bookmarklet/   # Browser bookmarklet source
│   │   └── worker/        # brainstorm-worker.mjs, similarity-worker.mjs (CLI-Helfer)
│   └── webapp/            # Next.js 16 graph visualizer (standalone)
│       ├── app/           # page.tsx (force-graph UI), api/graph/route.ts
│       ├── components/    # Graph.tsx, NoteOverlay.tsx, SimilarityOverlay.tsx,
│       │                  #   ThreadPanel.tsx
│       ├── lib/           # supabase.ts
│       └── types/         # GraphData, Thread, Note, Similarity
└── README.md
```

---

## Tech Stack

| Layer | Library/Tool |
|---|---|
| Framework | React Native 0.81, Expo SDK 54 |
| Language | TypeScript 5.9 |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| UI | React Native Paper (MD3 light theme) |
| Icons | `@expo/vector-icons` – MaterialCommunityIcons |
| Local storage | AsyncStorage |
| Remote sync | Supabase JS v2 (optional) |
| Notifications | expo-notifications |
| Haptics | expo-haptics |
| IDs | uuid v13 + react-native-get-random-values |
| Bridge API | Vercel serverless (ESM TypeScript) |
| Share-Target | `expo-share-extension` (iOS) + `react-native-receive-sharing-intent` (Android) |
| Webapp | Next.js 16, React 19, Tailwind CSS 4, Supabase JS v2 |

---

## Build & Run Commands

From `NotizApp/NotizApp/`:
```bash
npx expo start [--android | --ios | --web]
eas build --platform android|ios
npx tsc --noEmit        # only static check (no lint/test runner configured)
```

Bridge (`bridge/`):
```bash
vercel dev
vercel deploy --prod
```

Webapp (`webapp/`):
```bash
npm run dev             # Next.js dev server (localhost:3000)
npm run build
```

---

## Environment Variables

`NotizApp/.env` (copy from `.env.example`):
```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_DEVICE_ID=<unique-device-label>
```

`webapp/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Sync is optional — if env vars are absent, `isSyncConfigured()` returns false and
all sync code is silently skipped.

---

## Architecture Notes

### Provider tree (App.tsx)
```
GestureHandlerRootView
 └─ SafeAreaProvider
     └─ ThemeProvider
         └─ PaperProvider (AppTheme)
             └─ NavigationContainer
                 └─ NotesProvider
                     └─ ThoughtsProvider
                         ├─ ShareHandler
                         └─ AppNavigator
```

### Navigation
- **Bottom tabs**: Threads, Notizen (HomeScreen), Archiv, Einstellungen
- **Stack screens**: NoteDetail, Editor, ThreadDetail

### Data flow
- State in `NotesContext` / `ThoughtsContext`. Persistence via AsyncStorage.
  Keys: `@notizapp_notes`, `@notizapp_categories`, `@notizapp_archive`, `@notizapp_tombstones`.
- Sync: `pullRemote()` on mount → `subscribeRemote()` (realtime). Writes via
  `upsertRemote()` / `deleteRemote()`. Tombstone set prevents re-sync of deleted notes.

### Supabase schema
Tables: `notes`, `thoughts`, `threads`, `thought_threads`, `thread_similarities`, `profiles`.
Jede Zeile gehört einem `auth.users`-User via `user_id` (Ausnahme `thought_threads`:
gescoped über `thread_id`). **RLS ist user-scoped** (`auth.uid() = user_id`) — Queries
MÜSSEN trotzdem explizit nach `user_id` filtern (Defense-in-Depth, auch in der Webapp).
Schema source: `supabase-schema.sql`.

### Theme
`src/theme/theme.ts` — MD3LightTheme. Editorial Papier-Stil: cremige OKLCH-Surfaces,
Espresso-Tinte, Amber als einzige Akzentfarbe. Fonts: Instrument Serif (Headings),
Inter (UI/Body) via `expo-font` in App.tsx. Kategorien: Hue-Rotation via
`src/theme/categoryAccents.ts` — **keine LinearGradient-Importe mehr in `src/`**.
Neue Themedateien: `typography.ts`, `categoryAccents.ts`.

### App-Icon (Velm)
„Bleistift schreibt V" auf Velm-Gradient (`#F4A261→#E8874A→#C05C20`). Spec: lokaler Design-Handoff `Velm Icon - Final.html` (gitignored).
PNGs reproduzierbar aus SVG: `node scripts/generate-icons.mjs` → `assets/*.png`.
Als Komponente: `src/components/VelmLogo.tsx` (App, RN-SVG), `webapp/components/VelmIcon.tsx` (Web),
Webapp-Favicon: `webapp/app/icon.svg`.

### Webapp (graph visualizer)
`webapp/` ist ein eigenständiges Next.js-Projekt. Es liest Notizen, Threads und
Ähnlichkeiten direkt aus Supabase und stellt sie als interaktiven Force-Graph dar.
- `app/page.tsx` — Haupt-UI (Filter-Pills, Graph, Overlays)
- `app/api/graph/route.ts` — API-Route, die Supabase-Daten aggregiert
- `components/Graph.tsx` — Force-Graph (dynamisch geladen, kein SSR)
- Eigene `node_modules` und `package.json` — unabhängig vom Expo-App-Toolchain

### Synthese (Thoughts → Threads)
Läuft **on-demand**: Der User drückt in `ThreadsScreen` auf „Synthetisieren" →
`POST /api/synthesize` (`bridge/api/synthesize.ts`). Der Endpoint prüft das Rate-Limit
pro Tier (free 1×/Woche, basic 1×/Tag, pro 10×/Tag) über die `profiles`-Tabelle
(`ai_last_run`, `ai_runs_today`, `ai_day_reset`), ruft dann die Anthropic-API direkt
auf und schreibt Threads zurück. **Kein täglicher Cron-Job mehr.**

`bridge/worker/brainstorm-worker.mjs` / `similarity-worker.mjs` — Node.js ESM CLI-Helfer
(keine extra Deps), nur noch für manuelle/lokale Nutzung:
```bash
node bridge/worker/brainstorm-worker.mjs fetch          # feed-notes + active threads → stdout JSON
node bridge/worker/brainstorm-worker.mjs write <json>   # write synthesis back
node bridge/worker/brainstorm-worker.mjs add "Gedanke"  # push single thought
```
Credentials: `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` aus `bridge/worker/.env`
→ `NotizApp/.env` → `EXPO_PUBLIC_*`.

---

## Code Conventions

- **Language**: German UI strings; English code identifiers.
- **TypeScript**: strict-ish; interfaces for models, no `any` in models layer.
- **Components**: functional + hooks only, no class components.
- **Context mutation**: all state changes via context functions (`addNote`, `updateNote`, …).
- **Async**: `async/await` throughout; fire-and-forget syncs wrapped in try/catch.
- **IDs**: `uuidv4()` — always import `react-native-get-random-values` before uuid.
- **No test files** — rely on manual device testing and TypeScript.
- **Kategorie-Farben**: immer `getCategoryAccent()` aus `categoryAccents.ts`.
- **Rules**: Update dich selber regelmäßig, aber diese Datei MUSS unter 200 Zeilen bleiben.
             Arbeite nie am main branch, außer ich bitte darum
