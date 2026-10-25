import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linearStack, capability, monteCarlo, radialStack, rng, sigmaOf, tiltOffset, parseContributors, parseOffsets } from '../src/lib/stack.ts';
import type { Contributor, Offset } from '../src/lib/stack.ts';
import { glandRange } from '../src/lib/gdt.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('worst case adds tolerances, RSS adds variances', () => {
  const cs: Contributor[] = [
    { name: 'a', sens: 1, lo: 9.9, hi: 10.1 }, { name: 'b', sens: -1, lo: 4.95, hi: 5.05 }, { name: 'c', sens: 0.5, lo: 19.8, hi: 20.2 },
  ];
  const s = linearStack(cs);
  close(s.nominal, 10 - 5 + 10, 1e-12); close(s.wc, 0.1 + 0.05 + 0.1, 1e-12);
  close(s.rss, Math.sqrt(0.1 ** 2 + 0.05 ** 2 + 0.1 ** 2), 1e-12, 'Cpk 1, all normal: the textbook RSS');
  close(linearStack(cs, 1.33).sigma, s.sigma / 1.33, 1e-12, 'a better process narrows the band in proportion');
  close(sigmaOf({ name: 'u', sens: 1, lo: 0, hi: 1, dist: 'uniform' }), 0.5 / Math.sqrt(3), 1e-12);
  close(s.rows.reduce((a, r) => a + r.varShare, 0), 1, 1e-12); close(s.rows.reduce((a, r) => a + r.wcShare, 0), 1, 1e-12);
});

test('capability of the result against its limits', () => {
  const c = capability(1, 0.1, 0.7, 1.4);
  close(c.cpk, 1, 1e-12); close(c.below, 0.00135, 2e-5); close(c.above, 3.17e-5, 1e-6);
  assert.equal(capability(1, 0.1).cpk, Infinity);
});

test('Monte Carlo agrees with RSS for normal parts, and is repeatable', () => {
  const cs: Contributor[] = [{ name: 'a', sens: 1, lo: -1, hi: 1 }, { name: 'b', sens: 2, lo: -0.5, hi: 0.5, dist: 'uniform' }];
  const s = linearStack(cs), mc = monteCarlo(cs, { n: 100000, seed: 3 });
  close(mc.mean, 0, 0.005); close(mc.sd, s.sigma, 0.01 * s.sigma);
  assert.equal(monteCarlo(cs, { n: 1000, seed: 9 }).mean, monteCarlo(cs, { n: 1000, seed: 9 }).mean);
  const r = rng(1), u = Array.from({ length: 10000 }, r);
  assert.ok(u.every((v) => v >= 0 && v < 1)); close(u.reduce((a, v) => a + v, 0) / u.length, 0.5, 0.01);
  close(mc.below(0), 0.5, 0.01); close(mc.quantile(0.5), 0, 0.01);
});

// The O-ring page's nozzle seal: squeeze on the open side, with the plug pushed fully across the bore.
const seal = (runout: number): Contributor[] => [
  { name: 'O-ring section', sens: 1, lo: 5.2, hi: 5.46 },
  { name: 'Case bore', sens: -1, lo: 150.0, hi: 150.063 },
  { name: 'Plug pilot', sens: 0.5, lo: 149.86, hi: 149.9 },
  { name: 'Groove root', sens: 0.5, lo: 141.45, hi: 141.55 },
  { name: 'Root runout to pilot', sens: -1, lo: -runout / 2, hi: runout / 2 },
];

test('worked example: the seal-squeeze loop reproduces the GD&T page', () => {
  const base = { boreMin: 150.0, boreMax: 150.063, plugMin: 149.86, plugMax: 149.9, rootMin: 141.45, rootMax: 141.55, csMin: 5.2, csMax: 5.46 };
  for (const runout of [0.05, 0.2]) {
    const s = linearStack(seal(runout)), g = glandRange({ ...base, runout });
    close(s.wcMin, 5.2 - g.gMax, 1e-9, 'least squeeze: smallest ring, deepest gland');
    close(s.wcMin / 5.2, g.squeezeMin, 1e-9);
  }
  const s = linearStack(seal(0.05));
  close(s.nominal, 0.9885, 1e-9); close(s.wcMin, 0.767, 1e-9); close(s.rssMin, 0.8498, 1e-4);
  close(s.rows[0].varShare, 0.878, 0.001, 'the O-ring section is most of the variance');
  // relaxing the runout to the general 0.2: worst case fails a 0.74 mm floor, RSS does not
  const r = linearStack(seal(0.2));
  close(r.wcMin, 0.692, 1e-9); close(r.rssMin, 0.8193, 1e-4);
  close(capability(r.nominal, r.sigma, 0.74).cpk, 1.469, 0.001);
});

test('worked example: Monte Carlo of the squeeze as a fraction of the drawn section', () => {
  const pct = (x: number[]) => (x[0] - (x[1] - x[2] / 2 - x[3] / 2 + x[4])) / x[0];
  const mc = monteCarlo(seal(0.05), { n: 50000, seed: 7, f: pct });
  assert.ok(mc.min > 0.1475, 'never below the worst case'); close(mc.quantile(0.00135), 0.163, 0.002);
  const wide = monteCarlo(seal(0.2).map((c, i) => (i === 4 ? { ...c, dist: 'uniform' as const } : c)), { n: 100000, seed: 7 });
  assert.ok(wide.below(0.74) < 1e-3 && wide.below(0.74) > 0, 'rare but not impossible');
});

test('radial stacks: vectors in random directions', () => {
  const two = radialStack([{ name: 'a', r: 1, kind: 'shift' }, { name: 'b', r: 1, kind: 'shift' }], { n: 100000, seed: 3 });
  close(two.wc, 2, 1e-12); close(two.rssRadii, Math.SQRT2, 1e-12);
  close(two.mc.above(Math.SQRT2), 0.5, 0.01, 'half the assemblies exceed the RSS of the radii');
  const fixed = radialStack([{ name: 'a', r: 0.3, kind: 'fixed' }, { name: 'b', r: 0.2, kind: 'fixed' }], { n: 100 });
  close(fixed.mc.min, 0.5, 1e-12, 'common-direction shifts add arithmetically'); close(fixed.mc.max, 0.5, 1e-12);
  // many zones: the resultant tends to Rayleigh with σ² = Σ r²/4 per axis
  const many = radialStack(Array.from({ length: 12 }, (_, i): Offset => ({ name: `z${i}`, r: 0.1, kind: 'zone' })), { n: 100000, seed: 5 });
  close(many.mc.quantile(0.99), Math.sqrt(0.03) * Math.sqrt(-2 * Math.log(0.01)), 0.02);
  assert.ok(many.mc.max <= many.wc);
});

test('worked example: thrust-line offset at the CG of the 300 mm motor', () => {
  const L = 700;
  close(tiltOffset(0.05, 300, L), 0.11667, 1e-5);
  const offs = (kind: 'shift' | 'fixed', nozzle = 0.1015): Offset[] => [
    { name: 'Case flange bore', r: 0.05, kind: 'zone' }, { name: 'Flange face squareness', r: tiltOffset(0.05, 300, L), kind: 'zone' },
    { name: 'Closure pilot clearance', r: 0.125, kind }, { name: 'Nozzle bore position', r: 0.05, kind: 'zone' },
    { name: 'Nozzle seat squareness', r: tiltOffset(0.03, 180, L), kind: 'zone' }, { name: 'Nozzle pilot clearance', r: nozzle, kind },
    { name: 'Throat to pilot', r: 0.05, kind: 'zone' },
  ];
  const v = radialStack(offs('shift'), { n: 100000, seed: 11 }), h = radialStack(offs('fixed'), { n: 100000, seed: 11 });
  close(v.wc, 0.6098, 1e-4); close(v.rssRadii, 0.2463, 1e-4);
  close(v.mc.above(v.rssRadii), 0.26, 0.015, 'a quarter of motors exceed the RSS of the radii');
  close(v.mc.quantile(0.9973), 0.443, 0.006); close(h.mc.quantile(0.9973), 0.474, 0.006, 'assembled horizontally, clearances all down');
  const g6 = radialStack(offs('fixed', 0.0395), { n: 100000, seed: 11 });
  close(g6.mc.quantile(0.9973), 0.414, 0.006);
});

test('parsing contributor and offset tables', () => {
  const p = parseContributors('Bore, ⌀ H8, -1, 150.000, 150.063\n# comment\nRing, 1, 5.46, 5.20, u\nbad line\nGroove, 0.5, 141.45, 141.55, n');
  assert.equal(p.rows.length, 3); assert.equal(p.rows[0].name, 'Bore, ⌀ H8'); assert.equal(p.bad.length, 1);
  assert.deepEqual([p.rows[1].lo, p.rows[1].hi, p.rows[1].dist], [5.2, 5.46, 'uniform']); assert.equal(p.rows[2].dist, 'normal');
  const o = parseOffsets('Face, squareness, 0.05/300, zone\nPilot, 0.125, shift\nNope, 0.1, sideways', 700);
  assert.equal(o.rows.length, 2); close(o.rows[0].r, 0.11667, 1e-5); assert.equal(o.rows[0].name, 'Face, squareness'); assert.equal(o.bad.length, 1);
  assert.equal(parseOffsets('Face, 0.05/300, zone', NaN).bad.length, 1, 'a tilt needs a lever arm');
});
