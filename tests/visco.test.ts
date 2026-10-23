import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instantaneous, relaxation, dynamic, wlfFromTg, logShift, creepCompliance, recoveryAfterHold, abaqusCard } from '../src/lib/visco.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// The page's illustrative seal compound.
const seal = { eInf: 6, terms: [[276, 1e-7], [195, 3.16e-7], [138, 1e-6], [98, 3.16e-6], [69.4, 1e-5], [49.1, 3.16e-5], [34.8, 1e-4], [24.6, 3.16e-4], [17.4, 1e-3], [12.3, 3.16e-3], [8.73, 0.01], [6.18, 0.0316], [4.38, 0.1], [3.1, 0.316], [2.19, 1], [1.55, 3.16], [1.1, 10], [0.778, 31.6], [0.551, 100], [0.39, 316], [0.276, 1e3], [0.195, 3.16e3], [0.138, 1e4], [0.098, 3.16e4], [0.0694, 1e5], [0.0491, 3.16e5], [0.0348, 1e6]].map(([e, tau]) => ({ e, tau })) };
const sls = { eInf: 2, terms: [{ e: 8, tau: 1 }] }; // standard linear solid: exact creep known

test('relaxation runs from the instantaneous to the long-term modulus', () => {
  close(relaxation(seal, 0), instantaneous(seal), 1e-9);
  close(relaxation(seal, 1e15), 6, 1e-9);
});

test('creep of a standard linear solid matches the exact solution', () => {
  // J(t) = 1/E∞ − (1/E∞ − 1/E0) e^(−t/λ), λ = τ E0/E∞
  const lam = 1 * 10 / 2, ts = [0.1, 1, 5, 20];
  const J = creepCompliance(sls, ts);
  ts.forEach((t, k) => close(J[k], 1 / 2 - (1 / 2 - 1 / 10) * Math.exp(-t / lam), 0.003 * J[k], `t=${t}`));
});

test('creep is slower than the inverse of relaxation: J(t)·E(t) ≤ 1, and J → 1/E∞', () => {
  const ts = [1e-6, 1e-3, 1, 1e3, 1e6];
  creepCompliance(seal, ts).forEach((j, k) => assert.ok(j * relaxation(seal, ts[k]) <= 1 + 1e-9));
  close(creepCompliance(seal, [1e13])[0] * 6, 1, 1e-6);
});

test('dynamic moduli: rubbery at low frequency, glassy at high, loss peak at ωτ = 1 for one arm', () => {
  close(dynamic(seal, 1e-12).storage, 6, 1e-6);
  close(dynamic(seal, 1e12).storage, instantaneous(seal), 0.01);
  const loss = (w: number) => dynamic(sls, w).loss;
  assert.ok(loss(1) > loss(0.9) && loss(1) > loss(1.1));
});

test('universal WLF from Tg: Tref = Tg + 50 K gives the 8.86 / 101.6 used on the propellant page', () => {
  const { c1, c2 } = wlfFromTg(-70, -20);
  close(c1, 8.86, 0.01);
  close(c2, 101.6, 1e-9);
  close(logShift(-20, -20, c1, c2), 0, 1e-12);
});

test('worked example: sealing force after a year at 40 °C, and cold recovery', () => {
  const { c1, c2 } = wlfFromTg(-20, 20);
  const aT = (T: number) => 10 ** logShift(T, 20, c1, c2);
  close(relaxation(seal, 1), 11.61, 0.01);
  close(relaxation(seal, 3.156e7 / aT(40)) / relaxation(seal, 1 / aT(40)), 0.789, 0.002);
  close(aT(0) / aT(40), 32000, 300);
  // stored a year at 40 °C, then released at 40 °C or at 0 °C: recovery within 0.1 s
  close(recoveryAfterHold(seal, 3.156e7 / aT(40), [0.1 / aT(40)]).at[0], 0.627, 0.003);
  close(recoveryAfterHold(seal, 3.156e7 / aT(40), [0.1 / aT(0)]).at[0], 0.064, 0.003);
});

test('released straight away, the material springs back fully at once', () => {
  close(recoveryAfterHold(seal, 0, [1e-3]).immediate, 1, 1e-9);
});

test('solver card: normalised g_i sum below 1, instantaneous modulus on *ELASTIC', () => {
  const card = abaqusCard(seal, 0.495, 20, 9.82, 91.6);
  assert.match(card, /MODULI=INSTANTANEOUS/);
  const g = card.split('\n').filter((l) => /^\d.*, 0\., /.test(l)).map((l) => +l.split(',')[0]);
  assert.equal(g.length, 27);
  close(g.reduce((a, b) => a + b, 0), 1 - 6 / instantaneous(seal), 1e-4);
});
