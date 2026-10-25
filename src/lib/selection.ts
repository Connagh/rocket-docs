// Material selection: property axes, Ashby performance indices, ranking.
// Each index M is "bigger is better"; on log axes y = C·xˢ, materials above the
// guideline through a reference point score higher. Derivations on /materials/selection/.

export interface Material {
  name: string; family: string; summary: string; spec: string;
  density: number; // g/cm³
  uts: number; yield: number; // MPa
  E?: number; // GPa
  k?: number; // W/m·K
  cte?: number; // µm/m·K
  kic?: number; // MPa·√m
  maxServiceTemp: number; // °C
  weldable: boolean;
  corrosion: number | null; machinability: number | null; pricePerKg: number | null;
  kicIsFamilyDefault?: boolean;
}

export interface Property { key: string; label: string; unit: string; get: (m: Material) => number | undefined; }

export const PROPERTIES: Property[] = [
  { key: 'density', label: 'Density', unit: 'g/cm³', get: (m) => m.density },
  { key: 'E', label: "Young's modulus", unit: 'GPa', get: (m) => m.E },
  { key: 'yield', label: 'Yield / failure strength', unit: 'MPa', get: (m) => m.yield },
  { key: 'uts', label: 'Ultimate strength', unit: 'MPa', get: (m) => m.uts },
  { key: 'kic', label: 'Fracture toughness K_IC', unit: 'MPa√m', get: (m) => m.kic },
  { key: 'k', label: 'Thermal conductivity', unit: 'W/m·K', get: (m) => m.k },
  { key: 'cte', label: 'Thermal expansion', unit: 'µm/m·K', get: (m) => m.cte },
  { key: 'tmax', label: 'Max service temperature', unit: '°C', get: (m) => m.maxServiceTemp },
  { key: 'price', label: 'Indicative price', unit: '£/kg', get: (m) => m.pricePerKg ?? undefined },
  { key: 'spStrength', label: 'Specific strength σ/ρ', unit: 'kN·m/kg', get: (m) => m.yield / m.density },
  { key: 'spStiffness', label: 'Specific stiffness E/ρ', unit: 'MN·m/kg', get: (m) => (m.E ? m.E / m.density : undefined) },
  { key: 'Ealpha', label: 'Thermal stress per kelvin Eα', unit: 'MPa/K', get: (m) => (m.E && m.cte ? m.E * m.cte * 1e-3 : undefined) },
];
export const prop = (key: string) => PROPERTIES.find((p) => p.key === key)!;

export interface Index {
  key: string; name: string; tex: string; x: string; y: string; slope: number;
  value: (m: Material) => number | undefined; use: string;
}

const pos = (v: number | undefined) => (v !== undefined && v > 0 ? v : undefined);

export const INDICES: Index[] = [
  { key: 'tie', name: 'Light, strong tie or pressure-vessel wall', tex: '\\sigma_y/\\rho', x: 'density', y: 'yield', slope: 1,
    value: (m) => m.yield / m.density, use: 'Motor cases, tanks, tension members: mass for a given load or pressure.' },
  { key: 'tieStiff', name: 'Light, stiff tie', tex: 'E/\\rho', x: 'density', y: 'E', slope: 1,
    value: (m) => pos(m.E) && m.E! / m.density, use: 'Stiffness-limited struts and rods in tension.' },
  { key: 'beamStiff', name: 'Light, stiff beam', tex: 'E^{1/2}/\\rho', x: 'density', y: 'E', slope: 2,
    value: (m) => pos(m.E) && Math.sqrt(m.E!) / m.density, use: 'Brackets and beams sized by deflection, shape free.' },
  { key: 'panelStiff', name: 'Light, stiff panel', tex: 'E^{1/3}/\\rho', x: 'density', y: 'E', slope: 3,
    value: (m) => pos(m.E) && Math.cbrt(m.E!) / m.density, use: 'Plates and skins sized by bending stiffness or buckling.' },
  { key: 'beamStrong', name: 'Light, strong beam', tex: '\\sigma_y^{2/3}/\\rho', x: 'density', y: 'yield', slope: 1.5,
    value: (m) => Math.pow(m.yield, 2 / 3) / m.density, use: 'Beams and brackets sized by bending strength.' },
  { key: 'panelStrong', name: 'Light, strong panel', tex: '\\sigma_y^{1/2}/\\rho', x: 'density', y: 'yield', slope: 2,
    value: (m) => Math.sqrt(m.yield) / m.density, use: 'Plates sized by bending strength.' },
  { key: 'ybb', name: 'Yield before break', tex: 'K_{IC}/\\sigma_y', x: 'yield', y: 'kic', slope: 1,
    value: (m) => pos(m.kic) && m.kic! / m.yield, use: 'Fracture-critical parts: a crack the size of this index (squared) can be tolerated at yield.' },
  { key: 'lbb', name: 'Leak before break (pressure vessel)', tex: 'K_{IC}^2/\\sigma_y', x: 'yield', y: 'kic', slope: 0.5,
    value: (m) => pos(m.kic) && m.kic! ** 2 / m.yield, use: 'Thin-walled vessels: largest wall that still leaks before it breaks.' },
  { key: 'shock', name: 'Thermal stress resistance', tex: '\\sigma_y/(E\\alpha)', x: 'Ealpha', y: 'yield', slope: 1,
    value: (m) => (m.E && m.cte ? m.yield / (m.E * m.cte * 1e-3) : undefined), use: 'Allowable temperature difference before thermal stress yields the part.' },
  { key: 'distortion', name: 'Low thermal distortion', tex: 'k/\\alpha', x: 'cte', y: 'k', slope: 1,
    value: (m) => (m.k && m.cte ? m.k / m.cte : undefined), use: 'Parts that must stay flat or true with heat flowing through them.' },
];
export const index = (key: string) => INDICES.find((i) => i.key === key)!;

export interface Filters {
  families: string[]; minServiceTemp: number; weldableOnly: boolean; hideDefaultToughness: boolean;
}

export function rank(materials: Material[], idx: Index, f: Filters) {
  return materials
    .filter((m) => f.families.includes(m.family) && m.maxServiceTemp >= f.minServiceTemp && (!f.weldableOnly || m.weldable))
    .filter((m) => !(f.hideDefaultToughness && (idx.key === 'ybb' || idx.key === 'lbb') && m.kicIsFamilyDefault))
    .map((m) => ({ m, v: idx.value(m) }))
    .filter((r): r is { m: Material; v: number } => r.v !== undefined && Number.isFinite(r.v) && r.v > 0)
    .sort((a, b) => b.v - a.v);
}

/** y on the guideline of slope s through (x0, y0), at x. */
export const guideline = (x: number, x0: number, y0: number, s: number) => y0 * Math.pow(x / x0, s);
