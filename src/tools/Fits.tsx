// ISO 286 fits in two tabs: limits and the clearance band across a temperature range for two materials, and an
// interference fit's contact pressure, stress, holding and shrink-fit temperature. Maths in src/lib/fits.ts and
// src/lib/expansion.ts (unit-tested).
import React from 'react';
import { DEFAULTS as D } from '../lib/materials';
import { HOLE_LETTERS, SHAFT_LETTERS, GRADES, isoFit, clearanceShift } from '../lib/fits';
import { EXP_MATERIALS, fitPressure, fitStresses, fitHolding } from '../lib/expansion';
import { materialGroups } from './materialOptions';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Choice, ModeTabs, Readouts, Readout, Notes, Plot, Poly, useForm, num, fmt, HALO, type Tone, type Values } from './kit';

const f = (v: number, d = 3) => fmt(v, d);
const um = (v: number) => { const n = Math.round(v * 1000); return n === 0 ? '0' : `${n > 0 ? '+' : '−'}${Math.abs(n)}`; };
const range = (a: number, b: number) => `${f(a)} to ${f(b)} mm`;
const M = (k: string) => EXP_MATERIALS.find((m) => m.key === k) ?? EXP_MATERIALS[0];
const kindOf = (a: number, b: number) => (a >= 0 ? 'clearance' : b <= 0 ? 'interference' : 'transition');
const GROUPS = materialGroups(EXP_MATERIALS);
const opts = (xs: readonly (string | number)[]) => xs.map((x) => ({ value: String(x), label: String(x) }));
type Note = { tone: Tone; text: string };

function readFit(v: Values, p: string, notes: Note[]) {
  const d = num(v[`${p}_d`]);
  try {
    return { d, fit: isoFit(d, v[`${p}_hl`], +v[`${p}_hg`], v[`${p}_sl`], +v[`${p}_sg`]) };
  } catch (e) {
    notes.push({ tone: 'bad', text: (e as Error).message.includes('500') ? 'Sizes here run to 500 mm.' : 'That letter and grade are not tabulated here.' });
    return null;
  }
}

function IsoFit() {
  const { v } = useForm();
  const notes: Note[] = [];
  const r = readFit(v, 'f', notes);
  if (!r) return <Notes items={notes} />;
  const { d, fit } = r, hm = M(v.f_hm), sm = M(v.f_sm), tc = num(v.f_tc), th = num(v.f_th);
  const at = (T: number) => { const s = clearanceShift(d, sm.alpha, hm.alpha, T); return [fit.cMin + s, fit.cMax + s]; };
  const [cc0, cc1] = at(tc), [ch0, ch1] = at(th);
  if (hm.alpha !== sm.alpha) {
    const tighter = sm.alpha > hm.alpha ? 'hot' : 'cold';
    notes.push({ tone: 'info', text: `The shaft expands ${sm.alpha > hm.alpha ? 'more' : 'less'} than the hole, so the fit tightens when ${tighter} by ${fmt(Math.abs(d * (sm.alpha - hm.alpha)) * 1000, 1)} µm per kelvin of difference.` });
  } else notes.push({ tone: 'info', text: 'Same material: a uniform temperature change leaves the fit alone. Transients (one part heating first) still change it.' });
  if (fit.kind === 'clearance' && Math.min(cc0, ch0) < 0) notes.push({ tone: 'bad', text: 'A clearance fit at 20 °C becomes an interference at one end of the range: a sliding or removable part seizes there.' });
  if (fit.kind === 'interference' && Math.max(cc1, ch1) > 0) notes.push({ tone: 'bad', text: 'An interference fit at 20 °C can go loose at one end of the range: it cannot be relied on to hold or locate there.' });
  const t0 = Math.min(tc, 20) - 10, t1 = Math.max(th, 20) + 10, Ts = [t0, t1];
  const ys = Ts.flatMap((T) => at(T)).concat(0).map((x) => x * 1000), lo = Math.min(...ys), hi = Math.max(...ys), pad = 0.1 * (hi - lo || 1);
  return (
    <>
      <Readouts>
        <Readout label="Hole" value={`⌀${f(fit.hole.min)} – ${f(fit.hole.max)}`} sub={`${v.f_hl}${v.f_hg}: ${um(fit.hole.EI / 1000)} / ${um(fit.hole.ES / 1000)} µm`} />
        <Readout label="Shaft" value={`⌀${f(fit.shaft.min)} – ${f(fit.shaft.max)}`} sub={`${v.f_sl}${v.f_sg}: ${um(fit.shaft.ei / 1000)} / ${um(fit.shaft.es / 1000)} µm`} />
        <Readout label="At 20 °C" value={fit.kind} primary sub={`clearance ${range(fit.cMin, fit.cMax)}: negative is interference`} />
        <Readout label={`At ${fmt(tc, 0)} °C`} value={kindOf(cc0, cc1)} tone={kindOf(cc0, cc1) !== fit.kind ? 'warn' : undefined} sub={range(cc0, cc1)} />
        <Readout label={`At ${fmt(th, 0)} °C`} value={kindOf(ch0, ch1)} tone={kindOf(ch0, ch1) !== fit.kind ? 'warn' : undefined} sub={range(ch0, ch1)} />
      </Readouts>
      <Plot
        x0={t0} x1={t1} y0={lo - pad} y1={hi + pad} xl="temperature (°C)" yl="clearance (µm)" legend={[["the fit's range", 'var(--rd-blue)']]}
        label="The fit's clearance range against temperature"
        caption="The fit's clearance range against temperature for the two materials: above zero the parts slide, below it they grip. Dashed lines mark the coldest, 20 °C and the hottest."
      >
        {(c) => (
          <>
            <polygon points={([[t0, 0], [t1, 0], [t1, 1], [t0, 1]] as const).map(([T, k]) => `${c.X(T)},${c.Y(at(T)[k] * 1000)}`).join(' ')} fill="var(--rd-blue)" fillOpacity={0.18} />
            <Poly s={c} pts={Ts.map((T) => [T, at(T)[0] * 1000])} color="var(--rd-blue)" w={1.8} />
            <Poly s={c} pts={Ts.map((T) => [T, at(T)[1] * 1000])} color="var(--rd-blue)" w={1.8} />
            {[tc, 20, th].map((T) => <line key={T} x1={c.X(T)} x2={c.X(T)} y1={c.T} y2={c.H - c.B} stroke={T === 20 ? 'var(--rd-ink)' : 'var(--rd-warn)'} strokeDasharray="3 3" strokeOpacity={0.7} />)}
            {lo < 0 ? <text x={c.W - c.R - 4} y={c.Y(0) + 15} textAnchor="end" fontSize={12} fill="var(--rd-accent)" {...HALO}>interference</text> : null}
            {hi > 0 ? <text x={c.W - c.R - 4} y={c.Y(0) - 6} textAnchor="end" fontSize={12} fill="var(--rd-ok)" {...HALO}>clearance</text> : null}
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Press() {
  const { v } = useForm();
  const notes: Note[] = [];
  const r = readFit(v, 'p', notes);
  if (!r) return <Notes items={notes} />;
  const { d, fit } = r, hub = M(v.p_hm), inner = M(v.p_sm), tc = num(v.p_tc), th = num(v.p_th);
  const Dd = num(v.p_D), di = num(v.p_di) || 0, L = num(v.p_L) || 0, mu = num(v.p_mu) || 0, fy = num(v.p_fy), ac = num(v.p_ac) || 0;
  if (!(Dd > d && di < d)) return <Notes items={[{ tone: 'bad', text: "The hub's outside diameter must exceed the fit diameter, and the inner part's bore be smaller than it." }]} />;
  const geo = { d, D: Dd, di, Eo: hub.E, nuo: hub.nu, Ei: inner.E, nui: inner.nu };
  const inter = (T: number) => { const s = clearanceShift(d, inner.alpha, hub.alpha, T); return [-(fit.cMax + s), -(fit.cMin + s)]; }; // [least, most]
  const temps = [tc, 20, th];
  const pr = temps.map((T) => inter(T).map((x) => fitPressure(x, geo)));
  const pMax = Math.max(...pr.map((p) => p[1])), tWorst = temps[pr.map((p) => p[1]).indexOf(pMax)];
  const loosest = temps.reduce((a, T) => (inter(T)[0] < inter(a)[0] ? T : a), temps[0]), dLoose = inter(loosest)[0];
  const st = fitStresses(pMax, geo), hold = fitHolding(fitPressure(dLoose, geo), d, L, mu);
  const shrink = (-fit.cMin + ac) / (hub.alpha * d);
  if (dLoose <= 0) notes.push({ tone: 'bad', text: `At ${fmt(loosest, 0)} °C the least interference is ${f(dLoose)} mm: the fit can go loose. Pin, key or bolt the parts, or choose materials and a fit that grip across the whole range.` });
  if (fy > 0 && st.vmOuter > 0.67 * fy) notes.push({ tone: 'warn', text: 'The hub runs above two-thirds of yield at the tightest corner: a heavier hub, a lighter fit, or a stronger material.' });
  notes.push({ tone: 'info', text: 'Part of the interference is lost as surface peaks flatten on assembly: methods such as DIN 7190 subtract a share of the roughness. Specify the finish on both parts.' });
  const t0 = Math.min(tc, 20) - 10, t1 = Math.max(th, 20) + 10, N = 40, Ts = Array.from({ length: N + 1 }, (_, i) => t0 + ((t1 - t0) * i) / N);
  const pl = Ts.map((T) => fitPressure(inter(T)[0], geo)), ph = Ts.map((T) => fitPressure(inter(T)[1], geo));
  const hi = Math.max(...ph) * 1.15 || 1;
  return (
    <>
      <Readouts>
        {temps.map((T, i) => {
          const [a, b] = inter(T);
          return <Readout key={i} label={`Interference at ${fmt(T, 0)} °C`} value={range(a, b)} primary={T === 20} tone={a <= 0 ? 'bad' : undefined}
            sub={`${a <= 0 ? 'can be loose' : 'always gripping'} · pressure ${fmt(pr[i][0], 2)}–${fmt(pr[i][1], 2)} MPa`} />;
        })}
        <Readout label="Hub stress, worst" value={fmt(st.vmOuter, 0)} unit="MPa" tone={fy > 0 && st.vmOuter > fy ? 'bad' : undefined}
          sub={`von Mises at the bore, at ${fmt(tWorst, 0)} °C${fy > 0 ? ` · ${fmt((100 * st.vmOuter) / fy, 0)}% of yield` : ''}`} />
        <Readout label="Holding, least" value={fmt(hold.force / 1000, 2)} unit="kN" tone={hold.force <= 0 ? 'bad' : undefined}
          sub={`axial, at ${fmt(loosest, 0)} °C with the least interference · torque ${fmt(hold.torque / 1e6, 2)} kN·m`} />
        <Readout label="Shrink-fit temperature" value={`+${fmt(shrink, 0)}`} unit="K" sub={`heat the hub this much above the inner part to open ${fmt(ac, 2)} mm of assembly clearance`} />
      </Readouts>
      <Plot
        x0={t0} x1={t1} y0={0} y1={hi} xl="temperature (°C)" yl="contact pressure (MPa)" legend={[['most interference', 'var(--rd-blue)'], ['least', 'var(--rd-accent)']]}
        label="Contact pressure against temperature"
        caption="Contact pressure against temperature for the tightest and loosest combination of limits. Where the lower line meets zero, the fit can go loose."
      >
        {(c) => (
          <>
            <polygon points={[...Ts.map((T, i) => `${c.X(T)},${c.Y(pl[i])}`), ...Ts.slice().reverse().map((T, i) => `${c.X(T)},${c.Y(ph[N - i])}`)].join(' ')} fill="var(--rd-blue)" fillOpacity={0.18} />
            <Poly s={c} pts={Ts.map((T, i) => [T, pl[i]])} color="var(--rd-accent)" w={1.8} />
            <Poly s={c} pts={Ts.map((T, i) => [T, ph[i]])} color="var(--rd-blue)" w={1.8} />
            {[tc, th].map((T) => <line key={T} x1={c.X(T)} x2={c.X(T)} y1={c.T} y2={c.H - c.B} stroke="var(--rd-warn)" strokeDasharray="3 3" strokeOpacity={0.7} />)}
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function FitFields({ p, press }: { p: string; press?: boolean }) {
  return (
    <Group
      legend={press ? 'Interference fit' : 'Hole and shaft'}
      hint={press
        ? 'Shrink fit: the hub is heated (or the inner part cooled) until the largest interference becomes the assembly clearance. Yield is typical: use your allowable at temperature.'
        : 'Limits are at 20 °C, the ISO 1 reference temperature. Sizes to 500 mm; letters and grades as tabulated in ISO 286-2: check critical values against the standard.'}
    >
      <Num name={`${p}_d`} label="Nominal size" unit="mm" />
      <FieldRow>
        <Choice name={`${p}_hl`} label="Hole letter" options={opts(HOLE_LETTERS)} />
        <Choice name={`${p}_hg`} label="Hole grade (IT)" options={opts(GRADES)} />
      </FieldRow>
      <FieldRow>
        <Choice name={`${p}_sl`} label="Shaft letter" options={opts(SHAFT_LETTERS)} />
        <Choice name={`${p}_sg`} label="Shaft grade (IT)" options={opts(GRADES)} />
      </FieldRow>
      <Choice name={`${p}_hm`} label={press ? 'Outer part (hub)' : 'Hole part'} groups={GROUPS} search />
      <Choice name={`${p}_sm`} label={press ? 'Inner part' : 'Shaft part'} groups={GROUPS} search />
      <FieldRow>
        <Num name={`${p}_tc`} label="Coldest" unit="°C" />
        <Num name={`${p}_th`} label="Hottest" unit="°C" />
      </FieldRow>
      {press ? (
        <>
          <FieldRow>
            <Num name="p_D" label="Hub outside ⌀" unit="mm" />
            <Num name="p_di" label="Inner part's bore ⌀" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="p_L" label="Fit length" unit="mm" />
            <Num name="p_mu" label="Friction μ" />
          </FieldRow>
          <FieldRow>
            <Num name="p_fy" label="Hub yield" unit="MPa" />
            <Num name="p_ac" label="Assembly clearance" unit="mm" />
          </FieldRow>
        </>
      ) : null}
    </Group>
  );
}

function Body() {
  const { v } = useForm();
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'fit', label: 'ISO fit' }, { value: 'press', label: 'Interference fit' }]} />
      </Wide>
      <Inputs>{v.tab === 'fit' ? <FitFields p="f" /> : <FitFields p="p" press />}</Inputs>
      <Outputs>{v.tab === 'fit' ? <IsoFit /> : <Press />}</Outputs>
    </>
  );
}

export default function Fits() {
  return (
    <Calc
      id="fits"
      title="Fits & limits: ISO 286, temperature, Lamé"
      defaults={{
        tab: 'fit',
        f_d: '150', f_hl: 'H', f_hg: '7', f_sl: 'g', f_sg: '6', f_hm: D.caseSteel, f_sm: D.aluminium, f_tc: '-40', f_th: '60',
        p_d: '310', p_hl: 'H', p_hg: '7', p_sl: 's', p_sg: '6', p_hm: D.aluminium, p_sm: D.caseSteel, p_tc: '-40', p_th: '60',
        p_D: '330', p_di: '290', p_L: '30', p_mu: '0.15', p_fy: '500', p_ac: '0.05',
      }}
      foot="ISO 286-1 and -2 limits for sizes to 500 mm. Uniform temperature, linear expansion from 20 °C. Interference fits: Lamé thick cylinders, no surface smoothing, elastic, holding force μ·p·π·d·L."
    >
      <Body />
    </Calc>
  );
}
