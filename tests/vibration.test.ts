import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfile, segmentArea, grms, meanSquare, asdAt, dbPerOct, dbToRatio, miles, trans2, sdofResponse, fractionWithin, peaksAbove, steinbergDamage, STEINBERG, G0, type RawRow } from '../src/lib/vibration.ts';
import { snCurve } from '../src/lib/fatigue.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// The page's illustrative profile, written as a specification would be: slopes at the ends, a plateau in the middle.
const SPEC: RawRow[] = [
  { f: 20, value: 3, kind: 'slope' }, { f: 80, value: 0.04, kind: 'asd' },
  { f: 500, value: 0.04, kind: 'asd' }, { f: 2000, value: -3, kind: 'slope' },
];

test('dB per octave and dB ratios', () => {
  close(dbPerOct({ f: 20, a: 0.01 }, { f: 80, a: 0.04 }), 3.0103, 1e-4);
  close(dbToRatio(3), 1.995, 1e-3); // +3 dB doubles the ASD
  close(Math.sqrt(dbToRatio(6)), 1.995, 1e-3); // +6 dB doubles Grms
});

test('segment areas match the closed forms, including the −3 dB/oct (1/f) case', () => {
  close(segmentArea({ f: 20, a: 0.01 }, { f: 80, a: 0.04 }), 1.5, 1e-12); // ASD ∝ f
  close(segmentArea({ f: 80, a: 0.04 }, { f: 500, a: 0.04 }), 16.8, 1e-12);
  close(segmentArea({ f: 500, a: 0.04 }, { f: 2000, a: 0.01 }), 20 * Math.log(4), 1e-9); // ASD ∝ 1/f
  close(meanSquare([{ f: 20, a: 0.01 }, { f: 80, a: 0.04 }, { f: 500, a: 0.04 }, { f: 2000, a: 0.01 }]), 1.5 + 16.8 + 20 * Math.log(4), 1e-9);
});

test('slopes resolve against their neighbours; the example profile is 6.79 Grms', () => {
  const { points, error } = resolveProfile(SPEC);
  assert.equal(error, null);
  close(points[0].a, 0.04 / Math.pow(4, 3 / (10 * Math.log10(2))), 1e-12);
  close(points[3].a, points[0].a, 1e-12);
  close(grms(points), 6.79, 0.005);
  close(asdAt(points, 150), 0.04, 1e-12);
  assert.equal(asdAt(points, 10), 0);
});

test('bad tables are reported, not guessed', () => {
  assert.match(resolveProfile([{ f: 20, value: 3, kind: 'slope' }, { f: 80, value: -3, kind: 'slope' }]).error!, /slope needs an ASD/);
  assert.match(resolveProfile([{ f: 20, value: 0.01, kind: 'asd' }]).error!, /two breakpoints/);
  assert.match(resolveProfile([{ f: 20, value: 0.01, kind: 'asd' }, { f: 20, value: 0.02, kind: 'asd' }]).error!, /share a frequency/);
  assert.match(resolveProfile([{ f: 20, value: 0, kind: 'asd' }, { f: 80, value: 0.02, kind: 'asd' }]).error!, /greater than zero/);
});

test('transmissibility peaks at about Q and passes 1 at √2 f_n', () => {
  close(Math.sqrt(trans2(150, 150, 10)), Math.sqrt(1 + 0.01) * 10, 1e-9);
  close(trans2(150 * Math.SQRT2, 150, 10), 1, 1e-12);
});

test('exact SDOF response matches Miles on a wide flat input', () => {
  // ∫|H|² df over all f = (π/2) f_n Q (1 + 1/Q²) for absolute acceleration; relative displacement has no extra term
  const flat = [{ f: 1, a: 0.04 }, { f: 1e5, a: 0.04 }];
  const r = sdofResponse(flat, 150, 10, 200000);
  close(r.grms / miles(150, 10, 0.04), Math.sqrt(1 + 1 / 100), 0.003);
  close(r.zrms, (miles(150, 10, 0.04) * G0 * 1000) / (2 * Math.PI * 150) ** 2, 0.002);
});

test('worked example: 4 kg unit at 150 Hz, Q = 10', () => {
  const { points } = resolveProfile(SPEC);
  close(miles(150, 10, asdAt(points, 150)), 9.71, 0.005);
  const r = sdofResponse(points, 150, 10);
  close(r.grms, 9.66, 0.005);
  close(4 * 3 * r.grms * G0, 1137, 1); // 3σ load, N
  close(3 * r.zrms, 0.318, 0.001); // 3σ relative displacement, mm
});

test('Gaussian levels and Rayleigh peaks', () => {
  close(fractionWithin(1), 0.6827, 1e-4);
  close(fractionWithin(3), 0.9973, 1e-4);
  close(STEINBERG.reduce((s, b) => s + b.share, 0), 0.9973, 1e-4);
  close(peaksAbove(3, 18000), 200, 0.5);
  close(peaksAbove(4, 18000), 6.04, 0.01);
});

test('Steinberg damage: a pure power-law S-N gives the closed form; the 3σ band dominates', () => {
  const C = 1e20, m = 6; // N = C s^-m
  const d = steinbergDamage(50, 1e5, (s) => C * Math.pow(s, -m));
  const expect = STEINBERG.reduce((t, b) => t + (b.share * 1e5 * Math.pow(b.k * 50, m)) / C, 0);
  close(d.D, expect, 1e-15);
  // worked example: machined 6061-T6 bracket, S_e 96 MPa at 5×10⁸, 4 MPa per g, 120 s at 150 Hz
  const curve = snCurve(310, 96, 5e8, false);
  const w = steinbergDamage(4 * 9.658, 150 * 120, curve.N);
  close(w.D, 1.65e-5, 0.02e-5);
  assert.ok(w.bands[2].d / w.D > 0.95);
});
