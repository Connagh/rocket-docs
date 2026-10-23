import { test } from 'node:test';
import assert from 'node:assert/strict';
import { piK, amplified, meopBuildUp, wlfLogShift, reducedTime, relaxModulus } from '../src/lib/propellant.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// The page's worked example.
const ex = { pNom: 8.8, tRef: 20, tHot: 60, tCold: -40, n: 0.35, sigmaP: 0.0013, rateVar: 0.03, abVar: 0.01, atVar: 0.01, other: 0 };

test('π_K = σ_p/(1−n), and pressure follows the burn-rate coefficient amplified by 1/(1−n)', () => {
  close(piK(0.0013, 0.35), 0.002, 1e-12);
  close(amplified(1.01, 0.4), 1.01 ** (1 / 0.6), 1e-12);
  // the primer's rule of thumb: n = 0.4, 1% more area → about 1.7% more pressure
  close(amplified(1.01, 0.4) - 1, 0.0167, 0.0002);
});

test('worked example: hot day, variations, MEOP and the cold minimum', () => {
  const m = meopBuildUp(ex);
  close(m.pHot, 9.533, 0.001);
  close(m.hi.rate, 0.04653, 0.00002);
  close(m.hi.ab, 0.01543, 0.00002);
  close(m.hi.at, 0.01558, 0.00002);
  close(m.rssHi, 0.05143, 0.00002);
  close(m.worst, 0.07923, 0.00002);
  close(m.meop, 10.023, 0.001);
  close(m.meopWorst, 10.288, 0.001);
  close(m.pMin, 7.410, 0.001);
  close(m.burnTimeHot, 0.9231, 0.0001);
  close(m.burnTimeCold, 1.1275, 0.0001);
});

test('total impulse is unchanged by temperature: pressure × burn time is constant', () => {
  const m = meopBuildUp(ex);
  close(m.pHot * m.burnTimeHot, ex.pNom, 1e-9);
  close(m.pCold * m.burnTimeCold, ex.pNom, 1e-9);
});

test('no variation and no temperature change gives MEOP = nominal', () => {
  const m = meopBuildUp({ ...ex, tHot: 20, rateVar: 0, abVar: 0, atVar: 0 });
  close(m.meop, 8.8, 1e-12);
  close(m.meopWorst, 8.8, 1e-12);
});

test('WLF shift: zero at Ts, sign and magnitude as the worked example', () => {
  close(wlfLogShift(-20, -20), 0, 1e-12);
  close(wlfLogShift(-40, -20), 2.1716, 0.0001); // colder → slower → a_T > 1
  close(wlfLogShift(20, -20), -2.5028, 0.0001);
  close(reducedTime(1e4, -40, -20), 1e4 / 10 ** 2.1716, 0.01);
});

test('master curve: cold ignition is about 14 times stiffer than an 8-hour cool-down', () => {
  const c = { eEq: 3, e1: 5, m: 0.3, eGlass: 2500 };
  const cool = relaxModulus(reducedTime(8 * 3600, -40, -20), c);
  const ign = relaxModulus(reducedTime(0.05, -40, -20), c);
  close(cool, 4.03, 0.01);
  close(ign, 58.0, 0.1);
  close(ign / cool, 14.4, 0.1);
  close(relaxModulus(1e-30, c), 2500, 1e-9); // capped at glassy
});
