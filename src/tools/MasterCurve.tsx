// Time–temperature superposition explorer: where each load case sits on an illustrative propellant master curve.
// Maths in src/lib/propellant.ts (unit-tested).
import React from 'react';
import { View } from 'react-native';
import { Chip, Text, useTheme } from '@castui/cast-ui';
import { wlfLogShift, reducedTime, relaxModulus } from '../lib/propellant';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Range, More, Hint, Readouts, Readout, Notes, Figure, Sub, useForm, num, fmt, type Tone, type Values } from './kit';

const PRESETS = [
  { k: 'cool', n: 1, label: 'Cool-down to −40 °C, 8 h', T: -40, t: 8 * 3600 },
  { k: 'ignc', n: 2, label: 'Ignition at −40 °C', T: -40, t: 0.05 },
  { k: 'ignw', n: 3, label: 'Ignition at +20 °C', T: 20, t: 0.05 },
  { k: 'ignh', n: 4, label: 'Ignition at +60 °C', T: 60, t: 0.05 },
  { k: 'vib', n: 5, label: 'Vibration at +20 °C, 100 Hz', T: 20, t: 0.01 },
  { k: 'store', n: 6, label: 'Storage at +20 °C, 10 years', T: 20, t: 10 * 3.156e7 },
];
const f = (v: number, d = 1) => (Number.isFinite(v) ? fmt(v, d) : '—');
const SUP = (e: number) => String(e).replace(/-/, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
const sci = (v: number) => { const e = Math.floor(Math.log10(v)); return Math.abs(e) <= 2 ? f(v, Math.max(0, 2 - e)) : `${f(v / 10 ** e, 1)}×10${SUP(e)}`; };
const deg = (T: number) => `${String(T).replace('-', '−')} °C`;
const dur = (s: number) => (s < 1 ? `${f(s * 1000, s < 0.01 ? 1 : 0)} ms` : s < 120 ? `${f(s, s < 10 ? 1 : 0)} s` : s < 7200 ? `${f(s / 60, 0)} min` : s < 2 * 86400 ? `${f(s / 3600, 1)} h` : s < 3.156e7 ? `${f(s / 86400, 0)} days` : `${f(s / 3.156e7, s < 3.156e9 ? 1 : 0)} years`);
type Curve = { eEq: number; e1: number; m: number; eGlass: number };

function Presets() {
  const { v, setMany } = useForm();
  const { spacing, scheme } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text type="label-md" color={scheme.text.primary}>Load cases</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map((p) => (
          <Chip key={p.k} size="small" selected={num(v.T) === p.T && Math.abs(Math.log10(p.t) - num(v.lt)) < 0.03}
            onPress={() => setMany({ T: String(p.T), lt: String(+Math.log10(p.t).toFixed(3)) })}>
            {`${p.n} · ${p.label}`}
          </Chip>
        ))}
      </View>
    </View>
  );
}

function Chart({ curve, Ts, C1, C2, xi0, e0 }: { curve: Curve; Ts: number; C1: number; C2: number; xi0: number; e0: number }) {
  const W = 480, H = 250, L = 50, R = 14, T = 26, B = 38, x1 = -10, x2 = 12, y1 = 0, y2 = Math.log10(curve.eGlass) + 0.2;
  const X = (lx: number) => L + ((lx - x1) / (x2 - x1)) * (W - L - R), Y = (ly: number) => H - B - ((ly - y1) / (y2 - y1)) * (H - T - B);
  const ys: number[] = [], xs: number[] = [];
  for (let e = Math.ceil(y1); e <= y2; e++) ys.push(e);
  for (let e = x1; e <= x2; e += 2) xs.push(e);
  const pts = Array.from({ length: 221 }, (_, i) => x1 + (i / 220) * (x2 - x1));
  // load cases: a dot on the curve and a numbered tag above it, nudged up where tags would collide
  const placed: { x: number; y: number }[] = [];
  const marks = PRESETS.map((p) => {
    const xi = reducedTime(p.t, p.T, Ts, C1, C2), lx = Math.min(x2, Math.max(x1, Math.log10(xi)));
    return { n: p.n, x: X(lx), y: Y(Math.log10(relaxModulus(xi, curve))) };
  }).filter((m) => Number.isFinite(m.x) && Number.isFinite(m.y)).sort((a, b) => a.x - b.x)
    .map((m) => {
      let ty = m.y - 16;
      while (placed.some((q) => Math.abs(q.x - m.x) < 17 && Math.abs(q.y - ty) < 15)) ty -= 15;
      placed.push({ x: m.x, y: ty });
      return { ...m, ty };
    });
  const lx0 = Math.min(x2, Math.max(x1, Math.log10(xi0))), mid = (T + H - B) / 2;
  return (
    <Figure label="Relaxation modulus master curve with the load cases marked"
      caption={<>Modulus against reduced time ξ = t / a<Sub>T</Sub>, both on log scales. Numbers are the load cases; the ring is the one selected.</>}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {ys.map((e) => (
          <g key={`y${e}`}>
            <line x1={L} x2={W - R} y1={Y(e)} y2={Y(e)} stroke="var(--rd-line)" />
            <text x={L - 6} y={Y(e) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{String(10 ** e)}</text>
          </g>
        ))}
        {xs.map((e) => (
          <g key={`x${e}`}>
            <line x1={X(e)} x2={X(e)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            {e % 4 === 0 ? <text x={X(e)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{`10${SUP(e)}`}</text> : null}
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">{`reduced time ξ at ${deg(Ts)} (s)`}</text>
        <text x={12} y={mid} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 12 ${mid})`}>E (MPa)</text>
        <path d={pts.map((lx, i) => `${i ? 'L' : 'M'}${X(lx).toFixed(1)},${Y(Math.log10(relaxModulus(10 ** lx, curve))).toFixed(1)}`).join('')} fill="none" stroke="var(--rd-ok)" strokeWidth={2.5} />
        <text x={X(4.5)} y={Y(Math.log10(curve.eEq)) - 8} fontSize={12} fill="var(--rd-muted)">fully relaxed</text>
        <text x={X(x1) + 4} y={Y(Math.log10(curve.eGlass)) - 7} fontSize={12} fill="var(--rd-muted)">glassy</text>
        {marks.map((m) => (
          <g key={m.n}>
            <line x1={m.x} x2={m.x} y1={m.y - 3} y2={m.ty + 7} stroke="var(--rd-muted)" strokeWidth={0.8} />
            <circle cx={m.x} cy={m.y} r={3.2} fill="var(--rd-ink)" />
            <circle cx={m.x} cy={m.ty} r={7.5} fill="var(--rd-panel)" stroke="var(--rd-muted)" strokeWidth={1.2} />
            <text x={m.x} y={m.ty + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--rd-ink)">{String(m.n)}</text>
          </g>
        ))}
        <circle cx={X(lx0)} cy={Y(Math.log10(e0))} r={12} fill="none" stroke="var(--rd-accent)" strokeWidth={2.5} />
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const Ts = num(v.ts), C1 = num(v.c1), C2 = num(v.c2);
  const curve: Curve = { eEq: num(v.ee), e1: num(v.e1), m: num(v.m), eGlass: 2500 };
  const T = num(v.T), t = 10 ** num(v.lt);
  if (!(C2 + T - Ts > 5) || !(curve.eEq > 0 && curve.e1 >= 0 && curve.m >= 0) || !Number.isFinite(C1))
    return <Notes items={[{ tone: 'bad', text: <>Outside the range of this WLF fit (C<Sub>2</Sub> + T − T<Sub>s</Sub> must stay positive), or a material constant is invalid.</> }]} />;
  const logA = wlfLogShift(T, Ts, C1, C2), xi = reducedTime(t, T, Ts, C1, C2), E = relaxModulus(xi, curve);
  const at = (p: { T: number; t: number }) => relaxModulus(reducedTime(p.t, p.T, Ts, C1, C2), curve);
  const eCool = at(PRESETS[0]), eIgn = at(PRESETS[1]);
  const notes: { tone: Tone; text: React.ReactNode }[] = [
    { tone: 'info', text: <>Cold is slow: at {deg(T)} every process runs {logA >= 0 ? `${sci(10 ** logA)}× slower` : `${sci(10 ** -logA)}× faster`} than at T<Sub>s</Sub> = {deg(Ts)}, so {dur(t)} here acts like {dur(xi)} there.</> },
    { tone: 'info', text: `The same propellant is ${f(eIgn / eCool, 0)}× stiffer at a −40 °C ignition (${f(eIgn, 0)} MPa) than during the cool-down to −40 °C (${f(eCool, 1)} MPa). That is why thermal strain analyses use the relaxed modulus, and why strain capability is measured at the rate and temperature of each load case.` },
  ];
  if (T < Ts - 45) notes.push({ tone: 'warn', text: 'Close to the glass transition: the binder is turning glassy, stiffness rises steeply and strain capability collapses. The lowest firing temperature normally sits well above it.' });
  return (
    <>
      <Readouts>
        <Readout label="Relaxation modulus E" value={f(E, E < 10 ? 2 : E < 100 ? 1 : 0)} unit="MPa" primary sub={`${deg(T)}, ${dur(t)}`} />
        <Readout label="Stiffer than fully relaxed" value={`${f(E / curve.eEq, 1)}×`} />
        <Readout label="Shift factor aT" value={sci(10 ** logA)} />
        <Readout label="Equivalent time at Ts" value={dur(xi)} />
      </Readouts>
      <Chart curve={curve} Ts={Ts} C1={C1} C2={C2} xi0={xi} e0={E} />
      <Notes items={notes} />
    </>
  );
}

const DEFAULTS: Values = { T: '-40', lt: String(+Math.log10(0.05).toFixed(3)), ts: '-20', c1: '8.86', c2: '101.6', ee: '3', e1: '5', m: '0.3' };

export default function MasterCurve() {
  return (
    <Calc
      id="master-curve"
      title="Master-curve explorer"
      defaults={DEFAULTS}
      foot="WLF shift, illustrative HTPB-like propellant. Time–temperature superposition with the WLF equation, which applies from about the glass transition to some 100 K above it. Real propellants need measured relaxation data, their own shift factors, and separate treatment of dewetting, ageing and pressure."
    >
      <Inputs>
        <Group legend="Load case">
          <Presets />
          <Range name="T" label="Temperature" min={-65} max={70} step={1} format={deg} />
          <Range name="lt" label="Load duration" min={-3} max={9.6} step={0.05} format={(x) => dur(10 ** x)} />
        </Group>
        <More title="Material constants (illustrative)">
          <FieldRow><Num name="ts" label="WLF reference Ts" unit="°C" /><Num name="c1" label="C1" /></FieldRow>
          <FieldRow><Num name="c2" label="C2" unit="K" /><Num name="ee" label="Eeq, fully relaxed" unit="MPa" /></FieldRow>
          <FieldRow><Num name="e1" label="E1 at ξ = 1 s" unit="MPa" /><Num name="m" label="Slope m" /></FieldRow>
          <Hint>C<Sub>1</Sub> = 8.86 and C<Sub>2</Sub> = 101.6 K are Williams, Landel and Ferry's general constants with T<Sub>s</Sub> ≈ T<Sub>g</Sub> + 50 K. The power-law curve and its constants are illustrative, not data for any real propellant.</Hint>
        </More>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
