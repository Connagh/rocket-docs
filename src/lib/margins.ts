// Margins of safety: the basic margin, reserve factor, combined-load interaction and von Mises combination.
// Factors are always inputs — they come from the programme's requirements.

/** MS = allowable / (factor × applied) − 1. Works for stresses or loads, as long as all three are consistent. */
export const marginOfSafety = (allowable: number, applied: number, factor: number) => allowable / (factor * applied) - 1;

/** Reserve factor (European convention): RF = allowable / (factor × applied) = MS + 1. */
export const reserveFactor = (allowable: number, applied: number, factor: number) => allowable / (factor * applied);

/**
 * Combined loading: interaction Σ R_iᵉⁱ ≤ 1, with R_i = factor × applied_i / allowable_i.
 * The margin is λ − 1, where λ is how far every load can be scaled together before Σ (λ R_i)ᵉⁱ = 1.
 */
export function interaction(ratios: number[], exponents: number[]) {
  const sum = (l: number) => ratios.reduce((s, r, i) => s + Math.pow(l * Math.max(r, 0), exponents[i]), 0);
  if (ratios.every((r) => !(r > 0))) return { value: 0, lambda: Infinity, ms: Infinity };
  let lo = 0, hi = 1;
  while (sum(hi) < 1) hi *= 2;
  for (let k = 0; k < 100; k++) { const mid = (lo + hi) / 2; if (sum(mid) < 1) lo = mid; else hi = mid; }
  const lambda = (lo + hi) / 2;
  return { value: sum(1), lambda, ms: lambda - 1 };
}

/** von Mises equivalent stress for a normal stress σ with shear τ (plane stress, one normal component). */
export const vonMises = (sigma: number, tau: number) => Math.sqrt(sigma * sigma + 3 * tau * tau);

export type Mode = 'yield' | 'ultimate' | 'other';

export interface MarginRow {
  item: string; loadCase: string; failure: string;
  mode: Mode; // which basic factor applies
  applied: number; allowable: number; // limit-level applied value and allowable, same units
  allowableBasis: string; // e.g. "A-basis yield, 100 °C": must match the mode
  extra: number | null; // product of special factors (fitting, bearing, casting, weld, model), if any
  ref: string;
}

/** The row's total factor and margin, given the programme's basic factors (null = not entered). */
export function evaluateRow(r: MarginRow, factors: { yield: number | null; ultimate: number | null; other: number | null }) {
  const basic = factors[r.mode];
  if (basic === null || !(r.applied > 0) || !(r.allowable > 0)) return { factor: null as number | null, ms: NaN, rf: NaN, mismatch: basisMismatch(r) };
  const factor = basic * (r.extra ?? 1);
  return { factor, ms: marginOfSafety(r.allowable, r.applied, factor), rf: reserveFactor(r.allowable, r.applied, factor), mismatch: basisMismatch(r) };
}

/** Flags the most common review finding: a yield allowable against an ultimate factor, or the reverse. */
export function basisMismatch(r: MarginRow) {
  const b = r.allowableBasis.toLowerCase();
  if (r.mode === 'ultimate' && /\byield\b|\bfty\b|\bsy\b/.test(b) && !/ultimate|\bftu\b|\buts\b/.test(b)) return 'yield allowable against an ultimate factor';
  if (r.mode === 'yield' && /ultimate|\bftu\b|\buts\b/.test(b) && !/\byield\b/.test(b)) return 'ultimate allowable against a yield factor';
  if (/typical|mean|nominal/.test(b)) return 'typical value used as an allowable';
  return null;
}

/** Tab-separated text of the report, ready to paste into a spreadsheet. */
export function reportTsv(rows: MarginRow[], results: ReturnType<typeof evaluateRow>[]) {
  const head = ['Item', 'Load case', 'Failure mode', 'Factor type', 'Applied (limit)', 'Allowable', 'Allowable basis', 'Total factor', 'MS', 'Reference'];
  const lines = rows.map((r, i) => {
    const x = results[i];
    const v = (n: number) => (Number.isFinite(n) ? n : '—'); // an interaction row has no single applied or allowable
    return [r.item, r.loadCase, r.failure, r.mode, v(r.applied), v(r.allowable), r.allowableBasis,
      x.factor === null ? 'factor needed' : x.factor.toFixed(3), Number.isFinite(x.ms) ? x.ms.toFixed(2) : '', r.ref].join('\t');
  });
  return [head.join('\t'), ...lines].join('\n');
}
