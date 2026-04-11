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
- `unprocessed_thoughts` — Gedanken wo `processed_at IS NULL` (die du heute bearbeiten sollst)
- `active_threads` — bestehende Threads mit Titel und Summary
- `recent_processed_thoughts` — Kontext-Thoughts der letzten 7 Tage (bereits verarbeitet, nur zur Orientierung)
- `device_id`, `fetched_at`

**Stopp-Bedingung:** Wenn `unprocessed_thoughts` leer ist → gib aus:
> "Keine neuen Gedanken — nichts zu tun."
und beende die Ausführung.

---

## Schritt 2 — Synthese (dein KI-Kernstück)

Analysiere jeden unverarbeiteten Thought im Kontext der bestehenden Threads.

### Entscheidungsbaum pro Thought:

**A) Passt er inhaltlich zu einem bestehenden Thread?**
- Vergleiche den Thought-Inhalt mit Thread-Titel + Summary
- Wenn thematische Überschneidung ≥ ~60%: dem bestehenden Thread zuordnen
- Aktualisiere die Summary so, dass der neue Gedanke organisch eingewoben wird
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
- Schreibe in der dritten Person über die Gedanken, nicht als Ich-Aussage

### UUIDs generieren (für neue Threads):
```bash
node -e "const c=require('node:crypto'); for(let i=0;i<5;i++) console.log(c.randomUUID());"
```
Generiere so viele UUIDs wie du neue Threads brauchst.

---

## Schritt 3 — Ergebnis-JSON erstellen

Speichere das Synthese-Ergebnis in eine temporäre Datei:

```bash
cat > /tmp/brainstorm-results.json << 'ENDJSON'
{
  "new_threads": [
    {
      "id": "<neue-uuid>",
      "title": "Kurzer Thread-Titel",
      "summary": "Zusammenfassung der Gedanken in diesem Thread...",
      "thought_ids": ["<thought-uuid-1>", "<thought-uuid-2>"]
    }
  ],
  "thread_updates": [
    {
      "id": "<bestehende-thread-uuid>",
      "summary": "Aktualisierte Summary, die neue Gedanken integriert...",
      "thought_count": 5,
      "new_thought_ids": ["<thought-uuid-3>"]
    }
  ],
  "processed_thought_ids": ["<uuid-1>", "<uuid-2>", "<uuid-3>"]
}
ENDJSON
```

**Kritisch:** `processed_thought_ids` muss ALLE `unprocessed_thoughts`-IDs enthalten —
auch wenn ein Thought als isolierter Single-Thread angelegt wurde.

---

## Schritt 4 — Ergebnis schreiben

```bash
cd c:/NotizApp/NotizApp && node bridge/worker/brainstorm-worker.mjs write /tmp/brainstorm-results.json
```

Der Worker gibt aus wie viele Threads erstellt/aktualisiert und wie viele Thoughts
als verarbeitet markiert wurden.

---

## Schritt 5 — Abschlussbericht

Gib eine kurze Zusammenfassung aus (max. 5 Zeilen):
- Wie viele Thoughts verarbeitet
- Wie viele neue Threads erstellt / bestehende aktualisiert
- Einen optionalen Satz zu einer interessanten thematischen Verbindung, die du erkannt hast
