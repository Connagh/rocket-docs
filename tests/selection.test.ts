import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INDICES, index, prop, rank, guideline, type Material } from '../src/lib/selection.ts';
import data from '../src/data/materials.json' with { type: 'json' };

const mats = data.materials as Material[];
const get = (n: string) => mats.find((m) => m.name.startsWith(n))!;
const close = (a: number, b: number, rel = 1e-3) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≉ ${b}`);

test('each index ranks materials in the same order as y / x^slope on its own chart', () => {
  // So "above the guideline" on the chart means "better index" — the chart and the table agree.
  for (const idx of INDICES) {
    const pts = mats
      .map((m) => ({ x: prop(idx.x).get(m), y: prop(idx.y).get(m), v: idx.value(m) }))
      .filter((p): p is { x: number; y: number; v: number } => !!p.x && !!p.y && p.v !== undefined && p.x > 0 && p.y > 0);
    const byIndex = [...pts].sort((a, b) => b.v - a.v).map((p) => p.y / p.x ** idx.slope);
    for (let k = 1; k < byIndex.length; k++) assert.ok(byIndex[k] <= byIndex[k - 1] * (1 + 1e-9), `${idx.key} out of order`);
  }
  close(guideline(20, 10, 5, 2), 20, 1e-12);
});

test('index values for the case-material worked example', () => {
  close(index('tie').value(get('D6AC'))!, 1450 / 7.85, 1e-9);
  close(index('ybb').value(get('Maraging 18Ni-250'))!, 100 / 1690, 1e-9);
  close(index('lbb').value(get('Ti-6Al-4V (Gr 5)'))!, 75 ** 2 / 880, 1e-9);
});

test('ranking for a weldable metallic case above 150 °C', () => {
  const r = rank(mats, index('tie'), { families: ['steel', 'ti', 'al', 'ss', 'ni'], minServiceTemp: 150, weldableOnly: true, hideDefaultToughness: false });
  assert.deepEqual(r.slice(0, 2).map((x) => x.m.name), ['Maraging 18Ni-300', 'Ti-6Al-2Sn-4Zr-2Mo']);
  assert.ok(r.findIndex((x) => x.m.name.startsWith('D6AC')) < 10);
});
