import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseFatigueStrength, surfaceFactor, sizeFactor, marin, notchSensitivity, fatigueNotchFactor, snCurve, equivalentReversed, miner } from '../src/lib/fatigue.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('base fatigue strength: steel 0.5·Sut capped at 700 MPa; aluminium 0.4·Sut capped at 130 MPa at 5×10⁸', () => {
  close(baseFatigueStrength('steel', 1000).se, 500, 1e-9);
  close(baseFatigueStrength('steel', 1900).se, 700, 1e-9);
  const al = baseFatigueStrength('al', 570);
  close(al.se, 130, 1e-9);
  assert.equal(al.limit, false);
  close(al.nE, 5e8, 0);
});

test('Marin factors: surface and size follow Shigley', () => {
  close(surfaceFactor(1280, 'machined'), 4.51 * 1280 ** -0.265, 1e-12);
  assert.equal(surfaceFactor(200, 'ground'), 1); // capped at 1
  close(sizeFactor(25, 'bending'), 1.24 * 25 ** -0.107, 1e-12);
  assert.equal(sizeFactor(25, 'axial'), 1);
});

test('notch sensitivity: Peterson, and Kf between 1 and Kt', () => {
  const { a, q } = notchSensitivity(2, 1280, 'steel');
  close(a, 0.0254 * (2070 / 1280) ** 1.8, 1e-12);
  const kf = fatigueNotchFactor(1.8, q);
  assert.ok(kf > 1 && kf < 1.8);
  // a sharp notch in a soft material is less sensitive than a blunt one in a hard material
  assert.ok(notchSensitivity(0.2, 400, 'steel').q < notchSensitivity(2, 1500, 'steel').q);
});

test('S-N curve passes through its anchors; steel has an endurance limit, aluminium does not', () => {
  const c = snCurve(1000, 400, 1e6, true);
  close(c.S(1e3), 900, 1e-9);
  close(c.S(1e6), 400, 1e-9);
  close(c.N(650), 1e3 * (650 / 900) ** (1 / c.b), 1e-6);
  assert.equal(c.N(399), Infinity);
  const a = snCurve(500, 130, 5e8, false);
  assert.ok(Number.isFinite(a.N(100)));
});

test('mean-stress criteria order: Soderberg ≥ Goodman ≥ Gerber for tensile mean; no credit for compression', () => {
  const g = equivalentReversed(100, 300, 1000, 800, 'goodman');
  close(g, 100 / 0.7, 1e-9);
  assert.ok(equivalentReversed(100, 300, 1000, 800, 'soderberg') >= g);
  assert.ok(equivalentReversed(100, 300, 1000, 800, 'gerber') <= g);
  close(equivalentReversed(100, -300, 1000, 800, 'goodman'), 100, 1e-12);
  close(equivalentReversed(100, 100, 1000, 800, 'swt'), Math.sqrt(200 * 100), 1e-12);
});

test('worked example: 4340 bracket, machined then ground', () => {
  const uts = 1280, sy = 1180, base = baseFatigueStrength('steel', uts);
  const kf = fatigueNotchFactor(1.8, notchSensitivity(2, uts, 'steel').q);
  close(kf, 1.777, 0.001);
  const blocks = [{ sa: 90, sm: 50, n: 5e6 }, { sa: 250, sm: 250, n: 2000 }, { sa: 180, sm: 60, n: 20000 }];
  const run = (surface: string) => {
    const m = marin({ uts, sePrime: base.se, surface, load: 'bending', dMm: 25, kd: 1, reliability: '99' });
    return { m, r: miner(blocks, kf, uts, sy, 'goodman', snCurve(uts, m.se, base.nE, base.limit)) };
  };
  const mach = run('machined'), grnd = run('ground');
  close(mach.m.se, 310.0, 0.2);
  close(mach.r.rows[0].d, 0, 0); // transport vibration is below the endurance limit
  close(mach.r.D, 0.162, 0.001);
  close(grnd.m.se, 393.7, 0.2);
  close(grnd.r.D, 0.0674, 0.0005);
  assert.ok(grnd.r.lives / mach.r.lives > 2.3);
});
