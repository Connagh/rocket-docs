import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THREADS } from '../src/lib/bolts.ts';
import { internalMinor, internalShearArea, externalShearArea, helicalTapMajor, stripping, balancedEngagement, platingPitchGrowth } from '../src/lib/threads.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const M6 = THREADS.find((t) => t.name === 'M6')!;
const M10 = THREADS.find((t) => t.name === 'M10')!;

test('basic profile: D1 and the 7/8 and 3/4 shear fractions', () => {
  close(internalMinor(M10), 8.376, 0.001); // ISO 724 basic minor diameter of the nut thread
  close(internalShearArea(M6, 1) / (Math.PI * 6), 7 / 8, 1e-6);
  close(externalShearArea(M6, 1) / (Math.PI * internalMinor(M6)), 3 / 4, 1e-6);
  // areas grow in proportion to engagement length
  close(internalShearArea(M10, 15) / internalShearArea(M10, 5), 3, 1e-12);
});

test('minimum-material limits shrink the shear areas', () => {
  const lim = { dMin: M10.d - 0.268, D2Max: M10.d2 + 0.18, D1Max: internalMinor(M10) + 0.3, d2Min: M10.d2 - 0.17 };
  assert.ok(internalShearArea(M10, 10, lim) < internalShearArea(M10, 10));
  assert.ok(externalShearArea(M10, 10, lim) < externalShearArea(M10, 10));
});

test('the bolt should break before the threads strip', () => {
  const base = { t: M6, Rm: 1040, tauBolt: 624, tauInt: 186 }; // class 10.9 into 6061-T6
  close(balancedEngagement(base), 6.82, 0.01);
  assert.equal(stripping({ ...base, Le: 6 }).first, 'internal');
  assert.equal(stripping({ ...base, Le: 9 }).first, 'bolt');
  close(stripping({ ...base, Le: 9 }).ratio, 1.32, 0.005);
});

test('a helical-coil insert moves the shear out to a larger diameter', () => {
  const base = { t: M6, Rm: 1040, tauBolt: 624, tauInt: 186 };
  close(helicalTapMajor(M6), 7.3, 1e-9);
  close(balancedEngagement({ ...base, insert: true }) / balancedEngagement(base), 6 / 7.3, 1e-6);
  assert.equal(stripping({ ...base, Le: 6, insert: true }).first, 'bolt');
});

test('a steel nut needs little engagement; plating grows the pitch diameter by four thicknesses', () => {
  close(balancedEngagement({ t: M6, Rm: 1040, tauBolt: 624, tauInt: 624 }), 2.89, 0.01);
  close(platingPitchGrowth(0.008), 0.032, 1e-12);
});
