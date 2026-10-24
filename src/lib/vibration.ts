// Random vibration: PSD profiles and Grms, Miles' equation, the exact single-degree-of-freedom response,
// Gaussian sigma levels, Rayleigh peaks and Steinberg's three-band fatigue method.
// Units: Hz, g²/Hz, g, kg, N, mm, MPa. Textbook methods (Miles 1954; Crandall & Mark; Steinberg).
import { normalCdf } from './allowables.ts';

export const G0 = 9.80665;
const DB_OCT = 10 * Math.log10(2); // a slope of 3.01 dB/oct is ASD ∝ f¹

export interface Point { f: number; a: number } // frequency (Hz), ASD (g²/Hz)
export interface RawRow { f: number; value: number; kind: 'asd' | 'slope' } // slope in dB/oct

/** Slope of a segment between two breakpoints, dB per octave. */
export const dbPerOct = (p: Point, q: Point) => (10 * Math.log10(q.a / p.a)) / Math.log2(q.f / p.f);

/** Ratio of ASD for a change in dB; Grms scales with its square root. */
export const dbToRatio = (db: number) => Math.pow(10, db / 10);

/**
 * Resolve a breakpoint table where some rows give a slope in dB/oct instead of an ASD, as test specifications
 * are written. A slope always describes the segment between that row and its neighbour, read left to right:
 * a trailing row takes its ASD from the row before, a leading row from the row after.
 */
export function resolveProfile(rows: RawRow[]): { points: Point[]; error: string | null } {
  const r = rows.filter((x) => x.f > 0 && Number.isFinite(x.value)).sort((a, b) => a.f - b.f);
  if (r.length < 2) return { points: [], error: 'enter at least two breakpoints' };
  if (r.some((x, i) => i > 0 && x.f === r[i - 1].f)) return { points: [], error: 'two breakpoints share a frequency' };
  if (r.some((x) => x.kind === 'asd' && !(x.value > 0))) return { points: [], error: 'an ASD must be greater than zero' };
  const a = r.map((x) => (x.kind === 'asd' ? x.value : null));
  for (let i = 1; i < r.length; i++)
    if (a[i] === null && a[i - 1] !== null) a[i] = a[i - 1]! * Math.pow(r[i].f / r[i - 1].f, r[i].value / DB_OCT);
  for (let i = r.length - 2; i >= 0; i--)
    if (a[i] === null && a[i + 1] !== null) a[i] = a[i + 1]! / Math.pow(r[i + 1].f / r[i].f, r[i].value / DB_OCT);
  if (a.some((v) => v === null)) return { points: [], error: 'a slope needs an ASD value somewhere next to it' };
  return { points: r.map((x, i) => ({ f: x.f, a: a[i]! })), error: null };
}

/** Exact area under one straight segment on log-log axes. */
export function segmentArea(p: Point, q: Point) {
  const n = Math.log(q.a / p.a) / Math.log(q.f / p.f);
  if (Math.abs(n + 1) < 1e-9) return p.a * p.f * Math.log(q.f / p.f);
  return ((p.a * p.f) / (n + 1)) * (Math.pow(q.f / p.f, n + 1) - 1);
}

/** Mean square (g²) — the area under the ASD — and Grms, its square root. */
export const meanSquare = (pts: Point[]) => pts.slice(1).reduce((s, q, i) => s + segmentArea(pts[i], q), 0);
export const grms = (pts: Point[]) => Math.sqrt(meanSquare(pts));

/** ASD at f by log-log interpolation; zero outside the profile. */
export function asdAt(pts: Point[], f: number) {
  if (!pts.length || f < pts[0].f || f > pts[pts.length - 1].f) return 0;
  for (let i = 1; i < pts.length; i++) {
    if (f <= pts[i].f) {
      const p = pts[i - 1], q = pts[i];
      return p.a * Math.pow(f / p.f, Math.log(q.a / p.a) / Math.log(q.f / p.f));
    }
  }
  return 0;
}

/** Miles' equation: rms acceleration of a lightly damped SDOF on a base with a flat ASD near f_n. */
export const miles = (fn: number, Q: number, asd: number) => Math.sqrt((Math.PI / 2) * fn * Q * asd);

/** Absolute-acceleration transmissibility squared for base excitation. */
export function trans2(f: number, fn: number, Q: number) {
  const r = f / fn, c = (r / Q) ** 2; // (2ζr)² with ζ = 1/(2Q)
  return (1 + c) / ((1 - r * r) ** 2 + c);
}

/**
 * Exact SDOF response to the whole profile, by composite Simpson's rule in ln f:
 * rms absolute acceleration (g), rms relative displacement (mm), and the response ASD's mean square.
 */
export function sdofResponse(pts: Point[], fn: number, Q: number, n = 20000) {
  const f0 = pts[0].f, f1 = pts[pts.length - 1].f;
  const u0 = Math.log(f0), h = (Math.log(f1) - u0) / n;
  let acc = 0, dis = 0;
  for (let i = 0; i <= n; i++) {
    const f = Math.min(f1, Math.max(f0, Math.exp(u0 + i * h)));
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    const r = f / fn, c = (r / Q) ** 2, den = (1 - r * r) ** 2 + c;
    const g = asdAt(pts, f) * f; // df = f du
    acc += (w * g * (1 + c)) / den;
    dis += (w * g) / den;
  }
  const wn2 = (2 * Math.PI * fn) ** 2;
  return { grms: Math.sqrt((acc * h) / 3), zrms: (Math.sqrt((dis * h) / 3) * G0 * 1000) / wn2 };
}

/** Fraction of time a zero-mean Gaussian signal stays within ±kσ. */
export const fractionWithin = (k: number) => 2 * normalCdf(k) - 1;

/** Expected number of peaks above kσ for a narrow-band response (Rayleigh-distributed peaks). */
export const peaksAbove = (k: number, cycles: number) => cycles * Math.exp((-k * k) / 2);

/** Steinberg's three-band approximation: share of cycles at 1σ, 2σ and 3σ amplitude. */
export const STEINBERG = [
  { k: 1, share: 0.683 },
  { k: 2, share: 0.271 },
  { k: 3, share: 0.0433 },
] as const;

/** Miner damage from Steinberg's three bands, for a response with 1σ stress `sigma1` over `cycles` cycles. */
export function steinbergDamage(sigma1: number, cycles: number, N: (s: number) => number) {
  const bands = STEINBERG.map((b) => {
    const s = b.k * sigma1, n = b.share * cycles, life = N(s);
    return { k: b.k, share: b.share, s, n, N: life, d: Number.isFinite(life) ? n / life : 0 };
  });
  return { bands, D: bands.reduce((t, b) => t + b.d, 0) };
}
