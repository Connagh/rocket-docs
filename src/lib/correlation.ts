// Test correlation: comparing a model with strain-gauge readings, the measurement uncertainty of a strain gauge, modal
// correlation by frequency and the modal assurance criterion (MAC), and which physical parameter could plausibly close a
// gap — the check that keeps a model update honest. Strains in microstrain.

// ---------- Static: gauges against the model ----------

export interface GaugeRow { name: string; test: number; model: number }

/**
 * Compare test readings with model predictions: each gauge's ratio, the mean ratio and its scatter, the least-squares
 * slope of test on model through the origin, and the coefficient of determination. With a band (fraction), the gauges
 * outside it.
 */
export function gaugeStats(rows: GaugeRow[], band?: number) {
  const r = rows.filter((g) => Number.isFinite(g.test) && Number.isFinite(g.model) && g.model !== 0);
  const ratios = r.map((g) => g.test / g.model), n = r.length;
  const mean = ratios.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(ratios.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const slope = r.reduce((s, g) => s + g.test * g.model, 0) / r.reduce((s, g) => s + g.model * g.model, 0);
  const mt = r.reduce((s, g) => s + g.test, 0) / n, mm = r.reduce((s, g) => s + g.model, 0) / n;
  const sxy = r.reduce((s, g) => s + (g.model - mm) * (g.test - mt), 0), sxx = r.reduce((s, g) => s + (g.model - mm) ** 2, 0), syy = r.reduce((s, g) => s + (g.test - mt) ** 2, 0);
  const r2 = sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : NaN;
  const each = r.map((g, i) => ({ ...g, ratio: ratios[i], out: band !== undefined && Math.abs(ratios[i] - 1) > band }));
  return { n, each, mean, sd, slope, r2, outside: each.filter((g) => g.out).length };
}

/** Parse "name, test, model" lines — the last two fields are the numbers, so names may contain commas. */
export function parseGauges(text: string): GaugeRow[] {
  return text.split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((s) => s.trim()))
    .filter((p) => p.length >= 3 && p.at(-1) !== '' && p.at(-2) !== '' && Number.isFinite(+p.at(-1)!) && Number.isFinite(+p.at(-2)!))
    .map((p) => ({ name: p.slice(0, -2).join(', '), test: +p.at(-2)!, model: +p.at(-1)! }));
}

// ---------- Strain-gauge uncertainty ----------

/** Normal strain at an angle (degrees) from the first principal direction. */
export const strainAt = (e1: number, e2: number, deg: number) => {
  const t = (deg * Math.PI) / 180;
  return e1 * Math.cos(t) ** 2 + e2 * Math.sin(t) ** 2;
};

export interface GaugeError {
  e1: number; e2: number; angle: number; // principal strains and the gauge's angle from the first, degrees
  gfTol: number; // gauge-factor tolerance, fraction
  kt: number; nu0: number; // transverse sensitivity (fraction) and the Poisson's ratio of its calibration
  misalign: number; // degrees
  posErr: number; gradient: number; // mm, and microstrain per mm along the surface
  instr: number; // instrumentation, microstrain
}

/**
 * Contributions to the error of one gauge reading, in microstrain, and their root-sum-square. Transverse sensitivity is
 * systematic (Vishay TN-509): a known transverse strain lets you correct it rather than carry it.
 */
export function gaugeUncertainty(g: GaugeError) {
  const reading = strainAt(g.e1, g.e2, g.angle), trans = strainAt(g.e1, g.e2, g.angle + 90);
  const parts = {
    gaugeFactor: Math.abs(g.gfTol * reading),
    transverse: Math.abs((g.kt * (trans + g.nu0 * reading)) / (1 - g.nu0 * g.kt)),
    misalignment: Math.abs(strainAt(g.e1, g.e2, g.angle + g.misalign) - reading),
    position: Math.abs(g.posErr * g.gradient),
    instrument: Math.abs(g.instr),
  };
  const total = Math.sqrt(Object.values(parts).reduce((s, x) => s + x * x, 0));
  return { reading, trans, parts, total, fraction: total / Math.abs(reading) };
}

// ---------- Modal correlation ----------

/** Modal assurance criterion between two mode-shape vectors: |aᵀb|² / (aᵀa · bᵀb), 0 to 1, insensitive to scaling. */
export function mac(a: number[], b: number[]) {
  const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i], 0);
  return dot(a, b) ** 2 / (dot(a, a) * dot(b, b));
}

/** MAC between every test mode (rows) and every model mode (columns); modes as arrays of DOF values. */
export const macMatrix = (test: number[][], model: number[][]) => test.map((t) => model.map((m) => mac(t, m)));

/** Parse a block of mode shapes: one row per measured point, one column per mode. Returns modes as arrays. */
export function parseModes(text: string) {
  const rows = text.split(/\r?\n/).map((l) => l.split(/[,;\s]+/).filter((s) => s !== '').map(Number)).filter((r) => r.length > 0 && r.every(Number.isFinite));
  const m = Math.min(...rows.map((r) => r.length));
  return rows.length && Number.isFinite(m) ? Array.from({ length: m }, (_, j) => rows.map((r) => r[j])) : [];
}

/** Pair each test mode with the model mode of highest MAC, with the frequency difference (model relative to test). */
export function pairModes(fTest: number[], fModel: number[], M: number[][]) {
  return M.map((row, i) => {
    const j = row.reduce((best, v, k) => (v > row[best] ? k : best), 0);
    return { test: i, model: j, mac: row[j], fTest: fTest[i], fModel: fModel[j], df: fModel[j] / fTest[i] - 1 };
  });
}

// ---------- What could explain the difference ----------

/**
 * The change in a parameter that would close a frequency gap on its own, given the frequency's sensitivity to it
 * (S = ∂ln f / ∂ln p: 0.5 for a stiffness or modulus, −0.5 for a mass or density). Compare with how uncertain the
 * parameter really is: a change far outside that range is a sign the error is somewhere else.
 */
export const requiredChange = (fTest: number, fModel: number, S: number) => Math.exp(Math.log(fTest / fModel) / S) - 1;
