import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accelerationFactor, doublingInterval, meanKineticTemperature, arrheniusFit, kelvin, R } from '../src/lib/ageing.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('acceleration factor: 1 at equal temperatures, reciprocal when swapped', () => {
  close(accelerationFactor(80, 25, 25), 1, 1e-12);
  close(accelerationFactor(80, 25, 85) * accelerationFactor(80, 85, 25), 1, 1e-12);
  close(accelerationFactor(80, 25, 85), Math.exp((80000 / R) * (1 / kelvin(25) - 1 / kelvin(85))), 1e-9);
});

test('"doubles every 10 °C" near room temperature is Ea ≈ 53 kJ/mol', () => {
  close(doublingInterval(52.95, 25), 10, 0.01);
  close(accelerationFactor(52.95, 25, 35), 2, 0.001);
});

test('MKT: constant record gives that temperature; a varying one sits above the mean', () => {
  close(meanKineticTemperature(80, [20, 20, 20]), 20, 1e-9);
  const log = [12, 18, 24, 31, 38, 29, 21, 15];
  const mkt = meanKineticTemperature(79.2, log);
  assert.ok(mkt > 23.5);
  close(mkt, 26.88, 0.02);
  // MKT is defined so that the record and a constant MKT age equally
  const rate = (c: number) => Math.exp((-79200 / R) / kelvin(c));
  close(log.reduce((s, c) => s + rate(c), 0) / log.length, rate(mkt), 1e-24);
});

test('Arrhenius fit recovers Ea exactly from synthetic data', () => {
  const B = 9526, A = -19.73;
  const pts = [80, 100, 120].map((t) => ({ t, life: Math.exp(A + B / kelvin(t)) }));
  const fit = arrheniusFit(pts);
  close(fit.B, B, 1e-6);
  close(fit.eaKJ, (B * R) / 1000, 1e-9);
  close(fit.r2, 1, 1e-12);
});

test('worked example: Ea 79 kJ/mol, life 18.9 years at the MKT, 27.2 years at the arithmetic mean', () => {
  const fit = arrheniusFit([{ t: 80, life: 1400 }, { t: 100, life: 330 }, { t: 120, life: 90 }]);
  close(fit.eaKJ, 79.2, 0.05);
  const log = [12, 18, 24, 31, 38, 29, 21, 15];
  const mkt = meanKineticTemperature(fit.eaKJ, log), hours = 8766;
  close(fit.lifeAt(mkt) / hours, 18.94, 0.05);
  close(fit.lifeAt(23.5) / hours, 27.2, 0.05);
  close(accelerationFactor(fit.eaKJ, mkt, 80), 118.6, 0.5);
});
