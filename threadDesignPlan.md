# IMPLEMENTIERUNGS-PLAN: ThreadDetailScreen Timeline

## TL;DR
Umwandlung des flachen Note-Lists in eine **chronologisch gruppierte, zeitliche Ansicht**:
- Notizen sortieren nach `created_at`
- In Zeitfenster gruppieren (vor >2 Wo., letzte Wo., letzte 3 Tage, heute)
- Neue Notizen (`💡`) vs. alte (`🔹`) unterscheiden (Schwelle: 3 Tage vor `thread.last_synthesized_at`)
- Lesedauer-Schätzung anzeigen (Content-Länge / 200 Zeichen pro Minute)
- Bestehende Summary-Card oben beibehalten, neue `TimelineSection` darunter
- **Keine Breaking Changes** in Datenstrukturen; nur UI-Logik

---

## Steps (Implementierungs-Reihenfolge)

### Phase 1: Utility-Funktionen ⚙️
**Neue Datei:** `NotizApp/src/utils/timeGrouping.ts`

Funktionen:
- `groupNotesByTime(notes: Note[], referenceDate: Date)` 
  - Input: alle Thread-Notizen + Referenzdatum (wird `now` sein)
  - Output: 4 Gruppen mit Labels: `{label: "Vor >2 Wochen", notes: [...]}`, etc.
  - Sortiert chronologisch absteigend (älteste oben)

- `getTimeLabel(startDate: Date, endDate: Date): string`
  - "Vor >2 Wochen" | "Letzte Woche" | "Letzte 3 Tage" | "Heute"

- `calculateReadTime(content: string): number`
  - `Math.ceil(content?.length ?? 0 / 200)` 
  - Gibt Minuten zurück

- `isNewNote(noteCreatedAt: Date, lastSyncAt: Date): boolean`
  - `return (now - noteCreatedAt) < 3 * 24 * 60 * 60 * 1000` (3 Tage in ms)
  - Wenn true → `💡`-Icon, sonst `🔹`

### Phase 2: TimelineNoteCard Komponente 🃏
**Neue Datei:** `NotizApp/src/components/TimelineNoteCard.tsx`

Props:
```typescript
{
  note: Note,
  isNew: boolean,
  readTime: number
}
```

Layout:
```
┌─────────────────────────────────┐
│ 💡 Notiz-Titel                  │
│                                 │
│ "First 100 characters of       │
│  content preview..."            │
│                                 │
│ 📍 ~3 Min read · vor 2 Tagen   │
└─────────────────────────────────┘
```

Styling:
- Wenn `isNew=true`: 
  - Icon: Mint-Farbe (#3ECFB4)
  - Border: Mint-Akzent (1px left border)
  - Opacity: 1.0
- Wenn `isNew=false`:
  - Icon: Standard (#7B6EF6)
  - Border: Standard
  - Opacity: 0.8

*Depends on: Phase 1*

### Phase 3: TimelineSection Komponente 📂
**Neue Datei:** `NotizApp/src/components/TimelineSection.tsx`

Props:
```typescript
{
  groupLabel: string,  // z.B. "Letzte Woche"
  notes: Note[],
  lastSyncAt: Date
}
```

Rendert:
- Header: `📅 {groupLabel}` mit Primary-Farbe
- Darunter: List von `TimelineNoteCard` mit 12px gap

*Depends on: Phase 2*

### Phase 4: Integration in ThreadDetailScreen 🔗
**Änderungen in:** `NotizApp/src/screens/ThreadDetailScreen.tsx`

1. Import hinzufügen:
   ```typescript
   import { groupNotesByTime, isNewNote } from '../utils/timeGrouping';
   import TimelineSection from '../components/TimelineSection';
   ```

2. In `export default function ThreadDetailScreen`:
   ```typescript
   const groupedNotes = groupNotesByTime(threadNotes, new Date());
   ```

3. Alte Section ersetzen:
   ```typescript
   {/* ALTE VERSION: */}
   {threadNotes.map((note) => (
     <View key={note.id} style={[styles.noteCard, ...]}>
       ...
     </View>
   ))}
   
   {/* NEUE VERSION: */}
   {groupedNotes.map((group, idx) => (
     <TimelineSection
       key={idx}
       groupLabel={group.label}
       notes={group.notes}
       lastSyncAt={thread.lastSynthesizedAt}
     />
   ))}
   ```

*Depends on: Phase 1-3*

### Phase 5: Styling & Polish 🎨
**Neue Styles in:** `NotizApp/src/screens/ThreadDetailScreen.tsx`

```javascript
timelineGroupContainer: {
  marginBottom: 24,
  gap: 12,
},
timelineGroupHeader: {
  fontSize: 12,
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  opacity: 0.7,
  marginBottom: 8,
}
```

Update `scrollContent`:
```javascript
scrollContent: {
  padding: 16,
  gap: 16,  // bleibt gleich
}
```

### Phase 6: Verifikation & Tests ✅
Nicht-automatisiert (manuelle Tests im Simulator):
- Thread öffnen mit Notizen aus >2 Wochen, 1 Woche, 3 Tage, heute → 4 Sections sichtbar?
- Lesedauer korrekt (600 Zeichen = ~3 Min)?
- 💡-Icon nur auf Notizen der letzten 3 Tage?
- Summary-Card oben unverändert?
- Scroll performant mit 20+ Notizen?

---

## Relevant Files

| Datei | Status | Was |
|-------|--------|-----|
| `NotizApp/src/utils/timeGrouping.ts` | **NEU** | 4 Utility-Funktionen für Zeit-Logik |
| `NotizApp/src/components/TimelineNoteCard.tsx` | **NEU** | Einzelne Notiz-Karte mit Icon + Preview + Metadaten |
| `NotizApp/src/components/TimelineSection.tsx` | **NEU** | Container für eine Zeitgruppe (Header + NoteList) |
| `NotizApp/src/screens/ThreadDetailScreen.tsx` | **MODIFY** | Alten noteCard-Loop ersetzen mit `TimelineSection`-Loop |

---

## Verification Checklist

### Unit-Tests (Code-Level)
- `groupNotesByTime()` mit 3 Mock-Notizen verschiedener Daten
- `calculateReadTime()`: 200 Zeichen → 1 Min, 600 → 3 Min
- `isNewNote()`: Grenzfälle (3d, 2.9d, 3.1d vor lastSync)

### UI-Tests (Simulator)
```
✓ Thread mit 5 Notizen laden (verschiedene Daten)
✓ 4 Zeitgruppen-Header sichtbar & korrekt
✓ 💡-Icon nur auf neuen Notizen
✓ Lesedauer im erwarteten Range
✓ Summary-Card oben nicht verändert
✓ Scroll-Performance mit 30+ Notizen
```

### Edge Cases
- Thread mit 0 Notizen → nur Summary
- Thread mit 1 Notiz → 1 Section mit 1 Card
- Notiz mit 5000+ Zeichen → >25 Min read

---

## Decisions

| Entscheidung | Begründung |
|--------------|-----------|
| **Zeit-Kategorien**: vor >2 Wo., letzte Wo., letzte 3 Tage, heute | Visuelle Granularität ohne Overload; kann später angepasst werden |
| **"Neu"-Schwelle**: 3 Tage vor `thread.last_synthesized_at` | Match mit "Letzte 3 Tage" Kategorie; user-friendly |
| **Lesedauer**: 200 Zeichen/Min | Schnell berechenbar, intuitive Proxie |
| **Keine DB-Changes** | Nur UI-Logik, zero Breaking Changes |
| **Icons**: `lightbulb-outline` (neu) vs. `circle-small` (alt) | Material Design, minimalistisch |

---

## Further Considerations (Optional für später)

### Lesedauer präziser?
- Option A (aktuell): Zeichen-basiert (schnell)
- Option B (später): Wort-basiert (150-200 Wörter/Min, mehr Indologie-korrekt)

### Notiz-Preview-Länge
- Aktuell: Beliebig
- Alternative: Auf 100 Zeichen + "..." limitieren für konsistente Card-Höhe

### Datum-Format variabel
- Aktuell: "vor 5 Tagen"
- Alternative: "Mo., 15. Apr." für präzisere Zeitangabe auf Demand

### Notiz-Thumbnails
- Optional: Category-Chip oder kleine Kategorie-Farbe neben Icon für mehr visueller Info

---

**Status:** ✅ Plan dokumentiert & bereit zur Implementierung.
