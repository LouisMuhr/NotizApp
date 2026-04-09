# NotizApp – CLAUDE.md

## Project Overview

NotizApp is a German-language note-taking mobile app built with React Native / Expo.
It supports notes with checklists, categories, reminders, pinning, archiving, and
optional Supabase sync across devices. A secondary "Thoughts/Brainstorm" feature
(atomare Gedanken → Threads) lives alongside the main notes flow.

A companion **bridge** Vercel serverless API (`NotizApp/bridge/`) exposes note data
via HTTP and a browser bookmarklet so external tools can push notes into the app.

---

## Repository Layout

```
c:/NotizApp/
├── NotizApp/              # Main Expo app (primary working directory)
│   ├── App.tsx            # Root component, provider tree
│   ├── index.ts           # Entry point
│   ├── app.json           # Expo config
│   ├── eas.json           # EAS Build config
│   ├── package.json
│   ├── tsconfig.json
│   ├── supabase-schema.sql
│   ├── .env               # Real secrets (git-ignored)
│   ├── .env.example       # Template
│   ├── src/
│   │   ├── components/    # FilterBar, GradientCard, NoteCard
│   │   ├── context/       # NotesContext, ThoughtsContext, ThemeContext
│   │   ├── models/        # Note.ts, Thought.ts (pure TypeScript types)
│   │   ├── navigation/    # AppNavigator (Stack + BottomTabs)
│   │   ├── screens/       # HomeScreen, EditorScreen, NoteDetailScreen,
│   │   │                  #   ArchiveScreen, SettingsScreen
│   │   ├── storage/       # noteStorage.ts, thoughtStorage.ts (AsyncStorage)
│   │   ├── sync/          # supabaseClient, remoteNotes, remoteThoughts, deviceId
│   │   ├── theme/         # theme.ts (MD3 dark theme, deep-navy palette)
│   │   └── utils/         # notifications, haptics, …
│   └── bridge/            # Vercel serverless bridge API
│       ├── api/           # Serverless functions
│       ├── bookmarklet/   # Browser bookmarklet source
│       └── package.json
└── README.md
```

---

## Tech Stack

| Layer | Library/Tool |
|---|---|
| Framework | React Native 0.81, Expo SDK 54 |
| Language | TypeScript 5.9 |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| UI | React Native Paper (MD3 dark theme) |
| Icons | `@expo/vector-icons` – MaterialCommunityIcons |
| Local storage | AsyncStorage (`@react-native-async-storage/async-storage`) |
| Remote sync | Supabase JS v2 (optional – gracefully skipped if env vars missing) |
| Notifications | expo-notifications |
| Haptics | expo-haptics |
| IDs | uuid v13 + react-native-get-random-values polyfill |
| Bridge API | Vercel serverless (ESM TypeScript, deployed separately) |

---

## Build & Run Commands

All commands run from `NotizApp/NotizApp/`:

```bash
# Start dev server (choose platform interactively)
npx expo start

# Platform-specific
npx expo start --android
npx expo start --ios
npx expo start --web

# EAS builds (requires Expo account)
eas build --platform android
eas build --platform ios
```

Bridge (`NotizApp/NotizApp/bridge/`):
```bash
vercel dev      # local dev
vercel deploy --prod
```

**No lint/test scripts are configured** – the project has no ESLint, Prettier, or
test runner in package.json. TypeScript type-checking is the only static check:
```bash
npx tsc --noEmit
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_DEVICE_ID=<unique-device-label>
```

Sync is **optional**. If env vars are absent, `isSyncConfigured()` returns false and
all sync code is silently skipped. The app works fully offline.

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
                         └─ AppNavigator
```

### Navigation
- **Bottom tabs**: Notizen (HomeScreen), Archiv (ArchiveScreen), Einstellungen (SettingsScreen)
- **Stack screens**: NoteDetail, Editor (pushed on top of tabs)

### Data flow
- State lives in `NotesContext` / `ThoughtsContext` (React Context + useState).
- Persistence: AsyncStorage via `src/storage/`. Keys: `@notizapp_notes`,
  `@notizapp_categories`, `@notizapp_archive`, `@notizapp_tombstones`.
- Sync: on mount, `pullRemote()` fetches from Supabase then `subscribeRemote()`
  opens a realtime channel. Writes call `upsertRemote()` / `deleteRemote()`.
  Deletions are tracked via a **tombstone set** to prevent re-sync of deleted notes.
- Device identity is stored in AsyncStorage and referenced on every remote call.

### Supabase schema
Tables: `notes`, `thoughts`, `threads`, `thought_threads`.
Schema source: `supabase-schema.sql`. RLS policies use simple `using (true)` for
single-user/anon-key setups; replace for multi-user deployments.

### Theme
`src/theme/theme.ts` – extends `MD3DarkTheme` from react-native-paper.
Deep navy backgrounds (`#0F1117` / `#181B23`), soft indigo primary (`#7B6EF6`),
mint secondary (`#3ECFB4`), amber tertiary (`#FFB347`).

---

## Code Conventions

- **Language**: German UI strings throughout (categories, screen titles, labels).
  Code identifiers are English.
- **TypeScript**: strict-ish; interfaces for models, no `any` in models layer.
- **Components**: functional components with hooks only. No class components.
- **Context mutation**: all state mutations go through context functions
  (`addNote`, `updateNote`, `deleteNote`, etc.) – never mutate state directly in screens.
- **Async**: all storage and sync ops are `async/await`. Fire-and-forget syncs are
  wrapped in try/catch with `console.warn`.
- **IDs**: UUIDs via `uuid` v13 (`uuidv4()`). Always import `react-native-get-random-values`
  before uuid (done once in NotesContext).
- **No test files** exist – rely on manual device testing and TypeScript for safety.
