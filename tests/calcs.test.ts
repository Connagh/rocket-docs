import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizeCase, tLame, tThin, hoopLame, pLame, criticalCrackMm } from '../src/lib/pv.ts';
import { equilibriumPressure, massIn, massOut, pressureSensitivity } from '../src/lib/ballistics.ts';

const close = (a: number, b: number, rel = 1e-3) =>
  assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≉ ${b}`);

test('thin-wall: t = p·r/σ', () => {
  close(tThin(10, 150, 1000), 1.5);
});

test('Lamé converges to thin-wall for thin shells and exceeds it for thick ones', () => {
  close(tLame(1, 150, 1000), tThin(1, 150, 1000), 2e-3);
  assert.ok(tLame(200, 150, 1000) > tThin(200, 150, 1000));
});

test('Lamé thickness and burst pressure are inverses', () => {
  const t = tLame(50, 100, 800);
  close(hoopLame(50, 100, 100 + t), 800);
  close(pLame(800, 100, 100 + t), 50);
});

test('Lamé has no solution when p ≥ σ', () => {
  assert.equal(tLame(1000, 100, 800), Infinity);
});

test('Irwin critical half-crack length', () => {
  // K_IC 70 MPa√m at 1000 MPa → (1/π)(0.07)² m = 1.5597 mm
  close(criticalCrackMm(70, 1000), 1.5597);
});

test('worked example on the case-sizing page (D6AC, 300 mm, 10 MPa)', () => {
  const r = sizeCase({
    idMm: 300, meop: 10, proofFactor: 1.1, burstFactor: 1.25, weldEff: 0.9,
    lengthMm: 1000, dome: 'hemi',
    material: { uts: 1520, yield: 1450, density: 7.85, kic: 70 },
  });
  assert.equal(r.governs, 'burst');
  close(r.tThinReq, 1.3706);
  close(r.t, 1.3769, 2e-3);
  close(r.predictedBurst, 12.5);
  assert.ok(r.msBurst > -1e-9 && r.msBurst < 1e-6);
  assert.equal(r.leakBeforeBreak, false);
  close(r.cylMass, 10.23, 5e-3);
});

test('ballistics: equilibrium pressure balances mass in and out', () => {
  const b = { rhoP: 1770, a: 4.05, n: 0.35, cStar: 1540, kn: 250 };
  const p = equilibriumPressure(b);
  close(p, 4.77, 5e-3);
  close(massIn(b, p), massOut(b, p), 1e-9);
  assert.ok(Number.isNaN(equilibriumPressure({ ...b, n: 1.05 })));
  close(pressureSensitivity(0.5), 2);
});

test('checking a thicker as-designed wall gives positive margins', () => {
  const r = sizeCase({
    idMm: 300, meop: 10, proofFactor: 1.1, burstFactor: 1.25, weldEff: 0.9,
    lengthMm: 1000, dome: 'hemi', tMm: 1.6,
    material: { uts: 1520, yield: 1450, density: 7.85, kic: 70 },
  });
  close(r.tReq, 1.3769, 2e-3);
  assert.equal(r.t, 1.6);
  assert.ok(r.msBurst > 0.15 && r.msProof > 0.15);
});
