import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, biot, timeConstant, lumpedTimeTo, characteristicLength } from '../src/lib/thermal.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// Exact centre / back-face solutions for a sudden surface temperature (Bi → ∞), θ = (T − T_s)/(T_0 − T_s).
const exact = {
  slab: (Fo: number) => { let s = 0; for (let n = 0; n < 60; n++) { const l = ((2 * n + 1) * Math.PI) / 2; s += ((4 * (-1) ** n) / ((2 * n + 1) * Math.PI)) * Math.exp(-l * l * Fo); } return s; },
  cylinder: (Fo: number) => {
    const z = [2.404825557695773, 5.520078110286311, 8.653727912911013, 11.79153443901428, 14.93091770848779];
    const j1 = [0.5191474972894669, -0.3402648065374243, 0.2714522999283819, -0.2324598314252191, 0.2065464331870958];
    return z.reduce((s, zi, i) => s + (2 / (zi * j1[i])) * Math.exp(-zi * zi * Fo), 0);
  },
  sphere: (Fo: number) => { let s = 0; for (let n = 1; n < 60; n++) s += 2 * (-1) ** (n + 1) * Math.exp(-n * n * Math.PI * Math.PI * Fo); return s; },
};

test('conduction solver matches the exact series solutions for slab, cylinder and sphere', () => {
  const m = { k: 1, rho: 1000, cp: 1000 }, L = 0.01; // α = 1e-6, so t = 100·Fo
  for (const g of ['slab', 'cylinder', 'sphere'] as const)
    for (const Fo of [0.1, 0.2, 0.5]) {
      const r = solve({ geometry: g, layers: [{ mat: m, thickness: L }], t0: 0, phases: [{ duration: 100 * Fo, h: 1e9, tEnv: 1 }], cellsPerLayer: 80, stepsPerPhase: 800 });
      close(1 - r.back[r.back.length - 1], exact[g](Fo), 0.0015, `${g} Fo=${Fo}`);
    }
});

test('at a small Biot number the conduction answer is the lumped answer', () => {
  const steel = { k: 45, rho: 7850, cp: 480 };
  const r = solve({ geometry: 'slab', layers: [{ mat: steel, thickness: 0.003 }], t0: 20, phases: [{ duration: 120, h: 100, tEnv: 800 }] });
  assert.ok(r.biot < 0.01);
  close(r.mean[r.mean.length - 1], r.lumped[r.lumped.length - 1], 2);
  close(r.tau, (7850 * 480 * 0.003) / 100, 1e-9);
});

test('energy balance: heat into the surface equals the rise in stored heat', () => {
  const m = { k: 0.5, rho: 1500, cp: 1200 }, h = 50, Te = 300;
  const r = solve({ geometry: 'slab', layers: [{ mat: m, thickness: 0.02 }], t0: 20, phases: [{ duration: 600, h, tEnv: Te }], stepsPerPhase: 2000 });
  let q = 0;
  for (let i = 1; i < r.t.length; i++) q += h * (Te - (r.surface[i] + r.surface[i - 1]) / 2) * (r.t[i] - r.t[i - 1]);
  const stored = m.rho * m.cp * 0.02 * (r.mean[r.mean.length - 1] - 20);
  close(q / stored, 1, 0.01);
});

test('helpers: characteristic length, Biot, time constant, lumped time to a limit', () => {
  close(characteristicLength('cylinder', 0.15), 0.075, 1e-12);
  close(characteristicLength('sphere', 0.15), 0.05, 1e-12);
  close(biot('cylinder', [{ mat: { k: 0.4, rho: 1770, cp: 1300 }, thickness: 0.15 }], 10), 1.875, 1e-12);
  const tau = timeConstant('slab', [{ mat: { k: 45, rho: 7850, cp: 480 }, thickness: 0.001377 }], 8);
  close(lumpedTimeTo(tau, 20, 40, 39)!, tau * Math.log(20), 1e-9);
  assert.equal(lumpedTimeTo(tau, 20, 40, 45), null);
});

test('worked example 2: conditioning a 300 mm grain takes far longer than the lumped model says', () => {
  const prop = { k: 0.4, rho: 1770, cp: 1300 };
  const r = solve({ geometry: 'cylinder', layers: [{ mat: prop, thickness: 0.15 }], t0: 20, phases: [{ duration: 6 * 86400, h: 10, tEnv: 60 }], limit: 58, stepsPerPhase: 1500 });
  close(r.tLimit! / 3600, 34.4, 0.3);
  close(lumpedTimeTo(r.tau, 20, 60, 58)! / 3600, 14.4, 0.1);
});

test('worked example 3: soak-back peaks minutes after burnout, much lower behind a thick boss', () => {
  const steel = { k: 45, rho: 7850, cp: 480 }, epdm = { k: 0.25, rho: 1100, cp: 2000 };
  const run = (ts: number) => solve({ geometry: 'slab', layers: [{ mat: epdm, thickness: 0.006 }, { mat: steel, thickness: ts }], t0: 20,
    phases: [{ duration: 20, h: 1e7, tEnv: 1200 }, { duration: 3600, h: 10, tEnv: 20 }], stepsPerPhase: 800 });
  const boss = run(0.02), wall = run(0.0014);
  close(boss.peakBack, 61.6, 1);
  close(wall.peakBack, 225, 3);
  assert.ok(boss.tPeakBack > 20 && wall.tPeakBack > 20); // both after burnout
  assert.ok(boss.endHeat.back < 25 && wall.endHeat.back < 25); // barely warm at burnout itself
});
