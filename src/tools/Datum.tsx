// Datums and position in two tabs: a measured hole pattern checked in a fixed datum frame, with the datum shift a pilot at
// MMB allows, and against a composite lower segment; and the sizes of a functional gauge. The gauge-tolerance policy is the
// programme's and starts blank. Maths in src/lib/datums.ts (unit-tested).
import React from 'react';
import { patternCheck, datumShift, gaugeSizes, type Hole } from '../lib/datums';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Check, Lines, ModeTabs, Readouts, Readout, Notes, Figure, useForm, num, fmt, HALO, type Tone } from './kit';

const f = (v: number, d = 3) => fmt(v, d);
const HOLES = `H1, 0.048, -0.008, 11.07
H2, 0.131, -0.009, 11.08
H3, 0.032, 0.043, 11.04
H4, 0.074, -0.001, 11.02
H5, -0.126, 0.109, 11.05
H6, -0.054, -0.114, 11.06
H7, 0.025, 0.033, 11.04
H8, 0.261, 0.042, 11.02
H9, 0.047, -0.081, 11.06
H10, 0.262, 0.017, 11.01
H11, 0.201, 0.116, 11.02
H12, -0.048, -0.028, 11.03
H13, 0.141, -0.119, 11.02
H14, 0.108, -0.089, 11.03
H15, 0.079, 0.166, 11.04
H16, 0.125, 0.134, 11.04
H17, -0.065, 0.071, 11.01
H18, 0.125, -0.090, 11.08
H19, -0.103, -0.176, 11.02
H20, -0.023, -0.047, 11.09
H21, 0.216, -0.052, 11.05
H22, 0.118, 0.077, 11.07
H23, -0.153, 0.096, 11.08
H24, 0.160, 0.150, 11.03
H25, -0.075, -0.060, 11.04
H26, -0.056, 0.089, 11.07
H27, 0.143, -0.218, 11.02
H28, -0.124, 0.112, 11.04
H29, 0.006, -0.219, 11.05
H30, 0.126, -0.091, 11.02`;

function Pattern() {
  const { v } = useForm();
  const notes: { tone: Tone; text: string }[] = [];
  const lines = v.p_rows.split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((s) => s.trim())).filter((p) => p.length >= 4 && p.slice(-3).every((x) => x !== '' && Number.isFinite(+x)));
  const names = lines.map((p) => p.slice(0, -3).join(', ') || '?');
  const holes: Hole[] = lines.map((p) => ({ dx: +p.at(-3)!, dy: +p.at(-2)!, size: +p.at(-1)! }));
  const mmc = num(v.p_mmc), tol = num(v.p_tol), bonus = v.p_bonus === 'true', mmb = v.p_mmb === 'true';
  const shift = mmb ? datumShift(num(v.p_pmmc), num(v.p_ptol) || 0, num(v.p_pact)) : 0;
  const low = num(v.p_low), R = num(v.p_R) || 0;
  if (holes.length < 1 || !(tol > 0) || !Number.isFinite(mmc)) return <Notes items={[{ tone: 'bad', text: 'Enter at least one hole as “name, Δx, Δy, size”, the hole MMC and the position tolerance.' }]} />;
  const r = patternCheck({ holes, mmc, tol, bonus, shift: Number.isFinite(shift) ? shift : 0, lowerTol: low > 0 ? low : undefined, R, n: holes.length });
  const badNames = r.fixed.map((h, i) => (h.pos > h.allowed + 1e-12 ? names[i] : '')).filter(Boolean);
  const shiftedOk = r.shifted.worst <= 1 + 1e-9;
  if (mmb) {
    if (r.failsFixed && shiftedOk) notes.push({ tone: 'ok', text: "The part conforms: the drawing lets the pattern move with the pilot's departure from MMB, and a functional gauge would accept it. A CMM program that holds the pattern to the pilot's actual axis rejects it wrongly." });
    if (!shiftedOk) notes.push({ tone: 'bad', text: 'No move within the datum shift brings every hole into its zone: the part does not conform.' });
  }
  notes.push({ tone: 'info', text: "The shift is free tolerance only if the assembly has the same freedom: the pilot's clearance in its mating bore at least as large as the shift. Otherwise reference the pilot regardless of material boundary." });

  const W = 420, H = 300, cx = W / 2, cy = 160;
  const ext = Math.max(tol / 2 + Math.max(0, ...holes.map((h) => h.size - mmc)) * (bonus ? 0.5 : 0), ...holes.map((h) => Math.hypot(h.dx, h.dy))) * 1.15;
  const sc = Math.min(W / 2 - 16, 120) / ext, X = (x: number) => cx + x * sc, Y = (y: number) => cy - y * sc;
  const minAllow = Math.min(...r.fixed.map((h) => h.allowed));
  return (
    <>
      <Readouts>
        <Readout label="Fixed frame" value={r.failsFixed ? `${r.failsFixed} of ${holes.length} outside` : 'all inside'} tone={r.failsFixed ? 'bad' : 'ok'}
          sub={`worst ${f(r.worstFixed, 3)} of allowed${badNames.length ? ` · ${badNames.join(', ')}` : ''}: holes held to the pilot's actual axis`} />
        {mmb ? (
          <>
            <Readout label="Datum shift available" value={`⌀${f(shift)}`} sub={`MMB ⌀${f(num(v.p_pmmc) + (num(v.p_ptol) || 0))} minus the actual pilot: up to ${f(shift / 2)} mm in any direction`} />
            <Readout label="With the datum shift" value={shiftedOk ? 'all inside' : 'still outside'} primary tone={shiftedOk ? 'ok' : 'bad'}
              sub={`worst ${f(r.shifted.worst, 3)} of allowed · pattern moved (${f(r.shifted.s[0])}, ${f(r.shifted.s[1])}) mm`} />
          </>
        ) : (
          <Readout label="Datum shift" value="none" primary tone={r.failsFixed ? 'bad' : 'ok'} sub="pilot referenced regardless of material boundary: the pattern is held to its actual axis" />
        )}
        {r.lower ? (
          <Readout label="Composite lower segment" value={r.lower.worst <= 1 + 1e-9 ? 'inside' : 'outside'} tone={r.lower.worst <= 1 + 1e-9 ? 'ok' : 'bad'}
            sub={`worst ${f(r.lower.worst, 3)} of allowed · holes to each other, free to shift and turn (${f(r.lower.theta * 1000, 3)} mrad)`} />
        ) : null}
      </Readouts>
      <Figure
        label="Measured hole deviations against the position zone"
        caption="Each hole's measured deviation (red: outside its zone with the pattern held to the pilot's axis). The solid circle is the tightest hole's zone at the axis; the dashed one is the same zone moved by the best shift the pilot allows, inside the shaded disc."
      >
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <line x1={X(-ext)} x2={X(ext)} y1={cy} y2={cy} stroke="var(--rd-line)" />
          <line x1={cx} x2={cx} y1={Y(-ext)} y2={Y(ext)} stroke="var(--rd-line)" />
          {shift > 0 ? <circle cx={cx} cy={cy} r={(shift / 2) * sc} fill="var(--rd-warn)" fillOpacity={0.25} /> : null}
          <circle cx={cx} cy={cy} r={(minAllow / 2) * sc} fill="none" stroke="var(--rd-blue)" strokeWidth={1.6} />
          {mmb && shift > 0 ? <circle cx={X(r.shifted.s[0])} cy={Y(r.shifted.s[1])} r={(minAllow / 2) * sc} fill="none" stroke="var(--rd-ok)" strokeWidth={1.6} strokeDasharray="5 3" /> : null}
          {holes.map((h, i) => <circle key={i} cx={X(h.dx)} cy={Y(h.dy)} r={3.2} fill={r.fixed[i].pos > r.fixed[i].allowed + 1e-12 ? 'var(--rd-accent)' : 'var(--rd-ink)'} fillOpacity={0.85} />)}
          <text x={8} y={17} fontSize={12} fill="var(--rd-blue)">{`zone ⌀${f(minAllow, 2)} at the axis`}</text>
          {mmb && shift > 0 ? <text x={8} y={33} fontSize={12} fill="var(--rd-ok)">the same zone, shifted</text> : null}
          <text x={W - 8} y={H - 8} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{`${f(ext * 2, 2)} mm across`}</text>
          {shift > 0 ? <text x={8} y={H - 8} fontSize={12} fill="var(--rd-warn)">shaded: shift allowed</text> : null}
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Gauge() {
  const { v } = useForm();
  const hole = { mmc: num(v.g_hmmc), lmc: num(v.g_hlmc), tol: num(v.g_htol) }, pilot = { mmc: num(v.g_pmmc), lmc: num(v.g_plmc), tol: num(v.g_ptol) || 0 };
  const n = Math.round(num(v.g_n)) || 1, bc = num(v.g_bc), gt = num(v.g_gt);
  if (!(hole.lmc > hole.mmc && hole.tol >= 0 && pilot.mmc > pilot.lmc)) return <Notes items={[{ tone: 'bad', text: 'Check the limits: hole LMC above its MMC, pilot MMC above its LMC.' }]} />;
  const g = gaugeSizes(hole, pilot, gt > 0 ? gt / 100 : 0);
  const W = 420, H = 300, cx = W / 2, cy = 150, Rg = Math.min(W / 2 - 30, 118), sc = Rg / (bc / 2);
  return (
    <>
      <Readouts>
        <Readout label="Pins" value={`${n} × ⌀${f(g.pin)}${gt > 0 ? `–${f(g.pinMax)}` : ''}`} primary sub={`the holes' virtual condition, MMC − position tolerance, on a basic ⌀${fmt(bc, 1)} circle`} />
        <Readout label="Datum B ring" value={`⌀${gt > 0 ? `${f(g.ringMin)}–` : ''}${f(g.ring)}`} sub="the pilot's MMB, MMC + its own tolerance at MMC" />
        <Readout label="Datum A" value="a flat plate" sub="the seating face rests on it at its high points" />
        {gt > 0 ? (
          <Readout label="Taken from the part" value={`up to ${f(g.gtPin)}`} unit="mm" tone="warn" sub="of each hole's tolerance, under an absolute policy: the gauge never accepts a bad part, and rejects some good ones" />
        ) : (
          <Readout label="Gauge tolerance" value="needs your policy" sub="Enter your programme's gauge-tolerance policy to see how much part tolerance the gauge takes. Or press “Load worked example”." />
        )}
      </Readouts>
      <Figure
        label="Top view of the functional gauge"
        caption="A top view of the gauge, not to scale: a ring for the pilot at its MMB, pins at the holes' virtual condition on the basic bolt circle, and a plate under it all for datum A."
      >
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <circle cx={cx} cy={cy} r={Rg + 22} fill="var(--rd-steel)" fillOpacity={0.12} stroke="var(--rd-steel)" />
          <circle cx={cx} cy={cy} r={Rg} fill="none" stroke="var(--rd-line)" strokeDasharray="3 4" />
          <circle cx={cx} cy={cy} r={Math.max(12, (g.ring / 2) * sc)} fill="none" stroke="var(--rd-accent)" strokeWidth={3} />
          {Array.from({ length: n }, (_, i) => {
            const a = (2 * Math.PI * i) / n;
            return <circle key={i} cx={cx + Rg * Math.cos(a)} cy={cy - Rg * Math.sin(a)} r={Math.max(2.2, Math.min(6, (g.pin / 2) * sc))} fill="var(--rd-blue)" />;
          })}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={12} fill="var(--rd-accent)" {...HALO}>{`ring ⌀${f(g.ring, 2)}`}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={12} fill="var(--rd-blue)" {...HALO}>{`${n} pins ⌀${f(g.pin, 2)}`}</text>
          <text x={8} y={H - 8} fontSize={12} fill="var(--rd-muted)">{`pins on a basic ⌀${fmt(bc, 0)} circle`}</text>
        </svg>
      </Figure>
      <Notes
        items={[
          { tone: 'info', text: 'A fixed gauge checks only MMC and MMB conditions. A datum or feature at RFS needs an expanding element, or a CMM.' },
          { tone: 'info', text: 'The gauge checks location, not size: hole and pilot sizes need their own go/no-go gauges or measurement.' },
        ]}
      />
    </>
  );
}

function Body() {
  const { v } = useForm();
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'pattern', label: 'Measured pattern' }, { value: 'gauge', label: 'Functional gauge' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'pattern' ? (
          <Group
            legend="Hole pattern, as measured"
            hint="Δx, Δy: each hole's measured axis from its true position, in the frame of A and C with the pilot's actual axis as origin. Holes are taken as equally spaced from the +x axis."
          >
            <Lines name="p_rows" label="Holes: name, Δx, Δy, actual size (mm)" rows={8} />
            <FieldRow>
              <Num name="p_mmc" label="Hole MMC ⌀" unit="mm" />
              <Num name="p_tol" label="Position tolerance ⌀" unit="mm" />
            </FieldRow>
            <Check name="p_bonus" label="Holes at MMC (bonus)" />
            <Check name="p_mmb" label="Pilot datum at MMB" />
            <FieldRow>
              <Num name="p_pmmc" label="Pilot MMC ⌀" unit="mm" />
              <Num name="p_ptol" label="Pilot's own tolerance at MMC" unit="mm" />
            </FieldRow>
            <FieldRow>
              <Num name="p_pact" label="Pilot actual ⌀" unit="mm" />
              <Num name="p_low" label="Composite lower ⌀" unit="mm" placeholder="none" />
            </FieldRow>
            <Num name="p_R" label="Bolt circle radius" unit="mm" />
          </Group>
        ) : (
          <Group legend="Gauge for a hole pattern on a pilot" hint="Feature tolerance here is size plus geometric. The gauge-tolerance and wear policy comes from your programme or ASME Y14.43.">
            <FieldRow>
              <Num name="g_hmmc" label="Hole MMC ⌀" unit="mm" />
              <Num name="g_hlmc" label="Hole LMC ⌀" unit="mm" />
            </FieldRow>
            <FieldRow>
              <Num name="g_htol" label="Hole position ⌀ at MMC" unit="mm" />
              <Num name="g_n" label="Number of holes" />
            </FieldRow>
            <FieldRow>
              <Num name="g_bc" label="Bolt circle ⌀" unit="mm" />
              <Num name="g_pmmc" label="Pilot MMC ⌀" unit="mm" />
            </FieldRow>
            <FieldRow>
              <Num name="g_plmc" label="Pilot LMC ⌀" unit="mm" />
              <Num name="g_ptol" label="Pilot's tolerance at MMC" unit="mm" />
            </FieldRow>
            <Num name="g_gt" label="Gauge tolerance" unit="% of feature tolerance" placeholder="your policy" />
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'pattern' ? <Pattern /> : <Gauge />}</Outputs>
    </>
  );
}

export default function Datum() {
  return (
    <Calc
      id="datums"
      title="Datums & position: pattern, shift, gauge"
      defaults={{
        tab: 'pattern', p_rows: HOLES, p_mmc: '11.0', p_tol: '0.5', p_bonus: 'true', p_mmb: 'true', p_pmmc: '255.90', p_ptol: '0.02', p_pact: '255.83', p_low: '', p_R: '142.5',
        g_hmmc: '11.0', g_hlmc: '11.2', g_htol: '0.5', g_n: '30', g_bc: '285', g_pmmc: '255.90', g_plmc: '255.80', g_ptol: '0.02', g_gt: '',
      }}
      example={{ values: { g_gt: '5' }, note: "Worked-example value loaded: gauge tolerance 5% of each feature's tolerance", factorFields: ['g_gt'] }}
      foot="ASME Y14.5 conventions. Fixed frame: each hole against its tolerance plus bonus. Datum shift: the whole pattern moved by the best translation within half the shift available. Composite lower segment: free translation and rotation. Minimax fits by a restarted Nelder–Mead search."
    >
      <Body />
    </Calc>
  );
}
