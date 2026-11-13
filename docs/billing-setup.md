# Abos über Google Play (RevenueCat) einrichten

Code ist fertig (App, Bridge, Migration). Damit Käufe wirklich funktionieren, fehlen diese Schritte
außerhalb des Codes, in dieser Reihenfolge.

## 1. Google Play Console
1. Zahlungsprofil anlegen (Konto → Zahlungsprofil), sonst lassen sich keine Abos anlegen.
2. App muss mit einem Build **mit RevenueCat-SDK** (Billing-Berechtigung) in mindestens einem Test-Track
   liegen (intern reicht), sonst zeigt die Console „Monetarisierung" nicht an.
3. Monetarisierung → Abos: **ein** Abo `velm_pro` mit zwei Basis-Plänen
   - `monthly`, 4,99 € / Monat, automatisch verlängernd
   - `yearly`, 39,99 € / Jahr, automatisch verlängernd
   Beide aktivieren. Länderpreise übernimmt Google automatisch.
   Testphase: an beiden Basis-Plänen ein Angebot „Kostenloser Testzeitraum" 7 Tage, Berechtigung
   „Neue Kunden" (nie Abo gehabt). Die App liest die Testphase aus dem Store und zeigt sie nur, wenn
   Google sie dem Konto anbietet.
   `velm_basic` (früheres Modell Free/Basic/Pro) wird nicht mehr verkauft: inaktiv lassen, nicht löschen.
4. Einstellungen → Lizenztests: eigene Google-Konten als Lizenztester eintragen (Testkäufe ohne echte Abbuchung,
   Abos verlängern sich im Minutentakt).
5. Prüfen, ob für das Konto die Pflicht „geschlossener Test mit 12 Testern über 14 Tage" gilt
   (privates Entwicklerkonto nach Ende 2023). Wenn ja: Tester jetzt einladen, sonst wird der Launch am 23.12. knapp.

## 2. RevenueCat (app.revenuecat.com)
1. Projekt anlegen → App „Play Store", Paketname `com.velm.app`.
2. Service-Account-JSON aus der Google Cloud mit Rechten in der Play Console hinterlegen
   (Anleitung im RevenueCat-Dashboard; Freischaltung dauert bei Google bis zu 36 h).
   Im Cloud-Projekt des Dienstkontos **drei** APIs aktivieren: Google Play Android Developer API,
   Google Play Developer Reporting API, **Cloud Pub/Sub API** (sonst lehnt RevenueCat das JSON ab).
   Rollen am Dienstkonto: Pub/Sub-Administrator, Monitoring-Betrachter. Play-Console-Rechte: App-Infos ansehen,
   Finanzdaten ansehen, Bestellungen und Abos verwalten.
3. Produkte importieren: `velm_pro:monthly`, `velm_pro:yearly`.
4. Entitlement `pro` → beide Produkte. **ID exakt so**, die Bridge mappt sie in
   `bridge/api/_lib/billing.ts` (`ENTITLEMENT_TIER`; `basic` steht dort nur noch für Altbestand).
5. Offering `default` (als Current): Pakete mit **eigenen** IDs `pro_monthly` und `pro_yearly`
   (`PACKAGE_ID` in `src/sync/billing.ts`). Ein altes Paket `basic_monthly` ignoriert die App.
6. API-Keys: öffentlichen Android-SDK-Key (`goog_…`) → `.env` als `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
   Secret-Key (v1, `sk_…`) → Vercel (Bridge) als `REVENUECAT_SECRET_KEY`.
7. Integrations → Webhooks: URL `https://<bridge>/api/billing-webhook`, Authorization-Header = selbst
   gewählter langer Zufallswert → Vercel als `REVENUECAT_WEBHOOK_AUTH`. „Send test event" muss 200 liefern.
8. DPA im RevenueCat-Dashboard akzeptieren (DSGVO, siehe `docs/dsgvo/verarbeitungsverzeichnis.md`).

## 3. Datenbank
`supabase/migrations/2026-11-10-billing.sql` im SQL-Editor ausführen (fügt `tier_source`, `tier_expires_at`,
`billing_synced_at` zu `profiles` hinzu). **Vor** dem Bridge-Deploy, sonst schlägt der Abgleich fehl.
Bestehende Hand-Tiers (z. B. dein Pro-Konto) bleiben `manual` und werden vom Store nie heruntergesetzt.

## 4. Bridge + App
1. `vercel deploy --prod` (Bridge) mit den beiden neuen Env-Vars.
2. **Neuer nativer Build nötig**: `react-native-purchases` ist ein natives Modul, ein OTA-Update reicht nicht.
   `runtimeVersion` folgt `appVersion`. Dann `eas build -p android --profile production` und in den
   internen Test-Track (`versionCode` zählt EAS selbst hoch: `appVersionSource: remote` + `autoIncrement`).
3. Testen: als Lizenztester Pro monatlich kaufen → Plan wechselt sofort; jährlich kaufen;
   in Google Play kündigen → nach Ablauf zurück auf Free; App neu installieren → „Käufe wiederherstellen".
4. Bridge-Env: `BOOKMARKLET_MIN_TIER` auf Vercel entweder löschen (Default `pro`) oder auf `pro` setzen.

## Ablauf (Kurzfassung)
App kauft unter der Supabase-UID → ruft `/api/billing-sync` → Bridge fragt RevenueCat → schreibt
`profiles.tier`. Verlängerung/Kündigung/Ablauf kommen über `/api/billing-webhook`, ebenfalls nur als
Anlass für einen Abgleich. Ohne bestätigtes Konto kein Kauf (Abo hängt am Konto, nicht am Gerät).
