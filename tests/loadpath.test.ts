import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endLoad, thrust, pressureLoads, flightLoads, bondInertiaShear, lineLoad, ringBoltLoads, tubeStiffness, axialGrowth, shareLoad, mismatchForce, firstFailure } from '../src/lib/loadpath.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('worked example: pressure end loads dwarf the thrust, and balance inside the case', () => {
  const pl = pressureLoads(10, 300, 1.5, 50, 110, 260);
  close(pl.fwd, 706858, 1);
  close(pl.F, 29452, 1);
  close(pl.ratio, 24, 1e-9); // C_F·(dt/D)² = 1.5/36
  close(pl.fwd - pl.aft, pl.F, 1e-6, 'the difference between the ends is the thrust');
  close(pl.nozzle, 65581, 1);
  close(pl.closureStatic, 530929, 1); // the bolted-joints example's 531 kN
  close(pl.closureFiring, pl.closureStatic - pl.F, 1e-6);
  close(thrust(1.5, 10, 50), 1.5 * endLoad(10, 50), 1e-9);
});

test('worked example: the skirt load grows through the burn as the motor gets lighter', () => {
  const F = thrust(1.5, 10, 50);
  const ig = flightLoads(F, 137.81, 50), bo = flightLoads(F, 26.61, 50);
  close(ig.g, 15.99, 0.01); close(bo.g, 39.20, 0.01);
  close(ig.skirt, 7841, 1); close(bo.skirt, 19222, 1);
  close(ig.skirt + ig.motor, F, 1e-6, 'thrust = payload share + motor inertia');
  close(bondInertiaShear(111.2, ig.a, 300, 1000), 0.0185, 0.0001);
});

test('line load and ring bolt loads under axial compression and bending', () => {
  const ll = lineLoad(19222, 3e6, 301.377);
  close(ll.axial, 20.30, 0.01); close(ll.bend, 42.05, 0.01);
  close(ll.maxComp, 62.36, 0.01); close(ll.maxTens, 21.75, 0.01);
  const r = ringBoltLoads(7841, 3e6, 16, 280);
  close(r.maxTension, 2188.5, 0.1); close(r.bend, 2678.6, 0.1);
  close(Math.max(...r.each), r.maxTension, 1e-9);
  close(Math.min(...r.each), -r.maxCompression, 1e-9);
  // the bolt forces carry the axial load and the moment between them
  close(r.each.reduce((s, x) => s + x, 0), -7841, 1e-6);
  const moment = r.each.reduce((s, x, i) => s + x * 140 * Math.cos((2 * Math.PI * i) / 16), 0);
  close(moment, 3e6, 1e-3);
});

test('stiffness and pressure growth of the 300 mm case', () => {
  close(tubeStiffness(205000, 301.377, 1.377, 1000), 267269, 1);
  close(axialGrowth(10, 150, 1.377, 205000, 0.29, 1000), 1.1159, 0.0001);
});

test('parallel paths share by stiffness; a gap delays a path; mismatch loads both', () => {
  const s = shareLoad(30000, { k: 300 }, { k: 100 });
  close(s.f1, 22500, 1e-6); close(s.f2, 7500, 1e-6);
  // path 2 with 0.05 mm slack takes nothing until path 1 has moved that far
  const g = shareLoad(30000, { k: 300 }, { k: 100, gap: 0.05 });
  close(g.f1 + g.f2, 30000, 1e-6);
  close(g.f2, 100 * (g.u - 0.05), 1e-6);
  assert.equal(shareLoad(10, { k: 300 }, { k: 100, gap: 0.05 }).f2, 0);
  // mismatch: equal and opposite forces, δ·k1k2/(k1 + k2)
  const k1 = 267269, k2 = 148666, d = 1.1159 + 0.684;
  const m = shareLoad(0, { k: k1 }, { k: k2 }, d);
  close(m.f1, -m.f2, 1e-6);
  close(m.f2, mismatchForce(d, { k: k1 }, { k: k2 }), 1e-3);
  close(m.f2, 171942, 2);
  // a slip joint with more travel than the mismatch carries nothing
  close(shareLoad(0, { k: k1 }, { k: k2, gap: 2 }, d).f2, 0, 1e-6);
  assert.equal(mismatchForce(d, { k: k1 }, { k: k2, gap: 2 }), 0);
});

test('first failure: the joint fails when its first path does, not at the sum of capacities', () => {
  // stiff bond and soft bolts, each good for 20 kN: the bond takes 90% and goes first
  const ff = firstFailure(1000, { k: 900, cap: 20000 }, { k: 100, cap: 20000 });
  close(ff.load, 20000 / 0.9, 1);
  assert.equal(ff.path, 1);
  // with the mismatch acting, the airframe path has less left for applied load
  const k1 = 267269, k2 = 148666;
  const fm = firstFailure(10000, { k: k1 }, { k: k2, cap: 120000 }, 1.1159);
  close(fm.load, (120000 - mismatchForce(1.1159, { k: k1 }, { k: k2 })) * ((k1 + k2) / k2), 5);
  assert.equal(firstFailure(0, { k: k1 }, { k: k2, cap: 120000 }, 1.8).load, 0, 'the mismatch alone breaks it');
  assert.equal(firstFailure(1000, { k: 1 }, { k: 1 }).load, Infinity);
});
