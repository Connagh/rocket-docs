// The material library: the one source of material properties for every tool on the site.
//
// The data are in src/data/materials.json. To add a material, add one entry there. Every tool that can use it then
// lists it: the material chart, the case, buckling, fatigue, fracture and proof tools, differential expansion, fits,
// bolted joints, sealing, transient thermal, insulation, the grain screen, and the FEA card generator.
//
// Fields of an entry (units as in the JSON file):
//   name, family, summary, spec          text; family is one of the keys of FAMILIES below
//   density (g/cm³), E (GPa), uts and yield (MPa), cte (µm/m·K), k (W/m·K), kic (MPa√m), maxServiceTemp (°C)
//   optional: nu (Poisson's ratio), cp (J/kg·K), kz (through-thickness conductivity, W/m·K),
//             eu (uniform elongation, %), tPyro (°C, onset of charring), erosion (mm/s, in moderate flow),
//             role ("case" or "nozzle", for ablative insulation)
// A property that an entry does not give comes from its family default if there is one (marked in `defaults`),
// or is left undefined; a tool lists only the materials that have the properties it needs.
// Screening values: design values come from approved sources.
import data from '../data/materials.json' with { type: 'json' };

export type Kind = 'metal' | 'composite' | 'ceramic' | 'polymer' | 'elastomer' | 'propellant';

/** Families: display name, kind, and default Poisson's ratio and specific heat where one value is representative. */
export const FAMILIES: Record<string, { name: string; kind: Kind; nu?: number; cp?: number }> = {
  steel: { name: 'Steels', kind: 'metal', nu: 0.29, cp: 480 },
  ss: { name: 'Stainless steels', kind: 'metal', nu: 0.29, cp: 500 },
  al: { name: 'Aluminium alloys', kind: 'metal', nu: 0.33, cp: 900 },
  ti: { name: 'Titanium alloys', kind: 'metal', nu: 0.34, cp: 560 },
  ni: { name: 'Nickel alloys', kind: 'metal', nu: 0.29, cp: 435 },
  mg: { name: 'Magnesium alloys', kind: 'metal', nu: 0.35, cp: 1025 },
  cu: { name: 'Copper alloys', kind: 'metal', nu: 0.34, cp: 385 },
  refract: { name: 'Refractory metals', kind: 'metal' },
  comp: { name: 'Composites', kind: 'composite' },
  cc: { name: 'Carbon, ceramics and ablatives', kind: 'ceramic' },
  poly: { name: 'Engineering polymers', kind: 'polymer' },
  elast: { name: 'Elastomers and rubber insulation', kind: 'elastomer' },
  prop: { name: 'Propellant (illustrative)', kind: 'propellant' },
};

type Raw = (typeof data.materials)[number] & Partial<Record<'nu' | 'cp' | 'kz' | 'eu' | 'tPyro' | 'erosion', number>> & { role?: string };

export interface Material {
  key: string; name: string; family: string; familyName: string; kind: Kind; summary: string; spec: string;
  /** density kg/m³ */ rho?: number;
  /** Young's modulus MPa */ E?: number;
  nu?: number; Fty?: number; Ftu?: number;
  /** secant expansion from 20 °C, 1/K */ alpha?: number;
  /** W/m·K; kz through the thickness where it differs */ k?: number; kz?: number;
  /** J/kg·K */ cp?: number;
  /** MPa√m */ kic?: number; kicDefault: boolean;
  maxT?: number; eu?: number; tPyro?: number; erosion?: number; role?: 'case' | 'nozzle';
  weldable?: boolean; corrosion?: number; machinability?: number; price?: number;
  /** properties taken from the family default, not from the entry */ defaults: string[];
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** Unit conversion without floating-point noise (7.85 g/cm³ is 7850 kg/m³, not 7849.999…). */
const conv = (v: number | undefined, f: number) => (v === undefined ? undefined : Number((v * f).toPrecision(10)));
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function normalise(r: Raw): Material {
  const fam = FAMILIES[r.family] ?? { name: r.family, kind: 'metal' as Kind }, defaults: string[] = [];
  const fromFam = (own: number | undefined, d: number | undefined, label: string) => {
    if (own !== undefined) return own;
    if (d !== undefined) defaults.push(label);
    return d;
  };
  return {
    key: slug(r.name), name: r.name, family: r.family, familyName: fam.name, kind: fam.kind, summary: r.summary ?? '', spec: r.spec ?? '',
    rho: conv(num(r.density), 1000), E: conv(num(r.E), 1000),
    nu: fromFam(num(r.nu), fam.nu, 'nu'), Fty: num(r.yield), Ftu: num(r.uts),
    alpha: conv(num(r.cte), 1e-6),
    k: num(r.k), kz: num(r.kz), cp: fromFam(num(r.cp), fam.cp, 'cp'),
    kic: num(r.kic), kicDefault: !!r.kicIsFamilyDefault, maxT: num(r.maxServiceTemp),
    eu: num(r.eu), tPyro: num(r.tPyro), erosion: num(r.erosion), role: r.role === 'case' || r.role === 'nozzle' ? r.role : undefined,
    weldable: r.weldable, corrosion: num(r.corrosion), machinability: num(r.machinability), price: num(r.pricePerKg), defaults,
  };
}

export const MATERIALS: Material[] = (data.materials as Raw[]).map(normalise);

export type Prop = 'rho' | 'E' | 'nu' | 'Fty' | 'Ftu' | 'alpha' | 'k' | 'kz' | 'cp' | 'kic' | 'eu' | 'tPyro' | 'erosion';

/** True if the material has every one of the properties. */
export const has = (m: Material, props: Prop[]) => props.every((p) => typeof m[p] === 'number' && Number.isFinite(m[p] as number) && (m[p] as number) > -Infinity);

/** The materials that have all the properties a tool needs, optionally limited to some kinds. */
export const withProps = (props: Prop[], kinds?: Kind[]) => MATERIALS.filter((m) => has(m, props) && (!kinds || kinds.includes(m.kind)));

/** Materials grouped by family, in the order of FAMILIES, for a select with optgroups. */
export function grouped(list: Material[]) {
  return Object.entries(FAMILIES).map(([f, v]) => ({ family: f, label: v.name, items: list.filter((m) => m.family === f) })).filter((g) => g.items.length);
}

const byKey = new Map(MATERIALS.map((m) => [m.key, m]));
const byName = new Map(MATERIALS.map((m) => [m.name, m]));
/** A material by key or by name. */
export const material = (id: string) => byKey.get(id) ?? byName.get(id);

/** The materials of the site's worked examples, by role. Tools start with these selected. */
export const DEFAULTS = {
  caseSteel: slug('D6AC (AMS 6431)'),
  boltSteel: slug('4340 / EN24T'),
  stainless: slug('Stainless 304L'),
  titanium: slug('Ti-6Al-4V (Gr 5)'),
  aluminium: slug('Al 7075-T6'),
  nickel: slug('Inconel 718'),
  cfrpLaminate: slug('Carbon/epoxy, quasi-isotropic laminate'),
  cfrpCase: slug('Carbon/epoxy, filament-wound case (hoop)'),
  epdm: slug('EPDM insulation (aramid filled)'),
  propellant: slug('Composite propellant, HTPB type (illustrative)'),
} as const;

/** The fields a tool script needs, as plain JSON for a <script type="application/json"> block. */
export const pack = (list: Material[], props: Prop[]) =>
  Object.fromEntries(list.map((m) => [m.key, { name: m.name, family: m.family, ...Object.fromEntries(props.map((p) => [p, m[p] ?? null])), defaults: m.defaults }]));
