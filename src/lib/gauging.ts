// Gauging: measurement uncertainty and the decision rule (ISO 14253-1), the risk of false accept and false reject
// for a process, gauge repeatability and reproducibility by the average and range method (AIAG MSA), and the sizes
// of limit gauges with the gauge-maker's tolerance and the wear allowance inside the work tolerance.
// Units: any length unit, used consistently (the page uses µm). Temperatures in °C.

// ---------- Normal distribution ----------

/** Standard normal cumulative distribution (Abramowitz & Stegun 7.1.26 on erf; error below 1.5e-7). */
export function phi(z: number) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
const pdf = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

// ---------- Uncertainty budget ----------

/**
 * How a contribution is given: a standard uncertainty; an expanded uncertainty at k = 2 (a calibration certificate);
 * the half-width of a rectangular distribution (a limit with no better knowledge, a temperature range); or the
 * resolution of a digital display (rectangular over one digit).
 */
export type Contribution = 'std' | 'k2' | 'rect' | 'res';
export const CONTRIBUTIONS: { key: Contribution; name: string }[] = [
  { key: 'std', name: '1σ' }, { key: 'k2', name: 'U at k = 2' },
  { key: 'rect', name: '± limit' }, { key: 'res', name: 'resolution' },
];
export const standardU = (value: number, kind: Contribution) =>
  kind === 'std' ? value : kind === 'k2' ? value / 2 : kind === 'rect' ? value / Math.sqrt(3) : value / Math.sqrt(12);

/** Combined standard uncertainty (root sum of squares, uncorrelated) and expanded uncertainty U = k·uc. */
export function budget(rows: { name: string; value: number; kind: Contribution }[], k = 2) {
  const parts = rows.filter((r) => Number.isFinite(r.value) && r.value > 0).map((r) => ({ ...r, u: standardU(r.value, r.kind) }));
  const uc = Math.sqrt(parts.reduce((s, p) => s + p.u * p.u, 0));
  return { parts: parts.map((p) => ({ ...p, share: uc > 0 ? (p.u * p.u) / (uc * uc) : 0 })), uc, U: k * uc };
}

/**
 * Length error from temperature: the part and the reference (gauge, ring, scale) at different temperatures, both
 * referred to 20 °C (ISO 1).
 */
export const thermalError = (L: number, aPart: number, tPart: number, aRef: number, tRef: number) =>
  L * (aPart * (tPart - 20) - aRef * (tRef - 20));

// ---------- Decision rule ----------

export type Rule = 'simple' | 'guard';
/**
 * Acceptance limits. Simple acceptance: the tolerance limits themselves (shared risk). Guarded acceptance (ISO
 * 14253-1 for proving conformance): each limit moved inside by g·U.
 */
export function acceptanceLimits(lsl: number, usl: number, U: number, rule: Rule, g = 1) {
  const band = rule === 'guard' ? g * U : 0;
  return { lo: lsl + band, hi: usl - band, band, ok: usl - band > lsl + band };
}

/** Test uncertainty ratio: tolerance width over 2U. */
export const tur = (lsl: number, usl: number, U: number) => (usl - lsl) / (2 * U);

/**
 * Probability of a false accept (a part out of tolerance that measures inside the acceptance limits) and of a false
 * reject (a good part that measures outside them), for a normal process N(mean, sd) and a normal measurement error with
 * standard deviation uc. Simpson integration over ±8 sd.
 */
export function decisionRisk(o: { lsl: number; usl: number; lo: number; hi: number; mean: number; sd: number; uc: number }) {
  const { lsl, usl, lo, hi, mean, sd, uc } = o;
  const pAccept = (x: number) => (uc > 0 ? phi((hi - x) / uc) - phi((lo - x) / uc) : x >= lo && x <= hi ? 1 : 0);
  if (!(sd > 0)) {
    const inTol = mean >= lsl && mean <= usl, a = pAccept(mean);
    return { pfa: inTol ? 0 : a, pfr: inTol ? 1 - a : 0, pOut: inTol ? 0 : 1, pAccept: a };
  }
  // Simpson on each piece between the tolerance limits, so the step at each limit falls on a node
  const a = mean - 8 * sd, b = mean + 8 * sd, cuts = [a, ...[lsl, usl].filter((x) => x > a && x < b), b];
  let pfa = 0, pfr = 0, pOut = 0, pAcc = 0;
  for (let j = 0; j + 1 < cuts.length; j++) {
    const x0 = cuts[j], x1 = cuts[j + 1], n = 2000, h = (x1 - x0) / n, good = (x0 + x1) / 2 >= lsl && (x0 + x1) / 2 <= usl;
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * h, w = (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * (h / 3) * (pdf((x - mean) / sd) / sd), acc = pAccept(x);
      if (good) pfr += w * (1 - acc); else { pfa += w * acc; pOut += w; }
      pAcc += w * acc;
    }
  }
  return { pfa, pfr, pOut, pAccept: pAcc };
}

// ---------- Gauge R&R, average and range method ----------

/** 1/d2* constants of AIAG MSA (4th ed.) for trials (K1), operators (K2) and parts (K3). */
const K1: Record<number, number> = { 2: 0.8862, 3: 0.5908 };
const K2: Record<number, number> = { 2: 0.7071, 3: 0.5231 };
const K3: Record<number, number> = { 2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.403, 6: 0.3742, 7: 0.3534, 8: 0.3375, 9: 0.3249, 10: 0.3146 };

/**
 * A study: data[operator][trial][part]. Returns the standard deviations EV (repeatability), AV (reproducibility), GRR,
 * PV (part variation) and TV, the percentages of TV and of the tolerance (6σ over the tolerance), and the number of
 * distinct categories. Two or three operators and trials, two to ten parts.
 */
export function gaugeRR(data: number[][][], tolerance?: number) {
  const ops = data.length, trials = data[0]?.length ?? 0, parts = data[0]?.[0]?.length ?? 0;
  if (!K2[ops] || !K1[trials] || !K3[parts] || data.some((o) => o.length !== trials || o.some((t) => t.length !== parts)))
    return null;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const ranges: number[] = [], opMeans: number[] = [], partMeans: number[] = [];
  for (const o of data) {
    for (let p = 0; p < parts; p++) { const v = o.map((t) => t[p]); ranges.push(Math.max(...v) - Math.min(...v)); }
    opMeans.push(mean(o.flat()));
  }
  for (let p = 0; p < parts; p++) partMeans.push(mean(data.flatMap((o) => o.map((t) => t[p]))));
  const Rbar = mean(ranges), xdiff = Math.max(...opMeans) - Math.min(...opMeans), Rp = Math.max(...partMeans) - Math.min(...partMeans);
  const EV = Rbar * K1[trials];
  const AV = Math.sqrt(Math.max(0, (xdiff * K2[ops]) ** 2 - (EV * EV) / (parts * trials)));
  const GRR = Math.hypot(EV, AV), PV = Rp * K3[parts], TV = Math.hypot(GRR, PV);
  const pct = (v: number) => (100 * v) / TV;
  return {
    ops, trials, parts, Rbar, xdiff, Rp, opMeans, partMeans, EV, AV, GRR, PV, TV,
    pctEV: pct(EV), pctAV: pct(AV), pctGRR: pct(GRR), pctPV: pct(PV),
    pctTol: tolerance && tolerance > 0 ? (100 * 6 * GRR) / tolerance : NaN,
    ndc: Math.max(1, Math.floor((1.41 * PV) / GRR)),
  };
}

/** The usual AIAG guidance on %GRR (of TV or of the tolerance). Programmes and customers can set other limits. */
export const grrBand = (pct: number) => (pct < 10 ? 'acceptable' : pct <= 30 ? 'marginal' : 'not acceptable');

/** Read a study from text: one line per operator and trial, "A: v1 v2 …", the same operator label on its trials. */
export function parseStudy(text: string) {
  const byOp = new Map<string, number[][]>();
  for (const line of text.split(/\n/)) {
    const m = line.trim().match(/^([A-Za-z]+)\s*[:,]?\s*(.*)$/);
    if (!m) continue;
    const vals = m[2].split(/[\s,;]+/).filter(Boolean).map(Number);
    if (!vals.length || vals.some((v) => !Number.isFinite(v))) continue;
    const key = m[1].toUpperCase().replace(/\d+$/, '');
    byOp.set(key, [...(byOp.get(key) ?? []), vals]);
  }
  return { labels: [...byOp.keys()], data: [...byOp.values()] };
}

/** A repeatable synthetic study (seeded): parts from N(0, partSd), operator biases, and repeatability repSd. */
export function makeStudy(o: { parts: number; trials: number; partSd: number; repSd: number; bias: number[]; centre?: number; seed?: number; round?: number }) {
  let s = (o.seed ?? 1) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  const r = o.round ?? 1, q = (v: number) => Math.round(v / r) * r;
  const truth = Array.from({ length: o.parts }, () => (o.centre ?? 0) + o.partSd * gauss());
  return o.bias.map((b) => Array.from({ length: o.trials }, () => truth.map((t) => q(t + b + o.repSd * gauss()))));
}

// ---------- Limit gauges ----------

/**
 * GO and NOGO gauge sizes for a hole (plug gauges) or a shaft (ring or snap gauges), with every gauge inside the work
 * tolerance so that a gauge in tolerance never accepts a bad part. The gauge-maker's tolerance and the GO wear
 * allowance are percentages of the work tolerance (a common simplification of ISO 1938-1 and ASME B89.1.5 tables).
 */
export function limitGauges(o: { feature: 'hole' | 'shaft'; lsl: number; usl: number; gaugePct: number; wearPct: number }) {
  const tol = o.usl - o.lsl, T = (o.gaugePct / 100) * tol, W = (o.wearPct / 100) * tol;
  const hole = o.feature === 'hole';
  const go = hole ? { lo: o.lsl + W, hi: o.lsl + W + T, wornAt: o.lsl } : { lo: o.usl - W - T, hi: o.usl - W, wornAt: o.usl };
  const nogo = hole ? { lo: o.usl - T, hi: o.usl } : { lo: o.lsl, hi: o.lsl + T };
  // a part is always accepted between the most restrictive GO and NOGO sizes
  const sure = hole ? { lo: go.hi, hi: nogo.lo } : { lo: nogo.hi, hi: go.lo };
  return { tol, T, W, go, nogo, sure, usable: Math.max(0, sure.hi - sure.lo), usablePct: (100 * Math.max(0, sure.hi - sure.lo)) / tol };
}

/**
 * Pin size of a functional (receiver) gauge for a hole with a position tolerance at MMC: the virtual condition, the
 * MMC size of the hole minus the position tolerance. With absolute tolerancing (ASME Y14.43) the gauge tolerance goes
 * on the product side, so the pin is never smaller than the virtual condition and never accepts a bad hole.
 */
export const functionalPin = (holeMMC: number, posTol: number, gaugeTol = 0) => ({ lo: holeMMC - posTol, hi: holeMMC - posTol + gaugeTol });
