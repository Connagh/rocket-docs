// Linear viscoelasticity with a Prony series (generalised Maxwell model): relaxation, creep, recovery after
// release, dynamic moduli, and time–temperature shifting with WLF. Units: MPa, seconds, °C.

export interface Prony { eInf: number; terms: { e: number; tau: number }[] } // E∞ and arms (E_i, τ_i)

export const instantaneous = (p: Prony) => p.eInf + p.terms.reduce((s, a) => s + a.e, 0);

/** Relaxation modulus E(t) = E∞ + Σ E_i e^(−t/τ_i). */
export const relaxation = (p: Prony, t: number) => p.eInf + p.terms.reduce((s, a) => s + a.e * Math.exp(-t / a.tau), 0);

/** Storage and loss moduli at angular frequency ω (rad/s). */
export function dynamic(p: Prony, w: number) {
  let e1 = p.eInf, e2 = 0;
  for (const a of p.terms) {
    const x = w * a.tau, d = 1 + x * x;
    e1 += (a.e * x * x) / d;
    e2 += (a.e * x) / d;
  }
  return { storage: e1, loss: e2, tanDelta: e2 / e1 };
}

/** WLF constants referred to Tref from the "universal" values at the glass transition (C1g 17.44, C2g 51.6 K). */
export function wlfFromTg(tg: number, tRef: number, c1g = 17.44, c2g = 51.6) {
  const d = tRef - tg;
  return { c1: (c1g * c2g) / (c2g + d), c2: c2g + d };
}
/** log10 a_T, WLF form. */
export const logShift = (T: number, tRef: number, c1: number, c2: number) => (-c1 * (T - tRef)) / (c2 + T - tRef);

/**
 * Strain response to a stress history built from constant segments, by exact integration of each Maxwell arm over
 * each step (strain taken as linear within a step). Steps are log-spaced so microseconds and years both resolve.
 */
function stepper(p: Prony) {
  let eps = 0, t = 0;
  const s = p.terms.map(() => 0); // arm stresses
  const e0 = instantaneous(p);
  return {
    get eps() { return eps; },
    get t() { return t; },
    stress: () => p.eInf * eps + s.reduce((a, b) => a + b, 0),
    /** Apply an instantaneous strain jump. */
    jumpStrain(de: number) { eps += de; p.terms.forEach((a, k) => (s[k] += a.e * de)); },
    /** Apply an instantaneous stress jump (all arms respond elastically). */
    jumpStress(ds: number) { this.jumpStrain(ds / e0); },
    /** Advance by dt holding total stress at sigma. */
    stepStress(dt: number, sigma: number) {
      const decay = p.terms.map((a) => Math.exp(-dt / a.tau));
      const gain = p.terms.map((a, k) => (a.e * a.tau * (1 - decay[k])) / dt);
      const rest = p.terms.reduce((acc, _a, k) => acc + s[k] * decay[k], 0);
      const de = (sigma - p.eInf * eps - rest) / (p.eInf + gain.reduce((a, b) => a + b, 0));
      p.terms.forEach((_a, k) => (s[k] = s[k] * decay[k] + gain[k] * de));
      eps += de; t += dt;
    },
    /** Advance by dt holding strain constant (arms just relax). */
    stepStrain(dt: number) { p.terms.forEach((a, k) => (s[k] *= Math.exp(-dt / a.tau))); t += dt; },
  };
}

const logSteps = (t0: number, t1: number, perDecade = 120) => {
  const n = Math.max(1, Math.ceil(Math.log10(t1 / t0) * perDecade));
  return Array.from({ length: n + 1 }, (_, k) => t0 * Math.pow(t1 / t0, k / n));
};

/** Creep compliance J(t) = ε(t)/σ₀ under a constant stress applied at t = 0, at the requested times. */
export function creepCompliance(p: Prony, times: number[]) {
  const m = stepper(p);
  m.jumpStress(1);
  const tMax = Math.max(...times), tMin = Math.max(1e-12, Math.min(...times.filter((x) => x > 0)) / 100);
  const grid = [0, ...logSteps(tMin, tMax)];
  const out = new Map<number, number>();
  const sorted = [...times].sort((a, b) => a - b);
  let k = 0;
  for (let g = 1; g < grid.length && k < sorted.length; g++) {
    m.stepStress(grid[g] - grid[g - 1], 1);
    while (k < sorted.length && sorted[k] <= grid[g] * (1 + 1e-12)) { out.set(sorted[k], m.eps); k++; }
  }
  return times.map((x) => (x <= 0 ? 1 / instantaneous(p) : out.get(x) ?? m.eps));
}

/**
 * Hold a strain for tHold, then release it (stress to zero) and let it recover.
 * Returns the fraction of the original strain recovered at each time after release.
 */
export function recoveryAfterHold(p: Prony, tHold: number, times: number[]) {
  const m = stepper(p);
  m.jumpStrain(1);
  if (tHold > 0) m.stepStrain(tHold);
  m.jumpStress(-m.stress()); // release: elastic spring-back of every arm at once
  const tMax = Math.max(...times), grid = [0, ...logSteps(Math.max(1e-12, Math.min(...times) / 100), tMax)];
  const sorted = [...times].sort((a, b) => a - b), out = new Map<number, number>();
  let k = 0;
  for (let g = 1; g < grid.length && k < sorted.length; g++) {
    m.stepStress(grid[g] - grid[g - 1], 0);
    while (k < sorted.length && sorted[k] <= grid[g] * (1 + 1e-12)) { out.set(sorted[k], 1 - m.eps); k++; }
  }
  return { immediate: relaxation(p, tHold) / instantaneous(p), at: times.map((x) => out.get(x) ?? 1 - m.eps) };
}

/** Abaqus-style card: instantaneous modulus, normalised g_i (k_i = 0: no bulk relaxation) and WLF shift. */
export function abaqusCard(p: Prony, nu: number, tRef: number, c1: number, c2: number, name = 'VISCO') {
  const e0 = instantaneous(p);
  const rows = p.terms.map((a) => `${(a.e / e0).toPrecision(5)}, 0., ${a.tau.toPrecision(5)}`);
  return [
    `*MATERIAL, NAME=${name}`,
    '*ELASTIC, MODULI=INSTANTANEOUS',
    `${e0.toPrecision(6)}, ${nu}`,
    '*VISCOELASTIC, TIME=PRONY',
    ...rows,
    '*TRS, DEFINITION=WLF',
    `${tRef}, ${c1.toPrecision(5)}, ${c2.toPrecision(5)}`,
  ].join('\n');
}
