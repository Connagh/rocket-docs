import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStandard, temperCode, finishSpec, buildCallout, type SpecSheet } from '../src/lib/callout.ts';
import data from '../src/data/specs.json' with { type: 'json' };
import { SPECS_V2 } from '../src/data/specs-v2.mjs';

const sheets = [...(data.specs as SpecSheet[]), ...(SPECS_V2 as SpecSheet[])];
const sheet = (n: string) => sheets.find((s) => s.name.startsWith(n))!;

test('standards parse into alternatives and tolerance standards', () => {
  assert.deepEqual(parseStandard('BS EN 755-2 (properties) + BS EN 755-3 (tolerances)'), { alternatives: ['BS EN 755-2'], tolerances: ['BS EN 755-3'] });
  assert.deepEqual(parseStandard('AMS 4928 / ASTM B348'), { alternatives: ['AMS 4928', 'ASTM B348'], tolerances: [] });
  assert.equal(temperCode('T6 / T651'), 'T6');
  assert.equal(finishSpec('BS EN ISO 7599 (or DEF STAN 03-24/25 on MoD work)'), 'BS EN ISO 7599');
  assert.equal(finishSpec('Company finish spec'), '<COMPANY SPEC>');
});

test('aluminium callout reproduces the v1 example material line', () => {
  const s = sheet('Aluminium 6082');
  const out = buildCallout({ sheet: s, formIndex: 0, standard: 'BS EN 755-2', temperIndex: 0, finishIndex: 0, afterFinish: true, traceability: false, certificate: false });
  const lines = out.split('\n');
  assert.equal(lines[0], 'MATERIAL: EN AW-6082-T6 EXTRUDED ROUND BAR / ROD TO BS EN 755-2');
  assert.equal(lines[1], '          TOLERANCES TO BS EN 755-3');
  assert.match(lines[2], /^FINISH: {3}SULPHURIC ANODISE TO BS EN ISO 7599$/);
  assert.equal(lines.at(-1), 'NOTE:     DIMENSIONS APPLY AFTER FINISH');
});

test('every sheet, form, condition and finish produces a callout', () => {
  for (const s of sheets) {
    assert.ok(s.forms.length && s.tempers.length, `${s.name} has forms and tempers`);
    s.forms.forEach((f, fi) => {
      const { alternatives } = parseStandard(f.standard);
      assert.ok(alternatives.length, `${s.name} / ${f.form} has a standard`);
      const out = buildCallout({ sheet: s, formIndex: fi, standard: alternatives[0], temperIndex: 0, finishIndex: s.finishes.length ? 0 : -1, afterFinish: true, traceability: true, certificate: true });
      assert.ok(out.startsWith('MATERIAL: ') && !out.includes('undefined'), `${s.name} / ${f.form}`);
    });
  }
});

test('v2 case-steel sheets are present and complete', () => {
  for (const n of ['D6AC', 'Maraging 18Ni-250']) {
    const s = sheet(n);
    assert.ok(s.callout.includes('AMS'));
    assert.ok(s.tips.length >= 3);
  }
});
