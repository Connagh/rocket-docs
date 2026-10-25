import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureOfSize, positionFromXY, floatingTolerance, fixedTotal, holeWithoutProjection, glandRange } from '../src/lib/gdt.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('bonus tolerance, virtual and resultant condition — the textbook hole and pin', () => {
  // hole ⌀10.0–10.4, position ⌀0.2 at MMC
  const h = featureOfSize('hole', 10.0, 10.4, 0.2, 'MMC', 10.3);
  close(h.bonus, 0.3, 1e-12); close(h.allowed, 0.5, 1e-12); close(h.virtual, 9.8, 1e-12); close(h.resultant, 11.0, 1e-12);
  close(featureOfSize('hole', 10.0, 10.4, 0.2, 'MMC', 10.0).allowed, 0.2, 1e-12, 'no bonus at MMC');
  close(featureOfSize('hole', 10.0, 10.4, 0.2, 'RFS', 10.3).allowed, 0.2, 1e-12, 'no bonus at RFS');
  // pin ⌀9.8–10.0, ⌀0.1 at MMC: virtual condition 10.1, resultant 9.8 − (0.1 + 0.2) = 9.5
  const p = featureOfSize('pin', 9.8, 10.0, 0.1, 'MMC', 9.9);
  close(p.bonus, 0.1, 1e-12); close(p.virtual, 10.1, 1e-12); close(p.resultant, 9.5, 1e-12);
  // LMC on a hole: bonus grows towards MMC, the boundary is at LMC + tolerance
  const l = featureOfSize('hole', 10.0, 10.4, 0.2, 'LMC', 10.1);
  close(l.bonus, 0.3, 1e-12); close(l.virtual, 10.6, 1e-12);
  assert.equal(featureOfSize('hole', 10.0, 10.4, 0.2, 'MMC', 10.5).inLimits, false);
});

test('worked example: a closure bolt hole', () => {
  const h = featureOfSize('hole', 11.0, 11.2, 0.5, 'MMC', 11.15);
  close(h.allowed, 0.65, 1e-12); close(h.virtual, 10.5, 1e-12);
  const pos = positionFromXY(0.18, 0.21);
  close(pos, 0.553, 0.001);
  assert.ok(pos <= h.allowed && pos > 0.5, 'conforms only because of the bonus');
  close(positionFromXY(3, 4), 10, 1e-12);
});

test('fastener formulas', () => {
  close(floatingTolerance(11, 10), 1, 1e-12);
  close(fixedTotal(11, 10), 1, 1e-12);
  // without a projected zone, the 24 mm closure flange over 15 mm of thread needs a 12.6 mm hole
  close(holeWithoutProjection(10, 0.5, 0.5, 24, 15), 12.6, 1e-12);
  close(holeWithoutProjection(10, 0.5, 0.5, 0, 15), 11, 1e-12, 'no projection: the fixed formula');
});

test('gland: reproduces the O-ring page, then adds the groove runout', () => {
  const base = { boreMin: 150.0, boreMax: 150.063, plugMin: 149.86, plugMax: 149.9, rootMin: 141.45, rootMax: 141.55, csMin: 5.2, csMax: 5.46 };
  const coaxial = glandRange({ ...base, runout: 0 });
  close(coaxial.gMin, 4.155, 1e-9); close(coaxial.gMax, 4.408, 0.001); close(coaxial.gNom, 4.266, 0.001);
  const spec = glandRange({ ...base, runout: 0.05 }), general = glandRange({ ...base, runout: 0.2 });
  close(spec.gMax, coaxial.gMax + 0.025, 1e-9); close(general.gMax, coaxial.gMax + 0.1, 1e-9);
  close(spec.squeezeMin, (5.2 - spec.gMax) / 5.2, 1e-12);
  close(spec.squeezeMin - general.squeezeMin, 0.075 / 5.2, 1e-9, '0.075 mm of gland is 1.4 points of squeeze');
});
