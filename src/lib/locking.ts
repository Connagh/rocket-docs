// Locking and retention: why preloaded threads self-loosen (transverse slip, after Junker), the slip check that
// prevents it, the self-loosening moment a secondary locking feature has to resist, the effective torque when a
// prevailing-torque feature is fitted, and what each kind of locking feature does. Units: mm, N, N·mm.
// Factors are inputs; the requirements summarised in FEATURES follow NASA-STD-5020B §4.6 and Appendix B.
import { type Thread } from './bolts.ts';

/** Friction torque that holds a tightened nut still, when nothing slips: thread plus bearing face. */
export function holdingTorque(F: number, t: Thread, muThread: number, muHead: number, dw: number, dh: number) {
  return F * ((muThread * t.d2) / (2 * Math.cos(Math.PI / 6)) + (muHead * (dw + dh)) / 4);
}

/**
 * The thread ramp's push to unscrew: F·P/2π with all friction overcome (the physics), and F·P/2, the larger estimate
 * of the self-loosening moment given in NASA-STD-5020B §4.6.1 (after Hess, 2017).
 */
export const rampTorque = (F: number, t: Thread) => (F * t.P) / (2 * Math.PI);
export const standardLooseningEstimate = (F: number, t: Thread) => (F * t.P) / 2;

/** Load the joint can take sideways before it slips: interface friction × clamp force × number of slip planes. */
export const slipCapacity = (clamp: number, mu: number, planes = 1) => mu * clamp * planes;

/** Slip margin against a transverse load per bolt; null until the factor is entered. */
export const slipMargin = (clamp: number, mu: number, planes: number, transverse: number, fs: number | null) =>
  fs === null || !(transverse > 0) ? null : slipCapacity(clamp, mu, planes) / (fs * transverse) - 1;

/**
 * Effective (preload-producing) torque range with a prevailing-torque feature (NASA-STD-5020B Eqs. 27–30): if the
 * specification is "above running torque", the specified torque all goes into preload; otherwise the maximum
 * running torque comes off the minimum and the minimum breakaway torque (conservatively zero) off the maximum.
 */
export function effectiveTorque(tsMin: number, tsMax: number, aboveRunning: boolean, runningMax: number, breakawayMin = 0) {
  return aboveRunning ? { min: tsMin, max: tsMax } : { min: tsMin - runningMax, max: tsMax - breakawayMin };
}

export type FeatureKey = 'none' | 'split' | 'serrated' | 'jam' | 'prevailing' | 'adhesive' | 'wire';

/** What each locking feature does — the classes and verification methods of NASA-STD-5020B §4.6 and Appendix B. */
export const FEATURES: Record<FeatureKey, { name: string; independent: boolean; mechanical: boolean; does: string; verify: string }> = {
  none: { name: 'None — preload only', independent: false, mechanical: false,
    does: 'Preload is the primary locking: friction holds while nothing slips. Not a locking feature on its own.', verify: '—' },
  split: { name: 'Split or tooth lock washer', independent: false, mechanical: false,
    does: 'Flattens at a small fraction of preload and then acts as a plain washer: minimal, if any, locking.', verify: 'Not to be used as a secondary locking feature' },
  serrated: { name: 'Serrated bearing face', independent: false, mechanical: false,
    does: 'Works comparatively well, but only while preload lasts — so it cannot back up preload. Can damage the bearing surface.', verify: 'Depends on preload' },
  jam: { name: 'Jam nut', independent: false, mechanical: false,
    does: 'Relies on its own preload against the main nut, so a change in preload can defeat it.', verify: 'May not satisfy the preload-independent requirement' },
  prevailing: { name: 'Prevailing torque (deformed thread, insert, patch)', independent: true, mechanical: false,
    does: 'Keeps the fastener captive: prevents complete loss, not loss of preload, in severe vibration.', verify: 'Measure running torque during installation' },
  adhesive: { name: 'Adhesive thread locker (cured)', independent: true, mechanical: false,
    does: 'With adequate cure, holds preload comparatively well even in severe vibration. Needs a validated process.', verify: 'Torque test on witness samples made with the same materials and process' },
  wire: { name: 'Safety wire, cable or cotter pin', independent: true, mechanical: true,
    does: 'Positive: allows rotation only until the wire or pin is taut — some preload loss, but the part cannot come off.', verify: 'Visual inspection after installation' },
};
