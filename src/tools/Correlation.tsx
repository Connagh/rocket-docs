// Test correlation in four tabs: strain gauges against the model, the uncertainty of one gauge reading, modal
// correlation by frequency and MAC, and which physical parameter could plausibly close a frequency gap. Acceptance
// criteria are the programme's and start blank. Maths in src/lib/correlation.ts (unit-tested).
import React from 'react';
import { gaugeStats, parseGauges, gaugeUncertainty, macMatrix, parseModes, pairModes, requiredChange } from '../lib/correlation';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, TextField, Lines, ModeTabs, Readouts, Readout, Notes, Figure, useForm, num, fmt, type Tone } from './kit';

const f = (v: number, d = 2) => fmt(v, d);
const g3 = (v: number) => (Math.abs(v) >= 100 ? f(v, 0) : Math.abs(v) >= 10 ? f(v, 1) : Math.abs(v) >= 1 ? f(v, 2) : f(v, 3));
const pc = (v: number, d = 1) => (Math.abs(v) < 5e-5 ? '0.0%' : `${v >= 0 ? '+' : '−'}${f(Math.abs(100 * v), d)}%`);
const list = (s: string) => s.split(/[,;\s]+/).filter((x) => x !== '').map(Number).filter(Number.isFinite);
const criterion = (name: string, what: string) => `Enter your programme's ${name} to ${what}. Criteria come from your governing requirement, not from this site. Or press “Load worked example”.`;
type Note = { tone: Tone; text: string };
const GAUGES = `G1 hoop, mid-cylinder, 4990, 5021
G2 axial, mid-cylinder, 1245, 1233
G3 hoop, 100 mm from aft flange, 4950, 5021
G4 axial, 100 mm from aft flange, 1260, 1233
G5 hoop, 250 mm from fwd dome, 4680, 5021
G6 axial, 250 mm from fwd dome, 1150, 1233
G7 meridional, aft dome, 4230, 4169
G8 hoop, aft dome, 4120, 4169`;
const TEST_MODES = `0.07 -0.19 0.45
0.20 -0.55 0.70
0.37 -0.69 0.06
0.57 -0.42 -0.60
0.78 0.20 -0.25
1.00 1.00 1.00`;
const MODEL_MODES = `0.045 -0.225 0.489
0.166 -0.590 0.722
0.340 -0.714 0.020
0.547 -0.423 -0.644
0.771 0.216 -0.218
1.000 1.000 1.000`;
const PARAMS = `Young's modulus, 0.5, 3
Density, -0.5, 2
Bracket thickness, 1.0, 4
Root joint stiffness, 0.35, 50`;
const W = 420, H = 250;

function Gauges() {
  const { v } = useForm();
  const g = parseGauges(v.s_rows), bandPct = num(v.s_band), band = bandPct > 0 ? bandPct / 100 : undefined;
  if (g.length < 2) return <Notes items={[{ tone: 'bad', text: 'Enter at least two gauges as “name, test, model”.' }]} />;
  const s = gaugeStats(g, band);
  const notes: Note[] = [];
  // outliers against the median, which a couple of bad gauges cannot drag the way they drag the mean
  const med = (x: number[]) => { const a = [...x].sort((p, q) => p - q), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const mid = med(s.each.map((x) => x.ratio)), mad = med(s.each.map((x) => Math.abs(x.ratio - mid)));
  const off = s.each.filter((x) => Math.abs(x.ratio - mid) > Math.max(2 * mad, 0.03));
  if (Math.abs(s.mean - 1) > 0.05 && s.sd < 0.03) notes.push({ tone: 'warn', text: 'Every gauge is off by about the same ratio: look for something global (the applied load or pressure calibration, the modulus, the wall thickness everywhere) before anything local.' });
  if (off.length >= 2) notes.push({ tone: 'warn', text: `${off.map((x) => x.name.split(/\s/)[0]).join(' and ')} stand apart from the rest. If they share a location and are off by the same ratio in both directions, suspect the local wall or material; if only one direction is off, suspect the gauge, its orientation or local bending.` });
  notes.push({ tone: 'info', text: 'An acceptance band must be wider than the gauges can resolve (see the Gauge uncertainty tab) and is set by your programme, not chosen after seeing the data.' });
  const worst = s.each.reduce((a, b) => (Math.abs(b.ratio - 1) > Math.abs(a.ratio - 1) ? b : a));
  const L = 64, R = 20, T = 30, B = 46;
  const lim = Math.max(0.1, ...s.each.map((x) => Math.abs(x.ratio - 1))) * 1.15;
  const X = (i: number) => L + 10 + (i / Math.max(1, s.n - 1)) * (W - L - R - 20), Y = (d: number) => T + ((lim - d) / (2 * lim)) * (H - T - B);
  const step = lim > 0.2 ? 0.1 : 0.05;
  const ys: number[] = []; for (let d = -Math.floor(lim / step) * step; d <= lim + 1e-9; d += step) ys.push(d);
  return (
    <>
      <Readouts>
        <Readout label="Mean test / model" value={f(s.mean, 3)} primary sub={`${s.n} gauges · scatter ${f(100 * s.sd, 1)}% (one standard deviation)`} />
        <Readout label="Slope through the origin" value={f(s.slope, 3)} sub={`least squares, test on model · R² ${f(s.r2, 4)}`} />
        {band !== undefined
          ? <Readout label={`Outside ±${f(bandPct, Number.isInteger(bandPct) ? 0 : 1)}%`} value={`${s.outside} of ${s.n}`} tone={s.outside ? 'bad' : 'ok'} sub={s.each.filter((x) => x.out).map((x) => x.name.split(/\s/)[0]).join(', ') || 'none'} />
          : <Readout label="Acceptance" value="needs your criterion" sub={criterion('acceptance band', 'mark the gauges outside it')} />}
        <Readout label="Furthest from the model" value={pc(worst.ratio - 1)} sub={worst.name} />
      </Readouts>
      <Figure label="Each gauge as test over model minus one" caption="Each gauge as test ÷ model − 1. The shaded band is the acceptance criterion, once entered; red points are outside it.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {band !== undefined ? <rect x={L} y={Y(band)} width={W - L - R} height={Y(-band) - Y(band)} fill="var(--rd-ok)" fillOpacity={0.1} /> : null}
          {ys.map((d) => (
            <g key={d}>
              <line x1={L} x2={W - R} y1={Y(d)} y2={Y(d)} stroke={Math.abs(d) < 1e-9 ? 'var(--rd-ink)' : 'var(--rd-line)'} strokeOpacity={Math.abs(d) < 1e-9 ? 0.6 : 1} />
              <text x={L - 6} y={Y(d) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{`${d > 1e-9 ? '+' : ''}${f(100 * d, 0)}`}</text>
            </g>
          ))}
          {s.each.map((x, i) => (
            <g key={i}>
              <circle cx={X(i)} cy={Y(x.ratio - 1)} r={5} fill={x.out ? 'var(--rd-accent)' : 'var(--rd-blue)'} stroke="var(--rd-panel)" strokeWidth={1.5} />
              {s.n <= 12 ? <text x={X(i)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{x.name.split(/\s/)[0].slice(0, 4)}</text> : null}
            </g>
          ))}
          <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">gauge</text>
          <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>test / model − 1 (%)</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Uncert() {
  const { v } = useForm();
  const u = { e1: num(v.u_e1), e2: num(v.u_e2), angle: num(v.u_ang) || 0, gfTol: (num(v.u_gf) || 0) / 100, kt: (num(v.u_kt) || 0) / 100, nu0: num(v.u_nu0) || 0.285, misalign: num(v.u_mis) || 0, posErr: num(v.u_pos) || 0, gradient: num(v.u_grad) || 0, instr: num(v.u_ins) || 0 };
  if (!Number.isFinite(u.e1) || !Number.isFinite(u.e2)) return <Notes items={[{ tone: 'bad', text: 'Enter the two principal strains at the gauge site.' }]} />;
  const r = gaugeUncertainty(u);
  const names: Record<string, string> = { gaugeFactor: 'Gauge factor', transverse: 'Transverse sensitivity', misalignment: 'Misalignment', position: 'Position × gradient', instrument: 'Instrumentation' };
  const biggest = Object.entries(r.parts).reduce((a, b) => (b[1] > a[1] ? b : a));
  const notes: Note[] = [];
  if (biggest[0] === 'transverse') notes.push({ tone: 'warn', text: `Transverse sensitivity dominates: the transverse strain (${f(r.trans, 0)} µε) is large against the reading. It is systematic, so correct for it with the rosette's own transverse reading rather than carrying it as uncertainty.` });
  if (biggest[0] === 'misalignment') notes.push({ tone: 'warn', text: 'Misalignment dominates: the gauge is far from a principal direction, where angle errors matter at first order. Along a principal direction they barely matter.' });
  if (biggest[0] === 'position') notes.push({ tone: 'warn', text: 'The gauge sits in a steep gradient: its reading depends on exactly where it is. Move it to a gentler region, or compare with the model averaged over the gauge.' });
  notes.push({ tone: 'info', text: 'An acceptance band tighter than this uncertainty cannot be met, however good the model.' });
  const Lx = 120, R = 20, T = 30, B = 34, items = Object.entries(r.parts);
  const top = Math.max(...items.map(([, x]) => x), r.total) * 1.1 || 1, X = (x: number) => Lx + (x / top) * (W - Lx - R), row = (H - T - B) / (items.length + 1);
  return (
    <>
      <Readouts>
        <Readout label="Reading" value={f(r.reading, 0)} unit="µε" primary sub={`± ${f(r.total, 0)} µε, ${pc(r.fraction).replace('+', '')}: root sum of squares`} />
        {items.map(([k, x]) => <Readout key={k} label={names[k]} value={f(x, 1)} unit="µε" tone={k === biggest[0] && x > 0 ? 'warn' : undefined} sub={`${f((100 * x * x) / (r.total * r.total || 1), 0)}% of the variance`} />)}
      </Readouts>
      <Figure label="Contributions to one reading's uncertainty" caption="The contributions to one reading's uncertainty and their root sum of squares.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {[...items, ['total (RSS)', r.total] as [string, number]].map(([k, x], i) => {
            const y = T + i * row + row * 0.2;
            return (
              <g key={k}>
                <rect x={Lx} y={y} width={Math.max(1, X(x) - Lx)} height={row * 0.6} rx={2} fill={k === 'total (RSS)' ? 'var(--rd-ink)' : k === biggest[0] ? 'var(--rd-warn)' : 'var(--rd-blue)'} fillOpacity={0.8} />
                <text x={Lx - 6} y={y + row * 0.3 + 4} textAnchor="end" fontSize={12} fill="var(--rd-ink)">{k === 'total (RSS)' ? 'total' : (names[k] ?? k).split(' ')[0].toLowerCase()}</text>
              </g>
            );
          })}
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">error (µε)</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Modes() {
  const { v } = useForm();
  const ft = list(v.m_ft), fm = list(v.m_fm), st = parseModes(v.m_st), sm = parseModes(v.m_sm);
  if (!st.length || !sm.length || st[0].length !== sm[0].length) return <Notes items={[{ tone: 'bad', text: 'Enter test and model shapes at the same measured points: the same number of rows in both.' }]} />;
  if (ft.length < st.length || fm.length < sm.length) return <Notes items={[{ tone: 'bad', text: 'Give a frequency for every mode shape (one per column).' }]} />;
  const M = macMatrix(st, sm), pairs = pairModes(ft, fm, M), auto = macMatrix(st, st);
  const dfc = num(v.m_df) > 0 ? num(v.m_df) / 100 : NaN, macc = num(v.m_mac) > 0 ? num(v.m_mac) : NaN;
  const offAuto = Math.max(0, ...auto.flatMap((r, i) => r.filter((_, j) => j !== i)));
  const notes: Note[] = [];
  if (new Set(pairs.map((p) => p.model)).size < pairs.length) notes.push({ tone: 'bad', text: 'Two test modes pair with the same model mode: the model is missing a mode, or the measurement points cannot tell two shapes apart.' });
  if (offAuto > 0.25) notes.push({ tone: 'warn', text: 'The test modes look alike at these points (high off-diagonal AutoMAC): add measurement points, or the MAC cannot distinguish the shapes.' });
  if (pairs.length >= 2 && Math.abs(pairs[0].df) > 2 * Math.abs(pairs[pairs.length - 1].df)) notes.push({ tone: 'warn', text: 'The first mode is furthest off and higher ones closer: the classic signature of a boundary or joint that is softer (or stiffer) than modelled, since the lowest modes depend most on their supports.' });
  notes.push({ tone: 'info', text: 'MAC compares shapes, not frequencies, and ignores mass. Where mass-normalised modes and a test-analysis mass matrix exist, cross-orthogonality is the stronger check.' });
  const nT = M.length, nM = M[0].length, Lx = 72, T = 34, B = 40;
  const cell = Math.min((W - Lx - 20) / nM, (H - T - B) / nT), x0 = Lx + (W - Lx - 20 - cell * nM) / 2;
  const judged = Number.isFinite(dfc) || Number.isFinite(macc);
  return (
    <>
      <Readouts>
        {pairs.map((p, k) => {
          const okF = !Number.isFinite(dfc) || Math.abs(p.df) <= dfc, okM = !Number.isFinite(macc) || p.mac >= macc;
          return <Readout key={k} label={`Test mode ${p.test + 1}`} value={`${g3(p.fTest)} Hz ↔ model ${p.model + 1}, ${g3(p.fModel)} Hz`} primary={k === 0}
            tone={judged ? (okF && okM ? 'ok' : 'bad') : undefined} sub={`model ${pc(p.df)} · MAC ${f(p.mac, 3)}`} />;
        })}
        {!judged ? <Readout label="Criteria" value="needs your criteria" sub={criterion('frequency and MAC criteria', 'judge each pair')} /> : null}
        <Readout label="Test AutoMAC, off-diagonal" value={f(offAuto, 3)} tone={offAuto > 0.25 ? 'warn' : undefined} sub="the best separation these measurement points can give" />
      </Readouts>
      <Figure label="MAC matrix between test and model modes" caption="MAC between every test mode (rows) and every model mode (columns). A good correlation has a strong diagonal and a weak rest.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {M.map((row, i) => row.map((x, j) => (
            <g key={`${i}-${j}`}>
              <rect x={x0 + j * cell} y={T + i * cell} width={cell - 2} height={cell - 2} rx={3} fill="var(--rd-blue)" fillOpacity={0.08 + 0.85 * x} />
              <text x={x0 + j * cell + cell / 2 - 1} y={T + i * cell + cell / 2 + 4} textAnchor="middle" fontSize={12} fill={x > 0.5 ? 'var(--rd-panel)' : 'var(--rd-ink)'}>{f(x, 2)}</text>
            </g>
          )))}
          {M.map((_, i) => <text key={`t${i}`} x={x0 - 6} y={T + i * cell + cell / 2 + 4} textAnchor="end" fontSize={12} fill="var(--rd-ink)">{`test ${i + 1}`}</text>)}
          {M[0].map((_, j) => <text key={`m${j}`} x={x0 + j * cell + cell / 2 - 1} y={T - 8} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">{`model ${j + 1}`}</text>)}
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">MAC: 1 = same shape, 0 = unrelated</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Explain() {
  const { v } = useForm();
  const ft = num(v.e_ft), fm = num(v.e_fm);
  const params = v.e_rows.split(/\r?\n/).map((l) => l.split(',').map((s) => s.trim())).filter((p) => p.length >= 3 && Number.isFinite(+p[1]) && +p[1] !== 0 && Number.isFinite(+p[2]))
    .map(([name, S, pl]) => ({ name, S: +S, plaus: +pl / 100 }));
  if (!(ft > 0 && fm > 0) || !params.length) return <Notes items={[{ tone: 'bad', text: 'Enter both frequencies and at least one parameter as “name, sensitivity, plausible ±%”.' }]} />;
  const res = params.map((p) => ({ ...p, need: requiredChange(ft, fm, p.S) })).map((p) => ({ ...p, ok: Math.abs(p.need) <= p.plaus }));
  const plausible = res.filter((p) => p.ok);
  const notes: Note[] = [];
  if (!plausible.length) notes.push({ tone: 'bad', text: 'No single parameter can close the gap within what is known about it: the model is missing something (a joint, a mass, a boundary condition, a piece of physics). Find it rather than stretching a parameter.' });
  else if (plausible.length === 1) notes.push({ tone: 'ok', text: `Only ${plausible[0].name.toLowerCase()} can close the gap within its uncertainty. Change it (once, with the reason recorded), then check the modes and gauges that were not used to make the change.` });
  else notes.push({ tone: 'warn', text: 'Several parameters could each close the gap: one frequency cannot tell them apart. Use other modes, other tests or direct measurement to decide.' });
  notes.push({ tone: 'info', text: 'A change that fits one result is a hypothesis; one that also predicts results it was not fitted to is a correlation.' });
  const Lx = 120, R = 20, T = 30, B = 34;
  const lim = Math.max(...res.map((p) => Math.max(Math.abs(p.need), p.plaus))) * 1.1, X = (x: number) => Lx + ((x + lim) / (2 * lim)) * (W - Lx - R), row = (H - T - B) / res.length;
  return (
    <>
      <Readouts>
        <Readout label="Gap" value={pc(fm / ft - 1)} primary sub={`model ${g3(fm)} Hz against test ${g3(ft)} Hz`} />
        {res.map((p) => <Readout key={p.name} label={p.name} value={pc(p.need)} tone={p.ok ? 'ok' : 'bad'} sub={`needed alone, against ±${f(100 * p.plaus, 0)}% plausible: ${p.ok ? 'could explain it' : 'cannot, on its own'}`} />)}
      </Readouts>
      <Figure label="Change each parameter needs against its plausible range" caption="The change each parameter would need to close the gap on its own (dot), against how far it could plausibly be off (band).">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <line x1={X(0)} x2={X(0)} y1={T} y2={H - B} stroke="var(--rd-ink)" strokeOpacity={0.6} />
          {res.map((p, i) => {
            const y = T + i * row + row * 0.2;
            return (
              <g key={p.name}>
                <rect x={X(-p.plaus)} y={y} width={X(p.plaus) - X(-p.plaus)} height={row * 0.6} rx={2} fill="var(--rd-ok)" fillOpacity={0.18} />
                <circle cx={X(Math.max(-lim, Math.min(lim, p.need)))} cy={y + row * 0.3} r={5.5} fill={p.ok ? 'var(--rd-ok)' : 'var(--rd-accent)'} stroke="var(--rd-panel)" strokeWidth={1.5} />
                <text x={Lx - 6} y={y + row * 0.3 + 4} textAnchor="end" fontSize={12} fill="var(--rd-ink)">{p.name.length > 14 ? `${p.name.slice(0, 13)}…` : p.name}</text>
              </g>
            );
          })}
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">change needed · band: plausible</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Body() {
  const { v } = useForm();
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'gauges', label: 'Strain gauges' }, { value: 'uncert', label: 'Gauge uncertainty' }, { value: 'modes', label: 'Modes & MAC' }, { value: 'explain', label: 'What could explain it' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'gauges' ? (
          <Group legend="Gauges: name, test, model (µε)" hint="One gauge per line. Compare the model's strain averaged over the gauge length, on the gauged surface, in the gauge's direction, and preferably slopes of strain against load, which remove zero offsets.">
            <Lines name="s_rows" label="One gauge per line" rows={9} />
            <Num name="s_band" label="Acceptance band ±" unit="%" placeholder="your criterion" />
          </Group>
        ) : v.tab === 'uncert' ? (
          <Group legend="One gauge" hint="Gauge-factor tolerance and transverse sensitivity from the gauge data sheet. The gradient comes from the model at the gauge site.">
            <FieldRow><Num name="u_e1" label="Principal strain ε1" unit="µε" /><Num name="u_e2" label="Principal strain ε2" unit="µε" /></FieldRow>
            <FieldRow><Num name="u_ang" label="Gauge angle from ε1" unit="°" /><Num name="u_gf" label="Gauge factor tolerance ±" unit="%" /></FieldRow>
            <FieldRow><Num name="u_kt" label="Transverse sensitivity" unit="%" /><Num name="u_nu0" label="Its calibration ν0" /></FieldRow>
            <FieldRow><Num name="u_mis" label="Misalignment" unit="°" /><Num name="u_pos" label="Position error" unit="mm" /></FieldRow>
            <FieldRow><Num name="u_grad" label="Strain gradient there" unit="µε/mm" /><Num name="u_ins" label="Instrumentation ±" unit="µε" /></FieldRow>
          </Group>
        ) : v.tab === 'modes' ? (
          <Group legend="Modal survey against modal analysis" hint="Shapes: one row per measured point, one column per mode, at the same points and directions in both. The model's shapes are read at the accelerometer locations.">
            <FieldRow><TextField name="m_ft" label="Test frequencies (Hz)" /><TextField name="m_fm" label="Model frequencies (Hz)" /></FieldRow>
            <Lines name="m_st" label="Test shapes" rows={6} />
            <Lines name="m_sm" label="Model shapes" rows={6} />
            <FieldRow><Num name="m_df" label="Frequency criterion ±" unit="%" placeholder="your criterion" /><Num name="m_mac" label="MAC at least" placeholder="your criterion" /></FieldRow>
          </Group>
        ) : (
          <Group legend="One frequency, several suspects" hint="Sensitivity 0.5 for a modulus or a spring that carries the whole mode, −0.5 for a density; others from the model's own sensitivity analysis. Plausible ranges from what you actually know about each parameter.">
            <FieldRow><Num name="e_ft" label="Test frequency" unit="Hz" /><Num name="e_fm" label="Model frequency" unit="Hz" /></FieldRow>
            <Lines name="e_rows" label="Parameters: name, sensitivity ∂ln f/∂ln p, plausible ± (%)" rows={5} />
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'gauges' ? <Gauges /> : v.tab === 'uncert' ? <Uncert /> : v.tab === 'modes' ? <Modes /> : <Explain />}</Outputs>
    </>
  );
}

export default function Correlation() {
  return (
    <Calc
      id="test-correlation"
      title="Test correlation: model against test"
      defaults={{
        tab: 'gauges', s_rows: GAUGES, s_band: '',
        u_e1: '4950', u_e2: '1260', u_ang: '90', u_gf: '1', u_kt: '0.5', u_nu0: '0.285', u_mis: '2', u_pos: '1', u_grad: '0', u_ins: '5',
        m_ft: '138, 905, 2590', m_fm: '150, 940, 2632', m_st: TEST_MODES, m_sm: MODEL_MODES, m_df: '', m_mac: '',
        e_ft: '138', e_fm: '150', e_rows: PARAMS,
      }}
      example={{ values: { s_band: '5', m_df: '5', m_mac: '0.9' }, note: 'Worked-example criteria loaded: ±5% on gauges, ±5% on frequencies, MAC at least 0.9', factorFields: ['s_band', 'm_df', 'm_mac'] }}
      foot="Ratios and least-squares statistics on paired readings. Gauge errors after Vishay TN-509 and TN-511, combined by root sum of squares. MAC after Allemang and Brown, not mass-weighted, so not a cross-orthogonality check. Single-parameter sensitivities only."
    >
      <Body />
    </Calc>
  );
}
