// Random vibration of a single-degree-of-freedom part: input PSD → Grms, Miles vs exact response, 3σ load and
// margin, 3σ displacement against a clearance, and Steinberg three-band fatigue.
// Maths in src/lib/vibration.ts (unit-tested).
import React from 'react';
import { View } from 'react-native';
import { resolveProfile, grms, miles, asdAt, trans2, sdofResponse, peaksAbove, steinbergDamage, dbPerOct, G0, type RawRow } from '../lib/vibration';
import { snCurve } from '../lib/fatigue';
import { readFactor, awaitingMessage } from '../lib/factors';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, TextField, MaterialFill, Hint, Readouts, Readout, Notes, Figure, DataTable, A, useForm, num, fmt, type Tone, type Values } from './kit';
import type { MaterialFillData } from './materialOptions';

const f = (v: number, d = 2) => fmt(v, d);
const sup = (s: string) => s.replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
const sci = (v: number, d = 1) => {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  if (v >= 0.01 && v < 1e4) return f(v, v < 1 ? 3 : 1);
  const [m, e] = v.toExponential(d).split('e');
  return `${m} × 10${sup(String(+e))}`;
};
const sgn = (v: number) => `${v >= 0 ? '+' : ''}${f(v, 2)}`;
const BP = [{ f: '20', v: '+3 dB' }, { f: '80', v: '0.04' }, { f: '500', v: '0.04' }, { f: '2000', v: '-3 dB' }, { f: '', v: '' }, { f: '', v: '' }];
type Note = { tone: Tone; text: React.ReactNode };

/** "0.04" → ASD; "+3 dB", "−6 dB/oct" → slope. */
function parseVal(raw: string): { value: number; kind: 'asd' | 'slope' } | null {
  const s = raw.trim().replace(/[−–]/g, '-').replace(',', '.');
  if (!s) return null;
  const m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(db(?:\s*\/\s*oct(?:ave)?)?)?$/i);
  if (!m) return { value: NaN, kind: 'asd' };
  return { value: +m[1], kind: m[2] ? 'slope' : 'asd' };
}

/** Read the breakpoint rows: the resolved profile, and a note for each row (its slope, its level, or why it failed). */
function readProfile(v: Values) {
  const raw: (RawRow & { k: number })[] = [];
  const rowNote: Record<number, { text: string; bad?: boolean }> = {};
  let unreadable = false;
  BP.forEach((_, k) => {
    const fk = num(v[`f${k}`]), val = parseVal(v[`v${k}`] ?? '');
    if (!Number.isFinite(fk) && !val) return;
    if (!val || !Number.isFinite(fk) || !Number.isFinite(val.value)) { rowNote[k] = { text: 'can’t read this row', bad: true }; unreadable = true; return; }
    raw.push({ f: fk, value: val.value, kind: val.kind, k });
  });
  const { points, error } = resolveProfile(raw);
  if (!error && !unreadable) raw.forEach((x) => {
    const i = points.findIndex((p) => p.f === x.f);
    if (x.kind === 'slope') rowNote[x.k] = { text: `= ${sci(points[i].a, 2)}` };
    else if (i < points.length - 1) { const s = dbPerOct(points[i], points[i + 1]); rowNote[x.k] = { text: Math.abs(s) < 0.05 ? 'then flat' : `then ${s > 0 ? '+' : ''}${f(s, 1)} dB/oct` }; }
  });
  return { points, error, unreadable, rowNote };
}

function Breakpoints() {
  const { v } = useForm();
  const { rowNote } = readProfile(v);
  return (
    <View style={{ gap: 8 }}>
      {BP.map((_, k) => (
        <View key={k} style={{ gap: 2 }}>
          <FieldRow>
            <Num name={`f${k}`} label={`Breakpoint ${k + 1}`} unit="Hz" />
            <TextField name={`v${k}`} label="ASD g²/Hz, or slope dB/oct" />
          </FieldRow>
          {rowNote[k] ? <Hint style={rowNote[k].bad ? { color: 'var(--cast-intents-danger-default-default-fg)' } : undefined}>{rowNote[k].text}</Hint> : null}
        </View>
      ))}
    </View>
  );
}

function Chart({ points, fn, Q }: { points: { f: number; a: number }[]; fn: number; Q: number }) {
  const W = 420, H = 270, L = 62, R = 12, T = 30, B = 42;
  const fa = points[0].f / 1.3, fb = points[points.length - 1].f * 1.3;
  const ok = Number.isFinite(fn) && Number.isFinite(Q);
  const fs = Array.from({ length: 500 }, (_, i) => fa * Math.pow(fb / fa, i / 499));
  const resp = ok ? fs.map((x) => asdAt(points, x) * trans2(x, fn, Q)) : [];
  const amin = Math.min(...points.map((p) => p.a));
  const ymax = Math.pow(10, Math.ceil(Math.log10(Math.max(...points.map((p) => p.a), ...resp) * 1.05)));
  const ymin = Math.pow(10, Math.floor(Math.log10(amin)) - 1);
  const X = (x: number) => L + (Math.log(x / fa) / Math.log(fb / fa)) * (W - L - R);
  const Y = (y: number) => T + (Math.log(ymax / Math.max(y, ymin)) / Math.log(ymax / ymin)) * (H - T - B);
  const xticks: { x: number; label: boolean }[] = [];
  let lastX = -Infinity;
  for (let e = Math.floor(Math.log10(fa)); e <= Math.ceil(Math.log10(fb)); e++) for (const m of [1, 2, 5]) {
    const x = m * 10 ** e;
    if (x < fa || x > fb) continue;
    const label = X(x) - lastX >= String(x).length * 7.5 + 8; // skip a label that would touch its neighbour
    if (label) lastX = X(x);
    xticks.push({ x, label });
  }
  const yticks: number[] = []; for (let e = Math.log10(ymin); e <= Math.log10(ymax) + 1e-9; e++) yticks.push(e);
  const inPts = points.map((p) => `${X(p.f).toFixed(1)},${Y(p.a).toFixed(1)}`);
  const right = X(fn) < W * 0.7;
  return (
    <Figure label="Input and response acceleration spectral density against frequency, log-log"
      caption="Input ASD (shaded) and the part's response ASD (line) = input × transmissibility². The area under each is its mean square; Grms is the square root.">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {xticks.map(({ x, label }) => (
          <g key={x}>
            <line x1={X(x)} x2={X(x)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            {label ? <text x={X(x)} y={H - B + 16} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{String(x)}</text> : null}
          </g>
        ))}
        {yticks.map((e) => (
          <g key={e}>
            <line x1={L} x2={W - R} y1={Y(10 ** e)} y2={Y(10 ** e)} stroke="var(--rd-line)" />
            <text x={L - 6} y={Y(10 ** e) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{e >= -2 && e <= 2 ? String(10 ** e) : `10${sup(String(Math.round(e)))}`}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">Frequency (Hz)</text>
        <text x={13} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 13 ${(T + H - B) / 2})`}>ASD (g²/Hz)</text>
        <path d={`M${X(points[0].f)},${Y(ymin)} L${inPts.join(' L')} L${X(points[points.length - 1].f)},${Y(ymin)} Z`} fill="var(--rd-blue)" fillOpacity={0.25} stroke="var(--rd-blue)" strokeWidth={1.8} />
        {ok ? <path d={fs.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(resp[i]).toFixed(1)}`).join('')} fill="none" stroke="var(--rd-accent)" strokeWidth={2} /> : null}
        {ok && fn > fa && fn < fb ? (
          <>
            <line x1={X(fn)} x2={X(fn)} y1={T} y2={H - B} stroke="var(--rd-accent)" strokeDasharray="3 3" />
            <text x={X(fn) + (right ? 6 : -6)} y={T + 14} textAnchor={right ? 'start' : 'end'} fontSize={12} fill="var(--rd-accent)">{`fₙ ${f(fn, 0)} Hz`}</text>
          </>
        ) : null}
        <rect x={L} y={7} width={12} height={9} fill="var(--rd-blue)" fillOpacity={0.5} stroke="var(--rd-blue)" />
        <text x={L + 17} y={16} fontSize={12} fill="var(--rd-ink)">input</text>
        {ok ? (
          <>
            <line x1={L + 72} x2={L + 86} y1={12} y2={12} stroke="var(--rd-accent)" strokeWidth={2} />
            <text x={L + 91} y={16} fontSize={12} fill="var(--rd-ink)">response</text>
          </>
        ) : null}
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const notes: Note[] = [];
  const { points, error, unreadable } = readProfile(v);
  if (error || unreadable) return <Notes items={[{ tone: 'bad', text: `Input PSD: ${error ?? 'a row could not be read: use a number such as 0.04, or a slope such as +3 dB'}.` }]} />;
  const gIn = grms(points);
  const fn = num(v.fn), Q = num(v.q), m = num(v.m), T = num(v.t);
  const inRo = <Readout label="Input" value={f(gIn, 2)} unit={`g rms, ${f(points[0].f, 0)}–${f(points[points.length - 1].f, 0)} Hz`} />;
  if (!(fn > 0) || !(Q >= 1)) {
    return (
      <>
        <Readouts>{inRo}</Readouts>
        <Chart points={points} fn={NaN} Q={NaN} />
        <Notes items={[{ tone: 'warn', text: 'Enter the natural frequency and a Q of at least 1.' }]} />
      </>
    );
  }
  const ex = sdofResponse(points, fn, Q);
  const asdN = asdAt(points, fn);
  const gM = asdN > 0 ? miles(fn, Q, asdN) : NaN;
  const diff = gM / ex.grms - 1;
  const g3 = 3 * ex.grms, load = m > 0 ? m * g3 * G0 : NaN;

  // strength margin
  const fs = readFactor(v.fs), al = num(v.al);
  let msRo: React.ReactNode;
  if (fs === null) {
    msRo = <Readout label="Strength margin" value="needs your factor" />;
    notes.push({ tone: 'warn', text: awaitingMessage(['factor of safety'], 'the strength margin') });
  } else if (al > 0 && load > 0) {
    const ms = al / (fs * load) - 1;
    msRo = <Readout label="Strength margin" value={sgn(ms)} tone={ms < 0 ? 'bad' : 'ok'} sub={`${f(fs * load, 0)} N design vs ${f(al, 0)} N`} />;
    if (ms < 0) notes.push({ tone: 'bad', text: `The mount fails: design load ${f(fs * load, 0)} N exceeds the ${f(al, 0)} N allowable (MS ${sgn(ms)}).` });
    else if (ms > 0.5) notes.push({ tone: 'info', text: <>MS {sgn(ms)}: on a mass-driven part a large margin is a finding (the mount may be heavier than it needs to be). See <A href="../margin-policy/">Margin policy</A>.</> });
  } else msRo = <Readout label="Strength margin" value="—" sub="enter mass and allowable" />;

  // displacement
  const z3 = 3 * ex.zrms, cl = num(v.cl);
  if (cl > 0 && z3 >= cl) notes.push({ tone: 'bad', text: `3σ displacement ${f(z3, 2)} mm reaches the ${f(cl, 1)} mm clearance: expect contact. Stiffen the mount, add clearance or snub it.` });

  // cycles, peaks and fatigue: Steinberg's cycle count and the Rayleigh peaks assume a resonant, narrow-band response
  const resonant = fn >= points[0].f && fn <= points[points.length - 1].f;
  const cycles = T > 0 && resonant ? fn * T : NaN;
  const spg = num(v.spg), uts = num(v.uts), se = num(v.se), ne = num(v.ne);
  let fatRo: React.ReactNode, table: React.ReactNode = null;
  if (cycles > 0 && spg > 0 && uts > 0 && se > 0 && se < 0.9 * uts && ne > 1e3) {
    const curve = snCurve(uts, se, ne, v.lim === 'yes');
    const d = steinbergDamage(spg * ex.grms, cycles, curve.N);
    const top = d.D > 0 ? d.bands[2].d / d.D : NaN;
    fatRo = <Readout label="Fatigue damage" value={sci(d.D)} tone={d.D >= 1 ? 'bad' : d.D > 0.1 ? 'warn' : 'ok'} sub={`per exposure${d.D > 0 ? ` · life × ${sci(1 / d.D, 1)}` : ' · below Se'}`} />;
    table = (
      <DataTable
        caption={`Steinberg bands: ${f(cycles, 0)} cycles at fₙ; stress amplitude, life in cycles, share of the damage`}
        columns={[{ label: 'Band' }, { label: 'Cycles', numeric: true }, { label: 'MPa', numeric: true }, { label: 'Life', numeric: true }, { label: 'Share', numeric: true }]}
        rows={d.bands.map((b) => [`${b.k}σ`, f(b.n, 0), f(b.s, 1), sci(b.N).replace(/ /g, ''), d.D > 0 ? `${f((100 * b.d) / d.D, 1)}%` : '—'])}
      />
    );
    if (3 * spg * ex.grms >= uts) notes.push({ tone: 'bad', text: `The 3σ stress (${f(3 * spg * ex.grms, 0)} MPa) reaches the UTS: a strength problem before a fatigue one.` });
    if (d.D >= 1) notes.push({ tone: 'bad', text: `Fatigue damage ${sci(d.D)} ≥ 1: the part is predicted to fail within this exposure.` });
    else if (top > 0.5) notes.push({ tone: 'info', text: `${f(100 * top, 0)}% of the damage comes from the 3σ band: 4.3% of the cycles. The rare large cycles do the damage, so a few dB on the input matters far more than the duration.` });
  } else if (!resonant) fatRo = <Readout label="Fatigue damage" value="—" sub="not resonant in this band" />;
  else if (spg > 0 && se >= 0.9 * uts) fatRo = <Readout label="Fatigue damage" value="—" tone="warn" sub="Se must be below 0.9 × UTS" />;
  else fatRo = <Readout label="Fatigue damage" value="—" sub="not calculated" />;

  // where the simple model stops
  if (!resonant) notes.push({ tone: 'warn', text: `fₙ = ${f(fn, 0)} Hz is outside the input band (${f(points[0].f, 0)}–${f(points[points.length - 1].f, 0)} Hz): the part isn't resonating in this environment, so ${fn > points[points.length - 1].f ? 'it moves with the base and the load is close to the input level' : 'it is isolated from the input'}; the fatigue cycle count doesn't apply. Check the band covers the part, and that nothing outside it (sine, transient) excites the mode.` });
  else if (Math.abs(diff) > 0.1) notes.push({ tone: 'warn', text: `Miles' equation is ${f(100 * Math.abs(diff), 0)}% ${diff > 0 ? 'high' : 'low'} here because the input isn't flat around fₙ. Use the exact value.` });
  if (Q < 5) notes.push({ tone: 'warn', text: 'Q below 5 is heavy damping for a structure; Miles assumes light damping. Rely on the exact value.' });
  if (cycles > 0) notes.push({ tone: 'info', text: `In ${f(cycles, 0)} cycles about ${f(peaksAbove(3, cycles), 0)} peaks exceed 3σ and ${f(peaksAbove(4, cycles), peaksAbove(4, cycles) < 1 ? 1 : 0)} exceed 4σ. If a single overload breaks the part (a brittle material, a bond, a ceramic) size it beyond 3σ.` });

  return (
    <>
      <Readouts>
        {inRo}
        <Readout label="Response" value={f(ex.grms, 2)} unit="g rms exact" sub={`Miles ${f(gM, 2)}${Number.isFinite(diff) ? ` (${diff >= 0 ? '+' : ''}${f(100 * diff, 1)}%)` : ''}`} />
        <Readout label="3σ load" value={f(load, 0)} unit="N" primary sub={`3σ = ${f(g3, 1)} g${m > 0 ? ` on ${f(m, Number.isInteger(m) ? 0 : 1)} kg` : ''}`} />
        {msRo}
        <Readout label="3σ displacement" value={f(z3, z3 < 1 ? 2 : 1)} unit="mm" tone={cl > 0 ? (z3 >= cl ? 'bad' : 'ok') : undefined} sub={`relative to the base · rms ${f(ex.zrms, 3)}`} />
        {fatRo}
      </Readouts>
      <Chart points={points} fn={fn} Q={Q} />
      {table}
      <Notes items={notes} />
    </>
  );
}

export default function Vibration({ fill }: { fill: MaterialFillData }) {
  return (
    <Calc
      id="random-vibration"
      title="Random vibration: one mode (Miles, exact, 3-sigma, Steinberg)"
      defaults={{
        ...Object.fromEntries(BP.flatMap((b, k) => [[`f${k}`, b.f], [`v${k}`, b.v]])),
        fn: '150', q: '10', m: '4', t: '120', cl: '2', fs: '', al: '2000', spg: '4', uts: '310', se: '96', ne: '500000000', lim: 'no',
      }}
      example={{ values: { fs: '1.25' }, note: 'Worked-example factor loaded: factor of safety 1.25', factorFields: ['fs'] }}
      foot={
        <>
          One mode on a rigid base: Miles' equation G<sub>rms</sub> = √(π/2 · f<sub>n</sub> · Q · ASD(f<sub>n</sub>)), checked against the full
          integral of the input times the transmissibility. Gaussian response, narrow-band; Steinberg's bands at 1σ, 2σ and 3σ with f<sub>n</sub> ·
          duration cycles.
        </>
      }
    >
      <Inputs>
        <Group legend="Input PSD at the mount" hint="Enter an ASD such as 0.04, or a slope such as +3 dB, for the segment joining that row to its neighbour, as test specifications are written. Leave a row blank to drop it.">
          <Breakpoints />
        </Group>
        <Group legend="The part: one mode" hint="Q is the peak amplification at resonance; damping ratio ζ = 1/(2Q). Measure it in test where you can: about 10 is a common starting assumption for bolted metal structures.">
          <FieldRow><Num name="fn" label="Natural frequency fn" unit="Hz" /><Num name="q" label="Amplification Q" /></FieldRow>
          <FieldRow><Num name="m" label="Mass" unit="kg" /><Num name="t" label="Duration" unit="s" /></FieldRow>
          <Num name="cl" label="Clearance" unit="mm" placeholder="optional" />
        </Group>
        <Group legend="Strength margin" hint="The 3σ load is taken as the limit load. The factor applied to random-vibration loads, and how they combine with quasi-static loads, come from your programme's requirements.">
          <FieldRow><Num name="fs" label="Factor of safety" placeholder="your value" /><Num name="al" label="Allowable at the mount" unit="N" /></FieldRow>
        </Group>
        <Group
          legend="Fatigue: Steinberg three-band"
          hint={<>Stress per g at the critical point with the notch included; S<sub>e</sub> after surface, size and reliability factors: both from the <A href="../../fundamentals/fatigue/">Fatigue</A> page. Leave the stress blank to skip.</>}
        >
          <MaterialFill fill={fill} />
          <FieldRow><Num name="spg" label="Stress per g of response" unit="MPa/g" /><Num name="uts" label="UTS" unit="MPa" /></FieldRow>
          <FieldRow><Num name="se" label="Se at the part" unit="MPa" /><Num name="ne" label="at Ne cycles" /></FieldRow>
          <Choice name="lim" label="S-N below Se" options={[{ value: 'no', label: 'Keeps falling: aluminium, most non-ferrous' }, { value: 'yes', label: 'Endurance limit: most steels, titanium' }]} />
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
