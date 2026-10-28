// Proof-test rig: stored energy by test medium, expected expansion, hold drift and the acceptance checks, for a thin
// cylinder with hemispherical ends. Maths in src/lib/proof.ts (unit-tested).
import React from 'react';
import { MEDIA, vesselCompliance, storedEnergy, holdDrift, expansion } from '../lib/proof';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, SubHead, Readouts, Readout, Notes, Figure, useForm, num, fmt, type OptionGroup, type Tone, type Values } from './kit';

export type Vessel = { key: string; name: string; family: string; E: number; nu: number; alpha: number };
type Props = { groups: OptionGroup[]; mats: Record<string, Vessel>; defaultMat: string };
const f = (v: number, d = 2) => (Number.isFinite(v) ? fmt(v, d) : '—');
const J = (e: number): [string, string] => (e >= 1e6 ? [f(e / 1e6, 2), 'MJ'] : e >= 1e3 ? [f(e / 1e3, 1), 'kJ'] : [f(e, 0), 'J']);
const Jt = (e: number) => J(e).join(' ');

function EnergyBars({ rows }: { rows: { name: string; e: number; sel: boolean; gas: boolean }[] }) {
  const lo = Math.floor(Math.log10(Math.min(...rows.map((x) => x.e)))), hi = Math.ceil(Math.log10(Math.max(...rows.map((x) => x.e))));
  const X = (en: number) => 170 + ((Math.log10(en) - lo) / Math.max(1, hi - lo)) * 290, H = 30 * rows.length + 26;
  const decades: number[] = [];
  for (let k = lo; k <= hi; k++) decades.push(k);
  return (
    <Figure label="Stored energy by test medium, logarithmic scale" caption="Stored energy of the same test with each medium, on a logarithmic scale. Gases in orange, liquids in blue; the selected medium is solid.">
      <svg viewBox={`0 0 480 ${H}`} aria-hidden="true">
        {decades.map((k) => (
          <g key={k}>
            <line x1={X(10 ** k)} x2={X(10 ** k)} y1={4} y2={30 * rows.length + 4} stroke="var(--rd-line)" />
            <text x={X(10 ** k)} y={30 * rows.length + 19} textAnchor="middle" fontSize={11} fill="var(--rd-muted)">{k >= 6 ? `${10 ** (k - 6)} MJ` : k >= 3 ? `${10 ** (k - 3)} kJ` : `${10 ** k} J`}</text>
          </g>
        ))}
        {rows.map((row, k) => {
          const y = 8 + k * 30;
          return (
            <g key={row.name}>
              <text x={164} y={y + 15} textAnchor="end" fontSize={12} fill={row.sel ? 'var(--rd-ink)' : 'var(--rd-muted)'} fontWeight={row.sel ? 600 : 400}>{row.name}</text>
              <rect x={170} y={y} width={Math.max(2, X(row.e) - 170)} height={20} rx={3} fill={row.gas ? 'var(--rd-accent)' : 'var(--rd-blue)'} fillOpacity={row.sel ? 0.9 : 0.4} />
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

function Results({ mats }: { mats: Record<string, Vessel> }) {
  const { v } = useForm();
  const m = mats[v.mat] ?? Object.values(mats)[0];
  const ri = num(v.d) / 2, L = num(v.L), t = num(v.t), p = num(v.p);
  if (!(ri > 0 && L >= 0 && t > 0 && p > 0)) return <Notes items={[{ tone: 'bad', text: 'Enter the diameter, length, wall and proof pressure.' }]} />;
  const V = (Math.PI * ri * ri * L + (4 / 3) * Math.PI * ri ** 3) / 1e6; // litres
  const C = vesselCompliance(ri, t, m.E, m.nu);
  const med = MEDIA.find((x) => x.key === v.med) ?? MEDIA[0];
  const liquid = med.kind === 'liquid', air = Math.max(0, num(v.air) || 0) / 100;
  const e = storedEnergy(p, V, C, med, liquid ? air : 0);
  const rows = MEDIA.map((x) => ({ name: x.name, e: storedEnergy(p, V, C, x).total, sel: x.key === med.key && !(liquid && air > 0), gas: x.kind === 'gas' }));
  if (liquid && air > 0) rows.push({ name: `${med.name} + ${f(air * 100, 1)}% air`, e: e.total, sel: true, gas: false });

  const notes: { tone: Tone; text: string }[] = [];
  const waterE = storedEnergy(p, V, C, MEDIA[0]).total, gasE = storedEnergy(p, V, C, MEDIA[2]).total;
  notes.push({ tone: 'info', text: `Nitrogen at this pressure stores about ${f(gasE / waterE, 0)}× the energy of the same test with water. A liquid barely compresses, so most of its stored energy is the vessel's own elastic strain.` });
  if (!liquid) notes.push({ tone: 'bad', text: 'Pneumatic proof testing stores blast-level energy. It is used only where liquid is genuinely unacceptable, and then with larger exclusion zones, remote operation and specific approval.' });
  if (liquid && air > 0) notes.push({ tone: 'warn', text: `Trapped air raises the stored energy from ${Jt(storedEnergy(p, V, C, med).total)} to ${Jt(e.total)}. Its effect is largest in big, low-pressure tests. Bleed from the high point until only liquid comes out.` });

  let hold: React.ReactNode = null;
  if (liquid) {
    const ex = expansion(p, V, C, med.bulk), drift = holdDrift(med.beta, m.alpha * 1e-6, med.bulk, C);
    const unexplained = num(v.dp) - drift * num(v.dT), tol = num(v.tol), holdOk = unexplained >= -tol;
    const vt = num(v.vt), vp = num(v.vp), lim = num(v.lim), ratio = vt > 0 && vp >= 0 ? (vp / vt) * 100 : NaN;
    notes.push({ tone: 'info', text: `A 1 K change in liquid temperature moves the hold pressure by ${f(drift, 3)} MPa (${f((drift / p) * 100, 1)}% of proof). Most hold-pressure drift is temperature, not leakage: record the liquid temperature and correct for it.` });
    if (Number.isFinite(unexplained) && !holdOk) notes.push({ tone: 'bad', text: `After temperature correction, ${f(-unexplained, 3)} MPa of the pressure drop is unexplained. Look for a leak at fittings, seals or the vessel before accepting.` });
    if (Number.isFinite(ratio)) {
      if (Math.abs(vt / (ex.vessel * 1000) - 1) > 0.2) notes.push({ tone: 'warn', text: `Measured total expansion (${f(vt, 0)} mL) differs from the membrane estimate (${f(ex.vessel * 1000, 0)} mL) by more than 20%. Check the wall thickness, modulus and instrumentation before trusting either.` });
      if (ratio > lim) notes.push({ tone: 'bad', text: `Permanent expansion is ${f(ratio, 1)}% of total: above the ${f(lim, 0)}% limit. The vessel yielded during proof.` });
    }
    hold = (
      <Readouts>
        <Readout label="Elastic expansion at proof" value={f(ex.vessel * 1000, 0)} unit="mL" />
        <Readout label="Liquid to pump in" value={f(ex.pumpIn * 1000, 0)} unit="mL" sub="the vessel's growth plus the liquid's compression" />
        <Readout label="Hold drift per kelvin" value={f(drift, 3)} unit="MPa/K" />
        <Readout label="Unexplained pressure change" value={Number.isFinite(unexplained) ? `${unexplained >= 0 ? '+' : ''}${f(unexplained, 3)}` : '—'} unit="MPa"
          tone={Number.isFinite(unexplained) && Number.isFinite(tol) ? (holdOk ? 'ok' : 'bad') : undefined} sub={Number.isFinite(tol) ? `allowed drop ${f(tol, 3)} MPa` : undefined} />
        <Readout label="Permanent ÷ total expansion" value={Number.isFinite(ratio) ? `${f(ratio, 1)}%` : '—'}
          tone={Number.isFinite(ratio) && Number.isFinite(lim) ? (ratio <= lim ? 'ok' : 'bad') : undefined} sub={Number.isFinite(ratio) ? (Number.isFinite(lim) ? `limit ${f(lim, 0)}%` : undefined) : 'enter the total and permanent expansion'} />
      </Readouts>
    );
  }
  const [ev, eu] = J(e.total);
  return (
    <>
      <Readouts>
        <Readout label="Stored energy, this medium" value={ev} unit={eu} primary tone={liquid ? undefined : 'bad'} />
        <Readout label="TNT equivalent" value={e.tnt >= 1 ? f(e.tnt, 2) : f(e.tnt * 1000, 1)} unit={e.tnt >= 1 ? 'kg' : 'g'} />
        <Readout label="Internal volume" value={f(V, 1)} unit="L" />
      </Readouts>
      <EnergyBars rows={rows} />
      <SubHead>Expansion and hold</SubHead>
      {hold ?? <Notes items={[{ tone: 'info', text: 'Expansion and hold-drift checks are for a liquid test medium.' }]} />}
      <Notes items={notes} />
    </>
  );
}

export default function ProofRig({ groups, mats, defaultMat }: Props) {
  const defaults: Values = { d: '300', L: '1000', t: '1.377', mat: mats[defaultMat] ? defaultMat : Object.keys(mats)[0], p: '11', med: 'water', air: '0', dp: '-0.15', dT: '-1.0', vt: '', vp: '', lim: '10', tol: '0.05' };
  return (
    <Calc
      id="test-rig"
      title="Test rig: energy, expansion, hold drift"
      defaults={defaults}
      foot="Thin cylinder with hemispherical ends. Stored energy: liquid compression p²V/2K, isentropic gas expansion to atmosphere, and elastic strain energy in the wall (½p·ΔV). Membrane compliance of the cylinder only: domes, bosses and fittings add a little. Exclusion distances come from your site safety rules, not from this number."
    >
      <Inputs>
        <Group legend="Vessel">
          <FieldRow><Num name="d" label="Internal diameter" unit="mm" /><Num name="L" label="Cylinder length" unit="mm" /></FieldRow>
          <Num name="t" label="Wall" unit="mm" />
          <Choice name="mat" label="Material" groups={groups} search />
        </Group>
        <Group legend="Test">
          <FieldRow><Num name="p" label="Proof pressure" unit="MPa" /><Choice name="med" label="Medium" options={MEDIA.map((x) => ({ value: x.key, label: x.name }))} /></FieldRow>
          <Num name="air" label="Trapped air" unit="% of volume" helper="liquid tests only" />
        </Group>
        <Group legend="Measured, for acceptance">
          <FieldRow><Num name="dp" label="Pressure change in hold" unit="MPa" /><Num name="dT" label="Liquid temperature change in hold" unit="K" /></FieldRow>
          <FieldRow><Num name="vt" label="Total expansion at proof" unit="mL" placeholder="from water jacket" /><Num name="vp" label="Permanent expansion" unit="mL" placeholder="after release" /></FieldRow>
          <FieldRow><Num name="lim" label="Permanent-set limit" unit="% of total" /><Num name="tol" label="Allowed unexplained drop" unit="MPa" /></FieldRow>
        </Group>
      </Inputs>
      <Outputs>
        <Results mats={mats} />
      </Outputs>
    </Calc>
  );
}
