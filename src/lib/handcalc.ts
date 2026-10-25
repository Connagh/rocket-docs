// Hand calcs: the closed-form checks a mechanical designer makes before a finite-element model, and uses to check it —
// beam bending and deflection, flat plates, thin shells and their edge zones, lugs and pins, and columns.
// Linear elastic, small deflection. Units: N, mm, MPa (N/mm²), N·mm.

// ---------- Sections ----------

export type SectionKind = 'rect' | 'round' | 'tube' | 'rhs';

export interface Section {
  A: number; // area
  I: number; // second moment of area about the bending axis
  c: number; // extreme fibre distance
  Z: number; // elastic section modulus I/c
  Q: number; // first moment of the area above the neutral axis
  b: number; // width at the neutral axis, for VQ/(Ib)
  r: number; // radius of gyration
}

/**
 * Section properties. rect: width, depth. round: diameter. tube: outside diameter, wall. rhs (rectangular hollow):
 * width, depth, wall. Bending about the axis across the depth. Returns null if the dimensions do not make a section.
 */
export function section(kind: SectionKind, d1: number, d2 = 0, d3 = 0): Section | null {
  let A: number, I: number, c: number, Q: number, b: number;
  if (kind === 'rect') {
    if (!(d1 > 0 && d2 > 0)) return null;
    A = d1 * d2; I = (d1 * d2 ** 3) / 12; c = d2 / 2; Q = (d1 * d2 ** 2) / 8; b = d1;
  } else if (kind === 'round') {
    if (!(d1 > 0)) return null;
    A = (Math.PI * d1 ** 2) / 4; I = (Math.PI * d1 ** 4) / 64; c = d1 / 2; Q = d1 ** 3 / 12; b = d1;
  } else if (kind === 'tube') {
    const di = d1 - 2 * d2;
    if (!(d1 > 0 && d2 > 0 && di >= 0)) return null;
    A = (Math.PI * (d1 ** 2 - di ** 2)) / 4; I = (Math.PI * (d1 ** 4 - di ** 4)) / 64; c = d1 / 2; Q = (d1 ** 3 - di ** 3) / 12; b = 2 * d2;
  } else {
    const bi = d1 - 2 * d3, hi = d2 - 2 * d3;
    if (!(d1 > 0 && d2 > 0 && d3 > 0 && bi >= 0 && hi >= 0)) return null;
    A = d1 * d2 - bi * hi; I = (d1 * d2 ** 3 - bi * hi ** 3) / 12; c = d2 / 2; Q = (d1 * d2 ** 2 - bi * hi ** 2) / 8; b = 2 * d3;
  }
  return { A, I, c, Z: I / c, Q, b, r: Math.sqrt(I / A) };
}

/** Peak shear stress at the neutral axis, VQ/(Ib). */
export const shearStress = (V: number, s: Section) => (V * s.Q) / (s.I * s.b);

// ---------- Beams ----------

export const BEAM_CASES = [
  { key: 'cant-point', name: 'Cantilever, end load' },
  { key: 'cant-udl', name: 'Cantilever, uniform load' },
  { key: 'ss-point', name: 'Simply supported, central load' },
  { key: 'ss-udl', name: 'Simply supported, uniform load' },
  { key: 'ff-point', name: 'Fixed both ends, central load' },
  { key: 'ff-udl', name: 'Fixed both ends, uniform load' },
] as const;
export type BeamCase = (typeof BEAM_CASES)[number]['key'];

/**
 * A prismatic beam of span L and stiffness EI under a load W — a point load, or the total of a uniform load. Returns
 * the peak bending moment, shear force and deflection, and the moment (sagging positive) and deflection (in the load's
 * direction) along the span, with x from the left support or the cantilever's root.
 */
export function beam(kind: BeamCase, W: number, L: number, EI: number) {
  const q = W / L, half = (x: number) => (x <= L / 2 ? x : L - x);
  switch (kind) {
    case 'cant-point':
      return { M: W * L, V: W, delta: (W * L ** 3) / (3 * EI), Mx: (x: number) => -W * (L - x), wx: (x: number) => (W * x * x * (3 * L - x)) / (6 * EI) };
    case 'cant-udl':
      return { M: (W * L) / 2, V: W, delta: (W * L ** 3) / (8 * EI), Mx: (x: number) => (-q * (L - x) ** 2) / 2, wx: (x: number) => (q * x * x * (6 * L * L - 4 * L * x + x * x)) / (24 * EI) };
    case 'ss-point':
      return { M: (W * L) / 4, V: W / 2, delta: (W * L ** 3) / (48 * EI), Mx: (x: number) => (W * half(x)) / 2, wx: (x: number) => (W * half(x) * (3 * L * L - 4 * half(x) ** 2)) / (48 * EI) };
    case 'ss-udl':
      return { M: (W * L) / 8, V: W / 2, delta: (5 * W * L ** 3) / (384 * EI), Mx: (x: number) => (q * x * (L - x)) / 2, wx: (x: number) => (q * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * EI) };
    case 'ff-point':
      return { M: (W * L) / 8, V: W / 2, delta: (W * L ** 3) / (192 * EI), Mx: (x: number) => (W * (4 * half(x) - L)) / 8, wx: (x: number) => (W * half(x) ** 2 * (3 * L - 4 * half(x))) / (48 * EI) };
    case 'ff-udl':
      return { M: (W * L) / 12, V: W / 2, delta: (W * L ** 3) / (384 * EI), Mx: (x: number) => (q * (6 * L * x - 6 * x * x - L * L)) / 12, wx: (x: number) => (q * x * x * (L - x) ** 2) / (24 * EI) };
  }
}

// ---------- Flat plates ----------

export const flexuralRigidity = (E: number, t: number, nu: number) => (E * t ** 3) / (12 * (1 - nu * nu));

/**
 * Solid circular plate of radius a under uniform pressure q, edge simply supported or clamped (Roark). Peak stress and
 * where it is, centre deflection, edge slope, and the radial and tangential surface stresses at radius r.
 */
export function circularPlate(edge: 'ss' | 'clamped', q: number, a: number, t: number, E: number, nu: number) {
  const D = flexuralRigidity(E, t, nu), s = (M: number) => (6 * M) / (t * t);
  if (edge === 'ss') {
    return {
      D, sigma: (3 * (3 + nu) * q * a * a) / (8 * t * t), where: 'centre',
      w: ((5 + nu) * q * a ** 4) / (64 * (1 + nu) * D), slope: (q * a ** 3) / (8 * D * (1 + nu)),
      sr: (r: number) => s((q * (3 + nu) * (a * a - r * r)) / 16),
      st: (r: number) => s((q * ((3 + nu) * a * a - (1 + 3 * nu) * r * r)) / 16),
    };
  }
  return {
    D, sigma: (3 * q * a * a) / (4 * t * t), where: 'edge',
    w: (q * a ** 4) / (64 * D), slope: 0,
    sr: (r: number) => s((q * ((1 + nu) * a * a - (3 + nu) * r * r)) / 16),
    st: (r: number) => s((q * ((1 + nu) * a * a - (1 + 3 * nu) * r * r)) / 16),
  };
}

// Rectangular plates under uniform pressure, all edges simply supported or all clamped: σ = β·q·b²/t² and
// w = α·q·b⁴/(E·t³), with b the short side (Roark; Timoshenko's coefficients, ν = 0.3). Tabulated against b/a.
const RECT = {
  ss: { s: [1, 1 / 1.2, 1 / 1.4, 1 / 1.6, 1 / 1.8, 0.5, 1 / 3, 0.25, 0.2, 0], beta: [0.2874, 0.3762, 0.453, 0.5172, 0.5688, 0.6102, 0.7134, 0.741, 0.7476, 0.75], alpha: [0.0444, 0.0616, 0.077, 0.0906, 0.1017, 0.111, 0.1335, 0.14, 0.1417, 0.1421] },
  clamped: { s: [1, 1 / 1.2, 1 / 1.4, 1 / 1.6, 1 / 1.8, 0.5, 0], beta: [0.3078, 0.3834, 0.4356, 0.468, 0.4872, 0.4974, 0.5], alpha: [0.0138, 0.0188, 0.0226, 0.0251, 0.0267, 0.0277, 0.0284] },
};

/** Coefficients β and α for a rectangular plate with sides a and b (either order), interpolated linearly in b/a. */
export function rectCoefficients(edge: 'ss' | 'clamped', a: number, b: number) {
  const T = RECT[edge], s = Math.min(a, b) / Math.max(a, b);
  let i = 0;
  while (i < T.s.length - 2 && s < T.s[i + 1]) i++;
  const f = (T.s[i] - s) / (T.s[i] - T.s[i + 1]);
  return { beta: T.beta[i] + f * (T.beta[i + 1] - T.beta[i]), alpha: T.alpha[i] + f * (T.alpha[i + 1] - T.alpha[i]), ratio: 1 / s };
}

/** Rectangular plate under uniform pressure: peak stress (centre if simply supported, mid long edge if clamped). */
export function rectPlate(edge: 'ss' | 'clamped', q: number, a: number, b: number, t: number, E: number) {
  const k = rectCoefficients(edge, a, b), s = Math.min(a, b);
  return { ...k, sigma: (k.beta * q * s * s) / (t * t), w: (k.alpha * q * s ** 4) / (E * t ** 3), where: edge === 'ss' ? 'centre' : 'middle of the long edge' };
}

// ---------- Thin shells ----------

/**
 * A thin cylinder of mean radius r and wall t under internal pressure p: membrane stresses, radial growth, and the edge
 * zone where a radially rigid, clamped end (a stiff flange or closure) forces it to bend. `closed` adds the end load.
 */
export function shell(p: number, r: number, t: number, E: number, nu: number, closed = true) {
  const hoop = (p * r) / t, axial = closed ? (p * r) / (2 * t) : 0, sphere = (p * r) / (2 * t);
  const growth = ((p * r * r) / (E * t)) * (1 - (closed ? nu / 2 : 0));
  const sqrtRT = Math.sqrt(r * t), beta = (3 * (1 - nu * nu)) ** 0.25 / sqrtRT;
  const edgeBend = ((E * growth) / r) * Math.sqrt(3 / (1 - nu * nu));
  const decay = (x: number) => Math.exp(-beta * x);
  return {
    hoop, axial, sphere, growth, sqrtRT, beta, decayLength: Math.PI / beta, edgeBend,
    peakAxial: axial + edgeBend, vm: Math.sqrt(hoop * hoop - hoop * axial + axial * axial), thick: r / t < 10,
    // along the shell from a clamped edge: hoop membrane stress and the axial stress at the inner and outer surfaces
    hoopAt: (x: number) => ((E * growth) / r) * (1 - decay(x) * (Math.cos(beta * x) + Math.sin(beta * x))) + nu * axial,
    innerAt: (x: number) => axial + edgeBend * decay(x) * (Math.cos(beta * x) - Math.sin(beta * x)),
    outerAt: (x: number) => axial - edgeBend * decay(x) * (Math.cos(beta * x) - Math.sin(beta * x)),
  };
}

// ---------- Lugs and pins ----------

export interface LugInput {
  P: number; // load along the lug's axis
  t: number; W: number; e: number; D: number; // lug thickness, width, hole centre to end, hole diameter
  d: number; t2: number; g: number; // pin diameter, each clevis plate's thickness, gap between lug and clevis
  Ftu: number; Fsu: number; Fbru: number; // lug allowables
  pinFtu: number; pinFsu: number; // pin allowables
}

/**
 * First-cut checks of a lug in a double-shear clevis under axial load: net tension across the hole, shear-out of the
 * end on two planes, bearing on the hole, pin double shear, and pin bending with the lug's load spread over its
 * thickness and the clevis reactions at the plates' mid-thickness. Each as stress and allowable.
 */
export function lugChecks(L: LugInput) {
  const M = (L.P / 2) * (L.t / 4 + L.g + L.t2 / 2);
  return [
    { key: 'net', name: 'Net tension', stress: L.P / ((L.W - L.D) * L.t), allow: L.Ftu },
    { key: 'shear', name: 'Shear-out', stress: L.P / (2 * (L.e - L.D / 2) * L.t), allow: L.Fsu },
    { key: 'bear', name: 'Bearing', stress: L.P / (L.d * L.t), allow: L.Fbru },
    { key: 'pinS', name: 'Pin shear', stress: L.P / (2 * ((Math.PI * L.d * L.d) / 4)), allow: L.pinFsu },
    { key: 'pinB', name: 'Pin bending', stress: (32 * M) / (Math.PI * L.d ** 3), allow: L.pinFtu },
  ];
}

// ---------- Columns ----------

/**
 * Buckling of a straight column of effective length K·L: Euler above the transition slenderness π√(2E/Fty), the
 * Johnson parabola below it, where the column yields as it buckles.
 */
export function column(s: Section, L: number, K: number, E: number, Fty: number) {
  const slender = (K * L) / s.r, transition = Math.PI * Math.sqrt((2 * E) / Fty);
  const euler = (Math.PI ** 2 * E) / slender ** 2, johnson = Fty - (Fty ** 2 / (4 * Math.PI ** 2 * E)) * slender ** 2;
  const sigmaCr = slender >= transition ? euler : johnson;
  return { slender, transition, euler, johnson, sigmaCr, Pcr: sigmaCr * s.A, PcrEuler: euler * s.A, mode: slender >= transition ? 'Euler' : 'Johnson' };
}

/** Peak stress in a column loaded with eccentricity e (secant formula); Infinity at or beyond the Euler load. */
export function secantStress(P: number, s: Section, L: number, K: number, E: number, e: number) {
  const arg = ((K * L) / (2 * s.r)) * Math.sqrt(P / (E * s.A));
  if (arg >= Math.PI / 2) return Infinity;
  return (P / s.A) * (1 + ((e * s.c) / (s.r * s.r)) / Math.cos(arg));
}
