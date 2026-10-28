// Seal check for a motor joint: does a bore seal's gland stay closed when the case dilates under pressure, what seat
// wall keeps it closed, and how sensitive is a pressure-decay leak check between two seals. Maths in src/lib/sealing.ts.
import React from 'react';
import { radialGrowth, squeezeAtPressure, seatWallFor, detectableLeak, holdTimeFor, thermalPressureShift } from '../lib/sealing';
import {
  Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, Readouts, Readout, Notes, Figure, useForm, num, fmt, fmtSci,
  type OptionGroup, type Tone,
} from './kit';

export type SealMat = { key: string; E: number; nu?: number };

function Bars({ comp, gap, left, res, drift, signal }: Record<'comp' | 'gap' | 'left' | 'res' | 'drift' | 'signal', number>) {
  const W = 420, H = 210, L = 8, R = 12;
  const group = (y: number, title: string, bars: [string, number, string][], unit: string) => {
    const vals = bars.map((b) => b[1]).filter((v) => Number.isFinite(v) && v > 0);
    const max = (vals.length ? Math.max(...vals) : 1) * 1.05;
    return (
      <g key={title}>
        <text x={L} y={y} fontSize={13} fontWeight={600} fill="var(--rd-ink)">{title}</text>
        {bars.map(([name, v, color], i) => {
          if (!Number.isFinite(v)) return null;
          const yy = y + 10 + i * 22, w = (Math.max(0, v) / max) * (W - L - R);
          return (
            <g key={name}>
              <rect x={L} y={yy} width={Math.max(2, w)} height={16} rx={2} fill={color} fillOpacity={0.75} />
              <text x={L + 6} y={yy + 12} fontSize={12} fill="var(--rd-ink)" stroke="var(--rd-panel)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                {`${name} ${fmt(v, 2)} ${unit}`}
              </text>
            </g>
          );
        })}
      </g>
    );
  };
  return (
    <Figure label="Bars comparing the seal's compression with the gland opening, and the leak-check pressure signal with the gauge resolution and temperature drift">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {group(18, 'Radial: compression against gap', [['compressed at assembly', comp, 'var(--rd-ok)'], ['gland opening', gap, 'var(--rd-accent)'], ['left at pressure', left, 'var(--rd-blue)']], 'mm')}
        {group(118, 'Leak check: pressure signals', [['gauge resolution', res, 'var(--rd-muted)'], ['temperature drift', drift, 'var(--rd-warn)'], ['allowed leak over the hold', signal, 'var(--rd-blue)']], 'kPa')}
      </svg>
    </Figure>
  );
}

function Results({ mats }: { mats: Record<string, SealMat> }) {
  const { v } = useForm();
  const notes: { tone: Tone; text: string }[] = [];
  const mat = mats[v.mat] ?? Object.values(mats)[0];
  const p = num(v.p), rad = num(v.r), t = num(v.t), mate = num(v.mate) || 0, cs = num(v.cs);
  const sMin = num(v.smin) / 100, floor = num(v.floor) / 100;
  const okSeal = [p, rad, t, cs].every((x) => x > 0) && sMin >= 0;
  let comp = NaN, gap = NaN, left = NaN, grow = NaN, sq = NaN, tw = NaN;
  if (okSeal) {
    grow = radialGrowth(p, rad, t, mat.E, mat.nu ?? 0.3);
    gap = grow - mate; comp = cs * sMin;
    sq = squeezeAtPressure(cs, sMin, Math.max(0, gap)); left = sq * cs;
    tw = Number.isFinite(floor) ? seatWallFor(p, rad, mat.E, mat.nu ?? 0.3, cs, sMin, floor, mate) : NaN;
    if (sq <= 0) notes.push({ tone: 'bad', text: `The gland opens ${fmt(gap, 2)} mm: more than the ${fmt(comp, 2)} mm the ring is compressed. The seal unloads at pressure and leaks. Seat it in a thicker, stiffer ring (${Number.isFinite(tw) ? `at least ${fmt(tw, 1)} mm` : 'much thicker'}), or on a part that grows with the case.` });
    else if (Number.isFinite(floor) && sq < floor) notes.push({ tone: 'warn', text: `Squeeze at pressure, ${fmt(sq * 100, 1)}%, is below your ${fmt(floor * 100, 0)}% floor. A ${fmt(tw, 1)} mm seat would hold it.` });
    if (gap > 0) notes.push({ tone: 'info', text: 'A cold, set ring follows a widening gap slowly: the Challenger lesson. Keep the gap from opening rather than relying on the ring to chase it.' });
  } else notes.push({ tone: 'bad', text: 'Fill in the pressure, radius, seat wall, ring section and minimum squeeze.' });

  const V = num(v.vol), pt = num(v.pt), hold = num(v.hold), res = num(v.res), dT = num(v.dT) || 0, spec = num(v.spec);
  let drift = NaN, signal = NaN, det = NaN;
  const leakOk = [V, hold, res].every((x) => x > 0) && pt >= 0;
  if (leakOk) {
    det = detectableLeak(V, res, hold);
    drift = thermalPressureShift(pt + 101.325, dT);
    if (drift > res) notes.push({ tone: 'warn', text: `A ${fmt(dT, 2)} °C drift moves the pressure ${fmt(drift, 2)} kPa: more than the gauge can resolve. Stabilise and record temperature and correct for it, use a reference volume, or use a helium leak test.` });
    if (spec > 0) {
      const need = holdTimeFor(V, res, spec);
      signal = (spec * hold * 101.325) / V;
      notes.push({ tone: need > 3600 ? 'warn' : 'info', text: `To see the allowed ${fmtSci(spec)} std cm³/s needs a hold of ${need < 120 ? `${fmt(need, 0)} s` : `${fmt(need / 60, 0)} min`} at this resolution${need > 3600 ? ': too long for a pressure-decay check; use a helium mass-spectrometer test' : ''}.` });
    }
    notes.push({ tone: 'info', text: 'Pressurising the space between two seals loads the primary from its back: it seats on the wrong groove wall and has to shuttle across when the motor lights. Where you can, test each seal in its working direction, and include the port plug in the seal count.' });
  }
  const sqTone: Tone | undefined = !okSeal ? undefined : sq <= 0 ? 'bad' : Number.isFinite(floor) && sq < floor ? 'warn' : 'ok';
  return (
    <>
      <Readouts>
        <Readout label="Case growth" value={fmt(grow, 3)} unit="mm" sub={okSeal ? `hoop strain ${fmt((grow / rad) * 100, 3)}%` : undefined} />
        <Readout label="Gland opens by" value={fmt(Math.max(0, gap), 3)} unit="mm" sub="case growth less the mating part's" />
        <Readout label="Squeeze at pressure" value={okSeal ? `${fmt(sq * 100, 1)}%` : '—'} tone={sqTone} primary
          sub={okSeal ? `of ${fmt(sMin * 100, 1)}% at assembly · ${fmt(left, 2)} mm compression left` : undefined} />
        <Readout label="Seat wall for the floor" value={Number.isFinite(tw) ? fmt(tw, 1) : '—'} unit={Number.isFinite(tw) ? 'mm' : undefined}
          sub={Number.isFinite(tw) ? `for ${fmt(floor * 100, 0)}% squeeze at pressure` : okSeal ? 'the floor is above the minimum squeeze' : undefined} />
        <Readout label="Smallest leak seen" value={fmtSci(det)} unit="std cm³/s" sub={leakOk ? `in ${fmt(hold / 60, 0)} min at ${fmt(res, 2)} kPa resolution` : undefined} />
        <Readout label="Temperature drift" value={fmt(drift, 3)} unit="kPa" tone={leakOk ? (drift > res ? 'warn' : 'ok') : undefined}
          sub={leakOk ? `looks like ${fmtSci(detectableLeak(V, drift, hold))} std cm³/s` : undefined} />
      </Readouts>
      <Bars comp={comp} gap={Math.max(0, gap)} left={left} res={res} drift={drift} signal={signal} />
      <Notes items={notes} />
    </>
  );
}

export default function Seal({ groups, mats, defaultMat }: { groups: OptionGroup[]; mats: Record<string, SealMat>; defaultMat: string }) {
  return (
    <Calc
      id="seal-check"
      title="Seal at pressure and leak check"
      defaults={{ p: '10', r: '150', t: '10', mat: defaultMat, mate: '0.02', cs: '5.33', smin: '10.8', floor: '10', vol: '2', pt: '700', hold: '600', res: '0.1', dT: '0.1', spec: '' }}
      foot={
        <>
          Radial growth of a closed-end thin cylinder, p·r²(1 − ν/2)/(E·t). Pressure-decay sensitivity V·Δp/t in standard cm³/s
          (atm·cm³/s); temperature shift p<sub>abs</sub>·ΔT/T at 20 °C. Flange rotation and face-seal lift are not modelled: see
          Bolted joints for separation.
        </>
      }
    >
      <Inputs>
        <Group
          legend="Bore seal under pressure"
          hint="Minimum squeeze at the worst corner (smallest ring, cold, after compression set) from the O-ring design calculator. The mating part's growth comes from your analysis; zero is conservative. Closed-end cylinder, thin wall."
        >
          <FieldRow>
            <Num name="p" label="Pressure" unit="MPa" />
            <Num name="r" label="Bore radius" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="t" label="Wall at the seal seat" unit="mm" />
            <Num name="mate" label="Mating part's growth" unit="mm" />
          </FieldRow>
          <Choice name="mat" label="Material" groups={groups} search />
          <FieldRow>
            <Num name="cs" label="Ring section" unit="mm" />
            <Num name="smin" label="Minimum squeeze" unit="%" />
            <Num name="floor" label="Squeeze floor" unit="%" />
          </FieldRow>
        </Group>
        <Group legend="Leak check through a port between the seals" hint="Include the port and drillings in the volume. The allowed leak rate comes from your requirement.">
          <FieldRow>
            <Num name="vol" label="Volume between seals" unit="cm³" />
            <Num name="pt" label="Test pressure" unit="kPa gauge" />
          </FieldRow>
          <FieldRow>
            <Num name="hold" label="Hold time" unit="s" />
            <Num name="res" label="Gauge resolution" unit="kPa" />
          </FieldRow>
          <FieldRow>
            <Num name="dT" label="Temperature drift" unit="°C" />
            <Num name="spec" label="Allowed leak" unit="std cm³/s" placeholder="from your spec" />
          </FieldRow>
        </Group>
      </Inputs>
      <Outputs>
        <Results mats={mats} />
      </Outputs>
    </Calc>
  );
}
