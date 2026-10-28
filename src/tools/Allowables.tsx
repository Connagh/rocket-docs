// Design allowables from test data: A- and B-basis (normal, one-sided tolerance limits), knockdowns, and margins.
// Maths in src/lib/allowables.ts (unit-tested).
import React from 'react';
import { basisValues, toleranceFactor, retention } from '../lib/allowables';
import { readFactor, awaitingMessage } from '../lib/factors';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, Lines, Readouts, Readout, Notes, Figure, DataTable, SubHead, useForm, num, fmt, type Tone } from './kit';

const f = (v: number, d = 1) => fmt(v, d);
const kCache = new Map<string, number>();
const kOf = (n: number, p: number) => { const key = `${n}:${p}`; if (!kCache.has(key)) kCache.set(key, toleranceFactor(n, p)); return kCache.get(key)!; };
const DATA = [471, 458, 463, 449, 467, 455, 476, 452, 461, 444, 468, 459, 457, 472, 450, 464, 446, 462, 456, 469];
const FAMS: [string, string][] = [['al', 'Aluminium alloy'], ['ti', 'Titanium alloy'], ['steel', 'Low-alloy steel'], ['ss', 'Stainless steel'], ['ni', 'Nickel alloy']];
type B = ReturnType<typeof basisValues>;

function Dist({ xs, b, smin }: { xs: number[]; b: B; smin: number | null }) {
  const W = 480, H = 220, L = 20, R = 20, T = 14, Bm = 34;
  const lo = Math.min(b.A, smin ?? Infinity, b.mean - 4.2 * b.sd), hi = b.mean + 3.5 * b.sd;
  const X = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const pdf = (v: number) => Math.exp(-0.5 * ((v - b.mean) / b.sd) ** 2);
  const yBase = H - Bm - 30, Y = (d: number) => yBase - d * (yBase - T - 20);
  const pts = Array.from({ length: 161 }, (_, k) => lo + (k / 160) * (hi - lo));
  const marks: [number, string, string][] = [[b.mean, 'mean', 'var(--rd-muted)'], [b.B, 'B', 'var(--rd-blue)'], [b.A, 'A', 'var(--rd-accent)']];
  if (smin !== null) marks.push([smin, 'S', 'var(--rd-warn)']);
  return (
    <Figure label="Test results with the fitted normal distribution and basis values"
      caption="Each dot is a test. The curve is the normal distribution fitted to them. A- and B-basis sit well below the lowest result: they bound the population, not this sample.">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={`M${X(lo)},${yBase} ` + pts.map((v) => `L${X(v).toFixed(1)},${Y(pdf(v)).toFixed(1)}`).join('') + ` L${X(hi)},${yBase} Z`} fill="var(--rd-blue)" fillOpacity={0.12} stroke="var(--rd-blue)" strokeWidth={1.5} />
        <line x1={L} x2={W - R} y1={yBase} y2={yBase} stroke="var(--rd-line)" />
        {[...xs].sort((a, c) => a - c).map((v, i) => <circle key={i} cx={X(v)} cy={yBase + 12 + (i % 3) * 7} r={3.5} fill="var(--rd-ink)" fillOpacity={0.75} />)}
        {marks.map(([v, lab, col]) => (
          <g key={lab}>
            <line x1={X(v)} x2={X(v)} y1={T + 10} y2={yBase + 30} stroke={col} strokeWidth={lab === 'mean' ? 1.2 : 2} strokeDasharray={lab === 'mean' ? '4 3' : undefined} />
            <text x={X(v)} y={T + 6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={col}>{lab}</text>
          </g>
        ))}
        {[Math.ceil(lo / 10) * 10, Math.round(b.mean / 10) * 10, Math.floor(hi / 10) * 10].map((v) => <text key={v} x={X(v)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--rd-muted)">{String(v)}</text>)}
        <text x={W - R} y={H - 6} textAnchor="end" fontSize={10} fill="var(--rd-muted)">MPa</text>
      </svg>
    </Figure>
  );
}

function KChart({ n }: { n: number }) {
  const W = 480, H = 220, L = 44, R = 14, T = 12, B = 34, n1 = 3, n2 = 100, kMax = 8;
  const X = (v: number) => L + (Math.log10(v / n1) / Math.log10(n2 / n1)) * (W - L - R);
  const Y = (k: number) => H - B - (Math.min(k, kMax) / kMax) * (H - T - B);
  const ns = [3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50, 70, 100];
  return (
    <Figure label="Tolerance factor k against number of tests" caption="The factor k against the number of tests. Few tests mean a big k: uncertainty about the population is paid for in allowable.">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {[0, 2, 4, 6, 8].map((k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={Y(k)} y2={Y(k)} stroke="var(--rd-line)" />
            <text x={L - 6} y={Y(k) + 3} textAnchor="end" fontSize={10} fill="var(--rd-muted)">{String(k)}</text>
          </g>
        ))}
        {[3, 5, 10, 20, 30, 50, 100].map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            <text x={X(v)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="var(--rd-muted)">{String(v)}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--rd-ink)">number of tests n</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={11} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>k</text>
        {([[0.99, 'var(--rd-accent)', 'A-basis', 2.326], [0.9, 'var(--rd-blue)', 'B-basis', 1.282]] as const).map(([p, col, lab, zp]) => (
          <g key={lab}>
            <path d={ns.map((v, i) => `${i ? 'L' : 'M'}${X(v).toFixed(1)},${Y(kOf(v, p)).toFixed(1)}`).join('')} fill="none" stroke={col} strokeWidth={2.4} />
            <line x1={L} x2={W - R} y1={Y(zp)} y2={Y(zp)} stroke={col} strokeDasharray="3 4" strokeOpacity={0.6} />
            <text x={X(6) + 6} y={p === 0.99 ? Y(kOf(6, p)) - 8 : Y(kOf(6, p)) + 16} fontSize={10.5} fontWeight={700} fill={col}>{lab}</text>
            <text x={W - R - 4} y={Y(zp) + (p === 0.99 ? -5 : 13)} textAnchor="end" fontSize={9.5} fill={col}>{`${zp} with unlimited tests`}</text>
          </g>
        ))}
        {n >= n1 && n <= n2 ? (
          <>
            <line x1={X(n)} x2={X(n)} y1={T} y2={H - B} stroke="var(--rd-ink)" strokeDasharray="3 3" />
            <text x={X(n) + 4} y={T + 12} fontSize={10} fill="var(--rd-ink)">{`your n = ${n}`}</text>
          </>
        ) : null}
      </svg>
    </Figure>
  );
}

function Chain({ v0, path, kn, sapp, fs }: { v0: number; path: string; kn: [string, number][]; sapp: number; fs: number | null }) {
  const steps: [string, number][] = [[`${path}-basis`, v0]];
  let v = v0;
  for (const [lab, k] of kn) { v *= Number.isFinite(k) ? k : NaN; steps.push([`× ${lab} ${Number.isFinite(k) ? f(k, 2) : '?'}`, v]); }
  const W = 480, L = 132, R = 56, rowH = 26, T = 8;
  const max = Math.max(v0, sapp * (fs ?? 1)) * 1.05;
  const X = (val: number) => L + (val / max) * (W - L - R);
  const yEnd = T + steps.length * rowH;
  return (
    <Figure label="From basis value to design allowable" caption="From the basis value to the design allowable, one knockdown at a time, against the applied stress (and the applied stress times your factor, once entered).">
      <svg viewBox={`0 0 ${W} 220`} aria-hidden="true">
        {steps.map(([lab, val], i) => {
          const y = T + i * rowH;
          return (
            <g key={lab}>
              <text x={L - 8} y={y + 15} textAnchor="end" fontSize={10.5} fill="var(--rd-ink)">{lab}</text>
              {Number.isFinite(val) ? (
                <>
                  <rect x={L} y={y + 3} width={Math.max(1, X(val) - L)} height={16} rx={2} fill={i === steps.length - 1 ? 'var(--rd-accent)' : i === 0 ? 'var(--rd-muted)' : 'var(--rd-blue)'} fillOpacity={i === 0 ? 0.55 : 0.75} />
                  <text x={X(val) + 5} y={y + 15} fontSize={10} fill="var(--rd-muted)">{f(val, 0)}</text>
                </>
              ) : null}
            </g>
          );
        })}
        {sapp > 0 ? (
          <>
            <line x1={X(sapp)} x2={X(sapp)} y1={T} y2={yEnd} stroke="var(--rd-ink)" strokeDasharray="4 3" />
            <text x={X(sapp)} y={yEnd + 14} textAnchor="middle" fontSize={10} fill="var(--rd-ink)">applied</text>
            {fs !== null ? (
              <>
                <line x1={X(sapp * fs)} x2={X(sapp * fs)} y1={T} y2={yEnd} stroke="var(--rd-warn)" strokeWidth={2} />
                <text x={X(sapp * fs)} y={yEnd + 28} textAnchor="middle" fontSize={10} fill="var(--rd-warn)">{`× ${fs}`}</text>
              </>
            ) : null}
          </>
        ) : null}
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const xs = v.data.split(/[\s,;]+/).filter(Boolean).map(Number).filter((x) => Number.isFinite(x) && x > 0);
  if (xs.length < 3) return <Notes items={[{ tone: 'bad', text: 'Enter at least three test results (A- and B-basis need many more to be credible).' }]} />;
  const b = basisValues(xs);
  const smin = v.smin.trim() === '' ? null : num(v.smin);
  const tempCurve = retention(v.fam, num(v.temp));
  const kT = v.kt.trim() !== '' ? num(v.kt) : tempCurve;
  const kn: [string, number][] = [['temperature', kT], ['direction', num(v.kdir)], ['thickness', num(v.kth)], ['environment', num(v.kenv)], ['joint', num(v.kj)]];
  const kProd = kn.reduce((p, [, k]) => p * k, 1);
  const path = v.path as 'A' | 'B';
  const sapp = num(v.sapp);
  const fs = readFactor(v.fs);
  const rows = [
    { key: 'typ', label: 'Typical (mean)', v: b.mean },
    { key: 'B', label: 'B-basis', v: b.B },
    { key: 'A', label: 'A-basis', v: b.A },
    ...(smin !== null ? [{ key: 'S', label: 'S-basis (spec min)', v: smin }] : []),
  ];
  const chosen = rows.find((x) => x.key === path)!;
  const allow = chosen.v * kProd;
  const ms = fs === null ? NaN : allow / (fs * sapp) - 1;

  const out: { tone: Tone; text: string }[] = [];
  out.push({ tone: 'info', text: `The ${path}-basis value is ${f(chosen.v, 1)} MPa: ${f(((b.mean - chosen.v) / b.mean) * 100, 1)}% below the mean and ${f(b.min - chosen.v, 1)} MPa below the lowest test. It bounds ${path === 'A' ? '99%' : '90%'} of the population with 95% confidence, not this sample.` });
  const typA = (b.mean * kProd) / sapp, chA = allow / sapp;
  if (sapp > 0 && Number.isFinite(chA)) out.push({ tone: 'info', text: `Against ${f(sapp, 0)} MPa: the typical value gives a reserve of ${f(typA, 2)}, the ${path}-basis value ${f(chA, 2)}. Any factor of safety between the two would pass on the typical value and fail on the real allowable: the error a typical value hides.` });
  if (!Number.isFinite(tempCurve) && v.kt.trim() === '') out.push({ tone: 'warn', text: 'The design temperature is beyond the family curve. Enter a temperature factor from data.' });
  if (b.n < 10) out.push({ tone: 'warn', text: `With ${b.n} tests, k is large (A-basis ${f(b.kA, 2)}). Handbook A- and B-basis values come from many tests across several material lots.` });
  if (b.cv > 0.08) out.push({ tone: 'warn', text: `Scatter is high (CV ${f(b.cv * 100, 1)}%). Check for mixed lots, orientations or test problems before computing an allowable.` });
  if (smin !== null && smin > b.A) out.push({ tone: 'warn', text: `The specification minimum (${f(smin, 0)} MPa) is above the A-basis value from these tests: this material may not reliably meet its specification.` });
  if (fs === null) out.push({ tone: 'warn', text: awaitingMessage(['factor of safety'], 'the margin', false) });

  return (
    <>
      <Readouts>
        <Readout label={`Design allowable: ${path}-basis`} value={Number.isFinite(allow) ? f(allow, 1) : '—'} unit={Number.isFinite(allow) ? 'MPa' : undefined} primary
          sub={Number.isFinite(allow) ? undefined : 'no temperature estimate: enter a factor'} />
        <Readout label="Reserve, allowable ÷ applied" value={sapp > 0 && Number.isFinite(allow) ? `${f(allow / sapp, 3)}×` : '—'} />
        <Readout label="Margin of safety" value={fs === null ? 'needs your factor' : `${ms >= 0 ? '+' : ''}${f(ms, 2)}`} tone={fs === null ? undefined : ms < 0 ? 'bad' : ms < 0.05 ? 'warn' : 'ok'} />
      </Readouts>
      <SubHead>The data</SubHead>
      <Readouts>
        <Readout label="n · mean · s" value={`${b.n} · ${f(b.mean, 1)} · ${f(b.sd, 1)}`} sub={`CV ${f(b.cv * 100, 1)}%`} />
        <Readout label="B-basis (k)" value={f(b.B, 1)} sub={`k ${f(b.kB, 3)}`} />
        <Readout label="A-basis (k)" value={f(b.A, 1)} sub={`k ${f(b.kA, 3)}`} />
      </Readouts>
      <DataTable
        columns={[{ label: 'Basis' }, { label: 'Value', numeric: true }, { label: '× knockdowns', numeric: true }, { label: '÷ applied', numeric: true }, ...(fs !== null ? [{ label: 'MS', numeric: true }] : [])]}
        highlight={(i) => rows[i].key === path}
        rows={rows.map((x) => {
          const a = x.v * kProd, m = fs !== null ? a / (fs * sapp) - 1 : NaN;
          return [x.label, f(x.v, 1), f(a, 1), sapp > 0 ? f(a / sapp, 3) : '—', ...(fs !== null ? [`${m >= 0 ? '+' : ''}${f(m, 2)}`] : [])];
        })}
      />
      <Dist xs={xs} b={b} smin={smin} />
      <KChart n={b.n} />
      <Chain v0={chosen.v} path={path} kn={kn} sapp={sapp} fs={fs} />
      <Notes items={out} />
    </>
  );
}

export default function Allowables() {
  return (
    <Calc
      id="allowables"
      title="Design allowables from test data (normal one-sided tolerance limits, 95% confidence)"
      defaults={{ data: DATA.join(', '), smin: '', path: 'A', fam: 'al', temp: '100', kt: '', kdir: '0.88', kth: '1', kenv: '1', kj: '1', sapp: '300', fs: '' }}
      foot="Assumes a normal population and one homogeneous sample. Handbook practice (MMPDS, CMH-17) tests several material lots, checks the distribution (normal, Weibull or lognormal, or a non-parametric method) and pools data only where statistics allow. Knockdowns multiply; their values come from data, not from this page."
    >
      <Inputs>
        <Group legend="Test results (MPa)" hint="Illustrative data: 20 yield-strength tests of one aluminium plate lot, longitudinal, room temperature. Real allowables need several material lots.">
          <Lines name="data" label="One per line, or separated by commas" rows={5} />
          <Num name="smin" label="Specification minimum, if any" unit="MPa" placeholder="none" />
          <Choice name="path" label="Load path" options={[{ value: 'A', label: 'Single: failure is not contained (A-basis)' }, { value: 'B', label: 'Redundant: load redistributes (B-basis)' }]} />
        </Group>
        <Group legend="Knockdowns to the design condition" hint="Knockdown factors are property ratios from your own or handbook data, not safety factors. The temperature curve is a family screening estimate; override it with data.">
          <Choice name="fam" label="Material family (temperature curve)" options={FAMS.map(([k, n]) => ({ value: k, label: n }))} />
          <FieldRow>
            <Num name="temp" label="Design temperature" unit="°C" />
            <Num name="kt" label="Temperature factor" placeholder="from curve" />
          </FieldRow>
          <FieldRow>
            <Num name="kdir" label="Direction (L / LT / ST)" />
            <Num name="kth" label="Thickness / product form" />
          </FieldRow>
          <FieldRow>
            <Num name="kenv" label="Environment" />
            <Num name="kj" label="Joint / weld efficiency" />
          </FieldRow>
        </Group>
        <Group legend="The check">
          <FieldRow>
            <Num name="sapp" label="Applied stress at limit load" unit="MPa" />
            <Num name="fs" label="Your programme's factor of safety" placeholder="your value" />
          </FieldRow>
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
