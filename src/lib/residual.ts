// Residual stress: how a locked-in stress relaxes when service loading yields it, adds to the mean stress in fatigue
// and to the crack driving force in fracture and stress-corrosion cracking, and the residual stresses autofrettage
// leaves in a thick cylinder. Elastic–perfectly plastic, uniaxial unless stated. Units: MPa, mm, MPa√m.
import { snCurve, equivalentReversed } from './fatigue.ts';

/**
 * Residual stress left after the service stress has reached smax and smin once, for an elastic–perfectly plastic
 * material: the total can never exceed ±Fty, so whatever would has yielded away.
 */
export function relax(sr: number, smax: number, smin: number, Fty: number) {
  const afterMax = Math.min(sr, Fty - smax);
  return Math.max(afterMax, -Fty - smin);
}

export interface FatigueInput {
  sa: number; sm: number; // local alternating and mean service stress at the surface
  sr: number; // residual stress at the same point, tension positive
  Fty: number; uts: number; se: number; nE: number; limit: boolean; // the S-N line, as on the fatigue page
}

/**
 * Life with and without a surface residual stress. The residual relaxes on the first cycle if the total yields, then acts
 * as a mean stress (Goodman; compressive mean gets no credit, as on the fatigue page).
 */
export function fatigueWithResidual(i: FatigueInput) {
  const curve = snCurve(i.uts, i.se, i.nE, i.limit);
  const srEff = relax(i.sr, i.sm + i.sa, i.sm - i.sa, i.Fty);
  const smEff = i.sm + srEff;
  const sar = equivalentReversed(i.sa, smEff, i.uts, i.Fty, 'goodman'), sar0 = equivalentReversed(i.sa, i.sm, i.uts, i.Fty, 'goodman');
  const N = curve.N(sar), N0 = curve.N(sar0);
  return { srEff, smEff, sar, sar0, N, N0, ratio: N / N0, curve };
}

/** Stress intensity of a flaw of depth a (mm) under stress sigma (MPa), Y·σ·√(πa), in MPa√m. */
export const flawK = (sigma: number, a: number, Y: number) => Y * sigma * Math.sqrt((Math.PI * a) / 1000);

/** Depth (mm) at which a flaw reaches K under stress sigma. */
export const depthForK = (K: number, sigma: number, Y: number) => (sigma > 0 ? (1000 / Math.PI) * (K / (Y * sigma)) ** 2 : Infinity);

export interface FractureInput {
  sigma: number; // service stress opening the flaw
  sr: number; // residual stress across the flaw, tension positive
  Fty: number;
  proof?: number; // the highest stress applied before service — a proof test — which relaxes tensile residual stress
  KIC: number; a: number; Y: number;
  KISCC?: number; // threshold for stress-corrosion cracking in the service environment
}

/** Critical flaw depth with and without the residual stress, and the stress intensity the residual stress sustains alone. */
export function fractureWithResidual(i: FractureInput) {
  const srEff = relax(i.sr, Math.max(i.sigma, i.proof ?? 0), 0, i.Fty);
  const total = i.sigma + srEff;
  return {
    srEff, total,
    K: flawK(total, i.a, i.Y), K0: flawK(i.sigma, i.a, i.Y), Kres: flawK(srEff, i.a, i.Y),
    aCrit: depthForK(i.KIC, total, i.Y), aCrit0: depthForK(i.KIC, i.sigma, i.Y),
    // the deepest flaw that does not grow by stress corrosion in storage, under the residual stress alone
    aScc: i.KISCC !== undefined && i.KISCC > 0 ? depthForK(i.KISCC, srEff, i.Y) : NaN,
  };
}

// ---------- Autofrettage of a thick cylinder (Tresca, elastic–perfectly plastic, no Bauschinger effect) ----------

/** Lamé stresses at radius r in a cylinder of bore radius a and outside radius b under internal pressure p. */
export function lame(p: number, a: number, b: number, r: number) {
  const k = (p * a * a) / (b * b - a * a);
  return { sr: k * (1 - (b * b) / (r * r)), st: k * (1 + (b * b) / (r * r)) };
}

/** Pressure that yields the wall from the bore out to radius c (Hill): Fty·[ln(c/a) + (b² − c²)/2b²]. */
export const overstrainPressure = (a: number, b: number, Fty: number, c: number) =>
  Fty * (Math.log(c / a) + (b * b - c * c) / (2 * b * b));

/**
 * A thick cylinder autofrettaged at pressure pA and unloaded elastically. Returns the elastic–plastic radius, the
 * pressures for first yield and full overstrain, the residual stresses through the wall, and whether unloading would
 * yield the bore in reverse — which a real steel, with its Bauschinger effect, does sooner.
 */
export function autofrettage(a: number, b: number, Fty: number, pA: number) {
  const pFirst = overstrainPressure(a, b, Fty, a), pFull = overstrainPressure(a, b, Fty, b);
  const p = Math.min(Math.max(pA, 0), pFull);
  let c = a;
  if (p > pFirst) {
    let lo = a, hi = b;
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (overstrainPressure(a, b, Fty, m) < p) lo = m; else hi = m; }
    c = (lo + hi) / 2;
  }
  // stresses at the autofrettage pressure: plastic inside c (σθ − σr = Fty), elastic outside
  const loaded = (r: number) => {
    if (p <= pFirst) return lame(p, a, b, r);
    if (r < c) {
      const sr = -Fty * (Math.log(c / r) + (b * b - c * c) / (2 * b * b));
      return { sr, st: sr + Fty };
    }
    const k = (Fty * c * c) / (2 * b * b);
    return { sr: k * (1 - (b * b) / (r * r)), st: k * (1 + (b * b) / (r * r)) };
  };
  const residual = (r: number) => { const L = loaded(r), E = lame(p, a, b, r); return { sr: L.sr - E.sr, st: L.st - E.st }; };
  const bore = residual(a).st;
  return { c, pFirst, pFull, pA: p, overstrain: (c - a) / (b - a), residual, boreHoop: bore, reverse: bore < -Fty };
}

/** Service stresses at pressure p in an autofrettaged cylinder (elastic, so long as p stays below the autofrettage pressure). */
export function serviceStress(af: ReturnType<typeof autofrettage>, a: number, b: number, p: number, r: number) {
  const R = af.residual(r), L = lame(p, a, b, r);
  return { sr: R.sr + L.sr, st: R.st + L.st };
}
