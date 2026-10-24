// Screw threads: the ISO basic profile, thread-stripping shear areas (FED-STD-H28 / VDI 2230 form), the strength of
// bolt, bolt threads and internal threads, the engagement length at which the bolt breaks before the threads strip,
// helical-coil inserts, and the effect of plating on pitch diameter. Units: mm, N, MPa.
import { type Thread } from './bolts.ts';

const TAN30 = Math.tan(Math.PI / 6);

/** Basic internal (nut) minor diameter, D1 = d − 1.0825·P, from the 60° basic profile (H = 0.866·P). */
export const internalMinor = (t: Thread) => t.d - 1.082532 * t.P;

/** Optional minimum-material limits; any left out default to basic size. */
export interface Limits { dMin?: number; d2Min?: number; D1Max?: number; D2Max?: number }

/**
 * Shear area of the internal threads, sheared at the bolt's major diameter (nut or tapped-hole threads strip):
 * A = π·Le·dmin·[P/2 + tan30°·(dmin − D2max)]/P. At basic size this is 7/8 of the cylinder π·d·Le.
 */
export function internalShearArea(t: Thread, Le: number, lim: Limits = {}) {
  const dmin = lim.dMin ?? t.d, D2max = lim.D2Max ?? t.d2;
  return (Math.PI * Le * dmin * (t.P / 2 + TAN30 * (dmin - D2max))) / t.P;
}

/**
 * Shear area of the external threads, sheared at the nut's minor diameter (bolt threads strip):
 * A = π·Le·D1max·[P/2 + tan30°·(d2min − D1max)]/P. At basic size this is 3/4 of the cylinder π·D1·Le.
 */
export function externalShearArea(t: Thread, Le: number, lim: Limits = {}) {
  const D1max = lim.D1Max ?? internalMinor(t), d2min = lim.d2Min ?? t.d2;
  return (Math.PI * Le * D1max * (t.P / 2 + TAN30 * (d2min - D1max))) / t.P;
}

/** Helical-coil insert: the parent material is tapped larger, to about d + 1.3·P, and strips at that diameter. */
export const helicalTapMajor = (t: Thread) => t.d + 1.3 * t.P;

export interface StripInputs {
  t: Thread; Le: number; Rm: number;   // bolt tensile strength
  tauBolt: number;                     // shear ultimate of the bolt threads
  tauInt: number;                      // shear ultimate of the internal threads (nut, or parent material)
  insert?: boolean;                    // helical-coil insert: parent strips at the larger tapped diameter
  lim?: Limits;
}

/** Ultimate loads of the three ways the fastening can fail, and which comes first. */
export function stripping(s: StripInputs) {
  const bolt = s.Rm * s.t.As;
  const ext = s.tauBolt * externalShearArea(s.t, s.Le, s.lim);
  const intDia = s.insert ? helicalTapMajor(s.t) : s.lim?.dMin ?? s.t.d;
  // for an insert, the parent's thread has the screw's pitch at the larger diameter: same 7/8 fraction at basic size
  const int = s.insert
    ? s.tauInt * internalShearArea({ ...s.t, d: intDia, d2: intDia - 0.649519 * s.t.P }, s.Le)
    : s.tauInt * internalShearArea(s.t, s.Le, s.lim);
  const modes = [{ key: 'bolt', load: bolt }, { key: 'external', load: ext }, { key: 'internal', load: int }];
  const first = modes.reduce((a, b) => (b.load < a.load ? b : a));
  return { bolt, ext, int, first: first.key as 'bolt' | 'external' | 'internal', ratio: Math.min(ext, int) / bolt };
}

/** Engagement length at which the weaker set of threads is exactly as strong as the bolt. */
export function balancedEngagement(s: Omit<StripInputs, 'Le'>) {
  const unit = stripping({ ...s, Le: 1 });
  return unit.bolt / Math.min(unit.ext, unit.int);
}

/** A coating of thickness c on the flanks of a 60° thread raises the pitch diameter by 4c. */
export const platingPitchGrowth = (c: number) => 4 * c;
