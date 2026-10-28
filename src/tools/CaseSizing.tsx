// Metallic motor case / pressure vessel screening calculator. Calculations live in src/lib/pv.ts (unit-tested).
import React from 'react';
import { sizeCase, units, type PressureUnit, type DomeType } from '../lib/pv';
import { readFactor, awaitingMessage } from '../lib/factors';
import {
  Calc, Inputs, Outputs, Wide, Group, FieldRow, Num, Choice, Readouts, Readout, Notes, Note, Figure, Hint, SubHead,
  useForm, num, fmt, fmtMs, msTone, type OptionGroup, type Tone,
} from './kit';

export type CaseMat = {
  key: string; name: string; family: string; spec: string; uts: number; yield: number; density: number;
  kic?: number; kicIsFamilyDefault?: boolean; maxServiceTemp: number; weldable?: boolean;
};

type Props = { groups: OptionGroup[]; mats: Record<string, CaseMat>; defaultMat: string };

function Results({ mats }: { mats: Record<string, CaseMat> }) {
  const { v } = useForm();
  const m = mats[v.m] ?? Object.values(mats)[0];
  const u = v.u as PressureUnit;
  const toMPa = units[u];
  const pd = u === 'psi' ? 0 : u === 'bar' ? 1 : 2;
  const P = (mpa: number) => fmt(mpa / toMPa, pd);
  const pf = readFactor(v.pf), bf = readFactor(v.bf);
  const haveFactors = pf !== null && bf !== null;
  const checking = num(v.t) > 0;

  const matInfo = `UTS ${m.uts} MPa · yield ${m.yield} MPa · ρ ${m.density} g/cm³ · K_IC ≈ ${m.kic ?? '—'} MPa√m${
    m.kicIsFamilyDefault ? ' (family default)' : ''} · max service ~${m.maxServiceTemp} °C. ${m.spec}`;

  if (!haveFactors && !checking) {
    return (
      <>
        <Hint>{matInfo}</Hint>
        <Readouts>
          <Readout label="Minimum wall" value="—" primary />
          <Readout label="Governed by" value="—" />
        </Readouts>
        <Notes
          items={[
            { tone: 'warn', text: awaitingMessage(['proof factor', 'burst factor'], 'the required wall, test pressures and margins') },
            { tone: 'info', text: 'Or enter an as-designed wall to see its stresses, burst pressure, leak-before-break and mass without them.' },
          ]}
        />
      </>
    );
  }

  const res = sizeCase({
    idMm: num(v.id), lengthMm: num(v.L), meop: num(v.p) * toMPa, proofFactor: pf ?? 1, burstFactor: bf ?? 1,
    weldEff: num(v.e), dome: v.dome as DomeType, tMm: num(v.t) || undefined, material: m,
  });
  const need = 'needs factors';
  const lbbTone: Tone | undefined = res.leakBeforeBreak === null ? undefined : res.leakBeforeBreak ? 'ok' : 'bad';

  const notes: { tone: Tone; text: React.ReactNode }[] = [];
  if (!haveFactors) {
    notes.push({ tone: 'warn', text: `Showing the as-designed wall without factors. ${awaitingMessage(['proof factor', 'burst factor'], 'its test pressures and margins')}` });
  } else {
    if (!Number.isFinite(res.t)) notes.push({ tone: 'bad', text: 'Design pressure exceeds the allowable stress: no wall thickness works. Pick a stronger material or lower MEOP.' });
    if (!res.thinWallOk) notes.push({ tone: 'warn', text: `t/r = ${fmt(res.tOverR, 3)} ≥ 0.1: thin-wall theory is unconservative here. The sizing above already uses Lamé, which is exact for the cylinder away from its ends.` });
    if (res.leakBeforeBreak === false) notes.push({ tone: 'bad', text: `A crack that has just broken through the wall would run unstably at MEOP (critical ½-length ${fmt(res.cMeop, 2)} mm < wall ${fmt(res.t, 2)} mm). Expect burst without a warning leak. Safety then rests on NDT finding cracks reliably, and on the proof test, which fails any through-crack longer than about ${fmt(2 * res.cProof, 1)} mm on the test stand instead of in service.` });
    if (m.kicIsFamilyDefault) notes.push({ tone: 'warn', text: 'Fracture toughness for this alloy is a family default: treat the fracture result as a rough indication only.' });
    if (m.maxServiceTemp < 150) notes.push({ tone: 'warn', text: `Maximum service temperature ~${m.maxServiceTemp} °C. Confirm the insulation keeps the case below this for the whole burn and soak-back.` });
    if (!m.weldable && num(v.e) < 1) notes.push({ tone: 'warn', text: `${m.name} is not normally fusion-welded. A weld efficiency below 1.0 implies a weld that this alloy may not tolerate.` });
  }
  const meop = num(v.p) * toMPa;

  return (
    <>
      <Hint>{matInfo}</Hint>
      <Readouts>
        <Readout label={checking ? 'Wall checked' : 'Minimum wall'} value={Number.isFinite(res.t) ? fmt(res.t, 3) : 'none'} unit="mm" primary />
        <Readout
          label="Governed by"
          value={!haveFactors ? need : checking ? `min ${fmt(res.tReq, 3)} mm (${res.governs})` : res.governs === 'burst' ? 'Burst (UTS)' : 'Proof (yield)'}
        />
        <Readout label="Thin-wall estimate" value={haveFactors ? fmt(res.tThinReq, 3) : need} unit={haveFactors ? 'mm' : undefined} />
        <Readout label="t / r" value={fmt(res.tOverR, 4)} sub={res.thinWallOk ? 'thin wall' : 'thick wall'} />
      </Readouts>

      <SubHead>Stress at MEOP</SubHead>
      <Readouts>
        <Readout label="Hoop σₕ" value={fmt(res.hoopMeop, 0)} unit="MPa" />
        <Readout label="Axial σₐ" value={fmt(res.axialMeop, 0)} unit="MPa" />
        <Readout label="Dome wall" value={fmt(res.domeT, 3)} unit="mm" />
      </Readouts>

      <SubHead>Pressures and margins</SubHead>
      <Readouts>
        <Readout label="Proof pressure" value={haveFactors ? P(res.pProof) : need} unit={haveFactors ? u : undefined} />
        <Readout label="Design burst" value={haveFactors ? P(res.pBurst) : need} unit={haveFactors ? u : undefined} />
        <Readout label="Predicted burst" value={P(res.predictedBurst)} unit={u} />
        <Readout label="MS burst" value={haveFactors ? fmtMs(res.msBurst) : need} tone={haveFactors ? msTone(res.msBurst) : undefined} />
        <Readout label="MS yield at proof" value={haveFactors ? fmtMs(res.msProof) : need} tone={haveFactors ? msTone(res.msProof) : undefined} />
      </Readouts>
      {haveFactors ? <PressureBar meop={meop} proof={res.pProof} burst={res.pBurst} predicted={res.predictedBurst} toMPa={toMPa} u={u} /> : null}

      <SubHead>Fracture: Irwin leak-before-break screen</SubHead>
      <Readouts>
        <Readout label="Critical crack ½-length at MEOP" value={fmt(res.cMeop, 2)} unit="mm" />
        <Readout label="…at proof" value={haveFactors ? fmt(res.cProof, 2) : need} unit={haveFactors ? 'mm' : undefined} />
        <Readout label="Leak before break?" value={res.leakBeforeBreak === null ? '—' : res.leakBeforeBreak ? 'Likely' : 'No'} tone={lbbTone} />
      </Readouts>

      <SubHead>Mass and efficiency</SubHead>
      <Readouts>
        <Readout label="Case mass" value={fmt(res.mass, 2)} unit="kg" />
        <Readout label="Internal volume" value={fmt(res.volume / 1e6, 1)} unit="L" />
        <Readout label="p_b V / W" value={fmt(res.pvw / 1000, 1)} unit={`km · ${fmt(res.pvw / 0.0254 / 1e6, 2)}×10⁶ in`} />
      </Readouts>

      {Number.isFinite(res.t) ? <Ring t={res.t} ri={res.ri} ro={res.ro} /> : null}
      <Notes items={notes} />
    </>
  );
}

/** Pressure scale: MEOP, proof, design burst and predicted burst on one axis, labels placed so they don't collide. */
function PressureBar({ meop, proof, burst, predicted, toMPa, u }: { meop: number; proof: number; burst: number; predicted: number; toMPa: number; u: string }) {
  const marks = [
    { p: meop, label: 'MEOP', c: 'var(--rd-ink)' },
    { p: proof, label: 'proof', c: 'var(--rd-blue)' },
    { p: burst, label: 'design burst', c: 'var(--rd-accent)' },
    { p: predicted, label: 'predicted burst', c: 'var(--rd-ok)' },
  ].filter((m) => Number.isFinite(m.p));
  const max = Math.max(...marks.map((m) => m.p)) * 1.08 || 1;
  const X = (p: number) => 10 + (p / max) * 400;
  const rows = [{ y: 14, up: true }, { y: 94, up: false }, { y: 30, up: true }, { y: 78, up: false }];
  const taken: [number, number][][] = rows.map(() => []);
  const placed = marks.map((m) => {
    const text = `${m.label} ${fmt(m.p / toMPa, u === 'psi' ? 0 : 1)}`, w = text.length * 6.6, x = X(m.p);
    const anchor = x > 340 ? 'end' : x < 70 ? 'start' : 'middle';
    const x0 = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2, x1 = x0 + w;
    let k = rows.findIndex((_, j) => taken[j].every(([a, b]) => x1 + 6 < a || x0 - 6 > b));
    if (k < 0) k = 0;
    taken[k].push([x0, x1]);
    return { ...m, text, x, anchor, row: rows[k] };
  });
  return (
    <Figure label="Pressure scale showing MEOP, proof, design burst and predicted burst">
      <svg viewBox="0 0 420 100" role="img" aria-hidden="true">
        <rect x={10} y={45} width={400} height={10} rx={5} fill="var(--rd-panel2)" stroke="var(--rd-line)" />
        <rect x={10} y={45} width={Math.max(0, X(meop) - 10)} height={10} rx={5} fill="var(--rd-hot)" fillOpacity={0.5} />
        {placed.map((m) => (
          <g key={m.label}>
            <line x1={m.x} x2={m.x} y1={m.row.up ? m.row.y + 4 : 45} y2={m.row.up ? 55 : m.row.y - 11} stroke={m.c} strokeWidth={2} />
            <text x={m.x} y={m.row.y} textAnchor={m.anchor} fontSize={11} fill={m.c}>{m.text}</text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}

/** Cross-section to scale: the point is how thin the wall is. */
function Ring({ t, ri, ro }: { t: number; ri: number; ro: number }) {
  const Ro = 110, Ri = Math.max(0, (Ro * ri) / ro);
  const td = t / (2 * ri);
  const cmp = td < 0.0015 ? 'thinner, relative to its size, than an aluminium drinks can (≈0.0015)'
    : td < 0.008 ? 'between a drinks can (≈0.0015) and an eggshell (≈0.008), relative to size'
    : td < 0.05 ? 'thicker than an eggshell (≈0.008), relative to size'
    : 'a genuinely thick-walled vessel';
  return (
    <Figure
      label="Case cross-section drawn to scale"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
    >
      <svg viewBox="0 0 240 240" role="img" aria-hidden="true" style={{ width: 132, flex: 'none' }}>
        <path
          d={`M120,${120 - Ro} a${Ro},${Ro} 0 1,0 0.01,0 Z M120,${120 - Ri} a${Ri},${Ri} 0 1,0 0.01,0 Z`}
          fillRule="evenodd"
          fill="var(--rd-steel)"
        />
        <circle cx={120} cy={120} r={Ri} fill="var(--rd-hot)" fillOpacity={0.15} />
      </svg>
      <Hint style={{ flex: 1 }}>
        {`Drawn to scale. Wall-to-diameter ratio t/D = ${fmt(td, 4)}: ${cmp}. Almost all of the strength is in a skin you can barely see.`}
      </Hint>
    </Figure>
  );
}

export default function CaseSizing({ groups, mats, defaultMat }: Props) {
  return (
    <Calc
      title="Motor case sizing: metallic, membrane only"
      defaults={{ m: defaultMat, id: '300', L: '1000', dome: 'hemi', p: '10', u: 'MPa', pf: '', bf: '', e: '0.9', t: '' }}
      example={{
        values: { m: defaultMat, id: '300', L: '1000', dome: 'hemi', p: '10', u: 'MPa', pf: '1.10', bf: '1.25', e: '0.9', t: '' },
        note: 'Worked-example factors loaded: proof 1.10, burst 1.25',
        factorFields: ['pf', 'bf'],
      }}
      foot={
        <>
          Screening tool for early sizing. Membrane stress only: it does not size dome–cylinder junctions, closures, bosses, skirts or
          joints, where real cases usually fail. K<sub>IC</sub> values are indicative. Verify against your governing standard and get
          stress sign-off before anything is built.
        </>
      }
    >
      <Inputs>
        <Group legend="Material">
          <Choice name="m" label="Alloy" groups={groups} search />
        </Group>
        <Group legend="Geometry">
          <FieldRow>
            <Num name="id" label="Internal diameter" unit="mm" />
            <Num name="L" label="Cylinder length" unit="mm" />
          </FieldRow>
          <Choice
            name="dome"
            label="End domes"
            options={[
              { value: 'hemi', label: 'Hemispherical (wall = ½ cylinder)' },
              { value: 'ellip2', label: '2:1 semi-ellipsoidal (wall ≈ cylinder)' },
            ]}
          />
        </Group>
        <Group legend="Design basis" hint="Enter your programme's factors: they come from the governing requirement, not from this site.">
          <FieldRow>
            <Num name="p" label="MEOP" />
            <Choice name="u" label="Unit" options={['MPa', 'bar', 'psi'].map((x) => ({ value: x, label: x }))} />
          </FieldRow>
          <FieldRow>
            <Num name="pf" label="Proof factor" placeholder="your value" />
            <Num name="bf" label="Burst factor" placeholder="your value" />
          </FieldRow>
          <Choice
            name="e"
            label="Weld / joint efficiency"
            options={[
              { value: '1', label: '1.00: seamless, no weld in the pressure boundary' },
              { value: '0.9', label: '0.90: full-penetration weld, fully radiographed' },
              { value: '0.85', label: '0.85: full-penetration weld, spot radiographed' },
              { value: '0.7', label: '0.70: single-sided weld, no radiography' },
            ]}
          />
          <Num name="t" label="Check an as-designed wall" unit="mm, optional" placeholder="blank = minimum required" />
        </Group>
      </Inputs>
      <Outputs>
        <Results mats={mats} />
      </Outputs>
    </Calc>
  );
}
