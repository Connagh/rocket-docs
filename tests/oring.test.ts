import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseGland, stretchedCs, extrusionLimit, suggestGroove, nearestId, type ORingInputs } from '../src/lib/oring.ts';
import data from '../src/data/orings.json' with { type: 'json' };

const close = (a: number, b: number, rel = 1e-3) =>
  assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≉ ${b}`);

// Worked example on the O-ring page: static radial piston seal, 150 mm bore.
const base: ORingInputs = {
  arrangement: 'piston', duty: 'static',
  cs: 5.33, csTol: 0.13, id: 139.29, idTol: 0.84,
  bore: { min: 150.0, max: 150.063 }, shaft: { min: 149.86, max: 149.9 },
  groove: { min: 141.45, max: 141.55 }, width: { min: 7.0, max: 7.2 }, faceGap: { min: 0, max: 0 },
  eccentric: true, tMin: -40, tMax: 60, tAssembly: 20,
  alphaE: 1.6e-4, alphaM: 12e-6, swell: 0.05, compressionSet: 0.2,
  pressure: 10, hardness: 70, opening: 0,
};

test('stretch thins the cross-section at constant volume', () => {
  close(stretchedCs(5.33, 0.02), 5.33 / Math.sqrt(1.02), 1e-12);
  assert.equal(stretchedCs(5.33, -0.01), 5.33);
});

test('nominal piston gland matches the hand calculation', () => {
  const r = analyseGland(base);
  close(r.gNom, 4.26575, 1e-6);
  close(r.stretchNom, (141.5 - 139.29) / 139.29, 1e-9);
  close(r.sqNom, 0.1933, 2e-3);
  close(r.fillNom, (Math.PI / 4) * 5.33 ** 2 / (1 + r.stretchNom) / (7.1 * 4.26575), 1e-9);
});

test('worst-case squeeze brackets nominal; eccentricity widens the spread', () => {
  const r = analyseGland(base);
  assert.ok(r.sqMax > r.sqNom && r.sqMinCold < r.sqNom && r.sqMinEol < r.sqMinCold);
  const c = analyseGland({ ...base, eccentric: false });
  assert.ok(c.gMin > r.gMin && c.gMax < r.gMax);
});

test('rod gland geometry, concentric and eccentric', () => {
  const rod: ORingInputs = { ...base, arrangement: 'rod', bore: { min: 50.1, max: 50.15 }, shaft: { min: 49.95, max: 50.0 }, groove: { min: 58.5, max: 58.6 }, id: 50.39 };
  const c = analyseGland({ ...rod, eccentric: false });
  close(c.gMin, (58.5 - 50.0) / 2, 1e-9);
  close(c.gMax, (58.6 - 49.95) / 2, 1e-9);
  const e = analyseGland(rod);
  close(e.gMin, (58.5 - 50.15) / 2, 1e-9);
  close(e.gMax, (58.6 + 50.15) / 2 - 49.95, 1e-9);
});

test('colder means less squeeze; joint opening reduces it further', () => {
  const warm = analyseGland({ ...base, tMin: 20 }), cold = analyseGland(base);
  assert.ok(cold.sqMinCold < warm.sqMinCold);
  const open = analyseGland({ ...base, opening: 0.3 });
  assert.ok(open.sqMinPressurised < open.sqMinEol);
  close(open.clearancePressurised, open.clearanceMax + 0.6, 1e-9);
});

test('extrusion limits follow the v1 screening table', () => {
  close(extrusionLimit(3, 70), 0.15, 1e-9);
  close(extrusionLimit(8, 90), 0.15, 1e-9);
  close(extrusionLimit(8, 80), 0.115, 1e-9);
  assert.equal(extrusionLimit(12, 70), 0);
  assert.equal(analyseGland(base).backupNeeded, true); // 0.203 mm gap at 10 MPa, 70 Shore
});

test('suggested groove hits the target nominal squeeze and fill', () => {
  const s = suggestGroove('piston', 150.0315, 5.33, 139.29, 0.2, 0.75);
  const r = analyseGland({ ...base, groove: { min: s.groove, max: s.groove }, width: { min: s.width, max: s.width }, bore: { min: 150.0315, max: 150.0315 } });
  close(r.sqNom, 0.2, 1e-6);
  close(r.fillNom, 0.75, 1e-6);
});

test('stock ID lookup from ISO 3601 class A data', () => {
  const ids = (data.idsA as Record<string, number[]>)['5.33'];
  assert.equal(nearestId(ids, 137.4), 139.29);
});
