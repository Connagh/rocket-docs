// Checking a finite-element model: a small real model to demonstrate on (a thin cylinder clamped at a stiff edge, as a
// beam on an elastic foundation with cubic elements), mesh convergence by Richardson extrapolation and the grid
// convergence index, the strength of corner singularities, weld hot-spot extrapolation, and strain-gauge rosettes.
// Units: N, mm, MPa.

// ---------- A small finite-element model: the clamped edge of a pressurised cylinder ----------

/** Solve a symmetric dense system in place by Gaussian elimination (small models only). */
function solve(K: number[][], f: number[]) {
  const n = f.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(K[r][i]) > Math.abs(K[p][i])) p = r;
    [K[i], K[p]] = [K[p], K[i]]; [f[i], f[p]] = [f[p], f[i]];
    for (let r = i + 1; r < n; r++) {
      const m = K[r][i] / K[i][i];
      if (m === 0) continue;
      for (let c = i; c < n; c++) K[r][c] -= m * K[i][c];
      f[r] -= m * f[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = f[i]; for (let c = i + 1; c < n; c++) s -= K[i][c] * x[c]; x[i] = s / K[i][i]; }
  return x;
}

/**
 * The wall of a thin closed-end cylinder (mean radius r, wall t) under internal pressure p, clamped at x = 0 by a
 * radially rigid flange, modelled over a length L with n two-node cubic (Hermite) beam elements on an elastic
 * foundation: D·w'''' + (Et/r²)·w = p(1 − ν/2). Returns the deflection at the nodes, the bending moment at each
 * element's ends, and the peak axial surface stress at the clamped edge, pr/2t + 6M/t².
 */
export function edgeModel(p: number, r: number, t: number, E: number, nu: number, L: number, n: number) {
  const D = (E * t ** 3) / (12 * (1 - nu * nu)), k = (E * t) / (r * r), q = p * (1 - nu / 2), h = L / n;
  const N = 2 * (n + 1), K = Array.from({ length: N }, () => new Array(N).fill(0)), f = new Array(N).fill(0);
  const kb = [[12, 6 * h, -12, 6 * h], [6 * h, 4 * h * h, -6 * h, 2 * h * h], [-12, -6 * h, 12, -6 * h], [6 * h, 2 * h * h, -6 * h, 4 * h * h]].map((row) => row.map((v) => (v * D) / h ** 3));
  const kf = [[156, 22 * h, 54, -13 * h], [22 * h, 4 * h * h, 13 * h, -3 * h * h], [54, 13 * h, 156, -22 * h], [-13 * h, -3 * h * h, -22 * h, 4 * h * h]].map((row) => row.map((v) => (v * k * h) / 420));
  const fe = [6, h, 6, -h].map((v) => (v * q * h) / 12);
  for (let e = 0; e < n; e++) {
    const dof = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let a = 0; a < 4; a++) { f[dof[a]] += fe[a]; for (let b = 0; b < 4; b++) K[dof[a]][dof[b]] += kb[a][b] + kf[a][b]; }
  }
  // clamped at x = 0 (w = θ = 0); symmetry at x = L (θ = 0): impose by penalty-free elimination — zero rows and columns
  for (const d of [0, 1, N - 1]) { for (let j = 0; j < N; j++) { K[d][j] = 0; K[j][d] = 0; } K[d][d] = 1; f[d] = 0; }
  const u = solve(K, f);
  const w = Array.from({ length: n + 1 }, (_, i) => u[2 * i]), th = Array.from({ length: n + 1 }, (_, i) => u[2 * i + 1]);
  // bending moment −D·w'' from each element's shape functions, at its two ends
  const curv = (e: number, xi: number) => {
    const [w1, t1, w2, t2] = [w[e], th[e], w[e + 1], th[e + 1]];
    return ((-6 + 12 * xi) * w1 + h * (-4 + 6 * xi) * t1 + (6 - 12 * xi) * w2 + h * (-2 + 6 * xi) * t2) / (h * h);
  };
  const M0 = -D * curv(0, 0);
  return { h, D, k, q, w, theta: th, M0, Mends: Array.from({ length: n }, (_, e) => [-D * curv(e, 0), -D * curv(e, 1)]), sigmaEdge: (p * r) / (2 * t) + (6 * Math.abs(M0)) / (t * t) };
}

/** The exact edge stress for the same problem (a long cylinder): pr/2t + (E·w/r)·√(3/(1 − ν²)). */
export function edgeExact(p: number, r: number, t: number, E: number, nu: number) {
  const w = ((p * r * r) / (E * t)) * (1 - nu / 2);
  return (p * r) / (2 * t) + ((E * w) / r) * Math.sqrt(3 / (1 - nu * nu));
}

// ---------- Mesh convergence ----------

/**
 * Richardson extrapolation and the grid convergence index from three meshes (Celik et al., 2008): f1 on the finest
 * mesh (element size h1), f3 on the coarsest. Works for any refinement ratios. `kind` is monotonic, oscillatory or
 * divergent; the order, extrapolated value and GCI mean something only when it is monotonic.
 */
export function richardson(f1: number, f2: number, f3: number, h1: number, h2: number, h3: number) {
  const r21 = h2 / h1, r32 = h3 / h2, e21 = f2 - f1, e32 = f3 - f2;
  const R = e32 === 0 ? (e21 === 0 ? 0 : Infinity) : e21 / e32;
  const kind = e21 === 0 && e32 === 0 ? 'converged' : R > 0 && R < 1 ? 'monotonic' : R < 0 ? 'oscillatory' : 'divergent';
  let p = NaN, ext = NaN, gci = NaN, gci32 = NaN;
  if (kind === 'monotonic') {
    const s = Math.sign(e32 / e21);
    p = Math.abs(Math.log(Math.abs(e32 / e21))) / Math.log(r21);
    for (let i = 0; i < 50; i++) {
      const q = Math.log((r21 ** p - s) / (r32 ** p - s));
      p = Math.abs(Math.log(Math.abs(e32 / e21)) + q) / Math.log(r21);
    }
    ext = (r21 ** p * f1 - f2) / (r21 ** p - 1);
    gci = (1.25 * Math.abs(e21 / f1)) / (r21 ** p - 1);
    gci32 = (1.25 * Math.abs(e32 / f2)) / (r32 ** p - 1);
  }
  return { r21, r32, R, kind, p, ext, gci, asymptotic: gci32 / (r21 ** p * gci) };
}

// ---------- Singularities ----------

/**
 * Williams' exponent for the symmetric (opening) mode at the tip of a wedge of material with free faces and interior
 * angle `angleDeg` (270° for a sharp 90° internal corner, 360° for a crack): stress grows as r^(λ − 1). Returns λ, or 1
 * if the corner is not singular (interior angle up to 180°).
 */
export function williamsLambda(angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  if (a <= Math.PI + 1e-9) return 1;
  const g = (l: number) => l * Math.sin(a) + Math.sin(l * a);
  let lo = 0.5 - 1e-9, hi = 1 - 1e-9;
  if (g(lo) * g(hi) > 0) { lo = 1e-6; }
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (g(lo) * g(m) <= 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

/** IIW structural hot-spot stress from surface stresses 0.4t and 1.0t from a weld toe (fine mesh). */
export const hotSpot = (s04: number, s10: number) => 1.67 * s04 - 0.67 * s10;

// ---------- Strain-gauge rosettes ----------

/**
 * A rectangular rosette: gauges a, b, c at 0°, 45° and 90° (microstrain). Principal strains and stresses (plane
 * stress), and the angle of the first principal direction from gauge a, counter-clockwise.
 */
export function rosette(ea: number, eb: number, ec: number, E: number, nu: number) {
  const mean = (ea + ec) / 2, rad = Math.sqrt((ea - eb) ** 2 + (eb - ec) ** 2) / Math.SQRT2;
  const e1 = mean + rad, e2 = mean - rad;
  const theta = (0.5 * Math.atan2(2 * eb - ea - ec, ea - ec) * 180) / Math.PI;
  const k = E / (1 - nu * nu) / 1e6;
  const s1 = k * (e1 + nu * e2), s2 = k * (e2 + nu * e1);
  return { e1, e2, theta, s1, s2, vm: Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2) };
}
