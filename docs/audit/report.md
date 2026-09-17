# Vor-Launch-Audit — Report (Phase 3)

Stand: 2026-09-16 (Audit, Abschnitte 0–3) · Umsetzung 2026-09-17 (Abschnitt 4) · Branch `audit/pre-launch-tests` · Tests: `npm test`
Manuelle Skripte: `docs/audit/manual-tests.md`

Lesart: Die Tests prüfen das **Soll** laut Spezifikation und Produktentscheidungen. Rot = Bug reproduziert.

---

## 0. Testläufe

| Suite | Test | Ergebnis |
|---|---|---|
| notesContext.sync | S1 lokale Notiz ohne Remote bleibt und wird hochgeladen | rot |
| notesContext.sync | S2 lokal neuere Version wird hochgeladen | rot |
| notesContext.sync | S3 leeres Remote löscht keine lokalen Notizen | rot |
| notesContext.sync | S4 1200 Notizen überleben 1000-Zeilen-Cap | rot |
| notesContext.sync | S5 Pin überschreibt nicht fremden Text | rot |
| notesContext.sync | S6 Offline-Start, Notiz wird später nachgeschickt | rot |
| notesContext.sync | S7/S8 Ganze-Zeile-LWW nach Client-Uhr | grün (per Entscheidung 8) |
| notesContext.sync | S9 kein destruktiver Purge archivierter Notizen | rot |
| notesContext.sync | S12 Pull-Fehler lässt lokale Notizen stehen | grün |
| notesContext.sync | S13 zwei addNote im selben Tick | rot |
| notesContext.sync | A2 Sign-in verwirft keine unsynchronisierte Notiz | rot |
| notesContext.sync | L3 State = Platte bei Persist-Fehler | rot |
| notesContext.sync | L4 Restore überlebt Kill zwischen zwei Writes | rot |
| remoteNotes.pagination | S4 pullRemote paginiert | rot |
| subscriptionService | E5 Limit unabhängig von Geräteuhr | rot |
| subscriptionService | E6 Pro-Reset in 30 Min, nicht „1 Tag" | rot |
| subscriptionService | E7 Free-Limit mit Uhrzeit | rot |
| threadsScreen.limitLabel | E6 (UI) Button-Label | rot |
| settingsKonto.signOut | A3 signOut-Fehler → kein Resync | rot |
| bridge.synthesize | Happy Path Claim vor KI-Call | grün |
| bridge.synthesize | Race: Claim verloren → kein Lauf | grün |
| bridge.synthesize | E2c Anthropic-HTTP-Fehler → Rückgabe | grün |
| bridge.synthesize | E2d keine Feed-Notizen → verbraucht | grün (Entscheidung 2) |
| bridge.synthesize | E2a Netzwerkfehler → Rückgabe | rot |
| bridge.synthesize | E2b unparsebare KI-Antwort → Rückgabe + ehrliche Meldung | rot |
| bridge.synthesize | E2e DB-Schreibfehler → Rückgabe | rot |
| bridge.synthesize | E8 Profil nicht ladbar → kein 429/7 Tage | rot |
| bridge.synthesize | A6 Pro-Race → next_allowed_at nicht null | rot |
| bridge.synthesize | E1 Server übernimmt profiles.tier ungeprüft | grün (dokumentiert) |
| bridge.migrate | A1 Client: 500 → kein delete-user | rot |
| bridge.migrate | A1 Client: Teilfehler → kein delete-user | rot |
| bridge.migrate | A1 Server: Teilfehler → kein ok:true | rot |
| bridge.migrate | X1 beliebige fromUid/toUid | rot |

Summe: 26 rot, 7 grün. Manuell (13 Skripte): X1, E1, C1, S9, S10, S11, S14, L1, L5, A4, A5, P1, P2, P3.

---

## 1. Edge-Case-Tabelle

| ID | Edge Case | Kat. | Erwartet (Spezifikation/Annahme) | Tatsächlich | Status |
|---|---|---|---|---|---|
| S1 | Notiz offline erstellt, Neustart online | P0 | Notiz bleibt, wird hochgeladen | Start-Merge löscht sie lokal | Bug (Test rot) |
| S2 | Bestehende Notiz offline bearbeitet | P0 | Änderung wird nachgeschickt | bleibt lokal, wird später vom anderen Gerät überschrieben | Bug (Test rot) |
| S3 | Session/Refresh-Token verloren → neuer anonymer User | P0 | lokale Daten unangetastet | alle lokalen Notizen gelöscht | Bug (Test rot) |
| S4 | > 1000 Notizen | P0 | vollständiger Pull | ab Zeile 1001 lokal gelöscht, keine Pagination | Bug (Test rot, 2 Tests) |
| S5 | Gerät A pinnt, Gerät B hat Text geändert | P0 | Text von B bleibt | ganze Zeile mit altem Text überschrieben | Bug (Test rot) |
| S6 | App-Start offline, Writes danach | P0 | Writes werden nachgeholt | kein Push, kein Retry, beim nächsten Start S1 | Bug (Test rot) |
| A1 | Sign-in: Migration schlägt (teilweise) fehl | P0 | anonymer User nur nach Erfolg gelöscht | wird immer gelöscht, Cascade löscht Daten; Server meldet ok:true bei Teilfehler | Bug (Test rot, 3 Tests) |
| A2 | Sign-in mit unsynchronisierter lokaler Notiz | P0 | Notiz wird ins Konto übernommen | verworfen | Bug (Test rot) |
| A3 | Abmelden offline | P0 | Abbruch mit Fehlermeldung | Resync auf leeren Bestand + „abgemeldet" bei aktiver Session | Bug (Test rot) |
| E1 | User setzt profiles.tier selbst | P0 | tier nur serverseitig schreibbar | RLS „own update" ohne Spaltenfilter, Server vertraut dem Wert | Bug (Review, manuell E1) |
| E2 | Netz-/Parse-/DB-Fehler nach Claim | P0 | Lauf zurück (unsere Schuld) | verbraucht; Parse-Fehler meldet „keine Notizen" | Bug (Test rot, 3 Tests) — zurückgestellt (Entscheidung 2) |
| E3 | Upgrade während laufender Sperre | P0 | Kontingent wird zurückgesetzt (Entscheidung 3) | kein Codepfad | Fehlt |
| E4 | Periodenende, Kündigung, Zahlungsbestätigung | P0 | Server-gesteuert mit Ablaufdatum (Entscheidungen 4/5) | nicht modelliert | Fehlt |
| X1 | Bridge-Admin-Token öffentlich | P0 | Endpunkte prüfen Identität des Aufrufers | statischer Token in bookmarklet.html + App-Bundle; delete/migrate/note für beliebige UIDs | Bug (Test rot, manuell X1) |
| X2 | Fehlerantworten des Synthese-Endpoints | P0-nah | keine Rohdaten an den Client | 300 Zeichen KI-Rohtext, Anthropic-Fehlertext | Bug (Review) |
| C1 | Android, Notizbestand > 2 MB | P0 | lädt | vermutlich CursorWindow-Fehler (Legacy-Backend aktiv) | Verhalten unklar (manuell C1) |
| S7/S8 | Zwei Geräte, gleiche Notiz, offline | P1 | ganze Zeile, neuere gewinnt (Entscheidung 8) | so, inkl. Uhr-Skew-Problem | Funktioniert (Test grün), Verlustpfad bleibt |
| S9 | Archivieren auf B, A bearbeitet weiter | P1 | archived_at remote, beide sehen Archiv | destruktiver Purge, Ping-Pong | Bug (Test rot, manuell S9) |
| S10 | Update/Delete auf anderem Gerät | P1 | live sichtbar | nur INSERT abonniert | Bug (Review, manuell S10) |
| S11 | Threads nach Synthese ohne Realtime | P1 | Liste aktualisiert | nur per Realtime | Bug (manuell S11) |
| S12 | Pull schlägt fehl | P1 | lokal bleibt | lokal bleibt; Sync startet ohne Baseline | Funktioniert (Test grün) mit Rest-Risiko |
| S13 | Zwei Writes im selben Tick | P1 | beide gespeichert | einer verloren (Closure-State) | Bug (Test rot) |
| S14 | Tombstones wachsen unbegrenzt | P1 | Purge in Batches | eine URL mit allen IDs | Bug (Review, manuell S14) |
| L1 | Zurück-Geste + Force-Kill | P1 | Notiz gespeichert | Save nicht awaited, kein Draft | Bug (manuell L1) |
| L2 | Tippen in den 800 ms nach „Speichern" | P1 | Eingabe bleibt | verworfen | Bug (Review) |
| L3 | Speicher voll | P1 | State = Platte | State zeigt Notiz, Platte nicht | Bug (Test rot) |
| L4 | Kill zwischen den Writes von restoreNote | P1 | Restore überlebt | Notiz bleibt im Archiv | Bug (Test rot) |
| L5 | Token abgelaufen, Refresh scheitert kurz | P1 | Write wird wiederholt | 401, verloren | Bug (manuell L5) |
| A4 | Konto sichern ohne E-Mail-Bestätigung | P1 | Zustand „Bestätigung ausstehend" | sofort „Angemeldet", nach Neustart zurück | Bug (manuell A4) |
| A5 | Sign-in während laufendem Write | P1 | landet im Zielkonto | altes Konto oder 401 | Verhalten unklar (manuell A5) |
| A6 | Pro-User verliert Claim-Race | P1 | kein 429 oder gültiges next_allowed_at | 429 mit null, Snackbar zeigt Rohstring | Bug (Test rot) |
| E5 | Geräteuhr falsch | P1 | Server-Wert (Entscheidung 14) | Client rechnet selbst | Bug (Test rot) |
| E6 | Pro um 23:30 UTC | P1 | „in 30 Min" (Entscheidung 13) | „In 1 Tag verfügbar" | Bug (Test rot, 2 Tests) |
| E7 | Free/Basic Settings-Anzeige | P1 | Datum + Uhrzeit | nur Datum | Bug (Test rot) |
| E8 | Profil kurz nicht ladbar | P1 | Serverfehler | 429 mit 7-Tage-Sperre | Bug (Test rot) |
| E9 | Tier-Änderung auf dem Server | P1 | zeitnah sichtbar | nur bei Start/Sign-in/Synthese | Bug (Review) |
| E10 | Feature-Gating nach Entscheidung 7 | P1 | Bookmarklet ab Basic, Webapp ab Pro | kein Gating | Fehlt |
| E11 | Migration anon → Konto | P1 | Limit-Zähler bleibt | profiles nicht migriert | Bug (Review) |
| P1 | iOS Share Extension | P1 | Text wird Notiz | index.share.js fehlt, nur Android-Modul gelesen | Bug (Review, manuell P1) |
| P2 | Android 14 exakte Alarme | P1 | Freigabe beim Anlegen, kein USE_EXACT_ALARM | Freigabe nur in Settings, USE_EXACT_ALARM im Manifest | Bug (Review, manuell P2) |
| P3 | Hintergrund → Vordergrund | P1 | Pull beim Resume | nichts | Bug (manuell P3) |
| K1 | Rohstring `limit_reached` in Snackbar | P2 | übersetzter Text | Rohstring | Bug |
| K2 | Tier kurz „Free" beim Start | P2 | Ladezustand | Race mit Anmeldung | Bug |
| K3 | Similarities bei Migration | P2 | mitgenommen | gelöscht, werden neu gebaut | Kosmetisch |
| K4 | Tombstone-Delete vor Sync-Init | P2 | nachgeholt | Start-Purge fängt es | Funktioniert |
| K5 | saveNotes im setState-Updater | P2 | Seiteneffekt außerhalb | doppelt unter StrictMode | Kosmetisch |
| K6 | Datum ohne Uhrzeit in Snackbar/Settings | P2 | Uhrzeit | nur Datum | mit E6/E7 |

---

## 2. Produktentscheidungen

### Getroffen (Phase 0/1) mit fachlicher Anmerkung

| Nr | Entscheidung | Anmerkung / Empfehlung (Empfehlung, kein Fakt) |
|---|---|---|
| 1 | Rollierende Fenster (7×24 h / 24 h), Pro = UTC-Tag | Empfehlung: in UI und Store-Text „alle 24 Stunden" statt „täglich" schreiben, sonst Support-Fragen. |
| 2 | Lauf zurück bei Fehlern auf unserer Seite, nicht bei „keine Notizen" | Noch zu präzisieren, siehe O1. |
| 3 | Upgrade wirkt sofort, Kontingent auf 0 | Empfehlung: bei Downgrade Zähler behalten, kein Reset. |
| 4 | Kündigung wirkt zum Periodenende | Empfehlung: `expires_at` in profiles, tier-Prüfung `tier if expires_at > now() else free`. |
| 5 | Freischaltung erst nach Serverbestätigung | Empfehlung: RevenueCat-Webhook → Bridge → profiles; Client zeigt „wird geprüft" bis Webhook da ist. |
| 6 | Kauf nur eingeloggt | Empfehlung: Upgrade-Button für anonyme User führt zuerst zu „Konto sichern". |
| 7 | Free: App + Sync + 1×/Woche. Basic: + 1×/Tag + Bookmarklet + schnellere Synthese. Pro: + 10×/Tag + Webvisualisierung | „Schnellere Synthese" braucht eine technische Definition, siehe O4. |
| 8 | Ganze Zeile, neuere gewinnt | Empfehlung: `updated_at` serverseitig per Trigger setzen, damit eine falsche Geräteuhr nicht dauerhaft gewinnt. |
| 9 | Archiv: `archived_at` remote statt Löschung | Umsetzung in Fix-Liste Nr. 8. |
| 10 | Lokale Notizen verwerfen = Bug | Fix-Liste Nr. 3. |
| 11 | Kein Wiederherstellungspfad bei Session-Verlust | Empfehlung: dauerhafter Hinweis „Konto nicht gesichert" in der Notizenliste, solange anonym. Ohne Konto bedeutet Session-Verlust Totalverlust. |
| 12 | Bestätigungspflicht | Empfehlung: Zustand „Bestätigung ausstehend" mit „Mail erneut senden"; Supabase-Setting „Confirm email" dokumentieren. |
| 13 | Uhrzeit statt Tage | Fix-Liste Nr. 6. |
| 14 | Nur Server-Wert | Fix-Liste Nr. 6. |

### Noch offen

- **O1 Rückgabe-Regel (zu Entscheidung 2):** Empfehlung: Lauf wird zurückgegeben bei Netzwerkfehler, Anthropic-Fehler, unparsebarer Antwort, DB-Fehler nach dem KI-Call. Nicht zurückgegeben bei „keine Feed-Notizen" und wenn Threads erfolgreich geschrieben wurden. Technisch: `try/finally` mit `claimed`-Flag im Handler.
- **O2 Zeitstempel-Quelle:** Client-Uhr oder Server (`now()` per Trigger)? Empfehlung: Server, mit Client-`updated_at` nur als Tiebreaker.
- **O3 Grace Period bei Zahlungs-Retry:** Store-Standard sind 3 bis 16 Tage. Empfehlung: RevenueCat-„Grace Period"-Entitlement 1:1 übernehmen, kein eigener Timer.
- **O4 „Schnellere Synthese":** Empfehlung: Basic/Pro bekommen einen kleineren `max_tokens`-Overhead nicht, sondern Priorität in einer Queue ist erst sinnvoll, wenn es eine Queue gibt. Vorschlag: Feature-Text auf „Synthese täglich" reduzieren, „schneller" streichen, bis messbar.
- **O5 Bookmarklet-Architektur:** Bookmarklet braucht ein Geheimnis im Browser. Empfehlung: pro User generierter Token (Hash in profiles), widerrufbar in den Einstellungen, statt globalem Admin-Token.
- **O6 Verhalten bei Identitätswechsel ohne Migration (S3):** Wenn die App eine andere UID sieht als beim letzten Start: still übernehmen, oder Dialog „Konto wechseln / lokale Daten behalten"? Empfehlung: Dialog, lokale Daten niemals stillschweigend verwerfen.

---

## 3. Priorisierte Fix-Liste

**Stufe 1 — vor jedem öffentlichen Build (Datenverlust, Fremdzugriff, Entitlement)**

1. **X1 Bridge-Token.** Sofort rotieren. `delete-user`/`migrate-user` verifizieren das Supabase-JWT (wie `synthesize`) und leiten `fromUid`/`uid` aus dem Token ab, kein UID-Parameter mehr. `note.ts` bekommt Per-User-Token (O5). Token aus `bookmarklet.html`, App-Env und Git-History entfernen (Repo liegt auf GitHub).
2. **E1 RLS.** Policy `profiles: own update` entfernen oder `revoke update (tier, ai_last_run, ai_runs_today, ai_day_reset) on profiles from authenticated`. Schreiben nur per Service-Role.
3. **S1/S2/S3/S4/S6/A2 Sync-Merge.** Start-Merge darf lokale Notizen nie verwerfen: lokal-only → hochladen; lokal neuer → hochladen. `pullRemote` mit `range()`-Schleife. Outbox: `pendingSync`-Flag pro Notiz, Retry bei App-Vordergrund und Netz-Rückkehr. Sign-in: lokale Notizen in das Konto mergen statt `remoteOnly`. Identitätswechsel: Dialog (O6).
4. **A1/A3 Konto-Flows.** `migrateAndDeleteAnonUser`: `res.ok` und `results` prüfen, bei Fehler abbrechen. Server: Migration als eine Postgres-Funktion (RPC, eine Transaktion), 500 bei Fehler. `handleSignOut`: `error` prüfen, bei Fehler nichts verändern.
5. **S5/S10/P3 Realtime.** `postgres_changes` mit `event: '*'` für notes; Pull beim `AppState → active`. Updates als PATCH nur geänderter Felder oder Merge gegen frisch gepullten Stand vor dem Upsert.

**Stufe 2 — vor Launch (Abrechnung, Limits, Kernflows)**

6. **E2/E8/A6/E5/E6/E7/K1 Synthese-Endpoint und Anzeige.** `try/finally` mit Release (O1). Profil-Fetch-Fehler → 503. Pro-Race: Claim einmal wiederholen. Client speichert `next_allowed_at` aus der Server-Antwort und zeigt Uhrzeit (`toLocaleString` mit Stunde/Minute), Countdown in Minuten unter 24 h. `computeNextAllowedAt` im Client entfernen.
7. **E3/E4/E9/E10 Zahlung.** RevenueCat einbinden, Webhook → Bridge → profiles (`tier`, `expires_at`, `ai_runs_today = 0`, `ai_last_run = null` bei Upgrade). Tier-Prüfung im Endpoint über `expires_at`. Client: `refreshSubscription` nach Kauf, beim Vordergrund und per Realtime auf profiles. Gating: Bookmarklet-Screen und `/api/note` ab Basic, Webapp-Graph ab Pro.
8. **S9 Archiv.** Spalte `archived_at`; Archivieren = PATCH statt DELETE; Pull filtert; Restore setzt null; Purge-Logik entfernen.
9. **S13/L3/L4 Write-Konsistenz.** `notes` über `useRef` spiegeln und Updates funktional (`setNotes(prev => …)`); erst persistieren, dann State setzen, bei Fehler Toast. `restoreNote`: Archiv zuerst schreiben, Loader toleriert Doppelvorkommen bereits.
10. **L1/L2 Editor.** `beforeRemove`: `e.preventDefault()`, `await save`, dann `navigation.dispatch(e.data.action)`. `hasSavedRef` durch Dirty-Check ersetzen. Draft-Autosave alle 2 s in AsyncStorage.
11. **P1 iOS Share.** `index.share.tsx` anlegen (expo-share-extension-Doku), Text an die App übergeben, `ShareHandler` für iOS ergänzen. Im Preview-Build testen.
12. **C1 Android Storage.** Manuell verifizieren. Falls bestätigt: `AsyncStorage_useNextStorage=true` in `android/gradle.properties` oder Notizen pro ID speichern (`multiGet`).

**Stufe 3 — nach Launch planbar**

13. **S14** Purge in 200er-Batches, Tombstones nach erfolgreichem Purge leeren.
14. **X2** Fehlerantworten auf generische Codes reduzieren, Rohtext nur ins Server-Log.
15. **A4/A5/E11** Pending-Zustand für E-Mail-Bestätigung; laufende Writes vor Sign-in abwarten (`inflight`-Zähler); Limit-Zähler bei Migration per `greatest()` zusammenführen.
16. **P2** `USE_EXACT_ALARM` aus `app.json` entfernen; beim Anlegen einer Erinnerung `openExactAlarmSettings()` anbieten, wenn nicht freigegeben.
17. **K2–K6** Kosmetik.

---

## 4. Umsetzung (Stand 2026-09-17, Branch `audit/pre-launch-tests`)

Die Abschnitte 0–3 sind der unveränderte Audit-Stand vom 16.09. Dieser Abschnitt dokumentiert, was danach
umgesetzt wurde. Regel: Tests wurden nicht abgeschwächt; wo Test-Scaffolding angepasst werden musste,
steht es in 4.3.

### 4.1 Testlauf nach Umsetzung

`npm test` → **9 Suites, 55 Tests, 55 grün, 0 rot.** Typecheck App (`npx tsc --noEmit`) und Bridge
(`bridge/`: `npx tsc --noEmit`) ohne Fehler.

| Suite | Tests | Vorher | Jetzt |
|---|---|---|---|
| notesContext.sync | S1, S2, S3, S4, S5, S6, S7/S8, S9, S12, S13, A2, L3, L4 | 11 rot, 2 grün | 13 grün |
| remoteNotes.pagination | S4 | rot | grün |
| subscriptionService | E5, E6, E7 | 3 rot | 3 grün |
| threadsScreen.limitLabel | E6 (UI) | rot | grün |
| settingsKonto.signOut | A3 | rot | grün |
| bridge.synthesize | Happy Path, Race, E2a–e, E8, A6, E1 | 5 rot, 5 grün | 10 grün |
| bridge.migrate | A1 Client ×2, A1 Server, X1 | 4 rot | 4 grün |
| mergeNotes (neu) | 10 Regressionstests für die Merge-Regeln | – | 10 grün |
| bridge.auth (neu) | 12 Tests: migrate/delete/note/bookmarklet-token, Positiv- und Negativpfade | – | 12 grün |

Hinweis zu E1 (bridge.synthesize): der Test dokumentiert weiterhin, dass der Endpoint `profiles.tier`
vertraut. Das ist gewollt — die Absicherung ist die entfernte RLS-Policy (SQL-Migration), nicht der Endpoint.

### 4.2 Umgesetzt — was jetzt funktioniert

**Stufe 1**

| Fix | Umsetzung | Nachweis |
|---|---|---|
| 1 X1 Bridge-Token | Kein Admin-Token mehr in App oder Bookmarklet. `migrate-user`/`delete-user` verifizieren Supabase-JWTs (`_lib/supabaseAdmin.ts`), UIDs kommen nur aus Tokens; Migration nur anonym → Konto. `/api/note` nutzt persönlichen Bookmarklet-Schlüssel (`/api/bookmarklet-token`, nur Hash in `profiles.bookmarklet_token_hash`, widerrufbar). `FIXED_TOK` aus `bookmarklet.html` entfernt, `EXPO_PUBLIC_BRIDGE_BEARER` wird nicht mehr gelesen. | bridge.migrate X1, bridge.auth (12) |
| 2 E1 RLS | `profiles: own update` entfernt (Migration + Schema). | SQL; manuell E1 nach Ausrollen |
| 3 Sync-Merge | Neues Modell in `src/sync/mergeNotes.ts` + `NotesContext`: Outbox (`@notizapp_pending_sync`), letzte Sync-UID (`@notizapp_sync_uid`), LWW-Merge, der lokale Notizen nie stillschweigend verwirft; `pullRemote` paginiert (500er Seiten); Sign-in merged (`'merge'`), Sign-out ersetzt (`'replace'`) nach `flushPending()`. Pull + Outbox-Flush zusätzlich bei App-Vordergrund. | S1, S2, S3, S4 (×2), S6, S12, S13, A2, mergeNotes |
| 4 Konto-Flows | Client löscht anonymen User nur bei `ok:true` und vollständigen `results`; Server: RPC `migrate_user` (eine Transaktion, inkl. `thread_similarities` und Limit-Zähler per `greatest()`); `handleSignOut` prüft `error` von `signOut()` und bricht ab. | A1 (×3), A3, bridge.auth |
| 5 Realtime / Stale-Write | `subscribeRemote` abonniert `event: '*'` (INSERT/UPDATE/DELETE, `replica identity full`); Updates gehen als PATCH nur geänderter Felder (`upsertRemote(uid, note, patch)`) mit Fallback auf Upsert; Pull beim `AppState → active`. | S5; S10/P3 manuell |

**Stufe 2**

| Fix | Umsetzung | Nachweis |
|---|---|---|
| 6 Synthese-Endpoint & Anzeige | `try/catch` um alles nach dem Claim: Netz-, KI-, Parse- und DB-Fehler geben den Lauf zurück (`releaseRun`), „keine Notizen" und Erfolg verbrauchen ihn (O1 wie empfohlen). Profil nicht ladbar → 503. Claim-Race: Profil neu lesen, einmal Retry, sonst 429 `busy` mit `next_allowed_at`. Client übernimmt `next_allowed_at` aus der 429-Antwort (`setServerNextAllowedAt`), `computeNextAllowedAt` vergleicht nicht mehr mit der Geräteuhr. Anzeige via `src/utils/limitFormat.ts`: „In 30 Minuten verfügbar" / „Ab 16:32 verfügbar" / „Ab Do., 17. Sep., 16:32 verfügbar"; Settings → Abo zeigt Datum + Uhrzeit. Snackbar-Rohstrings (K1) durch übersetzte Fehlertexte ersetzt. | E2a, E2b, E2e, E8, A6, E5, E6 (×2), E7 |
| 8 Archiv | `notes.archived_at`; Archivieren = PATCH, Wiederherstellen = `archived_at: null`; Start-Purge löscht nur noch Tombstones; Webapp-Graph und Synthese filtern `archived_at is null`. | S9, L4, mergeNotes |
| 9 Write-Konsistenz | Alle Mutationen über `allRef` (kein Closure-State), Writes serialisiert, State wird bei Write-Fehler von der Platte zurückgelesen; Loader löst Doppelvorkommen per LWW auf; `nextTimestamp()` garantiert monotone `updatedAt`. | S13, L3, L4 |
| 10 Editor | `beforeRemove` wartet auf den Save (`preventDefault` + `dispatch`), Dirty-Check statt „einmal gespeichert"-Flag, Folge-Saves aktualisieren die neu angelegte Notiz statt zu duplizieren; Fehler-Toast bei fehlgeschlagenem Speichern. | manuell L1/L2 |

**Stufe 3**

| Fix | Umsetzung |
|---|---|
| 13 S14 | `deleteRemote` in Batches à 200. |
| 14 X2 | Synthese/Note/Migrate/Delete antworten nur noch mit Fehlercodes; Rohtext und Stacktraces gehen ins Server-Log. |
| 15 E11 / K3 | Limit-Zähler und `thread_similarities` werden in `migrate_user` mitgenommen. |
| 16 P2 | `USE_EXACT_ALARM` aus `app.json` entfernt (`SCHEDULE_EXACT_ALARM` bleibt). |

Weitere Änderungen: Bookmarklet-Settings-Screen erzeugt den Schlüssel (Hinweis für anonyme/Free-User),
`bridge/README.md` und `CLAUDE.md` aktualisiert.

### 4.3 Test-Scaffolding, das angepasst wurde (Erwartungen unverändert)

- **notesContext.sync**: Der `upsertRemote`-Mock bildet jetzt die PATCH-Semantik ab (nur übergebene Felder
  überschreiben), weil der Fix genau diese Server-Semantik einführt. Alle Assertions unverändert.
- **settingsKonto.signOut**: `useNotes`-Mock um `flushPending` ergänzt (neue Context-API).
- **threadsScreen.limitLabel**: Mock setzt `setI18nLocale('de')`, weil er `locale: 'de'` meldet; Regex nur noch DE.
- **subscriptionService E6/E7**: Die Tests prüften eine Kopie der alten Screen-Formel (`Math.ceil` Tage bzw.
  `toLocaleDateString`) — beide waren so nie erfüllbar. Sie prüfen jetzt die echte gemeinsame Funktion
  (`formatAvailability` / `formatDateTime`). Erwartung identisch: Minuten/Uhrzeit statt Tage.

### 4.4 Nicht umgesetzt — steht wie in Abschnitt 1–3

| ID | Grund |
|---|---|
| E3, E4, E9, E10 (Fix 7) Zahlung | Braucht Payment-Provider (RevenueCat) mit Webhook → Bridge → `profiles.expires_at`. Ohne Provider-Entscheidung und Keys nicht umsetzbar. Gating existiert bereits für das Bookmarklet (`BOOKMARKLET_MIN_TIER`), nicht für die Webapp. |
| P1 iOS Share | `index.share.tsx` für `expo-share-extension` fehlt weiterhin; nur im iOS-Build testbar. |
| C1 Android > 2 MB | Nicht verifiziert; `AsyncStorage_useNextStorage` nicht gesetzt. Zuerst manuell C1 laufen lassen. |
| A4, A5, S11, L5 | Manuell (Skripte in `manual-tests.md`), kein Code geändert. |
| O2 Zeitstempel-Quelle, O3 Grace Period, O4 „schnellere Synthese", O6 Dialog bei Identitätswechsel | Offene Produktentscheidungen; O6 wurde vorerst als „stiller Merge + Upload" umgesetzt (kein Datenverlust, aber kein Dialog). |
| E5 vollständig | Der Vergleich „ist die Grenze vorbei?" läuft weiterhin auf der Geräteuhr; die Grenze selbst ist Server-abgeleitet, der 429-Wert gewinnt. Vollständig serverseitig nur per RPC (`now()` in Postgres). |
| K2, K4, K5 | Kosmetik, unverändert. |

### 4.5 Ausrollen (manuell, in dieser Reihenfolge)

1. `supabase-migration-2026-09-17.sql` im SQL-Editor des Projekts ausführen.
2. Bridge deployen (`bridge/`: `vercel deploy --prod`); in Vercel `MCP_BEARER_TOKEN` löschen/rotieren,
   `BRIDGE_USER_ID` kann bleiben (nur Worker). Optional `BOOKMARKLET_MIN_TIER`.
3. Alter Token bleibt in der Git-History (`bookmarklet.html`) — Rotation ist deshalb Pflicht, nicht optional.
4. Bestehende Bookmarklets funktionieren nicht mehr: Nutzer erzeugen in der App einen Schlüssel und legen das
   Bookmarklet neu an.
5. App-Build: erster Start nach dem Update behandelt alle lokalen Notizen als „pending" (keine Sync-UID
   gespeichert) → lädt sie hoch. Lokal archivierte Notizen werden dabei mit `archived_at` remote angelegt.
6. Manuelle Skripte X1, E1, S9, S10, P3, L1 gegen Staging durchlaufen.
