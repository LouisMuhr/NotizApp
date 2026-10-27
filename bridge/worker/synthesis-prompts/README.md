# Synthese-Prompts: gesicherte Versionen

Der aktive Prompt steht immer in `bridge/api/synthesize.ts` (`SYSTEM_PROMPT`). Hier liegen frühere
Stände zum Vergleichen und Zurückgehen. Der Hash ist der `Prompt-Hash` aus den Eval-Berichten in
`bridge/worker/logs/`.

| Version | Datei | Hash | Konfiguration | Hinweis |
|---|---|---|---|---|
| v1 | `v1-baseline.md` | `e2a54305` | Haiku 4.5, kein Thinking | Alter Server (UUIDs, alle Notizen als `feed_notes`). Passt nicht mehr zum heutigen Eingabeformat. |
| v2 | `v2.md` | `0a141a8a` | Haiku 4.5, kein Thinking | Wie v1, nur für den historischen Vergleich. |
| **v8** | `v8.md` + `v8-synthesize.ts.snapshot` | `78a1a561` | Haiku 4.5, **Thinking-Budget 2048** (max_tokens ≥ 10240) | **Rückfallstand.** Snapshot = kompletter Handler zu diesem Zeitpunkt. Thinking lief damals nur über `--thinking` im Eval-Skript. |
| v9 | `v9.md` | `934905ae` | wie v8 | Weniger Vorsicht bei Verbindungen (Ordner-Test, „im Zweifel verbinden“). Läuft mit dem v8-Handler (gleiches Schema). Zweiter Lauf: 4/4 perfekt; Neustart: 2 von 4 legen benachbarte Vorhaben zusammen. **Ohne Thinking unbrauchbar** (3,5 falsche Verbindungen pro Lauf). |
| v10 | `v10.md` + `v10-synthesize.ts.snapshot` | `4310ac8c` | wie v8 | v9 + Regeln gegen Zusammenlegen (Brücken-Notiz, Titel-Probe). 10/10 Läufe mit beiden erwarteten Verbindungen, 0 falsche. Fehler: einmal Finanzen in 3 Threads gespalten (Titel-Probe zu scharf), einmal eine Notiz ohne Thread. |
| v11 | `v11.md` + `v11-synthesize.ts.snapshot` | `dee0711c` | wie v8 | v10 + „was demselben Ziel dient / voneinander abhängt = ein Vorhaben“ + Vollständigkeits-Kontrolle. Neustart 6/6 perfekt gruppiert; aber 3 falsche Verbindungen (2x Finanzen ↔ Kostenthema), vermutlich durch das Beispiel „finanziert“. |
| **v12** | `v12.md` + `v12-synthesize.ts.snapshot` | `0777dfa7` | wie v8 | v11 ohne „finanziert“-Beispiel. **Neustart 6/6 perfekt** (alle Verbindungen, keine falschen). Zweiter Lauf: 2/6 ziehen Ernährung in den Halbmarathon-Thread („gemeinsames Ziel“ zu großzügig). |
| **v13** | `v13.md` + `v13-synthesize.ts.snapshot` | `3598c5d0` | wie v8 | **Aktiver Stand (seit 2026-10-07).** Zusammenhang zählt nur, wenn die Notizen ihn selbst herstellen. Neustart 6/6 perfekt, zweiter Lauf ohne Zusammenlegungen; einziger systematischer Fehler: „Für die Kühlschrank-App …“ bekommt in 3 von 5 Läufen einen eigenen (verbundenen) Thread. **Nur mit Thinking verwenden** — die gelockerten Regeln erzeugen ohne Thinking viele falsche Verbindungen (siehe v9). |

## Gesamtvergleich mit Thinking 2048 (je 6 Läufe ab v11)

| | v8 | v10 | v11 | v12 | v13 |
|---|---|---|---|---|---|
| Neustart perfekt | 2/4 | 5/6 | 4/6 | 6/6 | 6/6 |
| Erwartete Verbindungen (Neustart / zweiter Lauf, von 2) | 1,5 / 1,3 | 2,0 / 2,0 | 2,0 / 2,0 | 2,0 / 1,7 | 2,0 / 1,8 |
| Falsche Verbindungen (gesamt) | 0 | 0 | 3 | 1 | 0 |
| Zusammenlegungen (zweiter Lauf) | 1 | 0 | 0 | 2 | 0 |
| Abspaltungen (zweiter Lauf) | 0 | 2 | 2 | 2 | 3 |

## v8: Messwerte (je 4 Läufe, Haiku 4.5 mit Thinking 2048)

| | Neustart | Zweiter Lauf |
|---|---|---|
| Themen sauber (von 7) | 7,0 | 6,5 |
| Erwartete Verbindungen (von 2) | 1,5 | 1,3 |
| Unerwartete Verbindungen | 0 | 0 |
| Abspaltungen (von 5) | – | 0 |
| Updates nur angehängt | – | 0 von 12 |
| Dauer pro KI-Aufruf | 45–66 s | 31–51 s |

Schwäche: zu vorsichtig bei Verbindungen (Halbmarathon ↔ Ernährung fehlt meist), einmal Ernährung in den
Halbmarathon-Thread gezogen.

## Erneut messen

```
node --experimental-transform-types bridge/worker/eval-synthesize.ts run v8-check-a --scenario incremental --prompt bridge/worker/synthesis-prompts/v8.md --thinking 2048
node --experimental-transform-types bridge/worker/eval-synthesize.ts compare v8t-inc v8-check
```

`--prompt` tauscht nur den Prompt. Ändert sich später das Antwort-Schema im Handler, passt ein alter Prompt
eventuell nicht mehr. Dann den Snapshot zurückspielen.

## Zurückspielen

```
Copy-Item bridge/worker/synthesis-prompts/v8-synthesize.ts.snapshot bridge/api/synthesize.ts
```

Danach `npx jest __tests__/bridge.synthesize.test.ts`. Die Tests sind auf den jeweils aktuellen Handler
ausgelegt; neuere Tests können gegen den alten Stand rot werden.
