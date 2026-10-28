// Internal insulation and ablative liners: erosion, char (material affected
// depth), bondline temperature including soak-back, and thickness sizing.
// SI internally (m, s, °C); public inputs use mm where noted.
// Shown and derived on /motor/insulation/.
import { MATERIALS, has } from './materials.ts';

import { burnBack, performance, throatForPeak, type GrainGeometry, type Propellant } from './grain.ts';

// ---------------------------------------------------------------------------
// Analytic: semi-infinite solid, surface held at Ts and receding at speed v
// ---------------------------------------------------------------------------

/** Complementary error function (Numerical Recipes erfcc, |rel err| < 1.2e-7). */
export function erfc(x: number): number {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/**
 * Dimensionless temperature rise θ = (T − T0)/(Ts − T0) at depth ξ below a surface
 * that is held at Ts and recedes into the solid at constant speed v, from t = 0
 * (Carslaw & Jaeger moving-boundary solution). v = 0 gives the classic erfc profile.
 */
export function thetaMoving(xi: number, t: number, v: number, alpha: number) {
  if (t <= 0) return xi <= 0 ? 1 : 0;
  const s = 2 * Math.sqrt(alpha * t);
  return 0.5 * (erfc((xi + v * t) / s) + Math.exp((-v * xi) / alpha) * erfc((xi - v * t) / s));
}

/** Depth below the current surface at which θ falls to thetaP (e.g. the pyrolysis/char front). */
export function isothermDepth(t: number, v: number, alpha: number, thetaP: number) {
  if (thetaP >= 1) return 0;
  let lo = 0, hi = 1e-3;
  while (thetaMoving(hi, t, v, alpha) > thetaP && hi < 10) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (thetaMoving(mid, t, v, alpha) > thetaP) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Steady-state char thickness below a surface receding at v: (α/v)·ln(1/θp). */
export const steadyCharDepth = (v: number, alpha: number, thetaP: number) =>
  v > 0 ? (alpha / v) * Math.log(1 / thetaP) : Infinity;

// ---------------------------------------------------------------------------
// Materials (indicative values for screening; carried over from REF·DB v1 where available)
// ---------------------------------------------------------------------------

export interface LinerMaterial {
  key: string;
  name: string;
  role: 'case' | 'nozzle';
  k: number; // W/m·K (virgin)
  rho: number; // kg/m³
  cp: number; // J/kg·K
  tPyro: number | null; // °C, onset of pyrolysis / charring; null = does not char
  erosion: number; // mm/s, illustrative recession in moderate exposed flow
  note: string;
}

/** Ablative liners: the materials of the library with ablation data (charring onset or erosion rate) and a role. */
export const LINER_MATERIALS: LinerMaterial[] = MATERIALS.filter((m) => m.role && has(m, ['k', 'rho', 'cp']) && (m.tPyro !== undefined || m.erosion !== undefined))
  .map((m) => ({ key: m.key, name: m.name, role: m.role!, k: m.k!, rho: m.rho!, cp: m.cp!, tPyro: m.tPyro ?? null, erosion: m.erosion ?? 0, note: m.spec }));

export interface BackupMaterial { key: string; name: string; k: number; rho: number; cp: number; tLimit: number; wall: number; }
/**
 * Case walls behind the insulation: the metals and composites of the library with thermal data. The bondline limit and
 * the starting wall thickness are typical by class (aluminium and composite cases run cooler bondlines and thicker walls).
 */
export const BACKUP_MATERIALS: BackupMaterial[] = MATERIALS.filter((m) => (m.kind === 'metal' || m.kind === 'composite') && has(m, ['k', 'rho', 'cp']))
  .map((m) => {
    const light = m.family === 'al' || m.family === 'mg', comp = m.kind === 'composite';
    return { key: m.key, name: m.name, k: comp && m.kz !== undefined ? m.kz : m.k!, rho: m.rho!, cp: m.cp!, tLimit: light || comp ? 120 : 150, wall: comp ? 5 : light ? 3 : m.family === 'ti' ? 2 : 1.4 };
  });

// ---------------------------------------------------------------------------
// 1-D transient model: insulation + case, receding hot face, then soak-back
// ---------------------------------------------------------------------------

export interface WallInputs {
  insT: number; // insulation thickness, mm
  ins: { k: number; rho: number; cp: number };
  caseT: number; // case wall, mm
  case: { k: number; rho: number; cp: number };
  t0: number; // initial temperature, °C
  tSurface: number; // effective hot-face temperature during exposure, °C
  tPyro: number | null; // char front temperature, °C
  erosion: number; // mm/s
  exposure: number; // s
  soak: number; // s after burnout to keep computing (extended automatically to catch the soak-back peak)
  hOut: number; // W/m²K, outer surface to ambient at t0
  /** Hot face after burnout: 'adiabatic' bounds soak-back from above; 'radiating' (ε 0.85 to surroundings at t0) from below. */
  afterBurnout?: 'adiabatic' | 'radiating';
}

export interface WallResult {
  erosion: number; // mm
  charFront: number; // mm from the original surface, including char growth during soak-back (= material affected depth)
  charLayer: number; // mm of char left on the surface
  charFrontBurnout: number; // mm, char front at the moment of burnout
  bondPeak: number; // °C
  tBondPeak: number; // s
  bondAtBurnout: number; // °C
  soakWindow: number; // s simulated after burnout
  burnThrough: boolean;
  history: { t: number; bond: number }[];
  profileBurnout: { x: number; T: number }[]; // x in mm from original surface
  profilePeak: { x: number; T: number }[];
}

export function simulateWall(w: WallInputs, nIns = 120, nCase = 12): WallResult {
  const L1 = w.insT / 1000, L2 = w.caseT / 1000;
  const N = nIns + nCase;
  const dx = new Float64Array(N), xc = new Float64Array(N), k = new Float64Array(N), C = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const ins = i < nIns;
    dx[i] = ins ? L1 / nIns : L2 / nCase;
    xc[i] = ins ? (i + 0.5) * dx[i] : L1 + (i - nIns + 0.5) * dx[i];
    const m = ins ? w.ins : w.case;
    k[i] = m.k;
    C[i] = m.rho * m.cp * dx[i];
  }
  const G = new Float64Array(N - 1);
  for (let i = 0; i < N - 1; i++) G[i] = 1 / (dx[i] / (2 * k[i]) + dx[i + 1] / (2 * k[i + 1]));
  const gOut = w.hOut > 0 ? 1 / (dx[N - 1] / (2 * k[N - 1]) + 1 / w.hOut) : 0;

  const T = new Float64Array(N).fill(w.t0), Tmax = new Float64Array(N).fill(w.t0);
  const a = new Float64Array(N), b = new Float64Array(N), c = new Float64Array(N), d = new Float64Array(N);
  const v = w.erosion / 1000;
  const gi = nIns - 1, gc = nIns; // cells either side of the bond
  const bondT = () => {
    const ga = (2 * k[gi]) / dx[gi], gb = (2 * k[gc]) / dx[gc];
    return (ga * T[gi] + gb * T[gc]) / (ga + gb);
  };

  const history: { t: number; bond: number }[] = [{ t: 0, bond: w.t0 }];
  let t = 0, first = 0, burnThrough = false;
  let bondPeak = w.t0, tBondPeak = 0, bondAtBurnout = w.t0;
  let profilePeak: { x: number; T: number }[] = [];
  let profileBurnout: { x: number; T: number }[] = [];
  const snapshot = () => Array.from({ length: N - first }, (_, j) => ({ x: xc[first + j] * 1000, T: T[first + j] }));

  // Char front: deepest insulation point whose peak temperature reached the pyrolysis temperature.
  const charFrontOf = (tm: Float64Array) => {
    let cf = Math.min(v * Math.min(t, w.exposure), L1) * 1000; // erosion stops at burnout
    if (w.tPyro === null) return cf;
    for (let i = 0; i < nIns; i++) {
      if (tm[i] < w.tPyro) continue;
      const next = i + 1 < nIns ? tm[i + 1] : -Infinity;
      // linear interpolation to the crossing between this cell centre and the next
      const frac = next < w.tPyro ? (tm[i] - w.tPyro) / Math.max(tm[i] - next, 1e-9) : 1;
      cf = Math.max(cf, (xc[i] + Math.min(1, frac) * dx[i]) * 1000);
    }
    return cf;
  };
  let charFrontBurnout = 0;
  const nExp = 400, nSoak = 300;
  // Run long enough after burnout for heat to diffuse through the whole insulation (≈ 1.5 L²/α).
  const soak = Math.max(w.soak, (1.5 * L1 * L1 * w.ins.rho * w.ins.cp) / w.ins.k);
  // Soak steps grow geometrically from the exposure step, so the first seconds after
  // burnout (when the char front and bondline change fastest) stay well resolved.
  const dt0 = w.exposure / nExp;
  let growth = 1;
  if (dt0 * nSoak < soak) {
    let lo = 1, hi = 2;
    const total = (r: number) => (dt0 * (Math.pow(r, nSoak) - 1)) / (r - 1);
    while (total(hi) < soak) hi *= 1.5;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (total(mid) < soak) lo = mid; else hi = mid; }
    growth = hi;
  }
  for (let step = 0; step < nExp + nSoak; step++) {
    const exposing = step < nExp;
    const dt = exposing ? dt0 : growth === 1 ? soak / nSoak : dt0 * Math.pow(growth, step - nExp + 1);
    if (dt <= 0) continue;
    t += dt;
    const s = exposing ? Math.min(v * t, L1) : Math.min(v * w.exposure, L1); // receded surface
    while (first < nIns && xc[first] < s) { T[first] = w.tSurface; Tmax[first] = Math.max(Tmax[first], w.tSurface); first++; }
    if (first >= nIns) { burnThrough = true; }
    // Hot face: fixed temperature during exposure (conductance from the surface to the first live cell centre).
    // After burnout: adiabatic, or radiating to surroundings at t0 (linearised on the last surface temperature).
    let gS = 0, tS = w.tSurface;
    if (exposing && first < N) gS = k[first] / Math.max(xc[first] - s, dx[first] * 0.05);
    else if (w.afterBurnout === 'radiating' && first < N) {
      const Ts = T[first] + 273.15, Ta = w.t0 + 273.15;
      const hr = 0.85 * 5.670374e-8 * (Ts * Ts + Ta * Ta) * (Ts + Ta);
      gS = 1 / (Math.max(xc[first] - s, dx[first] * 0.05) / k[first] + 1 / hr);
      tS = w.t0;
    }
    for (let i = first; i < N; i++) {
      const gl = i > first ? G[i - 1] : gS;
      const gr = i < N - 1 ? G[i] : gOut;
      a[i] = i > first ? -G[i - 1] : 0;
      c[i] = i < N - 1 ? -G[i] : 0;
      b[i] = C[i] / dt + gl + gr;
      d[i] = (C[i] / dt) * T[i] + (i === first ? gS * tS : 0) + (i === N - 1 ? gOut * w.t0 : 0);
    }
    // Thomas algorithm
    for (let i = first + 1; i < N; i++) {
      const m = a[i] / b[i - 1];
      b[i] -= m * c[i - 1];
      d[i] -= m * d[i - 1];
    }
    T[N - 1] = d[N - 1] / b[N - 1];
    for (let i = N - 2; i >= first; i--) T[i] = (d[i] - c[i] * T[i + 1]) / b[i];
    for (let i = first; i < N; i++) if (T[i] > Tmax[i]) Tmax[i] = T[i];

    const bt = bondT();
    history.push({ t, bond: bt });
    if (bt > bondPeak) { bondPeak = bt; tBondPeak = t; profilePeak = snapshot(); }
    if (step === nExp - 1) { bondAtBurnout = bt; profileBurnout = snapshot(); charFrontBurnout = charFrontOf(Tmax); }
  }

  const erosion = Math.min(v * w.exposure, L1) * 1000;
  const charFront = charFrontOf(Tmax);
  if (charFront >= w.insT - 1e-9) burnThrough = true;
  if (!profilePeak.length) profilePeak = snapshot();
  return {
    erosion, charFront: Math.min(charFront, w.insT), charLayer: Math.max(0, Math.min(charFront, w.insT) - erosion),
    charFrontBurnout: Math.min(charFrontBurnout, w.insT),
    soakWindow: soak,
    bondPeak, tBondPeak, bondAtBurnout, burnThrough, history, profileBurnout, profilePeak,
  };
}

// ---------------------------------------------------------------------------
// Sizing
// ---------------------------------------------------------------------------

export interface SizingInputs extends Omit<WallInputs, 'insT'> {
  safetyFactor: number; // on material affected depth
  bondLimit: number; // °C
  minGauge: number; // mm
}

export function sizeInsulation(s: SizingInputs) {
  const alpha = s.ins.k / (s.ins.rho * s.ins.cp);
  // Material affected depth from a thick ("semi-infinite") wall, so the backing does not flatter it.
  const thick = Math.max(20, 3 * (s.erosion * s.exposure + 4 * Math.sqrt(alpha * s.exposure) * 1000));
  const mad = simulateWall({ ...s, insT: thick }).charFront;
  const tMad = s.safetyFactor * mad;

  const peak = (L: number) => simulateWall({ ...s, insT: L }).bondPeak;
  let tBond = 0;
  const lo0 = Math.max(mad + 0.05, 0.1);
  if (peak(lo0) <= s.bondLimit) tBond = lo0;
  else {
    let lo = lo0, hi = Math.max(2 * lo0, 5);
    while (peak(hi) > s.bondLimit && hi < 500) hi *= 2;
    if (hi >= 500) tBond = Infinity;
    else {
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (peak(mid) > s.bondLimit) lo = mid; else hi = mid; }
      tBond = hi;
    }
  }
  const required = Math.max(tMad, tBond, s.minGauge);
  const governs = required === tBond && tBond > tMad && tBond > s.minGauge ? 'bondline temperature'
    : required === s.minGauge && s.minGauge >= tMad ? 'minimum gauge' : 'safety factor on affected depth';
  const result = Number.isFinite(required) ? simulateWall({ ...s, insT: required }) : null;
  return { alpha, mad, tMad, tBond, required, governs, result, massPerArea: Number.isFinite(required) ? (s.ins.rho * required) / 1000 : NaN };
}

// ---------------------------------------------------------------------------
// Exposure around the case: how long each point of the cylinder wall sees hot
// gas after the flame front reaches it (from the grain burn-back).
// ---------------------------------------------------------------------------

export function exposureAroundCase(g: GrainGeometry, prop: Propellant, pPeak: number, cf = 1.5, bins = 180, n = 300) {
  const bb = burnBack(g, 160, n);
  const perf = performance(bb, prop, throatForPeak(bb, prop, pPeak), cf);
  const tAt = (y: number) => {
    const tr = perf.trace;
    if (y <= tr[0].y) return 0;
    for (let i = 1; i < tr.length; i++)
      if (tr[i].y >= y) return tr[i - 1].t + ((y - tr[i - 1].y) / (tr[i].y - tr[i - 1].y || 1)) * (tr[i].t - tr[i - 1].t);
    return tr[tr.length - 1].t;
  };
  const contact = new Array<number>(bins).fill(Infinity);
  if (bb.map) {
    const { n: m, h, dist } = bb.map, R = g.od / 2;
    for (let j = 0; j < m; j++)
      for (let i = 0; i < m; i++) {
        const x = -R + (i + 0.5) * h, y = -R + (j + 0.5) * h, r = Math.hypot(x, y);
        if (r > R || r <= R - 1.5 * h) continue;
        const d = dist[j * m + i] + (R - r);
        const bin = Math.min(bins - 1, Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * bins));
        if (d < contact[bin]) contact[bin] = d;
      }
  } else contact.fill(bb.burnout);
  const tEnd = perf.burnTime;
  const angles = contact.map((_, i) => ((i + 0.5) / bins) * 360 - 180);
  const tContact = contact.map((y) => tAt(Math.min(y, bb.burnout)));
  return { angles, tContact, exposure: tContact.map((tc) => Math.max(0, tEnd - tc)), burnTime: tEnd, mainBurn: perf.mainBurnTime };
}
