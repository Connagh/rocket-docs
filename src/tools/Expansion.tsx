// Differential expansion across a temperature range: an interference or clearance fit between dissimilar parts, a bonded
// overlap, and slip across a bolt pattern. Maths in src/lib/expansion.ts (unit-tested).
import React from 'react';
import { DEFAULTS as D } from '../lib/materials';
import { EXP_MATERIALS, fitChange, fitPressure, fitStresses, fitHolding, bondedOverlap, patternSlip } from '../lib/expansion';
import { materialGroups } from './materialOptions';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, Readouts, Readout, Notes, Figure, useForm, num, fmt, HALO, type Tone } from './kit';

const M = (k: string) => EXP_MATERIALS.find((m) => m.key === k) ?? EXP_MATERIALS[0];
const GROUPS = materialGroups(EXP_MATERIALS);

function Chart({ fitAt, ta, tc, th }: { fitAt: (T: number) => number; ta: number; tc: number; th: number }) {
  const W = 420, H = 240, L = 56, R = 14, T = 16, B = 40;
  const t0 = Math.min(tc, ta) - 10, t1 = Math.max(th, ta) + 10;
  const ys = [fitAt(t0), fitAt(t1), 0];
  const y0 = Math.min(...ys), y1 = Math.max(...ys), pad = (y1 - y0) * 0.15 || 0.05;
  const lo = y0 - pad, hi = y1 + pad;
  const X = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R), Y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const step = t1 - t0 > 120 ? 40 : 20;
  const xt: number[] = []; for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) xt.push(t);
  const vstep = hi - lo > 0.4 ? 0.1 : hi - lo > 0.15 ? 0.05 : 0.02;
  const yt: number[] = []; for (let v = Math.ceil(lo / vstep) * vstep; v <= hi; v += vstep) yt.push(v);
  return (
    <Figure label="Interference or clearance of the fit against temperature" caption="The fit across the temperature range: above the line the parts are pressed together, below it they are loose.">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <rect x={L} y={T} width={W - L - R} height={Math.max(0, Y(0) - T)} fill="var(--rd-ok)" fillOpacity={0.07} />
        <rect x={L} y={Y(0)} width={W - L - R} height={Math.max(0, H - B - Y(0))} fill="var(--rd-accent)" fillOpacity={0.07} />
        {xt.map((t) => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            <text x={X(t)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{t}</text>
          </g>
        ))}
        {yt.map((v) => <text key={v} x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{fmt(v, 2)}</text>)}
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--rd-ink)" strokeOpacity={0.6} />
        <text x={L + 6} y={T + 14} fontSize={12} fill="var(--rd-ok)" {...HALO}>interference</text>
        <text x={L + 6} y={H - B - 6} fontSize={12} fill="var(--rd-accent)" {...HALO}>clearance</text>
        <line x1={X(t0)} y1={Y(fitAt(t0))} x2={X(t1)} y2={Y(fitAt(t1))} stroke="var(--rd-blue)" strokeWidth={2.4} />
        {([[tc, 'coldest'], [ta, 'assembly'], [th, 'hottest']] as const).map(([t, name]) => {
          const above = fitAt(t) < (hi + lo) / 2;
          return (
            <g key={name}>
              <circle cx={X(t)} cy={Y(fitAt(t))} r={4.5} fill={t === ta ? 'var(--rd-ink)' : fitAt(t) > 0 ? 'var(--rd-ok)' : 'var(--rd-accent)'} />
              <text x={X(t)} y={Y(fitAt(t)) + (above ? -10 : 18)} textAnchor={t === tc ? 'start' : t === th ? 'end' : 'middle'} fontSize={12} fill="var(--rd-ink)" {...HALO}>{name}</text>
            </g>
          );
        })}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">temperature (°C)</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>fit (mm)</text>
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const notes: { tone: Tone; text: string }[] = [];
  const ta = num(v.ta), tc = num(v.tc), th = num(v.th);
  const dTc = tc - ta, dTh = th - ta;

  // fit
  const mi = M(v.mi), mo = M(v.mo);
  const fp = { d: num(v.d), D: num(v.D), di: num(v.di) || 0, Eo: mo.E, nuo: mo.nu, Ei: mi.E, nui: mi.nu };
  const del0 = num(v.del), L = num(v.L) || 0, mu = num(v.mu) || 0, fy = num(v.fy);
  const fitOk = fp.d > 0 && fp.D > fp.d && fp.di < fp.d && Number.isFinite(del0);
  const fitAt = (T: number) => del0 + fitChange(fp.d, mi.alpha, mo.alpha, T - ta);
  const at = (T: number) => {
    const del = fitAt(T), p = fitPressure(del, fp);
    return { T, del, p, s: fitStresses(p, fp), hold: fitHolding(p, fp.d, L, mu) };
  };
  const fitRo = (label: string, x: ReturnType<typeof at> | null) =>
    !x ? <Readout label={label} value="—" /> : x.del > 0
      ? <Readout label={label} value={fmt(x.del, 3)} unit="mm" tone="ok" sub={`interference · p ${fmt(x.p, 2)} MPa · holds ${fmt(x.hold.force / 1000, 1)} kN`} />
      : <Readout label={label} value={fmt(-x.del, 3)} unit="mm" tone="bad" sub={`clearance: loose at ${fmt(x.T, 0)} °C`} />;
  let c = null, h = null, worst = null, ratio = NaN;
  if (fitOk) {
    c = at(tc); h = at(th);
    const a = at(ta);
    worst = [c, h, a].reduce((x, y) => (y.s.vmOuter > x.s.vmOuter ? y : x));
    ratio = worst.s.vmOuter / fy;
    for (const x of [c, h]) if (x.del <= 0) notes.push({ tone: 'bad', text: `The fit is loose at ${fmt(x.T, 0)} °C (${fmt(-x.del, 3)} mm clearance): it cannot locate or hold the part there. Pin, key or bolt it, or choose materials with matched expansion.` });
    if (ratio > 1) notes.push({ tone: 'bad', text: `The outer part yields at the tightest extreme (${fmt(worst.s.vmOuter, 0)} MPa): less interference, a thicker outer part, or a matched material.` });
    if (mi.alpha === mo.alpha) notes.push({ tone: 'info', text: 'Same expansion: the fit does not change with a uniform temperature. Transients (one part heating before the other) still do.' });
  } else notes.push({ tone: 'bad', text: 'Check the fit geometry: outer OD larger than the interface, inner bore smaller.' });

  // bond: the larger temperature excursion governs
  const m1 = M(v.m1), m2 = M(v.m2), dT = Math.abs(dTc) >= Math.abs(dTh) ? dTc : dTh;
  const b = bondedOverlap(m1.E, num(v.t1), m2.E, num(v.t2), num(v.G), num(v.ta2), num(v.Lb), m1.alpha - m2.alpha, dT);
  const tau = Math.abs(b.tauMax), str = num(v.tau);
  if (Number.isFinite(b.tauMax)) {
    if (num(v.Lb) > 3 * b.decay) notes.push({ tone: 'info', text: `The adhesive shear is concentrated within about ${fmt(3 * b.decay, 0)} mm of each end; overlap beyond that does not lower the peak. A thicker or softer bondline, tapered ends, or closer-matched parts do.` });
    if (str > 0 && tau >= str) notes.push({ tone: 'bad', text: `The bond's edge shear (${fmt(tau, 1)} MPa) reaches its strength: the ends will start to debond on the first ${dT < 0 ? 'cold soak' : 'hot soak'}.` });
  }

  // bolt pattern
  const p1 = M(v.p1), p2 = M(v.p2), R = num(v.R), cl = num(v.c);
  const slip = Math.max(patternSlip(p1.alpha, p2.alpha, dTc, R), patternSlip(p1.alpha, p2.alpha, dTh, R));
  if (slip >= cl) notes.push({ tone: 'bad', text: `The plates move ${fmt(slip, 3)} mm relative to each other: more than the hole clearance, so the outer bolts bear and are sheared on every thermal cycle. Use one fixed hole with radial slots, flexures, or matched materials.` });
  else if (slip > 0) notes.push({ tone: 'info', text: `Relative slip of ${fmt(slip, 3)} mm at the outer bolts: within the clearance, but friction under preload resists it, so the joint stores the mismatch as shear until it slips (a source of preload loss and fretting).` });

  return (
    <>
      <Readouts>
        {fitRo('Fit when coldest', c)}
        {fitRo('Fit when hottest', h)}
        <Readout label="Outer part stress" value={worst ? fmt(worst.s.vmOuter, 0) : '—'} unit={worst ? 'MPa' : undefined}
          tone={worst ? (ratio > 1 ? 'bad' : ratio > 0.67 ? 'warn' : 'ok') : undefined}
          sub={worst ? `von Mises at the bore${Number.isFinite(ratio) ? ` · ${fmt(100 * ratio, 0)}% of yield` : ''}` : undefined} />
        <Readout label="Adhesive edge shear" value={fmt(tau, 1)} unit="MPa" primary
          tone={Number.isFinite(b.tauMax) && str > 0 ? (tau >= str ? 'bad' : tau > 0.5 * str ? 'warn' : 'ok') : undefined}
          sub={Number.isFinite(b.tauMax) ? `at the ends, at ${fmt(ta + dT, 0)} °C${str > 0 ? ` · ${fmt((100 * tau) / str, 0)}% of strength` : ''}` : undefined} />
        <Readout label="Stress in the parts" value={`${fmt(b.sigma1, 0)} / ${fmt(b.sigma2, 0)}`} unit="MPa"
          sub={`part 1 / part 2, mid-overlap · decay length ${fmt(b.decay, 1)} mm`} />
        <Readout label="Bolt pattern slip" value={fmt(slip, 3)} unit="mm" tone={slip >= cl ? 'bad' : slip > 0.5 * cl ? 'warn' : 'ok'}
          sub={`against ${fmt(cl, 2)} mm hole clearance`} />
      </Readouts>
      {fitOk && th > tc ? <Chart fitAt={fitAt} ta={ta} tc={tc} th={th} /> : null}
      <Notes items={notes} />
    </>
  );
}

export default function Expansion() {
  return (
    <Calc
      id="differential-expansion"
      title="Differential expansion: fit, bond, bolt pattern"
      defaults={{
        ta: '20', tc: '-40', th: '60', mi: D.caseSteel, mo: D.aluminium, d: '310', D: '330', di: '290', del: '0.10', L: '30', mu: '0.15', fy: '500',
        m1: D.caseSteel, t1: '1.37', m2: D.cfrpLaminate, t2: '3', G: '800', ta2: '0.2', Lb: '50', tau: '', p1: D.aluminium, p2: D.caseSteel, R: '140', c: '0.5',
      }}
      foot="Uniform temperature, linear elastic, room-temperature properties. Fit: Lamé thick cylinders. Bond: one-dimensional shear lag: no peel, no edge singularity, no adhesive relaxation. Bolt pattern: slip relative to a common fixed point."
    >
      <Inputs>
        <Group legend="Temperature range">
          <FieldRow>
            <Num name="ta" label="Assembly" unit="°C" />
            <Num name="tc" label="Coldest" unit="°C" />
            <Num name="th" label="Hottest" unit="°C" />
          </FieldRow>
        </Group>
        <Group legend="Fit between two parts" hint="Negative interference is a clearance. Yield is a typical value: use your allowable at temperature.">
          <Choice name="mi" label="Inner part" groups={GROUPS} search />
          <Choice name="mo" label="Outer part" groups={GROUPS} search then={(k) => (Number.isFinite(M(k).Fy) ? { fy: String(M(k).Fy) } : undefined)} />
          <FieldRow>
            <Num name="d" label="Interface ⌀" unit="mm" />
            <Num name="D" label="Outer part OD" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="di" label="Inner part bore" unit="mm" />
            <Num name="del" label="Interference at assembly" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="L" label="Fit length" unit="mm" />
            <Num name="mu" label="Friction μ" />
          </FieldRow>
          <Num name="fy" label="Outer part yield" unit="MPa" />
        </Group>
        <Group legend="Bonded overlap">
          <Choice name="m1" label="Part 1" groups={GROUPS} search />
          <Num name="t1" label="Part 1 thickness" unit="mm" />
          <Choice name="m2" label="Part 2" groups={GROUPS} search />
          <Num name="t2" label="Part 2 thickness" unit="mm" />
          <FieldRow>
            <Num name="G" label="Adhesive shear modulus" unit="MPa" />
            <Num name="ta2" label="Bondline" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="Lb" label="Overlap" unit="mm" />
            <Num name="tau" label="Adhesive shear strength" unit="MPa" placeholder="your allowable" />
          </FieldRow>
        </Group>
        <Group legend="Bolt pattern">
          <Choice name="p1" label="Plate 1" groups={GROUPS} search />
          <Choice name="p2" label="Plate 2" groups={GROUPS} search />
          <FieldRow>
            <Num name="R" label="Distance from fixed point" unit="mm" />
            <Num name="c" label="Hole clearance, radial" unit="mm" />
          </FieldRow>
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
