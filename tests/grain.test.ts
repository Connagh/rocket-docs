import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inPort, burnBack, performance, throatForPeak, grainStructure,
  type GrainGeometry, type GrainStructInputs,
} from '../src/lib/grain.ts';

const close = (a: number, b: number, rel = 1e-3) =>
  assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≉ ${b}`);

const prop = { rhoP: 1770, a: 4.05, n: 0.35, cStar: 1540 };
const tube: GrainGeometry = { od: 150, length: 600, segments: 1, burningEnds: 0, port: { kind: 'circular', d: 80 } };

test('star port: tips and valleys are where they should be', () => {
  const star = { kind: 'star' as const, points: 6, tipD: 100, valleyD: 50 };
  assert.ok(inPort(star, 49, 0)); // just inside a tip
  assert.ok(!inPort(star, 51, 0)); // just beyond a tip
  const v = Math.PI / 6; // first valley
  assert.ok(inPort(star, 24 * Math.cos(v), 24 * Math.sin(v)));
  assert.ok(!inPort(star, 26 * Math.cos(v), 26 * Math.sin(v)));
});

test('circular port burn-back matches the analytic perimeter 2π(r + y)', () => {
  const bb = burnBack(tube);
  close(bb.portArea0, Math.PI * 40 ** 2, 0.01);
  close(bb.web, 35, 0.03);
  for (const s of bb.steps.filter((s) => s.y > 3 && s.y < 32)) close(s.perimeter, 2 * Math.PI * (40 + s.y), 0.025);
  assert.ok(bb.sliverFraction < 0.01);
  close(bb.volumetricLoading, 1 - (80 / 150) ** 2, 0.01);
});

test('throat sized for a peak pressure delivers that peak', () => {
  const bb = burnBack(tube);
  const dt = throatForPeak(bb, prop, 7);
  close(performance(bb, prop, dt, 1.5).pMax, 7, 0.005);
});

test('total impulse = C_F · c* · propellant mass (mass conservation)', () => {
  for (const g of [tube, { ...tube, burningEnds: 2 as const, segments: 4, length: 150 }]) {
    const bb = burnBack(g);
    const perf = performance(bb, prop, throatForPeak(bb, prop, 7), 1.5);
    close(perf.impulse, 1.5 * prop.cStar * perf.propMass, 0.03);
  }
});

test('profiles: tube is progressive, BATES is near neutral, end burner is neutral', () => {
  const t = burnBack(tube);
  assert.equal(performance(t, prop, 20, 1.5).profile, 'progressive');
  const bates = burnBack({ od: 150, length: 225, segments: 4, burningEnds: 2, port: { kind: 'circular', d: 50 } });
  assert.ok(performance(bates, prop, 20, 1.5).progressivity < 1.3);
  const end = burnBack({ od: 150, length: 400, segments: 1, burningEnds: 1, port: { kind: 'end' } });
  assert.equal(performance(end, prop, 10, 1.5).profile, 'neutral');
});

const base: GrainStructInputs = {
  boreD: 100, od: 300, alphaP: 100e-6, alphaC: 12e-6, dT: -100,
  eRelaxed: 3.6, bulkK: 3500, pressure: 10, caseE: 205000, caseNu: 0.3, caseT: 1.377, kt: 1,
};

test('worked example on the grain page: thermal, pressure and bond', () => {
  const r = grainStructure(base);
  close(r.thermal, 0.1044, 2e-3);
  close(r.pressure, 0.05633, 2e-3);
  close(r.combined, 0.1607, 2e-3);
  close(r.bond, 0.2534, 2e-3);
});

test('thermal bore strain is independent of propellant modulus and grows with web', () => {
  const soft = grainStructure({ ...base, eRelaxed: 1 }).thermal;
  const stiff = grainStructure({ ...base, eRelaxed: 100 }).thermal;
  assert.equal(soft, stiff);
  assert.ok(grainStructure({ ...base, boreD: 60 }).thermal > grainStructure(base).thermal);
});

test('worked example on the grain page: tube grain against the closed-form integral', () => {
  const bb = burnBack(tube);
  const dt = throatForPeak(bb, prop, 7);
  close(dt, 33.49, 3e-3);
  const p = performance(bb, prop, dt, 1.5);
  close(p.trace[0].p, 2.66, 0.02); // 7 × (80/150)^(1/0.65)
  close(p.burnTime, 5.114, 0.01); // ∫ dy / (a pⁿ) done by hand
  close(p.propMass, 13.43, 5e-3);
  close(p.impulse, 1.5 * 1540 * 13.43, 0.01);
});
