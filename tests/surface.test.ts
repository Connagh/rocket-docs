import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gaussianFilter, roughnessParams, materialRatio, abbottCurve, makeProfile, turnedRoughness, feedForRa, cutoffFor,
  acceptance, smoothingLoss, processesFor, parseValues,
} from '../src/lib/surface.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const dx = 0.0005;

test('parameters of a sine profile', () => {
  // a sine of amplitude A: Ra = 2A/π, Rq = A/√2, Rt = 2A, Rsk = 0, Rku = 1.5
  const A = 1, lam = 0.1, z = Array.from({ length: 8001 }, (_, i) => A * Math.sin((2 * Math.PI * i * dx) / lam));
  const p = roughnessParams(z, dx, 0.8);
  close(p.Ra, (2 * A) / Math.PI, 2e-3); close(p.Rq, A / Math.SQRT2, 2e-3); close(p.Rt, 2 * A, 1e-3); close(p.Rz, 2 * A, 1e-3);
  close(p.Rsk, 0, 1e-2); close(p.Rku, 1.5, 1e-2); assert.equal(p.segments, 5);
  close(materialRatio(z, 0), 0, 1e-2); close(materialRatio(z, A), 0.5, 2e-3); close(materialRatio(z, 2 * A), 1, 1e-9);
  const ab = abbottCurve(z); close(ab[50].depth, A, 0.01); assert.equal(ab[0].depth, 0);
});

test('the Gaussian filter passes 50% at the cutoff and removes long waves', () => {
  const amp = (lam: number) => {
    const z = Array.from({ length: 40001 }, (_, i) => Math.sin((2 * Math.PI * i * dx) / lam));
    const f = gaussianFilter(z, dx, 0.8);
    return roughnessParams(f.roughness, dx, 0.8).Rq * Math.SQRT2;
  };
  close(amp(0.8), 0.5, 0.01, 'roughness transmission at λc');
  assert.ok(amp(8) < 0.01, 'waviness 10 λc long is removed');
  assert.ok(amp(0.08) > 0.99, 'roughness 0.1 λc long passes');
  assert.throws(() => gaussianFilter([1, 2, 3], dx, 0.8));
});

test('turned surfaces: the kinematic roughness and the simulated profile agree', () => {
  close(turnedRoughness(0.1, 0.8).Ra, 0.401, 1e-3); close(turnedRoughness(0.1, 0.8).Rt, 1.5625, 1e-9);
  close(feedForRa(0.4, 0.8), 0.0998, 1e-3);
  const z = makeProfile({ kind: 'turned', feed: 0.1, nose: 0.8, length: 5.6, dx, seed: 3 });
  close(roughnessParams(gaussianFilter(z, dx, 0.8).roughness, dx, 0.8).Ra, 0.401, 0.02);
});

test('honing cuts the peaks: high material ratio near the top', () => {
  const pr = (kind: 'ground' | 'honed') => {
    const r = gaussianFilter(makeProfile({ kind, rq: 0.5, plateau: 0.3, length: 5.6, dx, seed: 3 }), dx, 0.8).roughness;
    const p = roughnessParams(r, dx, 0.8);
    return { mr: materialRatio(r, 0.25 * p.Rz), rsk: p.Rsk };
  };
  const g = pr('ground'), h = pr('honed');
  assert.ok(h.mr > 5 * g.mr, `${h.mr} vs ${g.mr}`); assert.ok(h.rsk < -0.5 && Math.abs(g.rsk) < 0.3);
});

test('worked example: the cutoff decides what a seal bore measures', () => {
  const ra = (lc: number) => {
    const z = makeProfile({ kind: 'turned', feed: 0.08, nose: 0.8, length: 7 * lc, dx, wavAmp: 2, wavLen: 3, seed: 3 });
    return roughnessParams(gaussianFilter(z, dx, lc).roughness, dx, lc).Ra;
  };
  close(ra(0.8), 0.26, 0.02); close(ra(2.5), 0.50, 0.03, 'waviness counted as roughness');
  assert.equal(cutoffFor(0.26), 0.8); assert.equal(cutoffFor(3.2), 2.5); assert.equal(cutoffFor(0.05), 0.25);
  assert.equal(cutoffFor(6.3, 'Rz'), 0.8); assert.equal(cutoffFor(12.5, 'Rz'), 2.5);
});

test('worked example: acceptance by the 16% rule and the max rule', () => {
  const v = parseValues('0.31, 0.29 0.36\n0.42 0.33 0.30 0.34 0.28 0.32 0.35 0.30 0.33');
  assert.equal(v.length, 12);
  assert.equal(acceptance(v, 0.4, '16%').pass, true); assert.equal(acceptance(v, 0.4, 'max').pass, false);
  assert.equal(acceptance(v.slice(0, 6), 0.4, '16%').pass, false, '1 of 6 is 17%');
  assert.equal(acceptance([0.25, 0.9], 0.4, '16%').pass, true, 'first value below 70% accepts');
});

test('worked example: press-fit smoothing and process selection', () => {
  close(smoothingLoss(6.3, 6.3), 10.08, 1e-9); close(smoothingLoss(3.2, 3.2), 5.12, 1e-9);
  const p = processesFor(0.4), fit = (k: string) => p.find((x) => x.key === k)!.fit;
  assert.equal(fit('hone'), 'usual'); assert.equal(fit('turn'), 'possible'); assert.equal(fit('grind'), 'possible'); assert.equal(fit('sand'), 'no');
});
