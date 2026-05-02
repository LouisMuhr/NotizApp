# NotizApp — Migration auf Editorial Papier-Amber Theme

> **Für Claude Code:** Lies diese Datei vollständig, dann führe die Migration aus.
> Stack: React Native 0.81 + Expo SDK 54 + react-native-paper (MD3) + TypeScript.
> Aktuelles Theme: Deep-Navy Dark, indigo/mint/amber + bunte Kategorie-Gradients.
> Ziel: Editorial Papier-Look, hell, warm, mit Amber als einziger Akzentfarbe.

---

## Designprinzipien des neuen Themes

1. **Papier statt Bildschirm** — cremiges Off-White als Surface, dunkles Espresso-Braun als Tinte. OKLCH-Farben für perzeptuell konsistente Töne.
2. **Eine einzige Akzentfarbe**: warmes Amber. Kategorien werden NICHT mehr durch unterschiedliche Buntfarben unterschieden, sondern durch Hue-Rotation um den Amber-Anker.
3. **Keine Gradients mehr** — Papier ist matt. Statt Gradient-Strips: dünne 0.5px Border, subtile Inset-Highlights via `borderTopColor`.
4. **Serif für Inhalt, Sans für Funktion** — Instrument Serif (Titles, Drop-Caps), Inter (UI, Body, Buttons).
5. **MD3 Light statt Dark** — `MD3LightTheme` als Paper-Basis.

---

## Aufgaben für Claude Code (in dieser Reihenfolge)

### 1. Neue Pakete installieren

```bash
cd NotizApp
npx expo install expo-font @expo-google-fonts/inter @expo-google-fonts/instrument-serif
```

### 2. Dateien ersetzen

Folgende Dateien aus `migration/files/` 1:1 nach `src/` kopieren (überschreiben):

| Quelle in migration/files/ | Ziel im Projekt |
|---|---|
| `theme/theme.ts` | `src/theme/theme.ts` |
| `theme/gradients.ts` | `src/theme/gradients.ts` |
| `theme/typography.ts` | `src/theme/typography.ts` *(neu)* |
| `theme/categoryAccents.ts` | `src/theme/categoryAccents.ts` *(neu)* |
| `components/NoteCard.tsx` | `src/components/NoteCard.tsx` |
| `App.tsx.snippet` | Patch in `App.tsx` einarbeiten (siehe Abschnitt 4) |

### 3. Globale Suche & Ersetzen

In `src/` (alle .tsx/.ts):

- `import { LinearGradient } from 'expo-linear-gradient'` → entfernen oder ungenutzt lassen
- `Shadows.glow(` → `Shadows.softWarm` (kein Glow mehr — Papier glüht nicht)
- `getCategoryGradient(` → `getCategoryAccent(` (siehe `categoryAccents.ts`)
- `theme.colors.background` Werte sind jetzt hell — Status-Bar-Style auf `dark-content` setzen wo `<StatusBar>` aus expo-status-bar verwendet wird

### 4. App.tsx — Fonts laden

In `App.tsx` vor dem Render-Tree:

```tsx
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic,
  });
  if (!fontsLoaded) return null;
  // ... rest wie vorher
}
```

### 5. Status-Bar in App.tsx

```tsx
<StatusBar style="dark" />
```

### 6. Komponenten anpassen (eigenständig durchgehen)

Folgende Files vom alten Stil (LinearGradient, bunte Kategorien, dunkles Theme) auf das neue System umstellen. Halte dich strikt an die Tokens aus `theme/theme.ts` und nutze `categoryAccents.ts` für Kategorie-Differenzierung. Verwende **Instrument Serif für Titles/Headlines** (`fontFamily: 'InstrumentSerif_400Regular'`) und **Inter für alles andere**.

- `src/components/FilterBar.tsx` — Pills mit `paperDeep` Background, Amber für aktiven State
- `src/components/GradientCard.tsx` — kann entfernt werden (Verwendungen durch normale `View` mit `paperDeep` ersetzen) ODER zu `PaperCard.tsx` umbenennen mit Solid-Background
- `src/components/QuickCaptureFAB.tsx` — Solid Amber-Deep Background, `Icon.Pencil`
- `src/components/TimelineNoteCard.tsx` & `TimelineSection.tsx` — kein Gradient, dünne Trennlinien (`rule`-Token)
- `src/screens/HomeScreen.tsx` — Header mit Serif h1 "Notizen", Datum kleingedruckt darüber in Uppercase Inter
- `src/screens/EditorScreen.tsx` — Title-Input in Serif 32px, Body in Inter 15.5px
- `src/screens/ThreadsScreen.tsx` & `ThreadDetailScreen.tsx` — Sparkle-Icon (MaterialCommunityIcons `auto-fix` oder `creation`), Drop-Cap im Detail (erste Buchstabe größer + amber)
- `src/screens/ArchiveScreen.tsx`, `SettingsScreen.tsx` und Sub-Settings — gleiche Pattern, helles Theme, Serif-h1

### 7. Type-Check

```bash
npx tsc --noEmit
```

Behebe TypeScript-Fehler die durch das Theme-Redesign entstehen (z.B. weggefallene Gradient-Namen).

### 8. CLAUDE.md aktualisieren

Update den Theme-Abschnitt in `CLAUDE.md`:

```md
### Theme
`src/theme/theme.ts` — extends `MD3LightTheme` (war: Dark).
Editorial Papier-Stil: cremige OKLCH-Surfaces, Espresso-Tinte, Amber als
einzige Akzentfarbe. Fonts: Instrument Serif (Headings), Inter (UI/Body)
über `expo-font` in App.tsx geladen.
Kategorien werden durch Hue-Rotation in `src/theme/categoryAccents.ts`
unterschieden — keine bunten Gradients mehr.
```

---

## Designsystem-Referenz (zum Nachschlagen)

### Farb-Tokens (OKLCH)

```
paper:        oklch(0.97 0.018 75)   #F6F2EA   Background
paperDeep:    oklch(0.94 0.030 75)   #EDE5D6   Cards
paperEdge:    oklch(0.91 0.035 70)   #E2D8C6   Card-Border
ink:          oklch(0.26 0.020 50)   #2B2419   Primärtext
inkDim:       oklch(0.50 0.020 60)   #6B6354   Sekundärtext
inkFaint:     oklch(0.68 0.020 65)   #A29A8A   Tertiärtext
amber:        oklch(0.72 0.160 65)   #D89A4F   Akzent
amberDeep:    oklch(0.55 0.150 50)   #9C5F1F   CTA / Buttons
amberSoft:    oklch(0.93 0.060 70)   #F2E0C2   Tag-Background, Highlights
rule:         oklch(0.86 0.025 70)   #D7CDB9   Trennlinien
```

### Typografie

- **Instrument Serif 400** — h1, h2, Note-Titles, Drop-Caps, Zitate
  - Display-Sizes: 38, 32, 26, 22, 18 (line-height 1.0–1.2, letter-spacing -0.015em)
- **Inter 400/500/600/700** — Body, UI, Tags, Buttons, Labels
  - Body: 14–15.5 (line-height 1.5–1.65)
  - UI: 13 medium, Tags 11 semibold, Uppercase-Labels 10.5 semibold (letter-spacing 0.08em)

### Card-Pattern (RN)

```tsx
<View style={{
  backgroundColor: '#EDE5D6',         // paperDeep
  borderRadius: 14,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: '#E2D8C6',             // paperEdge
  borderTopColor: 'rgba(255,255,255,0.6)',  // Inset-Highlight
  padding: 16,
}}>
```

### Tag-Chip-Pattern

```tsx
<View style={{
  backgroundColor: '#F2E0C2',         // amberSoft
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 999,
}}>
  <Text style={{
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#9C5F1F',                 // amberDeep
    letterSpacing: 0.1,
  }}>{tag}</Text>
</View>
```

### Schatten (warm, sehr subtil)

```ts
softWarm: {
  shadowColor: '#5C3A12',            // warm tint statt schwarz
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
}
```

### Kategorie-Differenzierung

Statt 7 verschiedener Farb-Gradients: **eine** Akzentfarbe (Amber), Kategorien drehen nur den Hue auf der gleichen Lightness/Chroma-Achse. Sieht beieinander harmonisch aus — wie Tinten in unterschiedlichen Brauntönen.

```ts
// categoryAccents.ts gibt für jede Kategorie ein { soft, deep } zurück
// soft → background, deep → text/icon
// Hues rotieren in 30°-Schritten um 65° (Amber-Anker)
```

---

## Akzeptanz-Kriterien

✅ App startet im hellen Papier-Look ohne TypeScript-Fehler
✅ Keine `LinearGradient`-Aufrufe mehr in `src/components/` oder `src/screens/`
✅ Alle h1/h2 in Instrument Serif gerendert
✅ Tag-Chips und Kategorie-Labels in `amberSoft`/`amberDeep`
✅ Status-Bar zeigt dunkle Icons (light theme)
✅ Swipe-Aktionen (Pin/Delete) funktionieren weiterhin
✅ `CLAUDE.md` aktualisiert
