// Propellant properties a hardware designer inherits: temperature sensitivity and the MEOP build-up,
// and time–temperature superposition for the viscoelastic modulus. Textbook relations only (Sutton & Biblarz;
// Williams, Landel & Ferry 1955); all property values are inputs.

/** Pressure sensitivity at constant Kn from burn-rate sensitivity: π_K = σ_p / (1 − n). Both per kelvin. */
export const piK = (sigmaP: number, n: number) => sigmaP / (1 - n);

/** Chamber-pressure ratio for a ratio in burn-rate coefficient, burning area or 1/throat area: x^(1/(1−n)). */
export const amplified = (ratio: number, n: number) => Math.pow(ratio, 1 / (1 - n));

export interface MeopInputs {
  pNom: number; // nominal peak pressure at the reference temperature, MPa
  tRef: number; tHot: number; tCold: number; // °C
  n: number;
  sigmaP: number; // burn-rate temperature sensitivity, 1/K
  rateVar: number; // burn-rate coefficient variation, fraction (at the programme's MEOP probability level)
  abVar: number; // burning-area variation, fraction
  atVar: number; // throat-area variation, fraction
  other: number; // further allowance from firing data (ignition spike, erosive burning), fraction
}

export function meopBuildUp(i: MeopInputs) {
  const pk = piK(i.sigmaP, i.n);
  const hot = Math.exp(pk * (i.tHot - i.tRef)), cold = Math.exp(pk * (i.tCold - i.tRef));
  // High side: faster rate, more area, smaller throat. Low side: the reverse.
  const hi = { rate: amplified(1 + i.rateVar, i.n) - 1, ab: amplified(1 + i.abVar, i.n) - 1, at: amplified(1 / (1 - i.atVar), i.n) - 1 };
  const lo = { rate: 1 - amplified(1 - i.rateVar, i.n), ab: 1 - amplified(1 - i.abVar, i.n), at: 1 - amplified(1 / (1 + i.atVar), i.n) };
  const rss = (o: { rate: number; ab: number; at: number }) => Math.hypot(o.rate, o.ab, o.at);
  const worst = (1 + hi.rate) * (1 + hi.ab) * (1 + hi.at) - 1;
  const pHot = i.pNom * hot, pCold = i.pNom * cold;
  return {
    piK: pk,
    amplification: 1 / (1 - i.n),
    pHot, pCold,
    hi, lo,
    rssHi: rss(hi), rssLo: rss(lo), worst,
    meop: pHot * (1 + rss(hi)) * (1 + i.other), // independent variations combined root-sum-square
    meopWorst: pHot * (1 + worst) * (1 + i.other), // every variation at its limit at once
    pMin: pCold * (1 - rss(lo)),
    // At constant Kn, r ∝ a^(1/(1−n)) too, so burn time scales as exp(−π_K ΔT).
    burnTimeHot: 1 / hot, burnTimeCold: 1 / cold,
  };
}

// ---------------------------------------------------------------------------
// Viscoelastic stiffness: WLF shift and an illustrative power-law master curve
// ---------------------------------------------------------------------------

/** WLF: log10 a_T = −C1 (T − Ts) / (C2 + T − Ts). Ts is the reference temperature (°C or K — only differences matter). */
export const wlfLogShift = (T: number, Ts: number, C1 = 8.86, C2 = 101.6) => (-C1 * (T - Ts)) / (C2 + T - Ts);

/** Reduced time: the time at Ts that is equivalent to time t at temperature T. */
export const reducedTime = (t: number, T: number, Ts: number, C1?: number, C2?: number) => t / Math.pow(10, wlfLogShift(T, Ts, C1, C2));

export interface MasterCurve { eEq: number; e1: number; m: number; eGlass: number } // MPa, MPa at ξ = 1 s, exponent, MPa

/** Power-law relaxation modulus E(ξ) = E_eq + E1·ξ^(−m), capped at the glassy modulus. */
export const relaxModulus = (xi: number, c: MasterCurve) => Math.min(c.eGlass, c.eEq + c.e1 * Math.pow(xi, -c.m));
