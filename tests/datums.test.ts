import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boltCircle, minimize, patternCheck, datumShift, gaugeSizes, type Hole } from '../src/lib/datums.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// the worked example's 30 closure holes, as a CMM reports them: deviation from true position and actual size
const ROWS = `0.048 -0.008 11.07|0.131 -0.009 11.08|0.032 0.043 11.04|0.074 -0.001 11.02|-0.126 0.109 11.05|-0.054 -0.114 11.06|0.025 0.033 11.04|0.261 0.042 11.02|0.047 -0.081 11.06|0.262 0.017 11.01|0.201 0.116 11.02|-0.048 -0.028 11.03|0.141 -0.119 11.02|0.108 -0.089 11.03|0.079 0.166 11.04|0.125 0.134 11.04|-0.065 0.071 11.01|0.125 -0.090 11.08|-0.103 -0.176 11.02|-0.023 -0.047 11.09|0.216 -0.052 11.05|0.118 0.077 11.07|-0.153 0.096 11.08|0.160 0.150 11.03|-0.075 -0.060 11.04|-0.056 0.089 11.07|0.143 -0.218 11.02|-0.124 0.112 11.04|0.006 -0.219 11.05|0.126 -0.091 11.02`;
const HOLES: Hole[] = ROWS.split('|').map((r) => { const [dx, dy, size] = r.split(' ').map(Number); return { dx, dy, size }; });

test('bolt circle and the minimiser', () => {
  const c = boltCircle(4, 10);
  close(c[1].x, 0, 1e-12); close(c[1].y, 10, 1e-12);
  const m = minimize((x) => (x[0] - 1) ** 2 + 3 * (x[1] + 2) ** 2, [0, 0], [1, 1]);
  close(m.x[0], 1, 1e-4); close(m.x[1], -2, 1e-4);
});

test('a pattern shifted as a whole passes once the shift is allowed; a minimum enclosing circle is found', () => {
  const shifted = [0, 1, 2, 3].map(() => ({ dx: 0.03, dy: -0.04, size: 10 }));
  const r = patternCheck({ holes: shifted, mmc: 10, tol: 0.05, bonus: false, shift: 0.2 });
  close(r.worstFixed, 2 * 0.05 / 0.05, 1e-12);
  close(r.shifted.worst, 0, 1e-3); close(r.shifted.s[0], 0.03, 1e-3); close(r.shifted.s[1], -0.04, 1e-3);
  // a shift limited to 0.02 radius gets as close as it can
  const lim = patternCheck({ holes: shifted, mmc: 10, tol: 0.05, bonus: false, shift: 0.04 });
  close(Math.hypot(...lim.shifted.s), 0.02, 1e-4); close(lim.shifted.worst, (2 * 0.03) / 0.05, 1e-3);
  // three deviations whose smallest enclosing circle is centred at the origin with radius 0.2
  const tri = [{ dx: 0.2, dy: 0, size: 10 }, { dx: -0.2, dy: 0, size: 10 }, { dx: 0, dy: 0.2, size: 10 }];
  const t = patternCheck({ holes: tri, mmc: 10, tol: 0.4, bonus: false, shift: 1 });
  close(t.shifted.worst, 1, 2e-3); close(t.shifted.s[0], 0, 2e-3); close(t.shifted.s[1], 0, 2e-3);
});

test('worked example: the CMM rejects three holes in a fixed frame; the datum shift at MMB accepts the part', () => {
  const shift = datumShift(255.9, 0.02, 255.83);
  close(shift, 0.09, 1e-9);
  const r = patternCheck({ holes: HOLES, mmc: 11.0, tol: 0.5, bonus: true, shift });
  assert.equal(r.failsFixed, 3);
  close(r.worstFixed, 1.030, 0.001);
  assert.ok(r.shifted.worst < 0.88, `worst with shift ${r.shifted.worst}`);
  assert.ok(Math.hypot(...r.shifted.s) <= 0.045 + 1e-9, 'within the shift the pilot allows');
  // without the bonus as well, the same three holes fail by more
  close(patternCheck({ holes: HOLES, mmc: 11.0, tol: 0.5, bonus: false, shift: 0 }).worstFixed, 1.057, 0.001);
});

test('composite lower segment: a rotated pattern with tight hole spacing passes when free to rotate', () => {
  const R = 100, n = 8, th = 0.002;
  const holes = boltCircle(n, R).map((p, i) => ({ dx: 0.3 - R * th * Math.sin(p.a) + (i % 2 ? 0.01 : -0.01), dy: -0.2 + R * th * Math.cos(p.a), size: 10 }));
  const r = patternCheck({ holes, mmc: 10, tol: 0.5, bonus: false, shift: 0, lowerTol: 0.05, R, n });
  assert.ok(r.worstFixed > 1, 'fails to the datums');
  assert.ok(r.lower!.worst < 0.5, `holes keep their spacing: ${r.lower!.worst}`);
  close(r.lower!.theta, th, 2e-4);
});

test('functional gauge sizes', () => {
  const g = gaugeSizes({ mmc: 11.0, lmc: 11.2, tol: 0.5 }, { mmc: 255.9, lmc: 255.8, tol: 0.02 }, 0.05);
  close(g.pin, 10.5, 1e-12); close(g.pinMax, 10.535, 1e-12); close(g.ring, 255.92, 1e-9); close(g.ringMin, 255.914, 1e-9);
});
