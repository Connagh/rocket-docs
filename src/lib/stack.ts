// Tolerance stack-ups. Linear stacks of contributors with sensitivities: worst case, root-sum-square (RSS) with each
// part's tolerance at ±3·Cpk standard deviations, and Monte Carlo — which also takes a nonlinear result function.
// Radial stacks: offsets in a plane that add as vectors (coaxiality, clearance shifts, tilts at a lever arm), where
// worst case, the RSS of the radii and Monte Carlo can disagree badly. Units are the contributors' own, usually mm.
import { normalCdf } from './allowables.ts';

export type Dist = 'normal' | 'uniform';
/** One term in a stack: limits from the drawing, and the sensitivity of the result to it (±1, ±½ for a diameter…). */
export interface Contributor { name: string; sens: number; lo: number; hi: number; dist?: Dist; cpk?: number }

const mid = (c: Contributor) => (c.lo + c.hi) / 2;
const half = (c: Contributor) => Math.abs(c.hi - c.lo) / 2;

/** Standard deviation of a contributor: normal and centred with its tolerance at ±3·Cpk σ, or uniform across it. */
export const sigmaOf = (c: Contributor, cpk = 1) => (c.dist === 'uniform' ? half(c) / Math.sqrt(3) : half(c) / (3 * (c.cpk ?? cpk)));

/**
 * Linear stack, result = Σ sens·x. Worst case adds every half tolerance; RSS adds variances. With every part normal
 * and Cpk 1, the ±3σ RSS band is the textbook √Σ(s·t)². Shares say which contributor to tighten first.
 */
export function linearStack(cs: Contributor[], cpk = 1) {
  const nominal = cs.reduce((a, c) => a + c.sens * mid(c), 0);
  const wc = cs.reduce((a, c) => a + Math.abs(c.sens) * half(c), 0);
  const vars = cs.map((c) => (c.sens * sigmaOf(c, cpk)) ** 2);
  const variance = vars.reduce((a, v) => a + v, 0), sigma = Math.sqrt(variance);
  const rows = cs.map((c, i) => ({
    name: c.name, mean: mid(c), half: half(c), wcPart: Math.abs(c.sens) * half(c),
    wcShare: wc > 0 ? (Math.abs(c.sens) * half(c)) / wc : 0, varShare: variance > 0 ? vars[i] / variance : 0,
  }));
  return { nominal, wc, wcMin: nominal - wc, wcMax: nominal + wc, sigma, rss: 3 * sigma, rssMin: nominal - 3 * sigma, rssMax: nominal + 3 * sigma, rows };
}

/** Capability of a normal result against optional limits: Cpk and the predicted fractions outside. */
export function capability(mean: number, sigma: number, lsl?: number, usl?: number) {
  const zl = lsl === undefined ? Infinity : (mean - lsl) / sigma;
  const zu = usl === undefined ? Infinity : (usl - mean) / sigma;
  return { cpk: Math.min(zl, zu) / 3, below: zl === Infinity ? 0 : normalCdf(-zl), above: zu === Infinity ? 0 : normalCdf(-zu) };
}

/** Small, fast, seedable generator (mulberry32) so a Monte Carlo run is repeatable. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal by Box–Muller. */
export const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** Summary of a sample: mean, standard deviation, quantiles and fractions beyond limits. */
export function summarise(values: Float64Array) {
  const s = Float64Array.from(values).sort(), n = s.length;
  let m = 0;
  for (const v of s) m += v;
  m /= n;
  let q = 0;
  for (const v of s) q += (v - m) ** 2;
  const quantile = (p: number) => {
    const x = Math.min(n - 1, Math.max(0, p * (n - 1))), i = Math.floor(x), f = x - i;
    return i + 1 < n ? s[i] * (1 - f) + s[i + 1] * f : s[i];
  };
  const below = (v: number) => { let lo = 0, hi = n; while (lo < hi) { const k = (lo + hi) >> 1; if (s[k] < v) lo = k + 1; else hi = k; } return lo / n; };
  return { n, mean: m, sd: Math.sqrt(q / (n - 1)), min: s[0], max: s[n - 1], sorted: s, quantile, below, above: (v: number) => 1 - below(v) };
}

/**
 * Monte Carlo: draw every contributor from its distribution and evaluate the result — the linear sum by default, or
 * any function of the drawn values (a squeeze as a fraction of the drawn section, say).
 */
export function monteCarlo(cs: Contributor[], opts: { n?: number; seed?: number; cpk?: number; f?: (x: number[]) => number } = {}) {
  const { n = 100000, seed = 1, cpk = 1, f } = opts, r = rng(seed), out = new Float64Array(n), x = new Array(cs.length);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      x[i] = c.dist === 'uniform' ? c.lo + (c.hi - c.lo) * r() : mid(c) + sigmaOf(c, cpk) * gauss(r);
    }
    out[k] = f ? f(x) : x.reduce((a: number, v: number, i: number) => a + cs[i].sens * v, 0);
  }
  return summarise(out);
}

export type RadialKind = 'zone' | 'shift' | 'fixed';
/**
 * One radial offset, r its largest value at the plane of interest:
 * zone — anywhere in a circular tolerance zone of radius r (position, coaxiality), uniformly;
 * shift — a clearance taken up fully, in a random direction;
 * fixed — a clearance taken up fully, in the same direction on every assembly (gravity on a horizontal stand).
 */
export interface Offset { name: string; r: number; kind: RadialKind }

/** Radial stack: worst case Σr, the RSS of the radii √Σr², and the Monte Carlo resultant. */
export function radialStack(offs: Offset[], opts: { n?: number; seed?: number } = {}) {
  const { n = 100000, seed = 1 } = opts, r = rng(seed), out = new Float64Array(n);
  const xs = new Float32Array(Math.min(n, 1500)), ys = new Float32Array(xs.length);
  for (let k = 0; k < n; k++) {
    let x = 0, y = 0;
    for (const o of offs) {
      if (o.kind === 'fixed') { x += o.r; continue; }
      const rho = o.kind === 'zone' ? o.r * Math.sqrt(r()) : o.r, th = 2 * Math.PI * r();
      x += rho * Math.cos(th); y += rho * Math.sin(th);
    }
    out[k] = Math.hypot(x, y);
    if (k < xs.length) { xs[k] = x; ys[k] = y; }
  }
  const wc = offs.reduce((a, o) => a + o.r, 0), rssRadii = Math.sqrt(offs.reduce((a, o) => a + o.r * o.r, 0));
  const shares = offs.map((o) => ({ name: o.name, r: o.r, kind: o.kind, wcShare: wc > 0 ? o.r / wc : 0 }));
  return { wc, rssRadii, mc: summarise(out), points: { xs, ys }, shares };
}

/** Line offset of a tilt at a lever arm: a tolerance t over a length l tilts the axis by t/l. */
export const tiltOffset = (t: number, l: number, lever: number) => (t / l) * lever;

/** Parse "name, sensitivity, low, high[, n|u]" lines; names may contain commas. */
export function parseContributors(text: string) {
  const out: Contributor[] = [], bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const f = line.split(',').map((s) => s.trim());
    let dist: Dist = 'normal';
    if (/^(u|uniform)$/i.test(f[f.length - 1])) { dist = 'uniform'; f.pop(); } else if (/^(n|normal)$/i.test(f[f.length - 1])) f.pop();
    const nums = f.slice(-3).map(Number), name = f.slice(0, -3).join(', ');
    if (f.length < 4 || nums.some((v) => !Number.isFinite(v)) || f.slice(-3).some((s) => s === '')) { bad.push(line); continue; }
    const [sens, a, b] = nums;
    out.push({ name: name || `Row ${out.length + 1}`, sens, lo: Math.min(a, b), hi: Math.max(a, b), dist });
  }
  return { rows: out, bad };
}

/** Parse "name, r, zone|shift|fixed" lines; r may be a tilt "t/l", taken to the lever arm. */
export function parseOffsets(text: string, lever: number) {
  const out: Offset[] = [], bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const f = line.split(',').map((s) => s.trim());
    const kind = f.length >= 3 ? f[f.length - 1].toLowerCase() : '';
    const val = f[f.length - 2] ?? '', name = f.slice(0, -2).join(', ');
    const m = /^([\d.]+)\s*\/\s*([\d.]+)$/.exec(val);
    const r = m ? (Number.isFinite(lever) && lever > 0 ? tiltOffset(+m[1], +m[2], lever) : NaN) : Number(val);
    if (!['zone', 'shift', 'fixed'].includes(kind) || !(r >= 0) || val === '') { bad.push(line); continue; }
    out.push({ name: name || `Row ${out.length + 1}`, r, kind: kind as RadialKind });
  }
  return { rows: out, bad };
}
