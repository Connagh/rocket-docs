// Surface finish in three tabs: a simulated profile, filtered and measured as an instrument does it; the requirement
// for a function, the processes that can give it, acceptance of measured values and the drawing callout; and the loss
// of interference in a press fit. The drawing limit is the user's requirement and starts blank. Maths in
// src/lib/surface.ts (unit-tested).
import React, { useMemo } from 'react';
import { makeProfile, gaussianFilter, roughnessParams, materialRatio, turnedRoughness, feedForRa, cutoffFor, acceptance, smoothingLoss, processesFor, parseValues, FUNCTIONS, PROCESSES } from '../lib/surface';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Choice, Lines, ModeTabs, Readouts, Readout, Notes, Figure, useForm, useSlowValues, num, fmt, type Tone } from './kit';

const f = (v: number, d = 2) => (Number.isFinite(v) ? fmt(v, d) : '–');
const g3 = (v: number) => (Math.abs(v) >= 10 ? f(v, 1) : Math.abs(v) >= 1 ? f(v, 2) : f(v, 3));
const DONE: Record<string, string> = { sand: 'cast', forge: 'forged', invest: 'cast', am: 'as built', blast: 'grit blasted', mill: 'milled', turn: 'turned', drill: 'drilled', ream: 'reamed', edm: 'EDM', grind: 'ground', hone: 'honed', burnish: 'burnished', lap: 'lapped' };
const num2 = (v: number) => String(+v.toPrecision(3));
const LAY: Record<string, string> = { C: 'C (circular)', '=': '= (parallel to the view)', M: 'M (multidirectional)' };
const READINGS = '0.31, 0.29, 0.36, 0.42, 0.33, 0.30\n0.34, 0.28, 0.32, 0.35, 0.30, 0.33';
type Note = { tone: Tone; text: string };

function Profile() {
  const v = useSlowValues();
  const kind = v.p_kind as 'turned' | 'ground' | 'honed' | 'blasted', lc = num(v.p_lc), turned = kind === 'turned';
  const fd = num(v.p_f), nr = num(v.p_r), ra0 = num(v.p_ra), wa = Math.max(0, num(v.p_wa) || 0), wl = num(v.p_wl) || 3, cPct = Number.isFinite(num(v.p_c)) ? num(v.p_c) : 25;
  const ok = turned ? fd > 0 && nr > 0 : ra0 > 0;
  const dx = lc / 1600;
  const sim = useMemo(() => {
    if (!ok) return null;
    const z = makeProfile({ kind, length: 7 * lc, dx, feed: fd, nose: nr, rq: 1.25 * ra0, corr: kind === 'blasted' ? 0.03 : 0.01, plateau: 0.3, wavAmp: wa, wavLen: wl, seed: 3 });
    const flt = gaussianFilter(z, dx, lc);
    return { z, flt, p: roughnessParams(flt.roughness, dx, lc) };
  }, [ok, kind, lc, fd, nr, ra0, wa, wl]);
  if (!sim) return <Notes items={[{ tone: 'bad', text: turned ? 'Enter a feed and a nose radius.' : 'Enter a roughness Ra.' }]} />;
  const { z, flt, p } = sim;
  const mr = materialRatio(flt.roughness, (cPct / 100) * p.Rz);
  const rec = cutoffFor(p.Ra);
  const notes: Note[] = [];
  const th = turned ? turnedRoughness(fd, nr) : null;
  if (turned) {
    notes.push({ tone: 'info', text: 'The kinematic value is the best that the tool geometry can give. Tool wear, vibration and built-up edge make real surfaces rougher, usually by 1.5 to 3 times at fine feeds.' });
    if (fd * 2 > lc) notes.push({ tone: 'warn', text: 'The feed marks are longer than half the cutoff: the filter removes part of the roughness. Use a longer cutoff for a periodic profile with this spacing.' });
  }
  if (rec !== lc && wa > 0 && lc > rec) notes.push({ tone: 'warn', text: `With a ${lc} mm cutoff, part of the waviness is counted as roughness, and Ra is too high. For Ra near ${g3(p.Ra)} µm, ISO 4288 uses ${rec} mm.` });
  if (rec !== lc && lc < rec) notes.push({ tone: 'warn', text: `A ${lc} mm cutoff is too short for this roughness: the filter removes some of it, and Ra is too low.` });
  if (kind === 'honed') notes.push({ tone: 'info', text: 'Plateau honing cuts the peaks and keeps the valleys for oil or grease. The material ratio near the top is high for the same Ra. Specify it with Rmr, or with Rpk, Rk and Rvk (ISO 13565-2).' });
  notes.push({ tone: 'info', text: 'Ra does not show the shape. Two surfaces with the same Ra can seal or wear very differently. Add Rz, Rmr or Rsk where the function depends on the peaks.' });

  const W = 420, H = 250, L = 50, R = 14, T = 26, mid = 128;
  const n = flt.roughness.length, step = Math.max(1, Math.floor(n / 600)), X = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const raw = Array.from({ length: n }, (_, i) => z[i + flt.offset]);
  const rmax = Math.max(...raw.map(Math.abs)) || 1, qmax = Math.max(...Array.from(flt.roughness).map(Math.abs)) || 1;
  const Y1 = (x: number) => (T + mid) / 2 + 6 - (x / rmax) * ((mid - T) / 2 - 6), Y2 = (x: number) => (mid + 18 + H - 14) / 2 - (x / qmax) * ((H - 14 - mid - 18) / 2 - 4);
  const pts = (arr: ArrayLike<number>, Y: (x: number) => number) => { const s: string[] = []; for (let i = 0; i < n; i += step) s.push(`${X(i).toFixed(1)},${Y(arr[i]).toFixed(1)}`); return s.join(' '); };
  const top = Math.max(...Array.from(flt.roughness)), cut = top - (cPct / 100) * p.Rz;
  return (
    <>
      <Readouts>
        <Readout label="Ra" value={g3(p.Ra)} unit="µm" primary sub={`Rq ${g3(p.Rq)} µm · over ${p.segments} sampling lengths`} />
        <Readout label="Rz" value={g3(p.Rz)} unit="µm" sub={`Rt ${g3(p.Rt)} µm · Rp ${g3(p.Rp)} · Rv ${g3(p.Rv)} · Rz/Ra ${f(p.Rz / p.Ra, 1)}`} />
        <Readout label="Shape" value={`Rsk ${f(p.Rsk, 2)}`} sub={`Rku ${f(p.Rku, 2)} · ${p.Rsk < -0.4 ? 'plateaus with deep valleys: good bearing' : p.Rsk > 0.4 ? 'sharp peaks' : 'approximately symmetric'}`} />
        <Readout label={`Rmr at c = ${f(cPct, 0)}% of Rz`} value={`${f(100 * mr, 0)}%`} sub={`c = ${g3((cPct / 100) * p.Rz)} µm below the highest peak`} />
        <Readout label="Cutoff for this Ra" value={String(rec)} unit="mm" tone={rec === lc ? 'ok' : 'warn'} sub={`ISO 4288, non-periodic profile${rec !== lc ? ` · you selected ${lc} mm` : ''}`} />
        {th ? <Readout label="Kinematic roughness" value={`Ra ${g3(th.Ra)}`} unit="µm" sub={`Rt ${g3(th.Rt)} µm from f²/8r · feed for Ra 0.4: ${f(feedForRa(0.4, nr), 3)} mm/rev`} /> : null}
      </Readouts>
      <Figure label="Simulated profile and roughness"
        caption="Top: the simulated measured profile and its mean line from the Gaussian filter. Bottom: the roughness that is left, with the five sampling lengths and the cut level for Rmr.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <polyline points={pts(raw, Y1)} fill="none" stroke="var(--rd-steel)" strokeWidth={1.2} />
          <polyline points={pts(flt.waviness, Y1)} fill="none" stroke="var(--rd-blue)" strokeWidth={2} />
          <line x1={L} x2={W - R} y1={Y2(0)} y2={Y2(0)} stroke="var(--rd-ink)" strokeOpacity={0.5} />
          <polyline points={pts(flt.roughness, Y2)} fill="none" stroke="var(--rd-ink)" strokeWidth={1.2} />
          <line x1={L} x2={W - R} y1={Y2(cut)} y2={Y2(cut)} stroke="var(--rd-accent)" strokeDasharray="4 3" />
          {Array.from({ length: Math.max(0, p.segments - 1) }, (_, s) => <line key={s} x1={X(((s + 1) * n) / p.segments)} x2={X(((s + 1) * n) / p.segments)} y1={mid + 18} y2={H - 14} stroke="var(--rd-line)" />)}
          <text x={L} y={16} fontSize={12} fill="var(--rd-ink)">profile</text>
          <text x={W - R} y={16} textAnchor="end" fontSize={12} fill="var(--rd-blue)">mean line</text>
          <text x={L} y={mid + 12} fontSize={12} fill="var(--rd-ink)">roughness</text>
          <text x={W - R} y={mid + 12} textAnchor="end" fontSize={12} fill="var(--rd-accent)">cut level c</text>
          <text x={6} y={(T + mid) / 2 + 10} fontSize={11} fill="var(--rd-muted)">{`±${g3(rmax)}`}</text>
          <text x={6} y={(mid + H) / 2 + 6} fontSize={11} fill="var(--rd-muted)">{`±${g3(qmax)}`}</text>
          <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={11} fill="var(--rd-muted)">{`${f(5 * lc, 1)} mm evaluated · heights in µm`}</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Spec() {
  const { v } = useForm();
  const fn = FUNCTIONS.find((x) => x.key === v.s_fn) ?? FUNCTIONS[0], lim = num(v.s_lim), rule = v.s_rule as '16%' | 'max';
  const vals = parseValues(v.s_vals), proc = PROCESSES.find((x) => x.key === v.s_proc);
  const notes: Note[] = [];
  const target = lim > 0 ? lim : fn.ra[1];
  const pf = processesFor(target), usual = pf.filter((x) => x.fit === 'usual').map((x) => x.name), poss = pf.filter((x) => x.fit === 'possible').map((x) => x.name);
  let acc: React.ReactNode = <Readout label="Acceptance" value="needs your limit" sub="Enter the drawing limit: your requirement, from the seal maker, the bearing maker or your programme. Or push “Load worked example”." />;
  let callout: React.ReactNode = null;
  if (lim > 0) {
    if (vals.length) {
      const a = acceptance(vals, lim, rule);
      acc = <Readout label={`Acceptance, ${rule} rule`} value={a.pass ? 'accept' : 'reject'} tone={a.pass ? 'ok' : 'bad'}
        sub={`${a.reason} · largest ${g3(Math.max(...vals))} µm, mean ${g3(vals.reduce((s, x) => s + x, 0) / vals.length)} µm`} />;
      const other = acceptance(vals, lim, rule === 'max' ? '16%' : 'max');
      if (other.pass !== a.pass) notes.push({ tone: 'warn', text: `The same values ${other.pass ? 'pass' : 'fail'} under the ${rule === 'max' ? '16%' : 'max'} rule. The rule decides the result. Write it on the drawing.` });
    } else acc = <Readout label="Acceptance" value="—" sub="Enter the measured values." />;
    if (lim > fn.ra[1]) notes.push({ tone: 'warn', text: `The limit is rougher than the typical upper value for this function (Ra ${fn.ra[1]} µm).` });
    if (lim < fn.ra[0]) notes.push({ tone: 'info', text: 'The limit is finer than the typical range. It costs more, and for seals a very smooth face can let the ring slide.' });
    const call = [proc ? DONE[proc.key] : '', `Ra${rule === 'max' ? ' max' : ''} ${num2(lim)}`, fn.lay ? `lay ${fn.lay}` : ''].filter(Boolean);
    callout = <Readout label="Callout" value={`MRR ${call.join(' · ')}`} sub={`${fn.lay ? `lay ${LAY[fn.lay] ?? fn.lay}` : 'no lay requirement'}; add the cutoff ${cutoffFor(lim)} mm if the standard on the drawing does not set it`} />;
  }
  notes.push({ tone: 'info', text: 'The 16% rule accepts a surface if no more than 16% of the measured values are above the limit (ISO 4288 gives the sequence of measurements). The max rule accepts no value above the limit. Check which default the standard on your drawing uses, because ISO 21920 changed some defaults of ISO 1302 and ISO 4288.' });
  const W = 420, H = 250, Lx = 128, R = 12, T = 22, B = 30, list = PROCESSES.slice().sort((a, b) => a.ra[1] - b.ra[1]);
  const lo = Math.log10(0.0125), hi = Math.log10(50), X = (x: number) => Lx + ((Math.log10(x) - lo) / (hi - lo)) * (W - Lx - R), row = (H - T - B) / list.length;
  return (
    <>
      <Readouts>
        <Readout label="Typical finish" value={`Ra ${fn.ra[0]} to ${fn.ra[1]}`} unit="µm" primary sub={fn.note} />
        <Readout label={`Processes for Ra ${num2(target)}`} value={usual.length ? usual.slice(0, 2).join(', ') + (usual.length > 2 ? '…' : '') : 'none'}
          sub={<><b>usually:</b> {usual.join(', ') || 'none'}{poss.length ? <><br /><b>with care:</b> {poss.join(', ')}</> : null}</>} />
        {acc}
        {callout}
      </Readouts>
      <Figure label="Ra range of each process"
        caption="The Ra that each process usually gives (dark bars) and can give with care or at extra cost (light bars), with the typical range for the selected function.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {[0.025, 0.1, 0.4, 1.6, 6.3, 25].map((x) => (
            <g key={x}>
              <line x1={X(x)} x2={X(x)} y1={T} y2={H - B} stroke="var(--rd-line)" />
              <text x={X(x)} y={H - B + 13} textAnchor="middle" fontSize={11} fill="var(--rd-muted)">{String(x)}</text>
            </g>
          ))}
          {list.map((p, i) => {
            const y = T + i * row;
            return (
              <g key={p.key}>
                <rect x={X(p.ra[0])} y={y + row * 0.3} width={X(p.ra[3]) - X(p.ra[0])} height={row * 0.4} fill="var(--rd-steel)" fillOpacity={0.35} />
                <rect x={X(p.ra[1])} y={y + row * 0.15} width={X(p.ra[2]) - X(p.ra[1])} height={row * 0.7} rx={2} fill={proc && proc.key === p.key ? 'var(--rd-blue)' : 'var(--rd-steel)'} fillOpacity={0.85} />
                <text x={Lx - 6} y={y + row * 0.5 + 4} textAnchor="end" fontSize={11} fill="var(--rd-ink)">{p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name}</text>
              </g>
            );
          })}
          <rect x={X(fn.ra[0])} y={T} width={X(fn.ra[1]) - X(fn.ra[0])} height={H - T - B} fill="var(--rd-ok)" fillOpacity={0.12} />
          {lim > 0 ? <line x1={X(lim)} x2={X(lim)} y1={T - 6} y2={H - B} stroke="var(--rd-accent)" strokeWidth={2} /> : null}
          <text x={Lx} y={13} fontSize={11} fill="var(--rd-ok)">typical for the function</text>
          {lim > 0 ? <text x={W - R} y={13} textAnchor="end" fontSize={11} fill="var(--rd-accent)">your limit</text> : null}
          <text x={(Lx + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--rd-ink)">Ra (µm), log scale</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Fit() {
  const { v } = useForm();
  const rzi = num(v.f_rzi), rzo = num(v.f_rzo), mn = num(v.f_min), mx = num(v.f_max);
  if (![rzi, rzo, mn, mx].every(Number.isFinite)) return <Notes items={[{ tone: 'bad', text: 'Enter the two Rz values and the interference range.' }]} />;
  const loss = smoothingLoss(rzi, rzo), emn = mn - loss, emx = mx - loss;
  const notes: Note[] = [];
  if (emn <= 0) notes.push({ tone: 'bad', text: 'At the smallest interference, nothing is left after smoothing: the fit can be loose.' });
  notes.push({ tone: 'info', text: 'Use the effective interference for the contact pressure and the holding force on the Fits and Differential expansion pages. A finer finish loses less, and it also gives a more repeatable press force.' });
  const W = 420, H = 250, L = 120, R = 16, T = 40, B = 40;
  const top = Math.max(mx, 1) * 1.1, x0 = Math.min(0, emn) * 1.1, X = (x: number) => L + ((x - x0) / (top - x0)) * (W - L - R);
  const bar = (y: number, a: number, b: number, c: string, t: string) => (
    <g key={t}>
      <rect x={X(a)} y={y} width={Math.max(2, X(b) - X(a))} height={34} rx={3} fill={c} fillOpacity={0.75} />
      <text x={L - 8} y={y + 22} textAnchor="end" fontSize={12} fill="var(--rd-ink)">{t}</text>
    </g>
  );
  return (
    <>
      <Readouts>
        <Readout label="Interference lost" value={f(loss, 1)} unit="µm" primary sub="0.8 × (Rz inner + Rz outer), DIN 7190-1" />
        <Readout label="Effective interference" value={`${f(emn, 0)} to ${f(emx, 0)}`} unit="µm" tone={emn > 0 ? 'ok' : 'bad'}
          sub={`from ${f(mn, 0)} to ${f(mx, 0)} µm measured${mn > 0 ? ` · ${f((100 * loss) / mn, 1)}% of the smallest` : ''}`} />
      </Readouts>
      <Figure label="Measured and effective interference" caption="The interference measured on the parts, and the effective interference after the roughness peaks flatten on assembly.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {bar(T + 10, mn, mx, 'var(--rd-steel)', 'measured')}
          {bar(T + 74, emn, emx, 'var(--rd-blue)', 'effective')}
          <line x1={X(0)} x2={X(0)} y1={T} y2={H - B} stroke="var(--rd-ink)" strokeOpacity={0.6} />
          {[0, Math.round(top / 2 / 10) * 10, Math.round(top / 10) * 10].map((x) => <text key={x} x={X(x)} y={H - B + 16} textAnchor="middle" fontSize={11} fill="var(--rd-muted)">{String(x)}</text>)}
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--rd-ink)">interference (µm)</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Body() {
  const { v } = useForm();
  const turned = v.p_kind === 'turned';
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'profile', label: 'Profile & parameters' }, { value: 'spec', label: 'Requirement & acceptance' }, { value: 'fit', label: 'Press fit' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'profile' ? (
          <Group legend="A simulated surface" hint="The profile is 7 cutoffs long. The filter uses one cutoff at each end, so 5 cutoffs are evaluated, as in a standard measurement. Change the cutoff to see how the waviness gets into the result.">
            <FieldRow>
              <Choice name="p_kind" label="Process" options={[{ value: 'turned', label: 'Turned or bored' }, { value: 'ground', label: 'Ground' }, { value: 'honed', label: 'Plateau honed' }, { value: 'blasted', label: 'Grit blasted' }]} />
              <Choice name="p_lc" label="Cutoff λc (mm)" options={['0.25', '0.8', '2.5', '8'].map((x) => ({ value: x, label: x }))} />
            </FieldRow>
            {turned ? (
              <FieldRow><Num name="p_f" label="Feed" unit="mm/rev" /><Num name="p_r" label="Tool nose radius" unit="mm" /></FieldRow>
            ) : (
              <Num name="p_ra" label="Roughness Ra" unit="µm" />
            )}
            <FieldRow><Num name="p_wa" label="Waviness amplitude" unit="µm" /><Num name="p_wl" label="Waviness wavelength" unit="mm" /></FieldRow>
            <Num name="p_c" label="Cut depth c for Rmr" unit="% of Rz" />
          </Group>
        ) : v.tab === 'spec' ? (
          <Group legend="The requirement and the measurements" hint="Measure in the direction that crosses the lay, at the positions that the inspection plan gives. Typical ranges are screening guidance. The seal maker, the bearing maker or your programme sets the real limit.">
            <Choice name="s_fn" label="Function" options={FUNCTIONS.map((x) => ({ value: x.key, label: x.name }))} />
            <FieldRow>
              <Num name="s_lim" label="Drawing limit, Ra max" unit="µm" placeholder="your requirement" />
              <Choice name="s_rule" label="Comparison rule" options={[{ value: '16%', label: '16% rule' }, { value: 'max', label: 'Max rule' }]} />
            </FieldRow>
            <Choice name="s_proc" label="Process for the callout" options={[{ value: '', label: '(not stated)' }, ...PROCESSES.map((p) => ({ value: p.key, label: p.name }))]} />
            <Lines name="s_vals" label="Measured Ra values (µm)" rows={3} />
          </Group>
        ) : (
          <Group legend="Interference fit" hint="Interference as measured on the parts, at the assembly temperature. Defaults: the ⌀310 H7/s6 ring of the Fits page. A turned Ra 1.6 surface usually has an Rz of approximately 6 to 10 µm.">
            <FieldRow><Num name="f_rzi" label="Rz of the inner part" unit="µm" /><Num name="f_rzo" label="Rz of the outer part" unit="µm" /></FieldRow>
            <FieldRow><Num name="f_min" label="Smallest interference" unit="µm" /><Num name="f_max" label="Largest interference" unit="µm" /></FieldRow>
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'profile' ? <Profile /> : v.tab === 'spec' ? <Spec /> : <Fit />}</Outputs>
    </>
  );
}

export default function Surface() {
  return (
    <Calc
      id="surface-finish"
      title="Surface finish: profile, requirement, fit"
      defaults={{
        tab: 'profile', p_kind: 'turned', p_lc: '0.8', p_f: '0.08', p_r: '0.8', p_ra: '0.4', p_wa: '2', p_wl: '3', p_c: '25',
        s_fn: FUNCTIONS[0].key, s_lim: '', s_rule: '16%', s_proc: 'turn', s_vals: READINGS,
        f_rzi: '6.3', f_rzo: '6.3', f_min: '118', f_max: '202',
      }}
      example={{ values: { s_lim: '0.4', s_fn: 'sealGas' }, note: 'Worked-example limit loaded: Ra 0.4 µm for the nozzle seal bore', factorFields: ['s_lim'] }}
      foot="Gaussian profile filter (ISO 16610-21) with a kernel to ±λc. Parameters to the ISO 4287 definitions, Rz as the mean of five sampling lengths. Cutoff table and the 16% rule from ISO 4288. Simulated profiles, not measurements. Smoothing loss after DIN 7190-1."
    >
      <Body />
    </Calc>
  );
}
