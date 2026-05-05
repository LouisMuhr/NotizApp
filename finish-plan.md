# NotizApp — Plan: Von persönlichem Tool zur öffentlichen App

## Kontext & Ziel

NotizApp ist aktuell ein **persönliches Entwickler-Tool**, das wie eine öffentliche App aussieht,
aber keine echte Mehr-Nutzer-Architektur hat. Ziel ist eine App die für die breite Masse nutzbar
ist — kostenloser Download, jeder hat seine eigenen Daten, kein technisches Setup.

### Was aktuell nicht für die Öffentlichkeit taugt

| Problem | Warum kritisch |
|---------|----------------|
| **Keine Nutzer-Authentifizierung** | Jeder der den Supabase-Anon-Key kennt, kann alle Daten lesen/schreiben |
| **RLS-Policies sind `using (true)`** | Server vertraut blind dem Client — keine echte Datentrennung |
| **Sync über `device_id` (client-seitig)** | Kein Schutz, keine Isolation zwischen Nutzern |
| **Supabase-Keys in `.env`** | Nutzer müssten ihre eigene Supabase-Instanz einrichten |
| **Brainstorm = lokales Windows-Tool** | Läuft nur auf dem Entwickler-PC, nicht für andere Nutzer |

---

## Phase 0: Fundament (MUSS vor allem anderen) — *3–4 Tage*

Das ist die wichtigste Phase. Ohne sie ist alles andere auf Sand gebaut.

### 0.1 Supabase Auth einführen — **MUSS**  *(1,5 Tage)*

**Ziel:** Jeder Nutzer hat ein eigenes Konto, Daten sind serverseitig isoliert.

**Strategie: Anonymous Auth → optionales Upgrade**
- Beim ersten App-Start: `supabase.auth.signInAnonymously()` → kein Login-Screen nötig
- Nutzer bemerkt nichts, hat aber sofort eine echte Supabase-Identität
- Späterer optionaler Upgrade-Pfad: E-Mail/Passwort in Einstellungen hinterlegen
  → Konto bleibt erhalten, alle Daten migriert

**Änderungen:**

`src/sync/supabaseClient.ts`:
```ts
auth: { persistSession: true, autoRefreshToken: true }
```
+ `signInAnonymously()` beim ersten Start (in `NotesContext` oder `App.tsx`)

`src/sync/deviceId.ts`: komplett ersetzen durch `supabase.auth.getUser()` → `user.id`

`src/sync/remoteNotes.ts` + `remoteThoughts.ts`:
- `device_id` → `user_id` (= `auth.uid()`)
- Alle Queries: `.eq('user_id', userId)` statt `.eq('device_id', deviceId)`

### 0.2 Datenbank-Schema & echte RLS — **MUSS**  *(4 Std)*

**Supabase SQL Editor** (einmalig ausführen):

```sql
-- Spalten umbenennen
ALTER TABLE notes     RENAME COLUMN device_id TO user_id;
ALTER TABLE thoughts  RENAME COLUMN device_id TO user_id;
ALTER TABLE threads   RENAME COLUMN device_id TO user_id;

-- user_id auf auth.uid() referenzieren
ALTER TABLE notes    ADD CONSTRAINT notes_user_fk    FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE thoughts ADD CONSTRAINT thoughts_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE threads  ADD CONSTRAINT threads_user_fk  FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Echte RLS einschalten
ALTER TABLE notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE thoughts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads   ENABLE ROW LEVEL SECURITY;

-- Alle permissiven Policies ersetzen
DROP POLICY IF EXISTS "device read"   ON notes;
DROP POLICY IF EXISTS "device insert" ON notes;
DROP POLICY IF EXISTS "device update" ON notes;
-- (gleiches für thoughts, threads)

CREATE POLICY "own_notes"    ON notes    USING (auth.uid()::text = user_id);
CREATE POLICY "own_thoughts" ON thoughts USING (auth.uid()::text = user_id);
CREATE POLICY "own_threads"  ON threads  USING (auth.uid()::text = user_id);
```

### 0.3 Bridge API auf Service-Role-Key umstellen — **MUSS**  *(1 Std)*

`bridge/api/note.ts` + `bridge/api/thought.ts`:
- Supabase-Client mit `SUPABASE_SERVICE_KEY` (Vercel env var) initialisieren
- `user_id` aus dem Bearer-Token ableiten (oder fest als "bridge-user" definieren)
- Anon-Key darf nie server-seitig verwendet werden

### 0.4 Optionaler Account-Upgrade in den Einstellungen — **SOLLTE**  *(4 Std)*

`src/screens/SettingsScreen.tsx` — neuer Abschnitt "Konto":
- Anonym: "Konto sichern" → E-Mail + Passwort eingeben → `supabase.auth.updateUser()`
- Mit E-Mail: E-Mail-Adresse anzeigen, "Abmelden", "Passwort ändern"
- Wichtig: Ohne gesichertes Konto gehen bei App-Deinstallation alle Sync-Daten verloren
  → Hinweis-Banner in der App anzeigen

---

## Phase 1: Nutzererfahrung — *2–3 Tage*

### 1.1 Onboarding-Flow — **MUSS**  *(1,5 Tage)*

Duolingo-Style, 3 Seiten, animiert. Erscheint nur beim allerersten Start.

| Seite | Headline | Subtext |
|-------|----------|---------|
| 1 | "Gedanken festhalten." | "Schnell, einfach, immer dabei." |
| 2 | "Vergiss nie wieder etwas." | "Erinnerungen, die wirklich ankommen." |
| 3 | "Alles an einem Ort." | "Notizen, Checklisten, Ideen — synchron auf all deinen Geräten." |

Datei: `src/screens/onboarding/OnboardingScreen.tsx` + Seiten-Komponenten.
`App.tsx`: Onboarding-Gate via AsyncStorage-Key `@notizapp_onboarding_done`.

### 1.2 Kleinere UX-Fixes — **MUSS**  *(1 Tag)*

- `src/screens/ThreadsScreen.tsx`: Interne Platzhaltertexte durch echte deutsche UI-Texte ersetzen
- `src/screens/EditorScreen.tsx`: Speichern-Feedback (Snackbar + Haptic)
- `app.json`: Splash-Screen-Farbe auf `#0F1117` setzen (kein weißer Blitz)
- `src/screens/SettingsScreen.tsx`: Versionsnummer aus `package.json` anzeigen

### 1.3 Datenschutz & DSGVO — **MUSS für EU**  *(4–6 Std)*

- `src/context/NotesContext.tsx`: `deleteAllData()` → AsyncStorage leeren + Remote-Daten des Nutzers löschen
- `src/screens/SettingsScreen.tsx`: "Alle Daten löschen" + "Konto löschen" (roter Button, Bestätigungs-Dialog)
- `src/utils/exportNotes.ts` (neu): JSON-Export aller Notizen via `expo-sharing`

---

## Phase 2: App Store — *2 Tage*

### 2.1 App-Metadaten — **MUSS**
- `app.json`: `privacyPolicyUrl`, `bundleIdentifier`, `versionCode` setzen
- `eas.json`: iOS-Profil ergänzen, Android auf `aab` umstellen
- Screenshots (1242×2688px iOS, 1080×1920px Android)
- Store-Beschreibung auf Deutsch + Englisch

### 2.2 Datenschutzerklärung — **MUSS**
- Einfache statische Seite (GitHub Pages oder Vercel): was wird gespeichert, wie lange, Löschrecht
- URL in `app.json` + App Store eintragen

---

## Phase 3: KI-Feature (Brainstorm) für alle Nutzer — *Entscheidung erforderlich*

Das ist die offene Frage: Die aktuelle Implementierung (Windows-PC + Claude Code CLI) funktioniert
**nur für den Entwickler**. Für alle Nutzer braucht man eine andere Lösung.

### Das Problem
KI-Synthese kostet Geld (Anthropic API). Wer zahlt das?

### Option A: App-Betreiber zahlt *(Empfehlung für Markteinführung)*
- Neue Vercel-Funktion `bridge/api/synthesize.ts` ruft Claude API auf
  (brainstorm-prompt.md als System-Prompt + Nutzerdaten als Input)
- `ANTHROPIC_API_KEY` in Vercel env vars (einmalig vom Entwickler)
- Button in der App → API-Call → Ergebnisse erscheinen in Threads
- **Vorteil**: Funktioniert für alle Nutzer ohne Setup
- **Nachteil**: Kosten steigen mit Nutzerzahl → braucht Monetarisierung oder Rate-Limiting
- **Rate-Limit**: max. 1 Synthese pro Nutzer pro Tag (in Supabase tracken)

### Option B: Nutzer trägt API-Key ein *(für Power-User-Segment)*
- Optionales Feld in Einstellungen: "Anthropic API-Key"
- Key wird lokal in AsyncStorage gespeichert (nicht an Server übertragen)
- Brainstorm-Button erscheint nur wenn Key hinterlegt
- **Vorteil**: Keine Kosten für Betreiber
- **Nachteil**: Nur für technisch versierte Nutzer nutzbar

### Option C: KI-Feature erst in Version 2
- V1: App ohne Brainstorm-Button (Thoughts & Threads bleiben, aber ohne Auto-Synthese)
- V2: Als In-App-Purchase oder Premium-Abonnement nachliefern
- **Vorteil**: Keine ungeplanten Kosten beim Launch
- **Empfehlung wenn unsicher**: Starte mit Option C, entscheide nach erstem Nutzer-Feedback

### Technische Umsetzung (wenn Option A oder B gewählt):

`bridge/api/synthesize.ts` (neu):
```
POST /api/synthesize?token=...
→ Supabase: fetch unprocessed thoughts für user_id
→ Anthropic API: brainstorm-prompt.md + thoughts als Input
→ parse response (new_threads, thread_updates)
→ Supabase: write back, mark thoughts as processed
→ return { threads_created, threads_updated }
```

App: Button in `src/screens/ThreadsScreen.tsx`:
```
"Jetzt synthetisieren" → Loading → Toast "3 neue Threads erstellt"
```

Der Windows-Scheduled-Task (`setup-task.ps1`) wird **obsolet** sobald Option A oder B
implementiert ist.

---

## Phase 3b: Browser-Bookmarklet — *Optional, Power-User-Feature*

Das Bookmarklet erlaubt es, markierten Text auf einer beliebigen Webseite per Klick als Notiz
zu speichern. Aktuell nutzt es native `prompt()`/`alert()`-Dialoge — kein Styling, keine
Kategorien, keine Erinnerungen.

### Bookmarklet-UI: Floating Panel statt alert() — **KANN**  *(1–1,5 Tage)*

**Lösung:** Das Bookmarklet injiziert ein vollständiges Popup-Panel in die aktuelle Seite
(Shadow DOM → keine CSS-Konflikte, funktioniert auf jeder Webseite).

**Design (passend zum App-Theme):**
- Schwebendes Karten-Panel rechts unten, 380px breit
- Hintergrund `#181B23`, Akzent `#7B6EF6`, abgerundete Ecken (16px)
- Slide-up + Fade-Animation beim Öffnen
- Grüner Checkmark + Auto-Close nach 1,5 Sek bei Erfolg

**Felder:**

| Feld | Typ | Vorbelegt |
|------|-----|-----------|
| Titel | Text-Input | Erste 80 Zeichen der Markierung |
| Inhalt | Textarea | Vollständiger markierter Text |
| Kategorie | Chip-Auswahl | "Allgemein" |
| Anpinnen | Toggle | Aus |
| Erinnerung | Klappbarer Bereich | Kein Datum |

**Kategorie-Chips:** Allgemein · Arbeit · Privat · Ideen · Einkauf *(fest kodiert)*

**API-Erweiterung `bridge/api/note.ts`** — folgende Felder ergänzen:
- `reminder_at?: string` (ISO 8601)
- `reminder_recurrence?: 'once' | 'daily' | 'weekly' | 'monthly'`

**Technische Umsetzung:**
- `bridge/bookmarklet/bookmarklet.html` Zeile ~45: generiertes Bookmarklet-JS durch
  selbst-enthaltendes Panel-Script (~150 Zeilen Vanilla JS + CSS) ersetzen
- Kein Framework, kein Build-Step, Shadow DOM für Isolation

**UX-Flow:**
1. Text markieren → Bookmark klicken
2. Panel erscheint, Felder vorausgefüllt
3. Optional anpassen → "Speichern"
4. `✅ Gespeichert!` → Panel schließt sich
5. `✕` oder `Escape` → sofort schließen

**Verknüpfung mit Auth (Phase 0):**
Das Bookmarklet nutzt aktuell einen statischen Bearer-Token. Nach Einführung der Supabase Auth
sollte `bridge/api/note.ts` optional einen Supabase-JWT akzeptieren, damit der Nutzer
seine eigenen Notizen speichert (nicht eine generische Bridge-User-ID).

---

---

## Phase 3c: Webapp erweitern — *Notizen + Auth*

Die Webapp (`NotizApp/webapp/`) ist ein Next.js 16 App-Router-Projekt mit Tailwind CSS.
Aktuell zeigt sie nur das "secondBrain"-Graph-Schema (Threads, Notes, Similarities) ohne
Authentifizierung und ohne Möglichkeit, Notizen zu erstellen oder zu löschen.

### Was hinzukommt

1. **Login/Logout** — Nutzer muss sich anmelden um seine eigenen Daten zu sehen
2. **Notiz erstellen** — Formular zum Anlegen einer neuen Note
3. **Notiz löschen** — Delete-Button in `NoteOverlay.tsx`

---

### 3c.1 Authentication — **MUSS**  *(4–5 Std)*

**Strategie:** Supabase E-Mail/Passwort-Login (kein Anonymous Auth für die Webapp —
hier macht explizites Login Sinn, da der Nutzer bewusst auf "seine" Daten zugreift).

**Neue Datei: `webapp/components/AuthModal.tsx`**
- Modaler Dialog (gleiche Basis-Styles wie bestehende Overlays: Backdrop-Blur, 460px Breite)
- Tabs: "Anmelden" / "Registrieren"
- Felder: E-Mail, Passwort (+ Passwort bestätigen bei Registrierung)
- `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()`
- Fehlertext unterhalb des Formulars (z.B. "E-Mail oder Passwort falsch")
- Schließt sich automatisch nach erfolgreichem Login

**`webapp/app/page.tsx`** — Auth-State hinzufügen:
```ts
const [session, setSession] = useState<Session | null>(null)

useEffect(() => {
  supabase.auth.getSession().then(({ data }) => setSession(data.session))
  supabase.auth.onAuthStateChange((_event, s) => setSession(s))
}, [])
```
- Wenn `session === null`: AuthModal anzeigen (Vollbild-Overlay, nicht schließbar)
- Wenn `session` vorhanden: Graph normal rendern
- Logout-Button: rechts oben (Icon + "Abmelden"), ruft `supabase.auth.signOut()` auf

**`webapp/app/api/graph/route.ts`** — Auth-Token weiterleiten:
- Request-Header `Authorization: Bearer <access_token>` an Supabase übergeben
- Supabase-Client mit `createClient(url, anonKey, { global: { headers: { Authorization } } })`
- Dadurch greifen die RLS-Policies aus Phase 0 automatisch (nur eigene Daten sichtbar)
- Wenn kein Token: 401 zurückgeben

**`webapp/lib/supabase.ts`** — Server-seitigen Client ergänzen:
```ts
export function createServerClient(accessToken: string) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
```

---

### 3c.2 Notiz erstellen — **MUSS**  *(3–4 Std)*

**Neue Datei: `webapp/components/NoteForm.tsx`**
- Schwebender Button "＋ Notiz" in der oberen rechten Ecke (neben Logout)
- Klick öffnet ein Modal (460px, gleiche Overlay-Basis wie bestehende Modals)
- Felder:
  | Feld | Typ | Pflicht |
  |------|-----|---------|
  | Titel | Text-Input | Ja |
  | Inhalt | Textarea (4 Zeilen) | Nein |
  | Kategorie | Select | Nein (default: "Allgemein") |
  | Anpinnen | Checkbox | Nein |

**Neue API-Route: `webapp/app/api/notes/route.ts`**
```
POST /api/notes
Body: { title, content, category, is_pinned }
→ Supabase INSERT into notes (mit auth user_id aus Token)
→ 201 { id }

DELETE /api/notes?id=<uuid>
→ Supabase DELETE where id = ? AND user_id = auth.uid()
→ 204
```

**Beide Endpoints** lesen den `Authorization`-Header aus dem Request und nutzen
`createServerClient(accessToken)` aus `webapp/lib/supabase.ts`.

**Nach erfolgreichem Erstellen:** Graph-Daten neu laden (einfachste Lösung: `router.refresh()`
oder State-Reset → neuer `fetch('/api/graph')` call in `page.tsx`).

---

### 3c.3 Notiz löschen — **MUSS**  *(1–2 Std)*

**`webapp/components/NoteOverlay.tsx`** — Delete-Button ergänzen:
- Roter "Löschen"-Button am unteren Rand der Overlay-Karte
- Bestätigungs-Dialog: `window.confirm("Notiz wirklich löschen?")` (minimal, kein extra Modal)
- `DELETE /api/notes?id=<note.id>` aufrufen
- Bei Erfolg: Overlay schließen + Graph neu laden

**Authentifizierungs-Token** bei API-Calls weitergeben:
```ts
const { data: { session } } = await supabase.auth.getSession()
fetch('/api/notes?id=...', {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${session?.access_token}` }
})
```

---

### Kritische Webapp-Dateien

| Datei | Änderung |
|-------|----------|
| `webapp/app/page.tsx` | Auth-State, AuthModal-Gate, Graph-Reload-Trigger |
| `webapp/app/api/graph/route.ts` | Auth-Token aus Header → Server-Supabase-Client |
| `webapp/app/api/notes/route.ts` *(neu)* | POST + DELETE für Notizen |
| `webapp/components/AuthModal.tsx` *(neu)* | Login/Registrierungs-Dialog |
| `webapp/components/NoteForm.tsx` *(neu)* | Notiz-Erstell-Modal |
| `webapp/components/NoteOverlay.tsx` | Delete-Button ergänzen |
| `webapp/lib/supabase.ts` | `createServerClient(token)` ergänzen |

### Abhängigkeit von Phase 0
Diese Webapp-Änderungen setzen voraus, dass Phase 0 (RLS auf `user_id = auth.uid()`)
in Supabase bereits durchgeführt wurde — sonst sehen Nutzer trotz Login alle Daten.
Die Webapp-Auth kann aber **parallel** zu Phase 0 entwickelt werden.

---

## Phase 4: Launch — *Woche 2+*

### 4.1 Beta-Test
- `eas build --profile preview` → APK für Android + TestFlight für iOS
- Kritische Pfade testen: Onboarding, Notiz erstellen, Sync über 2 Geräte, Datenlöschung

### 4.2 Store-Einreichung
- `eas build --profile production` + `eas submit`
- Play Store: Data-Safety-Formular (Sync-Daten angeben)
- App Store: Privacy Nutrition Labels, Mikrofon-Begründung

---

## Empfohlene Reihenfolge

| Tag | Aufgabe |
|-----|---------|
| 1–2 | **Phase 0** komplett (Auth, RLS, Schema) — Fundament |
| 3 | Onboarding (1.1) + Splash-Fix (1.2) |
| 4 | DSGVO (1.3) + Konto-Einstellungen (0.4) |
| 5 | **Entscheidung KI-Feature** (Phase 3) + ggf. umsetzen |
| 6 | App-Metadaten + Datenschutzerklärung (Phase 2) |
| 7 | Beta-Build + testen |
| Woche 2 | Store-Einreichung |

---

## Kritische Dateien

| Datei | Änderung |
|-------|----------|
| `src/sync/supabaseClient.ts` | `persistSession: true`, `signInAnonymously()` |
| `src/sync/deviceId.ts` | Durch `auth.uid()` ersetzen |
| `src/sync/remoteNotes.ts` | `device_id` → `user_id` |
| `src/sync/remoteThoughts.ts` | `device_id` → `user_id` |
| `src/context/NotesContext.tsx` | Auth-Flow, `deleteAllData()` |
| `src/screens/SettingsScreen.tsx` | Konto-Sektion, Datenlöschung, Version |
| `src/screens/onboarding/` *(neu)* | 3 Onboarding-Screens |
| `App.tsx` | Onboarding-Gate |
| `app.json` | Metadaten, Splash, Privacy URL |
| `eas.json` | iOS-Profil, AAB |
| `supabase-schema.sql` | user_id, RLS-Policies |
| `bridge/api/synthesize.ts` *(neu, optional)* | KI-Synthese Serverless-Funktion |

---

## Verifikation

1. **Auth**: App neu installieren → kein Login-Prompt, aber `supabase.auth.getUser()` gibt User zurück
2. **Datenisolation**: Zwei verschiedene Geräte → sehen gegenseitig keine Daten
3. **RLS**: Mit anon-key direkt gegen Supabase-API anfragen → gibt keine fremden Daten zurück
4. **Onboarding**: AsyncStorage leeren → Onboarding erscheint → endet auf HomeScreen
5. **Datenlöschung**: Einstellungen → Alle Daten löschen → Supabase-Tabellen leer für user_id
6. **Konto-Upgrade**: Anonym starten → E-Mail hinterlegen → App neu starten → Daten noch da
7. **Build**: `eas build --profile production` ohne Fehler