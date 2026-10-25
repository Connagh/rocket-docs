import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itValue, shaftDeviations, holeDeviations, isoFit, clearanceShift } from '../src/lib/fits.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const fit = (d: number, h: string, hg: number, s: string, sg: number) => { const f = isoFit(d, h, hg, s, sg); return [Math.round(f.cMin * 1000), Math.round(f.cMax * 1000)]; };

test('standard tolerances and size steps', () => {
  assert.equal(itValue(30, 7), 21); assert.equal(itValue(30.001, 7), 25, 'over 30 is the next step');
  assert.equal(itValue(150, 8), 63); assert.equal(itValue(300, 7), 52); assert.equal(itValue(25, 12), 210, 'IT12 = 10 × IT7');
  assert.throws(() => itValue(600, 7));
});

test('classic fits at 30 mm', () => {
  assert.deepEqual(fit(30, 'H', 7, 'g', 6), [7, 41]);
  assert.deepEqual(fit(30, 'H', 7, 'h', 6), [0, 34]);
  assert.deepEqual(fit(30, 'H', 7, 'k', 6), [-15, 19]);
  assert.deepEqual(fit(30, 'H', 7, 'n', 6), [-28, 6]);
  assert.deepEqual(fit(30, 'H', 7, 'p', 6), [-35, -1]);
  assert.deepEqual(fit(30, 'H', 7, 'r', 6), [-41, -7]);
  assert.deepEqual(fit(30, 'H', 7, 's', 6), [-48, -14]);
  assert.deepEqual(fit(30, 'H', 8, 'f', 7), [20, 74]);
  assert.equal(isoFit(30, 'H', 7, 'k', 6).kind, 'transition');
  assert.equal(isoFit(30, 'H', 7, 's', 6).kind, 'interference');
});

test('other sizes, and hole letters by the Δ rule', () => {
  assert.deepEqual(fit(100, 'H', 7, 's', 6), [-93, -36]);
  assert.deepEqual(fit(100, 'H', 7, 'p', 6), [-59, -2]);
  assert.deepEqual(fit(50, 'H', 8, 'f', 7), [25, 89]);
  const hd = (d: number, l: string, g: number) => { const h = holeDeviations(d, l, g); return [h.ES, h.EI]; };
  assert.deepEqual(hd(30, 'K', 7), [6, -15]); assert.deepEqual(hd(30, 'K', 6), [2, -11]); assert.deepEqual(hd(30, 'K', 8), [10, -23]);
  assert.deepEqual(hd(30, 'M', 7), [0, -21]); assert.deepEqual(hd(30, 'M', 8), [4, -29]);
  assert.deepEqual(hd(30, 'N', 7), [-7, -28]); assert.deepEqual(hd(30, 'N', 8), [-3, -36]); assert.deepEqual(hd(30, 'N', 9), [0, -52]);
  assert.deepEqual(hd(30, 'P', 7), [-14, -35]); assert.deepEqual(hd(30, 'P', 8), [-22, -55]);
  assert.deepEqual(hd(30, 'F', 7), [41, 20]); assert.deepEqual(hd(30, 'JS', 7), [10, -10]);
  const s = shaftDeviations(10, 'k', 8); assert.equal(s.ei, 0, 'k beyond IT7 starts at zero');
});

test('worked example: the O-ring page bore is an H8, and the fits that could go with it', () => {
  const h8 = isoFit(150, 'H', 8, 'f', 7);
  close(h8.hole.min, 150.0, 1e-9); close(h8.hole.max, 150.063, 1e-9);
  assert.deepEqual([Math.round(h8.cMin * 1000), Math.round(h8.cMax * 1000)], [43, 146]);
  assert.deepEqual(fit(150, 'H', 7, 'g', 6), [14, 79]);
  // an aluminium plug in a steel bore: tighter by 0.068 mm at +60 °C, looser by 0.103 mm at −40 °C
  close(clearanceShift(150, 23.4e-6, 12e-6, 60), -0.0684, 1e-6);
  close(clearanceShift(150, 23.4e-6, 12e-6, -40), 0.1026, 1e-6);
  // the aluminium attach ring on the steel ring: 310 H7/s6
  assert.deepEqual(fit(310, 'H', 7, 's', 6), [-202, -118]);
});
