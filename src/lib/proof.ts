// Proof testing: flaw screening by proof (LEFM), crack-growth life after proof,
// stored energy of the test medium, and hydrostatic test acceptance helpers.
// Units: MPa, mm, MPa·√m, litres / m³ where stated. Shown on /verify/proof-testing/.

// ---------------------------------------------------------------------------
// Flaw screening
// ---------------------------------------------------------------------------

/** Stress intensity K = Y·σ·√(πa), with a in mm. MPa·√m. */
export const stressIntensity = (sigma: number, aMm: number, Y: number) => Y * sigma * Math.sqrt(Math.PI * aMm / 1000);

/** Crack depth (mm) at which K reaches the given toughness: a = (1/π)(K/(Yσ))². */
export const criticalDepth = (k: number, sigma: number, Y: number) => (1 / Math.PI) * (k / (Y * sigma)) ** 2 * 1000;

/** Paris-law classes. C in m/cycle with ΔK in MPa·√m. Steels from Barsom & Rolfe; Al and Ti class-typical. */
export const PARIS_CLASSES = [
  { key: 'mart', name: 'Martensitic steels (D6AC, maraging, 4340)', C: 1.35e-10, m: 2.25, src: 'Barsom & Rolfe upper bound' },
  { key: 'fp', name: 'Ferrite–pearlite steels', C: 6.9e-12, m: 3.0, src: 'Barsom & Rolfe upper bound' },
  { key: 'aus', name: 'Austenitic stainless steels', C: 5.6e-12, m: 3.25, src: 'Barsom & Rolfe upper bound' },
  { key: 'al', name: 'Aluminium alloys', C: 1.6e-11, m: 3.2, src: 'class-typical, indicative' },
  { key: 'ti', name: 'Titanium alloys', C: 1.0e-11, m: 3.5, src: 'class-typical, indicative' },
] as const;

/**
 * Cycles to grow a crack from a0 to a1 (mm) under stress range dSigma with constant Y,
 * closed-form integral of da/dN = C·ΔKᵐ.
 */
export function parisCycles(a0Mm: number, a1Mm: number, C: number, m: number, Y: number, dSigma: number) {
  if (!(a1Mm > a0Mm) || !(dSigma > 0)) return 0;
  const a0 = a0Mm / 1000, a1 = a1Mm / 1000;
  const k = C * Math.pow(Y * dSigma * Math.sqrt(Math.PI), m);
  if (Math.abs(m - 2) < 1e-9) return Math.log(a1 / a0) / k;
  const e = 1 - m / 2;
  return (Math.pow(a1, e) - Math.pow(a0, e)) / (k * e);
}

export interface ScreenInputs {
  sigmaOp: number; // stress at MEOP, MPa
  proofFactor: number; // proof pressure / MEOP
  Y: number; // geometry factor
  kProof: number; // toughness at the proof-test temperature, MPa·√m
  kService: number; // toughness at the worst service temperature, MPa·√m
  wall: number; // mm
  yieldStrength: number; // MPa
  C: number; m: number; // Paris constants
  rangeFraction: number; // stress range per service cycle as a fraction of σop (1 = zero to MEOP)
  serviceCycles: number; // pressurisations the part must survive after proof
  lifeFactor: number; // required ratio of analysed life to service life
  ndtDepth: number; // reliably detectable crack depth, mm
}

export function proofScreen(i: ScreenInputs) {
  const sigmaProof = i.sigmaOp * i.proofFactor;
  const aScreen = criticalDepth(i.kProof, sigmaProof, i.Y); // largest flaw that can survive proof
  const aCrit = criticalDepth(i.kService, i.sigmaOp, i.Y); // flaw that fails at MEOP in service
  const ratio = aCrit / aScreen; // = R² (kS/kP)²
  // Initial flaw for the life argument: the smaller of what proof and NDT can guarantee.
  const aInit = Math.min(aScreen, i.ndtDepth > 0 ? i.ndtDepth : Infinity);
  const cycles = aCrit > aInit ? parisCycles(aInit, aCrit, i.C, i.m, i.Y, i.sigmaOp * i.rangeFraction) : 0;
  const cyclesFromProof = aCrit > aScreen ? parisCycles(aScreen, aCrit, i.C, i.m, i.Y, i.sigmaOp * i.rangeFraction) : 0;
  const required = i.serviceCycles * i.lifeFactor;
  return {
    sigmaProof,
    proofToYield: sigmaProof / i.yieldStrength,
    aScreen, aCrit, ratio,
    screenWorks: aCrit > aScreen,
    aInit,
    governsInitial: aInit === aScreen ? 'proof' : 'NDT',
    cycles, cyclesFromProof, required,
    lifeMargin: required > 0 ? cycles / required : Infinity,
    deepCrack: aCrit / i.wall, // a/t at critical — LEFM with constant Y becomes unreliable when large
  };
}

// ---------------------------------------------------------------------------
// Test rig: vessel compliance, stored energy, hydrostatic hold drift
// ---------------------------------------------------------------------------

/** Volumetric compliance (1/V)·dV/dp of a thin closed cylinder, 1/MPa: (r/Et)(5/2 − 2ν). */
export const vesselCompliance = (rMm: number, tMm: number, E: number, nu: number) => (rMm / (E * tMm)) * (2.5 - 2 * nu);

export const MEDIA = [
  { key: 'water', name: 'Water (inhibited)', kind: 'liquid', bulk: 2200, beta: 2.1e-4 },
  { key: 'oil', name: 'Hydraulic oil', kind: 'liquid', bulk: 1500, beta: 7.0e-4 },
  { key: 'n2', name: 'Nitrogen', kind: 'gas', gamma: 1.4 },
  { key: 'he', name: 'Helium', kind: 'gas', gamma: 1.66 },
] as const;
export type Medium = (typeof MEDIA)[number];

export const TNT_J_PER_KG = 4.184e6;
const PATM = 0.101325; // MPa

/** Energy stored by compressing a liquid of bulk modulus K (MPa) to gauge pressure p: p²V/(2K). J. */
export const liquidEnergy = (pMPa: number, volumeL: number, bulkMPa: number) => ((pMPa * 1e6) ** 2 * volumeL * 1e-3) / (2 * bulkMPa * 1e6);

/** Energy released by isentropic expansion of a gas from absolute p to atmosphere. J. */
export function gasEnergy(pGaugeMPa: number, volumeL: number, gamma: number) {
  const p = pGaugeMPa + PATM;
  return ((p * 1e6 * volumeL * 1e-3) / (gamma - 1)) * (1 - Math.pow(PATM / p, (gamma - 1) / gamma));
}

/** Elastic strain energy in the vessel wall: ½·p·ΔV = ½·p²·V·C. J. */
export const vesselEnergy = (pMPa: number, volumeL: number, complianceMPa: number) => 0.5 * (pMPa * 1e6) ** 2 * volumeL * 1e-3 * (complianceMPa / 1e6);

export function storedEnergy(pMPa: number, volumeL: number, complianceMPa: number, medium: Medium, trappedGasFraction = 0) {
  const wall = vesselEnergy(pMPa, volumeL, complianceMPa);
  let fluid: number;
  if (medium.kind === 'liquid') {
    fluid = liquidEnergy(pMPa, volumeL * (1 - trappedGasFraction), medium.bulk);
    // a trapped gas pocket is compressed from atmosphere — model it as nitrogen-like air
    if (trappedGasFraction > 0) fluid += gasEnergy(pMPa, volumeL * trappedGasFraction * (PATM / (pMPa + PATM)), 1.4);
  } else fluid = gasEnergy(pMPa, volumeL, medium.gamma);
  const total = fluid + wall;
  return { fluid, wall, total, tnt: total / TNT_J_PER_KG };
}

/**
 * Hydrostatic hold: pressure change per kelvin of liquid temperature change in a closed,
 * liquid-full vessel, MPa/K: (β_liquid − 3α_vessel) / (1/K + C).
 */
export const holdDrift = (betaLiquid: number, alphaVessel: number, bulkMPa: number, complianceMPa: number) =>
  (betaLiquid - 3 * alphaVessel) / (1 / bulkMPa + complianceMPa);

/** Elastic volume increase of the vessel at pressure, and the liquid volume that must be pumped in. Litres. */
export function expansion(pMPa: number, volumeL: number, complianceMPa: number, bulkMPa: number) {
  const vessel = volumeL * complianceMPa * pMPa;
  return { vessel, pumpIn: vessel + (volumeL * pMPa) / bulkMPa };
}
