# NotizApp – CLAUDE.md

> **Meta:** After every significant code change, update this file to reflect the new state.
> Keep it under 200 lines — compress or merge sections if it grows beyond that.

## Project Overview

NotizApp (Velm) is a German-language note-taking app in React Native / Expo: Notizen mit Checklisten,
Kategorien, Erinnerungen, Pinning, Archiv und optionalem Supabase-Sync. Daneben „Thoughts/Brainstorm"
(atomare Gedanken → Threads). Dazu eine **bridge** (Vercel serverless API + Browser-Bookmarklet) und eine
**webapp** (Next.js Graph-Visualizer).

## Repository Layout

```
c:/NotizApp/
├── NotizApp/              # Main Expo app (primary working directory)
│   ├── App.tsx            # Root component, provider tree
│   ├── src/
│   │   ├── components/    # FilterBar, GradientCard, NoteCard, QuickCaptureFAB, VoiceCaptureSheet
│   │   ├── context/       # NotesContext, ThoughtsContext, ThemeContext, LanguageContext
│   │   ├── i18n/          # index.ts (I18n setup), locales/de.ts + en.ts
│   │   ├── models/        # Note.ts, Thought.ts (pure TypeScript types)
│   │   ├── navigation/    # AppNavigator (Stack + BottomTabs)
│   │   ├── screens/       # Home, Editor, NoteDetail, Archive, Settings*, Threads, ThreadDetail
│   │   ├── storage/       # noteStorage.ts, thoughtStorage.ts (AsyncStorage)
│   │   ├── sync/          # supabaseClient, accountState, legacyAnon, remoteNotes, mergeNotes, userId, deleteAccount
│   │   ├── theme/         # theme.ts, typography.ts, categoryAccents.ts, gradients.ts
│   │   └── utils/         # notifications, haptics, timeGrouping, …
│   ├── bridge/            # Vercel serverless bridge API + worker
│   │   ├── api/           # Functions: synthesize, note, bookmarklet-token, delete-user; _lib/ = shared
│   │   ├── bookmarklet/   # Browser bookmarklet source
│   │   └── worker/        # brainstorm-worker.mjs, similarity-worker.mjs (CLI-Helfer)
│   └── webapp/            # Next.js 16 graph visualizer (standalone): app/, components/, lib/, types/
└── README.md
```

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
| i18n | i18n-js v4 + expo-localization (DE/EN, Geräte-Sprache + manueller Override) |
| Webapp | Next.js 16, React 19, Tailwind CSS 4, Supabase JS v2 |

## Build & Run Commands

From `NotizApp/NotizApp/`:
```bash
npx expo start [--android | --ios | --web]
eas build --platform android|ios
npx tsc --noEmit        # static check
npm test                # Jest (jest-expo); __tests__/ = Audit- + Regressionstests (Soll-Verhalten)
```

Bridge (`bridge/`): `vercel dev`, `vercel deploy --prod`.
Webapp (`webapp/`): `npm run dev` (localhost:3000), `npm run build`.

## Environment Variables

`NotizApp/.env` (copy from `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_BRIDGE_URL`. (`EXPO_PUBLIC_BRIDGE_BEARER` wird nicht mehr gelesen — kein Admin-Token im App-Bundle.)
Bridge (Vercel): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, optional `BOOKMARKLET_MIN_TIER` (Default `basic`).
`webapp/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Sync ist optional — fehlen die Vars, liefert `isSyncConfigured()` false und aller Sync-Code entfällt still.

## Architecture Notes

### Provider tree (App.tsx)
GestureHandlerRootView → SafeAreaProvider → ThemeProvider → PaperProvider → NavigationContainer →
NotesProvider → ThoughtsProvider → (ShareHandler, AppNavigator)

### Navigation
- **Bottom tabs**: Threads, Notizen (HomeScreen), Archiv, Einstellungen
- **Stack screens**: NoteDetail, Editor, ThreadDetail

### Data flow (Notizen)
- `NotesContext` hält aktive **und** archivierte Notizen als einen Bestand (`allRef`); `archivedAt`
  entscheidet die Liste. AsyncStorage-Keys: `@notizapp_notes`, `@notizapp_archive`, `@notizapp_categories`,
  `@notizapp_tombstones`, `@notizapp_pending_sync` (Outbox), `@notizapp_sync_uid` (zuletzt gesyncte UID).
- Jede Mutation: pending markieren → `commit()` (State sofort, Writes serialisiert; bei Write-Fehler Reload
  von Platte) → `pushRemote()`. Updates gehen als **PATCH nur geänderter Felder** (`upsertRemote(uid, note, patch)`).
- Start/Vordergrund/Resync: `pullRemote()` (paginiert) → `mergeWithRemote()` in `src/sync/mergeNotes.ts`
  (LWW auf `updatedAt`; lokale Notizen werden **nie** stillschweigend verworfen: pending oder UID-Wechsel →
  hochladen; nur bestätigte, remote fehlende Notizen bei gleicher UID gelten als gelöscht) → Outbox flushen →
  `subscribeRemote()` (INSERT/UPDATE/DELETE). Archivieren = `archived_at` setzen, nie DELETE; endgültig
  löschen = Tombstone + `deleteRemote()` (Batches à 200).
- `resyncForUser(uid, mode)`: Default `'replace'` (Anmeldung = Zweitgerät, Kontostand gilt). `'merge'` nur
  beim Routine-Start eines bestätigten Kontos und beim Erstupload (`uploadLocalNotes`). `detachSync()`
  schaltet den Sync ab und behält den lokalen Bestand (vorher `flushPending()`; `signOut()`-Fehler
  bricht ab) — Details unten.

### Konto-Zustände (lokal-first)
`src/sync/accountState.ts` ist die einzige Quelle: `local` → `pending-confirmation` → `secured`, strikt aus
`user.email_confirmed_at` abgeleitet, nie aus einem lokalen Flag. **Die App legt nie selbst einen
Supabase-User an** — `local` ist der Default, Notizen bleiben rein lokal. `getUserId()`/`getSyncUserId()`
liefern nur bei `secured` eine UID, damit sind die beiden anderen Zustände garantiert offline.
Registrierung = `signUp()` → `pending-confirmation` (nicht optimistisch `secured`); erst nach Bestätigung
läuft der einmalige `uploadLocalNotes()`, bei Fehler bleibt `@notizapp_initial_upload_pending` stehen und
der Konto-Screen zeigt einen dauerhaften Retry. Gibt `signUp()` keine Session aus, rettet
`@notizapp_pending_email` den Zustand über einen Neustart — „Bestätigung prüfen" fragt dann nach dem
Passwort, weil der Status ohne Session nicht abfragbar ist. Weitere Keys: `@notizapp_first_seen` +
`@notizapp_unsecured_dismissed` (Banner-Schwelle). Altlast: anonyme Sessions werden beim Start nur
abgemeldet (`src/sync/legacyAnon.ts`); die verwaisten Anon-User wurden per SQL bereits abgeräumt.
Trennen (`detachSync`, UI „Sync beenden") behält Notizen **und** Threads lokal und räumt Outbox +
`@notizapp_sync_uid` ab, damit nichts ins nächste Konto leckt. Erstupload in ein **anderes** Konto
vergibt neue Notiz-IDs: `notes.id` ist PK über alle User, RLS würde den Upsert sonst ablehnen. Alles
löschen geht nur über Einstellungen → Datenschutz (lokal **und** remote). Synthese braucht ein
bestätigtes Konto: Button bleibt sichtbar, ausgegraut („Konto erforderlich"), führt zum Konto-Screen.
`UnsecuredBanner` warnt im Haupt-Screen ab 10 Notizen bzw. 7 Tagen (wegklickbar), bei
`pending-confirmation` sofort; im Konto-Screen dauerhaft.

### Supabase schema
Tables: `notes`, `thoughts`, `threads`, `thought_threads`, `thread_similarities`, `profiles`.
Jede Zeile gehört einem `auth.users`-User via `user_id` (Ausnahme `thought_threads`:
gescoped über `thread_id`). **RLS ist user-scoped** (`auth.uid() = user_id`) — Queries
MÜSSEN trotzdem explizit nach `user_id` filtern (Defense-in-Depth, auch in der Webapp).
Schema source: `supabase-schema.sql` (frisch) bzw. `supabase-migration-2026-09-17.sql` (Delta für bestehende
Projekte: `notes.archived_at`, `replica identity full`, keine Client-Update-Policy auf `profiles`,
`profiles.bookmarklet_token_hash`). Die RPC `migrate_user` ist funktionslos (Altlast des anonymen
Modells) und kann gedroppt werden.

### Theme
`src/theme/theme.ts` — MD3LightTheme. Editorial Papier-Stil: cremige OKLCH-Surfaces, Espresso-Tinte,
Amber als einzige Akzentfarbe. Fonts: Instrument Serif (Headings), Inter (UI/Body) via `expo-font` in
App.tsx. Kategorien: Hue-Rotation via `categoryAccents.ts` — **keine LinearGradient-Importe in `src/`**.

### App-Icon (Velm)
„Bleistift schreibt V" auf Velm-Gradient (`#F4A261→#E8874A→#C05C20`). Spec: `Velm Icon - Final.html`
(gitignored). PNGs: `node scripts/generate-icons.mjs` → `assets/*.png`. Komponenten:
`src/components/VelmLogo.tsx`, `webapp/components/VelmIcon.tsx`, Favicon `webapp/app/icon.svg`.

### i18n (Deutsch/Englisch)
`src/i18n/index.ts` — i18n-js `I18n` (`de`/`en`), `defaultLocale = 'de'`, `enableFallback = true`; exportiert
`t()`, `detectDeviceLocale()`, `setI18nLocale()`, Typ `AppLocale`. `locales/de.ts`/`en.ts` — verschachtelte
Dictionaries, ein Namespace pro Screen (`en.ts` ist `typeof de`-typisiert); Plurale via `_one`/`_other`,
Interpolation via `%{var}` oder `{{var}}`. `LanguageContext.tsx` → `useLanguage()` = `{ locale, preference,
setPreference, t }`, `preference: 'system'|'de'|'en'` in `@notizapp_language`, Umschalter unter Darstellung.
**Konventionen**: Routennamen nie übersetzt (nur `options.title`/`tabBarLabel`); Datum/Zeit via
`locale === 'en' ? 'en-US' : 'de-DE'`; `timeGrouping.ts` nimmt optionales `t` (Default `i18n.t`).

### Webapp (graph visualizer)
`webapp/` ist ein eigenständiges Next.js-Projekt (eigene `node_modules`). Liest Notizen (ohne archivierte), Threads,
Ähnlichkeiten aus Supabase → Force-Graph: `app/page.tsx`, `app/api/graph/route.ts`, `components/Graph.tsx` (kein SSR).

### Bridge-Auth & Synthese
Alle Bridge-Endpunkte weisen den Aufrufer über ein **Supabase-Access-Token** aus (`_lib/supabaseAdmin.ts`
→ `verifyToken()`); kein statischer Admin-Token mehr. `/api/note` nutzt stattdessen den persönlichen
Bookmarklet-Schlüssel (`/api/bookmarklet-token`, nur SHA-256-Hash gespeichert, ab Tier `basic`).
`/api/delete-user` löscht nur den Aufrufer (`src/sync/deleteAccount.ts`). Fehlerantworten sind generische
Codes (`ai_unavailable`, `internal`, …), Details nur im Log.

Synthese läuft **on-demand** (`ThreadsScreen` → `POST /api/synthesize`): Rate-Limit pro Tier (free 1×/7×24 h
rollierend, basic 1×/24 h rollierend, pro 10×/UTC-Tag) über `profiles`; Lauf wird **vor** dem KI-Call gebucht
(Claim mit Filter auf `ai_last_run`, bei Race einmal Retry) und bei Fehlern auf unserer Seite (Netz, KI, DB)
zurückgegeben, nicht bei „keine Notizen". Client zeigt `next_allowed_at` als Uhrzeit (`src/utils/limitFormat.ts`,
`formatAvailabilityParts()` → `lead`/`detail`), Grenze deterministisch aus Server-Feldern
(`computeNextAllowedAt`), 429-Wert des Servers gewinnt.

**Abo-Gating in der UI**: Bookmarklet ab `basic` (zusätzlich bestätigtes Konto nötig), Web App ab `pro`.
Gesperrte Einträge bleiben sichtbar (`NavRow locked`), zeigen `settings.lockedFromPlan`, navigieren zu
`SettingsAbo`. `bridge/worker/*.mjs` — lokale CLI-Helfer (Credentials aus `bridge/worker/.env`), nicht
Teil der API.

## Code Conventions

- **Language**: German UI strings; English code identifiers.
- **TypeScript**: strict-ish; interfaces for models, no `any` in models layer.
- **Components**: functional + hooks only, no class components.
- **Context mutation**: all state changes via context functions (`addNote`, `updateNote`, …).
- **Async**: `async/await` throughout; fire-and-forget syncs wrapped in try/catch. **IDs**: `uuidv4()` —
  always import `react-native-get-random-values` before uuid.
- **Tests**: Jest via `jest-expo` (`jest.config.js`, `jest.setup.js`, `__tests__/`). Tests beschreiben das
  **Soll**; ein roter Test ist ein Bug, nie durch Abschwächen grün machen. Audit-Report + manuelle Skripte:
  `docs/audit/`.
- **Kategorie-Farben**: immer `getCategoryAccent()` aus `categoryAccents.ts`.
- **Rules**: Update dich selber regelmäßig, aber diese Datei MUSS unter 200 Zeilen bleiben.
             Arbeite nie am main branch, außer ich bitte darum
