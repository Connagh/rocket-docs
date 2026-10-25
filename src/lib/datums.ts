// Datums and position in practice: checking a measured hole pattern against its position tolerance in a fixed datum
// reference frame, with the datum shift a datum feature at MMB allows, and against the feature-relating segment of a
// composite tolerance (free to translate and rotate); and the sizes of a functional gauge. Units: mm.

export interface Hole { dx: number; dy: number; size: number } // measured deviation from true position, and actual size

/** True positions of n holes equally spaced on a circle of radius R, the first at `startDeg`. */
export const boltCircle = (n: number, R: number, startDeg = 0) =>
  Array.from({ length: n }, (_, i) => { const a = ((startDeg + (360 * i) / n) * Math.PI) / 180; return { x: R * Math.cos(a), y: R * Math.sin(a), a }; });

/** Minimise f over x with Nelder–Mead, restarted from its own best point until it stops improving. */
export function minimize(f: (x: number[]) => number, x0: number[], step: number[], iters = 600) {
  let best = x0.slice(), fb = f(best);
  for (let restart = 0; restart < 6; restart++) {
    const n = best.length;
    let simplex = [best.slice(), ...best.map((_, i) => best.map((v, j) => v + (i === j ? step[j] / 2 ** restart : 0)))];
    let vals = simplex.map(f);
    for (let it = 0; it < iters; it++) {
      const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
      simplex = order.map((i) => simplex[i]); vals = order.map((i) => vals[i]);
      const c = Array.from({ length: n }, (_, j) => simplex.slice(0, n).reduce((s, p) => s + p[j], 0) / n);
      const at = (t: number) => c.map((v, j) => v + t * (simplex[n][j] - v));
      const xr = at(-1), fr = f(xr);
      if (fr < vals[0]) { const xe = at(-2), fe = f(xe); [simplex[n], vals[n]] = fe < fr ? [xe, fe] : [xr, fr]; }
      else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
      else {
        const xc = at(fr < vals[n] ? -0.5 : 0.5), fc = f(xc);
        if (fc < Math.min(fr, vals[n])) { simplex[n] = xc; vals[n] = fc; }
        else for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = f(simplex[i]); }
      }
    }
    const i0 = vals.indexOf(Math.min(...vals));
    if (vals[i0] < fb - 1e-12) { best = simplex[i0]; fb = vals[i0]; } else if (restart > 1) break;
  }
  return { x: best, f: fb };
}

export interface PatternInput {
  holes: Hole[];
  mmc: number; // hole MMC (smallest size)
  tol: number; // position tolerance at MMC (diametral)
  bonus: boolean; // MMC modifier on the holes
  shift: number; // diametral datum shift available from datum features at MMB (0 if RFS)
  lowerTol?: number; // feature-relating tolerance of a composite frame, if any
  R?: number; // bolt-circle radius, for rotation in the feature-relating fit
  n?: number; // number of holes on the circle, if different from holes.length
}

/**
 * The measured pattern in three ways. Fixed frame: each hole's position against its own tolerance with bonus. With datum
 * shift: the whole pattern may move up to half the available shift — the best such move. Composite lower segment: the
 * pattern may translate and rotate freely, holes held to the feature-relating tolerance. Results as the worst ratio of
 * position to allowed tolerance (≤ 1 conforms).
 */
export function patternCheck(p: PatternInput) {
  const allowed = (t: number) => p.holes.map((h) => t + (p.bonus ? Math.max(0, h.size - p.mmc) : 0));
  const up = allowed(p.tol);
  const fixed = p.holes.map((h, i) => ({ pos: 2 * Math.hypot(h.dx, h.dy), allowed: up[i] }));
  const worstFixed = Math.max(...fixed.map((h) => h.pos / h.allowed));
  const rmax = p.shift / 2;
  const clamp = (x: number[]) => { const r = Math.hypot(x[0], x[1]); return r <= rmax || r === 0 ? x : [(x[0] * rmax) / r, (x[1] * rmax) / r]; };
  const util = (s: number[], tol: number[]) => Math.max(...p.holes.map((h, i) => (2 * Math.hypot(h.dx - s[0], h.dy - s[1])) / tol[i]));
  let shifted = { s: [0, 0], worst: worstFixed };
  if (rmax > 0) {
    const r = minimize((x) => util(clamp(x), up), [0, 0], [rmax, rmax]);
    shifted = { s: clamp(r.x), worst: util(clamp(r.x), up) };
  }
  let lower: { s: number[]; theta: number; worst: number } | null = null;
  if (p.lowerTol !== undefined && p.lowerTol > 0) {
    const lo = allowed(p.lowerTol), n = p.n ?? p.holes.length, R = p.R ?? 0;
    const tang = p.holes.map((_, i) => { const a = (2 * Math.PI * i) / n; return [-Math.sin(a), Math.cos(a)]; });
    const f = (x: number[]) => Math.max(...p.holes.map((h, i) => (2 * Math.hypot(h.dx - x[0] - x[2] * R * tang[i][0], h.dy - x[1] - x[2] * R * tang[i][1])) / lo[i]));
    const cx = p.holes.reduce((s, h) => s + h.dx, 0) / p.holes.length, cy = p.holes.reduce((s, h) => s + h.dy, 0) / p.holes.length;
    const r = minimize(f, [cx, cy, 0], [0.1, 0.1, R > 0 ? 0.1 / R : 0]);
    lower = { s: [r.x[0], r.x[1]], theta: r.x[2], worst: r.f };
  }
  return { fixed, worstFixed, shifted, lower, failsFixed: fixed.filter((h) => h.pos > h.allowed + 1e-12).length };
}

/** Datum shift available from an external datum feature (a pilot) at MMB: MMB = MMC + its own orientation tolerance at MMC. */
export const datumShift = (pilotMMC: number, pilotOrientTol: number, pilotActual: number) => Math.max(0, pilotMMC + pilotOrientTol - pilotActual);

/**
 * A functional gauge for a hole pattern at MMC located on a pilot at MMB: pins at the holes' virtual condition, a ring at
 * the pilot's MMB. Each gauge element is toleranced as a fraction of its feature's total tolerance (size plus geometric).
 * Under an absolute policy the pins may only be larger and the ring only smaller, so the gauge never accepts a bad part
 * — and the gauge tolerance comes out of the part's.
 */
export function gaugeSizes(hole: { mmc: number; lmc: number; tol: number }, pilot: { mmc: number; lmc: number; tol: number }, fraction = 0) {
  const pin = hole.mmc - hole.tol, ring = pilot.mmc + pilot.tol;
  const gtPin = fraction * (hole.lmc - hole.mmc + hole.tol), gtRing = fraction * (pilot.mmc - pilot.lmc + pilot.tol);
  return { pin, pinMax: pin + gtPin, ring, ringMin: ring - gtRing, gtPin, gtRing };
}
