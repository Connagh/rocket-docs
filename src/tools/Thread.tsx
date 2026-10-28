// Thread engagement: which fails first — the bolt, its threads, or the internal threads (tapped hole, helical-coil
// insert) — and the engagement length at which the bolt is the weaker. Maths in src/lib/threads.ts (unit-tested).
import React from 'react';
import { THREADS, GRADES } from '../lib/bolts';
import { stripping, balancedEngagement, helicalTapMajor, platingPitchGrowth, type Limits } from '../lib/threads';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, More, Readouts, Readout, Notes, Figure, useForm, num, fmt, HALO, type Tone } from './kit';

const kN = (v: number) => fmt(v / 1000, v < 10000 ? 2 : 1);

function Chart({ d, Le, bolt, ext, int, rated }: { d: number; Le: number; bolt: number; ext: (L: number) => number; int: ((L: number) => number) | null; rated: number | null }) {
  const W = 420, H = 260, L = 50, R = 14, T = 16, B = 40;
  const xmax = Math.max(2.5 * d, Le * 1.2), ymax = bolt * 2.2;
  const X = (x: number) => L + (x / xmax) * (W - L - R), Y = (y: number) => H - B - (Math.min(y, ymax) / ymax) * (H - T - B);
  const step = ymax > 40000 ? 20000 : ymax > 20000 ? 10000 : ymax > 8000 ? 4000 : 2000;
  const yt: number[] = []; for (let v = 0; v <= ymax; v += step) yt.push(v);
  const curve = (fn: (x: number) => number, color: string, label: string) => {
    // thread strength is linear in length: draw it up to where it leaves the plot, and label it there
    const xl = Math.min(xmax, (ymax / fn(xmax)) * xmax), top = fn(xl) >= ymax * 0.999;
    return (
      <g key={label}>
        <line x1={X(0)} y1={Y(0)} x2={X(xl)} y2={Y(fn(xl))} stroke={color} strokeWidth={2.2} />
        <text x={X(xl) - 6} y={Y(fn(xl)) + (top ? 14 : -6)} textAnchor="end" fontSize={12} fill={color} {...HALO}>{label}</text>
      </g>
    );
  };
  return (
    <Figure
      label="Strength of the bolt, the bolt threads and the internal threads against engagement length"
      caption="Thread strength grows with engagement; the bolt's does not. Beyond the crossing, the bolt breaks first. This is the failure that you want: visible, ductile and easy to repair."
    >
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {[0, 0.5, 1, 1.5, 2, 2.5].map((k) => (
          <g key={k}>
            <line x1={X(k * d)} x2={X(k * d)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            <text x={X(k * d)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{`${k}d`}</text>
          </g>
        ))}
        {yt.map((v) => <text key={v} x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{fmt(v / 1000, 0)}</text>)}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">engagement length</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>load (kN)</text>
        <line x1={L} x2={W - R} y1={Y(bolt)} y2={Y(bolt)} stroke="var(--rd-ink)" strokeWidth={2.2} />
        <text x={L + 6} y={Y(bolt) - 6} fontSize={12} fill="var(--rd-ink)" {...HALO}>{`bolt breaks ${fmt(bolt / 1000, 1)} kN`}</text>
        {curve(ext, 'var(--rd-accent)', 'bolt threads')}
        {int ? curve(int, 'var(--rd-blue)', 'internal threads') : null}
        {rated ? (
          <>
            <line x1={L} x2={W - R} y1={Y(rated)} y2={Y(rated)} stroke="var(--rd-blue)" strokeWidth={2} strokeDasharray="6 4" />
            <text x={W - R - 4} y={Y(rated) - 6} textAnchor="end" fontSize={12} fill="var(--rd-blue)" {...HALO}>rated nut</text>
          </>
        ) : null}
        <line x1={X(Le)} x2={X(Le)} y1={T} y2={H - B} stroke="var(--rd-ok)" strokeWidth={2} strokeDasharray="4 3" />
        <text x={X(Le) + 4} y={H - B - 6} fontSize={12} fill="var(--rd-ok)" {...HALO}>{`${fmt(Le, 1)} mm`}</text>
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const t = THREADS.find((x) => x.name === v.th) ?? THREADS[0];
  const Rm = num(v.rm), tb = num(v.tb), tp = num(v.tp), Le = num(v.le), kind = v.kind;
  if (![Rm, tb, Le].every((x) => x > 0) || (kind !== 'nut' && !(tp > 0))) {
    return <Notes items={[{ tone: 'bad', text: 'Fill in the bolt strength, thread shear strength, engagement and part shear strength.' }]} />;
  }
  const lim: Limits = {};
  for (const [k, n] of [['dMin', 'dmin'], ['d2Min', 'd2min'], ['D1Max', 'D1max'], ['D2Max', 'D2max']] as const) if (num(v[n]) > 0) lim[k] = num(v[n]);
  const base = { t, Rm, tauBolt: tb, tauInt: kind === 'nut' ? Infinity : tp, insert: kind === 'insert', lim };
  const s = stripping({ ...base, Le });
  const rate = num(v.rate) * 1000;
  const intLoad = kind === 'nut' ? (rate > 0 ? rate : NaN) : s.int;
  const loads = { bolt: s.bolt, external: s.ext, internal: intLoad };
  const first = (Object.entries(loads).filter(([, x]) => Number.isFinite(x)) as [keyof typeof loads, number][]).reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  const ratio = Math.min(s.ext, Number.isFinite(intLoad) ? intLoad : Infinity) / s.bolt;
  const names = { bolt: 'the bolt breaks', external: 'the bolt threads strip', internal: kind === 'insert' ? 'the insert pulls out' : kind === 'nut' ? 'the nut fails' : 'the tapped threads strip' };
  const bal = kind === 'nut' ? (s.bolt * Le) / s.ext : balancedEngagement(base); // with a rated nut only the bolt threads can strip

  const notes: { tone: Tone; text: string }[] = [];
  if (first !== 'bolt') notes.push({ tone: 'bad', text: `${names[first][0].toUpperCase() + names[first].slice(1)} before the bolt breaks. NASA-STD-5020B §4.7.4 asks for enough complete threads that the bolt fails in tension first: engage more thread, fit an insert, or use a bolt no stronger than the threads need.` });
  if (!Object.keys(lim).length && kind !== 'nut') notes.push({ tone: 'info', text: "Basic-size shear areas are an upper bound: real threads at their tolerance limits have less, nuts dilate and threads bend. That is why practice engages about 1.5–2 d in aluminium alloys; enter minimum-material diameters, or use VDI 2230's full method, for a design value." });
  if (kind === 'insert') notes.push({ tone: 'info', text: 'Rate a procured insert by its specification: the lower of its internal-thread strength and its pull-out from the part (NASA-STD-5020B §4.4.1). Pull-out from non-metallic or sandwich parts needs test. A stainless insert in aluminium needs primer against galvanic corrosion.' });
  if (kind === 'nut') notes.push({ tone: 'info', text: 'Procured nuts and inserts are rated by their specified strength, not by a stripping analysis: they dilate under load (NASA-STD-5020B §4.4.1). The bolt should extend at least two pitches past the nut (§4.7.4).' });
  const pl = num(v.pl);
  if (pl > 0) notes.push({ tone: 'info', text: `A ${fmt(pl, 0)} μm coating on the flanks raises the pitch diameter by ${fmt(platingPitchGrowth(pl), 0)} μm: it must fit inside the allowance of the tolerance position (6g rather than 6h) or the plated thread will not assemble.` });

  return (
    <>
      <Readouts>
        <Readout label="Fails first" value={names[first]} tone={first === 'bolt' ? 'ok' : 'bad'} primary sub={first === 'bolt' ? 'the failure you want' : 'before the bolt: engage more'} />
        <Readout label="Threads ÷ bolt" value={fmt(ratio, 2)} tone={ratio >= 1 ? 'ok' : 'bad'} sub="weaker threads ÷ bolt; above 1, the bolt goes first" />
        <Readout label="Equal strength at" value={fmt(bal, 1)} unit="mm" sub={`${fmt(bal / t.d, 2)} d · ${fmt(bal / t.P, 1)} threads, ${Object.keys(lim).length ? 'minimum material' : 'basic size'}`} />
        <Readout label="Bolt breaks at" value={kN(s.bolt)} unit="kN" sub={`Rm × As = ${fmt(Rm, 0)} × ${fmt(t.As, 1)} mm²`} />
        <Readout label="Bolt threads strip at" value={kN(s.ext)} unit="kN" sub={`at ${fmt(Le, 1)} mm, ${fmt(Le / t.P, 1)} threads`} />
        <Readout
          label="Internal threads strip at"
          value={kind === 'nut' ? (rate > 0 ? kN(rate) : '—') : kN(s.int)}
          unit={kind !== 'nut' || rate > 0 ? 'kN' : undefined}
          sub={kind === 'nut' ? (rate > 0 ? 'rated' : 'enter the rated strength') : kind === 'insert' ? `part sheared at ⌀${fmt(helicalTapMajor(t), 1)}` : `part sheared at ⌀${fmt(lim.dMin ?? t.d, 2)}`}
        />
      </Readouts>
      <Chart
        d={t.d}
        Le={Le}
        bolt={s.bolt}
        ext={(L) => stripping({ ...base, Le: L }).ext}
        int={kind === 'nut' ? null : (L) => stripping({ ...base, Le: L }).int}
        rated={kind === 'nut' && rate > 0 ? rate : null}
      />
      <Notes items={notes} />
    </>
  );
}

export default function Thread() {
  return (
    <Calc
      id="thread-engagement"
      title="Thread engagement: one bolt (bolt breaks first?)"
      defaults={{ th: 'M6', gr: '10.9', rm: '1040', tb: '624', kind: 'tapped', le: '9', tp: '186', rate: '', pl: '0', dmin: '', d2min: '', D1max: '', D2max: '' }}
      foot={
        <>
          Shear areas from the FED-STD-H28 / VDI 2230 form, A = π·L<sub>e</sub>·D·[P/2 + tan30°·Δ]/P: 7/8 of π·d·L<sub>e</sub> for the internal
          threads and 3/4 of π·D<sub>1</sub>·L<sub>e</sub> for the bolt threads at basic size. Helical-coil insert: the part is tapped to about
          d + 1.3P. Nut dilation and thread bending are not included.
        </>
      }
    >
      <Inputs>
        <Group legend="Bolt" hint={<>Shear ultimate of steel bolts is about 0.6 × R<sub>m</sub>; use your allowable where you have one.</>}>
          <FieldRow>
            <Choice name="th" label="Thread" options={THREADS.map((t) => ({ value: t.name, label: `${t.name} × ${t.P}` }))} />
            <Choice
              name="gr"
              label="Grade"
              options={GRADES.map((g) => ({ value: g.key, label: g.name }))}
              then={(key) => {
                const g = GRADES.find((x) => x.key === key);
                return g ? { rm: String(g.Rm), tb: String(Math.round(0.6 * g.Rm)) } : undefined;
              }}
            />
          </FieldRow>
          <FieldRow>
            <Num name="rm" label="Tensile, Rm" unit="MPa" />
            <Num name="tb" label="Thread shear ultimate" unit="MPa" />
          </FieldRow>
        </Group>
        <Group
          legend="Internal thread"
          hint="Part shear ultimate is the parent material's (6061-T6 is about 186 MPa): use your allowable. A rated part (nut, insert) uses its specified strength, not a stripping analysis."
        >
          <Choice
            name="kind"
            label="Into"
            options={[
              { value: 'tapped', label: 'A tapped hole in the part' },
              { value: 'insert', label: 'A helical-coil insert in the part' },
              { value: 'nut', label: 'A procured nut or insert (rated)' },
            ]}
          />
          <FieldRow>
            <Num name="le" label="Engagement length" unit="mm" />
            <Num name="tp" label="Part shear ultimate" unit="MPa" />
          </FieldRow>
          <FieldRow>
            <Num name="rate" label="Rated strength" unit="kN" placeholder="from its spec" />
            <Num name="pl" label="Plating thickness" unit="μm" />
          </FieldRow>
        </Group>
        <More title="Minimum-material diameters (optional)">
          <FieldRow>
            <Num name="dmin" label="Bolt major, min" unit="mm" placeholder="basic" />
            <Num name="d2min" label="Bolt pitch ⌀, min" unit="mm" placeholder="basic" />
          </FieldRow>
          <FieldRow>
            <Num name="D1max" label="Nut minor, max" unit="mm" placeholder="basic" />
            <Num name="D2max" label="Nut pitch ⌀, max" unit="mm" placeholder="basic" />
          </FieldRow>
          <Notes items={[{ tone: 'info', text: 'From the thread’s tolerance class (ISO 965, FED-STD-H28). Blank uses basic size, which overstates the shear areas.' }]} />
        </More>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
