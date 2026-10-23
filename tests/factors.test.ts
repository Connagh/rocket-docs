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

test('the awaiting message mentions the example button only when there is one', () => {
  assert.match(awaitingMessage(['proof factor']), /Load worked example/);
  assert.doesNotMatch(awaitingMessage(['buckling factor of safety'], 'the margin', false), /Load worked example/);
});
