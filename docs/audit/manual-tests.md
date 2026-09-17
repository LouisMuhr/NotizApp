# Manuelle Testskripte — Vor-Launch-Audit (Phase 2)

Stand: 2026-09-16. Für Fälle, die sich nur auf echten Geräten oder gegen die echte
Supabase-/Bridge-Infrastruktur prüfen lassen. IDs verweisen auf die Edge-Case-Liste
aus Phase 1. Jeder Fall hat: Vorbereitung, Schritte, erwartetes Verhalten, Bug-Indikator.

**Sicherheitshinweis:** X1 und E1 nur gegen eigene Test-Accounts in einem Staging-Projekt
ausführen, niemals gegen fremde UIDs oder die Produktions-DB mit echten Nutzern.

---

## X1 — Statischer Bridge-Admin-Token (P0)

**Vorbereitung:** Zwei Test-Accounts A und B im Staging-Projekt, je mit 2–3 Notizen.
UIDs aus Einstellungen → Synchronisation kopieren. Token aus `bridge/bookmarklet/bookmarklet.html`
(Variable `FIXED_TOK`), *ohne* Zugriff auf `.env`.

**Schritte:**
1. Notizen von A nach B ziehen:
   ```
   curl -X POST https://<bridge>/api/migrate-user \
     -H "Authorization: Bearer <FIXED_TOK>" -H "Content-Type: application/json" \
     -d '{"fromUid":"<UID_A>","toUid":"<UID_B>"}'
   ```
2. App von B neu starten, Notizen-Tab prüfen.
3. Fremde Notiz in A einschleusen:
   ```
   curl -X POST "https://<bridge>/api/note?token=<FIXED_TOK>" \
     -H "Content-Type: application/json" \
     -d '{"user_id":"<UID_A>","title":"Eingeschleust","content":"x"}'
   ```
4. Account A löschen:
   ```
   curl -X POST https://<bridge>/api/delete-user \
     -H "Authorization: Bearer <FIXED_TOK>" -H "Content-Type: application/json" \
     -d '{"uid":"<UID_A>"}'
   ```

**Erwartet:** Alle drei Aufrufe werden abgelehnt (401/403), weil der Aufrufer keinen Nachweis
über die betroffene UID erbringt.
**Bug-Indikator:** 200 `{"ok":true}`; B sieht A's Notizen; A sieht "Eingeschleust"; A's
Login schlägt danach fehl.

---

## E1 — User setzt sich selbst auf Pro (P0)

**Vorbereitung:** Test-Account mit Free-Tier. Access-Token holen (z. B. Debug-Log von
`supabase.auth.getSession()` oder Supabase-Dashboard → Auth → User → "Generate token").

**Schritte:**
1. ```
   curl -X PATCH "https://<projekt>.supabase.co/rest/v1/profiles?id=eq.<UID>" \
     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" -H "Prefer: return=representation" \
     -d '{"tier":"pro"}'
   ```
2. App: Einstellungen → Abo öffnen (oder App neu starten).
3. Threads → Synthetisieren 3× hintereinander.

**Erwartet:** PATCH wird abgelehnt (RLS mit Spaltenfilter oder `tier` nur per Service-Role
schreibbar). Anzeige bleibt Free, zweiter Lauf wird mit Limit abgewiesen.
**Bug-Indikator:** PATCH liefert die Zeile mit `"tier":"pro"` zurück; Abo-Screen zeigt Pro;
drei Läufe gehen durch.

**Zusatzprüfung im SQL-Editor:**
```sql
select policyname, cmd, qual, with_check from pg_policies where tablename = 'profiles';
```
Erwartet: keine UPDATE-Policy für `authenticated` ohne Spaltenbeschränkung (oder gar keine).

---

## C1 — Android: Notizbestand über 2 MB (P0, zu verifizieren)

**Vorbereitung:** Android-Gerät oder Emulator, Debug-Build. `useNextStorage` ist in
`android/gradle.properties` nicht gesetzt, es läuft also das Legacy-SQLite-Backend.

**Schritte:**
1. Skript in der App (z. B. temporär im Dev-Menü) oder per Schleife im Editor: 400 Notizen mit je
   ~6.000 Zeichen Inhalt anlegen (ergibt ~2,4 MB unter `@notizapp_notes`).
   Alternativ: `scripts/seed-demo.mjs` mit langen Inhalten füttern und einmal syncen.
2. App force-killen, neu starten.
3. `adb logcat | grep -i -E "CursorWindow|AsyncStorage"` beobachten.

**Erwartet:** Alle Notizen werden geladen.
**Bug-Indikator:** Leere Notizliste, Log `Row too big to fit into CursorWindow`, Start-Effekt
in `NotesContext` bricht ab (kein Sync, keine Reminder-Neuplanung).

---

## S10 — Realtime nur INSERT: Änderungen anderer Geräte kommen nicht an (P1)

**Vorbereitung:** Zwei Geräte (oder Gerät + zweiter Emulator), gleiches Konto, beide online,
App auf beiden im Vordergrund auf dem Notizen-Tab.

**Schritte:**
1. Gerät A: Neue Notiz "Test S10" anlegen → erscheint auf B binnen Sekunden (INSERT funktioniert).
2. Gerät A: Text von "Test S10" ändern und speichern.
3. Gerät B: 30 s warten, Liste ansehen, Notiz öffnen.
4. Gerät A: Notiz pinnen. Gerät B beobachten.
5. Gerät A: Notiz archivieren (Swipe). Gerät B beobachten.
6. Gerät B: App force-killen, neu starten.

**Erwartet:** B zeigt nach Schritt 2, 4 und 5 den neuen Stand ohne Neustart.
**Bug-Indikator:** B zeigt alten Text/kein Pin/Notiz noch vorhanden bis Schritt 6.

---

## S11 — Threads nach Synthese ohne Realtime (P1)

**Vorbereitung:** Konto mit 3+ Notizen, bei denen "Thread-Feed" aktiv ist; Limit frei.

**Schritte:**
1. Threads-Tab öffnen, App 5 Minuten in den Hintergrund (Home-Button), Gerät sperren.
2. App wieder öffnen (Realtime-Socket wurde vom OS getrennt).
3. Sofort "Synthetisieren" drücken, Snackbar-Text notieren.
4. 20 s warten. Threads-Liste beobachten. Nicht neu starten.
5. Danach App neu starten und vergleichen.

**Erwartet:** Die in der Snackbar gemeldeten Threads erscheinen ohne Neustart.
**Bug-Indikator:** Snackbar "N Threads erstellt", Liste bleibt leer/alt bis zum Neustart.

---

## L1 — Force-Kill direkt nach dem Verlassen des Editors (P1)

**Schritte:**
1. Neue Notiz, 3 Sätze tippen.
2. Mit Zurück-Geste/Back-Button den Editor verlassen (nicht "Speichern" drücken).
3. Innerhalb von <1 s App aus dem Task-Switcher wegwischen (auf Android ggf. `adb shell am force-stop com.velm.app` per vorbereitetem Kommando).
4. App starten.

Zusatz L1b: In Schritt 2 stattdessen 3 Sätze tippen, dann ohne den Editor zu verlassen
`am force-stop` ausführen.

**Erwartet:** L1: Notiz vorhanden. L1b: Entwurf vorhanden oder zumindest Hinweis auf verlorenen Entwurf.
**Bug-Indikator:** Notiz fehlt (L1), Text komplett weg (L1b, aktuell erwartetes Verhalten, kein Autosave).

---

## L5 — Token-Refresh nach langem Hintergrund bei wackligem Netz (P1)

**Vorbereitung:** Supabase-JWT-Laufzeit steht auf Default (1 h). Konto angemeldet.

**Schritte:**
1. App öffnen, dann 70 Minuten in den Hintergrund.
2. Flugmodus **einschalten**.
3. App öffnen, bestehende Notiz bearbeiten und speichern.
4. Nach 10 s Flugmodus ausschalten, 30 s warten.
5. Auf zweitem Gerät (oder Webapp) nachsehen, ob die Änderung angekommen ist.
6. Gerät 1: weitere Notiz anlegen (jetzt online) → prüfen, ob *diese* ankommt.

**Erwartet:** Änderung aus Schritt 3 kommt nach Schritt 4 an (Retry/Outbox).
**Bug-Indikator:** Schritt 3 kommt nie an, Schritt 6 schon. Logcat zeigt `upsertRemote error … JWT expired` oder `network request failed` genau einmal.

---

## A4 — "Konto sichern" ohne E-Mail-Bestätigung (P1)

**Vorbereitung:** Frische Installation (anonymer User). Supabase → Auth → Providers → Email:
"Confirm email" muss **an** sein (Launch-Konfiguration prüfen und hier notieren).

**Schritte:**
1. Einstellungen → Konto → "Konto sichern" mit neuer Mail + Passwort.
2. Toast und angezeigten Status notieren. Mail **nicht** bestätigen.
3. App force-killen, neu starten, Einstellungen → Konto öffnen.
4. 25 Stunden warten (oder in Supabase die Token-Gültigkeit auf 60 s stellen), dann den Link klicken.
5. Auf zweitem Gerät mit Mail + Passwort anmelden.

**Erwartet:** Klarer Zustand "Bestätigung ausstehend" mit Möglichkeit, die Mail erneut zu senden;
Schritt 5 erst nach Bestätigung möglich.
**Bug-Indikator:** Schritt 2 zeigt "Angemeldet", Schritt 3 zeigt "Konto nicht gesichert" ohne Hinweis;
Schritt 4 Link abgelaufen ohne Weg zurück; Schritt 5 schlägt fehl ohne Erklärung.

---

## A5 — Sign-in während ein Schreibvorgang läuft (P1)

**Vorbereitung:** Anonymer User mit Notizen; Netz künstlich langsam (Android: Emulator-Netzwerk
auf "GPRS", iOS: Network Link Conditioner "Very Bad Network").

**Schritte:**
1. Notiz bearbeiten, "Speichern" drücken, sofort zu Einstellungen → Konto wechseln.
2. Innerhalb von 2 s mit bestehendem Konto anmelden.
3. Nach dem Login Notizen-Tab prüfen; nach 1 Minute Webapp/Zweitgerät prüfen.

**Erwartet:** Die Änderung landet im Zielkonto oder wird sichtbar als "nicht synchronisiert" markiert.
**Bug-Indikator:** Änderung fehlt überall (Upsert lief mit altem JWT ins gelöschte anonyme Konto oder 401).

---

## S14 — Tombstone-Liste sprengt die URL-Länge (P1)

**Vorbereitung:** Debug-Build. In AsyncStorage `@notizapp_tombstones` mit 3.000 zufälligen UUIDs
füllen (per Dev-Menü oder `AsyncStorage.setItem` im Debugger).

**Schritte:**
1. App neu starten, Logcat/Metro-Konsole beobachten.

**Erwartet:** Purge läuft in Batches durch oder wird übersprungen, ohne Sync zu blockieren.
**Bug-Indikator:** `[sync] purge failed` / HTTP 414 oder 400; Sync startet trotzdem, aber die
Löschungen werden nie ausgeführt.

---

## P1 — iOS Share Extension (P1)

**Vorbereitung:** iOS-Build (EAS `preview`), auf Gerät installieren. Im Projekt existiert **kein**
`index.share.js`/`.tsx`, obwohl `expo-share-extension` als Plugin konfiguriert ist.

**Schritte:**
1. Safari: Text markieren → Teilen → "Velm".
2. Beobachten, ob ein Share-Sheet erscheint, crasht oder leer bleibt.
3. Velm öffnen, Notizen prüfen.

**Erwartet:** Text landet als neue Notiz.
**Bug-Indikator:** Extension erscheint nicht / crasht / Notiz fehlt. Ggf. schlägt bereits der EAS-Build fehl.

---

## P2 — Android 14: exakte Alarme (P1)

**Vorbereitung:** Android-14-Gerät (API 34+). `USE_EXACT_ALARM` und `SCHEDULE_EXACT_ALARM` sind
im Manifest deklariert; `openExactAlarmSettings()` existiert in `utils/notifications.ts`.

**Schritte:**
1. Frische Installation. Einstellungen → Apps → Velm → "Wecker und Erinnerungen" prüfen (Default: aus, sofern nur `SCHEDULE_EXACT_ALARM`).
2. Erinnerung in 2 Minuten anlegen, App in den Hintergrund, Gerät in Doze (Bildschirm aus, `adb shell dumpsys deviceidle force-idle`).
3. Zeitpunkt der Benachrichtigung notieren.
4. Play-Console-Check: "Wecker und Erinnerungen"-Deklaration für `USE_EXACT_ALARM` — Velm ist keine Wecker-/Kalender-App.

**Erwartet:** Erinnerung pünktlich (±1 min) oder die App fragt beim Anlegen einer Erinnerung
die Freigabe an; Manifest ohne `USE_EXACT_ALARM`.
**Bug-Indikator:** Erinnerung kommt Minuten bis Stunden verspätet; die Freigabe ist nur über
Einstellungen → Benachrichtigungen manuell erreichbar (`openExactAlarmSettings`), beim Anlegen
einer Erinnerung gibt es keinen Hinweis; Play-Review-Ablehnung wegen `USE_EXACT_ALARM`.

---

## P3 — Hintergrund-Sync / Socket-Reconnect (P1)

**Schritte (beide Plattformen):**
1. Gerät A und B gleiches Konto. B in den Hintergrund, 10 Minuten warten.
2. A legt 3 Notizen an, ändert eine bestehende, archiviert eine.
3. B in den Vordergrund holen, 30 s warten, Liste prüfen. Nicht neu starten.

**Erwartet:** B zeigt nach dem Vordergrund-Wechsel alle Änderungen (Pull beim Resume).
**Bug-Indikator:** B zeigt nichts oder nur die 3 neuen Notizen (falls der Socket noch reconnectet hat), Änderung/Archiv fehlen bis zum Neustart.

---

## S9 — Archiv-Ping-Pong (P1, zusätzlich zum Unit-Test)

**Schritte:**
1. Gerät A und B gleiches Konto, Notiz "PingPong" auf beiden sichtbar.
2. B archiviert "PingPong". A neu starten → Notiz fehlt (Remote gelöscht).
   Hinweis: Fall bereits ohne Neustart prüfen, dann mit.
3. Falls A die Notiz noch hat: A bearbeitet sie. B neu starten.
4. A neu starten.

**Erwartet (Entscheidung: `archived_at`):** Beide Geräte zeigen die Notiz im Archiv, A's Änderung bleibt erhalten.
**Bug-Indikator:** Notiz taucht abwechselnd auf/verschwindet; A's Änderung geht beim nächsten B-Start verloren.
