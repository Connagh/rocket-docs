// REF·DB on Cast UI: one palette for the Cast components, the prose and the diagrams.
//
// Cast UI resolves every colour from its theme, and react-native-web passes CSS custom properties through untouched.
// So instead of rendering the islands once per colour mode, every colour leaf of the Cast scheme becomes
// `var(--cast-…)`, and the real values live in CSS under [data-theme]. Switching mode is then a pure CSS change: no
// re-render, no flash of the wrong mode before hydration, and prose and SVG diagrams read the same variables.
import { colorSchemes, type ColorScheme } from '@castui/cast-ui';

type Mode = 'light' | 'dark';

// Cast's stock palette is Tailwind gray + blue + red. REF·DB keeps the red for danger, swaps the brand blue for a
// rocket-exhaust orange, and gives the greys a deep-space navy cast in dark mode and a cool blueprint slate in light.
const BRAND: Record<string, string> = {
  '#EFF6FF': '#FFF7ED',
  '#DBEAFE': '#FFEDD5',
  '#BFDBFE': '#FED7AA',
  '#93C5FD': '#FDBA74',
  '#60A5FA': '#FB923C',
  '#3B82F6': '#EA580C',
  '#2563EB': '#C2410C', // bold fill: white text on it is 5.2:1
  '#1D4ED8': '#9A3412',
  '#1E40AF': '#7C2D12',
  '#1E3A8A': '#5A2209',
};

const GREY: Record<Mode, Record<string, string>> = {
  dark: {
    '#F9FAFB': '#F8FAFC',
    '#F3F4F6': '#F1F5F9',
    '#E5E7EB': '#E4EAF3',
    '#D1D5DB': '#C9D3E1',
    '#9CA3AF': '#9DABC2',
    '#6B7280': '#6C7B95',
    '#4B5563': '#3B4864',
    '#374151': '#26324B',
    '#1F2937': '#121A2C',
    '#111827': '#0A101E',
  },
  light: {
    '#F9FAFB': '#F7F9FC',
    '#F3F4F6': '#EDF1F6',
    '#E5E7EB': '#DCE3EC',
    '#D1D5DB': '#C4CEDB',
    '#9CA3AF': '#8A98AE',
    '#6B7280': '#56647C',
    '#4B5563': '#434F68',
    '#374151': '#283246',
    '#1F2937': '#18202F',
    '#111827': '#0E1525',
  },
};

// Site tokens Cast has no slot for: status colours, the page canvas behind the panels, and the diagram palette that
// the SVG figures in src/components use (--rd-*).
const SITE: Record<Mode, Record<string, string>> = {
  dark: {
    '--site-canvas': '#05080F',
    '--site-glow': 'rgba(251, 146, 60, 0.10)',
    '--site-ok': '#4ADE80',
    '--site-ok-bg': 'rgba(74, 222, 128, 0.10)',
    '--site-warn': '#FBBF24',
    '--site-warn-bg': 'rgba(251, 191, 36, 0.10)',
    '--site-info': '#67C6D6',
    '--site-info-bg': 'rgba(103, 198, 214, 0.10)',
    '--site-danger-bg': 'rgba(248, 113, 113, 0.10)',
    '--rd-ink': '#E4EAF3',
    '--rd-muted': '#9DABC2',
    '--rd-line': '#2C3A55',
    '--rd-panel': '#0E1524',
    '--rd-panel2': '#151E32',
    '--rd-accent': '#FF6A3D',
    '--rd-blue': '#5CC0D2',
    '--rd-ok': '#4ADE80',
    '--rd-warn': '#FBBF24',
    '--rd-steel': '#A3B4C4',
    '--rd-propellant': '#C29466',
    '--rd-insul': '#8A76A0',
    '--rd-hot': '#FF8A3D',
  },
  light: {
    '--site-canvas': '#EEF2F7',
    '--site-glow': 'rgba(194, 65, 12, 0.06)',
    '--site-ok': '#15803D',
    '--site-ok-bg': 'rgba(21, 128, 61, 0.08)',
    '--site-warn': '#A16207',
    '--site-warn-bg': 'rgba(161, 98, 7, 0.09)',
    '--site-info': '#0E6577',
    '--site-info-bg': 'rgba(14, 101, 119, 0.08)',
    '--site-danger-bg': 'rgba(220, 38, 38, 0.07)',
    '--rd-ink': '#18202F',
    '--rd-muted': '#56647C',
    '--rd-line': '#C4CEDB',
    '--rd-panel': '#FFFFFF',
    '--rd-panel2': '#F2F5F9',
    '--rd-accent': '#C2410C',
    '--rd-blue': '#0E6577',
    '--rd-ok': '#15803D',
    '--rd-warn': '#A16207',
    '--rd-steel': '#64788A',
    '--rd-propellant': '#A87445',
    '--rd-insul': '#7D6A8C',
    '--rd-hot': '#D1561A',
  },
};

const remap = (mode: Mode, v: string) => BRAND[v.toUpperCase()] ?? GREY[mode][v.toUpperCase()] ?? v;

type Tree = { [k: string]: unknown };

/** Walk a scheme, calling `leaf` for every colour string; returns a tree of the same shape. */
function mapLeaves(node: Tree, path: string[], leaf: (path: string[], value: string) => string): Tree {
  const out: Tree = {};
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string') out[k] = leaf([...path, k], v);
    else if (v && typeof v === 'object') out[k] = mapLeaves(v as Tree, [...path, k], leaf);
    else out[k] = v;
  }
  return out;
}

const varName = (path: string[]) => `--cast-${path.join('-')}`;

/** The scheme every island hands to Cast's ThemeProvider: same shape as Cast's, every colour a CSS variable. */
export const varScheme = mapLeaves(colorSchemes.dark as unknown as Tree, [], (p) => `var(${varName(p)})`) as unknown as ColorScheme;

/** The real colours for one mode, as CSS declarations. */
function declarations(mode: Mode): string {
  const lines: string[] = [];
  mapLeaves(colorSchemes[mode] as unknown as Tree, [], (p, v) => {
    lines.push(`${varName(p)}:${remap(mode, v)};`);
    return v;
  });
  for (const [k, v] of Object.entries(SITE[mode])) lines.push(`${k}:${v};`);
  return lines.join('');
}

/** Theme stylesheet: dark is the default (the site's identity), light when the reader picks it. */
export const themeCss = [
  `:root,:root[data-theme="dark"]{color-scheme:dark;${declarations('dark')}}`,
  `:root[data-theme="light"]{color-scheme:light;${declarations('light')}}`,
].join('\n');

/** Resolved colour of one Cast scheme path, for code that needs a literal (e.g. the browser theme-color meta). */
export function resolved(mode: Mode, path: string): string {
  const v = path.split('.').reduce<unknown>((o, k) => (o as Tree)?.[k], colorSchemes[mode]);
  return typeof v === 'string' ? remap(mode, v) : '';
}
