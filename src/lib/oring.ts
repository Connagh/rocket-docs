// O-ring gland analysis at the tolerance and temperature extremes.
// Units: mm, MPa, °C. Shown and derived on /seals/o-ring-design/.

export type Arrangement = 'piston' | 'rod' | 'face';
export type Duty = 'static' | 'dynamic';
export interface Range { min: number; max: number; }

export interface ORingInputs {
  arrangement: Arrangement;
  duty: Duty;
  cs: number; csTol: number; // cross-section, ± tolerance
  id: number; idTol: number; // ring inside diameter, ± tolerance
  /** piston: cylinder bore · rod: housing bore the rod passes through · face: unused */
  bore: Range;
  /** piston: piston OD · rod: rod OD · face: unused */
  shaft: Range;
  /** piston: groove root diameter · rod: groove (outer) diameter · face: groove depth */
  groove: Range;
  width: Range; // groove width
  faceGap: Range; // face: flange separation at assembly
  eccentric: boolean; // radial: parts can sit fully off-centre
  tMin: number; tMax: number; tAssembly: number;
  alphaE: number; // elastomer CTE, 1/K
  alphaM: number; // housing CTE, 1/K
  swell: number; // volume swell in service fluid, fraction
  compressionSet: number; // fraction of squeeze lost by end of life
  pressure: number; // MPa
  hardness: number; // Shore A
  opening: number; // gap increase under pressure (radial for radial seals, axial for face seals), mm
}

/** Cross-section after stretching onto a diameter, assuming constant volume: d / √(1 + s). */
export const stretchedCs = (cs: number, stretch: number) => (stretch > 0 ? cs / Math.sqrt(1 + stretch) : cs);

/** Screening squeeze bands, %: nominal target and worst-case limits. */
export function squeezeBands(arrangement: Arrangement, duty: Duty) {
  if (duty === 'dynamic') return { nom: [10, 18], wc: [7, 22] };
  return arrangement === 'face' ? { nom: [20, 30], wc: [12, 35] } : { nom: [15, 25], wc: [10, 30] };
}

/**
 * Screening diametral extrusion-gap limit (mm) vs pressure and hardness, from REF·DB v1's table
 * (70 and 90 Shore A, interpolated between). 0 means "use a back-up ring".
 */
export function extrusionLimit(pressure: number, hardness: number) {
  const row = pressure <= 5 ? [0.15, 0.25] : pressure <= 10 ? [0.08, 0.15] : [0, 0.08];
  const f = Math.min(1, Math.max(0, (hardness - 70) / 20));
  return row[0] + (row[1] - row[0]) * f;
}

export function analyseGland(i: ORingInputs) {
  const dTh = i.tMax - i.tAssembly, dTc = i.tMin - i.tAssembly;
  const lin = Math.cbrt(1 + i.swell); // linear growth from volume swell

  // Gland depth (radial gap the ring is squeezed into, or axial for a face seal)
  let gMin: number, gMax: number, gNom: number, gFillMin: number, clearanceMax: number;
  if (i.arrangement === 'piston') {
    gNom = ((i.bore.min + i.bore.max) / 2 - (i.groove.min + i.groove.max) / 2) / 2;
    gMin = i.eccentric ? (i.shaft.min - i.groove.max) / 2 : (i.bore.min - i.groove.max) / 2;
    gMax = i.eccentric ? i.bore.max - (i.shaft.min + i.groove.min) / 2 : (i.bore.max - i.groove.min) / 2;
    gFillMin = (i.bore.min - i.groove.max) / 2;
    clearanceMax = i.bore.max - i.shaft.min;
  } else if (i.arrangement === 'rod') {
    gNom = ((i.groove.min + i.groove.max) / 2 - (i.shaft.min + i.shaft.max) / 2) / 2;
    gMin = i.eccentric ? (i.groove.min - i.bore.max) / 2 : (i.groove.min - i.shaft.max) / 2;
    gMax = i.eccentric ? (i.groove.max + i.bore.max) / 2 - i.shaft.min : (i.groove.max - i.shaft.min) / 2;
    gFillMin = (i.groove.min - i.shaft.max) / 2;
    clearanceMax = i.bore.max - i.shaft.min;
  } else {
    gNom = (i.groove.min + i.groove.max) / 2 + (i.faceGap.min + i.faceGap.max) / 2;
    gMin = i.groove.min + i.faceGap.min;
    gMax = i.groove.max + i.faceGap.max;
    gFillMin = i.groove.min;
    clearanceMax = 2 * i.faceGap.max; // one-sided axial gap expressed as an equivalent diametral clearance
  }
  // Under pressure the joint opens: the gland deepens and the extrusion gap widens.
  const gMaxPressurised = gMax + i.opening;
  const clearancePressurised = clearanceMax + 2 * i.opening;

  // Stretch (piston: ring ID stretched onto the groove root; rod: onto the rod if smaller)
  const onto = i.arrangement === 'piston' ? i.groove : i.arrangement === 'rod' ? i.shaft : null;
  const idMin = i.id - i.idTol, idMax = i.id + i.idTol;
  const stretchNom = onto ? Math.max(0, ((onto.min + onto.max) / 2 - i.id) / i.id) : 0;
  const stretchMin = onto ? Math.max(0, (onto.min - idMax) / idMax) : 0;
  const stretchMax = onto ? Math.max(0, (onto.max - idMin) / idMin) : 0;
  const rawStretchMin = onto ? (onto.min - idMax) / idMax : 0; // negative = ring loose in the groove
  // Rod glands: ring OD against the groove diameter — circumferential compression if larger.
  const odMax = idMax + 2 * (i.cs + i.csTol);
  const circCompression = i.arrangement === 'rod' ? (odMax - i.groove.min) / odMax : 0;

  // Effective cross-sections
  const csNom = stretchedCs(i.cs, stretchNom);
  const csHot = stretchedCs(i.cs + i.csTol, stretchMin) * (1 + i.alphaE * dTh) * lin;
  const csCold = stretchedCs(i.cs - i.csTol, stretchMax) * (1 + i.alphaE * dTc);

  const squeeze = (cs: number, g: number) => (cs - g) / cs;
  const sqNom = squeeze(csNom, gNom);
  const sqMax = squeeze(csHot, gMin * (1 + i.alphaM * dTh));
  const sqMinCold = squeeze(csCold, gMax * (1 + i.alphaM * dTc));
  const sqMinEol = sqMinCold * (1 - i.compressionSet); // after compression set
  const sqMinPressurised = squeeze(csCold, gMaxPressurised * (1 + i.alphaM * dTc)) * (1 - i.compressionSet);

  // Gland fill: ring section area over groove area
  const area = (cs: number, s: number) => (Math.PI / 4) * cs * cs / (1 + s);
  const wNom = (i.width.min + i.width.max) / 2;
  const fillNom = area(i.cs, stretchNom) / (wNom * gNom);
  const fillMax = (area(i.cs + i.csTol, stretchMin) * (1 + i.alphaE * dTh) ** 2 * (1 + i.swell)) / (i.width.min * gFillMin * (1 + i.alphaM * dTh) ** 2);

  const limit = extrusionLimit(i.pressure, i.hardness);
  const bands = squeezeBands(i.arrangement, i.duty);
  return {
    gNom, gMin, gMax, gMaxPressurised,
    stretchNom, stretchMin, stretchMax, rawStretchMin, circCompression,
    sqNom, sqMax, sqMinCold, sqMinEol, sqMinPressurised,
    fillNom, fillMax,
    clearanceMax, clearancePressurised, extrusionLimit: limit,
    backupNeeded: limit === 0 || clearancePressurised > limit,
    bands,
  };
}

/**
 * Suggest groove dimensions for a target nominal squeeze and fill, given the mating
 * diameter (piston: bore; rod: rod; face: none) and the ring.
 */
export function suggestGroove(arrangement: Arrangement, mating: number, cs: number, id: number, squeezeTarget: number, fillTarget: number) {
  let stretch = 0, groove = 0, depth = cs * (1 - squeezeTarget);
  for (let k = 0; k < 20; k++) {
    const csEff = stretchedCs(cs, stretch);
    depth = csEff * (1 - squeezeTarget);
    if (arrangement === 'piston') { groove = mating - 2 * depth; stretch = Math.max(0, (groove - id) / id); }
    else if (arrangement === 'rod') { groove = mating + 2 * depth; stretch = Math.max(0, (mating - id) / id); }
    else { groove = depth; }
  }
  const width = ((Math.PI / 4) * cs * cs / (1 + stretch)) / (fillTarget * depth);
  return { groove, depth, width, stretch };
}

/** Nearest stock inside diameter from a list. */
export const nearestId = (ids: number[], target: number) => ids.reduce((b, v) => (Math.abs(v - target) < Math.abs(b - target) ? v : b), ids[0]);
