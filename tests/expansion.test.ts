import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXP_MATERIALS, fitChange, fitPressure, fitStresses, fitHolding, thinLayerStress, bondedOverlap, patternSlip } from '../src/lib/expansion.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const M = (k: string) => EXP_MATERIALS.find((m) => m.key === k)!;
import { DEFAULTS } from '../src/lib/materials.ts';
const steel = M(DEFAULTS.caseSteel), al = M(DEFAULTS.aluminium), ti = M(DEFAULTS.titanium), cfrp = M(DEFAULTS.cfrpLaminate);

test('Lamé shrink fit: same material, solid shaft, matches the textbook closed form', () => {
  // equal materials, solid inner: p = E·δ·(D² − d²)/(2·d·D²)
  const f = { d: 50, D: 100, di: 0, Eo: 200000, nuo: 0.3, Ei: 200000, nui: 0.3 };
  close(fitPressure(0.05, f), (200000 * 0.05 * (100 ** 2 - 50 ** 2)) / (2 * 50 * 100 ** 2), 1e-9);
  assert.equal(fitPressure(-0.01, f), 0);
  const s = fitStresses(100, f);
  close(s.hoopOuter, (100 * (100 ** 2 + 50 ** 2)) / (100 ** 2 - 50 ** 2), 1e-9);
  close(s.hoopInner, -100, 1e-9); // solid shaft: uniform −p
});

test('worked example: an aluminium skirt ring on the steel attach ring loosens when hot', () => {
  const f = { d: 310, D: 330, di: 290, Eo: al.E, nuo: al.nu, Ei: steel.E, nui: steel.nu };
  const cold = 0.10 + fitChange(310, steel.alpha, al.alpha, -60), hot = 0.10 + fitChange(310, steel.alpha, al.alpha, 40);
  close(cold, 0.3065, 0.001); close(hot, -0.0376, 0.001);
  close(fitPressure(cold, f), 3.31, 0.01);
  close(fitStresses(fitPressure(cold, f), f).hoopOuter, 53.0, 0.1);
  assert.equal(fitPressure(hot, f), 0);
  close(fitHolding(fitPressure(0.10, f), 310, 30, 0.15).force, 4730, 2);
  // titanium has lower expansion than steel: it tightens hot instead
  assert.ok(0.10 + fitChange(310, steel.alpha, ti.alpha, 40) > 0.10);
});

test('thin layer and bonded overlap: edge shear saturates with overlap length', () => {
  close(thinLayerStress(cfrp.E, cfrp.nu, steel.alpha, cfrp.alpha, -60), -44.14, 0.01);
  const b20 = bondedOverlap(steel.E, 1.37, cfrp.E, 3, 800, 0.2, 20, steel.alpha - cfrp.alpha, -60);
  const b100 = bondedOverlap(steel.E, 1.37, cfrp.E, 3, 800, 0.2, 100, steel.alpha - cfrp.alpha, -60);
  close(Math.abs(b100.tauMax), 12.22, 0.01);
  assert.ok(Math.abs(b100.tauMax - b20.tauMax) / Math.abs(b100.tauMax) < 0.04, 'five times the overlap barely changes the peak');
  close(b100.decay, 4.94, 0.01);
  // force balance: the two adherends carry equal and opposite force
  close(b100.sigma1 * 1.37 + b100.sigma2 * 3, 0, 1e-9);
  // the long-overlap adherend stress tends to the full-constraint value
  close(Math.abs(b100.Nmax), (Math.abs(steel.alpha - cfrp.alpha) * 60) / (1 / (steel.E * 1.37) + 1 / (cfrp.E * 3)), 1);
});

test('bolt pattern slip', () => {
  close(patternSlip(al.alpha, steel.alpha, -60, 140), 0.0932, 0.0001);
});
