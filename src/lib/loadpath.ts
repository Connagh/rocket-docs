// Load paths through a solid motor: the pressure end loads that close inside the case, the thrust that leaves it, the
// inertia the motor sheds on the way to the skirt, skirt line loads and attach-ring bolt loads under axial load and
// bending, and how parallel load paths share load by stiffness, gaps and mismatch.
// Units: N, mm, MPa (N/mm²), N·mm for moments, kg and m/s² for inertia.

export const G0 = 9.80665;

/** Pressure end load over a diameter D (the seal or inner diameter): p·πD²/4. */
export const endLoad = (p: number, D: number) => (p * Math.PI * D * D) / 4;

/** Thrust F = C_F·p·A_t for a throat of diameter dt. */
export const thrust = (cf: number, p: number, dt: number) => cf * endLoad(p, dt);

/**
 * Net axial loads on the motor's ends while firing. The forward dome is pushed forward by p·A over the case bore; the
 * aft closure and nozzle together are pushed aft by p·A − F, because no wall faces the throat. The nozzle attached
 * over diameter dn carries p·A_n − F aft (its blow-off load); a closure sealed at Ds carries p·A_s − F while firing
 * and the full p·A_s in a static pressure test, with no flow to relieve it.
 */
export function pressureLoads(p: number, D: number, cf: number, dt: number, dn: number, Ds: number) {
  const F = thrust(cf, p, dt), fwd = endLoad(p, D);
  return {
    F, fwd, aft: fwd - F, ratio: fwd / F,
    nozzle: endLoad(p, dn) - F,
    closureFiring: endLoad(p, Ds) - F,
    closureStatic: endLoad(p, Ds),
  };
}

/** Acceleration from thrust alone (no drag or weight) and the load passed forward to the mass ahead of the skirt. */
export function flightLoads(F: number, mMotor: number, mAhead: number) {
  const a = F / (mMotor + mAhead);
  return { a, g: a / G0, skirt: mAhead * a, motor: mMotor * a };
}

/** Mean shear on the grain-to-case bond from the grain's own inertia, m·a over the bonded area π·D·L (MPa). */
export const bondInertiaShear = (mGrain: number, a: number, D: number, L: number) => (mGrain * a) / (Math.PI * D * L);

/**
 * Running load in a thin cylinder of mean diameter D under axial compression P and bending moment M (N/mm, compression
 * positive): the mean P/(πD) plus or minus the bending part 4M/(πD²).
 */
export function lineLoad(P: number, M: number, D: number) {
  const axial = P / (Math.PI * D), bend = (4 * M) / (Math.PI * D * D);
  return { axial, bend, maxComp: axial + bend, maxTens: bend - axial };
}

/**
 * Bolt loads in a ring of n equally spaced bolts on a bolt circle D, under axial compression P and moment M, with the
 * neutral axis through the centre (the joint stays closed). Positive is tension; bolt 0 sits on the tension side.
 */
export function ringBoltLoads(P: number, M: number, n: number, D: number) {
  const bend = (4 * M) / (n * D), axial = P / n;
  const each = Array.from({ length: n }, (_, i) => -axial + bend * Math.cos((2 * Math.PI * i) / n));
  return { each, bend, axial, maxTension: bend - axial, maxCompression: bend + axial };
}

/** Axial stiffness of a thin tube, E·π·D·t/L (N/mm), with D the mean diameter. */
export const tubeStiffness = (E: number, D: number, t: number, L: number) => (E * Math.PI * D * t) / L;

/** Axial growth of a closed-end thin cylinder under internal pressure, p·r·L(1 − 2ν)/(2E·t). */
export const axialGrowth = (p: number, r: number, t: number, E: number, nu: number, L: number) =>
  (p * r * L * (1 - 2 * nu)) / (2 * E * t);

export interface Path {
  k: number; // stiffness, N/mm
  gap?: number; // free movement either way before the path takes load, mm
  cap?: number; // capacity, N — the load at which the path fails
}

const engaged = (u: number, gap = 0) => Math.sign(u) * Math.max(0, Math.abs(u) - gap);

/** Forces in two parallel paths at displacement u, path 1 being longer than path 2 by `mismatch` when unloaded. */
const forcesAt = (u: number, p1: Path, p2: Path, mismatch: number) => [p1.k * engaged(u - mismatch, p1.gap), p2.k * engaged(u, p2.gap)];

/**
 * Two parallel paths joining the same two points, sharing an applied load P (tension positive). `mismatch` is how much
 * longer path 1 would be than path 2 with no load — pressure growth or thermal mismatch — so the paths fight each other
 * even at P = 0. Each path may have a gap (slack either way) before it takes load. Elastic; returns the common
 * displacement and each path's force.
 */
export function shareLoad(P: number, p1: Path, p2: Path, mismatch = 0) {
  const total = (u: number) => { const [a, b] = forcesAt(u, p1, p2, mismatch); return a + b; };
  const span = Math.abs(P) / Math.min(p1.k, p2.k) + Math.abs(mismatch) + (p1.gap ?? 0) + (p2.gap ?? 0) + 1;
  let lo = -span, hi = span;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (total(mid) < P) lo = mid; else hi = mid; }
  const u = (lo + hi) / 2, [f1, f2] = forcesAt(u, p1, p2, mismatch);
  return { u, f1, f2 };
}

/** The force a mismatch alone sets up when two paths join the same points: (δ − gaps)·k1k2/(k1 + k2). */
export const mismatchForce = (mismatch: number, p1: Path, p2: Path) =>
  Math.max(0, Math.abs(mismatch) - (p1.gap ?? 0) - (p2.gap ?? 0)) * ((p1.k * p2.k) / (p1.k + p2.k));

/**
 * The applied load, in the direction of P, at which the first path with a capacity reaches it — with the mismatch
 * acting throughout. 0 if the mismatch alone already breaks a path; Infinity if no path has a capacity.
 */
export function firstFailure(P: number, p1: Path, p2: Path, mismatch = 0) {
  const dir = P < 0 ? -1 : 1;
  const use = (f: number, cap?: number) => (cap !== undefined && cap > 0 ? Math.abs(f) / cap : 0);
  const util = (load: number) => { const s = shareLoad(load, p1, p2, mismatch); return Math.max(use(s.f1, p1.cap), use(s.f2, p2.cap)); };
  const which = (load: number) => { const s = shareLoad(load, p1, p2, mismatch); return use(s.f1, p1.cap) >= use(s.f2, p2.cap) ? 1 : 2; };
  if (!(p1.cap! > 0) && !(p2.cap! > 0)) return { load: Infinity, path: 0 };
  if (util(0) >= 1) return { load: 0, path: which(0) };
  const top = 2 * ((p1.cap ?? 0) + (p2.cap ?? 0)) + 2 * mismatchForce(mismatch, p1, p2);
  const N = 400;
  let a = 0, b = NaN;
  for (let i = 1; i <= N; i++) { const x = (top * i) / N; if (util(dir * x) >= 1) { b = x; break; } a = x; }
  if (!Number.isFinite(b)) return { load: Infinity, path: 0 };
  for (let i = 0; i < 100; i++) { const m = (a + b) / 2; if (util(dir * m) >= 1) b = m; else a = m; }
  return { load: dir * b, path: which(dir * b) };
}
