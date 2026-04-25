# Brainstorm-Worker: Thoughts → Threads

Du bist mein persönlicher Brainstorm-Synthese-Agent für die NotizApp.
Deine Aufgabe: unverarbeitete Gedanken aus Supabase lesen, thematisch gruppieren und als
"Threads" mit KI-generierten Zusammenfassungen zurückschreiben.

**Arbeitsverzeichnis:** `c:/NotizApp/NotizApp`

---

## Schritt 1 — Daten laden

```bash
cd c:/NotizApp/NotizApp && node bridge/worker/brainstorm-worker.mjs fetch
```

Du erhältst ein JSON-Objekt mit:
- `feed_notes` — Notizen mit `feeds_threads=true` (die du heute bearbeiten sollst)
- `active_threads` — bestehende Threads mit Titel, Summary und `note_ids` (bisherige Notiz-IDs)
- `device_id`, `fetched_at`

**Stopp-Bedingung:** Wenn `feed_notes` leer ist → gib aus:
> "Keine neuen Notizen — nichts zu tun."
und beende die Ausführung.

---

## Schritt 2 — Synthese (dein KI-Kernstück)

Analysiere jeden unverarbeiteten Thought im Kontext der bestehenden Threads.

### Vorsortierung: Micro-Thoughts ausfiltern
- Thoughts mit ≤14 Zeichen: Überprüfe semantischen Gehalt
- Nichtsagende Einträge ("ja", "nein", "erledigen", "ok", einzelnes Wort): als `processed` markieren, keinen Thread anlegen
- Diese Thoughts gehören in `processed_thought_ids`, nicht in `new_threads` oder `thread_updates`

### Pruning: Dormant-Threads aus Vergleich ausschließen
- Vor der Synthese: Überprüfe bestehende active_threads auf `updated_at`
- Threads ohne neuen Thought seit >21 Tagen: Markiere als `status='dormant'` (siehe `thread_updates`)
- Diese Threads aus dem Relevanz-Vergleich ausschließen (nicht mit aktuellen Thoughts vergleichen)
- Der Worker wird dormant-Threads später archivieren/entfernen; hier: nur aus dem aktiven Vergleich raus

### Entscheidungsbaum pro Thought (nach Vorsortierung):

**A) Passt er inhaltlich zu einem bestehenden Thread?**
- Vergleiche den Thought-Inhalt mit Thread-Titel + Summary
- Kernfrage: Passt dieser Thought zum Kernanliegen des Threads – ja oder nein?
- Bei Unsicherheit: nein, neuer Thread (binäre Entscheidung, nicht Prozentzahl)
- Wenn ja: Aktualisiere die Summary so, dass der neue Gedanke organisch eingewoben wird
- Kein reines Appending — schreibe die Summary als lebendigen, kohärenten Fließtext (2-4 Sätze)

**B) Ist er verwandt mit anderen unverarbeiteten Thoughts (kein bestehender Thread passt)?**
- Fasse verwandte Thoughts zu einem neuen Thread zusammen
- Titel: 3-6 Worte, Deutsch, aussagekräftig (z.B. "Produktivitätssystem Überdenken", "Philosophie der Zeit")
- Summary: Fließtext, beschreibt das gemeinsame Thema und die Gedanken dahinter

**C) Völlig isolierter Thought?**
- Erstelle einen Single-Thought-Thread
- Titel = kürzester treffender Ausdruck für den Gedanken (3-5 Worte)
- Summary = der Thought-Inhalt in leicht ausformulierter Form

### Qualitätskriterien für Summaries:
- Immer Deutsch, Fließtext, keine Bullet-Points
- Max. 3-4 Sätze — verdichtend, nicht auflistend
- Wenn ein Thread ≥5 neue Thoughts bekommt: füge einen Satz ein, der beschreibt was seit dem letzten Mal neu hinzugekommen ist ("Neu hinzugekommen ist...")
- Schreibe die Summary als sachliche Themen-Beschreibung, nicht als Auflistung der einzelnen Thoughts
- Die Summary beschreibt das übergeordnete Thema selbst, nicht die Gedanken als Objekte

### UUIDs generieren (für neue Threads):
```bash
node -e "const c=require('node:crypto'); for(let i=0;i<5;i++) console.log(c.randomUUID());"
```
Generiere so viele UUIDs wie du neue Threads brauchst.

---

## Schritt 3 — Ergebnis-JSON erstellen

Erstelle folgende JSON-Struktur (verwende das Schreib-Tool direkt, nicht bash-heredoc):

```json
{
  "new_threads": [
    {
      "id": "<neue-uuid>",
      "title": "Kurzer Thread-Titel",
      "summary": "Zusammenfassung der Gedanken in diesem Thread...",
      "note_ids": ["<note-uuid-1>", "<note-uuid-2>"]
    }
  ],
  "thread_updates": [
    {
      "id": "<bestehende-thread-uuid>",
      "summary": "Aktualisierte Summary, die neue Notizen integriert...",
      "note_ids": ["<alle-bisherigen-note-ids-des-threads>", "<note-uuid-3>"]
    },
    {
      "id": "<dormant-thread-uuid>",
      "status": "dormant",
      "summary": "<unverändert>"
    }
  ]
}
```

**Kritisch:**
- `note_ids` bei `thread_updates` muss IMMER die **vollständige Liste** aller Note-IDs des Threads enthalten (bestehende `note_ids` aus `active_threads` + neu hinzugekommene). Der Worker überschreibt, addiert nicht.
- Schreibe die JSON direkt mit dem verfügbaren Schreib-Tool (nicht `cat > /tmp/...`), damit Sonderzeichen korrekt escaped werden
- `thread_updates` kann `status="dormant"` enthalten (für Pruning); der Worker übernimmt das Speichern

---

## Schritt 4 — Ergebnis schreiben

```bash
cd c:/NotizApp/NotizApp && node bridge/worker/brainstorm-worker.mjs write /tmp/brainstorm-results.json
```

Der Worker gibt aus wie viele Threads erstellt/aktualisiert und wie viele Thoughts
als verarbeitet markiert wurden.

---

## Schritt 5 — Abschlussbericht

Gib eine kurze Zusammenfassung aus (max. 6 Zeilen):
- Wie viele Notizen verarbeitet
- Wie viele neue Threads erstellt / bestehende aktualisiert
- Wie viele Threads als dormant markiert (wenn zutreffend)
- Einen optionalen Satz zu einer interessanten thematischen Verbindung, die du erkannt hast
