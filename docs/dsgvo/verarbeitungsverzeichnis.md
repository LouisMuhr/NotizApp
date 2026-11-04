# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 Abs. 1 DSGVO) – Velm

Stand: 2026-11-04 · Grundlage: `docs/audit/dsgvo-2026-11-04.md` · bei jeder Änderung an Datenflüssen mitpflegen.
Dieses Dokument ist intern. Auf Anfrage der Aufsichtsbehörde vorlegen, nicht veröffentlichen.

## 0. Verantwortlicher

| | |
|---|---|
| Verantwortlicher | Louis Muhr, Velm (Einzelunternehmen) |
| Anschrift | [Straße Hausnummer, PLZ Ort] – identisch mit `webapp/lib/legal.ts` |
| Kontakt Datenschutz | louismuhr8@gmail.com |
| Datenschutzbeauftragter | nicht benannt (keine Pflicht nach § 38 BDSG: < 20 Personen ständig mit Verarbeitung befasst, keine Kerntätigkeit nach Art. 37 Abs. 1 lit. b/c) |
| Vertreter in der EU | entfällt (Sitz in Deutschland) |

## 1. Übersicht der Auftragsverarbeiter

| Dienstleister | Sitz | Leistung | Datenort | Transfergrundlage | AVV abgelegt |
|---|---|---|---|---|---|
| Supabase Inc. | USA | Datenbank, Auth, Auth-Mails, Cron | Frankfurt (eu-central-1) | DPF bzw. SCC im DPA | ☐ |
| Vercel Inc. | USA | Hosting Webapp + Bridge-Funktionen, Logs | Funktionen Frankfurt (fra1), CDN global | DPF bzw. SCC im DPA | ☐ |
| Anthropic PBC | USA | KI-Synthese, KI-Sprachnotizen (Claude Haiku) | USA | SCC im DPA (Teil der Commercial Terms) | ☐ |
| 650 Industries, Inc. (Expo) | USA | OTA-App-Updates (EAS Update), Builds | USA | DPF bzw. SCC im DPA | ☐ |
| Stripe Payments Europe Ltd. / Stripe, Inc. | IE / USA | Zahlungsabwicklung (sobald angebunden) | EU / USA | SCC / DPF | ☐ |
| [ggf. SMTP-Anbieter] | | Versand Auth-Mails, falls in Supabase eingetragen | | | ☐ |

Eigenständig Verantwortliche (keine Auftragsverarbeitung): Google (Android-Spracherkennung), Apple (iOS-Spracherkennung,
App Store), Google Play. Werden in der Datenschutzerklärung genannt.

---

## 2. Verarbeitungstätigkeiten

### V1 – Lokale Notizverwaltung (App ohne Konto)

| | |
|---|---|
| Zweck | Notizen, Kategorien, Erinnerungen, Threads auf dem Gerät verwalten |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Betroffene | Nutzer der App |
| Daten | Notizinhalte, Kategorien, Erinnerungszeitpunkte, Einstellungen, Geräte-Sprache |
| Empfänger | keine – Daten verlassen das Gerät nicht |
| Drittland | nein |
| Löschung | durch den Nutzer (Löschen, Deinstallation) |

### V2 – Nutzerkonto und Authentifizierung

| | |
|---|---|
| Zweck | Konto anlegen, E-Mail per Code bestätigen, Anmeldung, Passwort-Reset, Passwortwechsel |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Betroffene | registrierte Nutzer, Registrierungs-Interessenten |
| Daten | E-Mail, Passwort-Hash (bcrypt), optional Anzeigename (Webapp), Sprache (`user_metadata.locale`), Zeitstempel (Registrierung, Bestätigung, letzte Anmeldung), Session-Tokens, IP bei Auth-Requests |
| Empfänger | Supabase |
| Drittland | Supabase Inc. USA (Daten in Frankfurt) |
| Löschung | Kontolöschung durch Nutzer (sofort, Cascade auf alle Inhalte); unbestätigte Registrierungen bei Abbruch sofort, sonst nach 30 Tagen (pg_cron `delete-unconfirmed-signups`, täglich 03:17 UTC) |

### V3 – Synchronisation und Web-App

| | |
|---|---|
| Zweck | Notizen/Threads geräteübergreifend synchronisieren, Graph in der Web-App anzeigen, Notizen im Web anlegen/löschen |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Betroffene | Nutzer mit bestätigtem Konto |
| Daten | Notizen (Titel, Text, Checkliste, Kategorie, Pin, Erinnerung, Quelle, Archiv-Status, Zeitstempel), Threads, Zusammenfassungen, Verbindungen; ggf. besondere Kategorien (Art. 9), soweit Nutzer sie selbst notieren |
| Empfänger | Supabase, Vercel (Webapp-API) |
| Drittland | Unternehmenssitz USA, Verarbeitung in Frankfurt |
| Löschung | endgültiges Löschen einer Notiz → sofort vom Server; Archiv bleibt bis zum Löschen; Konto-Löschung → alles |

### V4 – KI-Synthese (Threads bilden)

| | |
|---|---|
| Zweck | auf Nutzeraktion Notizen thematisch zu Threads gruppieren und Verbindungen finden |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO; bei sensiblen Inhalten Art. 9 Abs. 2 lit. a (ausdrückliche Veranlassung durch den Nutzer) |
| Betroffene | Nutzer mit bestätigtem Konto |
| Daten | Titel + Text noch nicht zugeordneter Notizen, Titel/Summary/Notiz-Titel bestehender Threads, bestehende Verbindungen (nur Kurz-Referenzen statt IDs), Sprache; Zähler `profiles.ai_*` |
| Empfänger | Vercel (Bridge), Anthropic |
| Drittland | Anthropic USA (SCC) |
| Löschung | Anthropic: ≤ 30 Tage (Standard-API, kein Training); Ergebnis (Threads) wie V3 |

### V5 – KI-Sprachnotizen (Pro)

| | |
|---|---|
| Zweck | diktierten Text in Titel, Inhalt, Checkliste und Erinnerung strukturieren |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO (Schalter pro Aufnahme) |
| Daten | erkannter Text (≤ 4000 Zeichen), Sprache, Zeitzone; Zähler `profiles.voice_ai_*`; bei Fehlschlag lokal in `@notizapp_pending_parse` (≤ 3 Tage) |
| Empfänger | Vercel (Bridge), Anthropic |
| Drittland | Anthropic USA (SCC) |
| Löschung | Anthropic ≤ 30 Tage; lokale Warteschlange ≤ 3 Tage bzw. 5 Versuche |

### V6 – Spracherkennung (Diktat)

| | |
|---|---|
| Zweck | Sprache in Text umwandeln |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Daten | Audio (nur flüchtig beim Systemdienst), erkannter Text |
| Empfänger | Systemdienst des Betriebssystems: Google (Android) bzw. Apple (iOS) als eigenständig Verantwortliche; offline auf dem Gerät |
| Drittland | ggf. USA (Google/Apple) |
| Löschung | Velm speichert kein Audio |

### V7 – Bookmarklet und Teilen

| | |
|---|---|
| Zweck | markierten Text aus dem Browser bzw. geteilten Text aus anderen Apps als Notiz speichern |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Daten | markierter Text, Seitentitel, URL der Seite; Tageszähler über `notes.source` |
| Empfänger | Vercel (Webapp, Bridge `/api/note`), Supabase |
| Drittland | wie V3 |
| Löschung | wie V3 |

### V8 – Abo-Verwaltung und Zahlungen (ab Stripe-Anbindung)

| | |
|---|---|
| Zweck | Abos abschließen, abrechnen, verwalten; Funktionsumfang nach Tier freischalten |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b (Vertrag), lit. c (§ 147 AO, § 257 HGB) |
| Daten | Tier, Abo-Status, Stripe-Kunden-ID, Beträge, Rechnungen; Zahlungsdaten nur bei Stripe |
| Empfänger | Stripe, Steuerberater/Finanzamt |
| Drittland | Stripe, Inc. USA (SCC/DPF) |
| Löschung | Abrechnungsbelege 8 Jahre (Buchungsbelege) bzw. 10 Jahre (Bücher); Tier mit Konto |

### V9 – Betrieb, Sicherheit, Server-Logs

| | |
|---|---|
| Zweck | Dienst ausliefern, Fehler finden, Missbrauch abwehren, Rate-Limits |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherem Betrieb) |
| Daten | IP-Adresse, Zeitpunkt, URL, User-Agent, Statuscodes; Fehlerlogs ohne Notizinhalte (nur Status/Codes) |
| Empfänger | Vercel, Supabase |
| Drittland | Unternehmenssitz USA |
| Löschung | gemäß Log-Aufbewahrung der Anbieter (Tage) |

### V10 – App-Updates und Verbindungsprüfung

| | |
|---|---|
| Zweck | OTA-Updates ausliefern; vor dem Diktat prüfen, ob online |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO |
| Daten | IP, App-Version, Runtime-Version, Plattform (Expo); IP beim Abruf von `velmnote.com/ping` (Vercel) |
| Empfänger | Expo, Vercel |
| Drittland | USA |
| Löschung | gemäß Log-Aufbewahrung der Anbieter |

### V11 – Kommunikation und Betroffenenanfragen

| | |
|---|---|
| Zweck | Support, Auskunft/Löschung/Berichtigung nach Art. 15–21 |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b bzw. lit. c DSGVO |
| Daten | E-Mail-Adresse, Inhalt der Anfrage, Antwort |
| Empfänger | E-Mail-Anbieter (Google, Gmail) |
| Drittland | USA (Google, DPF) |
| Löschung | 3 Jahre nach Abschluss (Nachweis der Erfüllung, Verjährung § 195 BGB) |

### V12 – Browser-Speicher der Web-App

| | |
|---|---|
| Zweck | Anmeldesitzung halten, Sprache und „Intro gesehen" merken, Graph kurz zwischenspeichern |
| Rechtsgrundlage | § 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b DSGVO |
| Daten | Supabase-Session (localStorage), `velm_locale`, `velm_intro_seen`, `velm_graph_intro_<uid>`, Graph-Cache (sessionStorage) |
| Empfänger | keine (nur im Browser) |
| Löschung | Abmelden / Browserdaten löschen; sessionStorage beim Schließen des Tabs |

---

## 3. Technische und organisatorische Maßnahmen (Art. 32)

**Vertraulichkeit**
- Zugriffskontrolle Datenbank: Row Level Security auf allen Tabellen (`auth.uid() = user_id`), Queries filtern zusätzlich explizit nach `user_id`.
- Bridge-Endpunkte prüfen jedes Supabase-Access-Token serverseitig (`verifyToken`), Ziel-User nur aus dem Token, nie aus dem Body.
- Service-Role-Key nur in Vercel-Umgebungsvariablen, nie im App-Bundle; kein Admin-Token in der App.
- SECURITY-DEFINER-Funktionen nicht über die REST-API aufrufbar.
- Passwörter nur als bcrypt-Hash (Supabase Auth); Passwortwechsel nur nach E-Mail-Code.
- Ohne bestätigtes Konto keine Übertragung von Inhalten (lokal-first).
- Admin-/Dashboard-Zugänge (Supabase, Vercel, Expo, GitHub, Anthropic, Stripe): starkes Passwort + 2FA. ☐ prüfen

**Integrität**
- TLS für alle Verbindungen (HTTPS only).
- KI kann Threads nur ergänzen, nie Status setzen oder Notizen löschen; Server übersetzt Kurz-Referenzen und vergibt IDs selbst.
- Eingaben serverseitig begrenzt (Bookmarklet ≤ 50.000 Zeichen, Diktat an KI ≤ 4000 Zeichen).

**Verfügbarkeit und Belastbarkeit**
- Lokale Datenhaltung auf dem Gerät, Server ist Synchronisationsziel; Outbox gegen Datenverlust bei Netzfehlern.
- Rate-Limits für KI und Bookmarklet pro Konto.
- Datenbank-Backups durch Supabase (gemäß Tarif).

**Datenminimierung und Löschung**
- Keine Analytics, kein Tracking, kein Crash-Reporting, keine Werbe-SDKs.
- An die KI gehen nur noch nicht zugeordnete Notizen und Kurz-Referenzen statt IDs.
- Keine Notizinhalte in Logs.
- Kontolöschung in der App: Server-Konto zuerst (Cascade auf alle Tabellen), dann lokal.
- Automatische Löschung unbestätigter Registrierungen nach 30 Tagen.
- Anzeigename in der Web-App optional.

**Überprüfung**
- Supabase Security Advisors nach jeder Schemaänderung prüfen.
- Dieses Verzeichnis und die Datenschutzerklärung bei neuen Diensten/Datenflüssen aktualisieren.
- Jährliche Durchsicht (nächste: November 2027).

---

## 4. Risikoabwägung / Schwellwertanalyse DSFA (Art. 35)

Eine Datenschutz-Folgenabschätzung ist nach derzeitiger Einschätzung **nicht erforderlich**:
- keine systematische Überwachung, kein Profiling, keine automatisierten Entscheidungen mit Rechtswirkung (Art. 22);
- keine gezielte Verarbeitung besonderer Kategorien; sensible Inhalte können vorkommen, werden aber nur gespeichert und nur auf
  ausdrückliche Nutzeraktion an die KI gegeben;
- kleine Nutzerzahl, kein Abgleich/Zusammenführen von Datenbeständen;
- kein Tatbestand der DSK-„Muss-Liste“ einschlägig (KI-Einsatz zur Steuerung der Interaktion mit Betroffenen oder Bewertung persönlicher
  Aspekte findet nicht statt; die KI gruppiert Notizen, sie bewertet keine Personen).

Neu bewerten bei: deutlich wachsender Nutzerzahl, KI-Funktionen ohne Nutzeraktion (z. B. automatische Synthese), Audio-Speicherung,
Analyse-/Tracking-Tools, Verarbeitung für Dritte (Teams).
