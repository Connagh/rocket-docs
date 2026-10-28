// MEOP build-up: nominal pressure → hot day → manufacturing variation (amplified by 1/(1−n)) → MEOP.
// Maths in src/lib/propellant.ts (unit-tested).
import React from 'react';
import { meopBuildUp } from '../lib/propellant';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Readouts, Readout, Notes, Figure, useForm, num, fmt, type Tone } from './kit';

const deg = (T: number) => `${fmt(T, 0).replace('-', '−')} °C`;
const pct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${fmt(v * 100, d)}%`;
type In = { pNom: number; tRef: number; tHot: number; tCold: number; n: number; sigmaP: number; rateVar: number; abVar: number; atVar: number; other: number };
type M = ReturnType<typeof meopBuildUp>;

function Ladder({ i, m }: { i: In; m: M }) {
  const hot = m.pHot, comb = hot * (1 + m.rssHi);
  const rows = [
    { label: 'Minimum, cold', a: 0, b: m.pMin, color: 'var(--rd-blue)', tag: fmt(m.pMin) },
    { label: 'Nominal', a: 0, b: i.pNom, color: 'var(--rd-muted)', tag: fmt(i.pNom) },
    { label: 'Hot day', a: i.pNom, b: hot, color: 'var(--rd-hot)', tag: pct(hot / i.pNom - 1) },
    { label: 'burn rate', sub: true, a: hot, b: hot * (1 + m.hi.rate), color: 'var(--rd-steel)', tag: pct(m.hi.rate) },
    { label: 'burning area', sub: true, a: hot, b: hot * (1 + m.hi.ab), color: 'var(--rd-steel)', tag: pct(m.hi.ab) },
    { label: 'throat area', sub: true, a: hot, b: hot * (1 + m.hi.at), color: 'var(--rd-steel)', tag: pct(m.hi.at) },
    { label: 'Combined (RSS)', a: hot, b: comb, color: 'var(--rd-warn)', tag: pct(m.rssHi) },
    { label: 'Other allowance', a: comb, b: m.meop, color: 'var(--rd-warn)', tag: pct(i.other) },
    { label: 'MEOP', bold: true, a: 0, b: m.meop, color: 'var(--rd-accent)', tag: `${fmt(m.meop)} MPa` },
  ];
  const L = 118, R = 64, T = 8, rowH = 24, W = 480;
  const lo = Math.min(m.pMin, i.pNom) * 0.94, hi = Math.max(m.meopWorst, m.meop) * 1.01;
  const X = (p: number) => L + ((Math.max(p, lo) - lo) / (hi - lo)) * (W - L - R);
  const yEnd = T + rows.length * rowH;
  return (
    <Figure label="How each effect adds to the nominal pressure" caption="How MEOP builds up from the nominal pressure. Each variation is shown alone, then combined. The axis does not start at zero.">
      <svg viewBox="0 0 480 236" aria-hidden="true">
        {rows.map((row, k) => {
          const y = T + k * rowH, x0 = X(row.a), x1 = X(row.b);
          return (
            <g key={row.label}>
              <text x={L - 8} y={y + 14} textAnchor="end" fontSize={10.5} fontWeight={row.bold ? 700 : 400} fill="var(--rd-ink)">{row.label}</text>
              <rect x={x0} y={y + 3} width={Math.max(x1 - x0, 1.5)} height={15} rx={2} fill={row.color} fillOpacity={row.sub ? 0.55 : 0.85} />
              <text x={x1 + 5} y={y + 14} fontSize={10} fill="var(--rd-muted)">{row.tag}</text>
            </g>
          );
        })}
        <line x1={X(m.meopWorst)} x2={X(m.meopWorst)} y1={T} y2={yEnd} stroke="var(--rd-accent)" strokeDasharray="4 3" />
        <text x={X(m.meopWorst) - 4} y={yEnd + 12} textAnchor="end" fontSize={9.5} fill="var(--rd-accent)">{`worst-case stack ${fmt(m.meopWorst)}`}</text>
        <text x={L} y={yEnd + 12} fontSize={9.5} fill="var(--rd-muted)">{`axis from ${fmt(lo, 1)} MPa`}</text>
      </svg>
    </Figure>
  );
}

function Traces({ i, m }: { i: In; m: M }) {
  const W = 480, H = 200, L = 44, R = 12, T = 12, B = 32;
  // Idealised neutral trace: fast rise, slightly progressive plateau, tail-off over the last ~12% of web.
  const shape = (u: number) => (u < 0 ? 0 : u < 0.03 ? u / 0.03 : u <= 1 ? 0.96 + 0.06 * u : Math.max(0, 1.02 * Math.exp(-(u - 1) / 0.035)));
  const set = [
    { p: m.pCold, tb: m.burnTimeCold, c: 'var(--rd-blue)', label: deg(i.tCold), at: 0.25 },
    { p: i.pNom, tb: 1, c: 'var(--rd-muted)', label: deg(i.tRef), at: 0.5 },
    { p: m.pHot, tb: m.burnTimeHot, c: 'var(--rd-hot)', label: deg(i.tHot), at: 0.75 },
  ];
  const xMax = Math.max(...set.map((s) => s.tb)) * 1.18, yMax = m.pHot * 1.12;
  const X = (t: number) => L + (t / xMax) * (W - L - R);
  const Y = (p: number) => H - B - (p / yMax) * (H - T - B);
  const step = yMax > 30 ? 10 : yMax > 12 ? 5 : 2;
  const yt: number[] = []; for (let p = 0; p <= yMax; p += step) yt.push(p);
  const xt: number[] = []; for (let t = 0; t <= xMax; t += 0.25) xt.push(t);
  const pts = Array.from({ length: 160 }, (_, j) => (j / 159) * xMax);
  return (
    <Figure
      label="Idealised pressure traces at the coldest, reference and hottest firing temperatures"
      caption="Idealised neutral-grain traces at the coldest, reference and hottest temperatures. Hot motors push harder for less time; the areas (and the total impulse) barely change."
    >
      <svg viewBox="0 0 480 200" aria-hidden="true">
        {yt.map((p) => (
          <g key={p}>
            <line x1={L} x2={W - R} y1={Y(p)} y2={Y(p)} stroke="var(--rd-line)" />
            <text x={L - 6} y={Y(p) + 3} textAnchor="end" fontSize={10} fill="var(--rd-muted)">{p}</text>
          </g>
        ))}
        {xt.map((t) => <text key={t} x={X(t)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="var(--rd-muted)">{t.toFixed(2)}</text>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--rd-ink)">{`time ÷ burn time at ${deg(i.tRef)}`}</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={11} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>MPa</text>
        {set.map((s) => {
          // label beside the tail-off, where the traces separate; each at its own height
          const u = 1 + 0.035 * Math.log(1.02 / s.at);
          return (
            <g key={s.label + s.c}>
              <path d={pts.map((t, j) => `${j ? 'L' : 'M'}${X(t).toFixed(1)},${Y(s.p * shape(t / s.tb)).toFixed(1)}`).join('')} fill="none" stroke={s.c} strokeWidth={2.2} />
              <text x={X(s.tb * u) + 5} y={Y(s.p * s.at) + 3} fontSize={10} fill={s.c}>{s.label}</text>
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const i: In = {
    pNom: num(v.p), tRef: num(v.tr), tHot: num(v.th), tCold: num(v.tc), n: num(v.n), sigmaP: num(v.sp) / 100,
    rateVar: num(v.vr) / 100, abVar: num(v.va) / 100, atVar: num(v.vt) / 100, other: (num(v.vo) || 0) / 100,
  };
  if (!(i.pNom > 0) || !(i.n >= 0 && i.n < 1) || !(i.sigmaP >= 0) || [i.rateVar, i.abVar, i.atVar].some((x) => !(x >= 0 && x < 0.9))) {
    return (
      <Notes items={[{ tone: 'bad', text: i.n >= 1
        ? 'With n ≥ 1 there is no stable operating pressure: the gas made grows faster than the gas leaving. Propellants are chosen with n well below 1.'
        : 'Check the inputs: pressure positive, n between 0 and 1, variations between 0 and 90%.' }]} />
    );
  }
  const m = meopBuildUp(i);
  const out: { tone: Tone; text: string }[] = [];
  const rise = m.meop - i.pNom, fromHot = m.pHot - i.pNom;
  if (rise > 0) out.push({ tone: 'info', text: `MEOP sits ${fmt(rise)} MPa above nominal; the hot day is ${fmt((fromHot / rise) * 100, 0)}% of that. Each 1% of burn-rate scatter becomes ${fmt(m.amplification, 2)}% in pressure.` });
  out.push({ tone: 'info', text: `The hottest motor burns ${fmt((1 - m.burnTimeHot) * 100, 1)}% faster than at ${deg(i.tRef)} and the coldest ${fmt((m.burnTimeCold - 1) * 100, 1)}% slower. Size the case to the hot motor; check thrust, ignition and minimum pressure on the cold one.` });
  if (i.n > 0.6) out.push({ tone: 'warn', text: `n = ${fmt(i.n, 2)} amplifies every variation ${fmt(m.amplification, 1)}×. High exponents make MEOP very sensitive to manufacturing spread.` });
  if (i.other === 0) out.push({ tone: 'info', text: 'No allowance entered for ignition spike or erosive burning. Those come from firing data, and on long, narrow bores erosive burning can add more than everything above.' });
  return (
    <>
      <Readouts>
        <Readout label="MEOP: variations combined (RSS)" value={fmt(m.meop)} unit={`MPa · ${pct(m.meop / i.pNom - 1, 0)}`} primary />
        <Readout label="MEOP: every variation at its limit" value={fmt(m.meopWorst)} unit="MPa" />
        <Readout label="Hot-day pressure" value={fmt(m.pHot)} unit={`MPa · ${pct(m.pHot / i.pNom - 1)}`} />
        <Readout label="Minimum (cold, low side)" value={fmt(m.pMin)} unit="MPa" />
        <Readout label="πK = σp / (1 − n)" value={fmt(m.piK * 100, 3)} unit="% per K" />
        <Readout label="Amplification 1 / (1 − n)" value={`${fmt(m.amplification, 2)}×`} />
      </Readouts>
      <Ladder i={i} m={m} />
      <Traces i={i} m={m} />
      <Notes items={out} />
    </>
  );
}

export default function MeopBuildUp() {
  return (
    <Calc
      id="meop-build-up"
      title="MEOP build-up (constant Kn, exponential temperature sensitivity)"
      defaults={{ p: '8.8', tr: '20', n: '0.35', sp: '0.13', th: '60', tc: '-40', vr: '3', va: '1', vt: '1', vo: '0' }}
      foot={
        <>
          Constant K<sub>n</sub>, one burn-rate law over the whole pressure range, temperature sensitivity exponential in temperature, and
          the three manufacturing variations independent of each other. Real MEOP derivations also cover ignition transients, erosive
          burning, grain deformation under pressure and the programme's own statistical method.
        </>
      }
    >
      <Inputs>
        <Group
          legend="Ballistic properties"
          hint={<>σ<sub>p</sub> is how much the burn rate rises per kelvin of grain temperature at constant pressure. Illustrative AP/HTPB-like values: use your ballistics team's.</>}
        >
          <FieldRow>
            <Num name="p" label="Nominal peak pressure" unit="MPa" />
            <Num name="tr" label="at reference temp" unit="°C" />
          </FieldRow>
          <FieldRow>
            <Num name="n" label="Pressure exponent n" />
            <Num name="sp" label="σp" unit="% per K" />
          </FieldRow>
        </Group>
        <Group legend="Temperature range">
          <FieldRow>
            <Num name="th" label="Hottest firing" unit="°C" />
            <Num name="tc" label="Coldest firing" unit="°C" />
          </FieldRow>
        </Group>
        <Group
          legend="Variation, ± %"
          hint="Enter each at the probability level your programme defines MEOP at. “Other” is for effects measured on firings: ignition spike, erosive burning. Variations are illustrative."
        >
          <FieldRow>
            <Num name="vr" label="Burn-rate coefficient" />
            <Num name="va" label="Burning area" />
          </FieldRow>
          <FieldRow>
            <Num name="vt" label="Throat area" />
            <Num name="vo" label="Other allowance (+%)" />
          </FieldRow>
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
