import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motorPerformance, inertForFraction } from '../src/lib/massfraction.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// The page's worked example: the 300 mm D6AC motor from the case, grain and insulation pages.
const example = { propellant: 111.2, inert: 11.77 + 4.84 + 6 + 4, payload: 50, isp: (1.5 * 1540) / 9.80665 };

test('worked example: mass fraction, Δv and trade numbers', () => {
  const p = motorPerformance(example);
  close(p.c, 2310, 1e-9, 'c = C_F c*');
  close(p.fraction, 0.807, 0.0005);
  close(p.massRatio, 2.4515, 0.0005);
  close(p.dv, 2071, 1);
  close(p.dvPerKgInert, 17.85, 0.01);
  close(p.exchange, 1.4515, 0.0005);
});

test('Δv cost per inert kg matches a finite difference', () => {
  const d = 1e-4;
  const a = motorPerformance(example), b = motorPerformance({ ...example, inert: example.inert + d });
  close((a.dv - b.dv) / d, a.dvPerKgInert, 1e-3);
});

test('adding exchange × δ propellant per δ inert holds Δv exactly', () => {
  const a = motorPerformance(example);
  const b = motorPerformance({ ...example, inert: example.inert + 2, propellant: example.propellant + 2 * a.exchange });
  close(b.dv, a.dv, 1e-9);
});

test('inertForFraction inverts the mass fraction', () => {
  const mi = inertForFraction(111.2, 0.9);
  close(motorPerformance({ propellant: 111.2, inert: mi, payload: 0, isp: 250 }).fraction, 0.9, 1e-12);
});
