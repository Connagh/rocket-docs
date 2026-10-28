// Two parallel load paths joining the same two points: how they share an applied load by stiffness, what a gap does,
// the force a mismatch sets up between them, where the joint first fails and whether the survivor holds.
// Maths in src/lib/loadpath.ts (unit-tested).
import React from 'react';
import { shareLoad, mismatchForce, firstFailure, type Path } from '../lib/loadpath';
import { readFactor, awaitingMessage } from '../lib/factors';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Readouts, Readout, Notes, Figure, useForm, num, fmt, HALO, niceStep, ticks, type Tone } from './kit';

const kN = (v: number) => fmt(v / 1000, Math.abs(v) < 10000 ? 2 : 1);
const sgn = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v, 2)}`;
const sense = (v: number) => (Math.abs(v) < 0.5 ? 'carries nothing' : v > 0 ? 'tension' : 'compression');

function Chart({ p1, p2, d, uOp, P }: { p1: Path; p2: Path; d: number; uOp: number; P: number }) {
  const W = 420, H = 260, L = 56, R = 20, T = 30, B = 40;
  const marks = [0, d, uOp, d + (p1.gap ?? 0), -(p2.gap ?? 0), p2.gap ?? 0];
  let u0 = Math.min(...marks), u1 = Math.max(...marks);
  if (u1 - u0 < 1e-6) { u0 = -1; u1 = 1; }
  const pad = 0.2 * (u1 - u0); u0 -= pad; u1 += pad;
  const N = 160, us = Array.from({ length: N + 1 }, (_, i) => u0 + ((u1 - u0) * i) / N);
  const F1 = (u: number) => p1.k * Math.sign(u - d) * Math.max(0, Math.abs(u - d) - (p1.gap ?? 0));
  const F2 = (u: number) => p2.k * Math.sign(u) * Math.max(0, Math.abs(u) - (p2.gap ?? 0));
  const ys = us.flatMap((u) => [F1(u), F2(u), F1(u) + F2(u)]).concat([P, ...(p1.cap ? [p1.cap, -p1.cap] : []), ...(p2.cap ? [p2.cap, -p2.cap] : [])]).map((v) => v / 1000);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const yp = 0.08 * (hi - lo || 1); lo -= yp; hi += yp;
  const X = (u: number) => L + ((u - u0) / (u1 - u0)) * (W - L - R), Y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const ux = niceStep(u1 - u0), vy = niceStep(hi - lo);
  const line = (fn: (u: number) => number) => us.map((u) => `${X(u).toFixed(1)},${Y(fn(u) / 1000).toFixed(1)}`).join(' ');
  const right = X(uOp) > (L + W) / 2;
  return (
    <Figure
      label="Force in each path and in total against the displacement of the joint"
      caption="Force in each path against the joint's displacement. The paths share one displacement, so the stiffer line takes more of any load; a gap is a flat start; a mismatch shifts path 1 sideways, so both carry force at zero applied load."
    >
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {ticks(u0, u1, ux).map((u) => (
          <g key={u}>
            <line x1={X(u)} x2={X(u)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            <text x={X(u)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{fmt(u, ux < 0.1 ? 2 : ux < 1 ? 1 : 0)}</text>
          </g>
        ))}
        {ticks(lo, hi, vy).map((v) => <text key={v} x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{fmt(v, vy < 1 ? 1 : 0)}</text>)}
        {lo < 0 && hi > 0 ? <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--rd-ink)" strokeOpacity={0.6} /> : null}
        {([[p1.cap, 'var(--rd-blue)'], [p2.cap, 'var(--rd-accent)']] as const).flatMap(([cap, color]) =>
          cap ? [cap, -cap].filter((x) => x / 1000 > lo && x / 1000 < hi).map((x) => (
            <line key={`${color}${x}`} x1={L} x2={W - R} y1={Y(x / 1000)} y2={Y(x / 1000)} stroke={color} strokeDasharray="2 4" strokeWidth={1.4} />
          )) : [])}
        {P !== 0 ? <line x1={L} x2={W - R} y1={Y(P / 1000)} y2={Y(P / 1000)} stroke="var(--rd-muted)" strokeDasharray="6 4" /> : null}
        <polyline points={line((u) => F1(u) + F2(u))} fill="none" stroke="var(--rd-ink)" strokeWidth={1.6} strokeDasharray="6 3" />
        <polyline points={line(F1)} fill="none" stroke="var(--rd-blue)" strokeWidth={2.4} />
        <polyline points={line(F2)} fill="none" stroke="var(--rd-accent)" strokeWidth={2.4} />
        <line x1={X(uOp)} x2={X(uOp)} y1={T} y2={H - B} stroke="var(--rd-ink)" strokeOpacity={0.35} />
        {([[F1(uOp), 'var(--rd-blue)'], [F2(uOp), 'var(--rd-accent)'], [P, 'var(--rd-ink)']] as const).map(([val, color]) => (
          <circle key={color} cx={X(uOp)} cy={Y(val / 1000)} r={4.5} fill={color} stroke="var(--rd-panel)" strokeWidth={1.5} />
        ))}
        {([['path 1', 'var(--rd-blue)', ''], ['path 2', 'var(--rd-accent)', ''], ['total', 'var(--rd-ink)', '4 3']] as const).map(([name, color, dash], i) => {
          const lx = L + i * Math.min(96, (W - L - R) / 3);
          return (
            <g key={name}>
              <line x1={lx} x2={lx + 18} y1={13} y2={13} stroke={color} strokeWidth={2.2} strokeDasharray={dash || undefined} />
              <text x={lx + 23} y={17} fontSize={12} fill="var(--rd-ink)">{name}</text>
            </g>
          );
        })}
        <text x={X(uOp) + (right ? -6 : 6)} y={T + 13} textAnchor={right ? 'end' : 'start'} fontSize={12} fill="var(--rd-ink)" {...HALO}>operating point</text>
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">joint displacement (mm)</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>force (kN)</text>
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const notes: { tone: Tone; text: string }[] = [];
  const k1 = num(v.k1) * 1000, k2 = num(v.k2) * 1000, P = (num(v.P) || 0) * 1000, d = num(v.d) || 0;
  const c1 = num(v.c1) * 1000, c2 = num(v.c2) * 1000, fu = readFactor(v.fu);
  if (!(k1 > 0 && k2 > 0)) return <Notes items={[{ tone: 'bad', text: 'Enter both stiffnesses, above zero.' }]} />;
  const p1: Path = { k: k1, gap: num(v.g1) || 0, cap: c1 > 0 ? c1 : undefined };
  const p2: Path = { k: k2, gap: num(v.g2) || 0, cap: c2 > 0 ? c2 : undefined };
  const s = shareLoad(P, p1, p2, d), s0 = shareLoad(0, p1, p2, d);
  const pathRo = (label: string, f: number, cap?: number) => {
    const use = cap ? Math.abs(f) / cap : NaN;
    return (
      <Readout label={label} primary value={Math.abs(f) < 0.5 ? '0' : `${f > 0 ? '+' : '−'}${kN(Math.abs(f))}`} unit="kN"
        tone={cap ? (use >= 1 ? 'bad' : use > 0.8 ? 'warn' : 'ok') : undefined}
        sub={`${sense(f)}${cap ? ` · ${fmt(100 * use, 0)}% of capacity` : ''}`} />
    );
  };
  const fm = mismatchForce(d, p1, p2);
  const sh1 = P !== 0 ? (s.f1 - s0.f1) / P : k1 / (k1 + k2);

  // first failure and the survivor
  const ff = firstFailure(P === 0 ? 1 : P, p1, p2, d);
  const sumCap = (p1.cap ?? 0) + (p2.cap ?? 0);
  let ffRo: React.ReactNode;
  if (!p1.cap && !p2.cap) ffRo = <Readout label="First failure" value="enter a capacity" sub="for either path" />;
  else if (ff.load === 0) ffRo = <Readout label="First failure" value={`path ${ff.path}, at no applied load`} tone="bad" sub="the mismatch alone exceeds its capacity" />;
  else if (!Number.isFinite(ff.load)) ffRo = <Readout label="First failure" value="none found" tone="ok" sub="neither path reaches its capacity" />;
  else ffRo = (
    <Readout label="First failure" value={`path ${ff.path}, at ${kN(Math.abs(ff.load))} kN applied`} tone={Math.abs(ff.load) > Math.abs(P) ? 'ok' : 'bad'}
      sub={`${ff.load < 0 ? 'compression' : 'tension'} · ${p1.cap && p2.cap ? `not the ${kN(sumCap)} kN sum of the capacities` : 'the other path has no capacity entered'}`} />
  );

  let msRo: React.ReactNode;
  if (fu === null) msRo = <Readout label="Margin" value="needs your factor" sub={awaitingMessage(['ultimate factor'], 'the margin')} />;
  else if (!p1.cap && !p2.cap) msRo = <Readout label="Margin" value="—" sub="enter a capacity for either path" />;
  else {
    const ms = ([[s.f1, p1.cap, 1], [s.f2, p2.cap, 2]] as const).filter(([f, c]) => c && Math.abs(f) > 0.5)
      .map(([f, c, i]) => [(c as number) / (fu * Math.abs(f)) - 1, i] as const).sort((a, b) => a[0] - b[0]);
    msRo = !ms.length
      ? <Readout label="Margin" value="no load" tone="ok" sub="the paths with a capacity carry nothing" />
      : <Readout label="Margin" value={`MS ${sgn(ms[0][0])}`} tone={ms[0][0] < 0 ? 'bad' : 'ok'} sub={`path ${ms[0][1]}, ${fmt(fu, 2)} × its force against its capacity`} />;
  }

  let fsRo: React.ReactNode = <Readout label="If the first path fails" value="—" sub="needs an applied load and a capacity" />;
  if (Number.isFinite(ff.load) && ff.path && P !== 0) {
    const other = ff.path === 1 ? p2 : p1, n = ff.path === 1 ? 2 : 1;
    if (other.cap) {
      const use = Math.abs(P) / other.cap;
      fsRo = <Readout label="If the first path fails" value={`path ${n} alone: ${fmt(100 * use, 0)}%`} tone={use >= 1 ? 'bad' : 'ok'} sub={`of its capacity, carrying all ${kN(Math.abs(P))} kN`} />;
    } else fsRo = <Readout label="If the first path fails" value={`path ${n} alone`} sub="enter its capacity to check it" />;
  }

  if (d !== 0 && fm >= 0.5) notes.push({ tone: 'warn', text: `A ${fmt(Math.abs(d), 2)} mm mismatch forces ${kN(fm)} kN through both paths before any load is applied. Fix one end and let the other slide (a gap larger than the mismatch) or make one path compliant.` });
  if (d !== 0 && fm < 0.5) notes.push({ tone: 'ok', text: 'The gaps are larger than the mismatch: the paths no longer fight each other. A sliding end still has to carry the loads across it (radial and shear) and stay seated.' });
  if (P !== 0 && Math.abs(sh1 - 0.5) > 0.15) notes.push({ tone: 'info', text: `The stiffer path takes ${fmt(100 * Math.max(sh1, 1 - sh1), 0)}% of the applied load: load goes where the stiffness is, not where it was intended.` });
  if ((p1.gap ?? 0) > 0 || (p2.gap ?? 0) > 0) notes.push({ tone: 'info', text: 'A path with a gap carries nothing until the joint has moved through it. In a bolted shear joint with clearance holes, the first bolt to bear takes the load; in a bonded and bolted joint, the bond fails before the bolts engage.' });
  if (p1.cap && p2.cap && Number.isFinite(ff.load) && ff.load !== 0) notes.push({ tone: 'info', text: `Capacities do not add: the joint fails when its first path does, at ${kN(Math.abs(ff.load))} kN, then the other must carry everything alone.` });

  return (
    <>
      <Readouts>
        {pathRo('Path 1 carries', s.f1, p1.cap)}
        {pathRo('Path 2 carries', s.f2, p2.cap)}
        <Readout label="From the mismatch alone" value={d === 0 ? 'none' : kN(fm)} unit={d === 0 ? undefined : 'kN'}
          sub={d === 0 ? 'no mismatch entered' : fm < 0.5 ? 'the gaps take up the mismatch' : 'in both paths, equal and opposite, with no applied load'} />
        <Readout label="Applied-load split" value={`${fmt(100 * sh1, 0)}% / ${fmt(100 * (1 - sh1), 0)}%`}
          sub={P !== 0 ? 'of the applied load, path 1 / path 2' : 'of any applied load, while both paths are engaged'} />
        {ffRo}
        {msRo}
        {fsRo}
      </Readouts>
      <Chart p1={p1} p2={p2} d={d} uOp={s.u} P={P} />
      <Notes items={notes} />
    </>
  );
}

export default function LoadShare() {
  return (
    <Calc
      id="load-share"
      title="Two load paths: stiffness, gap, mismatch"
      defaults={{ k1: '267.3', g1: '0', c1: '', k2: '148.7', g2: '0', c2: '', P: '0', d: '1.80', fu: '' }}
      example={{
        values: { k1: '267.3', g1: '0', c1: '', k2: '148.7', g2: '0', c2: '120', P: '0', d: '1.80', fu: '1.25' },
        note: 'Worked-example values loaded: aft attachment capacity 120 kN, ultimate factor 1.25',
        factorFields: ['fu', 'c2'],
      }}
      foot="Two linear-elastic paths in parallel between the same two points, each with an optional gap; a path fails at its capacity and carries nothing after. No yielding, no load redistribution before failure."
    >
      <Inputs>
        <Group legend="Path 1">
          <FieldRow>
            <Num name="k1" label="Stiffness" unit="kN/mm" />
            <Num name="g1" label="Gap" unit="mm" />
            <Num name="c1" label="Capacity" unit="kN" placeholder="your allowable" />
          </FieldRow>
        </Group>
        <Group legend="Path 2" hint="A tube: k = E·π·D·t/L. A gap is free movement either way before the path takes load: hole clearance, a slip joint.">
          <FieldRow>
            <Num name="k2" label="Stiffness" unit="kN/mm" />
            <Num name="g2" label="Gap" unit="mm" />
            <Num name="c2" label="Capacity" unit="kN" placeholder="your allowable" />
          </FieldRow>
        </Group>
        <Group legend="Load" hint="The mismatch is how much longer path 1 would be than path 2 with nothing joining them: pressure growth, thermal expansion, a tolerance.">
          <FieldRow>
            <Num name="P" label="Applied load" unit="kN, tension +" />
            <Num name="d" label="Path 1 longer by" unit="mm" />
          </FieldRow>
        </Group>
        <Group
          legend="Your programme's factor"
          hint="Applied here to each path's force at the operating point, mismatch included. If your programme treats pressure-growth or thermal loads differently, enter them accordingly."
        >
          <Num name="fu" label="Ultimate factor" placeholder="your value" />
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
