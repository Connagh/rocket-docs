import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classicalCoeff, sigmaClassical, kdAxial, kdBending, lateralPressure, bucklingCheck } from '../src/lib/buckling.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// The page's worked example: the 300 mm D6AC case (ν 0.29 from the material library), unpressurised, 1.377 mm wall, 1000 mm between domes.
const t = 1.377, r = 150 + t / 2;
const base = { E: 205000, nu: 0.29, yieldStrength: 1450, r, t, L: 1000, P: 0, M: 0, q: 0, endPressure: true, gammaP: 0.56 };

test('classical coefficient is 0.605 for ν = 0.3', () => close(classicalCoeff(0.3), 0.6052, 0.0001));

test('SP-8007 knockdowns fall with r/t and approach their floors', () => {
  close(kdAxial(100, 1), 1 - 0.901 * (1 - Math.exp(-10 / 16)), 1e-12);
  assert.ok(kdAxial(1000, 1) < kdAxial(100, 1));
  close(kdAxial(1e9, 1), 0.099, 0.001);
  close(kdBending(1e9, 1), 0.269, 0.001);
  assert.ok(kdBending(150, 1) > kdAxial(150, 1)); // bending is less imperfection-sensitive
});

test('lateral pressure: long-tube limit and moderate-length formula', () => {
  const l = lateralPressure(205000, t, r, 1000, 0.3);
  close(l.pLong, (205000 / (4 * 0.91)) * (t / r) ** 3, 1e-12);
  assert.ok(!l.long);
  close(l.Z, 4597, 2);
  close(l.pMod, 0.2264, 0.0005);
  // very long tube: the long formula takes over
  assert.ok(lateralPressure(205000, t, r, 50000, 0.3).long);
});

test('worked example: capacities', () => {
  const b = bucklingCheck(base);
  close(b.rt, 109.4, 0.1);
  close(b.sClassical, 1130.1, 0.1);
  close(b.gammaA, 0.5675, 0.0005);
  close(b.gammaB, 0.6492, 0.0005);
  close(b.axial.allow, 641, 1);
  close(b.axial.capacity / 1000, 836.3, 0.1);
  close(b.bending.capacity / 1e6, 72.06, 0.01);
  close(b.pressure.allow, 0.1262, 0.0003);
  assert.equal(b.axial.governs, 'shell');
});

test('worked example: flight loads and the evacuated case', () => {
  const flight = bucklingCheck({ ...base, P: 20000, M: 3e6, endPressure: false });
  close(flight.sum, 20 / 836 + 3 / 72.06, 0.001);
  const vac = bucklingCheck({ ...base, q: 0.101325 });
  close(vac.pressure.R, 0.803, 0.002);
  close(vac.axial.load, 0.101325 * Math.PI * r * r, 1e-6); // end load from pressure on the closures
  close(vac.reserve, 1.232, 0.003);
});

test('a thick wall yields before it buckles', () => {
  const b = bucklingCheck({ ...base, t: 4, r: 152 });
  assert.equal(b.axial.governs, 'yield');
  close(b.axial.allow, 1450, 1e-9);
});

test('sigmaClassical scales with t/r', () => close(sigmaClassical(200000, 2, 200, 0.3) * 2, sigmaClassical(200000, 4, 200, 0.3), 1e-9));
