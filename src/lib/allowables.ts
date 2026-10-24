// Statistical design allowables: one-sided tolerance limits for a normal population (A- and B-basis), and the
// knockdowns between a test-data value and the number used in a margin. Units: MPa (any consistent unit works).

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 erf, |error| < 1.5e-7). */
export function normalCdf(x: number) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Standard normal quantile (Acklam's rational approximation, relative error < 1.2e-9). */
export function normalQuantile(p: number) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425, hi = 1 - lo;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > hi) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function lnGamma(x: number): number {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let s = c[0];
  for (let i = 1; i < g + 2; i++) s += c[i] / (x + i);
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
}

/**
 * Noncentral t CDF, P(T ≤ t) with ν degrees of freedom and noncentrality δ, by integrating over the distribution of
 * u = √(χ²_ν / ν):  P = ∫ Φ(t·u − δ) g(u) du.
 */
export function noncentralTCdf(t: number, nu: number, delta: number) {
  const lnC = Math.log(2) + (nu / 2) * Math.log(nu / 2) - lnGamma(nu / 2);
  const g = (u: number) => (u <= 0 ? 0 : Math.exp(lnC + (nu - 1) * Math.log(u) - (nu * u * u) / 2));
  const sd = 1 / Math.sqrt(2 * nu), lo = Math.max(0, 1 - 12 * sd), hi = 1 + 12 * sd + 2 / nu;
  const n = 2000, h = (hi - lo) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const u = lo + i * h, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    s += w * normalCdf(t * u - delta) * g(u);
  }
  return (s * h) / 3;
}

/**
 * One-sided tolerance factor k: x̄ − k·s is exceeded by a fraction p of a normal population, with confidence γ.
 * k = t'_γ(ν = n−1, δ = z_p √n) / √n — the exact method behind handbook A- and B-basis values.
 */
export function toleranceFactor(n: number, p: number, gamma = 0.95) {
  const nu = n - 1, delta = normalQuantile(p) * Math.sqrt(n);
  let lo = delta, hi = delta + 20 * Math.sqrt(1 + delta * delta / (2 * nu)) + 10;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (noncentralTCdf(mid, nu, delta) < gamma) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2 / Math.sqrt(n);
}

/** CMH-17's closed-form approximations to the 95%-confidence factors (good to about 1% for n ≥ 5). */
export const kBApprox = (n: number) => 1.282 + Math.exp(0.958 - 0.52 * Math.log(n) + 3.19 / n);
export const kAApprox = (n: number) => 2.326 + Math.exp(1.34 - 0.522 * Math.log(n) + 3.87 / n);

export function sampleStats(xs: number[]) {
  const n = xs.length, mean = xs.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : NaN;
  return { n, mean, sd, cv: sd / mean, min: Math.min(...xs), max: Math.max(...xs) };
}

/** A- and B-basis values from test data, assuming a normal population. */
export function basisValues(xs: number[]) {
  const st = sampleStats(xs);
  const kA = toleranceFactor(st.n, 0.99), kB = toleranceFactor(st.n, 0.9);
  return { ...st, kA, kB, A: st.mean - kA * st.sd, B: st.mean - kB * st.sd };
}

/** Fraction of room-temperature strength retained at temperature: family screening curves (linear between points). */
export const RETENTION: Record<string, [number, number][]> = {
  al: [[20, 1], [100, 0.9], [150, 0.68], [200, 0.42], [250, 0.24], [300, 0.13]],
  ti: [[20, 1], [100, 0.9], [200, 0.8], [300, 0.72], [400, 0.65], [500, 0.58]],
  steel: [[20, 1], [100, 0.96], [200, 0.92], [300, 0.88], [400, 0.8], [500, 0.62], [600, 0.38]],
  ss: [[20, 1], [100, 0.82], [200, 0.72], [300, 0.65], [400, 0.6], [500, 0.56]],
  ni: [[20, 1], [200, 0.94], [400, 0.9], [600, 0.88], [700, 0.8], [760, 0.65]],
};
export function retention(family: string, t: number) {
  const c = RETENTION[family] ?? RETENTION.steel;
  if (t <= c[0][0]) return 1;
  for (let i = 1; i < c.length; i++) if (t <= c[i][0]) { const [t0, f0] = c[i - 1], [t1, f1] = c[i]; return f0 + ((f1 - f0) * (t - t0)) / (t1 - t0); }
  return NaN; // beyond the curve: no estimate
}
