// Interactive "mass in vs mass out" chart: why a solid motor settles at one chamber pressure, and why the burn-rate
// exponent n must be below 1.
import React from 'react';
import { equilibriumPressure, massIn, massOut, pressureSensitivity } from '../lib/ballistics';
import { Calc, Inputs, Outputs, Group, Range, Readouts, Readout, Note, Figure, useForm, num, type Tone } from './kit';

const W = 520, H = 340, L = 62, R = 16, T = 60, B = 44;
const f = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');

function Chart() {
  const { v } = useForm();
  const b = { rhoP: 1770, cStar: 1540, kn: num(v.kn), n: num(v.n), a: num(v.a) };
  const peq = equilibriumPressure(b);
  const pMax = Number.isFinite(peq) && peq < 40 ? Math.max(8, peq * 1.8) : 20;
  const fin = (p: number) => massIn(b, p) / 1e4; // kg/s per cm² of throat
  const fout = (p: number) => massOut(b, p) / 1e4;
  const yMax = fout(pMax) * 1.15;
  const X = (p: number) => L + (p / pMax) * (W - L - R);
  const Y = (q: number) => H - B - (Math.min(q, yMax * 1.05) / yMax) * (H - B - T);
  const N = 80;
  const ps = Array.from({ length: N + 1 }, (_, i) => (i / N) * pMax);
  const line = (fn: (p: number) => number) => ps.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)},${Y(fn(p)).toFixed(1)}`).join('');
  // Shade the gap: green where gas accumulates (pressure rises), red where it drains.
  const band = (cond: (p: number) => boolean) => {
    const sel = ps.filter(cond);
    if (sel.length < 2) return '';
    const top = sel.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)},${Y(Math.max(fin(p), fout(p))).toFixed(1)}`).join('');
    const bot = [...sel].reverse().map((p) => `L${X(p).toFixed(1)},${Y(Math.min(fin(p), fout(p))).toFixed(1)}`).join('');
    return top + bot + 'Z';
  };
  const step = pMax > 24 ? 5 : pMax > 12 ? 2 : 1;
  const ticks: number[] = [];
  for (let p = 0; p <= pMax + 1e-9; p += step) ticks.push(p);
  const stable = Number.isFinite(peq) && peq <= pMax;
  const rate = stable ? b.a * Math.pow(peq, b.n) : NaN;
  const ay = H - B - 14;

  let tone: Tone, verdict: string;
  if (b.n >= 1) {
    tone = 'bad';
    verdict = 'n ≥ 1: no stable balance. A small pressure rise makes gas faster than the throat can pass it, which raises pressure further: the motor either over-pressurises or extinguishes.';
  } else if (!stable) {
    tone = 'warn';
    verdict = 'Balance is off the chart at an unrealistically high pressure. Lower Kn or n.';
  } else if (b.n > 0.7) {
    tone = 'warn';
    verdict = `Stable, but very sensitive: any 1% change in burning area, burn rate or throat area moves pressure by ${f(pressureSensitivity(b.n), 1)}%. Real propellants are usually chosen with n around 0.3–0.5.`;
  } else {
    tone = 'ok';
    verdict = 'Stable. Left of the balance point the motor makes gas faster than it can escape, so pressure rises; right of it, gas drains faster than it is made, so pressure falls. Either way it returns to the balance point.';
  }

  return (
    <>
      <Readouts>
        <Readout label="Equilibrium pc" value={stable ? f(peq) : '—'} unit={stable ? `MPa · ${f(peq * 10, 0)} bar` : undefined} primary />
        <Readout label="Burn rate there" value={stable ? f(rate, 1) : '—'} unit={stable ? 'mm/s' : undefined} />
        <Readout label="Amplification 1/(1−n)" value={b.n < 1 ? `×${f(pressureSensitivity(b.n))}` : '∞'} />
        <Readout label="Kn +10% gives pc" value={stable ? `+${f((Math.pow(1.1, 1 / (1 - b.n)) - 1) * 100, 1)} %` : '—'} />
      </Readouts>
      <Note tone={tone}>{verdict}</Note>
      <Figure label="Mass generation and mass discharge versus chamber pressure">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.map((p) => (
            <g key={p}>
              <line x1={X(p)} x2={X(p)} y1={T} y2={H - B} stroke="var(--rd-line)" />
              <text x={X(p)} y={H - B + 16} textAnchor="middle" fontSize={11} fill="var(--rd-muted)">{p}</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--rd-muted)" />
          <line x1={L} x2={L} y1={T} y2={H - B} stroke="var(--rd-muted)" />
          <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">chamber pressure, MPa</text>
          <text x={16} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 16 ${(T + H - B) / 2})`}>mass flow, kg/s per cm² throat</text>
          <path d={band((p) => p > 0 && fin(p) >= fout(p))} fill="var(--rd-ok)" fillOpacity={0.12} />
          <path d={band((p) => p > 0 && fin(p) < fout(p))} fill="var(--rd-accent)" fillOpacity={0.1} />
          <path d={line(fout)} fill="none" stroke="var(--rd-blue)" strokeWidth={2.5} />
          <path d={line(fin)} fill="none" stroke="var(--rd-hot)" strokeWidth={2.5} />
          {stable ? (
            <>
              <line x1={X(peq)} x2={X(peq)} y1={Y(fout(peq))} y2={H - B} stroke="var(--rd-ink)" strokeDasharray="4 4" />
              <circle cx={X(peq)} cy={Y(fout(peq))} r={6} fill="var(--rd-panel)" stroke="var(--rd-ink)" strokeWidth={2.5} />
              <text x={X(peq) + 10} y={Y(fout(peq)) - 10} fontSize={12} fill="var(--rd-ink)">{`balance ${peq.toFixed(1)} MPa`}</text>
              <path d={`M${Math.max(L + 4, X(peq * 0.45))},${ay} L${X(peq) - 10},${ay} m-7,-5 l7,5 l-7,5`} stroke="var(--rd-ok)" fill="none" strokeWidth={2} />
              <path d={`M${Math.min(W - R - 4, X(peq * 1.5))},${ay} L${X(peq) + 10},${ay} m7,-5 l-7,5 l7,5`} stroke="var(--rd-ok)" fill="none" strokeWidth={2} />
            </>
          ) : null}
          <g fontSize={12}>
            <line x1={70} y1={22} x2={92} y2={22} stroke="var(--rd-hot)" strokeWidth={2.5} />
            <text x={98} y={26} fill="var(--rd-ink)">gas made by burning  ∝ pⁿ</text>
            <line x1={70} y1={42} x2={92} y2={42} stroke="var(--rd-blue)" strokeWidth={2.5} />
            <text x={98} y={46} fill="var(--rd-ink)">gas leaving the throat  ∝ p</text>
          </g>
        </svg>
      </Figure>
    </>
  );
}

export default function PressureEquilibrium() {
  return (
    <Calc
      id="pressure-balance"
      title="Chamber pressure balance (0-D model, AP/HTPB-like values)"
      defaults={{ kn: '250', n: '0.35', a: '4.05' }}
      foot="Drag n towards 1 and watch the two curves become parallel: the balance point runs away to very high pressure, and any disturbance is amplified instead of corrected."
    >
      <Inputs>
        <Group legend="Motor" hint="Held fixed: propellant density 1770 kg/m³, c* 1540 m/s. Burn rate r = a·pⁿ with p in MPa.">
          <Range name="kn" label="Kn = burning area ÷ throat area" min={80} max={600} step={5} />
          <Range name="n" label="Pressure exponent n" min={0.1} max={1.2} step={0.01} />
          <Range name="a" label="Burn-rate coefficient a" unit="mm/s at 1 MPa" min={1.5} max={10} step={0.05} />
        </Group>
      </Inputs>
      <Outputs>
        <Chart />
      </Outputs>
    </Calc>
  );
}
