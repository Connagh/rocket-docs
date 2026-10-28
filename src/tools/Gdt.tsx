// GD&T arithmetic in three tabs: bonus tolerance and virtual condition for a feature of size (with a measured position
// check), the fastener formulas with and without a projected tolerance zone, and the radial gland of an O-ring groove
// when its runout to the pilot is added. Maths in src/lib/gdt.ts (unit-tested).
import React from 'react';
import { featureOfSize, positionFromXY, floatingTolerance, fixedTotal, holeWithoutProjection, glandRange, type FeatureKind, type Modifier } from '../lib/gdt';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Choice, ModeTabs, Readouts, Readout, Notes, Plot, Poly, A, useForm, num, fmt, HALO, type Tone } from './kit';

const f = (v: number, d = 3) => fmt(v, d);
const pc = (v: number) => `${fmt(100 * v, 1)}%`;
type Note = { tone: Tone; text: React.ReactNode };
const Dot = ({ x, y, color, r = 4.5 }: { x: number; y: number; color: string; r?: number }) => <circle cx={x} cy={y} r={r} fill={color} stroke="var(--rd-panel)" strokeWidth={1.5} />;

function Bonus() {
  const { v } = useForm();
  const kind = v.b_kind as FeatureKind, mod = v.b_mod as Modifier;
  const lo = num(v.b_min), hi = num(v.b_max), tol = num(v.b_tol), act = num(v.b_act), dx = num(v.b_dx), dy = num(v.b_dy);
  if (!(hi > lo && tol >= 0 && Number.isFinite(act))) return <Notes items={[{ tone: 'bad', text: 'Enter size limits (largest above smallest), a tolerance and the actual size.' }]} />;
  const r = featureOfSize(kind, lo, hi, tol, mod, act);
  const measured = Number.isFinite(dx) && Number.isFinite(dy) ? positionFromXY(dx, dy) : NaN;
  const ok = r.inLimits && measured <= r.allowed + 1e-12;
  const notes: Note[] = [];
  if (mod === 'MMC') notes.push({ tone: 'info', text: `At MMC the feature fits with the least clearance, so it gets the least tolerance. As it departs towards LMC the clearance grows, and so may the position error: up to ⌀${f(r.maxAllowed)} at LMC, with the mating part still assembling.` });
  if (mod === 'RFS') notes.push({ tone: 'info', text: 'Regardless of feature size: the tolerance never grows. Use it where the feature locates something precisely, not just clears it.' });
  if (mod === 'LMC') notes.push({ tone: 'info', text: 'LMC protects a minimum wall or edge distance: the bonus grows as the feature moves towards MMC, where there is more material.' });
  const span = hi - lo, x0 = lo - 0.25 * span, x1 = hi + 0.25 * span;
  const ys = [r.maxAllowed, tol, Number.isFinite(measured) ? measured : 0];
  const allow = (s: number) => featureOfSize(kind, lo, hi, tol, mod, s).allowed;
  return (
    <>
      <Readouts>
        <Readout label="Allowed position tolerance" value={`⌀${f(r.allowed)}`} primary tone={r.inLimits ? undefined : 'bad'}
          sub={r.inLimits ? `stated ⌀${f(tol)} + bonus ${f(r.bonus)} at ⌀${f(act)}` : `the size ⌀${f(act)} is outside its limits: the feature is rejected on size`} />
        {Number.isFinite(measured) ? (
          <Readout label="Measured position" value={`⌀${f(measured)}`} tone={ok ? 'ok' : 'bad'}
            sub={`2√(Δx² + Δy²) · ${ok ? 'conforms' : 'does not conform'}${ok && measured > tol ? ': only because of the bonus' : ''}`} />
        ) : null}
        <Readout label="Virtual condition" value={`⌀${f(r.virtual)}`}
          sub={mod === 'RFS' ? 'the boundary at MMC; without a modifier no fixed gauge can check it' : `the worst-case boundary: a functional gauge ${kind === 'hole' ? 'pin' : 'ring'} of this size`} />
        <Readout label="Resultant condition" value={`⌀${f(r.resultant)}`} sub="the opposite extreme: what wall thickness and edge distance must allow for" />
      </Readouts>
      <Plot x0={x0} x1={x1} y0={0} y1={Math.max(...ys) * 1.25} xl="actual size ⌀ (mm)" yl="position tolerance ⌀ (mm)" legend={[['allowed', 'var(--rd-blue)']]}
        label="Dynamic tolerance diagram"
        caption="The tolerance allowed at each actual size: the dynamic tolerance diagram. Anything in the shaded area conforms; the dot is the measured feature.">
        {(c) => (
          <>
            <polygon points={[[c.X(lo), c.Y(0)], [c.X(lo), c.Y(allow(lo))], [c.X(hi), c.Y(allow(hi))], [c.X(hi), c.Y(0)]].map(([x, y]) => `${x},${y}`).join(' ')} fill="var(--rd-ok)" fillOpacity={0.12} />
            <Poly s={c} pts={[[lo, allow(lo)], [hi, allow(hi)]]} color="var(--rd-blue)" />
            {[lo, hi].map((s) => <line key={s} x1={c.X(s)} x2={c.X(s)} y1={c.T} y2={c.H - c.B} stroke="var(--rd-warn)" strokeDasharray="3 3" />)}
            <text x={c.X(r.mmc) + (r.mmc === lo ? 4 : -4)} y={c.T + 12} textAnchor={r.mmc === lo ? 'start' : 'end'} fontSize={12} fill="var(--rd-warn)" {...HALO}>MMC</text>
            <text x={c.X(r.lmc) + (r.lmc === lo ? 4 : -4)} y={c.T + 12} textAnchor={r.lmc === lo ? 'start' : 'end'} fontSize={12} fill="var(--rd-warn)" {...HALO}>LMC</text>
            {Number.isFinite(measured) ? <Dot x={c.X(Math.max(x0, Math.min(x1, act)))} y={c.Y(measured)} color={ok ? 'var(--rd-ok)' : 'var(--rd-accent)'} r={5} /> : null}
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Fasteners() {
  const { v } = useForm();
  const type = v.f_type, F = num(v.f_F), H = num(v.f_H), t1 = num(v.f_t1), P = num(v.f_P) || 0, D = num(v.f_D);
  if (!(H > F && F > 0)) return <Notes items={[{ tone: 'bad', text: 'The clearance hole at MMC must be larger than the fastener.' }]} />;
  const notes: Note[] = [];
  let segs: { name: string; parts: [string, number, string][] }[];
  let ros: React.ReactNode;
  if (type === 'floating') {
    const T = floatingTolerance(H, F);
    ros = <Readout label="Each part" value={`⌀${f(T)} at MMC`} primary sub="T = H − F, for the clearance holes in both parts" />;
    notes.push({ tone: 'info', text: 'Floating fasteners pass through clearance holes in both parts, held by nuts: each part can use the whole clearance.' });
    segs = [{ name: 'each part', parts: [['F', F, 'var(--rd-line)'], ['T', T, 'var(--rd-blue)']] }];
  } else {
    const T = fixedTotal(H, F), t2 = T - (Number.isFinite(t1) ? t1 : T / 2), t1v = T - t2;
    const k = 1 + (2 * P) / D, t2no = t2 / k, Hno = holeWithoutProjection(F, t1v, t2, P, D);
    ros = (
      <>
        <Readout label="Shared between the parts" value={`⌀${f(T)}`} sub="T₁ + T₂ = H − F" />
        <Readout label="Threaded holes, projected zone" value={`⌀${f(t2)}`} primary tone={t2 > 0 ? 'ok' : 'bad'} sub={`with a projected tolerance zone ${fmt(P, 0)} mm high: the zone sits where the fastener actually is`} />
        <Readout label="Without a projected zone" value={`⌀${f(t2no)}`} tone="warn" sub={`for the same hole, or keep ⌀${f(t2)} and open the clearance hole to ⌀${f(Hno)}`} />
      </>
    );
    if (t2 <= 0) notes.push({ tone: 'bad', text: 'The clearance holes take all the tolerance: nothing is left for the threaded holes. Tighten the clearance holes or open them up.' });
    notes.push({ tone: 'info', text: `A threaded hole that leans carries the fastener with it, and the error grows over the ${fmt(P, 0)} mm the fastener stands out. Specify the projected tolerance zone on threaded holes, press-fit pins and studs.` });
    segs = [
      { name: 'zone', parts: [['F', F, 'var(--rd-line)'], ['T₁', t1v, 'var(--rd-blue)'], ['T₂', t2, 'var(--rd-ok)']] },
      { name: 'no zone', parts: [['F', F, 'var(--rd-line)'], ['T₁', t1v, 'var(--rd-blue)'], ['T₂', t2 * k, 'var(--rd-accent)']] },
    ];
  }
  const tops = segs.map((s) => s.parts.reduce((a, p) => a + p[1], 0)), x1 = Math.max(H, ...tops) * 1.04, x0 = F * 0.9;
  return (
    <>
      <Readouts>{ros}</Readouts>
      <Plot x0={x0} x1={x1} y0={0} y1={segs.length + 0.6} xl="diameter (mm)" yl="" noY label="How the clearance between hole and fastener is spent"
        caption="How the clearance between hole and fastener is spent: the fastener, the clearance holes' tolerance, and the threaded holes': magnified when there is no projected zone.">
        {(c) => (
          <>
            {segs.map((s, i) => {
              let x = x0;
              const y = c.Y(segs.length - i - 0.15), h = c.Y(0) - c.Y(0.6);
              return (
                <g key={s.name}>
                  {s.parts.map(([name, val, color]) => {
                    const a = Math.max(x, x0), b = name === 'F' ? F : x + val;
                    x = name === 'F' ? F : x + val;
                    return (
                      <g key={name}>
                        {b > a ? <rect x={c.X(a)} y={y} width={Math.max(1, c.X(b) - c.X(a))} height={h} fill={color} fillOpacity={name === 'F' ? 0.5 : 0.8} /> : null}
                        {name !== 'F' && c.X(b) - c.X(a) > 22 ? <text x={(c.X(a) + c.X(b)) / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={12} fill="var(--rd-panel)">{name}</text> : null}
                      </g>
                    );
                  })}
                  <text x={c.L - 6} y={y + h / 2 + 4} textAnchor="end" fontSize={12} fill="var(--rd-ink)">{s.name}</text>
                </g>
              );
            })}
            <line x1={c.X(H)} x2={c.X(H)} y1={c.T} y2={c.H - c.B} stroke="var(--rd-ink)" strokeWidth={1.6} />
            <text x={c.X(H) - 4} y={c.T + 12} textAnchor="end" fontSize={12} fill="var(--rd-ink)" {...HALO}>hole at MMC</text>
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Gland() {
  const { v } = useForm();
  const g = { boreMin: num(v.g_bmin), boreMax: num(v.g_bmax), plugMin: num(v.g_pmin), plugMax: num(v.g_pmax), rootMin: num(v.g_rmin), rootMax: num(v.g_rmax), runout: num(v.g_run) || 0, csMin: num(v.g_cmin), csMax: num(v.g_cmax) };
  if (!(g.boreMax >= g.boreMin && g.plugMax >= g.plugMin && g.rootMax >= g.rootMin && g.csMax >= g.csMin && g.boreMin > g.plugMax && g.plugMin > g.rootMax && g.csMin > 0))
    return <Notes items={[{ tone: 'bad', text: 'Check the limits: bore larger than pilot, pilot larger than groove root, smallest below largest.' }]} />;
  const r = glandRange(g), r0 = glandRange({ ...g, runout: 0 });
  const th = Array.from({ length: 73 }, (_, i) => i * 5);
  const low = (run: number) => { const e = (g.boreMax - g.plugMin) / 2 + run / 2, m = (g.boreMax - g.rootMin) / 2; return th.map((t) => (g.csMin - (m + e * Math.cos((t * Math.PI) / 180))) / g.csMin); };
  const high = (run: number) => { const e = (g.boreMax - g.plugMin) / 2 + run / 2, m = (g.boreMax - g.rootMax) / 2; return th.map((t) => (g.csMax - (m - e * Math.cos((t * Math.PI) / 180))) / g.csMax); };
  const L1 = low(g.runout), H1 = high(g.runout), L0 = low(0), H0 = high(0);
  const all = [...L1, ...H1], lo = Math.min(...all), hi = Math.max(...all), pad = 0.1 * (hi - lo);
  return (
    <>
      <Readouts>
        <Readout label="Minimum squeeze" value={pc(r.squeezeMin)} primary tone={r.squeezeMin < r0.squeezeMin - 1e-9 ? 'warn' : undefined} sub={`smallest ring in the deepest local gland · ${pc(r0.squeezeMin)} with the groove coaxial`} />
        <Readout label="Maximum squeeze" value={pc(r.squeezeMax)} sub="largest ring in the shallowest local gland" />
        <Readout label="Gland depth" value={`${f(r.gMin)} – ${f(r.gMax)}`} unit="mm" sub={`nominal ${f(r.gNom)} mm, round the circumference and over every limit`} />
        <Readout label="Largest offset" value={f(r.eMax)} unit="mm" sub="half the pilot clearance plus half the runout" />
        <Readout label="What the runout costs" value={`${fmt(100 * (r0.squeezeMin - r.squeezeMin), 2)} points`} sub={`of minimum squeeze, from ${f(g.runout)} mm of runout`} />
      </Readouts>
      <Plot x0={0} x1={360} y0={100 * (lo - pad)} y1={100 * (hi + pad)} xl="position round the groove (°)" yl="squeeze (%)" legend={[['with runout', 'var(--rd-accent)'], ['coaxial', 'var(--rd-blue)', '4 3']]}
        label="Squeeze round the circumference"
        caption="Squeeze round the circumference for the two worst combinations of limits: the upper curve with the largest ring in the shallowest gland, the lower with the smallest ring in the deepest. Dashed: the same with the groove coaxial to its pilot.">
        {(c) => (
          <>
            <Poly s={c} pts={th.map((t, i) => [t, 100 * H0[i]])} color="var(--rd-blue)" w={1.4} dash="4 3" />
            <Poly s={c} pts={th.map((t, i) => [t, 100 * L0[i]])} color="var(--rd-blue)" w={1.4} dash="4 3" />
            <Poly s={c} pts={th.map((t, i) => [t, 100 * H1[i]])} color="var(--rd-accent)" />
            <Poly s={c} pts={th.map((t, i) => [t, 100 * L1[i]])} color="var(--rd-accent)" />
            <Dot x={c.X(0)} y={c.Y(100 * r.squeezeMin)} color="var(--rd-accent)" r={4} />
          </>
        )}
      </Plot>
      <Notes items={[
        { tone: 'info', text: <>Geometric squeeze only: stretch onto the groove, temperature, swell and compression set come off this. See <A href="../../seals/o-ring-design/">O-ring design</A>. The runout adds to the eccentricity exactly as a looser pilot would.</> },
        { tone: 'info', text: "A groove with no runout or position on the drawing falls to the title block's general tolerance: often far looser than the seal can take." },
      ]} />
    </>
  );
}

function Body() {
  const { v } = useForm();
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'bonus', label: 'Bonus tolerance' }, { value: 'fast', label: 'Fastener patterns' }, { value: 'gland', label: 'Seal gland' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'bonus' ? (
          <Group legend="Feature of size with a position tolerance" hint="Δx and Δy: the measured axis from its true position, in the datum reference frame.">
            <FieldRow>
              <Choice name="b_kind" label="Feature" options={[{ value: 'hole', label: 'Hole' }, { value: 'pin', label: 'Pin or boss' }]} />
              <Choice name="b_mod" label="Material condition" options={[{ value: 'MMC', label: 'MMC' }, { value: 'LMC', label: 'LMC' }, { value: 'RFS', label: 'RFS (none)' }]} />
            </FieldRow>
            <FieldRow><Num name="b_min" label="Smallest size" unit="mm" /><Num name="b_max" label="Largest size" unit="mm" /></FieldRow>
            <FieldRow><Num name="b_tol" label="Position tolerance ⌀" unit="mm" /><Num name="b_act" label="Actual size" unit="mm" /></FieldRow>
            <FieldRow><Num name="b_dx" label="Measured Δx" unit="mm" /><Num name="b_dy" label="Measured Δy" unit="mm" /></FieldRow>
          </Group>
        ) : v.tab === 'fast' ? (
          <Group legend="Fastener pattern" hint="Fixed: the projection is the thickness of the part with clearance holes (how far the fastener stands out of its threaded hole).">
            <Choice name="f_type" label="Fastening" options={[{ value: 'fixed', label: 'Fixed: one part threaded' }, { value: 'floating', label: 'Floating: clearance holes in both' }]} />
            <FieldRow><Num name="f_F" label="Fastener, largest ⌀" unit="mm" /><Num name="f_H" label="Clearance hole at MMC ⌀" unit="mm" /></FieldRow>
            <Num name="f_t1" label="Clearance holes' tolerance ⌀" unit="mm" />
            <FieldRow><Num name="f_P" label="Projection: clamped part" unit="mm" /><Num name="f_D" label="Thread engagement, least" unit="mm" /></FieldRow>
          </Group>
        ) : (
          <Group legend="Radial O-ring gland" hint="Runout as full indicator movement, or a diametral position tolerance: either moves the groove off its pilot by half. Defaults: the O-ring page's nozzle-to-case seal.">
            <FieldRow><Num name="g_bmin" label="Bore, smallest" unit="mm" /><Num name="g_bmax" label="Bore, largest" unit="mm" /></FieldRow>
            <FieldRow><Num name="g_pmin" label="Pilot, smallest" unit="mm" /><Num name="g_pmax" label="Pilot, largest" unit="mm" /></FieldRow>
            <FieldRow><Num name="g_rmin" label="Groove root, smallest" unit="mm" /><Num name="g_rmax" label="Groove root, largest" unit="mm" /></FieldRow>
            <Num name="g_run" label="Groove runout to the pilot" unit="mm" />
            <FieldRow><Num name="g_cmin" label="Ring section, smallest" unit="mm" /><Num name="g_cmax" label="Ring section, largest" unit="mm" /></FieldRow>
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'bonus' ? <Bonus /> : v.tab === 'fast' ? <Fasteners /> : <Gland />}</Outputs>
    </>
  );
}

export default function Gdt() {
  return (
    <Calc
      id="gdt"
      title="GD&T: bonus, fasteners, gland"
      defaults={{
        tab: 'bonus', b_kind: 'hole', b_mod: 'MMC', b_min: '11.0', b_max: '11.2', b_tol: '0.5', b_act: '11.15', b_dx: '0.18', b_dy: '0.21',
        f_type: 'fixed', f_F: '10', f_H: '11.0', f_t1: '0.5', f_P: '24', f_D: '15',
        g_bmin: '150.000', g_bmax: '150.063', g_pmin: '149.860', g_pmax: '149.900', g_rmin: '141.45', g_rmax: '141.55', g_run: '0.05', g_cmin: '5.20', g_cmax: '5.46',
      }}
      foot="ASME Y14.5 conventions. Bonus tolerance and virtual condition for an MMC- or LMC-modified feature of size; fastener formulas from the standard's appendix; gland depth over every combination of limits, with squeeze from the ring section alone."
    >
      <Body />
    </Calc>
  );
}
