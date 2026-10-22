// Pressure-vessel / motor-case screening calculations.
// Pure functions, SI-ish engineering units: MPa, mm, kg, MPa·√m.
// Every formula here is shown, with its derivation, on /motor/case-sizing/.

export type DomeType = 'hemi' | 'ellip2';

export interface CaseMaterial {
  uts: number; // MPa
  yield: number; // MPa
  density: number; // g/cm³
  kic?: number; // MPa·√m
}

export interface CaseInputs {
  idMm: number; // internal diameter
  meop: number; // MPa
  proofFactor: number; // proof pressure / MEOP
  burstFactor: number; // design burst pressure / MEOP
  weldEff: number; // joint efficiency, 0–1
  lengthMm: number; // cylindrical length
  dome: DomeType;
  material: CaseMaterial;
  /** Optional as-designed wall to check instead of the minimum required. */
  tMm?: number;
}

/** Thin-wall hoop stress using the inner radius (conservative vs mean radius). */
export const hoopThin = (p: number, ri: number, t: number) => (p * ri) / t;

/** Thin-wall wall thickness for a hoop stress limit. */
export const tThin = (p: number, ri: number, sigma: number) => (p * ri) / sigma;

/** Lamé hoop stress at the bore of an open/closed thick cylinder. */
export const hoopLame = (p: number, ri: number, ro: number) =>
  (p * (ro * ro + ri * ri)) / (ro * ro - ri * ri);

/** Lamé wall thickness so the bore hoop stress equals sigma. Infinity if p ≥ sigma. */
export function tLame(p: number, ri: number, sigma: number) {
  if (p >= sigma) return Infinity;
  return ri * Math.sqrt((sigma + p) / (sigma - p)) - ri;
}

/** Burst pressure from Lamé with bore hoop stress = sigma. */
export const pLame = (sigma: number, ri: number, ro: number) =>
  (sigma * (ro * ro - ri * ri)) / (ro * ro + ri * ri);

/**
 * Irwin leak-before-break check. A through-crack of half-length equal to the
 * wall (2c = 2t, the crack that has just broken through) is stable if
 * K = σ√(πc) < K_IC, i.e. if the critical half-length (1/π)(K_IC/σ)² ≥ t.
 * Returns the critical half-length in mm.
 */
export const criticalCrackMm = (kic: number, sigma: number) =>
  (1 / Math.PI) * (kic / sigma) ** 2 * 1000;

export const marginOfSafety = (allowable: number, applied: number) => allowable / applied - 1;

export function sizeCase(i: CaseInputs) {
  const ri = i.idMm / 2;
  const m = i.material;
  const sUlt = m.uts * i.weldEff;
  const sYld = m.yield * i.weldEff;
  const pProof = i.meop * i.proofFactor;
  const pBurst = i.meop * i.burstFactor;

  // Two requirements: no yield at proof, no rupture below design burst.
  const tForBurst = tLame(pBurst, ri, sUlt);
  const tForProof = tLame(pProof, ri, sYld);
  const tReq = Math.max(tForBurst, tForProof);
  const governs: 'burst' | 'proof' = tForBurst >= tForProof ? 'burst' : 'proof';
  const t = i.tMm && i.tMm > 0 ? i.tMm : tReq;
  const ro = ri + t;

  const tThinBurst = tThin(pBurst, ri, sUlt);
  const tThinProof = tThin(pProof, ri, sYld);
  const tThinReq = Math.max(tThinBurst, tThinProof);

  const hoopMeop = hoopLame(i.meop, ri, ro);
  const hoopProof = hoopLame(pProof, ri, ro);
  const predictedBurst = pLame(sUlt, ri, ro);
  const predictedYield = pLame(sYld, ri, ro);

  // Mass. Hemispherical heads carry half the membrane stress → half the wall.
  const rho = m.density * 1e-6; // kg/mm³
  const cylMass = rho * Math.PI * (ro * ro - ri * ri) * i.lengthMm;
  let domeMass: number, domeT: number, domeVol: number, domeLen: number;
  if (i.dome === 'hemi') {
    domeT = t / 2;
    domeMass = 2 * rho * (2 / 3) * Math.PI * ((ri + domeT) ** 3 - ri ** 3);
    domeVol = (4 / 3) * Math.PI * ri ** 3;
    domeLen = ri;
  } else {
    // 2:1 semi-ellipsoidal head: thickness ≈ cylinder wall (ASME VIII-1 UG-32),
    // inside surface of each head ≈ 1.380·π·r².
    domeT = t;
    domeMass = 2 * rho * 1.3802 * Math.PI * ri * ri * domeT;
    domeVol = (2 / 3) * Math.PI * ri ** 3; // two heads, each depth r/2
    domeLen = ri / 2;
  }
  const volume = Math.PI * ri * ri * i.lengthMm + domeVol; // mm³
  const mass = cylMass + domeMass; // kg

  // Case efficiency: p_burst·V / W, in metres (Pa·m³ / N).
  const pvw = (predictedBurst * 1e6 * volume * 1e-9) / (mass * 9.80665);

  const kic = m.kic;
  const cMeop = kic ? criticalCrackMm(kic, hoopMeop) : NaN;
  const cProof = kic ? criticalCrackMm(kic, hoopProof) : NaN;

  return {
    ri, ro, t, tReq, governs, tForBurst, tForProof,
    tThinReq, tOverR: t / ri, thinWallOk: t / ri < 0.1,
    pProof, pBurst, hoopMeop, hoopProof, axialMeop: hoopMeop / 2,
    predictedBurst, predictedYield,
    msBurst: marginOfSafety(predictedBurst, pBurst),
    msProof: marginOfSafety(predictedYield, pProof),
    domeT, domeLen, cylMass, domeMass, mass, volume, pvw,
    cMeop, cProof, leakBeforeBreak: kic ? cMeop >= t : null,
  };
}

export const units = {
  MPa: 1,
  bar: 0.1,
  psi: 0.00689476,
} as const;
export type PressureUnit = keyof typeof units;
