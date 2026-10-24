// Sealing strategy: whether a seal's gland stays closed when the joint is pressurised (radial dilation of a bore seal,
// flange lift at a face seal), the wall a seal seat needs, and how sensitive a pressure-decay leak check through a
// port between two seals is — including the temperature drift that looks like a leak. Units: mm, MPa, N, kPa, cm³, s.

/** Radial growth of a thin cylinder under internal pressure: p·r²/(E·t), times (1 − ν/2) with closed ends. */
export const radialGrowth = (p: number, r: number, t: number, E: number, nu = 0.3, closedEnd = true) =>
  ((p * r * r) / (E * t)) * (closedEnd ? 1 - nu / 2 : 1);

/** Squeeze left on a radial seal after the gland opens by `gap` (fractions; section in mm). */
export const squeezeAtPressure = (section: number, squeezeMin: number, gap: number) => (section * squeezeMin - gap) / section;

/** Wall needed at the seal seat for the squeeze to stay at or above `floor` under pressure. */
export function seatWallFor(p: number, r: number, E: number, nu: number, section: number, squeezeMin: number, floor: number, mateGrowth = 0) {
  const allowed = section * (squeezeMin - floor) + mateGrowth; // radial growth the case may have
  return allowed > 0 ? ((p * r * r) / (E * allowed)) * (1 - nu / 2) : Infinity;
}

/** Face seal in a bolted flange: once the joint separates, extra load only stretches the bolts, opening a gap. */
export const faceSealGap = (loadPerBolt: number, separationLoad: number, boltStiffness: number) =>
  loadPerBolt > separationLoad ? (loadPerBolt - separationLoad) / boltStiffness : 0;

const ATM_KPA = 101.325;

/** Smallest leak a pressure-decay check can see: V·Δp/t, in standard cm³/s (atm·cm³/s). */
export const detectableLeak = (volume: number, resolution: number, hold: number) => (volume * (resolution / ATM_KPA)) / hold;

/** Hold time needed to see a given leak rate with a given gauge resolution. */
export const holdTimeFor = (volume: number, resolution: number, leak: number) => (volume * (resolution / ATM_KPA)) / leak;

/** Pressure change from a temperature drift of the trapped gas: Δp = p_abs·ΔT/T. */
export const thermalPressureShift = (pAbs: number, dT: number, T = 293.15) => (pAbs * dT) / T;
