// Exposure time and affected-depth thickness around the case, from the grain burn-back.
import React, { useMemo } from 'react';
import { exposureAroundCase, isothermDepth } from '../lib/insulation';
import { portOutline, type Port } from '../lib/grain';
import { readFactor, awaitingMessage } from '../lib/factors';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, Readouts, Readout, Note, Figure, Hint, useForm, num, fmt } from './kit';

const PORTS: Record<string, Port> = {
  star: { kind: 'star', points: 7, tipD: 110, valleyD: 40 },
  slots: { kind: 'slots', slots: 6, coreD: 40, slotW: 8, slotD: 110 },
  tube: { kind: 'circular', d: 80 },
};
const prop = { rhoP: 1770, a: 4.05, n: 0.35, cStar: 1540 };
const ins = { k: 0.25, rho: 1100, cp: 2000 };

function Map() {
  const { v } = useForm();
  const port = PORTS[v.grain] ?? PORTS.star;
  const e = useMemo(() => exposureAroundCase({ od: 150, length: 600, segments: 1, burningEnds: 0, port }, prop, 7), [v.grain]);
  const alpha = ins.k / (ins.rho * ins.cp);
  const thetaP = (num(v.tp) - 20) / (num(v.ts) - 20);
  const rate = num(v.er) / 1000;
  // No factor entered: show the unfactored affected depth (the map's shape doesn't change).
  const sf = readFactor(v.sf);
  const thick = e.exposure.map((t) => (t > 0 ? (sf ?? 1) * (rate * t + isothermDepth(t, rate, alpha, thetaP)) * 1000 : 0));
  const tMin = Math.min(...thick), tMax = Math.max(...thick);
  const note = Math.max(...e.exposure) < 0.5
    ? 'A tube grain reaches the case everywhere at once, so in this ideal model the cylinder is barely exposed. Real motors still insulate it for tail-off, uneven burn-back, ignition and handling: minimum gauge governs here.'
    : `The case under the ${v.grain === 'star' ? 'star tips' : 'slot tips'} is uncovered first and needs the most insulation; under the ${v.grain === 'star' ? 'valleys' : 'webs between slots'} the flame arrives last.`;

  const R = 120, scale = R / 75, wMax = 34;
  const exMax = Math.max(...e.exposure, 1e-6);
  const n = e.angles.length;
  const p = (rr: number, a: number) => `${(rr * Math.cos(a)).toFixed(2)},${(rr * Math.sin(a)).toFixed(2)}`;
  const pts = portOutline(port, 1);
  const iMax = thick.indexOf(tMax), iMin = thick.indexOf(tMin);

  return (
    <>
      <Readouts>
        <Readout label="Burn time (incl. tail-off)" value={fmt(e.burnTime, 2)} unit="s" />
        <Readout label="Exposure min / max" value={`${fmt(Math.min(...e.exposure), 1)} / ${fmt(Math.max(...e.exposure), 1)}`} unit="s" />
        <Readout label={sf === null ? 'Affected depth min / max (no SF)' : 'Thickness min / max'} value={`${fmt(tMin, 2)} / ${fmt(tMax, 2)}`} unit="mm" primary />
      </Readouts>
      {sf === null ? <Note tone="warn">{`Showing affected depth without a factor. ${awaitingMessage(['safety factor'], 'the required thickness')}`}</Note> : null}
      <Hint>{note}</Hint>
      <Figure
        label="Polar map of insulation exposure time and thickness around the case"
        caption="Ring shade: exposure time (darker = longer). Ring width: required thickness, exaggerated. Red dot: thickest point; blue dot: thinnest. Inner outline: the port at ignition."
      >
        <svg viewBox="-155 -155 310 310" aria-hidden="true" style={{ maxWidth: 420, alignSelf: 'center' }}>
          {e.angles.map((ang, i) => {
            const a0 = ((ang - 180 / n) * Math.PI) / 180, a1 = ((ang + 180 / n) * Math.PI) / 180;
            const w = tMax > 0 ? (thick[i] / tMax) * wMax : 0;
            const ri = R - w, ro = R;
            return (
              <path key={i} d={`M${p(ro, a0)} A${ro},${ro} 0 0 1 ${p(ro, a1)} L${p(ri, a1)} A${ri},${ri} 0 0 0 ${p(ri, a0)} Z`}
                fill="var(--rd-insul)" fillOpacity={(0.25 + 0.75 * (e.exposure[i] / exMax)).toFixed(3)} />
            );
          })}
          <circle cx={0} cy={0} r={R + 5} fill="none" stroke="var(--rd-steel)" strokeWidth={10} />
          <circle cx={0} cy={0} r={R - wMax - 2} fill="var(--rd-propellant)" fillOpacity={0.35} />
          {pts.length ? (
            <path d={pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * scale).toFixed(1)},${(y * scale).toFixed(1)}`).join('') + 'Z'}
              fill="var(--rd-panel)" stroke="var(--rd-hot)" strokeWidth={1.5} />
          ) : null}
          {([[iMax, 'var(--rd-accent)'], [iMin, 'var(--rd-blue)']] as const).map(([i, col]) => {
            const a = (e.angles[i] * Math.PI) / 180;
            return <circle key={col} cx={Math.cos(a) * (R + 22)} cy={Math.sin(a) * (R + 22)} r={7} fill={col} />;
          })}
        </svg>
      </Figure>
    </>
  );
}

export default function ExposureMap() {
  const base = { grain: 'star', er: '0.025', sf: '', ts: '1200', tp: '450' };
  return (
    <Calc
      id="exposure-map"
      title="Where the case is exposed first"
      defaults={base}
      example={{ values: { ...base, sf: '1.5' }, note: 'Worked-example safety factor loaded: 1.5', factorFields: ['sf'] }}
      foot="Cylinder section, from the grain burn-back. Thickness here is your programme's safety factor × affected depth at burnout only: check the bondline with the insulation calculator."
    >
      <Inputs>
        <Group legend="Grain (from the propellant grain page)" hint="150 mm grain, 600 mm long, generic AP/HTPB-like propellant, peak pressure 7 MPa.">
          <Choice name="grain" label="Port" options={[{ value: 'star', label: '7-point star' }, { value: 'slots', label: 'Core + 6 slots' }, { value: 'tube', label: 'Tube' }]} />
        </Group>
        <Group legend="Insulation" hint={<>EPDM properties (k 0.25 W/m·K, ρ 1100 kg/m³, c<sub>p</sub> 2000 J/kg·K).</>}>
          <FieldRow>
            <Num name="er" label="Erosion rate" unit="mm/s" />
            <Num name="sf" label="Safety factor" placeholder="your value" />
          </FieldRow>
          <FieldRow>
            <Num name="ts" label="Effective surface" unit="°C" />
            <Num name="tp" label="Char front" unit="°C" />
          </FieldRow>
        </Group>
      </Inputs>
      <Outputs>
        <Map />
      </Outputs>
    </Calc>
  );
}
