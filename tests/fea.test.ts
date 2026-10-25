import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeModel, edgeExact, richardson, williamsLambda, hotSpot, rosette } from '../src/lib/fea.ts';
import { shell } from '../src/lib/handcalc.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const CASE = [10, 150.69, 1.377, 205000, 0.29] as const;

test('the edge model agrees with the hand calc: membrane growth far away, edge stress as the mesh is refined', () => {
  const exact = edgeExact(...CASE);
  close(exact, shell(...CASE, true).peakAxial, 1e-9, 'same answer as the hand-calc shell');
  const errs = [16, 8, 4, 2, 1].map((h) => {
    const m = edgeModel(...CASE, 192, 192 / h);
    close(m.w[m.w.length - 1], shell(...CASE, true).growth, 1e-4, 'membrane growth at the far end');
    return m.sigmaEdge / exact - 1;
  });
  close(errs[0], -0.1917, 1e-3); close(errs[2], -0.0157, 1e-3); close(errs[4], -0.0010, 1e-3);
  // halving the mesh cuts the error about four times once the mesh resolves the edge zone
  close(errs[3] / errs[4], 4, 0.2);
});

test('Richardson: exact for a power-law sequence; fine meshes trusted, coarse ones not', () => {
  // f = 100 + 5h² sampled at h = 1, 2, 4 recovers p = 2 and f = 100 exactly
  const pw = richardson(105, 120, 180, 1, 2, 4);
  assert.equal(pw.kind, 'monotonic'); close(pw.p, 2, 1e-9); close(pw.ext, 100, 1e-9); close(pw.asymptotic, 105 / 120, 1e-9, 'f1/f2 for an exact power law — near 1 once errors are small');
  // unequal refinement ratios
  const f = (h: number) => 50 - 3 * h ** 1.5;
  close(richardson(f(1), f(1.5), f(3), 1, 1.5, 3).p, 1.5, 1e-6);
  const s = (h: number) => edgeModel(...CASE, 192, 192 / h).sigmaEdge, exact = edgeExact(...CASE);
  const fine = richardson(s(4), s(8), s(16), 4, 8, 16);
  close(fine.p, 1.62, 0.01); close(fine.ext / exact - 1, 0.0052, 0.001); close(fine.gci, 0.0265, 0.001); close(fine.asymptotic, 1.05, 0.01);
  const coarse = richardson(s(8), s(16), s(32), 8, 16, 32);
  close(coarse.p, 0.87, 0.01); close(coarse.ext / exact - 1, 0.101, 0.002, 'extrapolates 10% high');
  assert.equal(richardson(s(16), s(32), s(64), 16, 32, 64).kind, 'divergent');
  assert.equal(richardson(10, 12, 9, 1, 2, 4).kind, 'oscillatory');
});

test('singularities: Williams exponents, and a sharp corner never converges', () => {
  close(williamsLambda(270), 0.5445, 1e-4); close(williamsLambda(360), 0.5, 1e-9); assert.equal(williamsLambda(180), 1);
  const l = williamsLambda(270), f = (h: number) => 1000 * h ** (l - 1);
  const r = richardson(f(0.25), f(0.5), f(1), 0.25, 0.5, 1);
  assert.equal(r.kind, 'divergent'); close(r.R, 2 ** (1 - l), 1e-9);
});

test('hot spot and rosette', () => {
  close(hotSpot(300, 250), 333.5, 1e-9);
  // the case at proof: hoop and axial strains read back to the membrane stresses
  const sh = (11 * 150.69) / 1.377, sa = sh / 2, eh = ((sh - 0.29 * sa) / 205000) * 1e6, ea = ((sa - 0.29 * sh) / 205000) * 1e6;
  const r = rosette(ea, (ea + eh) / 2, eh, 205000, 0.29);
  close(r.s1, sh, 1e-6); close(r.s2, sa, 1e-6); close(r.theta, 90, 1e-9);
  const m = rosette(1260, 3170, 4950, 205000, 0.29);
  close(m.s1, 1189.9, 0.1); close(m.s2, 603.1, 0.1); close(m.theta, 89.0, 0.1);
});
