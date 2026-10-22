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
    corrosion: m.c ?? null, // 1–5 rating, 5 = best
    machinability: m.m ?? null, // 1–5 rating, 5 = best
    pricePerKg: m.pk ?? null, // indicative relative cost, £/kg
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

// Specification sheets, designation cross-reference and O-ring data.
const write = (file, obj) =>
  writeFileSync(new URL(`../src/data/${file}`, import.meta.url), JSON.stringify({ source: 'public/legacy/index.html', ...obj }, null, 2) + '\n');

const SPECS = runInNewContext(`(${literal('SPECS')})`, {});
write('specs.json', {
  specs: SPECS.map((s) => ({
    name: s.n, designation: s.desig, family: s.fam, base: s.base ?? '', composition: s.comp ?? '',
    forms: (s.forms ?? []).map(([form, standard, note]) => ({ form, standard, note: note === '—' ? '' : note })),
    tempers: (s.tempers ?? []).map(([code, note]) => ({ code, note })),
    finishes: (s.fin ?? []).map(([name, spec, note]) => ({ name, spec, note })),
    callout: (s.callout ?? '').split('\n').map((l) => l.replace(/^\s{10}/, '          ')).join('\n'),
    tips: s.tips ?? [],
  })),
});
console.log(`Wrote ${SPECS.length} specification sheets to src/data/specs.json`);

const XREF = runInNewContext(`(${literal('XREF')})`, {});
write('xref.json', {
  rows: XREF.map(([name, family, en, enNo, legacyBs, uns, aero, note]) => ({ name, family, en, enNo, legacyBs, uns, aero, note })),
});
console.log(`Wrote ${XREF.length} cross-reference rows to src/data/xref.json`);

write('orings.json', {
  classA: runInNewContext(`(${literal('OR_CS_A')})`, {}),
  classB: runInNewContext(`(${literal('OR_CS_B')})`, {}),
  idsA: runInNewContext(`(${literal('OR_ID_A')})`, {}),
  compounds: runInNewContext(`(${literal('OR_MATS')})`, {}).map((m) => ({
    code: m.a, name: m.n, tMin: m.tmin, tMax: m.tmax, hardness: m.sh, media: m.media, note: m.note, watch: m.watch,
  })),
  media: runInNewContext(`(${literal('OR_MEDIA')})`, {}).map(([key, name]) => ({ key, name })),
});
console.log('Wrote O-ring sizes, compounds and media to src/data/orings.json');
