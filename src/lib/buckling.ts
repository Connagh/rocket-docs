// Buckling of an unstiffened, unpressurised, isotropic thin cylinder: axial compression, bending and external
// pressure. Classical solutions with the NASA SP-8007 empirical knockdowns (lower bounds to test data).
// Units: MPa, mm, N, N·mm.

/** Classical axial buckling coefficient 1/√(3(1−ν²)) — 0.605 for ν = 0.3. */
export const classicalCoeff = (nu: number) => 1 / Math.sqrt(3 * (1 - nu * nu));

/** Classical (perfect-shell) axial buckling stress E t / (r √(3(1−ν²))). */
export const sigmaClassical = (E: number, t: number, r: number, nu: number) => (E * t * classicalCoeff(nu)) / r;

/** SP-8007 parameter φ = √(r/t) / 16. */
export const phi = (r: number, t: number) => Math.sqrt(r / t) / 16;
/** SP-8007 knockdown, axial compression: γ = 1 − 0.901 (1 − e^−φ). */
export const kdAxial = (r: number, t: number) => 1 - 0.901 * (1 - Math.exp(-phi(r, t)));
/** SP-8007 knockdown, bending: γ = 1 − 0.731 (1 − e^−φ). */
export const kdBending = (r: number, t: number) => 1 - 0.731 * (1 - Math.exp(-phi(r, t)));

/**
 * Classical buckling pressure under lateral (external) pressure, ends held circular.
 * Moderate length (Batdorf, k_y = 1.04√Z): p = 1.04√Z π² E t³ / (12 (1−ν²) r L²), Z = L²√(1−ν²)/(r t).
 * Long tube (Bresse): p = E (t/r)³ / (4 (1−ν²)). The larger of the two applies.
 */
export function lateralPressure(E: number, t: number, r: number, L: number, nu: number) {
  const Z = ((L * L) / (r * t)) * Math.sqrt(1 - nu * nu);
  const pLong = (E / (4 * (1 - nu * nu))) * (t / r) ** 3;
  const pMod = (1.04 * Math.sqrt(Z) * Math.PI ** 2 * E * t ** 3) / (12 * (1 - nu * nu) * r * L * L);
  return { Z, pLong, pMod, p: Math.max(pLong, pMod), long: pLong >= pMod };
}

export interface BucklingInputs {
  E: number; nu: number; yieldStrength: number; // MPa
  r: number; t: number; L: number; // mean radius, wall, unsupported length — mm
  P: number; M: number; q: number; // axial compression N, bending N·mm, external pressure MPa
  endPressure: boolean; // pressure also acts on the end closures (a sealed case): adds q π r² of axial load
  gammaP: number; // knockdown on the classical lateral-pressure buckling pressure
  gammaA?: number; gammaB?: number; // overrides for the SP-8007 axial and bending knockdowns
}

export function bucklingCheck(i: BucklingInputs) {
  const sCl = sigmaClassical(i.E, i.t, i.r, i.nu);
  const gA = i.gammaA ?? kdAxial(i.r, i.t), gB = i.gammaB ?? kdBending(i.r, i.t);
  const area = 2 * Math.PI * i.r * i.t, Z = Math.PI * i.r * i.r * i.t; // wall area, section modulus
  // Column (Euler) buckling of the whole tube, pinned ends over L — rarely governs for L/r < 5.
  const sColumn = (Math.PI ** 2 * i.E * i.r * i.r) / (2 * i.L * i.L);
  const sA = Math.min(gA * sCl, i.yieldStrength, sColumn);
  const sB = Math.min(gB * sCl, i.yieldStrength);
  const lat = lateralPressure(i.E, i.t, i.r, i.L, i.nu);
  const pYield = (i.yieldStrength * i.t) / i.r; // hoop yield
  const pA = Math.min(i.gammaP * lat.p, pYield);
  const axialLoad = i.P + (i.endPressure ? i.q * Math.PI * i.r * i.r : 0);
  const Ra = axialLoad / area / sA, Rb = i.M / Z / sB, Rp = i.q / pA;
  const sum = Ra + Rb + Rp;
  return {
    rt: i.r / i.t, phi: phi(i.r, i.t), sClassical: sCl, gammaA: gA, gammaB: gB,
    axial: { stress: axialLoad / area, allow: sA, capacity: sA * area, load: axialLoad, R: Ra,
      governs: sA === sColumn ? 'column' : sA === i.yieldStrength ? 'yield' : 'shell' },
    bending: { stress: i.M / Z, allow: sB, capacity: sB * Z, R: Rb, governs: sB === i.yieldStrength ? 'yield' : 'shell' },
    pressure: { ...lat, allow: pA, R: Rp, governs: pA === pYield ? 'yield' : 'shell' },
    elasticToYield: (gA * sCl) / i.yieldStrength,
    sum, // linear interaction (SP-8007 for axial + bending and axial + lateral pressure)
    reserve: sum > 0 ? 1 / sum : Infinity, // the factor the loads could be multiplied by before buckling
  };
}
