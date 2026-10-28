// Bolted joint: torque → preload with its scatter, stiffness and load factor, separation, yield and ultimate margins,
// tightening stress, temperature change, and the joint diagram. Maths in src/lib/bolts.ts (unit-tested).
import React from 'react';
import { DEFAULTS as D } from '../lib/materials';
import { THREADS, GRADES, MATERIALS, torquePreload, boltStiffness, memberStiffness, loadFactor, jointState, thermalPreload, tighteningStress, boltMargins } from '../lib/bolts';
import { readFactor, awaitingMessage } from '../lib/factors';
import { materialGroups } from './materialOptions';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, Readouts, Readout, Notes, Figure, A, useForm, num, fmt, HALO, type Tone } from './kit';

const kN = (v: number) => fmt(v / 1000, v < 10000 ? 2 : 1);
const sgn = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v, 2)}`;
const BOLT_GROUPS = materialGroups(MATERIALS.filter((m) => m.family !== 'al' && m.family !== 'mg'));
const ALL_GROUPS = materialGroups(MATERIALS);

function Chart({ F, range, kb, km, P }: { F: number; range: [number, number] | null; kb: number; km: number; P: number }) {
  const W = 420, H = 280, L = 52, R = 14, T = 16, B = 40;
  const db = F / kb, dm = F / km, s = jointState(F, P, kb / (kb + km));
  const xmax = (db + dm) * 1.12, fmax = Math.max(F, s.bolt, range ? range[1] : 0) * 1.25;
  const X = (x: number) => L + (x / xmax) * (W - L - R), Y = (y: number) => H - B - (y / fmax) * (H - T - B);
  const raw = fmax / 4000, mag = 10 ** Math.floor(Math.log10(raw)), step = ([1, 2, 5, 10].find((k) => k * mag >= raw) ?? 10) * mag * 1000;
  const yt: number[] = []; for (let v = 0; v <= fmax; v += step) yt.push(v);
  const xb = Math.min(xmax, (fmax * 0.95) / kb);
  const ang = (-Math.atan2(Y(0) - Y(kb * db), X(db) - X(0)) * 180) / Math.PI;
  const bx = X(db * 0.45), by = Y(kb * db * 0.45) - 10;
  let ext: React.ReactNode = null;
  if (P > 0) {
    const xs = s.separated ? db + dm : db + P / (kb + km), top = s.separated ? P : s.bolt, bot = s.separated ? 0 : s.clamp;
    const label = `P ${fmt(P / 1000, 1)} kN${s.separated ? ': open' : ''}`, fits = X(xs) + 6 + label.length * 7.3 < W - R;
    ext = (
      <>
        <line x1={X(xs)} x2={X(xs)} y1={Y(top)} y2={Y(bot)} stroke="var(--rd-ok)" strokeWidth={3} />
        <text x={X(xs) + (fits ? 6 : -6)} y={(Y(top) + Y(bot)) / 2 + 4} textAnchor={fits ? 'start' : 'end'} fontSize={12} fill="var(--rd-ok)" {...HALO}>{label}</text>
      </>
    );
  }
  return (
    <Figure
      label="Joint diagram: bolt and clamped-member force against deflection"
      caption="Joint diagram. The bolt stretches and the members compress under the same preload; an external load P raises the bolt force by only ΦP and takes the rest out of the clamp force. When the clamp force reaches zero the joint opens."
    >
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--rd-line)" />
            <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{fmt(v / 1000, 0)}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">bolt stretch → ← member squeeze</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>force (kN)</text>
        {range ? <rect x={L} y={Y(range[1])} width={W - L - R} height={Y(range[0]) - Y(range[1])} fill="var(--rd-warn)" fillOpacity={0.08} /> : null}
        <line x1={X(0)} y1={Y(0)} x2={X(xb)} y2={Y(kb * xb)} stroke="var(--rd-accent)" strokeWidth={2.2} />
        <line x1={X(db - (fmax * 0.95 - F) / km)} y1={Y(fmax * 0.95)} x2={X(db + dm)} y2={Y(0)} stroke="var(--rd-blue)" strokeWidth={2.2} />
        <circle cx={X(db)} cy={Y(F)} r={4} fill="var(--rd-ink)" />
        <text x={X(db) - 8} y={Y(F) - 8} textAnchor="end" fontSize={12} fill="var(--rd-ink)" {...HALO}>{`preload ${fmt(F / 1000, 1)} kN`}</text>
        <text x={bx} y={by} textAnchor="middle" fontSize={12} fill="var(--rd-accent)" {...HALO} transform={`rotate(${ang} ${bx} ${by})`}>bolt</text>
        <text x={X(db + dm) - 8} y={Y(fmax * 0.1)} textAnchor="end" fontSize={12} fill="var(--rd-blue)" {...HALO}>members</text>
        {ext}
      </svg>
    </Figure>
  );
}

function Results() {
  const { v } = useForm();
  const notes: { tone: Tone; text: React.ReactNode }[] = [];
  const t = THREADS.find((x) => x.name === v.th) ?? THREADS[0];
  const bm = MATERIALS.find((m) => m.key === v.bm) ?? MATERIALS[0], mm = MATERIALS.find((m) => m.key === v.mm) ?? MATERIALS[0];
  const Rp = num(v.rp), Rm = num(v.rm), lg = num(v.lg), dw = num(v.dw), dh = num(v.dh);
  const ok = [Rp, Rm, lg, dw, dh, num(v.tq), num(v.mut), num(v.muh)].every((x) => x > 0) && dw > t.d;
  if (!ok) return <Notes items={[{ tone: 'bad', text: 'Fill in the bolt, joint and tightening values; the bearing face must be larger than the thread.' }]} />;

  // preload and its range
  const tp = torquePreload(num(v.tq) * 1000, t, num(v.mut), num(v.muh), dw, dh);
  const gam = v.gam.trim() === '' ? null : Math.min(0.8, Math.max(0, num(v.gam) / 100));
  const loss = Math.max(0, num(v.loss) || 0) / 100;
  const kb = boltStiffness(t, bm.E, lg, num(v.ls) || 0), km = memberStiffness(t.d, dw, lg, mm.E), phi = loadFactor(kb, km);
  const dCold = thermalPreload(num(v.tmin) || 0, mm.alpha, bm.alpha, lg, kb, km), dHot = thermalPreload(num(v.tmax) || 0, mm.alpha, bm.alpha, lg, kb, km);
  const g = gam ?? 0;
  const Fmin = tp.F * (1 - g) * (1 - loss) + Math.min(0, dCold, dHot), Fmax = tp.F * (1 + g) + Math.max(0, dCold, dHot);

  // load per bolt
  const closure = num(v.pr) * Math.PI * (num(v.sd) / 2) ** 2, nb = Math.max(1, Math.round(num(v.nb) || 1));
  const P = (Number.isFinite(closure) ? closure / nb : 0) + (num(v.px) || 0) * 1000;

  // margins
  const fsSep = readFactor(v.fsep), fy = readFactor(v.fy), fu = readFactor(v.fu), sp = readFactor(v.fsp) ?? 1;
  const m = gam === null ? { sep: null, yield: null, ult: null } : boltMargins({ Fmin, Fmax, P, phi, As: t.As, Rp, Rm, fsSep, fsYield: fy, fsUlt: fu, special: sp });
  const msRo = (label: string, x: number | null, sub: string) =>
    x === null ? <Readout label={label} value="needs your factor" /> : <Readout label={label} value={sgn(x)} tone={x < 0 ? 'bad' : 'ok'} sub={sub} />;
  const missing = [gam === null && 'preload scatter', fsSep === null && 'separation factor', fy === null && 'yield factor', fu === null && 'ultimate factor'].filter(Boolean) as string[];
  if (missing.length) notes.push({ tone: 'warn', text: awaitingMessage(missing, 'the margins') });
  if (m.sep !== null && m.sep < 0) notes.push({ tone: 'bad', text: <>The joint opens below the factored load (separation MS {sgn(m.sep)}). On a pressure closure that is a leak path: the seal gland opens; see <A href="../../seals/o-ring-design/">O-ring design</A>.</> });
  for (const [name, x] of [['yield', m.yield], ['ultimate', m.ult]] as const) {
    if (x && x.separated) notes.push({ tone: 'warn', text: `At the factored ${name} load the joint has opened: the bolt carries the whole load, not ΦP.` });
    if (x && x.ms < 0) notes.push({ tone: 'bad', text: `The bolt fails the ${name} check (MS ${sgn(x.ms)}).` });
  }
  if (Fmin <= 0 && gam !== null) notes.push({ tone: 'bad', text: 'The minimum preload is zero or less: the joint is loose at the cold or low-scatter corner.' });

  // tightening, fatigue, temperature
  const Ft = tp.F * (1 + g), ts = tighteningStress(Ft, tp.threadTorque * (1 + g), t), nu = ts.vm / Rp;
  if (nu > 1) notes.push({ tone: 'bad', text: `The bolt yields while tightening${gam === null ? '' : ' at the top of the scatter'} (tension plus thread torsion ${fmt(ts.vm, 0)} MPa). Lower the torque, control the friction, or use a stronger bolt.` });
  else if (nu > 0.9) notes.push({ tone: 'warn', text: `Tightening uses ${fmt(100 * nu, 0)}% of yield: little room for friction lower than assumed.` });
  const sa = (phi * P) / (2 * t.As);
  const dWorst = Math.abs(dCold) > Math.abs(dHot) ? dCold : dHot;
  if (dWorst < -0.1 * tp.F) notes.push({ tone: 'warn', text: `The ${mm.name.toLowerCase()} members shrink more than the ${bm.name.toLowerCase()} bolt when cold: ${kN(-dCold)} kN of preload is lost at the coldest case.` });
  if (phi > 0.35) notes.push({ tone: 'info', text: `A soft joint: the bolt sees ${fmt(100 * phi, 0)}% of every load change, so fatigue and separation both suffer. Stiffer clamped parts, or a longer, slimmer bolt, bring Φ down.` });

  return (
    <>
      <Readouts>
        <Readout label="Preload" value={kN(tp.F)} unit="kN" primary sub={`nominal · K = ${fmt(tp.K, 3)}${gam !== null ? ` · ${kN(Fmin)}–${kN(Fmax)} kN with scatter and temperature` : ''}`} />
        <Readout label="Load factor Φ" value={fmt(phi, 3)} sub={`kb ${fmt(kb / 1000, 0)} · km ${fmt(km / 1000, 0)} kN/mm`} />
        <Readout label="Load per bolt" value={kN(P)} unit="kN" sub={Number.isFinite(closure) && closure > 0 ? `${fmt(closure / 1000, 0)} kN over ${nb} bolts` : 'extra load only'} />
        {msRo('Separation margin', m.sep, `opens at ${kN(Fmin / (1 - phi))} kN, minimum preload`)}
        {msRo('Yield margin', m.yield && m.yield.ms, m.yield ? `bolt ${kN(m.yield.load)} kN vs ${kN(Rp * t.As)} kN` : '')}
        {msRo('Ultimate margin', m.ult && m.ult.ms, m.ult ? `bolt ${kN(m.ult.load)} kN vs ${kN(Rm * t.As)} kN` : '')}
        <Readout label="Tightening stress" value={`${fmt(100 * nu, 0)}%`} tone={nu > 1 ? 'bad' : nu > 0.9 ? 'warn' : 'ok'}
          sub={`of yield, von Mises at ${gam === null ? 'nominal' : 'maximum'} preload`} />
        <Readout label="Alternating stress" value={fmt(sa, 1)} unit="MPa" sub="for each 0 → load cycle, ΦP/2As (see Fatigue)" />
        <Readout label="Temperature" value={mm.alpha === bm.alpha ? '0' : `${dWorst >= 0 ? '+' : ''}${kN(dWorst)}`} unit="kN"
          tone={dWorst < -0.1 * tp.F ? 'warn' : undefined}
          sub={mm.alpha === bm.alpha ? 'same expansion: no change' : `cold ${kN(dCold)} · hot ${kN(dHot)} kN`} />
      </Readouts>
      <Chart F={tp.F} range={gam === null ? null : [Fmin, Fmax]} kb={kb} km={km} P={P} />
      <Notes items={notes} />
    </>
  );
}

export default function Bolt() {
  return (
    <Calc
      id="bolted-joint"
      title="Bolted joint: one bolt (preload, separation, margins)"
      defaults={{
        th: 'M10', gr: '12.9', rp: '1100', rm: '1220', bm: D.boltSteel, lg: '24', ls: '16', dw: '15', dh: '11', mm: D.caseSteel,
        tq: '60', gam: '', mut: '0.12', muh: '0.12', loss: '0', pr: '10', sd: '260', nb: '30', px: '0', tmin: '-60', tmax: '40',
        fsep: '', fy: '', fu: '', fsp: '',
      }}
      example={{
        values: { gam: '25', fsep: '1.2', fy: '1.1', fu: '1.25', fsp: '1.15' },
        note: 'Worked-example values loaded: preload scatter ±25%, separation 1.2, yield 1.1, ultimate 1.25, fitting 1.15',
        factorFields: ['fsep', 'fy', 'fu', 'fsp', 'gam'],
      }}
      foot="One bolt, concentric axial load, one clamped material. Torque–preload long form and VDI 2230 bolt compliance; 30° pressure cones for the members. After separation the bolt carries the whole load. Thread stripping and locking are separate checks."
    >
      <Inputs>
        <Group legend="Bolt">
          <FieldRow>
            <Choice name="th" label="Thread" options={THREADS.map((t) => ({ value: t.name, label: `${t.name} × ${t.P}` }))}
              then={(n) => { const t = THREADS.find((x) => x.name === n); return t ? { dw: String(Math.round(1.5 * t.d)), dh: String(t.d + 1) } : undefined; }} />
            <Choice name="gr" label="Grade" options={GRADES.map((g) => ({ value: g.key, label: g.name }))}
              then={(k) => { const g = GRADES.find((x) => x.key === k); return g ? { rp: String(g.Rp), rm: String(g.Rm) } : undefined; }} />
          </FieldRow>
          <FieldRow>
            <Num name="rp" label="Yield, Rp0.2" unit="MPa" />
            <Num name="rm" label="Tensile, Rm" unit="MPa" />
          </FieldRow>
          <Choice name="bm" label="Bolt material" groups={BOLT_GROUPS} search />
        </Group>
        <Group legend="Joint">
          <FieldRow>
            <Num name="lg" label="Grip length" unit="mm" />
            <Num name="ls" label="Plain shank in grip" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="dw" label="Bearing face ⌀" unit="mm" />
            <Num name="dh" label="Hole ⌀" unit="mm" />
          </FieldRow>
          <Choice name="mm" label="Clamped material" groups={ALL_GROUPS} search />
        </Group>
        <Group
          legend="Tightening"
          hint="Friction: about 0.10–0.14 lubricated, 0.14–0.20 dry steel: measure it for your lubricant. The scatter of preload for your tightening method comes from your programme's standard. Loss covers embedding and relaxation."
        >
          <FieldRow>
            <Num name="tq" label="Torque" unit="N·m" />
            <Num name="gam" label="Preload scatter ±" unit="%" placeholder="your value" />
          </FieldRow>
          <FieldRow>
            <Num name="mut" label="Thread friction μt" />
            <Num name="muh" label="Head friction μb" />
            <Num name="loss" label="Preload loss" unit="%" />
          </FieldRow>
        </Group>
        <Group legend="Load and temperature" hint="The pressure acts over the seal diameter and is shared equally; use the extra load for bending, prying or side loads per bolt.">
          <FieldRow>
            <Num name="pr" label="Pressure" unit="MPa" />
            <Num name="sd" label="Seal ⌀" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="nb" label="Number of bolts" />
            <Num name="px" label="Extra load per bolt" unit="kN" />
          </FieldRow>
          <FieldRow>
            <Num name="tmin" label="Coldest, from assembly" unit="°C" />
            <Num name="tmax" label="Hottest, from assembly" unit="°C" />
          </FieldRow>
        </Group>
        <Group legend="Your programme's factors">
          <FieldRow>
            <Num name="fsep" label="Separation" placeholder="your value" />
            <Num name="fy" label="Yield" placeholder="your value" />
          </FieldRow>
          <FieldRow>
            <Num name="fu" label="Ultimate" placeholder="your value" />
            <Num name="fsp" label="Fitting / special" placeholder="none" />
          </FieldRow>
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
