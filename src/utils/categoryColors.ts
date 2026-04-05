const PALETTE = [
  '#7B6EF6', // indigo
  '#3ECFB4', // mint
  '#FFB347', // amber
  '#60A5FA', // sky blue
  '#FF6B81', // coral
  '#A78BFA', // lavender
  '#F472B6', // pink
  '#34D399', // emerald
  '#FB923C', // orange
  '#38BDF8', // light blue
];

export function getCategoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
