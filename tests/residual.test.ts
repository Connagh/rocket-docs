import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relax, fatigueWithResidual, flawK, depthForK, fractureWithResidual, lame, overstrainPressure, autofrettage, serviceStress } from '../src/lib/residual.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('relaxation: the total stress can never pass yield', () => {
  assert.equal(relax(300, 500, 0, 1000), 300, 'no yield, no change');
  assert.equal(relax(300, 900, 0, 1000), 100, 'tension relaxes to Fty − σmax');
  assert.equal(relax(-400, 0, -800, 1000), -200, 'compression relaxes to −Fty − σmin');
  assert.equal(relax(0, 1100, 0, 1000), -100, 'an overload leaves compression behind');
});

test('worked example: the actuator bracket from the fatigue page, peened and abusively ground', () => {
  const mat = { Fty: 1180, uts: 1280, se: 310, nE: 1e6, limit: true };
  const run = (sr: number) => {
    const h = fatigueWithResidual({ sa: 444, sm: 444, sr, ...mat }), f = fatigueWithResidual({ sa: 320, sm: 107, sr, ...mat });
    return { h, f, lives: 1 / (2000 / h.N + 20000 / f.N) };
  };
  const base = run(0), peened = run(-400), ground = run(300);
  close(base.h.N, 16048, 1); close(base.f.N, 534487, 1); close(base.lives, 6.17, 0.01, 'matches the fatigue page');
  close(peened.h.sar, 459.8, 0.1); close(peened.lives, 25.28, 0.01);
  close(ground.h.srEff, 292, 1e-9, 'relaxes on the first handling cycle');
  close(ground.lives, 0.73, 0.01);
  // compressive mean stress gets no credit beyond cancelling tension
  close(peened.f.sar, 320, 1e-9);
});

test('fracture: residual tension shrinks the critical flaw; a proof test relaxes it', () => {
  close(flawK(1094, 0.5, 1.12), 1.12 * 1094 * Math.sqrt(Math.PI * 0.0005), 1e-9);
  close(depthForK(flawK(500, 0.8, 1.12), 500, 1.12), 0.8, 1e-9, 'inverse of flawK');
  const base = { sigma: 1094, Fty: 1450, KIC: 70, a: 0.5, Y: 1.12 };
  const none = fractureWithResidual({ ...base, sr: 0 });
  close(none.aCrit, 1.039, 0.001);
  const r = fractureWithResidual({ ...base, sr: 290 });
  close(r.aCrit, 0.649, 0.001); close(r.Kres, 12.87, 0.01);
  const p = fractureWithResidual({ ...base, sr: 290, proof: 1204 });
  close(p.srEff, 246, 1e-9); close(p.aCrit, 0.692, 0.001); close(p.Kres, 10.92, 0.01);
  close(fractureWithResidual({ ...base, sr: 290, KISCC: 15 }).aScc, depthForK(15, 290, 1.12), 1e-12);
});

test('autofrettage: Hill pressures, equilibrium of the residual stresses, and the worked-example tube', () => {
  const a = 5, b = 12.5, Fty = 1000;
  close(overstrainPressure(a, b, Fty, a), (Fty * (b * b - a * a)) / (2 * b * b), 1e-9, 'first yield');
  close(overstrainPressure(a, b, Fty, b), Fty * Math.log(b / a), 1e-9, 'full overstrain');
  assert.equal(autofrettage(a, b, Fty, 300).residual(a).st, 0, 'below first yield nothing is left');
  const af = autofrettage(a, b, Fty, 650);
  close(af.c, 6.709, 0.001); close(af.boreHoop, -547.6, 0.1); assert.equal(af.reverse, false);
  close(af.residual(a).sr, 0, 1e-9); close(af.residual(b).sr, 0, 1e-9);
  // continuous at the elastic–plastic radius
  close(af.residual(af.c - 1e-7).st, af.residual(af.c + 1e-7).st, 1e-3);
  // no net hoop force across the wall: ∫σθ dr = [r σr] = 0
  const n = 4000, h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += af.residual(a + (i + 0.5) * h).st * h;
  close(sum, 0, 0.05);
  // in service at 300 MPa the bore stays in compression, and the peak Tresca stress falls from 714 MPa
  close(serviceStress(af, a, b, 300, a).st, -133.3, 0.1);
  const plain = lame(300, a, b, a);
  close(plain.st - plain.sr, 714.3, 0.1);
  // the peak moves out to the elastic–plastic radius
  const rs = Array.from({ length: 1001 }, (_, i) => a + ((b - a) * i) / 1000).concat(af.c);
  const tresca = (r: number) => { const s = serviceStress(af, a, b, 300, r); return s.st - s.sr; };
  close(Math.max(...rs.map(tresca)), 537.2, 0.1);
  close(tresca(af.c), 537.2, 0.1);
  // too much overstrain on a thick wall yields the bore in reverse on unloading
  assert.equal(autofrettage(5, 20, 1000, 1e9).reverse, true);
});
