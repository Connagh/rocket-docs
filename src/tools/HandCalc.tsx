// Hand calcs in five tabs (beam, flat plate, thin shell, lug and pin, column), each with its readouts, margins once
// the programme's factors are entered, and a chart. Maths in src/lib/handcalc.ts (unit-tested).
import React from 'react';
import { BEAM_CASES, section, shearStress, beam, circularPlate, rectPlate, rectCoefficients, shell, lugChecks, column, secantStress, type SectionKind, type BeamCase } from '../lib/handcalc';
import { readFactor, awaitingMessage } from '../lib/factors';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Choice, ModeTabs, Readouts, Readout, Notes, Figure, Plot, Poly, MaterialFill, A, Sub, Sup, HALO, useForm, num, fmt, type Tone, type Values } from './kit';
import type { MaterialFillData } from './materialOptions';

const f = (v: number, d = 2) => (Number.isFinite(v) ? fmt(v, d) : '—');
const g3 = (v: number) => (Math.abs(v) >= 100 ? f(v, 0) : Math.abs(v) >= 10 ? f(v, 1) : Math.abs(v) >= 1 ? f(v, 2) : f(v, 3));
const sci = (v: number): React.ReactNode => { const e = Math.floor(Math.log10(Math.abs(v))); return e >= -2 && e < 5 ? g3(v) : <>{f(v / 10 ** e, 2)}×10<Sup>{e}</Sup></>; };
const sgn = (v: number) => `${v >= 0 ? '+' : ''}${f(v, 2)}`;
const DIMS: Record<SectionKind, [string, string | null, string | null]> = {
  tube: ['Outside ⌀', 'Wall', null], round: ['Diameter', null, null],
  rect: ['Width', 'Depth', null], rhs: ['Width', 'Depth', 'Wall'],
};
const SECTIONS = [{ value: 'tube', label: 'Round tube' }, { value: 'round', label: 'Solid round' }, { value: 'rect', label: 'Rectangle' }, { value: 'rhs', label: 'Rectangular tube' }];
type Note = { tone: Tone; text: React.ReactNode };
type Factors = { fy: number | null; fu: number | null };
const Dot = ({ x, y, c, r = 5 }: { x: number; y: number; c: string; r?: number }) => <circle cx={x} cy={y} r={r} fill={c} stroke="var(--rd-panel)" strokeWidth={1.5} />;
const spanOf = (vals: number[], pad = 0.1) => { const lo = Math.min(...vals), hi = Math.max(...vals), p = (hi - lo || Math.abs(hi) || 1) * pad; return [lo - p, hi + p]; };

/** A margin readout, or a prompt for the missing factor. */
function Ms({ label, factor, allow, stress }: { label: string; factor: number | null; allow: number; stress: number }) {
  if (factor === null) return <Readout label={label} value="needs your factor" />;
  if (!(allow > 0)) return <Readout label={label} value="—" sub="enter the allowable" />;
  const ms = allow / (factor * stress) - 1;
  return <Readout label={label} value={`MS ${sgn(ms)}`} tone={ms < 0 ? 'bad' : 'ok'} sub={`${f(factor, 2)} × ${g3(stress)} MPa against ${g3(allow)} MPa`} />;
}
const awaiting = (fac: Factors, need: ('fy' | 'fu')[], what: string): Note[] => {
  const missing = need.filter((k) => fac[k] === null).map((k) => (k === 'fy' ? 'yield factor' : 'ultimate factor'));
  return missing.length ? [{ tone: 'warn', text: awaitingMessage(missing, what) }] : [];
};
const sectionOf = (v: Values, p: string) => section(v[`${p}_kind`] as SectionKind, num(v[`${p}_d1`]), num(v[`${p}_d2`]), num(v[`${p}_d3`]));

function Beam({ fac }: { fac: Factors }) {
  const { v } = useForm();
  const kind = v.b_case as BeamCase, W = num(v.b_W), L = num(v.b_L), E = num(v.b_E), s = sectionOf(v, 'b');
  if (!s || !(W >= 0 && L > 0 && E > 0)) return <Notes items={[{ tone: 'bad', text: 'Check the section dimensions, span, load and modulus.' }]} />;
  const b = beam(kind, W, L, E * s.I), sigma = b.M / s.Z, tau = shearStress(b.V, s);
  const where = kind.startsWith('cant') ? 'at the root' : kind === 'ff-udl' ? 'at the ends' : kind === 'ff-point' ? 'at the ends and mid-span' : 'at mid-span';
  const notes: Note[] = awaiting(fac, ['fy', 'fu'], 'the margins');
  if (L / s.c < 10) notes.push({ tone: 'warn', text: `A short, deep beam (span ${f(L / (2 * s.c), 1)} × its depth): shear deflection and local effects at the supports matter, and beam theory is only approximate.` });
  if (v.b_kind === 'tube' && (2 * s.c) / num(v.b_d2) > 50) notes.push({ tone: 'info', text: <>A thin tube (D/t = {f((2 * s.c) / num(v.b_d2), 0)}): beam bending is rarely what fails it. Check local loads where it is supported, and buckling under bending. See <A href="../../verify/shell-buckling/">Shell buckling</A>.</> });
  const xs = Array.from({ length: 121 }, (_, i) => (L * i) / 120), Ms_ = xs.map((x) => b.Mx(x) / 1e6), [lo, hi] = spanOf([...Ms_, 0], 0.15);
  const ws = xs.map(b.wx), wmax = Math.max(...ws) || 1;
  return (
    <>
      <Readouts>
        <Readout label="Bending stress" value={g3(sigma)} unit="MPa" primary sub={`M = ${g3(b.M / 1e6)} kN·m, ${where}`} />
        <Readout label="Shear stress" value={g3(tau)} unit="MPa" sub={`peak, at the neutral axis · V = ${g3(b.V / 1000)} kN`} />
        <Readout label="Deflection" value={g3(b.delta)} unit="mm" sub={`span / ${f(L / b.delta, 0)}`} />
        <Readout label="Section modulus Z" value={s.Z >= 1e5 ? fmt(s.Z, 0) : g3(s.Z)} unit="mm³" sub={<>I = {sci(s.I)} mm⁴ · A = {sci(s.A)} mm²</>} />
        <Ms label="Yield margin" factor={fac.fy} allow={num(v.b_fty)} stress={sigma} />
        <Ms label="Ultimate margin" factor={fac.fu} allow={num(v.b_ftu)} stress={sigma} />
      </Readouts>
      <Plot x0={0} x1={L} y0={lo} y1={hi} xl="position along the span (mm)" yl="moment (kN·m)" label="Bending moment along the span and the deflected shape"
        legend={[['moment', 'var(--rd-blue)'], ['deflected shape', 'var(--rd-accent)', '5 3']]}
        caption="Bending moment along the span, and the deflected shape (not to scale).">
        {(c) => (
          <>
            <path d={`M${c.X(0)},${c.Y(0)} ${xs.map((x, i) => `L${c.X(x).toFixed(1)},${c.Y(Ms_[i]).toFixed(1)}`).join(' ')} L${c.X(L)},${c.Y(0)} Z`} fill="var(--rd-blue)" fillOpacity={0.18} />
            <Poly s={c} color="var(--rd-blue)" pts={xs.map((x, i) => [x, Ms_[i]])} />
            {/* deflected shape, scaled to a third of the plot height, drawn downwards from the top */}
            <polyline points={xs.map((x, i) => `${c.X(x).toFixed(1)},${(c.T + 6 + (ws[i] / wmax) * ((c.H - c.T - c.B) / 3)).toFixed(1)}`).join(' ')} fill="none" stroke="var(--rd-accent)" strokeWidth={1.8} strokeDasharray="5 3" />
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Plate({ fac }: { fac: Factors }) {
  const { v } = useForm();
  const circ = v.p_shape === 'circ', edge = v.p_edge as 'ss' | 'clamped';
  const q = num(v.p_q), a = num(v.p_a), b = num(v.p_b), t = num(v.p_t), E = num(v.p_E), nu = num(v.p_nu), fty = num(v.p_fty), ftu = num(v.p_ftu);
  if (!(q >= 0 && a > 0 && t > 0 && E > 0 && nu >= 0 && nu < 0.5 && (circ || b > 0))) return <Notes items={[{ tone: 'bad', text: 'Check the plate dimensions, pressure and material.' }]} />;
  const cp = circ ? circularPlate(edge, q, a, t, E, nu) : null, rp = circ ? null : rectPlate(edge, q, a, b, t, E);
  const res = (cp ?? rp)!;
  const both = fac.fy !== null && fac.fu !== null && fty > 0 && ftu > 0;
  const need = both ? t * Math.sqrt(Math.max((fac.fy! * res.sigma) / fty, (fac.fu! * res.sigma) / ftu)) : NaN;
  const dome = both && circ ? Math.max((fac.fy! * q * a) / (2 * fty), (fac.fu! * q * a) / (2 * ftu)) : NaN;
  const notes: Note[] = awaiting(fac, ['fy', 'fu'], 'the margins and the thickness needed');
  if (res.w > 0.5 * t) notes.push({ tone: 'warn', text: `The deflection is ${f(res.w / t, 2)} of the thickness. Beyond about half, the plate also stretches like a membrane and these small-deflection formulas over-predict the stress: use a large-deflection solution or a finite-element model.` });
  notes.push({ tone: 'info', text: edge === 'ss' ? 'Simply supported gives the largest centre stress and deflection; clamped gives the largest edge stress. A bolted or welded edge lies between: check both.' : 'Clamped assumes the edge cannot rotate at all. A flange or bolt pattern that can rotate moves the stress toward the centre: check simply supported too.' });
  let chart: React.ReactNode;
  if (cp) {
    const rs = Array.from({ length: 81 }, (_, i) => (a * i) / 80), sr = rs.map(cp.sr), st = rs.map(cp.st), [lo, hi] = spanOf([...sr, ...st, 0], 0.12);
    chart = (
      <Plot x0={0} x1={1} y0={lo} y1={hi} xl="radius / plate radius" yl="surface stress (MPa)" label="Surface stresses across the circular plate"
        legend={[['radial', 'var(--rd-blue)'], ['tangential', 'var(--rd-accent)', '6 3']]}
        caption="Radial and tangential surface stresses across the plate, from the centre to the edge.">
        {(c) => (
          <>
            <Poly s={c} color="var(--rd-blue)" pts={rs.map((r, i) => [r / a, sr[i]])} />
            <Poly s={c} color="var(--rd-accent)" dash="6 3" pts={rs.map((r, i) => [r / a, st[i]])} />
          </>
        )}
      </Plot>
    );
  } else {
    const ratios = Array.from({ length: 61 }, (_, i) => 1 + (4 * i) / 60), k = Math.min(5, rp!.ratio);
    chart = (
      <Plot x0={1} x1={5} y0={0} y1={0.8} xl="long side / short side" yl="β  (σ = βqb²/t²)" label="Stress coefficient of a rectangular plate against its aspect ratio"
        legend={[['simply supported', 'var(--rd-blue)'], ['clamped', 'var(--rd-accent)', '6 3']]}
        caption="The stress coefficient of a rectangular plate against its aspect ratio: the dot is this plate.">
        {(c) => (
          <>
            <Poly s={c} color="var(--rd-blue)" pts={ratios.map((x) => [x, rectCoefficients('ss', x, 1).beta])} />
            <Poly s={c} color="var(--rd-accent)" dash="6 3" pts={ratios.map((x) => [x, rectCoefficients('clamped', x, 1).beta])} />
            <Dot x={c.X(k)} y={c.Y(rp!.beta)} c="var(--rd-ink)" />
          </>
        )}
      </Plot>
    );
  }
  return (
    <>
      <Readouts>
        <Readout label="Peak stress" value={g3(res.sigma)} unit="MPa" primary sub={`at the ${res.where}${circ && edge === 'clamped' ? ` · ${g3((3 * (1 + nu) * q * a * a) / (8 * t * t))} MPa at the centre` : ''}`} />
        <Readout label="Deflection" value={g3(res.w)} unit="mm" tone={res.w > 0.5 * t ? 'warn' : undefined} sub={`at the centre · ${f(res.w / t, 2)} of the thickness`} />
        {cp && edge === 'ss' ? <Readout label="Edge slope" value={f((cp.slope * 180) / Math.PI, 2)} unit="°" sub="the edge rotates: it can open a face seal" /> : null}
        {rp ? <Readout label="Coefficient β" value={f(rp.beta, 3)} sub={`α ${f(rp.alpha, 4)} · sides ${f(rp.ratio, 2)} : 1`} /> : null}
        <Ms label="Yield margin" factor={fac.fy} allow={fty} stress={res.sigma} />
        <Ms label="Ultimate margin" factor={fac.fu} allow={ftu} stress={res.sigma} />
        {both ? <Readout label="Thickness needed" value={g3(need)} unit="mm" sub={`stress goes as 1/t²${circ ? ` · a hemispherical head of the same radius needs ${g3(dome)} mm` : ''}`} />
          : <Readout label="Thickness needed" value="needs your factors" />}
      </Readouts>
      {chart}
      <Notes items={notes} />
    </>
  );
}

function Shell({ fac }: { fac: Factors }) {
  const { v } = useForm();
  const p = num(v.s_p), r = num(v.s_r), t = num(v.s_t), E = num(v.s_E), nu = num(v.s_nu);
  if (!(p >= 0 && r > 0 && t > 0 && E > 0 && nu >= 0 && nu < 0.5)) return <Notes items={[{ tone: 'bad', text: 'Check the radius, wall, pressure and material.' }]} />;
  const s = shell(p, r, t, E, nu, v.s_end === 'closed');
  const notes: Note[] = awaiting(fac, ['fy', 'fu'], 'the margins');
  if (s.thick) notes.push({ tone: 'warn', text: <>r/t = {f(r / t, 1)}: below about 10 the wall is thick and thin-shell theory under-predicts the inner-surface stress. Use Lamé's thick-cylinder solution. See <A href="../../motor/case-sizing/">Case sizing</A>.</> });
  notes.push({ tone: 'info', text: `Membrane stresses hold only away from edges, closures, rings and openings. Within about ${g3(s.decayLength)} mm of a stiff edge the wall bends; a fully clamped edge raises the axial surface stress to ${f(s.peakAxial / s.hoop, 2)} × the hoop stress.` });
  notes.push({ tone: 'info', text: <>Under external pressure or axial compression a thin shell buckles long before it yields. See <A href="../../verify/shell-buckling/">Shell buckling</A>.</> });
  const xmax = 3 * s.decayLength, xs = Array.from({ length: 121 }, (_, i) => (xmax * i) / 120);
  const hoop = xs.map(s.hoopAt), inner = xs.map(s.innerAt), outer = xs.map(s.outerAt), [lo, hi] = spanOf([...hoop, ...inner, ...outer, 0], 0.08);
  return (
    <>
      <Readouts>
        <Readout label="Hoop stress" value={g3(s.hoop)} unit="MPa" primary sub={`pr/t · axial ${g3(s.axial)} · von Mises ${g3(s.vm)}`} />
        <Readout label="Radial growth" value={g3(s.growth)} unit="mm" sub={`${f((100 * s.growth) / r, 2)}% of the radius`} />
        <Readout label="Edge zone" value={g3(s.decayLength)} unit="mm" sub={`π/β, where edge bending dies away · √(rt) = ${g3(s.sqrtRT)} mm`} />
        <Readout label="At a clamped edge" value={g3(s.peakAxial)} unit="MPa" tone="warn"
          sub={`axial, inner surface: ${f(s.edgeBend / s.hoop, 2)} × hoop in bending · a land of ${g3((t * s.peakAxial) / s.hoop)} mm holds it to the hoop stress`} />
        <Readout label="Sphere or hemisphere" value={g3(s.sphere)} unit="MPa" sub="pr/2t: half the cylinder's hoop stress" />
        <Ms label="Yield margin" factor={fac.fy} allow={num(v.s_fty)} stress={s.hoop} />
        <Ms label="Ultimate margin" factor={fac.fu} allow={num(v.s_ftu)} stress={s.hoop} />
      </Readouts>
      <Plot x0={0} x1={xmax} y0={lo} y1={hi} xl="distance from the clamped edge (mm)" yl="stress (MPa)" label="Stresses near a clamped edge"
        legend={[['hoop', 'var(--rd-blue)'], ['axial in', 'var(--rd-accent)'], ['out', 'var(--rd-accent)', '5 3']]}
        caption="Stresses near a clamped edge. The hoop stress is suppressed at the edge, and bending adds and subtracts from the axial stress on the two surfaces; both settle to membrane values beyond the edge zone.">
        {(c) => (
          <>
            <rect x={c.X(0)} y={c.T} width={c.X(s.decayLength) - c.X(0)} height={c.H - c.T - c.B} fill="var(--rd-warn)" fillOpacity={0.07} />
            <Poly s={c} color="var(--rd-blue)" pts={xs.map((x, i) => [x, hoop[i]])} />
            <Poly s={c} color="var(--rd-accent)" pts={xs.map((x, i) => [x, inner[i]])} />
            <Poly s={c} color="var(--rd-accent)" w={1.6} dash="5 3" pts={xs.map((x, i) => [x, outer[i]])} />
            <text x={c.X(s.decayLength) - 4} y={c.H - c.B - 6} textAnchor="end" fontSize={12} fill="var(--rd-warn)" {...HALO}>edge zone</text>
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Lug({ fac }: { fac: Factors }) {
  const { v } = useForm();
  const L = { P: num(v.l_P), t: num(v.l_t), W: num(v.l_W), e: num(v.l_e), D: num(v.l_D), d: num(v.l_d), t2: num(v.l_t2), g: num(v.l_g), Ftu: num(v.l_ftu), Fsu: num(v.l_fsu), Fbru: num(v.l_fbru), pinFtu: num(v.l_pftu), pinFsu: num(v.l_pfsu) };
  if (!(L.P >= 0 && L.t > 0 && L.W > L.D && L.e > L.D / 2 && L.d > 0 && L.d <= L.D && L.t2 >= 0 && L.g >= 0)) return <Notes items={[{ tone: 'bad', text: 'Check the lug geometry: wider than the hole, the hole clear of the end, the pin no bigger than the hole.' }]} />;
  const fu = fac.fu, checks = lugChecks(L);
  const worst = checks.reduce((a, b) => (b.stress / b.allow > a.stress / a.allow ? b : a));
  const notes: Note[] = awaiting(fac, ['fu'], 'the margins');
  notes.push({ tone: 'info', text: `${worst.name} governs. ${worst.key === 'pinB' ? 'Pin bending usually does: close the gap, use thicker clevis plates closer to the lug, or a bigger or stronger pin.' : 'Pin bending is next to check whenever the gap or the clevis plates grow.'}` });
  if (L.e / L.D < 1.5) notes.push({ tone: 'warn', text: `Edge distance e/D = ${f(L.e / L.D, 2)}: below about 1.5 shear-out and bearing allowables fall quickly.` });
  notes.push({ tone: 'info', text: 'These are first-cut checks for an axial load. Oblique or transverse loads, lug fatigue (the hole is a stress concentration) and the full Melcon–Hoblit or ASME BTH-1 methods come next.' });
  const W = 420, H = 250, Lx = 98, R = 20, T = 30, B = 34, k = fu ?? 1;
  const top = Math.max(1.2, ...checks.map((c) => (k * c.stress) / c.allow)) * 1.05, X = (u: number) => Lx + (u / top) * (W - Lx - R), row = (H - T - B) / checks.length;
  const grid: number[] = [];
  for (let u = 0; u <= top + 1e-9; u += top > 2.5 ? 0.5 : 0.25) grid.push(u);
  return (
    <>
      <Readouts>
        {checks.map((c) => {
          if (fu === null) return <Readout key={c.key} label={c.name} value={g3(c.stress)} unit="MPa" primary={c === worst} sub={`${f((100 * c.stress) / c.allow, 0)}% of ${g3(c.allow)} MPa at the applied load`} />;
          const ms = c.allow / (fu * c.stress) - 1;
          return <Readout key={c.key} label={c.name} value={`MS ${sgn(ms)}`} primary={c === worst} tone={ms < 0 ? 'bad' : 'ok'} sub={`${g3(fu * c.stress)} MPa at ${f(fu, 2)} × load, against ${g3(c.allow)} MPa`} />;
        })}
      </Readouts>
      <Figure label="Each lug check as a share of its allowable" caption="Each check as a share of its allowable. The longest bar governs.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <text x={8} y={17} fontSize={12} fill="var(--rd-ink)">each check against its allowable</text>
          {grid.map((u) => (
            <g key={u}>
              <line x1={X(u)} x2={X(u)} y1={T} y2={H - B} stroke={u === 1 ? 'var(--rd-ink)' : 'var(--rd-line)'} strokeOpacity={u === 1 ? 0.7 : 1} />
              <text x={X(u)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{`${f(100 * u, 0)}%`}</text>
            </g>
          ))}
          {checks.map((c, i) => {
            const u = (k * c.stress) / c.allow, y = T + i * row + row * 0.2;
            return (
              <g key={c.key}>
                <rect x={Lx} y={y} width={Math.max(1, X(u) - Lx)} height={row * 0.6} rx={2} fill={u > 1 ? 'var(--rd-accent)' : c === worst ? 'var(--rd-warn)' : 'var(--rd-blue)'} fillOpacity={0.8} />
                <text x={Lx - 6} y={y + row * 0.3 + 4} textAnchor="end" fontSize={12} fill="var(--rd-ink)">{c.name}</text>
              </g>
            );
          })}
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">{fu === null ? 'stress / allowable, applied load' : `stress / allowable at ${f(fu, 2)} × load`}</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Column({ fac }: { fac: Factors }) {
  const { v } = useForm();
  const P = num(v.c_P), L = num(v.c_L), K = num(v.c_K), E = num(v.c_E), Fty = num(v.c_fty), e = num(v.c_e) || 0, s = sectionOf(v, 'c');
  if (!s || !(P >= 0 && L > 0 && K > 0 && E > 0 && Fty > 0)) return <Notes items={[{ tone: 'bad', text: 'Check the section, length, K and material.' }]} />;
  const c = column(s, L, K, E, Fty), { fy, fu } = fac;
  const notes: Note[] = awaiting(fac, e > 0 ? ['fu', 'fy'] : ['fu'], 'the margins');
  if (c.mode === 'Johnson') notes.push({ tone: 'warn', text: `A short column (KL/r ${f(c.slender, 0)} below ${f(c.transition, 0)}): it yields as it buckles, and the Euler load of ${g3(c.PcrEuler / 1000)} kN would be ${f(100 * (c.PcrEuler / c.Pcr - 1), 0)}% unconservative.` });
  if (v.c_kind === 'tube' && num(v.c_d1) / num(v.c_d2) > 40) notes.push({ tone: 'info', text: <>A thin-walled tube can also fail by local buckling of its wall before the column buckles. See <A href="../../verify/shell-buckling/">Shell buckling</A>.</> });
  notes.push({ tone: 'info', text: 'K is a judgement about the ends. Real "fixed" ends rotate, so design values (2.1, 0.8, 0.65) are larger than the theoretical ones (2, 0.7, 0.5).' });
  let yieldRo: React.ReactNode = null;
  if (e > 0) {
    if (fy === null) yieldRo = <Readout label="First yield" value={g3(secantStress(P, s, L, K, E, e))} unit="MPa" sub="peak at the applied load, secant formula · margin needs your yield factor" />;
    else {
      const sm = secantStress(fy * P, s, L, K, E, e), ms = Fty / sm - 1;
      yieldRo = <Readout label="First yield margin" value={`MS ${Number.isFinite(sm) ? sgn(ms) : '< −1'}`} tone={!Number.isFinite(sm) || ms < 0 ? 'bad' : 'ok'} sub={`${Number.isFinite(sm) ? `${g3(sm)} MPa` : 'beyond the Euler load'} at ${f(fy, 2)} × load with ${g3(e)} mm eccentricity`} />;
    }
  }
  const smax = Math.max(160, c.slender * 1.25, c.transition * 1.3), sl = Array.from({ length: 121 }, (_, i) => 1 + ((smax - 1) * i) / 120);
  const euler = (x: number) => (Math.PI ** 2 * E) / x ** 2, sa = (P * (fu ?? 1)) / s.A;
  return (
    <>
      <Readouts>
        <Readout label="Buckling load" value={g3(c.Pcr / 1000)} unit="kN" primary sub={`${c.mode}${c.mode === 'Johnson' ? ` · Euler alone would say ${g3(c.PcrEuler / 1000)} kN` : ''}`} />
        <Readout label="Slenderness KL/r" value={f(c.slender, 1)} sub={<>transition π√(2E/F<Sub>ty</Sub>) = {f(c.transition, 1)}</>} />
        <Readout label="Axial stress" value={g3(P / s.A)} unit="MPa" sub="P/A at the applied load" />
        {fu === null ? <Readout label="Buckling margin" value="needs your factor" /> : (() => {
          const ms = c.Pcr / (fu * P) - 1;
          return <Readout label="Buckling margin" value={`MS ${sgn(ms)}`} tone={ms < 0 ? 'bad' : 'ok'} sub={`${g3(c.Pcr / 1000)} kN against ${f(fu, 2)} × ${g3(P / 1000)} kN`} />;
        })()}
        {yieldRo}
      </Readouts>
      <Plot x0={0} x1={smax} y0={0} y1={Fty * 1.15} xl="slenderness KL/r" yl="critical stress (MPa)" label="Critical stress against slenderness"
        legend={[['Johnson / Euler', 'var(--rd-blue)'], ['Euler', 'var(--rd-muted)', '5 3']]}
        caption="Critical stress against slenderness: Johnson's parabola below the transition, Euler above it. The dot on the curve is this column's buckling stress; the orange dot is its stress under the load (factored once the ultimate factor is entered).">
        {(ch) => (
          <>
            <Poly s={ch} color="var(--rd-muted)" w={1.6} dash="5 3" pts={sl.filter((x) => euler(x) < Fty * 1.15).map((x) => [x, euler(x)])} />
            <Poly s={ch} color="var(--rd-blue)" pts={sl.map((x) => [x, x < c.transition ? Fty - (Fty ** 2 / (4 * Math.PI ** 2 * E)) * x * x : euler(x)])} />
            <line x1={ch.X(c.transition)} x2={ch.X(c.transition)} y1={ch.T} y2={ch.H - ch.B} stroke="var(--rd-warn)" strokeDasharray="2 3" />
            <Dot x={ch.X(c.slender)} y={ch.Y(c.sigmaCr)} c="var(--rd-ink)" />
            {sa < Fty * 1.15 ? <Dot x={ch.X(c.slender)} y={ch.Y(sa)} c="var(--rd-accent)" r={4.5} /> : null}
            <text x={ch.X(c.transition) + 4} y={ch.T + 14} fontSize={12} fill="var(--rd-warn)" {...HALO}>transition</text>
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function SectionFields({ p }: { p: string }) {
  const { v } = useForm();
  const [a, b, c] = DIMS[v[`${p}_kind`] as SectionKind] ?? DIMS.tube;
  return (
    <>
      <Choice name={`${p}_kind`} label="Section" options={SECTIONS} />
      <FieldRow>
        <Num name={`${p}_d1`} label={a} unit="mm" />
        {b ? <Num name={`${p}_d2`} label={b} unit="mm" /> : null}
        {c ? <Num name={`${p}_d3`} label={c} unit="mm" /> : null}
      </FieldRow>
    </>
  );
}

type Fills = { beam: MaterialFillData; plate: MaterialFillData; shell: MaterialFillData; column: MaterialFillData };

function Body({ fills }: { fills: Fills }) {
  const { v } = useForm();
  const fac: Factors = { fy: readFactor(v.fy), fu: readFactor(v.fu) };
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'beam', label: 'Beam' }, { value: 'plate', label: 'Plate' }, { value: 'shell', label: 'Shell' }, { value: 'lug', label: 'Lug & pin' }, { value: 'column', label: 'Column' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'beam' ? (
          <Group legend="Beam">
            <MaterialFill fill={fills.beam} />
            <Choice name="b_case" label="Supports and load" options={BEAM_CASES.map((c) => ({ value: c.key, label: c.name }))} />
            <FieldRow><Num name="b_W" label="Load, or total uniform load" unit="N" /><Num name="b_L" label="Span" unit="mm" /></FieldRow>
            <SectionFields p="b" />
            <Num name="b_E" label="E" unit="MPa" />
            <FieldRow><Num name="b_fty" label="Yield Fty" unit="MPa" /><Num name="b_ftu" label="Ultimate Ftu" unit="MPa" /></FieldRow>
          </Group>
        ) : v.tab === 'plate' ? (
          <Group legend="Flat plate, uniform pressure" hint="Rectangular-plate coefficients are for ν = 0.3. A bolted cover sits between simply supported and clamped: run both.">
            <MaterialFill fill={fills.plate} />
            <FieldRow>
              <Choice name="p_shape" label="Shape" options={[{ value: 'circ', label: 'Circular' }, { value: 'rect', label: 'Rectangular' }]} />
              <Choice name="p_edge" label="Edges" options={[{ value: 'ss', label: 'Simply supported' }, { value: 'clamped', label: 'Clamped' }]} />
            </FieldRow>
            <FieldRow>
              <Num name="p_a" label={v.p_shape === 'circ' ? 'Radius' : 'Long side'} unit="mm" />
              {v.p_shape === 'circ' ? null : <Num name="p_b" label="Short side" unit="mm" />}
            </FieldRow>
            <FieldRow><Num name="p_t" label="Thickness" unit="mm" /><Num name="p_q" label="Pressure" unit="MPa" /></FieldRow>
            <FieldRow><Num name="p_E" label="E" unit="MPa" /><Num name="p_nu" label="Poisson's ratio" /></FieldRow>
            <FieldRow><Num name="p_fty" label="Yield Fty" unit="MPa" /><Num name="p_ftu" label="Ultimate Ftu" unit="MPa" /></FieldRow>
          </Group>
        ) : v.tab === 'shell' ? (
          <Group legend="Thin cylinder, internal pressure" hint="Margins are on the hoop stress, away from the ends. The clamped edge is a bound: a real flange also grows and rotates.">
            <MaterialFill fill={fills.shell} />
            <FieldRow><Num name="s_p" label="Pressure" unit="MPa" /><Num name="s_r" label="Mean radius" unit="mm" /></FieldRow>
            <FieldRow><Num name="s_t" label="Wall" unit="mm" /><Choice name="s_end" label="Ends" options={[{ value: 'closed', label: 'Closed' }, { value: 'open', label: 'Open' }]} /></FieldRow>
            <FieldRow><Num name="s_E" label="E" unit="MPa" /><Num name="s_nu" label="Poisson's ratio" /></FieldRow>
            <FieldRow><Num name="s_fty" label="Yield Fty" unit="MPa" /><Num name="s_ftu" label="Ultimate Ftu" unit="MPa" /></FieldRow>
          </Group>
        ) : v.tab === 'lug' ? (
          <Group legend="Lug in a double-shear clevis" hint="Use your allowables: bearing Fbru depends on the edge distance ratio e/D. Check the clevis plates the same way with half the load each.">
            <Num name="l_P" label="Load along the lug" unit="N" />
            <FieldRow><Num name="l_t" label="Lug thickness" unit="mm" /><Num name="l_W" label="Lug width" unit="mm" /></FieldRow>
            <FieldRow><Num name="l_e" label="Hole centre to end" unit="mm" /><Num name="l_D" label="Hole ⌀" unit="mm" /></FieldRow>
            <FieldRow><Num name="l_d" label="Pin ⌀" unit="mm" /><Num name="l_t2" label="Each clevis plate" unit="mm" /></FieldRow>
            <Num name="l_g" label="Gap, lug to clevis" unit="mm" />
            <FieldRow><Num name="l_ftu" label="Lug Ftu" unit="MPa" /><Num name="l_fsu" label="Lug Fsu" unit="MPa" /></FieldRow>
            <Num name="l_fbru" label="Lug Fbru" unit="MPa" />
            <FieldRow><Num name="l_pftu" label="Pin Ftu" unit="MPa" /><Num name="l_pfsu" label="Pin Fsu" unit="MPa" /></FieldRow>
          </Group>
        ) : (
          <Group legend="Column, end load" hint="K: 1.0 pinned–pinned; design values 2.1 fixed–free, 0.8 fixed–pinned, 0.65 fixed–fixed. Eccentricity can stand in for crookedness: L/1000 is a common assumption.">
            <MaterialFill fill={fills.column} />
            <FieldRow><Num name="c_P" label="Load" unit="N" /><Num name="c_L" label="Length" unit="mm" /></FieldRow>
            <FieldRow><Num name="c_K" label="Effective-length factor K" /><Num name="c_e" label="Eccentricity" unit="mm" /></FieldRow>
            <SectionFields p="c" />
            <FieldRow><Num name="c_E" label="E" unit="MPa" /><Num name="c_fty" label="Yield Fty" unit="MPa" /></FieldRow>
          </Group>
        )}
        <Group legend="Your programme's factors" hint="Each multiplies the load you enter. Buckling and the lug checks use the ultimate factor; first yield uses the yield factor.">
          <FieldRow><Num name="fy" label="Yield factor" placeholder="your value" /><Num name="fu" label="Ultimate factor" placeholder="your value" /></FieldRow>
        </Group>
      </Inputs>
      <Outputs>
        {v.tab === 'beam' ? <Beam fac={fac} /> : v.tab === 'plate' ? <Plate fac={fac} /> : v.tab === 'shell' ? <Shell fac={fac} /> : v.tab === 'lug' ? <Lug fac={fac} /> : <Column fac={fac} />}
      </Outputs>
    </>
  );
}

const DEFAULTS: Values = {
  tab: 'beam',
  b_case: 'ss-udl', b_W: '4054', b_L: '1000', b_kind: 'tube', b_d1: '302.754', b_d2: '1.377', b_d3: '2', b_E: '205000', b_fty: '1450', b_ftu: '1520',
  p_shape: 'circ', p_edge: 'ss', p_q: '11', p_a: '142.5', p_b: '200', p_t: '25', p_E: '205000', p_nu: '0.29', p_fty: '655', p_ftu: '860',
  s_p: '10', s_r: '150.69', s_t: '1.377', s_end: 'closed', s_E: '205000', s_nu: '0.29', s_fty: '1450', s_ftu: '1520',
  l_P: '29452', l_t: '10', l_W: '36', l_e: '18', l_D: '12.2', l_d: '12', l_t2: '6', l_g: '0.5', l_ftu: '470', l_fsu: '282', l_fbru: '705', l_pftu: '1000', l_pfsu: '600',
  c_P: '29452', c_L: '600', c_K: '1', c_e: '0.6', c_kind: 'tube', c_d1: '25', c_d2: '2.5', c_d3: '2', c_E: '205000', c_fty: '355',
  fy: '', fu: '',
};
const { tab: _tab, ...EXAMPLE } = DEFAULTS;

export default function HandCalc({ fills }: { fills: Fills }) {
  return (
    <Calc
      id="hand-calcs"
      title="Hand calcs: first-cut checks"
      defaults={DEFAULTS}
      example={{ values: { ...EXAMPLE, fy: '1.1', fu: '1.25' }, note: 'Worked-example factors loaded: yield 1.10, ultimate 1.25', factorFields: ['fy', 'fu'] }}
      foot="Linear elastic, small deflection, closed-form idealisations: beam theory, Roark's plate solutions, thin-shell membrane and edge bending, first-cut lug and pin checks, Euler and Johnson columns with the secant formula. First answers, to size a part and to check a finite-element model, not a substitute for either."
    >
      <Body fills={fills} />
    </Calc>
  );
}
