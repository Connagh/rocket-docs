// Checking a finite-element model, in four tabs: mesh convergence (on a small built-in model of the case's clamped edge,
// or on your own three results), equilibrium and far-field checks, stress at details (singular corners, averaged and
// unaveraged peaks, weld hot spots), and strain-gauge rosettes for comparing with a test.
// Maths in src/lib/fea.ts (unit-tested).
import React from 'react';
import { edgeModel, edgeExact, richardson, williamsLambda, hotSpot, rosette } from '../lib/fea';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Choice, ModeTabs, Hint, Readouts, Readout, Notes, Figure, Plot, Poly, MaterialFill, A, Sub, Sup, HALO, useForm, num, fmt, type Tone, type Values } from './kit';
import type { MaterialFillData } from './materialOptions';

const f = (v: number, d = 2) => (Number.isFinite(v) ? fmt(v, d) : '—');
const g3 = (v: number) => (Math.abs(v) >= 100 ? f(v, 0) : Math.abs(v) >= 10 ? f(v, 1) : Math.abs(v) >= 1 ? f(v, 2) : f(v, 3));
const g4 = (v: number) => (Math.abs(v) >= 1000 ? f(v, 1) : Math.abs(v) >= 100 ? f(v, 2) : f(v, 3));
const pc = (v: number) => (Math.abs(v) < 5e-5 ? '0.00%' : `${v >= 0 ? '+' : '−'}${f(Math.abs(100 * v), Math.abs(v) < 0.1 ? 2 : 1)}%`);
type Note = { tone: Tone; text: React.ReactNode };
const Dot = ({ x, y, c, r = 4.5 }: { x: number; y: number; c: string; r?: number }) => <circle cx={x} cy={y} r={r} fill={c} stroke="var(--rd-panel)" strokeWidth={1.5} />;
const NMAX = 300;

function Conv() {
  const { v } = useForm();
  const model = v.v_mode === 'model';
  let f1: number, f2: number, f3: number, h1: number, h2: number, h3: number, exact = NaN, zone = NaN, solve: ((h: number) => number) | null = null, L = NaN;
  if (model) {
    const p = num(v.m_p), r = num(v.m_r), t = num(v.m_t), E = num(v.m_E), nu = num(v.m_nu), hc = num(v.m_h), rr = num(v.m_rr);
    if (!(p > 0 && r > 0 && t > 0 && E > 0 && nu >= 0 && nu < 0.5 && hc > 0 && rr >= 1.2)) return <Notes items={[{ tone: 'bad', text: 'Check the shell, the coarsest element size and a refinement ratio of at least 1.2.' }]} />;
    zone = Math.PI / ((3 * (1 - nu * nu)) ** 0.25 / Math.sqrt(r * t));
    L = hc * Math.max(4, Math.ceil((6 * zone) / hc)); // six edge zones, a whole number of coarse elements
    const ns = [hc, hc / rr, hc / (rr * rr)].map((h) => Math.max(1, Math.round(L / h)));
    if (ns[2] > NMAX) return <Notes items={[{ tone: 'bad', text: `The finest mesh would need ${ns[2]} elements; keep it under ${NMAX} here: use a coarser start or a smaller ratio.` }]} />;
    const LL = L;
    solve = (h: number) => edgeModel(p, r, t, E, nu, LL, Math.max(1, Math.round(LL / h))).sigmaEdge;
    [h3, h2, h1] = ns.map((n) => L / n);
    [f3, f2, f1] = [h3, h2, h1].map(solve);
    exact = edgeExact(p, r, t, E, nu);
  } else {
    [f1, f2, f3, h1, h2, h3] = [v.y_f1, v.y_f2, v.y_f3, v.y_h1, v.y_h2, v.y_h3].map(num);
    if (![f1, f2, f3].every(Number.isFinite) || !(h1 > 0 && h2 > h1 && h3 > h2)) return <Notes items={[{ tone: 'bad', text: 'Enter three results, with element sizes growing from the finest to the coarsest.' }]} />;
  }
  const R = richardson(f1, f2, f3, h1, h2, h3);
  const inRange = R.kind === 'monotonic' && Math.abs(R.asymptotic - 1) < 0.1;
  const kindText: Record<string, string> = {
    monotonic: inRange ? 'in the asymptotic range: the study can be used' : 'but not yet in the asymptotic range: refine further',
    oscillatory: 'refine further before trusting it',
    divergent: 'a singularity, or meshes too coarse to start converging',
    converged: 'identical results: already converged',
  };
  const notes: Note[] = [];
  if (R.kind === 'monotonic' && !inRange) notes.push({ tone: 'warn', text: 'The asymptotic-range check is well away from 1, so the observed order and the extrapolation are not yet reliable. Refine further.' });
  if (model) notes.push({ tone: 'warn', text: 'Converged is not the same as right: this peak is an artefact of clamping the end. A real flange grows and rotates with the case: model it, or its stiffness.' });
  if (R.kind === 'divergent') notes.push({ tone: 'bad', text: 'The result keeps changing faster as the mesh is refined. Either the coarse meshes are far too coarse, or the point is singular (a sharp corner, a point load or a point constraint) and has no converged value.' });
  notes.push({ tone: 'info', text: 'Converge the quantity you will report, at the point you will report it: a peak stress needs a much finer mesh than a displacement.' });

  const hs = [h1, h2, h3], fs = [f1, f2, f3];
  const ys = [...fs, ...(Number.isFinite(exact) ? [exact] : []), ...(R.kind === 'monotonic' ? [R.ext] : [])];
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = 0.12 * (hi - lo || Math.abs(hi) * 0.05 || 1);
  lo -= pad; hi += pad;
  const xmax = h3 * 1.1;
  const extra = solve && h1 > 0.4 ? [h1 / 2, h1 / 4].filter((h) => Math.round(L / h) <= NMAX) : [];
  return (
    <>
      <Readouts>
        <Readout label="Convergence" value={R.kind} primary tone={inRange || R.kind === 'converged' ? 'ok' : R.kind === 'monotonic' ? 'warn' : 'bad'}
          sub={`${kindText[R.kind]} · ${g4(f3)} → ${g4(f2)} → ${g4(f1)} at ${g3(h3)}, ${g3(h2)}, ${g3(h1)} mm`} />
        {R.kind === 'monotonic' ? (
          <>
            <Readout label="Observed order" value={f(R.p, 2)} sub="should be near the element's theoretical order for this quantity" />
            <Readout label="Extrapolated" value={g4(R.ext)} sub="Richardson, to zero element size" />
            <Readout label="Grid convergence index" value={`${f(100 * R.gci, 2)}%`} sub="a band on the finest result, with a factor of safety of 1.25 on the estimate" />
            <Readout label="Asymptotic range" value={f(R.asymptotic, 3)} tone={inRange ? 'ok' : 'warn'}
              sub={inRange ? 'close to 1: the three meshes behave as theory says' : 'far from 1: the meshes are not yet in the asymptotic range (extrapolation unreliable)'} />
          </>
        ) : null}
        {model ? (
          <>
            <Readout label="Exact answer" value={g4(exact)} unit="MPa" tone={Math.abs(f1 / exact - 1) < 0.02 ? 'ok' : 'warn'}
              sub={`the finest mesh is ${pc(f1 / exact - 1)}${R.kind === 'monotonic' ? ` · extrapolation ${pc(R.ext / exact - 1)}` : ''}`} />
            <Readout label="Elements across the edge zone" value={`${f(zone / h3, 1)} → ${f(zone / h2, 1)} → ${f(zone / h1, 1)}`} sub={`edge zone π/β = ${g3(zone)} mm`} />
          </>
        ) : null}
      </Readouts>
      <Plot x0={0} x1={xmax} y0={lo} y1={hi} xl="element size (mm)" yl="result"
        legend={[['three meshes', 'var(--rd-accent)'], ['Richardson', 'var(--rd-blue)', '4 3']]}
        label="Mesh convergence: results against element size"
        caption="Results against element size, with the Richardson curve through them to zero size. For the built-in model, grey dots are two further halvings and the dashed green line the exact answer.">
        {(s) => (
          <>
            {Number.isFinite(exact) ? (
              <>
                <line x1={s.L} x2={s.W - s.R} y1={s.Y(exact)} y2={s.Y(exact)} stroke="var(--rd-ok)" strokeDasharray="5 3" />
                <text x={s.W - s.R - 4} y={s.Y(exact) - 5} textAnchor="end" fontSize={12} fill="var(--rd-ok)" {...HALO}>exact</text>
              </>
            ) : null}
            {R.kind === 'monotonic' ? (
              <>
                <Poly s={s} color="var(--rd-blue)" w={1.6} dash="4 3"
                  pts={Array.from({ length: 61 }, (_, i) => (xmax * i) / 60).map((h) => [h, R.ext + (f1 - R.ext) * (h / h1) ** R.p] as [number, number]).filter(([, y]) => y >= lo && y <= hi)} />
                <Dot x={s.X(0)} y={s.Y(R.ext)} c="var(--rd-blue)" r={4} />
              </>
            ) : null}
            {extra.map((h) => <Dot key={h} x={s.X(h)} y={s.Y(solve!(h))} c="var(--rd-muted)" r={3} />)}
            {hs.map((h, i) => <Dot key={i} x={s.X(h)} y={s.Y(fs[i])} c="var(--rd-accent)" />)}
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Free() {
  const { v } = useForm();
  const p = num(v.q_p), D = num(v.q_D), Rm = num(v.q_R) * 1000, r = num(v.q_r), t = num(v.q_t), E = num(v.q_E), nu = num(v.q_nu), sm = num(v.q_s), wm = num(v.q_w);
  if (!(p > 0 && D > 0 && r > 0 && t > 0 && E > 0)) return <Notes items={[{ tone: 'bad', text: 'Enter the pressure, end diameter and shell.' }]} />;
  const Rx = (p * Math.PI * D * D) / 4, sh = (p * r) / t, wc = ((p * r * r) / (E * t)) * (1 - nu / 2), wo = (p * r * r) / (E * t);
  const checks: { name: string; u: number }[] = [];
  const notes: Note[] = [];
  const rows: React.ReactNode[] = [];
  if (Number.isFinite(Rm)) {
    const d = Rm / Rx - 1;
    rows.push(<Readout key="R" label="Axial reaction" value={g4(Rm / 1000)} unit="kN" primary tone={Math.abs(d) < 0.001 ? 'ok' : 'bad'} sub={`must be ${g4(Rx / 1000)} kN: ${pc(d)}`} />);
    checks.push({ name: 'reaction', u: Rm / Rx });
    if (Math.abs(d) >= 0.001)
      notes.push({ tone: 'bad', text: Math.abs(Rm) < 0.01 * Rx ? 'No axial reaction: the pressure on the closures is missing, so the case carries no end load. Hoop stress alone will not show it.' : 'A static model is in equilibrium to round-off: a reaction that differs from the applied load means a load is missing, doubled, or applied to the wrong faces.' });
  }
  if (Number.isFinite(sm)) {
    const d = sm / sh - 1;
    rows.push(<Readout key="s" label="Far-field hoop stress" value={g4(sm)} unit="MPa" tone={Math.abs(d) < 0.02 ? 'ok' : 'warn'} sub={`pr/t = ${g4(sh)} MPa: ${pc(d)}`} />);
    checks.push({ name: 'hoop', u: sm / sh });
  }
  if (Number.isFinite(wm)) {
    const d = wm / wc - 1, open = Math.abs(wm / wo - 1) < 0.02 && Math.abs(d) > 0.05;
    rows.push(<Readout key="w" label="Far-field radial growth" value={g4(wm)} unit="mm" tone={Math.abs(d) < 0.02 ? 'ok' : 'bad'} sub={`closed ends ${g4(wc)} mm: ${pc(d)}${open ? ' · matches open ends' : ''}`} />);
    checks.push({ name: 'growth', u: wm / wc });
    if (open) notes.push({ tone: 'bad', text: `The growth matches an open-ended cylinder (${g4(wo)} mm): the end load is missing. With it, the axial stress pr/2t and Poisson's effect cut the growth by ν/2.` });
  }
  notes.push({ tone: 'info', text: <>Check reactions on every run, before looking at a single stress. Then far-field stresses and displacements against the hand calc. See <A href="../../fundamentals/hand-calcs/">Hand calcs</A>.</> });

  const W = 420, H = 250, Lx = 98, R = 20, T = 30, B = 34;
  const top = Math.max(1.3, ...checks.map((c) => c.u)) * 1.05, X = (u: number) => Lx + (Math.max(0, Math.min(u, top)) / top) * (W - Lx - R), row = (H - T - B) / Math.max(1, checks.length);
  const grid: number[] = [];
  for (let u = 0; u <= top + 1e-9; u += 0.25) grid.push(u);
  return (
    <>
      <Readouts>{rows}</Readouts>
      {checks.length ? (
        <Figure label="Model value over expected value for each check" caption="Each check as the model's value over the value it must have. Equilibrium must hold to round-off; far-field values to a few per cent.">
          <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {grid.map((u) => {
              const one = Math.abs(u - 1) < 1e-9;
              return (
                <g key={u}>
                  <line x1={X(u)} x2={X(u)} y1={T} y2={H - B} stroke={one ? 'var(--rd-ink)' : 'var(--rd-line)'} strokeOpacity={one ? 0.7 : 1} />
                  <text x={X(u)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{`${f(100 * u, 0)}%`}</text>
                </g>
              );
            })}
            {checks.map((ch, i) => {
              const y = T + i * row + row * 0.2, off = Math.abs(ch.u - 1) > 0.02;
              return (
                <g key={ch.name}>
                  <rect x={Lx} y={y} width={Math.max(1, X(ch.u) - Lx)} height={row * 0.6} rx={2} fill={off ? 'var(--rd-accent)' : 'var(--rd-ok)'} fillOpacity={0.8} />
                  <text x={Lx - 6} y={y + row * 0.3 + 4} textAnchor="end" fontSize={12} fill="var(--rd-ink)">{ch.name}</text>
                </g>
              );
            })}
            <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">model / expected</text>
          </svg>
        </Figure>
      ) : null}
      <Notes items={notes} />
    </>
  );
}

function Detail() {
  const { v } = useForm();
  const ang = num(v.d_ang), n = Math.min(8, Math.max(1, Math.round(num(v.d_n)) || 5)), avg = num(v.d_avg), un = num(v.d_un), s04 = num(v.d_s04), s10 = num(v.d_s10);
  if (!(ang >= 90 && ang <= 360)) return <Notes items={[{ tone: 'bad', text: 'Enter an interior angle between 90° and 360°.' }]} />;
  const lam = williamsLambda(ang), g = 2 ** (1 - lam);
  const notes: Note[] = [];
  if (lam < 1) notes.push({ tone: 'bad', text: 'At a singular point the stress the model reports is set by the mesh, not the part. Model the real radius and converge it, read stresses at a distance with a method that defines one, or use fracture mechanics for cracks.' });
  notes.push({ tone: 'info', text: 'Point loads and single-node constraints are singular too. Spread loads over a realistic area, and introduce them with a coupling that does not stiffen the part (Nastran RBE3, Abaqus distributing coupling) unless the real part is rigid.' });
  notes.push({ tone: 'info', text: 'Nodal averaging smooths stress across element boundaries and hides how far apart the elements disagree. Compare the unaveraged values at the peak.' });
  const ks = Array.from({ length: n + 1 }, (_, i) => i);
  const j = Number.isFinite(avg) && Number.isFinite(un) && avg !== 0 ? Math.abs(un / avg - 1) : NaN;
  return (
    <>
      <Readouts>
        <Readout label="Williams exponent λ" value={f(lam, 4)} primary tone={lam < 1 ? 'bad' : 'ok'}
          sub={lam < 1 ? <>stress grows as r<Sup>{f(lam - 1, 3)}</Sup> towards the corner</> : 'not singular'} />
        {lam < 1 ? <Readout label="Each mesh halving" value={`×${f(g, 3)}`} tone="bad" sub={`×${f(g ** n, 2)} after ${n} halvings: no converged value`} /> : null}
        {Number.isFinite(j) ? (
          <Readout label="Averaged against element" value={pc(un / avg - 1)} tone={j > 0.1 ? 'warn' : 'ok'}
            sub={`${g3(un)} against ${g3(avg)} MPa: ${j > 0.1 ? 'a large jump: the mesh is too coarse here' : 'small: the field is resolved here'}`} />
        ) : null}
        {Number.isFinite(s04) && Number.isFinite(s10) ? (
          <Readout label="Weld hot-spot stress" value={g3(hotSpot(s04, s10))} unit="MPa"
            sub={<>1.67 σ<Sub>0.4t</Sub> − 0.67 σ<Sub>1.0t</Sub> (IIW, fine mesh), for hot-spot S-N curves only</>} />
        ) : null}
      </Readouts>
      <Plot x0={0} x1={n} y0={0} y1={Math.max(2, g ** n * 1.15)} xl="mesh halvings" yl="peak / coarsest mesh"
        legend={[[`${f(ang, 0)}° corner`, 'var(--rd-accent)'], ['converged', 'var(--rd-ok)', '5 3']]}
        label="Peak stress at the corner as the mesh is halved"
        caption="Peak stress at a corner of this interior angle as the mesh is halved, relative to the coarsest mesh. A smooth or obtuse corner stays flat; a sharp one climbs for ever.">
        {(s) => (
          <>
            <line x1={s.L} x2={s.W - s.R} y1={s.Y(1)} y2={s.Y(1)} stroke="var(--rd-ok)" strokeDasharray="5 3" />
            <Poly s={s} color="var(--rd-accent)" pts={ks.map((k) => [k, g ** k])} />
            {ks.map((k) => <Dot key={k} x={s.X(k)} y={s.Y(g ** k)} c="var(--rd-accent)" r={3.5} />)}
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Rosette() {
  const { v } = useForm();
  const a = num(v.g_a), b = num(v.g_b), c3 = num(v.g_c), E = num(v.g_E), nu = num(v.g_nu), m1 = num(v.g_m1), m2 = num(v.g_m2);
  if (![a, b, c3].every(Number.isFinite) || !(E > 0)) return <Notes items={[{ tone: 'bad', text: 'Enter three gauge readings and E.' }]} />;
  const r = rosette(a, b, c3, E, nu);
  // equal scales on both axes, so the circle is a circle
  const mean = (r.e1 + r.e2) / 2, rad = (r.e1 - r.e2) / 2;
  const pw = 420 - 64 - 20, ph = 250 - 30 - 40;
  const xa = Math.min(0, r.e2 - rad * 0.2), xb = Math.max(0, r.e1 + rad * 0.2);
  const yhalf = Math.max(rad * 1.2, ((xb - xa) * ph) / (2 * pw)) || 1, xhalf = (yhalf * pw) / ph, cx = (xa + xb) / 2;
  // gauge points: a at 2θ = −2θp from the principal direction, b and c at 90° and 180° further round
  const t0 = (-2 * r.theta * Math.PI) / 180;
  const cmp = Number.isFinite(m1);
  return (
    <>
      <Readouts>
        <Readout label="Principal stresses σ1 / σ2" value={`${g3(r.s1)} / ${g3(r.s2)}`} unit="MPa" primary sub={`plane stress · von Mises ${g3(r.vm)} MPa`} />
        <Readout label="Principal strains" value={`${f(r.e1, 0)} / ${f(r.e2, 0)}`} unit="µε" sub={`first principal at ${f(r.theta, 1)}° from gauge a`} />
        {cmp ? (
          <Readout label="Against the model" value={`${pc(r.s1 / m1 - 1)}${Number.isFinite(m2) ? ` / ${pc(r.s2 / m2 - 1)}` : ''}`} tone={Math.abs(r.s1 / m1 - 1) < 0.05 ? 'ok' : 'warn'}
            sub={`test / model − 1, for σ1${Number.isFinite(m2) ? ' and σ2' : ''}`} />
        ) : null}
      </Readouts>
      <Plot x0={cx - xhalf} x1={cx + xhalf} y0={-yhalf} y1={yhalf} xl="normal strain (µε)" yl="shear strain / 2 (µε)"
        legend={[["Mohr's circle", 'var(--rd-blue)']]}
        label="Mohr's circle of strain from the three gauges"
        caption="Mohr's circle of strain from the three gauges: a, b and c sit 90° apart round it; the principal strains are where it crosses the axis.">
        {(s) => (
          <>
            <Poly s={s} color="var(--rd-blue)" w={1.8} pts={Array.from({ length: 121 }, (_, i) => (2 * Math.PI * i) / 120).map((t) => [mean + rad * Math.cos(t), rad * Math.sin(t)] as [number, number])} />
            <line x1={s.X(r.e2)} x2={s.X(r.e1)} y1={s.Y(0)} y2={s.Y(0)} stroke="var(--rd-ink)" strokeOpacity={0.5} />
            {(['a', 'b', 'c'] as const).map((name, i) => {
              const t = t0 + (i * Math.PI) / 2, x = s.X(mean + rad * Math.cos(t)), y = s.Y(rad * Math.sin(t));
              return (
                <g key={name}>
                  <Dot x={x} y={y} c="var(--rd-accent)" r={4} />
                  <text x={x + 7} y={y - 6} fontSize={12} fill="var(--rd-accent)" {...HALO}>{name}</text>
                </g>
              );
            })}
            <Dot x={s.X(r.e1)} y={s.Y(0)} c="var(--rd-ink)" r={3.5} />
            <Dot x={s.X(r.e2)} y={s.Y(0)} c="var(--rd-ink)" r={3.5} />
          </>
        )}
      </Plot>
      <Notes items={[
        { tone: 'info', text: "Place gauges where the model shows a gentle gradient, and compare with the model's strain averaged over the gauge length. A gauge in a steep gradient measures the gauge as much as the part." },
        { tone: 'info', text: 'Gauge both surfaces where the part bends. A single surface cannot separate membrane from bending.' },
      ]} />
    </>
  );
}

function Body({ fillFree, fillGauge }: { fillFree: MaterialFillData; fillGauge: MaterialFillData }) {
  const { v } = useForm();
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'conv', label: 'Mesh convergence' }, { value: 'free', label: 'Equilibrium & far field' }, { value: 'detail', label: 'Stress at details' }, { value: 'gauge', label: 'Strain gauges' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'conv' ? (
          <Group legend="Three meshes">
            <Choice name="v_mode" label="Results from" options={[{ value: 'model', label: 'The case-edge model on this page' }, { value: 'yours', label: 'Your own model' }]} />
            {v.v_mode === 'model' ? (
              <>
                <FieldRow><Num name="m_p" label="Pressure" unit="MPa" /><Num name="m_r" label="Mean radius" unit="mm" /></FieldRow>
                <FieldRow><Num name="m_t" label="Wall" unit="mm" /><Num name="m_E" label="E" unit="MPa" /></FieldRow>
                <FieldRow><Num name="m_nu" label="Poisson's ratio" /><Num name="m_h" label="Coarsest element" unit="mm" /></FieldRow>
                <Num name="m_rr" label="Refinement ratio" />
                <Hint>A real model: the case wall as cubic elements on an elastic foundation, clamped at a rigid flange, solved in your browser. Its exact answer is known.</Hint>
              </>
            ) : (
              <>
                <FieldRow><Num name="y_f1" label="Finest result" /><Num name="y_h1" label="Element size" unit="mm" /></FieldRow>
                <FieldRow><Num name="y_f2" label="Medium result" /><Num name="y_h2" label="Element size" unit="mm" /></FieldRow>
                <FieldRow><Num name="y_f3" label="Coarsest result" /><Num name="y_h3" label="Element size" unit="mm" /></FieldRow>
                <Hint>The same quantity, at the same point, from three meshes refined everywhere it matters: ideally by a constant ratio of about 1.3 or more.</Hint>
              </>
            )}
          </Group>
        ) : v.tab === 'free' ? (
          <Group legend="What the model reports, against what it must" hint="Far-field values: read them well away from ends, joints and openings. A closed vessel's reaction must equal pressure times the area inside the end seal.">
            <MaterialFill fill={fillFree} />
            <FieldRow><Num name="q_p" label="Pressure" unit="MPa" /><Num name="q_D" label="End seal or bore ⌀" unit="mm" /></FieldRow>
            <FieldRow><Num name="q_r" label="Mean radius" unit="mm" /><Num name="q_t" label="Wall" unit="mm" /></FieldRow>
            <FieldRow><Num name="q_E" label="E" unit="MPa" /><Num name="q_nu" label="Poisson's ratio" /></FieldRow>
            <Num name="q_R" label="Model's axial reaction" unit="kN" />
            <FieldRow><Num name="q_s" label="Model's hoop stress" unit="MPa" /><Num name="q_w" label="Model's radial growth" unit="mm" /></FieldRow>
          </Group>
        ) : v.tab === 'detail' ? (
          <Group legend="Peaks and corners" hint="270° is a sharp 90° internal corner; 360° is a crack; up to 180° is not singular. Peaks and weld stresses here are illustrative.">
            <FieldRow><Num name="d_ang" label="Corner's interior angle" unit="°" /><Num name="d_n" label="Mesh halvings" /></FieldRow>
            <FieldRow><Num name="d_avg" label="Peak, nodal-averaged" unit="MPa" /><Num name="d_un" label="Peak, element value" unit="MPa" /></FieldRow>
            <FieldRow><Num name="d_s04" label="Weld: stress 0.4t from toe" unit="MPa" /><Num name="d_s10" label="Weld: stress 1.0t from toe" unit="MPa" /></FieldRow>
          </Group>
        ) : (
          <Group legend="Rectangular rosette, 0°/45°/90°" hint="Readings are illustrative. Compare with the model's value averaged over the gauge length, on the same surface.">
            <MaterialFill fill={fillGauge} />
            <FieldRow><Num name="g_a" label="Gauge a, 0°" unit="µε" /><Num name="g_b" label="Gauge b, 45°" unit="µε" /></FieldRow>
            <Num name="g_c" label="Gauge c, 90°" unit="µε" />
            <FieldRow><Num name="g_E" label="E" unit="MPa" /><Num name="g_nu" label="Poisson's ratio" /></FieldRow>
            <FieldRow><Num name="g_m1" label="Model σ1" unit="MPa" placeholder="optional" /><Num name="g_m2" label="Model σ2" unit="MPa" placeholder="optional" /></FieldRow>
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'conv' ? <Conv /> : v.tab === 'free' ? <Free /> : v.tab === 'detail' ? <Detail /> : <Rosette />}</Outputs>
    </>
  );
}

const DEFAULTS: Values = {
  tab: 'conv', v_mode: 'model',
  m_p: '10', m_r: '150.69', m_t: '1.377', m_E: '205000', m_nu: '0.29', m_h: '16', m_rr: '2',
  y_f1: '2205.4', y_h1: '4', y_f2: '2108.5', y_h2: '8', y_f3: '1811.1', y_h3: '16',
  q_p: '10', q_D: '300', q_R: '0', q_r: '150.69', q_t: '1.377', q_E: '205000', q_nu: '0.29', q_s: '1094.3', q_w: '0.804',
  d_ang: '270', d_n: '5', d_avg: '410', d_un: '455', d_s04: '300', d_s10: '250',
  g_a: '1260', g_b: '3170', g_c: '4950', g_E: '205000', g_nu: '0.29', g_m1: '1204', g_m2: '602',
};

export default function Fea({ fillFree, fillGauge }: { fillFree: MaterialFillData; fillGauge: MaterialFillData }) {
  return (
    <Calc
      id="model-checks"
      title="Model checks before the report"
      defaults={DEFAULTS}
      foot="Convergence: Richardson extrapolation and the grid convergence index (Roache; Celik et al.). Edge model: thin-shell axisymmetric bending as a beam on an elastic foundation, Hermite elements. Corners: Williams' opening-mode exponent. Weld hot spot: IIW fine-mesh extrapolation. Rosettes: plane stress."
    >
      <Body fillFree={fillFree} fillGauge={fillGauge} />
    </Calc>
  );
}
