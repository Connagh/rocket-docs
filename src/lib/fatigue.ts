// High-cycle fatigue screening (stress-life): Marin-corrected endurance, Basquin S-N curve, notch sensitivity,
// mean-stress correction and Miner's rule. Textbook estimating methods (Shigley; Norton; Peterson) — not test data.
// Units: MPa, mm, cycles.

export const SURFACES = [
  { key: 'ground', name: 'Ground / polished', a: 1.58, b: -0.085 },
  { key: 'machined', name: 'Machined / cold drawn', a: 4.51, b: -0.265 },
  { key: 'hotrolled', name: 'Hot rolled', a: 57.7, b: -0.718 },
  { key: 'forged', name: 'As forged / as cast', a: 272, b: -0.995 },
] as const;

export const LOADS = [
  { key: 'bending', name: 'Bending', kc: 1 },
  { key: 'axial', name: 'Axial', kc: 0.85 },
] as const;

export const RELIABILITY = [
  { key: '50', name: '50% (median)', ke: 1 },
  { key: '90', name: '90%', ke: 0.897 },
  { key: '95', name: '95%', ke: 0.868 },
  { key: '99', name: '99%', ke: 0.814 },
  { key: '99.9', name: '99.9%', ke: 0.753 },
  { key: '99.99', name: '99.99%', ke: 0.702 },
] as const;

/**
 * Unnotched, polished, rotating-bending fatigue strength estimate S'e from UTS, by family.
 * Steels: 0.5·Sut, capped at 700 MPa above 1400 MPa (true endurance limit at ~10⁶ cycles).
 * Aluminium: 0.4·Sut, capped at 130 MPa, at 5×10⁸ cycles — no true endurance limit.
 * Others: family-level ratios, rough estimates.
 */
export function baseFatigueStrength(family: string, uts: number) {
  switch (family) {
    case 'steel': case 'ss': return { se: uts <= 1400 ? 0.5 * uts : 700, nE: 1e6, limit: true };
    case 'al': return { se: uts < 330 ? 0.4 * uts : 130, nE: 5e8, limit: false };
    case 'ti': return { se: 0.5 * uts, nE: 1e7, limit: true };
    case 'ni': return { se: 0.4 * uts, nE: 1e8, limit: false };
    case 'mg': case 'cu': return { se: 0.35 * uts, nE: 1e8, limit: false };
    default: return { se: 0.4 * uts, nE: 1e7, limit: false };
  }
}

/** Surface factor ka = a·Sut^b (Shigley), at most 1. */
export const surfaceFactor = (uts: number, surface: string) => {
  const s = SURFACES.find((x) => x.key === surface) ?? SURFACES[1];
  return Math.min(1, s.a * Math.pow(uts, s.b));
};

/** Size factor kb for bending (Shigley); axial loading has no stress gradient and no size effect here. */
export function sizeFactor(dMm: number, load: string) {
  if (load === 'axial') return 1;
  const d = Math.max(dMm, 2.79);
  if (d <= 51) return 1.24 * Math.pow(d, -0.107);
  return 1.51 * Math.pow(Math.min(d, 254), -0.157);
}

export interface MarinInputs { uts: number; sePrime: number; surface: string; load: string; dMm: number; kd: number; reliability: string }
export function marin(i: MarinInputs) {
  const ka = surfaceFactor(i.uts, i.surface);
  const kb = sizeFactor(i.dMm, i.load);
  const kc = (LOADS.find((x) => x.key === i.load) ?? LOADS[0]).kc;
  const ke = (RELIABILITY.find((x) => x.key === i.reliability) ?? RELIABILITY[0]).ke;
  return { ka, kb, kc, kd: i.kd, ke, se: i.sePrime * ka * kb * kc * i.kd * ke };
}

/** Peterson's notch sensitivity q = 1/(1 + a/r); a (mm) from Sut for steels, ~0.64 mm for aluminium alloys. */
export function notchSensitivity(rMm: number, uts: number, family: string) {
  const a = family === 'al' ? 0.635 : 0.0254 * Math.pow(2070 / uts, 1.8);
  return { a, q: rMm > 0 ? 1 / (1 + a / rMm) : 1 };
}
export const fatigueNotchFactor = (kt: number, q: number) => 1 + q * (kt - 1);

/**
 * Basquin S-N line through (10³, 0.9·Sut) and (N_e, S_e). Below S_e, a material with an endurance limit lasts
 * indefinitely; one without keeps following the line.
 */
export function snCurve(uts: number, se: number, nE: number, limit: boolean) {
  const s3 = 0.9 * uts;
  const b = Math.log10(se / s3) / Math.log10(nE / 1e3); // negative slope in log-log
  return {
    s3, b,
    S: (n: number) => (limit && n >= nE ? se : s3 * Math.pow(n / 1e3, b)),
    N: (s: number) => (s <= 0 ? Infinity : limit && s <= se ? Infinity : 1e3 * Math.pow(s / s3, 1 / b)),
  };
}

export type Criterion = 'goodman' | 'gerber' | 'soderberg' | 'swt';

/** Equivalent fully reversed stress amplitude. Compressive mean stress gets no credit (conservative), except in SWT. */
export function equivalentReversed(sa: number, sm: number, uts: number, sy: number, c: Criterion) {
  if (c === 'swt') { const smax = sa + sm; return smax > 0 ? Math.sqrt(smax * sa) : 0; }
  if (sm <= 0) return sa;
  if (c === 'goodman') return sm >= uts ? Infinity : sa / (1 - sm / uts);
  if (c === 'gerber') return sm >= uts ? Infinity : sa / (1 - (sm / uts) ** 2);
  return sm >= sy ? Infinity : sa / (1 - sm / sy); // Soderberg
}

export interface Block { sa: number; sm: number; n: number } // nominal amplitude and mean (MPa), cycles

/** Miner's rule over a load spectrum, with the notch factor applied to both amplitude and mean. */
export function miner(blocks: Block[], kf: number, uts: number, sy: number, c: Criterion, curve: ReturnType<typeof snCurve>) {
  const rows = blocks.map((b) => {
    const la = kf * b.sa, lm = kf * b.sm;
    const sar = equivalentReversed(la, lm, uts, sy, c);
    const N = curve.N(sar);
    return { ...b, la, lm, sar, N, d: Number.isFinite(N) ? b.n / N : 0, yields: la + Math.abs(lm) > sy, static: la + Math.max(lm, 0) >= uts };
  });
  const D = rows.reduce((s, r) => s + r.d, 0);
  return { rows, D, lives: D > 0 ? 1 / D : Infinity };
}

/**
 * Strain-life (Coffin–Manson–Basquin): strain amplitude at 2N reversals, the sum of an elastic part
 * (σ'f/E)(2N)^b and a plastic part ε'f(2N)^c.
 */
export const strainAmplitude = (twoN: number, sfOverE: number, b: number, ef: number, c: number) =>
  sfOverE * Math.pow(twoN, b) + ef * Math.pow(twoN, c);

/** Transition life 2N_t, where the elastic and plastic strains are equal: shorter lives are plasticity-driven. */
export const transitionReversals = (sfOverE: number, b: number, ef: number, c: number) => Math.pow(ef / sfOverE, 1 / (b - c));

/** Neuber's rule at a notch: local σ·ε equals that of the elastic notch stress, (K_t·S)²/E. */
export const neuberProduct = (kt: number, s: number, e: number) => (kt * s) ** 2 / e;
