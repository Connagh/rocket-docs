// Gauging in three tabs: an uncertainty budget with the decision rule and the false accept and false reject risk for a
// process; a gauge R&R study by the average and range method; and limit gauge sizes. The required TUR and the %GRR
// limit are the user's programme criteria and start blank. Maths in src/lib/gauging.ts (unit-tested).
import React from 'react';
import { View } from 'react-native';
import { CONTRIBUTIONS, makeStudy, budget, tur, acceptanceLimits, decisionRisk, gaugeRR, grrBand, parseStudy, limitGauges, functionalPin, type Contribution, type Rule } from '../lib/gauging';
import { readFactor } from '../lib/factors';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Choice, TextField, Lines, ModeTabs, Hint, Readouts, Readout, Notes, Figure, useForm, num, fmt, type Tone, type Values } from './kit';

const f = (v: number, d = 2) => (Number.isFinite(v) ? fmt(v, d) : '–');
const g3 = (v: number) => (Math.abs(v) >= 100 ? f(v, 0) : Math.abs(v) >= 10 ? f(v, 1) : f(v, 2));
const ppm = (p: number) => (p * 1e6 >= 1000 ? `${f(p * 100, 2)}%` : `${f(p * 1e6, p * 1e6 < 10 ? 1 : 0)} ppm`);
const mm = (v: number) => f(v, 4);
type Note = { tone: Tone; text: string };
// the worked example: the ⌀150 H8 seal bore measured with a two-point bore gauge set on a ring
const BUDGET = [
  { name: 'Setting ring (certificate)', value: '1.5', kind: 'k2' },
  { name: 'Repeatability', value: '1.2', kind: 'std' },
  { name: 'Display resolution', value: '1', kind: 'res' },
  { name: 'Temperature, part to ring', value: '3.69', kind: 'rect' },
  { name: 'Alignment and centring', value: '1', kind: 'rect' },
  { name: '', value: '', kind: 'std' },
];
const STUDY = makeStudy({ parts: 10, trials: 3, partSd: 12, repSd: 1.2, bias: [0, 1.5, -1], centre: 32, seed: 1 })
  .map((o, i) => o.map((t) => `${'ABC'[i]}: ${t.join(' ')}`).join('\n')).join('\n');
const T = ({ x, y, s, c = 'var(--rd-ink)', a = 'middle', fs = 12 }: { x: number; y: number; s: string; c?: string; a?: 'start' | 'middle' | 'end'; fs?: number }) => (
  <text x={x} y={y} textAnchor={a} fontSize={fs} fill={c}>{s}</text>
);

function Uncertainty() {
  const { v } = useForm();
  const lsl = num(v.u_lsl), usl = num(v.u_usl), k = num(v.u_k) || 2, rule = v.u_rule as Rule, mean = num(v.u_mean), sd = Math.max(0, num(v.u_sd) || 0);
  const req = readFactor(v.u_req, 1);
  const list = BUDGET.map((_, i) => ({ name: v[`b_n${i}`].trim() || `item ${i + 1}`, value: num(v[`b_v${i}`]), kind: v[`b_k${i}`] as Contribution }));
  if (!(usl > lsl)) return <Notes items={[{ tone: 'bad', text: 'Enter an upper limit above the lower limit.' }]} />;
  const b = budget(list, k);
  if (!(b.uc > 0)) return <Notes items={[{ tone: 'bad', text: 'Enter at least one contribution.' }]} />;
  const t = tur(lsl, usl, b.U), a = acceptanceLimits(lsl, usl, b.U, rule);
  const big = b.parts.slice().sort((x, y) => y.share - x.share)[0];
  let r: ReturnType<typeof decisionRisk> | null = null, ro: ReturnType<typeof decisionRisk> | null = null;
  if (a.ok && Number.isFinite(mean)) {
    r = decisionRisk({ lsl, usl, lo: a.lo, hi: a.hi, mean, sd, uc: b.uc });
    const other = acceptanceLimits(lsl, usl, b.U, rule === 'guard' ? 'simple' : 'guard');
    ro = other.ok ? decisionRisk({ lsl, usl, lo: other.lo, hi: other.hi, mean, sd, uc: b.uc }) : null;
  }
  const otherName = rule === 'guard' ? 'simple' : 'guarded';
  const notes: Note[] = [];
  if (big.share > 0.5) notes.push({ tone: 'warn', text: `One contribution (${big.name}) is ${f(100 * big.share, 0)}% of the variance. Improve that one first: a smaller change to the others has almost no effect.` });
  if (t < 4) notes.push({ tone: 'warn', text: `A TUR of ${f(t, 1)} is low. Guard bands then take a large part of the tolerance, or the risk at the limits is high. Use a better instrument, control the temperature, or measure the part in a different way.` });
  notes.push({ tone: 'info', text: 'ISO 14253-1: the supplier proves conformance with the limits moved in by U, and the customer proves non-conformance with the limits moved out by U. Write the decision rule in the contract or on the drawing (ISO/TR 14253-6, ASME B89.7.3.1).' });

  const W = 420, H = 250, L = 16, R = 16, Tp = 50, B = 40;
  const span = usl - lsl, x0 = Math.min(lsl - 0.25 * span, Number.isFinite(mean) ? mean - 4 * sd : lsl), x1 = Math.max(usl + 0.25 * span, Number.isFinite(mean) ? mean + 4 * sd : usl);
  const X = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  let curve: React.ReactNode = null;
  if (sd > 0 && Number.isFinite(mean)) {
    const ys = Array.from({ length: 201 }, (_, i) => x0 + ((x1 - x0) * i) / 200), pk = 1 / (sd * Math.sqrt(2 * Math.PI)), Y = (p: number) => H - B - (p / pk) * (H - B - Tp - 8);
    const p = (x: number) => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
    curve = <path d={`M${X(x0)},${H - B} ${ys.map((x) => `L${X(x).toFixed(1)},${Y(p(x)).toFixed(1)}`).join(' ')} L${X(x1)},${H - B} Z`} fill="var(--rd-blue)" fillOpacity={0.18} stroke="var(--rd-blue)" strokeWidth={1.5} />;
  }
  return (
    <>
      <Readouts>
        <Readout label="Expanded uncertainty U" value={`±${g3(b.U)}`} unit="µm" primary sub={`uc ${g3(b.uc)} µm × k ${f(k, 1)} · largest: ${big.name}, ${f(100 * big.share, 0)}% of the variance`} />
        <Readout label="TUR" value={f(t, 1)} tone={req ? (t >= req ? 'ok' : 'bad') : undefined} sub={`tolerance ÷ 2U${req ? ` · required ${f(req, 1)}` : ''}`} />
        {a.ok
          ? <Readout label="Acceptance limits" value={`${g3(a.lo)} to ${g3(a.hi)}`} unit="µm" sub={rule === 'guard' ? `${f((100 * (a.hi - a.lo)) / (usl - lsl), 0)}% of the tolerance is left to manufacture` : 'the tolerance limits: the customer carries the risk at the limits'} />
          : <Readout label="Acceptance limits" value="none" tone="bad" sub="the guard bands are wider than the tolerance" />}
        {!req ? <Readout label="TUR check" value="needs your requirement" sub="Enter the TUR that your programme or quality system requires, or push “Load worked example”." /> : null}
        {r ? (
          <>
            <Readout label="False accept" value={ppm(r.pfa)} tone={r.pfa > 1e-3 ? 'warn' : 'ok'} sub={`bad parts that pass · ${ppm(r.pOut)} of the parts are out of tolerance${ro ? ` · ${otherName}: ${ppm(ro.pfa)}` : ''}`} />
            <Readout label="False reject" value={ppm(r.pfr)} tone={r.pfr > 0.02 ? 'warn' : undefined} sub={`good parts that fail${ro ? ` · ${otherName}: ${ppm(ro.pfr)}` : ''}`} />
            {sd > 0 ? <Readout label="Process capability" value={`Cp ${f((usl - lsl) / (6 * sd), 2)}`} sub={`Cpk ${f(Math.min(usl - mean, mean - lsl) / (3 * sd), 2)}`} /> : null}
          </>
        ) : null}
      </Readouts>
      <Figure label="Process, tolerance and uncertainty bands"
        caption="The process (blue) against the tolerance, the uncertainty band ±U at each limit (amber) and, for the guarded rule, the acceptance limits (dashed).">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {curve}
          <rect x={X(lsl)} y={H - B + 4} width={X(usl) - X(lsl)} height={8} fill="var(--rd-ok)" fillOpacity={0.5} />
          {[lsl, usl].map((x) => (
            <g key={x}>
              <rect x={X(x - b.U)} y={Tp} width={X(x + b.U) - X(x - b.U)} height={H - B - Tp} fill="var(--rd-warn)" fillOpacity={0.14} />
              <line x1={X(x)} x2={X(x)} y1={Tp - 8} y2={H - B + 12} stroke="var(--rd-ink)" strokeWidth={2} />
            </g>
          ))}
          {a.ok && rule === 'guard' ? [a.lo, a.hi].map((x) => <line key={x} x1={X(x)} x2={X(x)} y1={Tp} y2={H - B} stroke="var(--rd-accent)" strokeWidth={2} strokeDasharray="5 3" />) : null}
          <T x={X(lsl)} y={Tp - 14} s="LSL" /><T x={X(usl)} y={Tp - 14} s="USL" />
          <T x={W / 2} y={14} s={rule === 'guard' ? 'dashed: acceptance limits · amber: ±U' : 'amber: ±U at each limit'} c="var(--rd-muted)" fs={11} />
          <T x={X(lsl)} y={H - B + 26} s={g3(lsl)} c="var(--rd-muted)" fs={11} /><T x={X(usl)} y={H - B + 26} s={g3(usl)} c="var(--rd-muted)" fs={11} />
          <T x={W / 2} y={H - 2} s="size (µm from nominal) · blue: the process" fs={11} />
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Grr() {
  const { v } = useForm();
  const s = parseStudy(v.r_data), tol = num(v.r_tol), lim = readFactor(v.r_lim, 0.01);
  const r = s.data.length ? gaugeRR(s.data, tol) : null;
  if (!r) return <Notes items={[{ tone: 'bad', text: 'The study needs two or three operators, each with two or three lines (trials) of the same number of readings (two to ten parts).' }]} />;
  const pt = Number.isFinite(r.pctTol);
  const notes: Note[] = [];
  if (r.AV > r.EV) notes.push({ tone: 'warn', text: 'Reproducibility is larger than repeatability: the operators do not measure in the same way. Look at the method, the training and the fixture before you buy a better gauge.' });
  else notes.push({ tone: 'info', text: 'Repeatability is the larger part: the gauge, the fixture or the part itself (form error, roughness, temperature) causes the scatter.' });
  if (r.ndc < 5) notes.push({ tone: 'warn', text: 'Fewer than 5 distinct categories: the gauge cannot separate the parts well enough for SPC. The parts in the study may also cover too small a range.' });
  notes.push({ tone: 'info', text: 'GRR of tolerance tells if the gauge can accept parts. GRR of total variation tells if it can control the process. AIAG guidance: under 10% is acceptable, 10 to 30% can be acceptable for the application, over 30% is not acceptable.' });
  const W = 420, H = 250, L = 96, R = 18, Tp = 26, B = 34;
  const items: [string, number][] = [['repeatability', r.pctEV], ['reproducibility', r.pctAV], ['GRR', r.pctGRR], ['part', r.pctPV]];
  const X = (x: number) => L + (Math.min(x, 100) / 100) * (W - L - R), row = (H - Tp - B) / items.length;
  return (
    <>
      <Readouts>
        <Readout label="%GRR of tolerance" value={pt ? `${f(r.pctTol, 1)}%` : 'enter the tolerance'} primary tone={lim && pt ? (r.pctTol <= lim ? 'ok' : 'bad') : undefined}
          sub={pt ? `6 × GRR ÷ tolerance · AIAG guidance: ${grrBand(r.pctTol)}${lim ? ` · your limit ${f(lim, 0)}%` : ''}` : undefined} />
        <Readout label="%GRR of total variation" value={`${f(r.pctGRR, 1)}%`} sub={`AIAG guidance: ${grrBand(r.pctGRR)} · for process control`} />
        <Readout label="Repeatability EV" value={g3(r.EV)} unit="µm" sub={`the gauge: same operator, same part · ${f(r.pctEV, 1)}% of TV`} />
        <Readout label="Reproducibility AV" value={g3(r.AV)} unit="µm" sub={`between operators · ${f(r.pctAV, 1)}% of TV · operator means ${r.opMeans.map((m) => g3(m)).join(', ')}`} />
        <Readout label="Part variation PV" value={g3(r.PV)} unit="µm" sub={`${r.parts} parts · ${r.ops} operators × ${r.trials} trials`} />
        <Readout label="Distinct categories" value={String(r.ndc)} tone={r.ndc >= 5 ? 'ok' : 'warn'} sub="1.41 PV ÷ GRR: at least 5 for process control" />
        {!lim ? <Readout label="Your limit" value="needs your limit" sub="Enter the %GRR limit of your programme or customer, or push “Load worked example”." /> : null}
      </Readouts>
      <Figure label="Sources of variation" caption="Each source as a share of the total variation. The dashed lines are the 10% and 30% guidance values of AIAG.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {[0, 10, 30, 50, 100].map((x) => (
            <g key={x}>
              <line x1={X(x)} x2={X(x)} y1={Tp} y2={H - B} stroke={x === 10 || x === 30 ? 'var(--rd-warn)' : 'var(--rd-line)'} strokeDasharray={x === 10 || x === 30 ? '4 3' : undefined} />
              <T x={X(x)} y={H - B + 14} s={`${x}%`} c="var(--rd-muted)" fs={11} />
            </g>
          ))}
          {items.map(([n, x], i) => {
            const y = Tp + i * row + row * 0.2;
            return (
              <g key={n}>
                <rect x={L} y={y} width={Math.max(1, X(x) - L)} height={row * 0.6} rx={2} fill={n === 'part' ? 'var(--rd-blue)' : n === 'GRR' ? 'var(--rd-accent)' : 'var(--rd-steel)'} fillOpacity={0.8} />
                <T x={L - 6} y={y + row * 0.3 + 4} s={n} a="end" />
              </g>
            );
          })}
          <T x={(L + W - R) / 2} y={H - 4} s="share of total variation (σ ÷ TV)" fs={11} />
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Limits() {
  const { v } = useForm();
  const feature = v.g_feat as 'hole' | 'shaft', lsl = num(v.g_lsl), usl = num(v.g_usl), gt = num(v.g_t), gw = num(v.g_w), pos = num(v.g_pos);
  if (!(usl > lsl) || !(gt >= 0) || !(gw >= 0)) return <Notes items={[{ tone: 'bad', text: 'Enter the two size limits and the two percentages.' }]} />;
  const g = limitGauges({ feature, lsl, usl, gaugePct: gt, wearPct: gw });
  const hole = feature === 'hole', kind = hole ? 'plug' : 'ring';
  const notes: Note[] = [];
  const pin = hole && pos > 0 ? functionalPin(lsl, pos, (gt / 100) * pos) : null;
  if (pin) notes.push({ tone: 'info', text: 'A functional gauge checks the position of the holes at MMC and their form together. It does not check the size: use the GO and NOGO plugs for that.' });
  if (g.usablePct < 60) notes.push({ tone: 'warn', text: 'The gauges use a large part of the tolerance. For a fine tolerance, measure with a variable gauge and an uncertainty budget instead.' });
  notes.push({ tone: 'info', text: `Taylor's principle: the GO ${kind} has the full form and length of the mating part. The NOGO gauge checks one size at a time, in more than one direction.` });
  const W = 420, H = 250, L = 70, R = 16, Tp = 30, B = 40;
  const pad = 0.12 * g.tol, x0 = lsl - pad, x1 = usl + pad, X = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const bar = (y: number, a: number, b: number, c: string, label: string, op = 0.8) => (
    <g key={label}>
      <rect x={X(a)} y={y} width={Math.max(2, X(b) - X(a))} height={26} rx={2} fill={c} fillOpacity={op} />
      <T x={L - 6} y={y + 17} s={label} a="end" />
    </g>
  );
  const [wa, wb] = hole ? [g.go.wornAt, g.go.lo] : [g.go.hi, g.go.wornAt]; // the wear allowance, from new to scrap
  return (
    <>
      <Readouts>
        <Readout label={`GO ${kind}, new`} value={`${mm(g.go.lo)} to ${mm(g.go.hi)}`} unit="mm" primary sub={`scrap at ${mm(g.go.wornAt)} mm (worn to the ${hole ? 'lower' : 'upper'} limit)`} />
        <Readout label={`NOGO ${kind}`} value={`${mm(g.nogo.lo)} to ${mm(g.nogo.hi)}`} unit="mm" sub="no wear allowance: a NOGO gauge seldom enters" />
        {g.sure.hi > g.sure.lo
          ? <Readout label="Always accepted" value={`${mm(g.sure.lo)} to ${mm(g.sure.hi)}`} unit="mm" tone={g.usablePct < 60 ? 'warn' : undefined} sub={`${f(g.usablePct, 0)}% of the work tolerance · a part outside this band can be rejected by a gauge that is still in tolerance`} />
          : <Readout label="Always accepted" value="none" tone="warn" sub="the gauge tolerances are larger than the work tolerance" />}
        <Readout label="Gauge tolerance" value={f(g.T * 1000, 1)} unit="µm" sub={`wear allowance ${f(g.W * 1000, 1)} µm · work tolerance ${f(g.tol * 1000, 1)} µm`} />
        {pin ? <Readout label="Functional gauge pin" value={`${mm(pin.lo)} to ${mm(pin.hi)}`} unit="mm" sub={`virtual condition ${mm(lsl)} − ${mm(pos)} at MMC, gauge tolerance on the product side`} /> : null}
      </Readouts>
      <Figure label="Work tolerance and gauge sizes" caption="The work tolerance, the GO gauge with its wear allowance, the NOGO gauge, and the band of sizes that every gauge in tolerance accepts.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {bar(Tp, lsl, usl, 'var(--rd-steel)', 'work', 0.45)}
          {bar(Tp + 44, g.go.lo, g.go.hi, 'var(--rd-blue)', 'GO')}
          {wb > wa ? <rect x={X(wa)} y={Tp + 44} width={X(wb) - X(wa)} height={26} fill="none" stroke="var(--rd-blue)" strokeDasharray="4 3" /> : null}
          {bar(Tp + 88, g.nogo.lo, g.nogo.hi, 'var(--rd-accent)', 'NOGO')}
          {g.sure.hi > g.sure.lo ? bar(Tp + 132, g.sure.lo, g.sure.hi, 'var(--rd-ok)', 'accepted', 0.6) : null}
          {[lsl, usl].map((x) => (
            <g key={x}>
              <line x1={X(x)} x2={X(x)} y1={Tp - 6} y2={H - B} stroke="var(--rd-ink)" strokeOpacity={0.6} />
              <T x={X(x)} y={H - B + 14} s={f(x, 3)} c="var(--rd-muted)" fs={11} />
            </g>
          ))}
          <T x={W / 2} y={16} s="dashed: GO wear allowance" c="var(--rd-muted)" fs={11} />
          <T x={(L + W - R) / 2} y={H - 4} s="size (mm)" fs={11} />
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function BudgetRows() {
  return (
    <View style={{ gap: 10 }}>
      {BUDGET.map((_, i) => (
        <View key={i} style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'var(--border)' as never }}>
          <TextField name={`b_n${i}`} label={`Contribution ${i + 1}`} placeholder="add a contribution" />
          <FieldRow>
            <Num name={`b_v${i}`} label="Value" unit="µm" />
            <Choice name={`b_k${i}`} label="Given as" options={CONTRIBUTIONS.map((c) => ({ value: c.key, label: c.name }))} />
          </FieldRow>
        </View>
      ))}
    </View>
  );
}

function Body() {
  const { v } = useForm();
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'unc', label: 'Uncertainty & decision' }, { value: 'grr', label: 'Gauge R&R' }, { value: 'gauge', label: 'Limit gauges' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'unc' ? (
          <Group legend="Tolerance and uncertainty budget">
            <FieldRow><Num name="u_lsl" label="Lower limit" unit="µm from nominal" /><Num name="u_usl" label="Upper limit" unit="µm from nominal" /></FieldRow>
            <BudgetRows />
            <Hint>Give each contribution in µm, in the form that you have: 1σ (a standard deviation), U at k = 2 (a calibration certificate), ± limit (rectangular: a temperature range or an instrument specification) or a display resolution. A temperature limit is L × α × ΔT.</Hint>
            <FieldRow>
              <Num name="u_k" label="Coverage factor k" />
              <Choice name="u_rule" label="Decision rule" options={[{ value: 'guard', label: 'Guarded (ISO 14253-1)' }, { value: 'simple', label: 'Simple' }]} />
            </FieldRow>
            <FieldRow><Num name="u_mean" label="Process mean" unit="µm" /><Num name="u_sd" label="Process standard deviation" unit="µm" /></FieldRow>
            <Num name="u_req" label="Required TUR" placeholder="your programme" />
          </Group>
        ) : v.tab === 'grr' ? (
          <Group legend="Study: operators × trials × parts" hint="One line for each operator and trial: the operator letter, then one reading for each part, in the same part order on each line. Two or three operators, two or three trials, two to ten parts. Select parts that cover the process range.">
            <Lines name="r_data" label="Readings (µm from nominal)" rows={9} />
            <FieldRow><Num name="r_tol" label="Tolerance width" unit="µm" /><Num name="r_lim" label="Your %GRR limit (of tolerance)" placeholder="your programme" /></FieldRow>
          </Group>
        ) : (
          <Group legend="Plain limit gauges" hint="Gauges inside the work tolerance: a gauge in tolerance never accepts a bad part. The percentages are a common simplification. ISO 1938-1 and ASME B89.1.5 give the gauge tolerances by size and class.">
            <Choice name="g_feat" label="Feature" options={[{ value: 'hole', label: 'Hole: plug gauges' }, { value: 'shaft', label: 'Shaft: ring or snap gauges' }]} />
            <FieldRow><Num name="g_lsl" label="Lower size limit" unit="mm" /><Num name="g_usl" label="Upper size limit" unit="mm" /></FieldRow>
            <FieldRow><Num name="g_t" label="Gauge-maker's tolerance" unit="% of work" /><Num name="g_w" label="GO wear allowance" unit="% of work" /></FieldRow>
            {v.g_feat === 'hole' ? <Num name="g_pos" label="Position tolerance at MMC" unit="mm" placeholder="optional" /> : null}
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'unc' ? <Uncertainty /> : v.tab === 'grr' ? <Grr /> : <Limits />}</Outputs>
    </>
  );
}

const DEFAULTS: Values = {
  tab: 'unc', u_lsl: '0', u_usl: '63', u_k: '2', u_rule: 'guard', u_mean: '31.5', u_sd: '9', u_req: '',
  ...Object.fromEntries(BUDGET.flatMap((b, i) => [[`b_n${i}`, b.name], [`b_v${i}`, b.value], [`b_k${i}`, b.kind]])),
  r_data: STUDY, r_tol: '63', r_lim: '',
  g_feat: 'hole', g_lsl: '150.000', g_usl: '150.063', g_t: '10', g_w: '5', g_pos: '',
};

export default function Gauge() {
  return (
    <Calc
      id="gauging"
      title="Gauging: uncertainty, R&R, limit gauges"
      defaults={DEFAULTS}
      example={{ values: { u_req: '4', r_lim: '20' }, note: 'Worked-example criteria loaded: TUR at least 4, %GRR at most 20% of the tolerance', factorFields: ['u_req', 'r_lim'] }}
      foot="Uncertainty: uncorrelated contributions combined by root sum of squares (GUM), U = k·uc. Decision rules after ISO 14253-1. Risk: normal process and normal measurement error. Gauge R&R: average and range method with the AIAG MSA constants, 6σ against the tolerance. Limit gauges: gauge tolerance and wear allowance inside the work tolerance."
    >
      <Body />
    </Calc>
  );
}
