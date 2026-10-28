// Dev check: print WCAG contrast of the key Cast pairs after REF·DB's palette remap. Run: node src/cast/contrast.check.ts
import { themeCss } from './theme.ts';
const vars = (mode: string) => {
  const block = themeCss.split('\n')[mode === 'dark' ? 0 : 1];
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):([^;]+);/g)].map((m) => [m[1], m[2]]));
};
const lum = (hex: string) => {
  const n = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const cr = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs: [string, string, string][] = [
  ['primary text on base', '--cast-text-primary', '--cast-surface-base'],
  ['description on base', '--cast-text-description', '--cast-surface-base'],
  ['description on subtle', '--cast-text-description', '--cast-surface-subtle'],
  ['placeholder on base', '--cast-text-placeholder', '--cast-surface-base'],
  ['brand fg on base', '--cast-intents-brand-default-default-fg', '--cast-surface-base'],
  ['bold fg on bold bg', '--cast-intents-brand-bold-default-fg', '--cast-intents-brand-bold-default-bg'],
  ['bold hover', '--cast-intents-brand-bold-hover-fg', '--cast-intents-brand-bold-hover-bg'],
  ['list selected', '--cast-list-item-selected-fg', '--cast-list-item-selected-bg'],
  ['danger fg on base', '--cast-intents-danger-default-default-fg', '--cast-surface-base'],
  ['neutral fg on base', '--cast-intents-neutral-default-default-fg', '--cast-surface-base'],
  ['ok on panel', '--site-ok', '--rd-panel'],
  ['warn on panel', '--site-warn', '--rd-panel'],
  ['accent on panel', '--rd-accent', '--rd-panel'],
  ['muted on panel', '--rd-muted', '--rd-panel'],
];
for (const mode of ['dark', 'light']) {
  const v = vars(mode);
  for (const [name, a, b] of pairs) console.log(mode.padEnd(6), name.padEnd(24), v[a], v[b], cr(v[a], v[b]).toFixed(2));
}
