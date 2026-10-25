import { test } from 'node:test';
import assert from 'node:assert/strict';
import { section, shearStress, beam, BEAM_CASES, circularPlate, rectCoefficients, rectPlate, flexuralRigidity, shell, lugChecks, column, secantStress } from '../src/lib/handcalc.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('section properties and peak shear stress', () => {
  const r = section('rect', 20, 60)!;
  close(r.I, (20 * 60 ** 3) / 12, 1e-9);
  close(shearStress(1000, r), (1.5 * 1000) / (20 * 60), 1e-12, 'rectangle: 1.5 V/A');
  const c = section('round', 20)!;
  close(shearStress(1000, c), ((4 / 3) * 1000) / c.A, 1e-12, 'solid round: 4V/3A');
  // a thin tube tends to 2V/A, and to πr³t
  const t = section('tube', 302.754, 1.377)!;
  close(shearStress(1000, t) / (1000 / t.A), 2, 0.01);
  close(t.I, Math.PI * 150.6885 ** 3 * 1.377, 0.001 * t.I);
  // a rectangular hollow section is a solid one minus its hole
  const h = section('rhs', 50, 100, 5)!, outer = section('rect', 50, 100)!, hole = section('rect', 40, 90)!;
  close(h.I, outer.I - hole.I, 1e-6); close(h.A, outer.A - hole.A, 1e-9);
  assert.equal(section('tube', 10, 6), null);
});

test('beam cases match the handbook formulas, and the curves end where the peaks say', () => {
  const W = 1000, L = 500, EI = 2e9;
  const expect: Record<string, [number, number]> = {
    'cant-point': [W * L, (W * L ** 3) / (3 * EI)], 'cant-udl': [(W * L) / 2, (W * L ** 3) / (8 * EI)],
    'ss-point': [(W * L) / 4, (W * L ** 3) / (48 * EI)], 'ss-udl': [(W * L) / 8, (5 * W * L ** 3) / (384 * EI)],
    'ff-point': [(W * L) / 8, (W * L ** 3) / (192 * EI)], 'ff-udl': [(W * L) / 12, (W * L ** 3) / (384 * EI)],
  };
  for (const { key } of BEAM_CASES) {
    const b = beam(key, W, L, EI);
    close(b.M, expect[key][0], 1e-9, key); close(b.delta, expect[key][1], 1e-12, key);
    const xs = Array.from({ length: 401 }, (_, i) => (L * i) / 400);
    close(Math.max(...xs.map((x) => Math.abs(b.Mx(x)))), b.M, 1e-6, `${key} moment curve`);
    close(Math.max(...xs.map(b.wx)), b.delta, 1e-9, `${key} deflection curve`);
    close(b.wx(0), 0, 1e-12, `${key} zero at the left end`);
  }
});

test('worked example: the motor case as a beam on two cradles barely notices 3 g', () => {
  const t = section('tube', 302.754, 1.377)!;
  const b = beam('ss-udl', 137.81 * 9.80665 * 3, 1000, 205000 * t.I);
  close(b.M / t.Z, 5.18, 0.01);
  close(b.delta, 0.0174, 0.0001);
});

test('circular plates: Roark, and the worked-example blanking plate', () => {
  const q = 11, a = 142.5, t = 25, E = 205000, nu = 0.29;
  const ss = circularPlate('ss', q, a, t, E, nu), cl = circularPlate('clamped', q, a, t, E, nu);
  close(ss.sigma, 440.93, 0.01); close(ss.w, 0.997, 0.001); close((ss.slope * 180) / Math.PI, 0.606, 0.001);
  close(ss.sr(0), ss.sigma, 1e-9); close(ss.sr(a), 0, 1e-9, 'no radial moment at a simple support');
  close(cl.sigma, (3 * q * a * a) / (4 * t * t), 1e-9); close(-cl.sr(a), cl.sigma, 1e-9);
  close(cl.w, (q * a ** 4) / (64 * flexuralRigidity(E, t, nu)), 1e-12);
  close(cl.sr(0), cl.st(0), 1e-9, 'equal at the centre');
});

test('rectangular plates: coefficients tend to the strip-beam values', () => {
  const ss = rectCoefficients('ss', 1, 1e6), cl = rectCoefficients('clamped', 1e6, 1);
  close(ss.beta, 0.75, 1e-3); close(cl.beta, 0.5, 1e-3);
  // a long simply supported strip: 5qb⁴/(384D) with ν = 0.3
  close(ss.alpha, (5 * 12 * (1 - 0.09)) / 384, 2e-4);
  close(rectCoefficients('ss', 1, 1).beta, 0.2874, 1e-9);
  // 1.5 : 1 sits between the 1.4 and 1.6 rows, interpolated in b/a
  const f = (1 / 1.4 - 1 / 1.5) / (1 / 1.4 - 1 / 1.6);
  close(rectCoefficients('clamped', 150, 100).beta, 0.4356 + f * (0.468 - 0.4356), 1e-9);
  const p = rectPlate('ss', 1, 300, 100, 5, 70000);
  close(p.sigma, (0.7134 * 1 * 100 ** 2) / 25, 1e-9);
});

test('thin cylinder: membrane stresses, growth and the clamped-edge zone', () => {
  const s = shell(10, 150.69, 1.377, 205000, 0.29, true);
  close(s.hoop, 1094.3, 0.1); close(s.axial, s.hoop / 2, 1e-9);
  close(s.growth, (10 * 150.69 ** 2 * (1 - 0.145)) / (205000 * 1.377), 1e-12);
  close(s.decayLength, 35.15, 0.01);
  // a clamped edge bends the wall to 1.55 × the hoop stress (closed end, ν = 0.29); 1.82 × with open ends, ν = 0.3
  close(s.edgeBend / s.hoop, 1.547, 0.001);
  close(shell(10, 150, 1.5, 200000, 0.3, false).edgeBend / shell(10, 150, 1.5, 200000, 0.3, false).hoop, 1.816, 0.001);
  close(s.hoopAt(0), 0.29 * s.axial, 1e-6, 'no hoop strain at a rigid edge');
  close(s.innerAt(0), s.peakAxial, 1e-9);
  close(s.hoopAt(10 * s.decayLength), s.hoop, 1e-6, 'membrane far from the edge');
  close(s.innerAt(10 * s.decayLength), s.axial, 1e-6);
  assert.equal(s.thick, false); assert.equal(shell(10, 50, 6, 205000, 0.29).thick, true);
});

test('worked example: thrust-rod clevis — pin bending governs', () => {
  const c = lugChecks({ P: 1.25 * 29452, t: 10, W: 36, e: 18, D: 12.2, d: 12, t2: 6, g: 0.5, Ftu: 470, Fsu: 282, Fbru: 705, pinFtu: 1000, pinFsu: 600 });
  const ms = Object.fromEntries(c.map((x) => [x.key, x.allow / x.stress - 1]));
  close(ms.net, 2.04, 0.01); close(ms.shear, 0.82, 0.01); close(ms.bear, 1.3, 0.01); close(ms.pinS, 2.69, 0.01); close(ms.pinB, 0.54, 0.01);
  assert.equal(c.reduce((a, b) => (b.stress / b.allow > a.stress / a.allow ? b : a)).key, 'pinB');
});

test('columns: Johnson meets Euler at the transition; the thrust rod is short', () => {
  const s = section('tube', 25, 2.5)!;
  const c = column(s, 600, 1, 205000, 355);
  assert.equal(c.mode, 'Johnson');
  close(c.Pcr, 47270, 1); close(c.PcrEuler, 63625, 1);
  // at the transition slenderness the two curves agree, at half the yield stress
  const Lt = (c.transition * s.r) / 1;
  const ct = column(s, Lt, 1, 205000, 355);
  close(ct.euler, 177.5, 1e-6); close(ct.johnson, 177.5, 1e-6);
  // secant: zero eccentricity is P/A; it blows up at the Euler load
  close(secantStress(10000, s, 600, 1, 205000, 0), 10000 / s.A, 1e-9);
  close(secantStress(1.1 * 29452, s, 600, 1, 205000, 0.6), 232.7, 0.1);
  assert.equal(secantStress(c.PcrEuler * 1.01, s, 600, 1, 205000, 0.6), Infinity);
});
