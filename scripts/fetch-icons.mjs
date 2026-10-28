// Subset the Material Symbols Outlined font (Cast UI's icon font) to the icons this site uses, and save it to
// public/fonts so pages load one small, self-hosted file instead of the 10 MB variable font from a CDN.
//
//   npm run icons        regenerate after using a new icon name
//
// Icon names are collected from the source (string props such as icon="search", leadingIcon: 'check',
// <Icon name="…">, and the material-symbols spans in .astro files) plus the icons Cast UI's own components draw.
// tests/icons.test.ts fails if the source uses a name that is not in the committed subset.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/fonts');

/** Icons drawn inside Cast UI components (chevrons, checks, alert and select glyphs). */
export const CAST_ICONS = ['arrow_drop_down', 'check', 'chevron_right', 'close', 'remove', 'info', 'error', 'content_copy', 'add', 'person'];

const PATTERNS = [
  // icon="search", leadingIcon: 'check', trailingIcon={busy ? 'x' : 'y'} (every quoted name inside the braces)
  /\b(?:icon|leadingIcon|trailingIcon|openIcon)\s*[=:]\s*(\{[^}]*\}|["'][a-z][a-z0-9_]*["'])/g,
  // <Icon name="tune" … />
  /<Icon\b[^>]*?\bname=(\{[^}]*\}|["'][a-z][a-z0-9_]*["'])/g,
  // <span class="material-symbols">info</span> and the Aside icon table (icon: 'info')
  /class="material-symbols"[^>]*>([a-z][a-z0-9_]*)</g,
  // Lookup tables named *_ICON / *ICONS: const PHASE_ICON: Record<string, string> = { orient: 'explore', … }
  /\b[A-Z_]*ICONS?\b[^=\n]*=\s*(\{[^}]*\})/g,
];
const quoted = (s) => [...s.matchAll(/["']([a-z][a-z0-9_]*)["']/g)].map((m) => m[1]);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|astro|mdx?)$/.test(f) ? [p] : [];
  });
}

/** Every icon name the site can render. */
export function usedIcons() {
  const names = new Set(CAST_ICONS);
  for (const file of walk(join(ROOT, 'src'))) {
    const src = readFileSync(file, 'utf8');
    for (const re of PATTERNS)
      for (const m of src.matchAll(re)) for (const n of /^[{"']/.test(m[1]) ? quoted(m[1]) : [m[1]]) names.add(n);
  }
  return [...names].sort();
}

async function main() {
  const names = usedIcons();
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,400,0..1,0&icon_names=${names.join(',')}&display=block`,
    { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' } },
  ).then((r) => {
    if (!r.ok) throw new Error(`Google Fonts: HTTP ${r.status}`);
    return r.text();
  });
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error('No font URL in the Google Fonts response');
  const font = Buffer.from(await (await fetch(url)).arrayBuffer());
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'material-symbols-outlined.woff2'), font);
  writeFileSync(join(OUT, 'material-symbols-outlined.txt'), names.join('\n') + '\n');
  console.log(`${names.length} icons, ${(font.length / 1024).toFixed(1)} KB`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
