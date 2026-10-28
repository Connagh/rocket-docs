import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phi, standardU, budget, thermalError, acceptanceLimits, tur, decisionRisk, gaugeRR, grrBand, parseStudy, makeStudy, limitGauges, functionalPin } from '../src/lib/gauging.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('normal distribution', () => {
  close(phi(0), 0.5, 1e-9); close(phi(1.96), 0.975, 1e-4); close(phi(-3), 0.00135, 1e-5);
});

test('uncertainty contributions and the combined value', () => {
  close(standardU(2, 'k2'), 1, 1e-12); close(standardU(Math.sqrt(3), 'rect'), 1, 1e-12); close(standardU(1, 'res'), 0.2887, 1e-4);
  const b = budget([{ name: 'a', value: 3, kind: 'std' }, { name: 'b', value: 4, kind: 'std' }, { name: 'blank', value: NaN, kind: 'std' }]);
  close(b.uc, 5, 1e-12); close(b.U, 10, 1e-12); assert.equal(b.parts.length, 2); close(b.parts[1].share, 0.64, 1e-12);
});

test('temperature: 2 K on a 150 mm steel bore is 3.7 µm; equal temperatures and equal materials cancel', () => {
  close(thermalError(150e3, 12.3e-6, 22, 12.3e-6, 20), 3.69, 1e-6);
  close(thermalError(150e3, 12.3e-6, 25, 12.3e-6, 25), 0, 1e-9);
});

test('worked example: the bore gauge budget, TUR and guarded acceptance', () => {
  const b = budget([
    { name: 'setting ring', value: 1.5, kind: 'k2' }, { name: 'repeatability', value: 1.2, kind: 'std' },
    { name: 'resolution', value: 1, kind: 'res' }, { name: 'temperature', value: 3.69, kind: 'rect' }, { name: 'alignment', value: 1, kind: 'rect' },
  ]);
  close(b.uc, 2.638, 0.001); close(b.U, 5.28, 0.01); close(tur(0, 63, b.U), 5.97, 0.01);
  close(b.parts[3].share, 0.65, 0.01, 'temperature dominates');
  const a = acceptanceLimits(0, 63, b.U, 'guard');
  close(a.lo, 5.28, 0.01); close(a.hi, 57.72, 0.01);
  const simple = decisionRisk({ lsl: 0, usl: 63, lo: 0, hi: 63, mean: 31.5, sd: 9, uc: b.uc });
  const guard = decisionRisk({ lsl: 0, usl: 63, lo: a.lo, hi: a.hi, mean: 31.5, sd: 9, uc: b.uc });
  close(simple.pfa * 1e6, 117, 3); close(guard.pfa * 1e6, 3, 1); close(guard.pfr * 100, 0.47, 0.02);
  close(simple.pOut, 2 * phi(-3.5), 1e-6, 'integration agrees with the closed form');
});

test('decision risk: a perfect gauge has no false decisions', () => {
  const r = decisionRisk({ lsl: 0, usl: 10, lo: 0, hi: 10, mean: 5, sd: 2, uc: 0 });
  close(r.pfa, 0, 1e-4); close(r.pfr, 0, 1e-4); close(r.pAccept, 1 - r.pOut, 1e-4);
});

test('gauge R&R: AIAG average and range method', () => {
  // two operators, two trials, three parts, worked by hand
  const d = [[[1, 5, 9], [2, 5, 10]], [[2, 6, 10], [2, 7, 10]]];
  const r = gaugeRR(d, 20)!;
  close(r.Rbar, 0.5, 1e-12); close(r.EV, 0.4431, 1e-4);
  close(r.xdiff, 37 / 6 - 32 / 6, 1e-9);
  close(r.AV, Math.sqrt((r.xdiff * 0.7071) ** 2 - r.EV ** 2 / 6), 1e-9);
  close(r.PV, (9.75 - 1.75) * 0.5231, 1e-9);
  close(r.TV, Math.hypot(r.GRR, r.PV), 1e-12);
  close(r.pctTol, (100 * 6 * r.GRR) / 20, 1e-9);
  assert.equal(gaugeRR([[[1, 2]]]), null, 'one operator and one trial is not a study');
  assert.equal(grrBand(8), 'acceptable'); assert.equal(grrBand(20), 'marginal'); assert.equal(grrBand(31), 'not acceptable');
});

test('worked example: the synthetic bore study is repeatable and marginal', () => {
  const d = makeStudy({ parts: 10, trials: 3, partSd: 12, repSd: 1.2, bias: [0, 1.5, -1], centre: 32, seed: 1 });
  const r = gaugeRR(d, 63)!;
  close(r.pctGRR, 12.9, 0.1); close(r.pctTol, 16.3, 0.1); assert.equal(r.ndc, 10);
  const text = d.map((o, i) => o.map((t) => `${'ABC'[i]}: ${t.join(' ')}`).join('\n')).join('\n');
  assert.deepEqual(parseStudy(text).data, d);
  assert.deepEqual(parseStudy(text).labels, ['A', 'B', 'C']);
});

test('limit gauges sit inside the work tolerance', () => {
  const h = limitGauges({ feature: 'hole', lsl: 0, usl: 63, gaugePct: 10, wearPct: 5 });
  close(h.go.lo, 3.15, 1e-9); close(h.go.hi, 9.45, 1e-9); close(h.nogo.lo, 56.7, 1e-9); close(h.nogo.hi, 63, 1e-9);
  close(h.usablePct, 75, 1e-9);
  const s = limitGauges({ feature: 'shaft', lsl: -140, usl: -100, gaugePct: 10, wearPct: 5 });
  close(s.go.hi, -102, 1e-9); close(s.go.lo, -106, 1e-9); close(s.nogo.lo, -140, 1e-9); close(s.nogo.hi, -136, 1e-9);
  close(s.sure.lo, -136, 1e-9); close(s.sure.hi, -106, 1e-9);
  const p = functionalPin(8.0, 0.2, 0.01);
  close(p.lo, 7.8, 1e-12); close(p.hi, 7.81, 1e-12);
});
