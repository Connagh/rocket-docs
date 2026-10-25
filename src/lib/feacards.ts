// Material cards for finite-element models: unit consistency, isotropic and orthotropic elastic constants, nearly
// incompressible materials (rubber, propellant), a true-stress plastic table built from tensile properties, and secant
// thermal expansion from instantaneous data. Each function returns what the card implies, so it can be checked.

// ---------- Units ----------

/** Consistent unit systems: how a card's stress and density convert to MPa and kg/m³. */
export const UNIT_SYSTEMS = [
  { key: 'mm-t', name: 'mm, N, t, s', stress: 'MPa', density: 't/mm³', toMPa: 1, toKgM3: 1e12 },
  { key: 'm-kg', name: 'm, N, kg, s', stress: 'Pa', density: 'kg/m³', toMPa: 1e-6, toKgM3: 1 },
  { key: 'mm-kg-ms', name: 'mm, kN, kg, ms', stress: 'GPa', density: 'kg/mm³', toMPa: 1000, toKgM3: 1e9 },
  { key: 'in-lbf', name: 'in, lbf, lbf·s²/in, s', stress: 'psi', density: 'lbf·s²/in⁴', toMPa: 0.00689476, toKgM3: 1.0687e7 },
] as const;
export type UnitKey = (typeof UNIT_SYSTEMS)[number]['key'];

/**
 * What a card's modulus and density mean in a given unit system: SI values and the bar wave speed √(E/ρ), which for
 * any metal is a few thousand m/s — a quick test that the density is in the system's units.
 */
export function cardUnits(units: UnitKey, E: number, rho: number) {
  const u = UNIT_SYSTEMS.find((s) => s.key === units)!;
  const EMPa = E * u.toMPa, rhoSI = rho * u.toKgM3;
  return { EMPa, rhoSI, wave: Math.sqrt((EMPa * 1e6) / rhoSI), densityPlausible: rhoSI >= 10 && rhoSI <= 25000 };
}

// ---------- Isotropic elastic ----------

export const shearModulus = (E: number, nu: number) => E / (2 * (1 + nu));
export const bulkModulus = (E: number, nu: number) => E / (3 * (1 - 2 * nu));
/** Poisson's ratio implied by Young's and shear moduli — the check on a card that gives all three. */
export const poissonFromEG = (E: number, G: number) => E / (2 * G) - 1;
/** Poisson's ratio from Young's and bulk moduli: how to set ν for a nearly incompressible material. */
export const poissonFromEK = (E: number, K: number) => (3 * K - E) / (6 * K);
/** Neo-Hookean constants for shear modulus G and bulk modulus K, in the C10 and D1 form many codes use. */
export const neoHookean = (G: number, K: number) => ({ C10: G / 2, D1: 2 / K });

// ---------- Orthotropic elastic ----------

export interface Ortho { E1: number; E2: number; E3: number; n12: number; n13: number; n23: number; G12: number; G13: number; G23: number }

/**
 * Checks on orthotropic engineering constants (major Poisson's ratios νij, strain in j from stress in i): the minor
 * ratios from symmetry, the bounds |νij| < √(Ei/Ej), and the determinant that must be positive for the stiffness to be
 * positive-definite. For a transversely isotropic ply (E2 = E3) it also gives the G23 that isotropy in the 2–3 plane
 * requires.
 */
export function orthotropic(c: Ortho) {
  const n21 = (c.n12 * c.E2) / c.E1, n31 = (c.n13 * c.E3) / c.E1, n32 = (c.n23 * c.E3) / c.E2;
  const det = 1 - c.n12 * n21 - c.n23 * n32 - c.n13 * n31 - 2 * n21 * n32 * c.n13;
  const bounds = [
    { name: 'ν12', v: Math.abs(c.n12), max: Math.sqrt(c.E1 / c.E2) },
    { name: 'ν13', v: Math.abs(c.n13), max: Math.sqrt(c.E1 / c.E3) },
    { name: 'ν23', v: Math.abs(c.n23), max: Math.sqrt(c.E2 / c.E3) },
  ];
  const positive = [c.E1, c.E2, c.E3, c.G12, c.G13, c.G23].every((x) => x > 0);
  const transverse = Math.abs(c.E2 - c.E3) <= 1e-6 * c.E2;
  return {
    n21, n31, n32, det, bounds, positive,
    stable: positive && det > 0 && bounds.every((b) => b.v < b.max),
    G23iso: transverse ? c.E2 / (2 * (1 + c.n23)) : NaN,
  };
}

// ---------- Plastic table ----------

/**
 * A true-stress / true-plastic-strain table for a metal from its tensile properties: a Ramberg–Osgood curve through the
 * 0.2% yield and through the ultimate at the uniform elongation eu (engineering), converted to true values up to the
 * onset of necking. The first row is the proportional limit, where the fitted plastic strain is 0.01%, entered at zero
 * plastic strain as solvers require.
 */
export function plasticTable(E: number, Fty: number, Ftu: number, eu: number, rows = 8) {
  const epu = eu - Ftu / E; // engineering plastic strain at the ultimate
  if (!(Ftu > Fty && epu > 0.002)) return null;
  const n = Math.log(epu / 0.002) / Math.log(Ftu / Fty);
  const ep0 = 1e-4;
  const table = Array.from({ length: rows }, (_, k) => {
    const ep = ep0 * (epu / ep0) ** (k / (rows - 1)); // geometric spacing in plastic strain
    const s = Fty * (ep / 0.002) ** (1 / n), e = s / E + ep;
    const st = s * (1 + e), et = Math.log(1 + e);
    return { eng: s, engStrain: e, trueStress: st, truePlastic: k === 0 ? 0 : et - st / E };
  });
  return { n, epu, table, propLimit: table[0].eng };
}

/** Engineering stress at a total engineering strain on the same fitted curve (for plotting), by bisection. */
export function rambergOsgoodStress(E: number, Fty: number, n: number, e: number) {
  let lo = 0, hi = Math.max(E * e, Fty * 3);
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (m / E + 0.002 * (m / Fty) ** n < e) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ---------- Thermal expansion ----------

/**
 * Thermal expansion from instantaneous coefficients, taken as linear in temperature between (T1, a1) and (T2, a2).
 * Solvers want secant (mean) coefficients from a stated reference temperature; this converts, and gives the thermal
 * strain between the model's stress-free temperature T0 and any temperature T.
 */
export function expansion(T1: number, a1: number, T2: number, a2: number) {
  const inst = (T: number) => a1 + ((a2 - a1) * (T - T1)) / (T2 - T1);
  const strain = (T0: number, T: number) => ((inst(T0) + inst(T)) / 2) * (T - T0); // ∫ α dT, exact for linear α
  const secant = (Tref: number, T: number) => (Math.abs(T - Tref) < 1e-9 ? inst(Tref) : strain(Tref, T) / (T - Tref));
  return { inst, strain, secant };
}

/** Re-reference a secant coefficient from data reference Tref to the model's stress-free temperature T0. */
export const rereference = (aSec: (T: number) => number, Tref: number, T0: number, T: number) =>
  (aSec(T) * (T - Tref) - aSec(T0) * (T0 - Tref)) / (T - T0);
