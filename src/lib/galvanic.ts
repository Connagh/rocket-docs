// Galvanic corrosion: the anodic index of metals and finishes, the allowed difference for each environment, the check of
// every contact in a joint, and a screening estimate of the attack on the anode from the cathode area.
// Potentials in volts; areas in any consistent unit; current density in µA/cm²; penetration in mm.

/**
 * Anodic index (V) after MIL-STD-889 and the classic MIL-F-14072 table: the potential in seawater relative to gold. A
 * higher index is more anodic (it corrodes). Graphite and carbon-fibre composite are as noble as gold or more.
 */
export const METALS = [
  { key: 'cfrp', name: 'Carbon-fibre composite, graphite', short: 'CFRP', index: 0.0 },
  { key: 'gold', name: 'Gold, plated or solid', short: 'Gold', index: 0.0 },
  { key: 'silver', name: 'Silver; nickel-copper alloys (Monel)', short: 'Silver', index: 0.15 },
  { key: 'ti', name: 'Titanium alloys; nickel, plated or solid', short: 'Titanium', index: 0.3 },
  { key: 'cu', name: 'Copper; nickel-chromium alloys (Inconel)', short: 'Copper', index: 0.35 },
  { key: 'brass', name: 'Brasses and bronzes', short: 'Brass', index: 0.4 },
  { key: 'ss18', name: 'Stainless, 18% Cr type (300 series), passive', short: '300-series stainless', index: 0.5 },
  { key: 'ss12', name: 'Stainless, 12% Cr type (400 series); chromium plate', short: '400-series stainless', index: 0.6 },
  { key: 'tin', name: 'Tin plate; tin-lead solder', short: 'Tin', index: 0.65 },
  { key: 'lead', name: 'Lead and high-lead alloys', short: 'Lead', index: 0.7 },
  { key: 'al2', name: 'Aluminium, 2000 series wrought', short: '2000-series Al', index: 0.75 },
  { key: 'steel', name: 'Carbon and low-alloy steel, bare', short: 'Low-alloy steel', index: 0.85 },
  { key: 'al', name: 'Aluminium, other wrought (7000, 6000); Si casting alloys', short: 'Aluminium', index: 0.9 },
  { key: 'cd', name: 'Cadmium plate, chromated; other Al casting alloys', short: 'Cadmium plate', index: 0.95 },
  { key: 'galv', name: 'Hot-dip zinc (galvanized steel)', short: 'Galvanized steel', index: 1.2 },
  { key: 'zn', name: 'Zinc, plated or wrought', short: 'Zinc', index: 1.25 },
  { key: 'mg', name: 'Magnesium alloys', short: 'Magnesium', index: 1.75 },
] as const;
export type MetalKey = (typeof METALS)[number]['key'];
export const metal = (k: string) => METALS.find((m) => m.key === k);

/** Usual design guidance on the anodic index difference for each environment (MIL-STD-889 practice). */
export const ENVIRONMENTS = [
  { key: 'harsh', name: 'Harsh', desc: 'salt spray, outdoors, unprotected', limit: 0.15 },
  { key: 'normal', name: 'Normal', desc: 'sheltered, humidity not controlled', limit: 0.25 },
  { key: 'controlled', name: 'Controlled', desc: 'sealed, temperature and humidity controlled', limit: 0.5 },
] as const;
export type EnvKey = (typeof ENVIRONMENTS)[number]['key'];

/** The galvanic couple of two metals: the potential difference and which one is the anode. */
export function couple(a: string, b: string) {
  const ma = metal(a), mb = metal(b);
  if (!ma || !mb) return null;
  const dV = Math.abs(ma.index - mb.index);
  const anode = ma.index > mb.index ? ma : mb.index > ma.index ? mb : null;
  return { dV, anode, cathode: anode === ma ? mb : anode === mb ? ma : null };
}

/** Check each contact of a joint, in the order of the stack (bolt, washer, part, part …): adjacent items touch. */
export function checkJoint(stack: string[], limit: number) {
  const items = stack.filter((k) => metal(k));
  const pairs = items.slice(1).map((k, i) => {
    const c = couple(items[i], k)!;
    return { a: items[i], b: k, ...c, ok: c.dV <= limit + 1e-9 };
  });
  const worst = pairs.reduce<(typeof pairs)[number] | null>((w, p) => (!w || p.dV > w.dV ? p : w), null);
  return { pairs, worst, ok: pairs.every((p) => p.ok) };
}

/**
 * Faraday: penetration rate (mm/year) per µA/cm² of anodic current density, 3.27e-3 × equivalent weight ÷ density,
 * for the metals that are usually the anode.
 */
export const ANODES = [
  { key: 'al', name: 'Aluminium', ew: 8.99, rho: 2.7 },
  { key: 'steel', name: 'Steel', ew: 27.92, rho: 7.87 },
  { key: 'mg', name: 'Magnesium', ew: 12.15, rho: 1.74 },
  { key: 'zn', name: 'Zinc', ew: 32.69, rho: 7.13 },
  { key: 'cd', name: 'Cadmium', ew: 56.21, rho: 8.65 },
  { key: 'cu', name: 'Copper', ew: 31.77, rho: 8.96 },
] as const;
export const mmPerYear = (iuA: number, ew: number, rho: number) => (3.27e-3 * iuA * ew) / rho;

/**
 * Screening estimate of the galvanic attack on the anode: the cathode reaction (usually oxygen reduction, limited by
 * diffusion to i_c) supplies the current, and the anode area carries it. The local attack scales with the area ratio:
 * i_a = i_c × Ac / Aa, only while the surfaces are wet (time of wetness, a fraction).
 */
export function galvanicAttack(o: { anode: string; cathodeArea: number; anodeArea: number; ic: number; wet: number; years: number }) {
  const an = ANODES.find((a) => a.key === o.anode);
  if (!an || !(o.anodeArea > 0) || !(o.cathodeArea >= 0)) return null;
  const ratio = o.cathodeArea / o.anodeArea, ia = o.ic * ratio;
  const rate = mmPerYear(ia, an.ew, an.rho) * o.wet;
  return { ratio, ia, rate, depth: rate * o.years, perUnit: mmPerYear(1, an.ew, an.rho) };
}
