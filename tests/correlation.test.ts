import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gaugeStats, parseGauges, strainAt, gaugeUncertainty, mac, macMatrix, parseModes, pairModes, requiredChange } from '../src/lib/correlation.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// the 300 mm case at the 11 MPa proof test: membrane strains with nominal wall
const E = 205000, nu = 0.29, sh = (11 * 150.69) / 1.377, sa = sh / 2;
const eh = ((sh - nu * sa) / E) * 1e6, ea = ((sa - nu * sh) / E) * 1e6, ed = ((((11 * 150.69) / 1.377) * (1 - nu)) / E) * 1e6;
const ROWS = [[4990, eh], [1245, ea], [4950, eh], [1260, ea], [4680, eh], [1150, ea], [4230, ed], [4120, ed]].map(([t, m], i) => ({ name: `G${i + 1}`, test: t, model: m }));

test('worked example: one station off in both directions; the measured wall explains it, a tuned modulus does not', () => {
  close(eh, 5020.6, 0.1); close(ea, 1233.1, 0.1); close(ed, 4169.2, 0.1);
  const before = gaugeStats(ROWS, 0.05);
  assert.equal(before.outside, 2); close(before.mean, 0.9849, 1e-4); close(before.sd, 0.0348, 1e-4); close(before.r2, 0.9959, 1e-4);
  close(before.each[4].ratio, before.each[5].ratio, 0.002, 'G5 and G6 low by the same ratio');
  const measured = ROWS.map((g, i) => (i === 4 || i === 5 ? { ...g, model: (g.model * 1.377) / 1.47 } : g));
  const after = gaugeStats(measured, 0.05);
  assert.equal(after.outside, 0); close(after.mean, 1.0006, 1e-4); close(after.sd, 0.0131, 1e-4);
  const tuned = gaugeStats(ROWS.map((g) => ({ ...g, model: (g.model * 1.377) / 1.47 })), 0.05);
  assert.equal(tuned.outside, 6, 'fixing two gauges with a global change breaks six');
  // the slope through the origin of a perfect match is 1
  close(gaugeStats([{ name: 'a', test: 2, model: 2 }, { name: 'b', test: 5, model: 5 }]).slope, 1, 1e-12);
});

test('parsing gauge and mode tables', () => {
  assert.deepEqual(parseGauges('G1, 10, 11\n\nbad line\nG2;20;19'), [{ name: 'G1', test: 10, model: 11 }, { name: 'G2', test: 20, model: 19 }]);
  assert.deepEqual(parseGauges('G5 hoop, 250 mm from fwd dome, 4680, 5021'), [{ name: 'G5 hoop, 250 mm from fwd dome', test: 4680, model: 5021 }], 'names may contain commas');
  assert.deepEqual(parseModes('1 2\n3, 4\n5\t6'), [[1, 3, 5], [2, 4, 6]]);
});

test('gauge uncertainty: transverse sensitivity dominates the axial gauge; principal-direction gauges shrug off misalignment', () => {
  const ax = gaugeUncertainty({ e1: 4950, e2: 1260, angle: 90, gfTol: 0.01, kt: 0.005, nu0: 0.285, misalign: 2, posErr: 1, gradient: 0, instr: 5 });
  close(ax.reading, 1260, 1e-9); close(ax.parts.transverse, 26.58, 0.01); close(ax.total, 30.18, 0.01); close(ax.fraction, 0.0239, 1e-4);
  close(ax.parts.misalignment, 4.49, 0.01, 'second order along a principal direction');
  close(Math.abs(strainAt(4950, 1260, 47) - strainAt(4950, 1260, 45)), 128.7, 0.1, 'first order at 45°');
  close(strainAt(4950, 1260, 0), 4950, 1e-9); close(strainAt(4950, 1260, 90), 1260, 1e-9);
});

test('MAC: 1 for parallel vectors whatever the scale, 0 for orthogonal; the worked-example modes pair and plausibility', () => {
  close(mac([1, 2, 3], [-2, -4, -6]), 1, 1e-12); close(mac([1, 0], [0, 1]), 0, 1e-12);
  const model = [[0.045, 0.166, 0.34, 0.547, 0.771, 1], [-0.225, -0.59, -0.714, -0.423, 0.216, 1], [0.489, 0.722, 0.02, -0.644, -0.218, 1]];
  const testModes = [[0.07, 0.2, 0.37, 0.57, 0.78, 1], [-0.19, -0.55, -0.69, -0.42, 0.2, 1], [0.45, 0.7, 0.06, -0.6, -0.25, 1]];
  const M = macMatrix(testModes, model);
  const pairs = pairModes([138, 905, 2590], [150, 940, 2632], M);
  assert.deepEqual(pairs.map((p) => p.model), [0, 1, 2]);
  pairs.forEach((p) => assert.ok(p.mac > 0.99));
  close(pairs[0].df, 0.0870, 1e-4); close(pairs[2].df, 0.0162, 1e-4);
  // six points cannot separate these shapes better than about 0.1 even when they are perfect
  close(Math.max(...macMatrix(model, model).flatMap((r, i) => r.filter((_, j) => j !== i))), 0.1, 0.01);
  close(requiredChange(138, 150, 0.5), -0.1536, 1e-4, 'modulus: implausible');
  close(requiredChange(138, 150, 0.35), -0.2120, 1e-4, 'joint stiffness: plausible');
  close(requiredChange(150, 150, 0.5), 0, 1e-12);
});
