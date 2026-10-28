// Tolerance stacks in two tabs: a linear stack (worst case, RSS, Cpk-based and Monte Carlo) and a radial stack of
// offsets that add as vectors. Process capability, limits and coverage are the programme's and start blank. Maths in
// src/lib/stack.ts (unit-tested).
import React, { useMemo } from 'react';
import { linearStack, capability, monteCarlo, radialStack, parseContributors, parseOffsets } from '../lib/stack';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Lines, ModeTabs, Hint, Readouts, Readout, Notes, Plot, Figure, useForm, useSlowValues, num, fmt, HALO, type Tone } from './kit';

const f = (v: number, d = 3) => fmt(v, d);
const pct = (v: number) => (v <= 0 ? '0%' : v < 1e-7 ? 'under 0.1 ppm' : v < 1e-4 ? `${f(1e6 * v, v < 1e-5 ? 1 : 0)} ppm` : v < 0.01 ? `${f(100 * v, 2)}%` : `${f(100 * v, 1)}%`);
const N = 100000;
const SEAL = `O-ring section, 1, 5.20, 5.46
Case bore ⌀ (H8), -1, 150.000, 150.063
Plug pilot ⌀, 0.5, 149.860, 149.900
Groove root ⌀, 0.5, 141.45, 141.55
Root runout ÷ 2, -1, -0.025, 0.025`;
const NOZZLE = `Case flange bore to case axis, 0.05, zone
Case flange face squareness, 0.05/300, zone
Closure pilot clearance, 0.125, shift
Nozzle bore position in closure, 0.05, zone
Nozzle seat squareness, 0.03/180, zone
Nozzle pilot clearance, 0.1015, shift
Throat to nozzle pilot, 0.05, zone`;
const criterion = (name: string, what: string) => `Enter your programme's ${name} to ${what}. It comes from your governing requirement, not from this site. Or press “Load worked example”.`;
type Note = { tone: Tone; text: string };

/** The three largest shares, largest first, and the rest summed. */
function Shares({ s }: { s: [string, number][] }) {
  const rest = s.slice(3);
  return (
    <>
      {s.slice(0, 3).map(([n, x], i) => (
        <React.Fragment key={n}>
          {i ? ' · ' : ''}
          {i === 0 ? <b>{`${n} ${f(100 * x, 0)}%`}</b> : `${n} ${f(100 * x, 0)}%`}
        </React.Fragment>
      ))}
      {rest.length ? ` · ${rest.length} more, ${f(100 * rest.reduce((a, [, x]) => a + x, 0), 0)}% together` : ''}
    </>
  );
}

function Linear() {
  const v = useSlowValues();
  const notes: Note[] = [];
  const p = useMemo(() => parseContributors(v.l_rows), [v.l_rows]);
  if (p.bad.length) notes.push({ tone: 'bad', text: `Not read: ${p.bad.map((b) => `“${b}”`).join(', ')}. Use “name, sensitivity, low, high”, with “, u” for a uniform part.` });
  const cpkIn = num(v.l_cpk), hasCpk = cpkIn > 0, cpk = hasCpk ? cpkIn : 1;
  const mc = useMemo(() => (p.rows.length ? monteCarlo(p.rows, { n: N, seed: 1, cpk }) : null), [p, cpk]);
  if (!p.rows.length || !mc) return <Notes items={[...notes, { tone: 'bad', text: 'Enter at least one contributor as “name, sensitivity, low, high”.' }]} />;
  const lsl = Number.isFinite(num(v.l_lsl)) ? num(v.l_lsl) : undefined, usl = Number.isFinite(num(v.l_usl)) ? num(v.l_usl) : undefined;
  const hasLim = lsl !== undefined || usl !== undefined;
  const st = linearStack(p.rows, cpk), textbook = linearStack(p.rows.map((c) => ({ ...c, dist: 'normal' as const })), 1);
  const inside = (a: number, b: number) => (lsl === undefined || a >= lsl - 1e-12) && (usl === undefined || b <= usl + 1e-12);
  const verdict = (a: number, b: number): Tone | undefined => (hasLim ? (inside(a, b) ? 'ok' : 'bad') : undefined);
  const uniform = p.rows.some((c) => c.dist === 'uniform');
  const out = (lsl === undefined ? 0 : mc.below(lsl)) + (usl === undefined ? 0 : mc.above(usl));
  const order = [...st.rows].sort((a, b) => b.varShare - a.varShare);
  const cap = capability(st.nominal, st.sigma, lsl, usl);

  if (order[0].varShare > 0.5) notes.push({ tone: 'warn', text: `${order[0].name} is ${f(100 * order[0].varShare, 0)}% of the variance (${f(100 * order[0].wcShare, 0)}% of the worst case). Tightening anything else barely moves the result.` });
  if (hasLim && inside(st.wcMin, st.wcMax)) notes.push({ tone: 'ok', text: 'The worst case meets the limit: every assembly of in-tolerance parts does, whatever the distributions. No statistics needed.' });
  else if (hasLim && inside(st.nominal - textbook.rss, st.nominal + textbook.rss)) notes.push({ tone: 'warn', text: 'The worst case fails and the statistics pass. Accepting that is a decision, not a calculation: it needs process data showing the parts are centred, independent and as capable as assumed (and a failure that is tolerable at the predicted rate, or that inspection will catch).' });
  else if (hasLim) notes.push({ tone: 'bad', text: 'Even the statistical stack misses the limit: change the design or the tolerances that dominate.' });
  if (uniform) notes.push({ tone: 'info', text: 'Uniform parts (tool wear, an uncontrolled feature, a lot whose mean can sit anywhere) have a σ 1.7 times the normal one, and widen the statistical result.' });
  notes.push({ tone: 'info', text: 'RSS and Monte Carlo assume independent parts. Features made in the same setup, from the same tool or batch, are correlated: add them worst case.' });

  let x0 = Math.min(st.wcMin, mc.min), x1 = Math.max(st.wcMax, mc.max);
  if (lsl !== undefined) x0 = Math.min(x0, lsl);
  if (usl !== undefined) x1 = Math.max(x1, usl);
  const pad = 0.06 * (x1 - x0 || 1); x0 -= pad; x1 += pad;
  const nb = 44, bw = (x1 - x0) / nb, bins = new Array(nb).fill(0);
  for (const x of mc.sorted) bins[Math.min(nb - 1, Math.max(0, Math.floor((x - x0) / bw)))]++;
  const top = (100 * Math.max(...bins)) / N;
  return (
    <>
      <Readouts>
        <Readout label="Nominal" value={f(st.nominal)} primary sub="every part at the middle of its limits" />
        <Readout label="Worst case" value={`${f(st.wcMin)} to ${f(st.wcMax)}`} tone={verdict(st.wcMin, st.wcMax)} sub={`± ${f(st.wc)}: every part at its worst limit at once`} />
        <Readout label="RSS" value={`${f(st.nominal - textbook.rss)} to ${f(st.nominal + textbook.rss)}`} tone={verdict(st.nominal - textbook.rss, st.nominal + textbook.rss)}
          sub={`± ${f(textbook.rss)} = √Σ(s·t)²: every part normal, centred, its tolerance ±3σ`} />
        {hasCpk || uniform ? (
          <Readout label={hasCpk ? `Parts at Cpk ${f(cpk, 2)}` : 'With the uniform parts'} value={`${f(st.rssMin)} to ${f(st.rssMax)}`} tone={verdict(st.rssMin, st.rssMax)}
            sub={`±3σ, σ = ${f(st.sigma, 4)}${hasLim ? ` · assembly Cpk ${f(cap.cpk, 2)}, ${pct(cap.below + cap.above)} predicted outside` : ''}`} />
        ) : (
          <Readout label="Cpk-based" value="needs your process data" sub="Enter the parts’ process Cpk (from your suppliers’ measured process data, not from this site) to base the statistics on it. Or press “Load worked example”." />
        )}
        <Readout label="Monte Carlo" value={`${f(mc.quantile(0.00135))} to ${f(mc.quantile(0.99865))}`} tone={hasLim ? (out > 0 ? 'warn' : 'ok') : undefined}
          sub={`middle 99.73% of ${N.toLocaleString('en-GB')} assemblies${hasCpk ? '' : ', normal parts at Cpk 1'}${hasLim ? (out > 0 ? ` · ${pct(out)} outside the limits (${Math.round(out * N).toLocaleString('en-GB')})` : ' · none outside the limits') : ''}`} />
        {!hasLim ? <Readout label="Requirement" value="needs your limit" sub={criterion('limit on the result', 'check each method against it')} /> : null}
        <Readout label="Largest shares of the variance" value={order[0].name} sub={<Shares s={order.map((r): [string, number] => [r.name, r.varShare])} />} />
      </Readouts>
      <Plot
        x0={x0} x1={x1} y0={0} y1={top * 1.18} xl="stack result" yl="assemblies per bin (%)"
        legend={[['worst case', 'var(--rd-muted)', '5 4'], ['RSS', 'var(--rd-blue)'], ...(hasLim ? [['limit', 'var(--rd-accent)'] as [string, string]] : [])]}
        label="Monte Carlo histogram of the stack result"
        caption="The Monte Carlo result as a histogram, with the worst-case and RSS bands and the limits once entered. The worst case sits far out in the tails, where almost no assembly goes."
      >
        {(c) => {
          const vline = (x: number, color: string, dash?: string) => <line key={`${color}${x}`} x1={c.X(x)} x2={c.X(x)} y1={c.T} y2={c.H - c.B} stroke={color} strokeWidth={2} strokeDasharray={dash} />;
          return (
            <>
              {bins.map((b, i) => (b ? <rect key={i} x={c.X(x0 + i * bw) + 0.5} y={c.Y((100 * b) / N)} width={Math.max(1, c.X(x0 + bw) - c.X(x0) - 1)} height={c.Y(0) - c.Y((100 * b) / N)} fill="var(--rd-steel)" fillOpacity={0.55} /> : null))}
              {vline(st.wcMin, 'var(--rd-muted)', '5 4')}{vline(st.wcMax, 'var(--rd-muted)', '5 4')}
              {vline(st.nominal - textbook.rss, 'var(--rd-blue)')}{vline(st.nominal + textbook.rss, 'var(--rd-blue)')}
              {lsl !== undefined ? vline(lsl, 'var(--rd-accent)') : null}{usl !== undefined ? vline(usl, 'var(--rd-accent)') : null}
            </>
          );
        }}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Radial() {
  const v = useSlowValues();
  const notes: Note[] = [];
  const lever = num(v.r_lever), F = num(v.r_force), pIn = num(v.r_p), lim = num(v.r_lim);
  const p = useMemo(() => parseOffsets(v.r_rows, lever), [v.r_rows, lever]);
  const s = useMemo(() => (p.rows.length ? radialStack(p.rows, { n: N, seed: 1 }) : null), [p]);
  if (p.bad.length) notes.push({ tone: 'bad', text: `Not read: ${p.bad.map((b) => `“${b}”`).join(', ')}. Use “name, offset, zone|shift|fixed”; a tilt “t/l” needs the lever arm.` });
  if (!p.rows.length || !s) return <Notes items={[...notes, { tone: 'bad', text: 'Enter at least one offset as “name, offset, kind”.' }]} />;
  const q = s.mc.quantile;
  const hasP = pIn > 0 && pIn < 100, hasL = lim > 0, qp = hasP ? q(pIn / 100) : NaN;
  const extra = (d: number) => [F > 0 ? `${f(F * d, 1)} N·m at ${f(F, 1)} kN` : '', lever > 0 ? `${f((Math.atan(d / lever) * 180) / Math.PI, 3)}° over ${f(lever, 0)} mm` : ''].filter(Boolean).join(' · ');
  const vs = (d: number): Tone | undefined => (hasL ? (d <= lim ? 'ok' : 'bad') : undefined);
  const order = [...s.shares].sort((a, b) => b.wcShare - a.wcShare);
  notes.push({ tone: 'warn', text: `Offsets in random directions add as vectors. The RSS of the radii, ${f(s.rssRadii)} mm, treats each like a ±3σ dimension; a clearance taken up fully is nothing like that, and ${pct(s.mc.above(s.rssRadii))} of assemblies exceed it. Use the Monte Carlo.` });
  if (p.rows.some((o) => o.kind === 'fixed')) notes.push({ tone: 'info', text: 'Fixed offsets all point the same way (to the right in the chart) and add arithmetically, like a worst case, before the random ones spread around them.' });
  if (hasL && s.wc > lim && hasP && qp <= lim) notes.push({ tone: 'warn', text: 'The worst case exceeds the limit but the required coverage meets it. That is acceptable only where the programme accepts a statistical requirement, and is best backed by measuring the alignment of every motor.' });
  if (p.rows.some((o) => o.kind === 'shift')) notes.push({ tone: 'info', text: 'A clearance shift is frozen when the bolts are tightened. Assembling in a fixture that centres the part removes it; assembling horizontally turns it into a fixed offset downwards.' });

  const W = 420, H = 250, T = 30, B = 26;
  const side = H - T - B, cx = W / 2, cy = T + side / 2, rmax = Math.max(s.wc, hasL ? lim : 0) * 1.05 || 1, k = side / 2 / rmax;
  const { xs, ys } = s.points;
  const ring = (r: number, color: string, dash?: string) => <circle key={color} cx={cx} cy={cy} r={k * r} fill="none" stroke={color} strokeWidth={2} strokeDasharray={dash} />;
  const legend: [string, string, string?][] = [['worst', 'var(--rd-muted)', '5 4'], ['RSS radii', 'var(--rd-blue)', '2 3'], ...(hasP ? [['coverage', 'var(--rd-ink)'] as [string, string]] : []), ...(hasL ? [['limit', 'var(--rd-accent)'] as [string, string]] : [])];
  let lx = 8;
  return (
    <>
      <Readouts>
        <Readout label="Worst case" value={f(s.wc)} unit="mm" tone={vs(s.wc)} sub={`every offset in line · ${extra(s.wc)}`} />
        <Readout label="RSS of the radii" value={f(s.rssRadii)} unit="mm" tone="warn" sub={`exceeded by ${pct(s.mc.above(s.rssRadii))} of assemblies, not a bound for vectors`} />
        <Readout label="Monte Carlo median" value={f(q(0.5))} unit="mm" sub={`half of ${N.toLocaleString('en-GB')} assemblies are better · largest seen ${f(s.mc.max)} mm`} />
        {hasP
          ? <Readout label={`Covering ${f(pIn, pIn % 1 ? 2 : 0)}%`} value={f(qp)} unit="mm" primary tone={vs(qp)} sub={extra(qp)} />
          : <Readout label="Coverage" value="needs your requirement" sub={criterion('fraction of assemblies to cover', 'read the offset they stay within')} />}
        {hasL
          ? <Readout label={`Over ${f(lim)} mm`} value={`${pct(s.mc.above(lim))} of assemblies`} tone={s.mc.above(lim) > 0 ? 'warn' : 'ok'} sub={`${Math.round(s.mc.above(lim) * N).toLocaleString('en-GB')} of ${N.toLocaleString('en-GB')}`} />
          : <Readout label="Requirement" value="needs your limit" sub={criterion('limit on the offset', 'check the stack against it')} />}
        <Readout label="Largest shares of the worst case" value={order[0].name} sub={<Shares s={order.map((r): [string, number] => [r.name, r.wcShare])} />} />
      </Readouts>
      <Figure label="Where the axis lands in simulated assemblies"
        caption="Where the axis lands in simulated assemblies, with the worst case, the RSS of the radii and (once entered) the coverage and the limit.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <path d={`M${cx - side / 2},${cy} L${cx + side / 2},${cy} M${cx},${T} L${cx},${T + side}`} stroke="var(--rd-line)" />
          {Array.from(xs, (x, i) => <circle key={i} cx={cx + k * x} cy={cy + k * ys[i]} r={1.3} fill="var(--rd-steel)" fillOpacity={0.6} />)}
          {ring(s.wc, 'var(--rd-muted)', '5 4')}{ring(s.rssRadii, 'var(--rd-blue)', '2 3')}
          {hasP ? ring(qp, 'var(--rd-ink)') : null}{hasL ? ring(lim, 'var(--rd-accent)') : null}
          <text x={cx + k * s.wc * 0.7071 + 4} y={cy - k * s.wc * 0.7071 - 2} fontSize={12} fill="var(--rd-muted)" {...HALO}>{f(s.wc, 2)}</text>
          {legend.map(([name, color, dash]) => {
            const x = lx; lx += 37 + name.length * 7.2;
            return (
              <g key={name}>
                <line x1={x} x2={x + 18} y1={13} y2={13} stroke={color} strokeWidth={2.2} strokeDasharray={dash} />
                <text x={x + 23} y={17} fontSize={12} fill="var(--rd-ink)">{name}</text>
              </g>
            );
          })}
          <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{`${xs.length.toLocaleString('en-GB')} of the simulated assemblies, offsets in mm`}</text>
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
        <ModeTabs name="tab" options={[{ value: 'lin', label: 'Linear stack' }, { value: 'rad', label: 'Radial stack' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'lin' ? (
          <Group legend="Contributors: name, sensitivity, low, high">
            <Lines name="l_rows" label="One line per arrow in the loop" rows={6} />
            <Hint>Use the limits from the drawing. Sensitivity +1 or −1 for a length in the loop, ±½ for a diameter whose radius is in it. Add “, u” for a part that is uniform across its tolerance rather than normal.</Hint>
            <Num name="l_cpk" label="Process Cpk of the parts" placeholder="your process data" />
            <FieldRow>
              <Num name="l_lsl" label="Lower limit on the result" placeholder="your requirement" />
              <Num name="l_usl" label="Upper limit on the result" placeholder="your requirement" />
            </FieldRow>
          </Group>
        ) : (
          <Group legend="Offsets: name, largest offset, kind">
            <Lines name="r_rows" label="One line per offset" rows={8} />
            <Hint>
              Offsets at the plane that matters: here the thrust line at the centre of gravity. Kind: <b>zone</b>, anywhere in a position or coaxiality
              zone of that radius; <b>shift</b>, a clearance fully taken up in a random direction; <b>fixed</b>, a clearance taken up the same way every
              time. Write a tilt as “t/l”, a tolerance over the length it acts on; it is carried to the lever arm.
            </Hint>
            <FieldRow>
              <Num name="r_lever" label="Lever arm for tilts" unit="mm" />
              <Num name="r_force" label="Thrust" unit="kN" />
            </FieldRow>
            <FieldRow>
              <Num name="r_p" label="Assemblies to cover" unit="%" placeholder="your requirement" />
              <Num name="r_lim" label="Limit on the offset" unit="mm" placeholder="your requirement" />
            </FieldRow>
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'lin' ? <Linear /> : <Radial />}</Outputs>
    </>
  );
}

export default function Stack() {
  return (
    <Calc
      id="tolerance-stack"
      title="Tolerance stack: worst case, RSS, Monte Carlo"
      defaults={{ tab: 'lin', l_rows: SEAL, l_cpk: '', l_lsl: '', l_usl: '', r_rows: NOZZLE, r_lever: '700', r_force: '29.5', r_p: '', r_lim: '' }}
      example={{
        values: { l_cpk: '1.33', l_lsl: '0.74', r_p: '99.73', r_lim: '0.45' },
        note: 'Worked-example values loaded: parts at Cpk 1.33, squeeze at least 0.74 mm, 99.73% of motors within 0.45 mm',
        factorFields: ['l_cpk', 'l_lsl', 'r_p', 'r_lim'],
      }}
      foot="Linear stacks: worst case by adding half tolerances; RSS with each normal part centred and its tolerance at ±3·Cpk σ, uniform parts at the half tolerance over √3; Monte Carlo of 100,000 assemblies with a fixed seed. Radial stacks: vector sums, Monte Carlo of 100,000. Independent contributors throughout."
    >
      <Body />
    </Calc>
  );
}
