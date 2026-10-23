import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFactor, awaitingMessage } from '../src/lib/factors.ts';

test('blank, invalid or sub-minimum factors read as missing', () => {
  assert.equal(readFactor(''), null);
  assert.equal(readFactor('   '), null);
  assert.equal(readFactor('abc'), null);
  assert.equal(readFactor('0.9'), null); // a safety factor below 1 is not a factor
  assert.equal(readFactor('1.25'), 1.25);
  assert.equal(readFactor('0.9', 0), 0.9);
});

test('the awaiting message names every missing factor and never suggests a value', () => {
  const m = awaitingMessage(['proof factor', 'burst factor']);
  assert.match(m, /proof factor and burst factor/);
  assert.doesNotMatch(m, /\d/);
});
