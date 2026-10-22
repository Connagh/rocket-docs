// Lumped (0-D) solid rocket motor internal ballistics.
// Burn rate law r = a·pⁿ with p in MPa and r in mm/s.

export interface BallisticInputs {
  rhoP: number; // propellant density, kg/m³
  a: number; // burn-rate coefficient, mm/s per MPaⁿ
  n: number; // pressure exponent
  cStar: number; // characteristic velocity, m/s
  kn: number; // burning area / throat area
}

/** Mass generated per unit throat area, kg/s/m², at chamber pressure p (MPa). */
export const massIn = (b: BallisticInputs, p: number) =>
  b.rhoP * b.kn * (b.a / 1000) * Math.pow(p, b.n);

/** Mass discharged through a choked throat per unit throat area, kg/s/m². */
export const massOut = (b: BallisticInputs, p: number) => (p * 1e6) / b.cStar;

/**
 * Equilibrium chamber pressure (MPa), from ρ·A_b·a·pⁿ = p·A_t / c*.
 * Only a stable equilibrium if n < 1; returns NaN otherwise.
 */
export function equilibriumPressure(b: BallisticInputs) {
  if (b.n >= 1) return NaN;
  return Math.pow((b.rhoP * b.kn * b.a * b.cStar) / 1e9, 1 / (1 - b.n));
}

/** Amplification of a fractional Kn (or burn-rate) change into pressure: 1/(1−n). */
export const pressureSensitivity = (n: number) => 1 / (1 - n);

/** Thrust, N, from F = C_F · p_c · A_t (p in MPa, A_t in m²). */
export const thrust = (cf: number, p: number, at: number) => cf * p * 1e6 * at;
