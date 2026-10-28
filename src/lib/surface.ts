// Surface texture: synthetic profiles for typical processes, the Gaussian profile filter (ISO 16610-21), roughness
// parameters (Ra, Rq, Rz, Rt, Rp, Rv, Rsk, Rku, material ratio Rmr(c)), the ISO 4288 cutoff and acceptance rules,
// theoretical turned roughness and press-fit smoothing (DIN 7190).
// Heights in µm, lengths along the profile in mm.
import { rng, gauss } from './stack.ts';

/** Gaussian weighting function of the profile filter, 50% transmission at the cutoff λc. */
const ALPHA = Math.sqrt(Math.log(2) / Math.PI);

/**
 * Separate a profile into waviness (the mean line) and roughness with the Gaussian filter. The ends lose one
 * cutoff each, as in a real instrument, so the input must be the evaluation length plus 2 λc.
 */
export function gaussianFilter(z: ArrayLike<number>, dx: number, lc: number) {
  const half = Math.round(lc / dx), n = z.length; // kernel to ±λc
  if (n < 2 * half + 4) throw new RangeError('profile shorter than one cutoff');
  const w: number[] = [];
  for (let k = -half; k <= half; k++) w.push(Math.exp(-Math.PI * ((k * dx) / (ALPHA * lc)) ** 2));
  const ws = w.reduce((a, b) => a + b, 0);
  const m = n - 2 * half, waviness = new Float64Array(m), roughness = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    let s = 0;
    for (let k = 0; k < w.length; k++) s += w[k] * z[i + k];
    waviness[i] = s / ws;
    roughness[i] = z[i + half] - waviness[i];
  }
  return { waviness, roughness, offset: half };
}

/**
 * Roughness parameters of a filtered roughness profile. Rz is the mean of the peak-to-valley heights of the sampling
 * lengths (five when the profile is five cutoffs long); Rt is the largest over the whole evaluation length.
 */
export function roughnessParams(r: ArrayLike<number>, dx: number, lc: number) {
  const n = r.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += r[i];
  mean /= n;
  let ra = 0, rq = 0, r3 = 0, r4 = 0, rp = -Infinity, rv = Infinity;
  for (let i = 0; i < n; i++) {
    const y = r[i] - mean;
    ra += Math.abs(y); rq += y * y; r3 += y ** 3; r4 += y ** 4;
    rp = Math.max(rp, y); rv = Math.min(rv, y);
  }
  ra /= n; rq = Math.sqrt(rq / n);
  const per = Math.max(1, Math.round(lc / dx)), nSeg = Math.max(1, Math.floor(n / per)), seg: number[] = [];
  for (let s = 0; s < nSeg; s++) {
    let hi = -Infinity, lo = Infinity;
    for (let i = s * per; i < Math.min(n, (s + 1) * per); i++) { hi = Math.max(hi, r[i]); lo = Math.min(lo, r[i]); }
    seg.push(hi - lo);
  }
  return {
    Ra: ra, Rq: rq, Rp: rp, Rv: -rv, Rt: rp - rv,
    Rz: seg.reduce((a, b) => a + b, 0) / seg.length, segments: seg.length,
    Rsk: r3 / n / rq ** 3, Rku: r4 / n / rq ** 4,
  };
}

/** Material ratio Rmr(c): the fraction of the profile at or above a level c below the highest peak. */
export function materialRatio(r: ArrayLike<number>, c: number) {
  let top = -Infinity;
  for (let i = 0; i < r.length; i++) top = Math.max(top, r[i]);
  let k = 0;
  for (let i = 0; i < r.length; i++) if (r[i] >= top - c) k++;
  return k / r.length;
}

/** The material ratio curve (Abbott–Firestone): depth below the highest peak against material ratio. */
export function abbottCurve(r: ArrayLike<number>, points = 101) {
  const s = Array.from(r).sort((a, b) => b - a), top = s[0], out: { mr: number; depth: number }[] = [];
  for (let k = 0; k < points; k++) {
    const mr = k / (points - 1), i = Math.min(s.length - 1, Math.round(mr * (s.length - 1)));
    out.push({ mr, depth: top - s[i] });
  }
  return out;
}

export type ProfileKind = 'turned' | 'ground' | 'honed' | 'blasted';
export interface ProfileOpts {
  kind: ProfileKind; length: number; dx: number; seed?: number;
  feed?: number; nose?: number;      // turned: feed (mm/rev) and tool nose radius (mm)
  rq?: number; corr?: number;        // random: target Rq (µm) and correlation length (mm)
  plateau?: number;                  // honed: fraction of Rq above the mean where the peaks are cut off
  wavAmp?: number; wavLen?: number;  // waviness amplitude (µm) and wavelength (mm)
}

/** A synthetic measured profile for a process: the roughness of that process plus a sine waviness. */
export function makeProfile(o: ProfileOpts) {
  const n = Math.round(o.length / o.dx) + 1, z = new Float64Array(n), r = rng(o.seed ?? 1);
  if (o.kind === 'turned') {
    const f = o.feed ?? 0.1, R = o.nose ?? 0.8;
    for (let i = 0; i < n; i++) {
      const u = ((((i * o.dx) % f) + f) % f) - f / 2; // position across one feed mark, mm
      z[i] = -(R - Math.sqrt(R * R - u * u)) * 1000 + 0.04 * gauss(r) * (f * f / (8 * R)) * 1000;
    }
  } else {
    // correlated Gaussian noise: white noise smoothed with a Gaussian kernel of the correlation length
    const corr = o.corr ?? (o.kind === 'blasted' ? 0.03 : 0.01), h = Math.max(1, Math.round(corr / o.dx)), w: number[] = [];
    for (let k = -3 * h; k <= 3 * h; k++) w.push(Math.exp(-0.5 * (k / h) ** 2));
    const white = Array.from({ length: n + w.length }, () => gauss(r));
    for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < w.length; k++) s += w[k] * white[i + k]; z[i] = s; }
    let m = 0, q = 0;
    for (const v of z) m += v;
    m /= n;
    for (let i = 0; i < n; i++) { z[i] -= m; q += z[i] * z[i]; }
    const scale = (o.rq ?? 0.5) / Math.sqrt(q / n);
    for (let i = 0; i < n; i++) z[i] *= scale;
    if (o.kind === 'honed') { const cut = (o.plateau ?? 0.3) * (o.rq ?? 0.5); for (let i = 0; i < n; i++) z[i] = Math.min(z[i], cut); }
  }
  if (o.wavAmp) for (let i = 0; i < n; i++) z[i] += o.wavAmp * Math.sin((2 * Math.PI * i * o.dx) / (o.wavLen ?? 4));
  return z;
}

/** Theoretical (kinematic) roughness of a turned surface from feed f (mm/rev) and tool nose radius r (mm), µm. */
export const turnedRoughness = (f: number, r: number) => ({ Rt: (f * f) / (8 * r) * 1000, Ra: (0.0321 * f * f) / r * 1000 });

/** Feed for a target theoretical Ra (µm) with nose radius r (mm). */
export const feedForRa = (ra: number, r: number) => Math.sqrt((ra / 1000) * r / 0.0321);

/** ISO 4288 cutoff λc (mm) for a non-periodic profile, from the expected Ra or Rz (µm). */
export function cutoffFor(value: number, param: 'Ra' | 'Rz' = 'Ra') {
  const t = param === 'Ra' ? [[0.02, 0.08], [0.1, 0.25], [2, 0.8], [10, 2.5], [Infinity, 8]] : [[0.1, 0.08], [0.5, 0.25], [10, 0.8], [50, 2.5], [Infinity, 8]];
  return t.find(([lim]) => value <= lim)![1];
}

/**
 * Acceptance against an upper limit. Max rule: no value may exceed the limit. 16% rule (ISO 4288): accept on a first
 * value at or below 70% of the limit; otherwise no more than 16% of the values may exceed it.
 */
export function acceptance(values: number[], limit: number, rule: '16%' | 'max') {
  const over = values.filter((v) => v > limit).length, frac = values.length ? over / values.length : 0;
  if (rule === 'max') return { over, frac, pass: over === 0, reason: over ? `${over} value${over > 1 ? 's' : ''} above the limit` : 'no value above the limit' };
  if (values.length && values[0] <= 0.7 * limit) return { over, frac, pass: true, reason: 'first value at or below 70% of the limit' };
  return { over, frac, pass: frac <= 0.16, reason: `${over} of ${values.length} above the limit (${Math.round(frac * 100)}%)` };
}

/** Loss of interference when the roughness peaks flatten on assembly (DIN 7190-1): 0.8 (Rz shaft + Rz hub), µm. */
export const smoothingLoss = (rzShaft: number, rzHub: number) => 0.8 * (rzShaft + rzHub);

/** Typical Ra (µm) that each process gives: [best, usual best, usual worst, worst]. Screening values. */
export const PROCESSES = [
  { key: 'sand', name: 'Sand casting', ra: [6.3, 12.5, 25, 50] },
  { key: 'forge', name: 'Forging', ra: [1.6, 3.2, 12.5, 25] },
  { key: 'invest', name: 'Investment casting', ra: [0.8, 1.6, 3.2, 6.3] },
  { key: 'am', name: 'Powder-bed AM, as built', ra: [3.2, 6.3, 12.5, 25] },
  { key: 'blast', name: 'Grit blasting', ra: [0.8, 1.6, 6.3, 12.5] },
  { key: 'mill', name: 'Milling', ra: [0.4, 0.8, 6.3, 12.5] },
  { key: 'turn', name: 'Turning and boring', ra: [0.2, 0.4, 3.2, 6.3] },
  { key: 'drill', name: 'Drilling', ra: [0.8, 1.6, 6.3, 12.5] },
  { key: 'ream', name: 'Reaming', ra: [0.2, 0.4, 1.6, 3.2] },
  { key: 'edm', name: 'EDM, wire and sink', ra: [0.4, 0.8, 3.2, 6.3] },
  { key: 'grind', name: 'Grinding', ra: [0.05, 0.1, 1.6, 3.2] },
  { key: 'hone', name: 'Honing', ra: [0.025, 0.05, 0.4, 0.8] },
  { key: 'burnish', name: 'Roller burnishing', ra: [0.025, 0.05, 0.4, 0.8] },
  { key: 'lap', name: 'Lapping and polishing', ra: [0.0125, 0.025, 0.2, 0.4] },
] as const;

/** Typical finish for functions on motor hardware, Ra µm [lower, upper], with the note that goes with it. */
export const FUNCTIONS = [
  { key: 'sealGas', name: 'Static O-ring face, gas or vacuum', ra: [0.2, 0.4], lay: 'C', note: 'Circular lay, no radial scratches across the seal.' },
  { key: 'sealLiq', name: 'Static O-ring face, liquid', ra: [0.4, 0.8], lay: 'C', note: 'Circular lay. A finer face seals better, but very smooth faces let the ring slide.' },
  { key: 'sealDyn', name: 'Dynamic seal counterface', ra: [0.1, 0.4], lay: '', note: 'Also limit the peaks: material ratio Rmr at least 50–70% near the top, from the seal maker.' },
  { key: 'groove', name: 'O-ring groove walls and root', ra: [0.8, 1.6], lay: '', note: 'Up to Ra 3.2 on the side walls for static seals.' },
  { key: 'bearing', name: 'Rolling-bearing seat (shaft)', ra: [0.4, 0.8], lay: '', note: 'Housing bores to Ra 1.6. From the bearing maker for precision grades.' },
  { key: 'press', name: 'Press or shrink fit', ra: [0.8, 1.6], lay: '', note: 'Peaks flatten on assembly and decrease the interference.' },
  { key: 'fatigue', name: 'Fatigue-critical fillet', ra: [0.2, 0.8], lay: '=', note: 'Lay along the principal stress. Ground or polished, then peened if necessary.' },
  { key: 'bond', name: 'Bonded or insulated surface', ra: [1.6, 6.3], lay: 'M', note: 'From grit blasting; clean, and bond within the time limit of the process.' },
  { key: 'thread', name: 'Bolt bearing face, clamped joint', ra: [0.8, 3.2], lay: '', note: 'Rougher faces embed more and lose preload.' },
  { key: 'general', name: 'General machined surface', ra: [1.6, 3.2], lay: '', note: 'The title-block default on most drawings.' },
] as const;

/** Which processes can give an upper limit of raMax: 'usual' if the usual range is inside it, 'possible' if only the best can. */
export function processesFor(raMax: number) {
  return PROCESSES.map((p) => ({ ...p, fit: p.ra[2] <= raMax ? 'usual' : p.ra[1] <= raMax ? 'possible' : p.ra[0] <= raMax ? 'special' : 'no' }));
}

/** Parse measured values: numbers separated by commas, spaces or new lines. */
export const parseValues = (text: string) => text.split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite);
