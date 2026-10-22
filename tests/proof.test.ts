import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stressIntensity, criticalDepth, parisCycles, proofScreen, PARIS_CLASSES,
  vesselCompliance, storedEnergy, liquidEnergy, gasEnergy, holdDrift, expansion, MEDIA,
} from '../src/lib/proof.ts';

const close = (a: number, b: number, rel = 1e-3) =>
  assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≉ ${b}`);

const mart = PARIS_CLASSES.find((p) => p.key === 'mart')!;
const base = {
  sigmaOp: 1094.4, proofFactor: 1.1, Y: 1.12, kProof: 70, kService: 70, wall: 1.377, yieldStrength: 1450,
  C: mart.C, m: mart.m, rangeFraction: 1, serviceCycles: 2, lifeFactor: 4, ndtDepth: 0,
};

test('critical depth is the inverse of K = Yσ√(πa)', () => {
  const a = criticalDepth(70, 1000, 1.12);
  close(stressIntensity(1000, a, 1.12), 70, 1e-9);
});

test('closed-form Paris integral matches numerical integration', () => {
  const a0 = 0.5, a1 = 2, C = 1.35e-10, m = 2.25, Y = 1.12, ds = 800;
  let n = 0;
  const N = 20000, da = (a1 - a0) / N;
  for (let i = 0; i < N; i++) {
    const a = (a0 + (i + 0.5) * da) / 1000;
    n += (da / 1000) / (C * Math.pow(Y * ds * Math.sqrt(Math.PI * a), m));
  }
  close(parisCycles(a0, a1, C, m, Y, ds), n, 1e-5);
  close(parisCycles(a0, a1, C, 2, Y, ds), (Math.log(a1 / a0)) / (C * (Y * ds * Math.sqrt(Math.PI)) ** 2), 1e-9);
});

test('worked example on the proof-testing page: D6AC case at proof factor 1.10', () => {
  const r = proofScreen(base);
  close(r.aScreen, 0.8585, 2e-3);
  close(r.aCrit, 1.0388, 2e-3);
  close(r.ratio, 1.21, 1e-6); // = R² when toughness is the same at proof and in service
  assert.ok(r.cycles > 80 && r.cycles < 130, `cycles ${r.cycles}`);
  close(r.proofToYield, 1203.84 / 1450, 1e-3);
});

test('a cold-service toughness drop can make the proof screen worthless', () => {
  const r = proofScreen({ ...base, kService: 56 }); // 20% lower toughness in service
  close(r.ratio, 1.21 * 0.64, 1e-6);
  assert.equal(r.screenWorks, false);
  assert.equal(r.cycles, 0);
});

test('NDT can take over as the initial-flaw guarantee', () => {
  const r = proofScreen({ ...base, ndtDepth: 0.5 });
  assert.equal(r.governsInitial, 'NDT');
  assert.ok(r.cycles > proofScreen(base).cycles);
});

const C = vesselCompliance(150, 1.377, 205000, 0.3);
const water = MEDIA.find((m) => m.key === 'water')!;
const n2 = MEDIA.find((m) => m.key === 'n2')!;

test('stored energy: worked example (85 L case at 11 MPa)', () => {
  close(C, 1.0096e-3, 1e-3);
  close(liquidEnergy(11, 85, 2200), 2337, 2e-3);
  const w = storedEnergy(11, 85, C, water);
  close(w.wall, 5192, 2e-3);
  close(w.total, 7529, 3e-3);
  close(gasEnergy(11, 85, 1.4), 1.742e6, 2e-3); // 11 MPa gauge = 11.10 MPa absolute
  const g = storedEnergy(11, 85, C, n2);
  assert.ok(g.total / w.total > 200);
  close(g.tnt, (1.742e6 + 5192) / 4.184e6, 2e-3);
});

test('trapped air: dominates a large low-pressure test, minor in a small high-pressure one', () => {
  const tank = vesselCompliance(1000, 10, 205000, 0.3);
  const bigLow = storedEnergy(1, 10000, tank, water, 0.02), bigLowDry = storedEnergy(1, 10000, tank, water);
  assert.ok(bigLow.fluid > 5 * bigLowDry.fluid, `${bigLow.fluid} vs ${bigLowDry.fluid}`);
  const small = storedEnergy(11, 85, C, water, 0.02), smallDry = storedEnergy(11, 85, C, water);
  assert.ok(small.total < 1.1 * smallDry.total);
});

test('hold drift and expansion', () => {
  close(holdDrift(2.1e-4, 12e-6, 2200, C), 0.1188, 3e-3);
  const e = expansion(11, 85, C, 2200);
  close(e.vessel, 85 * C * 11, 1e-9);
  close(e.pumpIn, e.vessel + (85 * 11) / 2200, 1e-9);
});
