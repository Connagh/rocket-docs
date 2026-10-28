// Motor mass budget: propellant mass fraction, ideal Δv, and what each inert kilogram costs. Maths in
// src/lib/massfraction.ts (unit-tested).
import React from 'react';
import { motorPerformance, inertForFraction } from '../lib/massfraction';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Hint, SubHead, Readouts, Readout, Notes, Figure, Plot, Poly, Sub, HALO, useForm, num, fmt, type Values } from './kit';

const ITEMS = [
  { key: 'case', label: 'Case', short: 'Case', value: '11.77', color: 'var(--rd-steel)' },
  { key: 'ins', label: 'Insulation and liner', short: 'Insulation', value: '4.84', color: 'var(--rd-insul)' },
  { key: 'noz', label: 'Nozzle', short: 'Nozzle', value: '6', color: 'var(--rd-accent)' },
  { key: 'oth', label: 'Skirts, bosses, igniter hardware, seals', short: 'Other hardware', value: '4', color: 'var(--rd-muted)' },
];
const f = (v: number, d = 1) => (Number.isFinite(v) ? fmt(v, d) : '—');
const pos = (s: string) => Math.max(0, num(s) || 0);

function BudgetBar({ segs, gains }: { segs: { label: string; color: string; m: number }[]; gains: { short: string; color: string; gain: number }[] }) {
  const total = segs.reduce((s, x) => s + x.m, 0), W = 350, rows = Math.ceil(gains.length / 2);
  let x = 5;
  return (
    <Figure label="Mass at ignition and the Δv each inert item costs" caption="Mass at ignition, from propellant to payload. Underneath: the Δv each inert item costs (what you would gain if it weighed nothing).">
      <svg viewBox={`0 0 360 ${44 + rows * 20}`} aria-hidden="true">
        {segs.map((s) => {
          const w = (s.m / total) * W, x0 = x;
          x += w;
          if (w <= 0) return null;
          return (
            <g key={s.label}>
              <rect x={x0} y={6} width={Math.max(w - 1, 0.5)} height={24} fill={s.color} fillOpacity={s.label === 'Propellant' ? 0.75 : 0.9} />
              {w > 44 ? <text x={x0 + w / 2} y={22} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" {...HALO}>{`${Math.round((s.m / total) * 100)}%`}</text> : null}
            </g>
          );
        })}
        {gains.map((g, i) => {
          const cx = 5 + (i % 2) * 178, cy = 50 + Math.floor(i / 2) * 20;
          return (
            <g key={g.short}>
              <rect x={cx} y={cy - 10} width={11} height={11} fill={g.color} />
              <text x={cx + 17} y={cy} fontSize={12} fill="var(--rd-ink)">{`${g.short} −${Math.round(g.gain)} m/s`}</text>
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const mp = pos(v.mp), isp = pos(v.isp), ml = pos(v.ml);
  const parts = ITEMS.map((it) => ({ ...it, m: pos(v[it.key]) }));
  const mi = parts.reduce((s, p) => s + p.m, 0);
  if (!(mp > 0 && isp > 0 && mi + ml > 0)) return <Notes items={[{ tone: 'bad', text: 'Enter a propellant mass, a specific impulse, and some inert or payload mass.' }]} />;
  const p = motorPerformance({ propellant: mp, inert: mi, payload: ml, isp });
  // Δv each item costs: the gain if that item alone weighed nothing
  const gains = parts.map((it) => ({ ...it, gain: motorPerformance({ propellant: mp, inert: mi - it.m, payload: ml, isp }).dv - p.dv }));
  const big = [...gains].sort((a, b) => b.gain - a.gain)[0];
  const notes: { tone: 'info'; text: React.ReactNode }[] = [
    { tone: 'info', text: <>Every kilogram of hardware removed is worth {f(p.dvPerKgInert, 1)} m/s, or lets you carry {f(p.exchange, 2)} kg less propellant for the same Δv. That exchange ratio is just m₀/m<Sub>f</Sub> − 1.</> },
  ];
  if (big.m > 0) notes.push({ tone: 'info', text: `The heaviest lever here is the ${big.short.toLowerCase()}: ${f(big.m, 1)} kg, costing ${f(big.gain, 0)} m/s.` });
  if (ml > mp) notes.push({ tone: 'info', text: 'The payload outweighs the propellant, so the motor’s own mass fraction matters less than usual: Δv is limited by the propellant load.' });
  if (p.fraction < 0.75) notes.push({ tone: 'info', text: 'A mass fraction below about 0.75 is typical of small motors, where hardware that does not scale down (igniter, nozzle, bosses, seals) is a large share of the total.' });
  const z1 = 0.5, z2 = 0.97, zs = Array.from({ length: 95 }, (_, i) => z1 + (i / 94) * (z2 - z1));
  const dvs = zs.map((z) => motorPerformance({ propellant: mp, inert: inertForFraction(mp, z), payload: ml, isp }).dv);
  const yMax = Math.max(...dvs, p.dv) * 1.08;
  return (
    <>
      <Readouts>
        <Readout label="Propellant mass fraction ζ" value={f(p.fraction, 3)} primary />
        <Readout label="Ideal Δv" value={f(p.dv, 0)} unit="m/s" />
        <Readout label="Inert mass" value={f(mi, 2)} unit="kg" />
        <Readout label="Mass ratio m₀ / mf" value={f(p.massRatio, 3)} />
      </Readouts>
      <SubHead>What one inert kilogram costs</SubHead>
      <Readouts>
        <Readout label="Δv lost" value={f(p.dvPerKgInert, 1)} unit="m/s per kg" />
        <Readout label="Or extra propellant to keep Δv" value={f(p.exchange, 2)} unit="kg per kg" />
      </Readouts>
      <BudgetBar segs={[{ label: 'Propellant', color: 'var(--rd-propellant)', m: mp }, ...parts, { label: 'Payload', color: 'var(--rd-blue)', m: ml }]} gains={gains} />
      <Plot x0={z1} x1={z2} y0={0} y1={yMax} xl="propellant mass fraction ζ" yl="Δv (m/s)" label="Ideal Δv against propellant mass fraction"
        caption="Δv against mass fraction for this propellant load and payload. The dot is your motor.">
        {(s) => (
          <>
            <Poly s={s} color="var(--rd-ok)" w={2.5} pts={zs.map((z, i) => [z, dvs[i]])} />
            {p.fraction >= z1 && p.fraction <= z2 ? (
              <>
                <line x1={s.X(p.fraction)} x2={s.X(p.fraction)} y1={s.Y(p.dv)} y2={s.H - s.B} stroke="var(--rd-muted)" strokeDasharray="3 3" />
                <circle cx={s.X(p.fraction)} cy={s.Y(p.dv)} r={5.5} fill="var(--rd-panel)" stroke="var(--rd-ink)" strokeWidth={2.5} />
              </>
            ) : null}
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

const DEFAULTS: Values = { mp: '111.2', isp: '235.55', ml: '50', ...Object.fromEntries(ITEMS.map((it) => [it.key, it.value])) };

export default function MassBudget() {
  return (
    <Calc
      id="mass-budget"
      title="Motor mass budget"
      defaults={DEFAULTS}
      foot="Ideal rocket equation for a single stage: velocity change in vacuum with no gravity or drag losses, for one stage firing alone. Real vehicles lose a share of this to gravity and drag, and multi-stage vehicles apply the equation stage by stage."
    >
      <Inputs>
        <Group legend="Propellant and performance">
          <FieldRow><Num name="mp" label="Propellant" unit="kg" /><Num name="isp" label="Delivered Isp" unit="s" /></FieldRow>
          <Hint>Delivered I<Sub>sp</Sub> = C<Sub>F</Sub> c*/g₀. With the grain page's illustrative C<Sub>F</Sub> = 1.5 and c* = 1540 m/s, that is 235.55 s.</Hint>
        </Group>
        <Group legend="Inert mass">
          {ITEMS.map((it) => <Num key={it.key} name={it.key} label={it.label} unit="kg" />)}
        </Group>
        <Group legend="What it pushes">
          <Num name="ml" label="Payload and everything above the motor" unit="kg" />
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
