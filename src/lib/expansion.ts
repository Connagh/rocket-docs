// Differential expansion: fits that change with temperature (Lamé thick cylinders), a thin layer bonded to a
// substrate, the adhesive shear at the ends of a bonded overlap (shear lag), and relative slip across a bolt pattern.
// Uniform temperature, linear elastic. Units: mm, MPa, °C (temperature changes), N.
import { withProps } from './materials.ts';

/**
 * The materials of the library (src/lib/materials.ts) that have a modulus, Poisson's ratio and expansion: room
 * temperature, typical values. Yield is typical, not an allowable.
 */
export const EXP_MATERIALS = withProps(['E', 'nu', 'alpha']).map((m) => ({ key: m.key, name: m.name, family: m.family, E: m.E!, nu: m.nu!, alpha: m.alpha!, Fy: m.Fty ?? NaN }));
export { DEFAULTS as EXP_DEFAULTS } from './materials.ts';

/** Change of diametral fit with temperature: positive grows the interference (inner part expanding more). */
export const fitChange = (d: number, alphaInner: number, alphaOuter: number, dT: number) => d * (alphaInner - alphaOuter) * dT;

export interface FitParts {
  d: number;   // interface diameter
  D: number;   // outer diameter of the outer part
  di: number;  // bore of the inner part (0 for solid)
  Eo: number; nuo: number; Ei: number; nui: number;
}

/** Contact pressure for a diametral interference δ (Lamé). Zero or negative δ gives no pressure. */
export function fitPressure(delta: number, f: FitParts) {
  if (delta <= 0) return 0;
  const outer = (f.d / f.Eo) * ((f.D ** 2 + f.d ** 2) / (f.D ** 2 - f.d ** 2) + f.nuo);
  const inner = (f.d / f.Ei) * ((f.d ** 2 + f.di ** 2) / (f.d ** 2 - f.di ** 2) - f.nui);
  return delta / (outer + inner);
}

/** Stresses at the interface: hoop in the outer part (tension), hoop in the inner part (compression), and the outer part's von Mises. */
export function fitStresses(p: number, f: FitParts) {
  const hoopOuter = (p * (f.D ** 2 + f.d ** 2)) / (f.D ** 2 - f.d ** 2);
  const hoopInner = (-p * (f.d ** 2 + f.di ** 2)) / (f.d ** 2 - f.di ** 2);
  return { hoopOuter, hoopInner, vmOuter: Math.sqrt(hoopOuter ** 2 + hoopOuter * p + p ** 2) };
}

/** Axial holding force and torque of an interference fit over length L with friction μ. */
export const fitHolding = (p: number, d: number, L: number, mu: number) => ({ force: mu * p * Math.PI * d * L, torque: (mu * p * Math.PI * d * L * d) / 2 });

/** A thin layer fully bonded to a thick substrate: equi-biaxial stress E/(1 − ν)·(α_sub − α_layer)·ΔT. */
export const thinLayerStress = (E: number, nu: number, alphaSub: number, alphaLayer: number, dT: number) =>
  (E / (1 - nu)) * (alphaSub - alphaLayer) * dT;

/**
 * Bonded overlap between two adherends of different expansion (shear lag): the adhesive shear peaks at the ends,
 * τmax = (G/ta)·Δα·ΔT·tanh(βL/2)/β with β² = (G/ta)·(1/E1t1 + 1/E2t2); the force carried mid-overlap is Nmax.
 */
export function bondedOverlap(E1: number, t1: number, E2: number, t2: number, G: number, ta: number, L: number, dAlpha: number, dT: number) {
  const S = 1 / (E1 * t1) + 1 / (E2 * t2);
  const beta = Math.sqrt((G / ta) * S);
  const tauMax = ((G / ta) * dAlpha * dT * Math.tanh((beta * L) / 2)) / beta;
  const Nmax = ((dAlpha * dT) / S) * (1 - 1 / Math.cosh((beta * L) / 2)); // N per unit width
  return { beta, tauMax, Nmax, sigma1: Nmax / t1, sigma2: -Nmax / t2, decay: 1 / beta };
}

/** Relative in-plane slip between two bolted plates at distance R from their common fixed point. */
export const patternSlip = (alpha1: number, alpha2: number, dT: number, R: number) => Math.abs((alpha1 - alpha2) * dT * R);
