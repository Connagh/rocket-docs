import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  erfc, thetaMoving, isothermDepth, steadyCharDepth, simulateWall, sizeInsulation, exposureAroundCase,
  LINER_MATERIALS, BACKUP_MATERIALS, type WallInputs,
} from '../src/lib/insulation.ts';

const close = (a: number, b: number, rel = 1e-3) =>
  assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≉ ${b}`);

const epdm = LINER_MATERIALS.find((m) => m.key === 'epdm')!;
const steel = BACKUP_MATERIALS.find((m) => m.key === 'steel')!;
const alpha = epdm.k / (epdm.rho * epdm.cp);
const thetaP = (450 - 20) / (1200 - 20);

const wall: WallInputs = {
  insT: 30, ins: epdm, caseT: 1.4, case: steel, t0: 20, tSurface: 1200, tPyro: 450,
  erosion: 0.05, exposure: 20, soak: 600, hOut: 10,
};

test('erfc matches tabulated values', () => {
  close(erfc(0), 1, 1e-6);
  close(erfc(1), 0.157299, 1e-5);
  close(erfc(-1), 1.842701, 1e-5);
  close(erfc(2), 0.004678, 1e-4);
});

test('moving-surface solution reduces to erfc when the surface does not recede', () => {
  const t = 20, x = 1e-3;
  close(thetaMoving(x, t, 0, alpha), erfc(x / (2 * Math.sqrt(alpha * t))), 1e-9);
  close(thetaMoving(0, t, 1e-4, alpha), 1, 1e-9);
});

test('moving-surface solution tends to the steady exponential profile', () => {
  const v = 1e-4;
  close(isothermDepth(1e5, v, alpha, thetaP), steadyCharDepth(v, alpha, thetaP), 1e-3);
});

test('finite-difference wall model reproduces the analytic char depth', () => {
  for (const erosion of [0, 0.05]) {
    const r = simulateWall({ ...wall, erosion });
    const analytic = isothermDepth(20, erosion / 1000, alpha, thetaP) * 1000;
    close(r.charFrontBurnout - r.erosion, analytic, 0.03);
    assert.ok(r.charFront >= r.charFrontBurnout); // soak-back can only deepen the char
    close(r.erosion, erosion * 20, 1e-9);
  }
});

test('thin insulation: the bondline peaks after burnout (soak-back)', () => {
  const r = simulateWall({ ...wall, insT: 3 });
  assert.ok(r.tBondPeak > wall.exposure, `peak at ${r.tBondPeak}`);
  assert.ok(r.bondPeak > r.bondAtBurnout);
});

test('sizing meets both the affected-depth factor and the bondline limit', () => {
  const s = sizeInsulation({ ...wall, safetyFactor: 1.5, bondLimit: 120, minGauge: 1 });
  assert.ok(s.required >= 1.5 * s.mad - 1e-9);
  assert.ok(s.result!.bondPeak <= 120.5, `bond ${s.result!.bondPeak}`);
  assert.ok(!s.result!.burnThrough);
  // affected depth is a few mm, not the whole wall: char growth after burnout is modest
  assert.ok(s.mad < 1.3 * (s.result!.charFrontBurnout), `mad ${s.mad}`);
});

test('exposure around the case: star tips uncover the case earlier than valleys', () => {
  const prop = { rhoP: 1770, a: 4.05, n: 0.35, cStar: 1540 };
  const star = exposureAroundCase(
    { od: 150, length: 600, segments: 1, burningEnds: 0, port: { kind: 'star', points: 7, tipD: 110, valleyD: 40 } }, prop, 7);
  assert.ok(Math.max(...star.exposure) - Math.min(...star.exposure) > 1);
  const tube = exposureAroundCase(
    { od: 150, length: 600, segments: 1, burningEnds: 0, port: { kind: 'circular', d: 80 } }, prop, 7);
  assert.ok(Math.max(...tube.exposure) < 0.1 * tube.burnTime);
});

test('worked example on the insulation page (calculator defaults)', () => {
  const base = { ...wall, erosion: 0.025, soak: 300, safetyFactor: 1.5, bondLimit: 150, minGauge: 1 };
  close(isothermDepth(20, 0, alpha, thetaP) * 1000, 1.93, 0.01);
  close(isothermDepth(20, 0.025e-3, alpha, thetaP) * 1000, 1.64, 0.01);
  close(steadyCharDepth(0.025e-3, alpha, thetaP) * 1000, 4.59, 0.01);
  const ad = sizeInsulation({ ...base, afterBurnout: 'adiabatic' });
  const ra = sizeInsulation({ ...base, afterBurnout: 'radiating' });
  close(ad.result!.charFrontBurnout, 2.14, 0.02);
  close(ad.mad, 2.38, 0.03);
  assert.equal(ad.governs, 'bondline temperature');
  close(ad.required, 8.9, 0.03);
  close(ra.required, 6.7, 0.03);
});
