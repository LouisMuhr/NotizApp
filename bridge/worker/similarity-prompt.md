# Similarity-Worker — Prompt für Claude Code

Du analysierst die Threads des NotizApp-Systems und erkennst thematische Verbindungen.

## Ablauf

**Schritt 1:** Führe aus (vom Repo-Root `c:\NotizApp\NotizApp`):
```
node bridge/worker/similarity-worker.mjs fetch
```

**Schritt 2:** Analysiere die ausgegebenen Threads.
Identifiziere Paare die thematisch verwandt sind oder zur selben übergeordneten Kategorie gehören.

Kriterien für eine Verbindung:
- Gleiche Domäne (z.B. mehrere Software/App-Ideen-Threads)
- Ähnliches Ziel oder Thema (z.B. Gesundheit & Fitness, Lernen & Bildung)
- Inhaltliche Überschneidung in den Summaries

Erstelle KEIN Paar wenn Threads nur oberflächlich ähnlich sind ("beide handeln von Plänen").
Lieber weniger, dafür bedeutungsvolle Verbindungen.

**Schritt 3:** Lösche bestehende Einträge (frischer Start):
```
node bridge/worker/similarity-worker.mjs clear
```

**Schritt 4:** Schreibe die neuen Paare. Das JSON-Array direkt als Argument (einfache Anführungszeichen):
```
node bridge/worker/similarity-worker.mjs write '[{"thread_id_1":"...","thread_id_2":"...","label":"Oberkategorie"}]'
```

Falls keine bedeutungsvollen Verbindungen existieren:
```
node bridge/worker/similarity-worker.mjs write '[]'
```

## Ausgabe-Format

```json
[
  {
    "thread_id_1": "<uuid>",
    "thread_id_2": "<uuid>",
    "label": "Softwareideen"
  }
]
```

`label` = die übergeordnete Kategorie die beide verbindet (kurz, 1-3 Wörter, Deutsch).
