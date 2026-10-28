import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METALS, ENVIRONMENTS, couple, checkJoint, mmPerYear, galvanicAttack } from '../src/lib/galvanic.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('the anodic index table is ordered and the keys are unique', () => {
  assert.equal(new Set(METALS.map((m) => m.key)).size, METALS.length);
  for (let i = 1; i < METALS.length; i++) assert.ok(METALS[i].index >= METALS[i - 1].index, METALS[i].name);
  assert.deepEqual(ENVIRONMENTS.map((e) => e.limit), [0.15, 0.25, 0.5]);
});

test('couples: the higher index is the anode', () => {
  const ss = couple('al', 'ss18')!;
  close(ss.dV, 0.4, 1e-9); assert.equal(ss.anode!.key, 'al'); assert.equal(ss.cathode!.key, 'ss18');
  close(couple('steel', 'cfrp')!.dV, 0.85, 1e-9);
  assert.equal(couple('ti', 'ti')!.anode, null);
  assert.equal(couple('al', 'unobtainium'), null);
});

test('worked example: the closure bolt stack', () => {
  const j = checkJoint(['ti', 'ss18', 'al', 'steel'], 0.25);
  assert.equal(j.ok, false);
  assert.deepEqual(j.pairs.map((p) => p.ok), [true, false, true]);
  assert.equal(j.worst!.a, 'ss18'); assert.equal(j.worst!.b, 'al');
  assert.equal(checkJoint(['cd', 'al', 'steel'], 0.15).ok, true);
});

test('Faraday: 1 µA/cm² is about 0.011 mm/year for aluminium and 0.012 for steel', () => {
  close(mmPerYear(1, 8.99, 2.7), 0.01089, 1e-5);
  close(mmPerYear(1, 27.92, 7.87), 0.0116, 1e-4);
});

test('worked example: area ratio decides the attack', () => {
  const skirt = galvanicAttack({ anode: 'steel', cathodeArea: 20, anodeArea: 2, ic: 10, wet: 0.1, years: 10 })!;
  close(skirt.rate, 0.116, 0.001); close(skirt.depth, 1.16, 0.01);
  const bolt = galvanicAttack({ anode: 'al', cathodeArea: 1, anodeArea: 100, ic: 10, wet: 0.1, years: 10 })!;
  close(bolt.depth, 0.0011, 0.0001);
  const rivet = galvanicAttack({ anode: 'al', cathodeArea: 100, anodeArea: 1, ic: 10, wet: 0.1, years: 10 })!;
  close(rivet.rate / bolt.rate, 1e4, 1e-6, 'reversing the areas changes the rate by the square of the ratio');
  assert.equal(galvanicAttack({ anode: 'al', cathodeArea: 1, anodeArea: 0, ic: 10, wet: 1, years: 1 }), null);
});
