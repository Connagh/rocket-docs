// A motor's load path at MEOP: pressure end loads, thrust, nozzle and closure loads, acceleration and the load passed
// to the payload through the forward skirt, the skirt's running load and the attach-ring bolt loads under bending.
// Maths in src/lib/loadpath.ts (unit-tested).
import React from 'react';
import { pressureLoads, flightLoads, bondInertiaShear, lineLoad, ringBoltLoads } from '../lib/loadpath';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Readouts, Readout, Notes, Figure, A, useForm, num, fmt, HALO, type Tone } from './kit';

const kN = (v: number) => fmt(v / 1000, Math.abs(v) < 10000 ? 2 : Math.abs(v) < 100000 ? 1 : 0);
type Ring = ReturnType<typeof ringBoltLoads>;

function Chart({ I, B: Bo, Z }: { I: Ring; B: Ring; Z: Ring }) {
  const W = 420, H = 250, L = 50, R = 20, T = 34, B = 40;
  const n = I.each.length, all = [I, Bo, Z].flatMap((x) => [x.maxTension, -x.maxCompression]).map((v) => v / 1000);
  const span = Math.max(...all.map(Math.abs)) * 1.15 || 1;
  const X = (deg: number) => L + (deg / 360) * (W - L - R), Y = (v: number) => T + ((span - v) / (2 * span)) * (H - T - B);
  const step = span > 6 ? 2 : span > 3 ? 1 : span > 1.2 ? 0.5 : 0.2;
  const yt: number[] = []; for (let v = -Math.floor(span / step) * step; v <= span; v += step) yt.push(v);
  const series: [Ring, string, string, string][] = [[Z, 'var(--rd-muted)', 'no thrust', '5 4'], [I, 'var(--rd-accent)', 'ignition', ''], [Bo, 'var(--rd-blue)', 'burnout', '']];
  return (
    <Figure
      label="Load in each attach bolt around the bolt circle, at ignition, at burnout and with no thrust"
      caption="Load in each attach bolt around the circle. Bending adds tension on one side and compression on the other; the thrust pushing the payload shifts the whole curve towards compression."
    >
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <rect x={L} y={T} width={W - L - R} height={Y(0) - T} fill="var(--rd-accent)" fillOpacity={0.06} />
        <rect x={L} y={Y(0)} width={W - L - R} height={H - B - Y(0)} fill="var(--rd-blue)" fillOpacity={0.06} />
        {[0, 90, 180, 270, 360].map((deg) => (
          <g key={deg}>
            <line x1={X(deg)} x2={X(deg)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            <text x={X(deg)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{`${deg}°`}</text>
          </g>
        ))}
        {yt.map((v) => <text key={v} x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{fmt(v, step < 1 ? 1 : 0)}</text>)}
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--rd-ink)" strokeOpacity={0.6} />
        <text x={W - R - 4} y={T + 14} textAnchor="end" fontSize={12} fill="var(--rd-accent)" {...HALO}>tension</text>
        <text x={W - R - 4} y={H - B - 6} textAnchor="end" fontSize={12} fill="var(--rd-blue)" {...HALO}>compression</text>
        {series.map(([ring, color, name, dash], s) => {
          const amp = ring.bend / 1000, mid = -ring.axial / 1000;
          const pts = Array.from({ length: 73 }, (_, i) => `${X(i * 5).toFixed(1)},${Y(mid + amp * Math.cos((i * 5 * Math.PI) / 180)).toFixed(1)}`).join(' ');
          const lx = 8 + series.slice(0, s).reduce((x, [, , nm]) => x + 37 + nm.length * 7.2, 0);
          return (
            <g key={name}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeDasharray={dash || undefined} />
              {s > 0 ? ring.each.map((v, i) => <circle key={i} cx={X((360 * i) / n)} cy={Y(v / 1000)} r={3} fill={color} />) : null}
              <line x1={lx} x2={lx + 18} y1={14} y2={14} stroke={color} strokeWidth={2} strokeDasharray={dash ? '4 3' : undefined} />
              <text x={lx + 23} y={18} fontSize={12} fill="var(--rd-ink)">{name}</text>
            </g>
          );
        })}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">position round the bolt circle</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>bolt load (kN)</text>
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const p = num(v.p), D = num(v.D), dt = num(v.dt), cf = num(v.cf), dn = num(v.dn), ds = num(v.ds), nc = Math.round(num(v.nc));
  const m0 = num(v.m0), m1 = num(v.m1), ma = num(v.ma), lg = num(v.lg);
  const M = num(v.M) * 1e6, dk = num(v.dk), tk = num(v.tk), nb = Math.round(num(v.nb)), db = num(v.db);
  const ok = [p, D, dt, cf, dn, ds, m0, m1, ma, lg, M, dk, tk, db].every(Number.isFinite) && nc >= 1 && nb >= 3 && m0 + ma > 0 && m1 + ma > 0;
  if (!ok) return <Notes items={[{ tone: 'bad', text: 'Enter every value: masses and diameters above zero, at least three attach bolts.' }]} />;

  const pl = pressureLoads(p, D, cf, dt, dn, ds);
  const ig = flightLoads(pl.F, m0, ma), bo = flightLoads(pl.F, m1, ma);
  const lI = lineLoad(ig.skirt, M, dk), lB = lineLoad(bo.skirt, M, dk), l0 = lineLoad(0, M, dk);
  const comp = Math.max(lI.maxComp, lB.maxComp), tens = Math.max(lI.maxTens, lB.maxTens);
  const bI = ringBoltLoads(ig.skirt, M, nb, db), bB = ringBoltLoads(bo.skirt, M, nb, db), b0 = ringBoltLoads(0, M, nb, db);
  const peakT = Math.max(bI.maxTension, bB.maxTension), when = bI.maxTension >= bB.maxTension ? 'ignition' : 'burnout';
  const tau = bondInertiaShear(m0 - m1, ig.a, D, lg);

  const notes: { tone: Tone; text: React.ReactNode }[] = [];
  notes.push({ tone: 'info', text: `The pressure end load is ${fmt(pl.ratio, 0)} times the thrust, but it closes inside the case. The closures, their joints and the case wall carry it. The attachments to the vehicle never carry it.` });
  if (pl.closureStatic > pl.closureFiring) notes.push({ tone: 'info', text: `A static pressure test loads the aft closure with the full ${kN(pl.closureStatic)} kN: no flow, so no thrust to relieve it. Size the closure joint for the test as well as for firing.` });
  if (bo.skirt > ig.skirt) notes.push({ tone: 'info', text: `The forward skirt load rises from ${kN(ig.skirt)} kN at ignition to ${kN(bo.skirt)} kN at burnout: as the propellant burns away, the same thrust pushes less motor and more payload.` });
  notes.push({ tone: 'info', text: <>Bending with no thrust (coast, handling, or before ignition) puts {kN(b0.maxTension)} kN into the most loaded bolt. Take the largest bolt tension of all load cases to <A href="../bolted-joints/">Bolted joints</A> as the external load per bolt.</> });
  if (l0.maxComp > 0) notes.push({ tone: 'info', text: <>The skirt's peak running load in compression goes to the <A href="../../verify/shell-buckling/">shell-buckling</A> check wherever the skirt or case is unpressurised.</> });
  if (m1 > m0) notes.push({ tone: 'bad', text: 'The burnout mass is larger than the ignition mass: check the masses.' });

  return (
    <>
      <Readouts>
        <Readout label="Pressure end load" value={kN(pl.fwd)} unit="kN" primary sub={`on the forward dome · ${fmt(pl.ratio, 0)}× the thrust`} />
        <Readout label="Thrust" value={kN(pl.F)} unit="kN" sub={`CF·p·At · the aft end is pushed back by ${kN(pl.aft)} kN`} />
        <Readout label="Nozzle load" value={kN(Math.abs(pl.nozzle))} unit="kN"
          sub={pl.nozzle >= 0 ? 'pushing the nozzle off its attachment' : 'pulling the nozzle into the motor: thrust exceeds the pressure over its attachment'} />
        <Readout label="Aft closure" value={kN(pl.closureStatic)} unit="kN"
          sub={`in a static pressure test, ${kN(pl.closureStatic / nc)} kN per bolt · ${kN(pl.closureFiring)} kN firing, ${kN(pl.closureFiring / nc)} kN per bolt`} />
        <Readout label="Acceleration" value={fmt(bo.g, 1)} unit="g" sub={`at burnout · ${fmt(ig.g, 1)} g at ignition`} />
        <Readout label="Through the forward skirt" value={kN(bo.skirt)} unit="kN"
          sub={`at burnout · ${kN(ig.skirt)} kN at ignition · the motor's own inertia takes the rest: ${kN(bo.motor)} and ${kN(ig.motor)} kN`} />
        <Readout label="Skirt running load" value={fmt(comp, 1)} unit="N/mm"
          sub={`peak compression · ${fmt(comp / tk, 0)} MPa in the wall · tension side ${tens > 0 ? `${fmt(tens, 1)} N/mm` : 'stays in compression'}`} />
        <Readout label="Attach-bolt load" value={peakT > 0 ? kN(peakT) : 'in compression'} unit={peakT > 0 ? 'kN' : undefined} primary
          sub={peakT > 0
            ? `peak tension, at ${when} · ${kN(b0.maxTension)} kN with no thrust · ${kN(Math.max(bI.maxCompression, bB.maxCompression))} kN peak compression`
            : `the thrust holds every bolt's share in compression · ${kN(b0.maxTension)} kN with no thrust`} />
        <Readout label="Grain bond shear" value={fmt(tau * 1000, 1)} unit="kPa" sub="mean, from the grain's inertia at ignition" />
      </Readouts>
      <Chart I={bI} B={bB} Z={b0} />
      <Notes items={notes} />
    </>
  );
}

export default function LoadPath() {
  return (
    <Calc
      id="load-path"
      title="Motor load path: pressure, thrust, skirt, attach ring"
      defaults={{ p: '10', D: '300', dt: '50', cf: '1.5', dn: '110', ds: '260', nc: '30', m0: '137.81', m1: '26.61', ma: '50', lg: '1000', M: '3', dk: '301.4', tk: '2', nb: '16', db: '280' }}
      foot="Rigid-body flight loads from thrust alone. Pressure end loads over the stated diameters; the nozzle attach plane at chamber pressure. Skirt: thin cylinder, beam bending. Attach ring: equally spaced bolts, neutral axis at the centre, joint closed."
    >
      <Inputs>
        <Group legend="Pressure and thrust" hint={<>MEOP gives the largest loads. C<sub>F</sub> is the value at the altitude you are checking.</>}>
          <FieldRow>
            <Num name="p" label="Chamber pressure" unit="MPa" />
            <Num name="D" label="Case bore ⌀" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="dt" label="Throat ⌀" unit="mm" />
            <Num name="cf" label="Thrust coefficient CF" />
          </FieldRow>
          <FieldRow>
            <Num name="dn" label="Nozzle attach seal ⌀" unit="mm" />
            <Num name="ds" label="Aft closure seal ⌀" unit="mm" />
          </FieldRow>
          <Num name="nc" label="Closure bolts" />
        </Group>
        <Group legend="Masses" hint="Mass ahead of the skirt is everything the motor pushes through it: payload, upper stages. Thrust alone: no drag or weight.">
          <FieldRow>
            <Num name="m0" label="Motor at ignition" unit="kg" />
            <Num name="m1" label="Motor at burnout" unit="kg" />
          </FieldRow>
          <FieldRow>
            <Num name="ma" label="Mass ahead of the skirt" unit="kg" />
            <Num name="lg" label="Grain bond length" unit="mm" />
          </FieldRow>
        </Group>
        <Group legend="Skirt and attach ring" hint="The bending moment at the joint comes from your vehicle loads analysis. Bolt loads assume the joint stays closed.">
          <FieldRow>
            <Num name="M" label="Bending moment" unit="kN·m" />
            <Num name="dk" label="Skirt mean ⌀" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="tk" label="Skirt wall" unit="mm" />
            <Num name="nb" label="Attach bolts" />
          </FieldRow>
          <Num name="db" label="Bolt circle ⌀" unit="mm" />
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
