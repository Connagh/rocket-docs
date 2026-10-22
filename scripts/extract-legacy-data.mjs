// Pulls the material database out of the legacy single-file site
// (public/legacy/index.html) into src/data/materials.json so new pages
// and the legacy page share one set of numbers.
//
// Only the literal array/object declarations are evaluated — never the
// rest of the legacy script — in an empty vm context.
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const SRC = new URL('../public/legacy/index.html', import.meta.url);
const OUT = new URL('../src/data/materials.json', import.meta.url);
const html = readFileSync(SRC, 'utf8');

/** Return the source text of `const NAME = <literal>;` by bracket matching. */
function literal(name) {
  const start = html.indexOf(`const ${name} =`);
  if (start < 0) throw new Error(`${name} not found in legacy file`);
  let i = html.indexOf('=', start) + 1;
  while (/\s/.test(html[i])) i++;
  const open = html[i];
  const close = open === '[' ? ']' : '}';
  let depth = 0, inStr = null;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (c === '\\') j++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return html.slice(i, j + 1);
  }
  throw new Error(`Unbalanced literal for ${name}`);
}

const MATS = runInNewContext(`(${literal('MATS')})`, {});
const PROP_DEFAULT = runInNewContext(`(${literal('PROP_DEFAULT')})`, {});
const PROP_OVERRIDE = runInNewContext(`(${literal('PROP_OVERRIDE')})`, {});

const materials = MATS.map((m) => {
  const [E, k, cte, kic] = PROP_OVERRIDE[m.n] ?? PROP_DEFAULT[m.fam] ?? [];
  return {
    name: m.n,
    summary: m.s ?? '',
    family: m.fam,
    density: m.d, // g/cm³
    uts: m.uts, // MPa
    yield: m.y, // MPa
    maxServiceTemp: m.t, // °C
    weldable: !!m.w,
    spec: m.sp ?? '',
    E, // GPa
    k, // W/m·K
    cte, // µm/m·K
    kic, // MPa·√m — indicative only
    kicIsFamilyDefault: !(m.n in PROP_OVERRIDE),
  };
}).filter((m) => typeof m.uts === 'number' && typeof m.density === 'number');

writeFileSync(OUT, JSON.stringify({ source: 'public/legacy/index.html', materials }, null, 2) + '\n');
console.log(`Wrote ${materials.length} materials to src/data/materials.json`);
