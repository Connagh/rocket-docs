// Component atlas: a hardware half-section of a generic case-bonded motor. Select a part to see its job, loads,
// failure modes, materials (then → now) and what goes on its drawing. Schematic: proportions chosen for legibility.
import React, { useId } from 'react';
import { View } from 'react-native';
import { Text, useTheme } from '@castui/cast-ui';
import { Calc, Wide, ChipFilter, Hint, A, useForm } from './kit';

type Link = { href: string; label: string };
const PARTS: { key: string; n: number; name: string; job: string; loads: string; fails: string; then: string; now: string; drawing: string; links: Link[] }[] = [
  { key: 'fwd', n: 1, name: 'Forward closure & igniter boss',
    job: 'Closes the forward end of the pressure vessel and carries the igniter boss, and, on most motors, the forward skirt load path.',
    loads: 'Pressure: membrane tension in the dome, bending where it meets the cylinder and around the boss. Igniter and port loads; handling.',
    fails: 'Discontinuity bending at the boss and the dome–cylinder junction; leaks past the boss seals; buckling of the knuckle of a thin ellipsoidal head, which carries compressive hoop stress.',
    then: 'Integral with a welded or forged steel case.',
    now: 'On composite cases, a metal polar boss (titanium, aluminium or steel) with fibre wound over it on a geodesic dome contour.',
    drawing: 'Boss thread class and seal-surface finish; dome contour; weld NDT where welded; the boss-to-composite interface. The igniter itself is energetics: this site covers only its boss, housing and seals.',
    links: [{ href: '../case-sizing/', label: 'Case sizing: domes' }] },
  { key: 'case', n: 2, name: 'Case (pressure shell)',
    job: 'The pressure vessel and, on most stages and missiles, the main airframe as well.',
    loads: 'Hoop and axial pressure stress; thrust; flight bending; heat soak-back after burnout; handling. Axial compression and external pressure when it is not pressurised.',
    fails: 'Burst; a flaw growing to critical size; buckling while unpressurised; impact damage on a composite case that cannot be seen from outside.',
    then: 'Welded ultra-high-strength steel (D6AC, maraging steels), or titanium on some upper stages.',
    now: 'Filament-wound carbon/epoxy on most high-performance motors (aramid/epoxy before it). Steel where cost, robustness or heritage wins.',
    drawing: 'Material and heat-treat specification, proof test, NDT and fracture-control class. For composites: fibre and resin specification, winding pattern and cure.',
    links: [{ href: '../case-sizing/', label: 'Case sizing' }, { href: '../../verify/proof-testing/', label: 'Proof testing' }] },
  { key: 'skirt', n: 3, name: 'Skirts',
    job: 'Cylindrical extensions that attach the motor to the vehicle and carry interface loads around the domes, so the pressure-carrying domes are not also bending.',
    loads: 'Thrust, bending and shear from the vehicle, plus the mismatch as the case grows under pressure and the skirt does not.',
    fails: 'Buckling; fastener and attach-ring failure; peel at the skirt-to-case bond.',
    then: 'Machined or forged integrally with a metal case.',
    now: 'On composite cases, bonded on through a rubber shear ply that lets the case grow without tearing the skirt off.',
    drawing: 'Interface hole pattern and datums from the vehicle ICD; bond preparation and shear-ply specification; fastener torques.',
    links: [{ href: '../../joints/load-paths/', label: 'Load paths & joints' }] },
  { key: 'joints', n: 4, name: 'Joints & seals',
    job: 'Join closures, nozzle and (in segmented motors) case segments, and keep the hot gas in.',
    loads: 'Pressure end load through pins, bolts or lock rings; joint rotation as the case balloons, which tries to open the seal gap.',
    fails: 'Joint rotation opening the gap faster than the O-ring can follow (Challenger, 1986); pin bearing and shear-out; hot gas finding a path through the insulation to the seals.',
    then: 'Single O-ring seals; tang-and-clevis pinned joints on segmented boosters.',
    now: 'Primary and secondary seals with a leak-check port between them; capture features that limit joint rotation; insulation shaped to keep gas away from the seals.',
    drawing: 'Groove dimensions and surface finish; seal compound and cure date; leak-check pressure and acceptance; fastener preload.',
    links: [{ href: '../../seals/o-ring-design/', label: 'O-ring design' }] },
  { key: 'insul', n: 5, name: 'Insulation, liner & flaps',
    job: 'Insulation keeps combustion gas off the case; the liner bonds the propellant to the insulation; stress-relief flaps let the grain ends move without tearing the bond.',
    loads: 'Heating, erosion and char from the gas side; grain shrinkage and pressurisation loads across the bondline.',
    fails: 'Burn-through; debonds that open a path for flame to reach the case.',
    then: 'Asbestos- and silica-filled nitrile rubber (NBR).',
    now: 'Aramid- or silica-filled EPDM: lower density, better ageing, no asbestos.',
    drawing: 'Thickness by zone; surface preparation, adhesive and liner specification; cure schedule; the NDT that verifies the bond.',
    links: [{ href: '../insulation/', label: 'Insulation & ablatives' }, { href: '../propellant-grain/', label: 'Grain: bondline stress' }] },
  { key: 'aft', n: 6, name: 'Aft closure',
    job: 'Carries the nozzle and its loads into the case through the aft polar boss.',
    loads: 'Pressure; the nozzle blow-off load; thrust-vector actuation and side loads; the hottest chamber gas, accelerating as it turns into the nozzle.',
    fails: 'Boss and joint failure under combined pressure and nozzle loads; insulation erosion where the flow turns into the nozzle.',
    then: 'Bolted steel closure.',
    now: 'Integral polar boss in metal or wound composite, with the nozzle often submerged into the case to shorten the motor.',
    drawing: 'Boss interface to the nozzle, seal grooves, bolt pattern and preload, and the aft-dome insulation: usually the thickest in the motor.',
    links: [{ href: '../insulation/', label: 'Insulation: aft dome' }] },
  { key: 'nozzle', n: 7, name: 'Nozzle structure',
    job: 'Holds the ablative liners in the right shape and carries pressure and thrust loads into the aft closure.',
    loads: 'Pressure on the convergent section; thrust; heat soaking through the liners; steering loads.',
    fails: 'Bondline overheating behind the liners; gas leaking along a liner-to-housing interface; ply lift in carbon-phenolic liners.',
    then: 'Steel housings.',
    now: 'Aluminium, titanium or composite housings; submerged nozzles.',
    drawing: 'Liner-to-housing bond and gap control; housing material and heat treatment; internal joint seals.',
    links: [{ href: '../insulation/', label: 'Nozzle ablatives' }] },
  { key: 'throat', n: 8, name: 'Throat insert',
    job: 'Holds the throat area (and so chamber pressure) steady while the hottest, fastest gas in the motor passes it.',
    loads: 'The highest heat flux in the motor; severe thermal shock at ignition; oxidation by H₂O and CO₂ in the exhaust.',
    fails: 'Erosion (throat area grows, so pressure and thrust fall); thermal-shock cracking; fragments ejected through the nozzle.',
    then: 'Bulk or pyrolytic graphite; refractory metals such as tungsten on small motors.',
    now: 'Carbon–carbon, often 3-D woven, for toughness under thermal shock at low mass.',
    drawing: 'Material grade and density; orientation of the reinforcement; fit to the housing at temperature as well as at assembly.',
    links: [{ href: '../../legacy/?z=diffexp', label: 'Differential expansion (v1)' }] },
  { key: 'exit', n: 9, name: 'Exit cone',
    job: 'Expands the gas to supersonic speed, turning chamber pressure into exhaust velocity.',
    loads: 'Heat and erosion, falling with distance from the throat; side loads from flow separation when an over-expanded nozzle fires at sea level; vibration.',
    fails: 'Erosion and char; ply lift and delamination; structural failure under separation side loads.',
    then: 'Tape-wrapped carbon- and silica-phenolic over a metal shell.',
    now: 'Thin carbon–carbon cones that cool by radiating; extendible exit cones on upper stages, for a bigger expansion ratio in the same stowed length.',
    drawing: 'Ply angle and wrap specification; char and erosion allowances; attach flange and seal to the housing.',
    links: [{ href: '../insulation/', label: 'Nozzle ablatives' }] },
  { key: 'tvc', n: 10, name: 'Thrust vector control',
    job: 'Steers the vehicle by swivelling the thrust.',
    loads: 'Actuator loads; a flexible bearing carries the full nozzle blow-off load while it flexes; heat.',
    fails: 'Elastomer overheating or ageing in the bearing; actuator stall; torque rising at low temperature as the elastomer stiffens.',
    then: 'Jet vanes or jetavators in the exhaust, or liquid injected into the nozzle (Titan III’s solid boosters injected nitrogen tetroxide).',
    now: 'A movable nozzle on a flexible bearing (laminated elastomer pads and metal or composite shims that flex in shear) driven by actuators, increasingly electromechanical.',
    drawing: 'Elastomer compound and shim material; bearing stiffness and torque at temperature; actuator attach points.',
    links: [{ href: '../../legacy/?z=visco', label: 'Viscoelasticity (v1)' }] },
];

// Badge position and the point on the part its leader line touches.
const BADGES: Record<string, [number, number, number, number]> = {
  fwd: [92, 186, 158, 202], case: [430, 104, 430, 131], skirt: [176, 94, 192, 121], joints: [92, 276, 146, 259],
  insul: [330, 168, 330, 143], aft: [662, 206, 710, 214], nozzle: [800, 184, 790, 207], throat: [790, 293, 790, 276],
  exit: [905, 172, 890, 211], tvc: [752, 178, 746, 206],
};

function Part({ k, sel, onPick, children }: { k: string; sel: string; onPick: (k: string) => void; children: React.ReactNode }) {
  return (
    <g className={`ha-part${sel === k ? ' on' : ''}`} onClick={() => onPick(k)}>
      {children}
    </g>
  );
}

function Card({ p }: { p: (typeof PARTS)[number] }) {
  const { scheme, colors, spacing } = useTheme();
  const rows: [string, string, boolean?][] = [['Carries', p.loads], ['Fails by', p.fails], ['Then', p.then], ['Now', p.now], ['On the drawing', p.drawing, true]];
  return (
    <View
      accessibilityRole={'region' as never}
      accessibilityLabel={p.name}
      style={{ borderWidth: 1, borderColor: scheme.list.separator, borderLeftWidth: 3, borderLeftColor: colors.brand.bold.default.bg, borderRadius: 8, padding: spacing.md, gap: spacing.sm, backgroundColor: 'var(--rd-panel)' as never }}
    >
      <Text type="title-md" color={scheme.text.primary}>{`${p.n}. ${p.name}`}</Text>
      <Hint style={{ color: scheme.text.primary, fontSize: 14.5, lineHeight: 22 }}>{p.job}</Hint>
      <View {...({ dataSet: { atlasGrid: '' } } as object)}>
        {rows.map(([dt, dd, wide]) => (
          <View key={dt} {...({ dataSet: wide ? { atlasWide: '' } : {} } as object)} style={{ gap: 2 }}>
            <Text type="label-sm" color={scheme.text.description} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>{dt}</Text>
            <Hint style={{ color: scheme.text.primary }}>{dd}</Hint>
          </View>
        ))}
      </View>
      <Hint>
        Go deeper:{' '}
        {p.links.map((l, j) => (
          <React.Fragment key={l.href}>
            {j > 0 ? ' · ' : ''}
            <A href={l.href}>{l.label}</A>
          </React.Fragment>
        ))}
      </Hint>
    </View>
  );
}

function Atlas() {
  const { v, set } = useForm();
  const id = useId().replace(/:/g, '');
  const sel = v.part;
  const pick = (k: string) => set('part', k);
  const p = PARTS.find((x) => x.key === sel) ?? PARTS[0];
  return (
    <Wide>
      <svg viewBox="0 82 960 230" role="img" aria-label="Motor hardware half-section, schematic, not to scale" className="ha-svg has-sel">
        <desc>
          Upper half of a solid rocket motor, centreline at the bottom. From left: the igniter in the forward polar boss, the forward dome,
          the cylindrical case with skirts at each end, insulation and the propellant grain inside, the aft dome and polar boss, a flexible
          bearing, and the nozzle with its housing, throat insert and exit cone. Numbered markers select each component.
        </desc>
        <defs>
      <pattern id={`${id}-flex`} width="5" height="6" patternUnits="userSpaceOnUse">
        <rect width="5" height="6" fill="#b08a2e" />
        <rect width="2" height="6" fill="var(--rd-steel)" />
      </pattern>
      <linearGradient id={`${id}-gas`} x1="0" x2="1">
        <stop offset="0" stopColor="var(--rd-hot)" stopOpacity="0.05" />
        <stop offset="0.75" stopColor="var(--rd-hot)" stopOpacity="0.22" />
        <stop offset="1" stopColor="var(--rd-hot)" stopOpacity="0.05" />
      </linearGradient>
    </defs>

    {/* gas path and grain (context only) */}
    <path d="M190,240 L690,240 L722,230 L785,274 L795,274 L940,200 L940,300 L190,300 Z" fill={`url(#${id}-gas)`} />
    <path d="M190,240 L190,177.5 A66,154 0 0 1 230,146 L640,146 A66,154 0 0 1 680,177.5 L680,240 Z"
      fill="var(--rd-propellant)" fillOpacity="0.35" stroke="var(--rd-propellant)" strokeOpacity="0.6" />
    <text x="435" y="200" textAnchor="middle" fontSize="12" fill="var(--rd-muted)">propellant grain</text>
    <text x="435" y="272" textAnchor="middle" fontSize="12" fill="var(--rd-muted)">bore: hot gas</text>
    <line x1="20" y1="300" x2="950" y2="300" stroke="var(--rd-muted)" strokeDasharray="14 4 3 4" />
    <text x="24" y="294" fontSize="10" fill="var(--rd-muted)">℄</text>

    <Part k="insul" sel={sel} onPick={pick}>
      <path d="M154.4,260 A78,163 0 0 1 230,137 L640,137 A78,163 0 0 1 710.4,230 L698.8,230 A66,154 0 0 0 640,146 L230,146 A66,154 0 0 0 166.3,260 Z" fill="var(--rd-insul)" />
      <path d="M606,149 L640,149 A63,151 0 0 1 668,181" fill="none" stroke="var(--rd-panel)" strokeWidth="2.5" />
    </Part>
    <Part k="case" sel={sel} onPick={pick}>
      <rect x="230" y="130" width="410" height="7" fill="var(--rd-steel)" />
    </Part>
    <Part k="fwd" sel={sel} onPick={pick}>
      <path d="M147.4,260 A85,170 0 0 1 230,130 L230,137 A78,163 0 0 0 154.4,260 Z" fill="var(--rd-steel)" />
      <rect x="134" y="244" width="30" height="16" fill="var(--rd-steel)" />
      <rect x="118" y="274" width="92" height="26" rx="3" fill="#7d858c" />
      <rect x="130" y="260" width="22" height="14" fill="#7d858c" />
    </Part>
    <Part k="aft" sel={sel} onPick={pick}>
      <path d="M640,130 A85,170 0 0 1 717.5,230 L710.4,230 A78,163 0 0 0 640,137 Z" fill="var(--rd-steel)" />
      <rect x="704" y="212" width="34" height="18" fill="var(--rd-steel)" />
    </Part>
    <Part k="skirt" sel={sel} onPick={pick}>
      <rect x="150" y="121" width="112" height="8" fill="var(--rd-steel)" fillOpacity="0.75" />
      <rect x="610" y="121" width="120" height="8" fill="var(--rd-steel)" fillOpacity="0.75" />
      <rect x="230" y="129" width="32" height="1.6" fill="#b08a2e" />
      <rect x="610" y="129" width="30" height="1.6" fill="#b08a2e" />
    </Part>
    <Part k="tvc" sel={sel} onPick={pick}>
      <rect x="738" y="206" width="14" height="26" fill={`url(#${id}-flex)`} />
    </Part>
    <Part k="nozzle" sel={sel} onPick={pick}>
      <polygon points="752,206 806,206 812,248 770,248 770,251.5 752,238.9" fill="var(--rd-steel)" />
      <polygon points="722,230 770,263.5 770,251.5 722,218" fill="#4a3b33" />
    </Part>
    <Part k="throat" sel={sel} onPick={pick}>
      <polygon points="770,263.5 785,274 795,274 805,268.9 805,248 770,248" fill="#2b2f33" stroke="#5a6168" strokeWidth="0.8" />
    </Part>
    <Part k="exit" sel={sel} onPick={pick}>
      <polygon points="805,268.9 940,200 940,190 805,258" fill="#4a3b33" />
      <polygon points="805,258 940,190 940,186 805,254" fill="var(--rd-steel)" />
    </Part>
    <Part k="joints" sel={sel} onPick={pick}>
      <circle cx="146" cy="259" r="3.6" fill="var(--rd-accent)" />
      <circle cx="712" cy="233" r="3.6" fill="var(--rd-accent)" />
      <circle cx="808" cy="252" r="3.6" fill="var(--rd-accent)" />
    </Part>
        {PARTS.map((q) => {
          const [bx, by, tx, ty] = BADGES[q.key];
          return (
            <g key={q.key} className={`ha-badge${sel === q.key ? ' on' : ''}`} onClick={() => pick(q.key)}>
              <line x1={bx} y1={by} x2={tx} y2={ty} stroke="var(--rd-muted)" strokeWidth={1} />
              <circle cx={bx} cy={by} r={11} />
              <text x={bx} y={by + 4} textAnchor="middle" fontSize={11} fontWeight={700}>{q.n}</text>
            </g>
          );
        })}
        <g fontSize={10} fill="var(--rd-muted)">
          <circle cx={830} cy={98} r={3.6} fill="var(--rd-accent)" /><text x={840} y={102}>seal</text>
          <rect x={870} y={93} width={12} height={10} fill={`url(#${id}-flex)`} /><text x={888} y={102}>flex bearing</text>
        </g>
      </svg>
      <ChipFilter name="part" label="Motor components" options={PARTS.map((q) => ({ value: q.key, label: `${q.n} ${q.name}` }))} />
      <Card p={p} />
    </Wide>
  );
}

export default function HardwareAtlas() {
  return (
    <Calc
      id="hardware-atlas"
      title="Motor hardware: half-section, schematic, not to scale"
      defaults={{ part: 'fwd' }}
      share={false}
      foot="Select a number on the drawing or a name below it. Proportions are for legibility only: no design dimensions implied."
    >
      <Atlas />
    </Calc>
  );
}
