import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THREADS, torquePreload } from '../src/lib/bolts.ts';
import { holdingTorque, rampTorque, standardLooseningEstimate, slipCapacity, slipMargin, effectiveTorque, FEATURES } from '../src/lib/locking.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const M6 = THREADS.find((t) => t.name === 'M6')!;

test('a tightened thread is self-locking while nothing slips', () => {
  const F = 9340;
  const hold = holdingTorque(F, M6, 0.12, 0.12, 10, 6.6), ramp = rampTorque(F, M6);
  assert.ok(hold > 5 * ramp, 'friction holds the nut several times harder than the ramp pushes it off');
  close(ramp, (F * 1.0) / (2 * Math.PI), 1e-9);
  // tightening torque = holding friction + ramp: the long form of the bolted-joints page
  close(holdingTorque(F, M6, 0.12, 0.12, 10, 6.6) + ramp, torquePreload(1, M6, 0.12, 0.12, 10, 6.6).F ** -1 * F, 1e-6);
});

test('the standard’s self-loosening estimate is π times the bare ramp torque', () => {
  close(standardLooseningEstimate(10000, M6) / rampTorque(10000, M6), Math.PI, 1e-12);
});

test('effective torque with a prevailing-torque feature (NASA-STD-5020B Eqs. 27–30)', () => {
  assert.deepEqual(effectiveTorque(9500, 10500, true, 400), { min: 9500, max: 10500 });
  assert.deepEqual(effectiveTorque(9500, 10500, false, 400), { min: 9100, max: 10500 });
  assert.deepEqual(effectiveTorque(9500, 10500, false, 400, 150), { min: 9100, max: 10350 });
});

test('slip: capacity is friction × clamp × planes; blank factor gives no margin', () => {
  close(slipCapacity(5000, 0.15, 2), 1500, 1e-12);
  assert.equal(slipMargin(5000, 0.15, 1, 300, null), null);
  close(slipMargin(5000, 0.15, 1, 300, 1.25)!, 750 / 375 - 1, 1e-12);
});

test('worked example: 4 × M6 holding a 4 kg unit at 29 g sideways', () => {
  const eff = effectiveTorque(9500, 10500, false, 400);
  const Fmin = torquePreload(eff.min, M6, 0.12, 0.12, 10, 6.6).F * 0.75;
  close(Fmin, 6640, 1);
  close(slipCapacity(Fmin, 0.15), 996, 1);
  close(slipMargin(Fmin, 0.15, 1, 284, 1.25)!, 1.805, 0.002);
  // snug-tight at 2 N·m: the joint slips, so it will self-loosen
  const snug = torquePreload(2000, M6, 0.12, 0.12, 10, 6.6).F * 0.75;
  assert.ok(slipMargin(snug, 0.15, 1, 1137 / 4, 1.25)! < 0);
  // a 0.4 N·m running torque cannot resist the self-loosening moment once the joint slips
  const nom = torquePreload(9800, M6, 0.12, 0.12, 10, 6.6).F; // mid-range effective torque
  close(nom, 9530, 5);
  assert.ok(rampTorque(nom, M6) > 3 * 400);
});

test('feature classes follow the standard', () => {
  const independent = (Object.keys(FEATURES) as (keyof typeof FEATURES)[]).filter((k) => FEATURES[k].independent).sort();
  assert.deepEqual(independent, ['adhesive', 'prevailing', 'wire']);
  assert.equal(FEATURES.wire.mechanical, true);
  assert.equal(FEATURES.split.independent, false);
});
