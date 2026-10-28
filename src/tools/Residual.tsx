// Residual stress in three tabs: as a mean stress in fatigue (with relaxation on the first cycle), as crack driving
// force in fracture and stress-corrosion cracking (with relaxation by a proof test), and the residual stresses left by
// autofrettage of a thick cylinder. Maths in src/lib/residual.ts (unit-tested).
import React from 'react';
import { fatigueWithResidual, fractureWithResidual, flawK, autofrettage, serviceStress, lame } from '../lib/residual';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Check, ModeTabs, MaterialFill, Readouts, Readout, Notes, Plot, Poly, A, useForm, num, fmt, HALO, type Tone } from './kit';
import type { MaterialFillData } from './materialOptions';

const g3 = (v: number) => (Math.abs(v) >= 100 ? fmt(v, 0) : Math.abs(v) >= 10 ? fmt(v, 1) : Math.abs(v) >= 1 ? fmt(v, 2) : fmt(v, 3));
const cyc = (n: number) => { if (!Number.isFinite(n)) return 'no limit'; if (n >= 1e7) return `${fmt(n / 1e6, 0)} million`; const s = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 2); return fmt(Math.round(n / s) * s, 0); };
const sg = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${g3(Math.abs(v))}`;
const M = { L: 56, R: 20, T: 30, B: 40 };
type Note = { tone: Tone; text: string };

function Fatigue() {
  const { v } = useForm();
  const i = { sa: num(v.f_sa), sm: num(v.f_sm), sr: num(v.f_sr) || 0, Fty: num(v.f_fty), uts: num(v.f_uts), se: num(v.f_se), nE: num(v.f_ne), limit: v.f_lim === 'true' };
  if (!(i.sa >= 0 && Number.isFinite(i.sm) && i.Fty > 0 && i.uts >= i.Fty * 0.5 && i.se > 0 && i.se < 0.9 * i.uts && i.nE > 1e3))
    return <Notes items={[{ tone: 'bad', text: 'Check the stresses and the S-N data: Se below 0.9 Ftu, at more than 1000 cycles.' }]} />;
  const r = fatigueWithResidual(i);
  const ratio = r.N / r.N0;
  const notes: Note[] = [];
  if (r.srEff !== i.sr) notes.push({ tone: 'warn', text: `The residual stress relaxes from ${sg(i.sr)} to ${sg(r.srEff)} MPa on the first cycle: service plus residual cannot pass yield. Large cycles wash residual stress out, so it does most for high-cycle fatigue.` });
  if (i.sr < 0 && r.smEff < 0) notes.push({ tone: 'info', text: 'The residual compression more than cancels the mean stress. Compressive mean stress gets no credit here, as on the Fatigue page: some methods allow it, with test evidence.' });
  if (i.sr > 0) notes.push({ tone: 'bad', text: 'Tensile residual stress is extra mean stress the drawing does not show, from welding, abusive grinding, straightening or quenching.' });
  notes.push({ tone: 'info', text: 'Residual stress also fades with cycling and at temperature, and machining removes peened layers: specify peening after the last machining.' });
  const x0 = -i.Fty, x1 = i.uts, top = Math.max(i.se, i.sa) * 1.35;
  const yl = (m: number) => Math.min(top, Math.max(0, i.Fty - Math.abs(m)));
  return (
    <>
      <Readouts>
        <Readout label="Life" value={cyc(r.N)} unit="cycles" primary tone={ratio < 1 ? 'bad' : ratio > 1 ? 'ok' : undefined}
          sub={`${Number.isFinite(r.N0) ? `${cyc(r.N0)} without the residual stress` : 'below the endurance limit without it too'}${Number.isFinite(ratio) && Number.isFinite(r.N0) && r.N0 > 0 ? ` · ×${g3(ratio)}` : ''}`} />
        <Readout label="Residual after first cycle" value={sg(r.srEff)} unit="MPa" sub={r.srEff !== i.sr ? `relaxed from ${sg(i.sr)} MPa: the total reached yield` : 'unchanged: the total stays below yield'} />
        <Readout label="Effective mean" value={sg(r.smEff)} unit="MPa" sub={`service ${sg(i.sm)} plus residual ${sg(r.srEff)}`} />
        <Readout label="Equivalent reversed" value={g3(r.sar)} unit="MPa" sub={`Goodman · ${g3(r.sar0)} MPa without the residual stress`} />
      </Readouts>
      <Plot x0={x0} x1={x1} y0={0} y1={top} xl="mean stress (MPa)" yl="alternating stress (MPa)" margin={M} zeroX
        legend={[['Goodman, Se', 'var(--rd-blue)'], ['yield', 'var(--rd-warn)', '5 3']]}
        label="Goodman diagram with the service and effective cycles"
        caption="The Goodman line for the endurance strength, with no credit for compressive mean. The grey dot is the service cycle; the residual stress moves it sideways to the coloured dot: towards the line if tensile, away if compressive.">
        {(c) => {
          const p0 = [c.X(i.sm), c.Y(Math.min(i.sa, top))], p1 = [c.X(Math.max(x0, Math.min(x1, r.smEff))), c.Y(Math.min(i.sa, top))];
          const dir = Math.sign(p1[0] - p0[0]);
          return (
            <>
              <Poly s={c} pts={[[x0, i.se], [0, i.se], [i.uts, 0]]} color="var(--rd-blue)" />
              <Poly s={c} pts={Array.from({ length: 41 }, (_, k) => x0 + ((x1 - x0) * k) / 40).map((m) => [m, yl(m)])} color="var(--rd-warn)" w={1.6} dash="5 3" />
              {Math.abs(p1[0] - p0[0]) > 8 ? (
                <path d={`M${p0[0]},${p0[1]} L${p1[0] - dir * 6},${p1[1]} M${p1[0] - dir * 11},${p1[1] - 4} L${p1[0] - dir * 5},${p1[1]} L${p1[0] - dir * 11},${p1[1] + 4}`} fill="none" stroke="var(--rd-ink)" strokeWidth={1.5} />
              ) : null}
              <circle cx={p0[0]} cy={p0[1]} r={4.5} fill="var(--rd-muted)" stroke="var(--rd-panel)" strokeWidth={1.5} />
              <circle cx={p1[0]} cy={p1[1]} r={5} fill={r.smEff > i.sm ? 'var(--rd-accent)' : 'var(--rd-ok)'} stroke="var(--rd-panel)" strokeWidth={1.5} />
            </>
          );
        }}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Fracture() {
  const { v } = useForm();
  const kscc = num(v.k_kscc), proof = num(v.k_pf);
  const i = { sigma: num(v.k_s), sr: num(v.k_sr) || 0, Fty: num(v.k_fty), proof: proof > 0 ? proof : undefined, KIC: num(v.k_kic), a: num(v.k_a), Y: num(v.k_y), KISCC: kscc > 0 ? kscc : undefined };
  if (!(i.sigma >= 0 && i.Fty > 0 && i.KIC > 0 && i.a > 0 && i.Y > 0)) return <Notes items={[{ tone: 'bad', text: 'Check the stresses, toughness, flaw depth and geometry factor.' }]} />;
  const r = fractureWithResidual(i);
  const notes: Note[] = [];
  if (r.srEff < i.sr && i.proof) notes.push({ tone: 'ok', text: `The proof test relaxed the residual stress from ${sg(i.sr)} to ${sg(r.srEff)} MPa: where proof plus residual reached yield, the excess yielded away: a mechanical stress relief.` });
  if (i.KISCC && r.Kres >= i.KISCC) notes.push({ tone: 'bad', text: `The residual stress alone takes a ${g3(i.a)} mm flaw past KISCC: it can grow by stress corrosion in storage, with no load on the part.` });
  notes.push({ tone: 'info', text: 'Residual stress acts on every crack whether the part is loaded or not. Where it is not measured, fitness-for-service procedures such as BS 7910 and API 579-1 prescribe it: up to yield in as-welded joints.' });
  const amax = Math.max(3 * i.a, 1.3 * Math.min(r.aCrit0, 10 * i.a)), as = Array.from({ length: 121 }, (_, k) => (amax * (k + 0.5)) / 121);
  const top = Math.max(i.KIC * 1.25, (i.KISCC ?? 0) * 1.3);
  const cap = (x: number) => Math.min(top, x);
  return (
    <>
      <Readouts>
        <Readout label="Critical flaw depth" value={g3(r.aCrit)} unit="mm" primary tone={r.aCrit < i.a ? 'bad' : undefined} sub={`${g3(r.aCrit0)} mm without the residual stress`} />
        <Readout label="Residual in service" value={sg(r.srEff)} unit="MPa" sub={r.srEff !== i.sr ? `relaxed from ${sg(i.sr)} MPa by the ${i.proof ? 'proof test' : 'service stress'}` : 'as entered'} />
        <Readout label={`K at ${g3(i.a)} mm`} value={g3(r.K)} unit="MPa√m" tone={r.K >= i.KIC ? 'bad' : undefined} sub={`${fmt((100 * r.K) / i.KIC, 0)}% of KIC · ${g3(r.K0)} without the residual stress`} />
        <Readout label="From the residual alone" value={g3(r.Kres)} unit="MPa√m" tone={i.KISCC ? (r.Kres >= i.KISCC ? 'bad' : 'ok') : undefined}
          sub={`sustained, with no load on the part${i.KISCC ? ` · KISCC ${g3(i.KISCC)}` : ''}`} />
        {i.KISCC
          ? <Readout label="Deepest flaw safe in storage" value={Number.isFinite(r.aScc) ? g3(r.aScc) : 'any'} unit={Number.isFinite(r.aScc) ? 'mm' : undefined} sub="before the residual stress alone reaches KISCC" />
          : <Readout label="Stress corrosion" value="needs KISCC" sub="Enter KISCC for your material, heat treatment and environment to see which flaws grow in storage." />}
      </Readouts>
      <Plot x0={0} x1={amax} y0={0} y1={top} xl="flaw depth (mm)" yl="K (MPa√m)" margin={M}
        legend={[['with', 'var(--rd-accent)'], ['without', 'var(--rd-blue)', '5 3'], ['residual alone', 'var(--rd-warn)']]}
        label="Stress intensity against flaw depth"
        caption="Stress intensity against flaw depth: with the residual stress, without it, and from the residual stress alone. Each crosses KIC at its critical depth.">
        {(c) => (
          <>
            <Poly s={c} pts={as.map((a) => [a, cap(flawK(i.sigma, a, i.Y))])} color="var(--rd-blue)" w={1.8} dash="5 3" />
            <Poly s={c} pts={as.map((a) => [a, cap(flawK(r.total, a, i.Y))])} color="var(--rd-accent)" />
            <Poly s={c} pts={as.map((a) => [a, cap(flawK(r.srEff, a, i.Y))])} color="var(--rd-warn)" w={1.8} />
            <line x1={c.L} x2={c.W - c.R} y1={c.Y(i.KIC)} y2={c.Y(i.KIC)} stroke="var(--rd-ink)" strokeOpacity={0.7} />
            <text x={c.W - c.R - 4} y={c.Y(i.KIC) - 5} textAnchor="end" fontSize={12} fill="var(--rd-ink)" {...HALO}>KIC</text>
            {i.KISCC ? (
              <>
                <line x1={c.L} x2={c.W - c.R} y1={c.Y(i.KISCC)} y2={c.Y(i.KISCC)} stroke="var(--rd-warn)" strokeDasharray="2 3" />
                <text x={c.W - c.R - 4} y={c.Y(i.KISCC) - 5} textAnchor="end" fontSize={12} fill="var(--rd-warn)" {...HALO}>KISCC</text>
              </>
            ) : null}
            {r.aCrit <= amax ? <circle cx={c.X(r.aCrit)} cy={c.Y(i.KIC)} r={5} fill="var(--rd-accent)" stroke="var(--rd-panel)" strokeWidth={1.5} /> : null}
            {r.aCrit0 <= amax ? <circle cx={c.X(r.aCrit0)} cy={c.Y(i.KIC)} r={4.5} fill="var(--rd-blue)" stroke="var(--rd-panel)" strokeWidth={1.5} /> : null}
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

function Autofrettage() {
  const { v } = useForm();
  const a = num(v.a_a), b = num(v.a_b), Fty = num(v.a_fty), pA = num(v.a_pa) || 0, p = num(v.a_p) || 0;
  if (!(a > 0 && b > a && Fty > 0 && pA >= 0 && p >= 0)) return <Notes items={[{ tone: 'bad', text: 'Check the radii (outside larger than bore), yield and pressures.' }]} />;
  const af = autofrettage(a, b, Fty, pA);
  const rs = Array.from({ length: 401 }, (_, k) => a + ((b - a) * k) / 400).concat(af.c);
  const tr = (r: number) => { const s = serviceStress(af, a, b, p, r); return s.st - s.sr; };
  const peak = rs.reduce((best, r) => (tr(r) > tr(best) ? r : best), a), plain = lame(p, a, b, a);
  const notes: Note[] = [];
  if (pA <= af.pFirst) notes.push({ tone: 'warn', text: `The autofrettage pressure is below first yield (${g3(af.pFirst)} MPa): nothing yields, and no residual stress is left.` });
  if (pA > af.pFull) notes.push({ tone: 'warn', text: `Above ${g3(af.pFull)} MPa the whole wall has yielded: more pressure only bursts it.` });
  if (af.reverse) notes.push({ tone: 'bad', text: 'Unloading would yield the bore in reverse: the compression is capped at yield, and with the Bauschinger effect this happens sooner. Use less overstrain.' });
  else notes.push({ tone: 'info', text: `Reverse yield needs ${g3(Fty)} MPa of compression here; after overstrain real steels yield in reverse sooner (the Bauschinger effect), so keep well clear: ASME VIII Division 3 and gun-tube practice use corrected methods.` });
  if (p > af.pA) notes.push({ tone: 'bad', text: 'The working pressure is above the autofrettage pressure: the wall yields again in service.' });
  if (af.overstrain > 0 && serviceStress(af, a, b, p, a).st < 0) notes.push({ tone: 'ok', text: 'The bore stays in hoop compression even at working pressure: a crack at the bore barely opens. The peak stress has moved out to where the yielded zone ended.' });
  const xs = Array.from({ length: 121 }, (_, k) => a + ((b - a) * k) / 120).concat(af.c).sort((x, y) => x - y);
  const res = xs.map((r) => af.residual(r).st), svc = xs.map((r) => serviceStress(af, a, b, p, r).st), pl = xs.map((r) => lame(p, a, b, r).st);
  const all = [...res, ...svc, ...pl, 0], lo = Math.min(...all), hi = Math.max(...all), pad = 0.1 * (hi - lo || 1);
  return (
    <>
      <Readouts>
        <Readout label="Peak stress in service" value={g3(tr(peak))} unit="MPa" primary tone={tr(peak) >= Fty ? 'bad' : undefined}
          sub={`Tresca, at r = ${g3(peak)} mm · ${g3(plain.st - plain.sr)} MPa at the bore without autofrettage`} />
        <Readout label="Bore hoop in service" value={sg(serviceStress(af, a, b, p, a).st)} unit="MPa" sub={`${sg(plain.st)} MPa without autofrettage`} />
        <Readout label="Residual at the bore" value={sg(af.boreHoop)} unit="MPa" tone={af.reverse ? 'bad' : undefined} sub={`hoop, with no pressure${af.reverse ? ': beyond reverse yield' : ''}`} />
        <Readout label="Overstrain" value={`${fmt(100 * af.overstrain, 0)}% of the wall`} sub={`yielded to r = ${g3(af.c)} mm · first yield at ${g3(af.pFirst)} MPa, full overstrain at ${g3(af.pFull)} MPa`} />
      </Readouts>
      <Plot x0={a} x1={b} y0={lo - pad} y1={hi + pad} xl="radius (mm)" yl="hoop stress (MPa)" margin={M}
        legend={[['residual', 'var(--rd-blue)'], ['in service', 'var(--rd-accent)'], ['plain', 'var(--rd-muted)', '5 3']]}
        label="Hoop stress through the wall"
        caption="Hoop stress through the wall: the residual stress after autofrettage, the total at working pressure, and the plain cylinder at working pressure. The shaded zone yielded.">
        {(c) => (
          <>
            {af.c > a ? <rect x={c.X(a)} y={c.T} width={c.X(af.c) - c.X(a)} height={c.H - c.T - c.B} fill="var(--rd-warn)" fillOpacity={0.07} /> : null}
            <Poly s={c} pts={xs.map((r, k) => [r, pl[k]])} color="var(--rd-muted)" w={1.6} dash="5 3" />
            <Poly s={c} pts={xs.map((r, k) => [r, res[k]])} color="var(--rd-blue)" />
            <Poly s={c} pts={xs.map((r, k) => [r, svc[k]])} color="var(--rd-accent)" />
            {af.c > a ? <text x={c.X(af.c) - 4} y={c.H - c.B - 6} textAnchor="end" fontSize={12} fill="var(--rd-warn)" {...HALO}>yielded</text> : null}
          </>
        )}
      </Plot>
      <Notes items={notes} />
    </>
  );
}

type Fills = { fatigue: MaterialFillData; fracture: MaterialFillData; af: MaterialFillData };

function Body({ fills }: { fills: Fills }) {
  const { v } = useForm();
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'fatigue', label: 'Fatigue' }, { value: 'fracture', label: 'Fracture & SCC' }, { value: 'af', label: 'Autofrettage' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'fatigue' ? (
          <Group legend="Surface point in fatigue" hint={<>Local stresses at the surface, notch factor included, as on the <A href="../../fundamentals/fatigue/">Fatigue</A> page, whose S-N line this uses. Residual stress: tension positive, measured or assumed.</>}>
            <MaterialFill fill={fills.fatigue} />
            <FieldRow><Num name="f_sa" label="Alternating stress" unit="MPa" /><Num name="f_sm" label="Mean stress" unit="MPa" /></FieldRow>
            <FieldRow><Num name="f_sr" label="Residual stress" unit="MPa" /><Num name="f_fty" label="Yield Fty" unit="MPa" /></FieldRow>
            <FieldRow><Num name="f_uts" label="Ultimate Ftu" unit="MPa" /><Num name="f_se" label="Endurance strength Se" unit="MPa" /></FieldRow>
            <Num name="f_ne" label="at cycles" />
            <Check name="f_lim" label="Endurance limit" />
          </Group>
        ) : v.tab === 'fracture' ? (
          <Group legend="Surface flaw" hint="Y = 1.12 for a long, shallow surface flaw. KISCC is the stress-corrosion threshold for your material, heat treatment and environment.">
            <MaterialFill fill={fills.fracture} />
            <FieldRow><Num name="k_s" label="Service stress" unit="MPa" /><Num name="k_sr" label="Residual stress" unit="MPa" /></FieldRow>
            <FieldRow><Num name="k_fty" label="Yield Fty" unit="MPa" /><Num name="k_pf" label="Proof stress" unit="MPa" placeholder="none" /></FieldRow>
            <FieldRow><Num name="k_kic" label="KIC" unit="MPa√m" /><Num name="k_kscc" label="KISCC" unit="MPa√m" placeholder="your value" /></FieldRow>
            <FieldRow><Num name="k_a" label="Flaw depth" unit="mm" /><Num name="k_y" label="Geometry factor Y" /></FieldRow>
          </Group>
        ) : (
          <Group legend="Thick cylinder" hint="Tresca, elastic–perfectly plastic, no Bauschinger effect. Real steels yield in reverse sooner after overstrain.">
            <MaterialFill fill={fills.af} />
            <FieldRow><Num name="a_a" label="Bore radius" unit="mm" /><Num name="a_b" label="Outside radius" unit="mm" /></FieldRow>
            <FieldRow><Num name="a_fty" label="Yield Fty" unit="MPa" /><Num name="a_pa" label="Autofrettage pressure" unit="MPa" /></FieldRow>
            <Num name="a_p" label="Working pressure" unit="MPa" />
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'fatigue' ? <Fatigue /> : v.tab === 'fracture' ? <Fracture /> : <Autofrettage />}</Outputs>
    </>
  );
}

export default function Residual({ fills }: { fills: Fills }) {
  return (
    <Calc
      id="residual-stress"
      title="Residual stress: fatigue, fracture, autofrettage"
      defaults={{
        tab: 'fatigue', f_sa: '444', f_sm: '444', f_sr: '-400', f_fty: '1180', f_uts: '1280', f_se: '310', f_ne: '1000000', f_lim: 'true',
        k_s: '1094', k_sr: '290', k_fty: '1450', k_pf: '1204', k_kic: '70', k_kscc: '', k_a: '0.5', k_y: '1.12',
        a_a: '5', a_b: '12.5', a_fty: '1000', a_pa: '650', a_p: '300',
      }}
      foot="Elastic–perfectly plastic. Fatigue: Goodman on the fatigue page's S-N line, compressive mean not credited. Fracture: K = Yσ√(πa), uniform residual stress across the flaw. Autofrettage: Hill's thick-cylinder solution, elastic unloading."
    >
      <Body fills={fills} />
    </Calc>
  );
}
