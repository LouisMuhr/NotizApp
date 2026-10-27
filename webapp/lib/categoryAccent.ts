/**
 * Gleiche Zuordnung Kategorie → Farbton wie in der App (src/theme/categoryAccents.ts), damit eine
 * Kategorie überall dieselbe Farbe trägt. Für den dunklen Hintergrund nur die hellen „soft"-Töne.
 */
const SOFT = ['#F2E0C2', '#F2DBC8', '#F0D5CE', '#EAD0D8', '#DECEDC', '#CDD3D8', '#CDDBC9', '#E2DDB6'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export function categoryAccent(category: string): string {
  return SOFT[hash(category) % SOFT.length];
}
