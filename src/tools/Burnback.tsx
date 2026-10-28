// Grain burn-back and thrust-profile simulator: the port shape burns back on a distance map drawn on a canvas, with
// burning area against web and pressure and thrust against time. Geometry and ballistics in src/lib/grain.ts
// (unit-tested).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Slider, Text, useTheme } from '@castui/cast-ui';
import { burnBack, performance as motorPerformance, throatForPeak, type GrainGeometry, type Port } from '../lib/grain';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Choice, Hint, Readouts, Readout, Notes, Figure, Sub, Sup, useForm, useSlowValues, num, fmt, type Tone, type Values } from './kit';

const PRESETS: { key: string; label: string; values: Values }[] = [
  { key: 'tube', label: 'Tube (progressive)', values: { kind: 'circular', d: '80', od: '150', length: '600', segments: '1', ends: '0' } },
  { key: 'star', label: '7-point star', values: { kind: 'star', points: '7', tipD: '110', valleyD: '40', od: '150', length: '600', segments: '1', ends: '0' } },
  { key: 'slots', label: 'Slotted', values: { kind: 'slots', slots: '6', coreD: '40', slotW: '8', slotD: '110', od: '150', length: '600', segments: '1', ends: '0' } },
  { key: 'bates', label: 'BATES ×4', values: { kind: 'circular', d: '60', od: '150', length: '255', segments: '4', ends: '2' } },
  { key: 'end', label: 'End burner', values: { kind: 'end', od: '150', length: '300', segments: '1', ends: '1' } },
];
const GRID = 300;
const f = (v: number, d = 1) => (Number.isFinite(v) ? fmt(v, d) : '—');
const PROFILE = { progressive: 'Progressive', neutral: 'Neutral', regressive: 'Regressive', 'progressive-regressive': 'Rises then falls' } as const;

const hexToRgb = (hex: string): number[] => {
  const h = hex.trim().replace('#', ''), v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const mix = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t));

function geometry(v: Values): GrainGeometry {
  const kind = v.kind as Port['kind'];
  const port: Port =
    kind === 'circular' ? { kind, d: num(v.d) }
    : kind === 'star' ? { kind, points: Math.round(num(v.points)), tipD: num(v.tipD), valleyD: num(v.valleyD) }
    : kind === 'slots' ? { kind, slots: Math.round(num(v.slots)), coreD: num(v.coreD), slotW: num(v.slotW), slotD: num(v.slotD) }
    : { kind: 'end' };
  return { od: num(v.od), length: num(v.length), segments: Math.max(1, Math.round(num(v.segments)) || 1), burningEnds: kind === 'end' ? 1 : (Math.round(num(v.ends)) as 0 | 1 | 2), port };
}

function invalid(g: GrainGeometry): string | null {
  const p = g.port;
  if (!(g.od > 0 && g.length > 0)) return 'Grain OD and length must be positive.';
  if (p.kind === 'circular' && !(p.d > 0 && p.d < g.od)) return 'Port diameter must be between 0 and the grain OD.';
  if (p.kind === 'star' && !(p.points >= 3 && p.points <= 16 && p.valleyD > 0 && p.tipD > p.valleyD && p.tipD < g.od)) return 'A star needs 3 to 16 points and 0 < valley ⌀ < tip ⌀ < grain OD.';
  if (p.kind === 'slots' && !(p.slots >= 1 && p.slots <= 16 && p.coreD > 0 && p.slotD < g.od && p.slotD > p.coreD && p.slotW > 0 && p.slotW < p.coreD))
    return 'Slots need 1 to 16 slots, core ⌀ < slot tip ⌀ < grain OD, and slot width < core ⌀.';
  return null;
}

/** Re-render when the site theme changes (the canvas reads the diagram colours). */
function useThemeKey() {
  const [k, setK] = useState(0);
  useEffect(() => {
    const mo = new MutationObserver(() => setK((x) => x + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return k;
}

type Axes = { X: (x: number) => number; Y: (y: number) => number; T: number; B: number; H: number };
const nice = (m: number) => { const e = 10 ** Math.floor(Math.log10(m)); return [1, 2, 2.5, 5, 10].map((k) => k * e).find((s) => m / s <= 6)!; };
function Chart({ xMax, yMax, xl, yl, y2, label, caption, children }: {
  xMax: number; yMax: number; xl: string; yl: string; y2?: { max: number; label: string }; label: string; caption: string; children: (a: Axes) => React.ReactNode;
}) {
  const W = 480, H = 250, L = 56, R = y2 ? 56 : 14, T = 14, B = 40;
  const X = (x: number) => L + (x / xMax) * (W - L - R), Y = (y: number) => H - B - (y / yMax) * (H - T - B);
  const sx = nice(xMax), sy = nice(yMax), xs: number[] = [], ys: number[] = [];
  for (let x = 0; x <= xMax + 1e-9; x += sx) xs.push(x);
  for (let y = 0; y <= yMax + 1e-9; y += sy) ys.push(y);
  const mid = (T + H - B) / 2;
  return (
    <Figure label={label} caption={caption}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {xs.map((x) => (
          <g key={`x${x}`}>
            <line x1={X(x)} x2={X(x)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            <text x={X(x)} y={H - B + 15} textAnchor="middle" fontSize={12} fill="var(--rd-muted)">{fmt(x, sx >= 1 ? 0 : sx >= 0.1 ? 1 : 2)}</text>
          </g>
        ))}
        {ys.map((y) => (
          <g key={`y${y}`}>
            <line x1={L} x2={W - R} y1={Y(y)} y2={Y(y)} stroke="var(--rd-line)" />
            <text x={L - 6} y={Y(y) + 4} textAnchor="end" fontSize={12} fill="var(--rd-muted)">{fmt(y, sy >= 1 ? 0 : sy >= 0.1 ? 1 : 2)}</text>
            {y2 ? <text x={W - R + 6} y={Y(y) + 4} fontSize={12} fill="var(--rd-blue)">{fmt((y / yMax) * y2.max, y2.max < 10 ? 1 : 0)}</text> : null}
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--rd-ink)">{xl}</text>
        <text x={12} y={mid} textAnchor="middle" fontSize={12} fill="var(--rd-ink)" transform={`rotate(-90 12 ${mid})`}>{yl}</text>
        {y2 ? <text x={W - 12} y={mid} textAnchor="middle" fontSize={12} fill="var(--rd-blue)" transform={`rotate(90 ${W - 12} ${mid})`}>{y2.label}</text> : null}
        {children({ X, Y, T, B, H })}
      </svg>
    </Figure>
  );
}

function Presets() {
  const { setMany } = useForm();
  const { spacing, scheme } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text type="label-md" color={scheme.text.primary}>Start from a grain</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map((p) => (
          <Chip key={p.key} size="small" onPress={() => setMany(p.values)}>{p.label}</Chip>
        ))}
      </View>
    </View>
  );
}

function Results() {
  const v = useSlowValues();
  const { spacing, scheme } = useTheme();
  const themeKey = useThemeKey();
  const g = useMemo(() => geometry(v), [v]);
  const err = invalid(g);
  const gKey = JSON.stringify(g);
  const bb = useMemo(() => (err ? null : burnBack(g, 160, GRID)), [gKey, err]); // eslint-disable-line react-hooks/exhaustive-deps
  const prop = { rhoP: num(v.rho), a: num(v.a), n: Math.min(0.95, num(v.n)), cStar: num(v.cstar) };
  const propOk = prop.rhoP > 0 && prop.a > 0 && prop.n >= 0 && prop.cStar > 0 && num(v.cf) > 0;
  const dt = bb && propOk ? (v.tmode === 'peak' ? throatForPeak(bb, prop, num(v.ppeak)) : num(v.dt)) : NaN;
  const perf = bb && propOk && dt > 0 ? motorPerformance(bb, prop, dt, num(v.cf)) : null;

  const [frac, setFrac] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  useEffect(() => setFrac(0), [gKey]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      let done = false;
      setFrac((x) => { const n = Math.min(1, x + (now - last) / 5000); done = n >= 1; return n; });
      last = now;
      if (done) setPlaying(false); else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
  const play = () => {
    if (playing) return setPlaying(false);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setFrac(1);
    if (frac >= 1) setFrac(0);
    setPlaying(true);
  };

  const canvas = useRef<HTMLCanvasElement | null>(null);
  const y = bb ? frac * bb.burnout : 0;
  let t = 0;
  if (perf) for (let i = 1; i < perf.trace.length; i++) if (perf.trace[i].y <= y) t = perf.trace[i].t;
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !bb) return;
    const cs = getComputedStyle(cv);
    const col = (name: string) => hexToRgb(cs.getPropertyValue(name) || '#888888');
    const panel = col('--rd-panel'), propC = col('--rd-propellant'), hot = col('--rd-hot'), front = col('--rd-accent'), gas = mix(panel, hot, 0.22);
    const ctx = cv.getContext('2d')!, W = cv.width;
    ctx.clearRect(0, 0, W, W);
    if (!bb.map) {
      // an end burner: the face, shaded by how much has burned
      ctx.fillStyle = `rgb(${mix(propC, gas, frac).join(',')})`;
      ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 4, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = `rgb(${col('--rd-ink').join(',')})`;
      ctx.font = '12px monospace'; ctx.textAlign = 'center';
      ctx.fillText('burns face-on, along the length', W / 2, W / 2);
    } else {
      const { n, dist, h } = bb.map, img = ctx.createImageData(n, n), band = Math.max(bb.web, 1) / 8;
      for (let k = 0; k < n * n; k++) {
        const d = dist[k];
        const c = Number.isNaN(d) ? null : d === 0 || d < y - 1.2 * h ? gas : Math.abs(d - y) <= 1.2 * h && y > 0 ? front : mix(propC, panel, Math.floor(d / band) % 2 ? 0.12 : 0);
        const o = 4 * k;
        if (c) { img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; }
      }
      const off = document.createElement('canvas');
      off.width = n; off.height = n;
      off.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 4, 4, W - 8, W - 8);
    }
    ctx.strokeStyle = `rgb(${col('--rd-steel').join(',')})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 3, 0, 2 * Math.PI); ctx.stroke();
  }, [bb, frac, y, themeKey]);

  if (err) return <Notes items={[{ tone: 'bad', text: err }]} />;
  if (!bb || !perf) return <Notes items={[{ tone: 'bad', text: 'Check the propellant and the throat: every value must be positive, with n below 0.95.' }]} />;
  const b = bb, p = perf, end = g.port.kind === 'end', n = prop.n;
  const notes: { tone: Tone; text: React.ReactNode }[] = [
    { tone: 'info', text: <>Pressure swings by (A<Sub>b</Sub> max ÷ min)<Sup>1/(1−n)</Sup> = {f(p.progressivity ** (1 / (1 - n)), 2)}× over the main burn: the burning-area swing, amplified.</> },
  ];
  if (!end && p.portToThroat < 2) notes.push({ tone: 'warn', text: `Port area is only ${f(p.portToThroat, 2)}× the throat area at ignition. Gas races down the bore: expect erosive burning and an ignition pressure spike that this model does not show. A common rule of thumb keeps this ratio above about 2.` });
  if (b.sliverFraction > 0.08) notes.push({ tone: 'warn', text: `${f(b.sliverFraction * 100, 0)}% of the propellant is sliver, burning in the low-pressure tail-off after the flame first reaches the case. Fillets, sliver inserts or a different geometry reduce it.` });
  if (p.pMax > 0 && p.pMax / Math.max(1e-6, p.pAvg) > 1.5) notes.push({ tone: 'warn', text: `Peak pressure is ${f(p.pMax / p.pAvg, 2)}× the average. The case has to be sized for the peak (and then for MEOP), so a peaky trace costs case mass.` });
  if (end) notes.push({ tone: 'info', text: 'An end burner has the most propellant and the longest burn for its size, but the lowest thrust, and the case is exposed to hot gas for the whole burn behind the receding face.' });
  const abMax = Math.max(...b.steps.map((s) => s.burnArea)) / 100 || 1;
  const tMax = p.burnTime || 1;

  return (
    <>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <canvas ref={canvas} width={300} height={300} role="img" aria-label={`Grain cross-section coloured by burn distance, ${f(y, 1)} mm of web burned`} style={{ width: 'min(100%, 300px)', aspectRatio: '1' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: '100%', maxWidth: 380 }}>
          <Button size="small" prominence="default" intent="brand" leadingIcon={playing ? 'pause' : 'play_arrow'} onPress={play}>{playing ? 'Pause' : 'Burn'}</Button>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Slider value={frac * 1000} min={0} max={1000} step={1} onValueChange={(x) => { setPlaying(false); setFrac(x / 1000); }} accessibilityLabel="Web burned" />
          </View>
        </View>
        <Text type="label-sm" color={scheme.text.description} style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{`web burned ${f(y, 1)} mm · t = ${f(t, 2)} s`}</Text>
      </View>
      <Readouts>
        <Readout label="Thrust profile" value={PROFILE[p.profile]} primary sub={`burning area max ÷ min ${f(p.progressivity, 2)}`} />
        <Readout label="Burn time" value={f(p.mainBurnTime < p.burnTime - 0.01 ? p.mainBurnTime : p.burnTime, 2)} unit="s" sub={p.mainBurnTime < p.burnTime - 0.01 ? `main burn · ${f(p.burnTime, 2)} s total` : undefined} />
        <Readout label="Total impulse" value={f(p.impulse / 1000, 1)} unit="kN·s" />
        <Readout label="Thrust, main-burn average / peak" value={`${f(p.fAvg / 1000, 2)} / ${f(p.fMax / 1000, 2)}`} unit="kN" />
        <Readout label="Chamber pressure, average / peak" value={`${f(p.pAvg, 2)} / ${f(p.pMax, 2)}`} unit="MPa" />
        <Readout label="Propellant mass" value={f(p.propMass, 2)} unit="kg" />
        <Readout label="Volumetric loading" value={`${f(b.volumetricLoading * 100, 0)}%`} />
        <Readout label="Web fraction" value={end ? '—' : f(b.web / (g.od / 2), 2)} />
        <Readout label="Sliver" value={`${f(b.sliverFraction * 100, 1)}%`} tone={b.sliverFraction > 0.08 ? 'warn' : undefined} />
        <Readout label="Throat ⌀" value={f(p.throatD, 1)} unit="mm" sub={<>K<Sub>n</Sub> at start {f(p.trace[0].kn, 0)}</>} />
        <Readout label="Port ÷ throat area" value={end ? '—' : f(p.portToThroat, 2)} tone={!end && p.portToThroat < 2 ? 'warn' : undefined} />
      </Readouts>
      <Chart xMax={b.burnout} yMax={abMax * 1.1} xl="web burned (mm)" yl="burning area (cm²)" label="Burning surface area against web burned"
        caption="Burning surface area against web burned. The orange cursor follows the slider.">
        {(A) => (
          <>
            <path d={b.steps.map((s, i) => `${i ? 'L' : 'M'}${A.X(s.y).toFixed(1)},${A.Y(s.burnArea / 100).toFixed(1)}`).join('')} fill="none" stroke="var(--rd-hot)" strokeWidth={2.5} />
            {b.web < b.burnout - 1e-6 ? (
              <>
                <line x1={A.X(b.web)} x2={A.X(b.web)} y1={A.T} y2={A.H - A.B} stroke="var(--rd-muted)" strokeDasharray="4 4" />
                <text x={A.X(b.web) - 4} y={A.T + 12} textAnchor="end" fontSize={12} fill="var(--rd-muted)">flame reaches case → sliver</text>
              </>
            ) : null}
            <line x1={A.X(y)} x2={A.X(y)} y1={A.T} y2={A.H - A.B} stroke="var(--rd-accent)" strokeWidth={1.5} />
          </>
        )}
      </Chart>
      <Chart xMax={tMax} yMax={p.pMax * 1.15 || 1} xl="time (s)" yl="chamber pressure (MPa)" y2={{ max: (p.fMax * 1.15) / 1000, label: 'thrust (kN)' }}
        label="Chamber pressure and thrust against time"
        caption="Chamber pressure against time (left scale); thrust is proportional to it here, F = CF·p·At (right scale).">
        {(P) => (
          <>
            <path d={p.trace.map((s, i) => `${i ? 'L' : 'M'}${P.X(s.t).toFixed(1)},${P.Y(s.p).toFixed(1)}`).join('')} fill="none" stroke="var(--rd-blue)" strokeWidth={2.5} />
            <line x1={P.X(t)} x2={P.X(t)} y1={P.T} y2={P.H - P.B} stroke="var(--rd-accent)" strokeWidth={1.5} />
          </>
        )}
      </Chart>
      <Notes items={notes} />
    </>
  );
}

function Body() {
  const { v } = useForm();
  const kind = v.kind;
  return (
    <>
      <Wide>
        <Presets />
      </Wide>
      <Inputs>
        <Group legend="Port shape">
          <Choice name="kind" label="Cross-section" options={[{ value: 'circular', label: 'Circular (tube)' }, { value: 'star', label: 'Star' }, { value: 'slots', label: 'Core + radial slots' }, { value: 'end', label: 'None: end burner' }]} />
          {kind === 'circular' ? <Num name="d" label="Port diameter" unit="mm" /> : null}
          {kind === 'star' ? (
            <>
              <Num name="points" label="Points" />
              <FieldRow><Num name="tipD" label="Tip ⌀" unit="mm" /><Num name="valleyD" label="Valley ⌀" unit="mm" /></FieldRow>
            </>
          ) : null}
          {kind === 'slots' ? (
            <>
              <FieldRow><Num name="slots" label="Slots" /><Num name="coreD" label="Core ⌀" unit="mm" /></FieldRow>
              <FieldRow><Num name="slotW" label="Slot width" unit="mm" /><Num name="slotD" label="Slot tip ⌀" unit="mm" /></FieldRow>
            </>
          ) : null}
        </Group>
        <Group legend="Grain">
          <FieldRow><Num name="od" label="Grain OD" unit="mm" /><Num name="length" label="Segment length" unit="mm" /></FieldRow>
          <FieldRow>
            <Num name="segments" label="Segments" />
            {kind !== 'end' ? <Choice name="ends" label="Burning ends per segment" options={[{ value: '0', label: '0: inhibited' }, { value: '1', label: '1' }, { value: '2', label: '2' }]} /> : null}
          </FieldRow>
        </Group>
        <Group legend="Propellant and nozzle" hint="Defaults are generic AP/HTPB-like values for illustration, not a real propellant.">
          <FieldRow><Num name="a" label="a" unit="mm/s at 1 MPa" /><Num name="n" label="n" /></FieldRow>
          <FieldRow><Num name="rho" label="Density" unit="kg/m³" /><Num name="cstar" label="c*" unit="m/s" /></FieldRow>
          <Num name="cf" label="Thrust coefficient CF" />
          <Choice name="tmode" label="Throat" options={[{ value: 'peak', label: 'Size it for a peak pressure' }, { value: 'fixed', label: 'Fixed diameter' }]} />
          {v.tmode === 'peak' ? <Num name="ppeak" label="Peak chamber pressure" unit="MPa" /> : <Num name="dt" label="Throat diameter" unit="mm" />}
        </Group>
        <Hint>Change any value and the grain is burned back again.</Hint>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </>
  );
}

const DEFAULTS: Values = {
  kind: 'circular', d: '80', points: '7', tipD: '110', valleyD: '40', slots: '6', coreD: '40', slotW: '8', slotD: '110',
  od: '150', length: '600', segments: '1', ends: '0',
  a: '4.05', n: '0.35', rho: '1770', cstar: '1540', cf: '1.50', tmode: 'peak', ppeak: '7', dt: '30',
};

export default function Burnback() {
  return (
    <Calc
      id="burnback"
      title="Grain burn-back and thrust profile"
      defaults={DEFAULTS}
      foot="Quasi-steady 0-D model: uniform burn rate everywhere, no erosive burning, ignition transient, throat erosion or nozzle losses. Star points are sharp (real stars have fillet radii that change the sliver). Good for understanding and early layout; real motors are designed with full internal-ballistics codes and test data."
    >
      <Body />
    </Calc>
  );
}
