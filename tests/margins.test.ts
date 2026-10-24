import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marginOfSafety, reserveFactor, interaction, vonMises, evaluateRow, basisMismatch, reportTsv, type MarginRow } from '../src/lib/margins.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('margin and reserve factor', () => {
  close(marginOfSafety(1305, 1094, 1.1), 1305 / (1.1 * 1094) - 1, 1e-12);
  close(reserveFactor(1305, 1094, 1.1) - 1, marginOfSafety(1305, 1094, 1.1), 1e-12);
});

test('worked example: the case wall at MEOP reproduces the case-sizing margins', () => {
  // D6AC, weld efficiency 0.9: yield 1305, ultimate 1368; hoop 1094 MPa at MEOP; example factors 1.10 / 1.25
  close(marginOfSafety(1305, 1094, 1.1), 0.084, 0.001);
  close(marginOfSafety(1368, 1094, 1.25), 0.0, 0.001);
  // the two classic mix-ups
  close(marginOfSafety(1305, 1094, 1.25), -0.046, 0.001); // yield allowable, ultimate factor: false failure
  close(marginOfSafety(1368, 1094, 1.1), 0.137, 0.001); // ultimate allowable, yield factor: false comfort
});

test('interaction: linear and elliptical closed forms, and any exponents', () => {
  close(interaction([0.3, 0.2], [1, 1]).lambda, 1 / 0.5, 1e-9);
  close(interaction([0.3, 0.4], [2, 2]).lambda, 1 / 0.5, 1e-9);
  const r = interaction([0.431, 0.144], [2, 3]);
  close(Math.pow(r.lambda * 0.431, 2) + Math.pow(r.lambda * 0.144, 3), 1, 1e-9);
  assert.equal(interaction([0, 0], [1, 1]).lambda, Infinity);
});

test('worked example: bolt tension and shear, elliptical interaction', () => {
  const k = 1.25 * 1.15; // example ultimate factor × example fitting factor
  const r = interaction([(k * 18) / 60, (k * 4) / 40], [2, 2]);
  close(r.lambda, 1 / Math.hypot((k * 18) / 60, (k * 4) / 40), 1e-9);
  close(r.ms, 1.2, 0.01);
});

test('von Mises', () => close(vonMises(100, 50), Math.sqrt(10000 + 7500), 1e-12));

const row = (o: Partial<MarginRow>): MarginRow => ({ item: 'x', loadCase: 'LC1', failure: 'f', mode: 'ultimate', applied: 100, allowable: 200, allowableBasis: 'A-basis ultimate', extra: null, ref: '', ...o });

test('rows: blank factor gives no margin; extra factors multiply', () => {
  assert.equal(evaluateRow(row({}), { yield: null, ultimate: null, other: null }).factor, null);
  const e = evaluateRow(row({ extra: 1.15 }), { yield: null, ultimate: 1.4, other: null });
  close(e.factor!, 1.61, 1e-12);
  close(e.ms, 200 / (1.61 * 100) - 1, 1e-12);
});

test('mixed pairs and typical values are flagged', () => {
  assert.match(basisMismatch(row({ mode: 'ultimate', allowableBasis: 'A-basis yield, 20 °C' }))!, /yield allowable/);
  assert.match(basisMismatch(row({ mode: 'yield', allowableBasis: 'B-basis ultimate' }))!, /ultimate allowable/);
  assert.match(basisMismatch(row({ allowableBasis: 'typical UTS' }))!, /typical/);
  assert.equal(basisMismatch(row({ mode: 'yield', allowableBasis: 'A-basis yield, 100 °C' })), null);
});

test('report text has a header and one line per row', () => {
  const rows = [row({}), row({ mode: 'yield', allowableBasis: 'A-basis yield' })];
  const tsv = reportTsv(rows, rows.map((r) => evaluateRow(r, { yield: 1.1, ultimate: 1.25, other: null })));
  assert.equal(tsv.split('\n').length, 3);
  assert.match(tsv.split('\n')[0], /^Item\tLoad case\tFailure mode/);
  const comb = reportTsv([row({ applied: NaN, allowable: NaN })], [{ factor: 1.4, ms: 0.2, rf: 1.2, mismatch: null }]);
  assert.doesNotMatch(comb, /NaN/);
});
