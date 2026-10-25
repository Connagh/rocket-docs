// GD&T arithmetic: bonus tolerance, virtual and resultant conditions for a feature of size, position from measured
// coordinates, the fastener formulas (floating, fixed, and fixed without a projected tolerance zone), and the radial
// gland of an O-ring groove when the groove's runout to its pilot is added to the pilot's clearance. Units: mm.

export type FeatureKind = 'hole' | 'pin';
export type Modifier = 'MMC' | 'LMC' | 'RFS';

/**
 * A feature of size with a geometric tolerance. For a hole MMC is the smallest size, for a pin the largest. With MMC
 * (or LMC) the tolerance grows by the departure from that condition — the bonus. Virtual condition is the worst-case
 * boundary a mating part must clear; resultant condition the opposite extreme.
 */
export function featureOfSize(kind: FeatureKind, sizeMin: number, sizeMax: number, tol: number, mod: Modifier, actual: number) {
  const mmc = kind === 'hole' ? sizeMin : sizeMax, lmc = kind === 'hole' ? sizeMax : sizeMin;
  const inLimits = actual >= sizeMin - 1e-12 && actual <= sizeMax + 1e-12;
  const bonus = mod === 'MMC' ? Math.abs(actual - mmc) : mod === 'LMC' ? Math.abs(actual - lmc) : 0;
  const maxBonus = mod === 'RFS' ? 0 : sizeMax - sizeMin;
  const s = kind === 'hole' ? 1 : -1; // a hole's boundaries shrink inwards with tolerance, a pin's grow outwards
  return {
    mmc, lmc, inLimits, bonus, allowed: tol + bonus, maxAllowed: tol + maxBonus,
    // MMC-modified: virtual condition at MMC, resultant at LMC; LMC-modified: the reverse
    virtual: mod === 'LMC' ? lmc + s * tol : mmc - s * tol,
    resultant: mod === 'LMC' ? mmc - s * (tol + maxBonus) : lmc + s * (tol + maxBonus),
  };
}

/** Diametral position deviation from measured coordinate deviations: 2√(dx² + dy²). */
export const positionFromXY = (dx: number, dy: number) => 2 * Math.hypot(dx, dy);

/** Floating fasteners (clearance holes in both parts): each part may have T = H − F. */
export const floatingTolerance = (H: number, F: number) => H - F;

/** Fixed fasteners (one part threaded or press-fit), with a projected tolerance zone: T1 + T2 = H − F. */
export const fixedTotal = (H: number, F: number) => H - F;

/**
 * Fixed fasteners without a projected tolerance zone: the threaded hole's perpendicularity error is magnified over the
 * height the fastener projects, so the clearance hole must be H = F + T1 + T2(1 + 2P/D), with P the maximum
 * projection (the clamped part's thickness) and D the minimum depth of thread engagement (ASME Y14.5 appendix).
 */
export const holeWithoutProjection = (F: number, T1: number, T2: number, P: number, D: number) => F + T1 + T2 * (1 + (2 * P) / D);

export interface Gland {
  boreMin: number; boreMax: number; // the housing bore the ring seals against
  plugMin: number; plugMax: number; // the pilot diameter of the part carrying the groove, which locates it in the bore
  rootMin: number; rootMax: number; // groove root diameter
  runout: number; // the groove root's runout (full indicator movement) or diametral position to the pilot; 0 if coaxial
  csMin: number; csMax: number; // ring section
}

/**
 * Radial gland depth around the circumference, over every combination of limits: the part carrying the groove can sit
 * off-centre by half its pilot clearance, and the groove can sit off its own pilot by half its runout. Squeeze is from the
 * ring section alone — before stretch, temperature, swell and compression set, which the O-ring design page adds.
 */
export function glandRange(g: Gland) {
  let gMin = Infinity, gMax = -Infinity, eMax = 0;
  for (const bore of [g.boreMin, g.boreMax]) for (const plug of [g.plugMin, g.plugMax]) for (const root of [g.rootMin, g.rootMax]) {
    const e = Math.max(0, (bore - plug) / 2) + g.runout / 2, mean = (bore - root) / 2;
    gMin = Math.min(gMin, mean - e); gMax = Math.max(gMax, mean + e); eMax = Math.max(eMax, e);
  }
  const gNom = ((g.boreMin + g.boreMax) / 2 - (g.rootMin + g.rootMax) / 2) / 2, csNom = (g.csMin + g.csMax) / 2;
  const sq = (cs: number, gl: number) => (cs - gl) / cs;
  return { gMin, gMax, gNom, eMax, squeezeMin: sq(g.csMin, gMax), squeezeMax: sq(g.csMax, gMin), squeezeNom: sq(csNom, gNom) };
}
