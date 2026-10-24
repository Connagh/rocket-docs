import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalCdf, normalQuantile, noncentralTCdf, toleranceFactor, kAApprox, kBApprox, sampleStats, basisValues, retention } from '../src/lib/allowables.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('normal distribution helpers', () => {
  close(normalCdf(0), 0.5, 1e-9);
  close(normalCdf(1.959964), 0.975, 1e-6);
  close(normalQuantile(0.9), 1.281552, 1e-5);
  close(normalQuantile(0.99), 2.326348, 1e-5);
  close(normalQuantile(0.01), -2.326348, 1e-5);
});

test('noncentral t with δ = 0 is the central t', () => {
  close(noncentralTCdf(0, 10, 0), 0.5, 1e-6);
  close(noncentralTCdf(1.812461, 10, 0), 0.95, 1e-4); // t_0.95, ν = 10
});

test('tolerance factors match published one-sided tables (95% confidence)', () => {
  // [n, k for 90% (B-basis), k for 99% (A-basis)]
  const table: [number, number, number][] = [[5, 3.407, 5.741], [10, 2.355, 3.981], [20, 1.926, 3.295], [30, 1.778, 3.064], [100, 1.527, 2.684]];
  for (const [n, kB, kA] of table) {
    close(toleranceFactor(n, 0.9), kB, 0.003, `kB n=${n}`);
    close(toleranceFactor(n, 0.99), kA, 0.003, `kA n=${n}`);
  }
});

test("CMH-17's approximations are within 1% from n = 10", () => {
  for (const n of [10, 15, 20, 30, 50, 100]) {
    assert.ok(Math.abs(kBApprox(n) / toleranceFactor(n, 0.9) - 1) < 0.01);
    assert.ok(Math.abs(kAApprox(n) / toleranceFactor(n, 0.99) - 1) < 0.01);
  }
});

test('sample statistics use n − 1', () => {
  const s = sampleStats([1, 2, 3, 4]);
  close(s.mean, 2.5, 1e-12);
  close(s.sd, Math.sqrt(5 / 3), 1e-12);
});

test('worked example: 20 tests give B 442.6 and A 430.3 MPa; five tests give less', () => {
  const xs = [471, 458, 463, 449, 467, 455, 476, 452, 461, 444, 468, 459, 457, 472, 450, 464, 446, 462, 456, 469];
  const b = basisValues(xs);
  close(b.mean, 459.95, 1e-9);
  close(b.sd, 8.99, 0.01);
  close(b.B, 442.6, 0.1);
  close(b.A, 430.3, 0.1);
  const b5 = basisValues(xs.slice(0, 5));
  assert.ok(b5.A < b.A - 15); // fewer tests, bigger k, lower allowable
});

test('retention curves interpolate and refuse to extrapolate', () => {
  close(retention('al', 100), 0.9, 1e-12);
  close(retention('al', 125), 0.79, 1e-12);
  close(retention('steel', 20), 1, 1e-12);
  assert.ok(Number.isNaN(retention('al', 400)));
});
