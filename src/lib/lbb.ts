// Leak before break for a cylindrical case under hoop stress: a semi-elliptical surface flaw grows through the
// wall (Newman–Raju K, Paris law); at breakthrough it becomes an axial through crack, which must be stable
// (LEFM with Folias bulging, and plastic collapse on flow stress). Units: MPa, mm, MPa·√m, C in m/cycle.

/** Newman–Raju shape factor Q ≈ 1 + 1.464 (a/c)^1.65, for a/c ≤ 1. */
export const shapeQ = (ac: number) => 1 + 1.464 * Math.pow(ac, 1.65);

/** Newman–Raju boundary-correction factor for a surface crack in tension, a/c ≤ 1, wide plate. φ = π/2 deepest point, 0 surface. */
export function nrF(ac: number, at: number, phi: number) {
  const M1 = 1.13 - 0.09 * ac;
  const M2 = -0.54 + 0.89 / (0.2 + ac);
  const M3 = 0.5 - 1 / (0.65 + ac) + 14 * Math.pow(1 - ac, 24);
  const g = 1 + (0.1 + 0.35 * at * at) * Math.pow(1 - Math.sin(phi), 2);
  const fphi = Math.pow((ac * Math.cos(phi)) ** 2 + Math.sin(phi) ** 2, 0.25);
  return (M1 + M2 * at * at + M3 * at ** 4) * g * fphi;
}

/**
 * K at the deepest point (A) and where the crack meets the surface (C), for depth a and half-length c (mm).
 * a/c is capped at 1 and a/t at 0.8 (the fit's range); beyond that the values are extrapolations.
 */
export function surfaceK(sigma: number, a: number, c: number, t: number) {
  const ac = Math.min(1, a / c), at = Math.min(0.8, a / t);
  const base = sigma * Math.sqrt((Math.PI * a) / 1000 / shapeQ(ac));
  return { KA: base * nrF(ac, at, Math.PI / 2), KC: base * nrF(ac, at, 0) };
}

/** Folias bulging factor for an axial through crack of half-length c, modified-B31G form; z = (2c)² / (D t). */
export function folias(c: number, R: number, t: number) {
  const z = (2 * c) ** 2 / (2 * R * t);
  return z <= 50 ? Math.sqrt(1 + 0.6275 * z - 0.003375 * z * z) : 0.032 * z + 3.3;
}

/** Hoop stress that fails an axial through crack of half-length c: the lower of fracture and plastic collapse. */
export function throughFailStress(c: number, R: number, t: number, kic: number, flow: number) {
  const M = folias(c, R, t);
  const lefm = kic / (Math.sqrt((Math.PI * c) / 1000) * M);
  const collapse = flow / M;
  return { M, lefm, collapse, fail: Math.min(lefm, collapse), mode: lefm <= collapse ? 'fracture' : 'collapse' };
}

/** Longest stable through crack (half-length, mm) at hoop stress σ: bisect on the failure stress, which falls with c. */
export function throughCritical(sigma: number, R: number, t: number, kic: number, flow: number) {
  if (throughFailStress(1e-6, R, t, kic, flow).fail <= sigma) return { c: 0, mode: 'collapse' as string };
  let lo = 1e-6, hi = 1;
  while (throughFailStress(hi, R, t, kic, flow).fail > sigma && hi < 1e5) hi *= 2;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (throughFailStress(mid, R, t, kic, flow).fail > sigma) lo = mid; else hi = mid;
  }
  return { c: lo, mode: throughFailStress(lo, R, t, kic, flow).mode };
}

/** Plastic collapse of the ligament under a part-through axial flaw (NG-18 form, rectangular flaw profile). */
export function partThroughFailStress(a: number, c: number, R: number, t: number, flow: number) {
  const M = folias(c, R, t), at = Math.min(a / t, 0.999);
  return (flow * (1 - at)) / (1 - at / M);
}

/** Irwin's simple screen: a through crack of half-length c = t must be stable (flat plate, LEFM). */
export const irwinCritical = (sigma: number, kic: number) => (1 / Math.PI) * (kic / sigma) ** 2 * 1000;

/** Depth (mm) at which a surface flaw of fixed aspect ratio a/c reaches K_IC at its deepest point — capped at the wall. */
export function surfaceCriticalDepth(sigma: number, ac: number, t: number, kic: number) {
  const K = (a: number) => surfaceK(sigma, a, a / ac, t).KA;
  if (K(t) < kic) return t;
  let lo = 1e-6, hi = t;
  for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (K(mid) < kic) lo = mid; else hi = mid; }
  return lo;
}

export interface LbbInputs {
  sigma: number; // hoop stress at MEOP, MPa
  rangeFraction: number; // stress range per cycle ÷ σ
  a0: number; ac0: number; // initial surface flaw depth (mm) and aspect ratio a/c
  t: number; R: number; // wall and mean radius, mm
  kic: number; flow: number; // MPa·√m, MPa
  C: number; m: number; // Paris constants
}

/** leak: through crack stable at breakthrough; burst: unstable at breakthrough; runs: the crack runs along the surface first. */
export type Outcome = 'leak' | 'burst' | 'runs';

/**
 * Grow the flaw by the Paris law at its deepest and surface points until the ligament ahead of it goes — by
 * growing to the back face, by reaching K_IC at the deepest point, or by plastic collapse. Any of those is
 * breakthrough: the flaw becomes a through crack of about its surface length, which either holds (leak) or runs
 * (burst). If the surface points reach K_IC first, the crack runs along the wall while still buried.
 * The crack's path in (a, c) depends only on how K varies round the front, so it is the same for any stress range;
 * only the cycle count scales with Δσ^−m.
 */
export function growToBreakthrough(i: LbbInputs) {
  let a = i.a0, c = i.a0 / i.ac0, N = 0;
  const path: { a: number; c: number; N: number }[] = [{ a, c, N }];
  const steps = 600, da = (i.t - i.a0) / steps, dS = i.sigma * i.rangeFraction;
  let outcome: Outcome = 'leak', ligament: 'growth' | 'fracture' | 'collapse' = 'growth';
  for (let k = 0; k < steps; k++) {
    const K = surfaceK(i.sigma, a, c, i.t);
    if (K.KC >= i.kic) { outcome = 'runs'; break; }
    if (K.KA >= i.kic) { ligament = 'fracture'; break; }
    if (i.sigma >= partThroughFailStress(a, c, i.R, i.t, i.flow)) { ligament = 'collapse'; break; }
    const ratio = K.KC / K.KA; // ΔK_C / ΔK_A, independent of the stress range
    const dN = dS > 0 ? da / 1000 / (i.C * Math.pow((K.KA * dS) / i.sigma, i.m)) : Infinity;
    a += da;
    c += da * Math.pow(ratio, i.m);
    N += dN;
    if (k % 20 === 19 || k === steps - 1) path.push({ a, c, N });
  }
  const last = path[path.length - 1];
  if (last.a !== a || last.c !== c) path.push({ a, c, N });
  const crit = throughCritical(i.sigma, i.R, i.t, i.kic, i.flow);
  if (outcome === 'leak' && c >= crit.c) outcome = 'burst';
  return {
    outcome, ligament, path, a, c, N, // a, c when the ligament goes (or when the crack runs)
    cCrit: crit.c, critMode: crit.mode,
    aCritInitialShape: surfaceCriticalDepth(i.sigma, i.ac0, i.t, i.kic),
    irwin: irwinCritical(i.sigma, i.kic),
    foliasAtCrit: folias(crit.c, i.R, i.t),
  };
}
