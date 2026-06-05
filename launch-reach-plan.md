# NotizApp — Launch & Reichweite (Go-to-Market)

> Ergänzung zu `finish-plan.md`. Jener Plan deckt **Technik & Store-Readiness** ab.
> Dieses Dokument deckt **Reichweite ab** — wie echte Nutzer die App finden und ihr vertrauen.
> Kernprinzip: **Reichweite zuerst, Monetarisierung danach.** Eine Paywall ohne Nutzer bringt 0 €.

---

## TL;DR — die ehrliche Reihenfolge

1. **Play Store ist dein Reichweiten-Hebel, nicht dein Hindernis.** Kein anderer Kanal liefert
   kostenlos Nutzer, die aktiv nach einer Notiz-App suchen. Die 15 % Gebühr sind der Preis dafür.
2. **Differenzierung schlägt Kategorie.** „Noch eine Notiz-App" ist tot. „App, die deine wirren
   Gedanken automatisch zu Themen-Threads verdichtet" ist eine Story. Verkaufe das KI-/Graph-Feature.
3. **Bezahlung erst nach den ersten echten Nutzern.** Der `tier`-Mechanismus (Supabase `profiles.tier`)
   ist schon gebaut. RevenueCat lässt sich in ~1 Tag nachrüsten, sobald sich jemand dafür interessiert.

---

## Phase A: Was du JETZT kontrollierst (kein Google-Warten)

### A.1 ASO — App Store Optimization (höchster Hebel, kostenlos)

Die meisten Play-Store-Installs kommen aus der **Suche**, nicht aus „Featured". Optimiere die drei
Felder, die Google rankt:

**App-Titel** (stärkstes Ranking-Signal — Keyword gehört in den Titel):
- ❌ „NotizApp"
- ✅ „NotizApp: Notizen & KI-Ideen"  *(oder: „Notizen, Aufgaben & KI")*

**Kurzbeschreibung (80 Zeichen)** — zweitstärkstes Signal. Such-Keywords statt Poesie:
- ❌ „Gedanken festhalten. Verbindungen aufbauen. Ideen synthetisieren."
- ✅ „Notizen, Aufgaben & Sprachmemos – KI verbindet deine Ideen automatisch."

**Lange Beschreibung** — Differenzierung in die ersten 2 Zeilen (alles darunter wird abgeschnitten,
bevor man „mehr" tippt). Deutsche Such-Begriffe natürlich einstreuen: *Notizen, Notizbuch, Aufgaben,
Checkliste, Erinnerung, Sprachnotiz, KI, synchronisieren*.

→ Konkrete Umsetzung: `store/store-description.md` überarbeiten (TODO, siehe A.5).

### A.2 Screenshots — 80 % der Install-Entscheidung

Reihenfolge ist alles. Die ersten zwei entscheiden, ob jemand installiert:

| # | Zeigt | Warum |
|---|-------|-------|
| 1 | **KI-Synthese / Graph** mit Text-Overlay „Deine Gedanken werden automatisch zu Themen" | Dein Alleinstellungsmerkmal. Keine andere Notiz-App hat das. |
| 2 | Schnellerfassung / Voice-Capture | „So leicht geht Festhalten" |
| 3 | Notiz mit Checkliste + Kategorie-Farben | Vertraute Notiz-Funktionen, schön gestaltet |
| 4 | Erinnerungen / Pinnen | Alltagsnutzen |
| 5 | Sync über Geräte | Vertrauen / „meine Daten sind sicher" |

- Format Android: 1080×1920 px (oder höher, 9:16). Min. 2, max. 8.
- Text-Overlays auf jeden Screenshot (Nutzer scrollen schnell — nackte UI-Shots wirken nicht).
- Tool: Figma o. ä. — Rahmen + kurze Headline pro Bild.

### A.3 Feature-Grafik (Play Store Pflicht)
- 1024×500 px. Erscheint oben auf der Store-Seite. App-Name + ein Satz Nutzenversprechen.

### A.4 Privacy / Data-Safety (Pflicht, sonst keine Freigabe)
- Datenschutzerklärung existiert: `store/privacy/` + `app.json` → `privacyPolicyUrl`. ✅
- Play Console „Data Safety"-Formular: angeben, dass Notiz-Inhalte in Supabase (Cloud) gespeichert
  und synchronisiert werden, Audio nur lokal verarbeitet (sofern zutreffend).

### A.5 Offene TODOs in diesem Repo (selbst kontrollierbar)
- [ ] `store/store-description.md` ASO-optimieren (Titel, Kurzbeschr., Keywords)
- [ ] 5 Screenshots mit Overlays erstellen → `store/screenshots/`
- [ ] Feature-Grafik 1024×500 → `store/feature-graphic.png`
- [ ] Kurz-Demo-Video (15–30 s) der KI-Synthese — für Reddit/ProductHunt/Store

---

## Phase B: Distribution — warum Play Store (und was NICHT)

Bewertung der Alternativen, falls die Frage wieder aufkommt:

| Kanal | Reichweite | Payment frei? | Urteil |
|-------|-----------|---------------|--------|
| **Google Play** | ★★★★★ | ❌ Play Billing | **Haupt-Launch.** Wo deutsche Android-Nutzer suchen. |
| Samsung Galaxy Store | ★★ | ⚠️ eigenes Billing | Ergänzung möglich (auf jedem Samsung vorinstalliert), nicht Ersatz. |
| F-Droid | ★ | ✅ | Nur Open-Source → passt nicht (Closed-Backend, Abo). |
| Direkter APK-Download | ★ | ✅ Stripe | „Unbekannte Quelle"-Warnung killt Vertrauen bei Normalnutzern. Nur Tech-Zielgruppe. |
| EU-Alt-Stores (DMA) | ★ | ✅ | Kaum Nutzer + Core-Technology-Fee. 95 % weniger Reichweite für 15 % gespart. Schlechter Deal. |

**Fazit:** Play Store als Hauptkanal. Optional Samsung Galaxy Store als zweiter Eintrag (gleiches AAB).
Web/Stripe nur, falls die Webapp später als eigener Akquise-Kanal ausgebaut wird (eigenes Produktthema).

---

## Phase C: Organische Reichweite (nach Store-Live)

Eine „atomare Gedanken → Threads"-App trifft die **PKM / Second-Brain-Community** — die teilt gern.

- **Reddit:** r/productivity, r/Notes, r/PKM, r/Notetaking, dt. r/de_EDV — ehrlicher „I built this"-Post
  mit dem Demo-Video. Keine Werbung, sondern Story: *„Ich habe ein Tool gebaut, das meine wirren
  Notizen automatisch zu Themen sortiert."*
- **Product Hunt:** Launch an einem Di–Do. Demo-Video + GIF. Vorab ein paar Leute fürs Upvote sammeln.
- **Hacker News „Show HN":** wenn du den technischen Winkel (Supabase + Claude-Synthese) betonst.
- **TikTok/Reels (optional):** 15-s-Clip „Chaos rein → Themen raus". Visuelles Feature = teilbar.
- **Indie-Maker-Communities:** Indie Hackers, dt. Tech-Discords.

Pro Kanal **einen** guten, ehrlichen Post — nicht spammen. Der Graph + die Auto-Synthese sind der Hook.

---

## Phase D: Monetarisierung (NACH ersten Nutzern) — RevenueCat + Android

Erst bauen, wenn Nutzer da sind. Der Mechanismus ist vorbereitet; es fehlt nur die Verkabelung.

**Was schon da ist:**
- `src/sync/subscriptionService.ts` → `openUpgradeFlow()` ist ein Platzhalter (`Alert` „bald verfügbar").
- `profiles.tier` in Supabase = Single Source of Truth (App + `bridge/api/synthesize.ts` lesen sie).
- `SettingsAboScreen` + `ProBanner` + Restore-Button existieren und funktionieren UI-seitig.

**Was fehlt (ca. 1 Tag Arbeit, + Dashboard-Setup):**
1. **Google Play Console:** Abo-Produkte `basic_monthly` (1,99 €) + `pro_monthly` (4,99 €) anlegen
   (geht erst, wenn die App als Entwurf hochgeladen ist).
2. **RevenueCat-Dashboard:** Play-Service-Account verbinden, Entitlements `basic`/`pro` an Produkte koppeln.
3. **App-SDK:** `react-native-purchases` installieren (braucht EAS-Build, läuft nicht in Expo Go) →
   `openUpgradeFlow()` echt implementieren + Restore verkabeln. RevenueCat-App-User-ID = Supabase-User-ID.
4. **Backend-Webhook:** `bridge/api/revenuecat-webhook.ts` → setzt `profiles.tier` bei Kauf/Kündigung
   (serverseitige Validierung, niemals dem Client vertrauen).

> Wichtig: Das **Nadelöhr ist nicht der Code**, sondern Google-Account-Verifizierung + Produkt-Freigabe
> (oft Tage). Deshalb Monetarisierung bewusst nach hinten schieben und zuerst launchen.

---

## Empfohlene Reihenfolge (Reichweite)

| Schritt | Aufgabe | Google-Warten? |
|---------|---------|----------------|
| 1 | ASO: `store-description.md` + Titel + Keywords | nein |
| 2 | Screenshots (5) + Feature-Grafik + Demo-Video | nein |
| 3 | Play Console anlegen, App als Entwurf hochladen, Data-Safety ausfüllen | Account-Verifizierung |
| 4 | Internal Testing Track → Beta mit 5–10 echten Leuten | nein |
| 5 | Produktion einreichen → Review | Google-Review (Tage) |
| 6 | Organischer Launch: Reddit + Product Hunt + Demo-Video | nein |
| 7 | **Erst danach:** RevenueCat verkabeln, sobald Nachfrage da ist | Produkt-Freigabe |

---

## Verifikation

1. **ASO:** Such im Play Store nach „notizen ki" / „gedanken app" → erscheint NotizApp?
2. **Screenshots:** Zeig Screenshot 1 jemandem 3 Sek lang — versteht er, was die App besonders macht?
3. **Beta:** 5 fremde Tester installieren über Internal-Testing-Link, geben Feedback.
4. **Monetarisierung (später):** Testkauf im Internal-Track → `profiles.tier` wechselt auf `basic`/`pro`.
