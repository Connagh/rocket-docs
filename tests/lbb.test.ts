import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeQ, nrF, surfaceK, folias, throughFailStress, throughCritical, irwinCritical, growToBreakthrough } from '../src/lib/lbb.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('Newman–Raju: semicircular shallow crack, deepest point F = 1.04, Q = 2.464', () => {
  close(nrF(1, 0, Math.PI / 2), 1.04, 1e-9);
  close(shapeQ(1), 2.464, 1e-9);
  // the surface point of a shallow semicircular crack is a little higher (g = 1.1)
  close(nrF(1, 0, 0), 1.04 * 1.1, 1e-9);
});

test('Folias factor is 1 for a short crack and grows with c²/(R t)', () => {
  close(folias(1e-6, 150, 1.4), 1, 1e-9);
  close(folias(10, 150, 1.4), Math.sqrt(1 + 0.6275 * (400 / 420) - 0.003375 * (400 / 420) ** 2), 1e-9);
  assert.ok(folias(20, 150, 1.4) > folias(10, 150, 1.4));
});

test('through-crack critical length: flat-plate LEFM limit and collapse limit', () => {
  // very large radius and flow stress: reduces to Irwin's flat-plate value
  close(throughCritical(1094, 1e9, 1.377, 70, 1e9).c, irwinCritical(1094, 70), 1e-6);
  // with bulging the stable crack is shorter
  assert.ok(throughCritical(1094, 150.69, 1.377, 70, 1485).c < irwinCritical(1094, 70));
  // a very tough material fails by collapse: σ = flow / M
  const t = throughFailStress(20, 150, 2, 500, 600);
  assert.equal(t.mode, 'collapse');
  close(t.fail, 600 / t.M, 1e-9);
});

const d6ac = { sigma: 10 * 150.6885 / 1.377, rangeFraction: 1, a0: 0.25, ac0: 0.5, t: 1.377, R: 150.6885, kic: 70, flow: 1485, C: 1.35e-10, m: 2.25 };

test('worked example 1: the D6AC case breaks before it leaks', () => {
  const r = growToBreakthrough(d6ac);
  assert.notEqual(r.outcome, 'leak');
  close(r.cCrit, 1.289, 0.002);
  close(r.irwin, 1.302, 0.002);
  close(r.c, 1.648, 0.005);
  close(r.N, 1804, 5);
});

test('worked example 2: the 15CDV6 case leaks first', () => {
  const t = 2.225, R = 150 + t / 2;
  const r = growToBreakthrough({ ...d6ac, sigma: 10 * R / t, t, R, kic: 90, flow: (830 + 980) / 2, C: 6.9e-12, m: 3.0 });
  assert.equal(r.outcome, 'leak');
  close(r.cCrit, 5.10, 0.02);
  close(r.c, 2.84, 0.02);
});

test('the crack path does not depend on the stress range; only the cycles do', () => {
  const full = growToBreakthrough(d6ac), half = growToBreakthrough({ ...d6ac, rangeFraction: 0.5 });
  close(half.a, full.a, 1e-9);
  close(half.c, full.c, 1e-9);
  close(half.N / full.N, 2 ** 2.25, 1e-6);
});

test('surface K scales with stress', () => {
  const k1 = surfaceK(500, 0.5, 1, 2), k2 = surfaceK(1000, 0.5, 1, 2);
  close(k2.KA / k1.KA, 2, 1e-12);
});
