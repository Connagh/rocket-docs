// Galvanic corrosion in three tabs: one couple on the anodic index ladder; every contact of a joint stack; and a
// screening estimate of the attack on the anode from the area ratio. The environment limits are the usual design
// guidance; a programme limit, when entered, replaces them. Maths in src/lib/galvanic.ts (unit-tested).
import React from 'react';
import { METALS, ENVIRONMENTS, ANODES, metal, couple, checkJoint, galvanicAttack } from '../lib/galvanic';
import { Calc, Wide, Inputs, Outputs, Group, FieldRow, Num, Choice, ModeTabs, Readouts, Readout, Notes, Figure, useForm, num, fmt, type Tone } from './kit';

const g3 = (v: number) => (Math.abs(v) >= 100 ? fmt(v, 0) : Math.abs(v) >= 10 ? fmt(v, 1) : Math.abs(v) >= 1 ? fmt(v, 2) : Math.abs(v) >= 0.01 ? fmt(v, 3) : v.toExponential(1));
const short = (k: string) => metal(k)?.short ?? k;
const STACK_LABELS = ['Fastener', 'Washer or insert', 'Part 1', 'Part 2', 'Part 3 (optional)'];
const metalOpts = (blank = false) => [...(blank ? [{ value: '', label: '(none)' }] : []), ...METALS.map((m) => ({ value: m.key, label: m.name }))];
const envOpts = ENVIRONMENTS.map((e) => ({ value: e.key, label: `${e.name} (${e.limit.toFixed(2)} V)` }));
const T = (x: number, y: number, s: string, c = 'var(--rd-ink)', anchor: 'start' | 'middle' | 'end' = 'start', fs = 12) => (
  <text key={`${x},${y},${s}`} x={x} y={y} textAnchor={anchor} fontSize={fs} fill={c} stroke="var(--rd-panel)" strokeWidth={3} paintOrder="stroke">{s}</text>
);

/** The anodic index ladder, with the selected metals marked and a band of ± the limit around the cathode. */
function Ladder({ marks, limit, cathode, caption }: { marks: string[]; limit: number; cathode?: number; caption: string }) {
  const W = 420, H = 250, L = 40, R = 12, Tp = 24, B = 34;
  const X = (v: number) => L + (v / 1.8) * (W - L - R), y0 = H - B;
  const seen = new Map<number, number>();
  return (
    <Figure label="Anodic index ladder with the selected metals" caption={caption}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75].map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1={Tp} y2={y0} stroke="var(--rd-line)" />
            <text x={X(v)} y={y0 + 14} textAnchor="middle" fontSize={11} fill="var(--rd-muted)">{fmt(v, 2)}</text>
          </g>
        ))}
        {cathode !== undefined ? <rect x={X(cathode)} y={Tp} width={Math.max(1, X(Math.min(1.8, cathode + limit)) - X(cathode))} height={y0 - Tp} fill="var(--rd-ok)" fillOpacity={0.14} /> : null}
        {METALS.map((m, i) => <circle key={m.key} cx={X(m.index)} cy={Tp + 8 + (i % 4) * 6} r={2.5} fill="var(--rd-muted)" />)}
        {marks.map((k, i) => {
          const m = metal(k); if (!m) return null;
          const lvl = seen.get(m.index) ?? 0; seen.set(m.index, lvl + 1);
          const x = X(m.index), y = Tp + 52 + i * 34 + lvl * 4;
          return (
            <g key={`${k}${i}`}>
              <line x1={x} x2={x} y1={Tp} y2={y0} stroke="var(--rd-blue)" strokeWidth={2} />
              {T(x > W * 0.6 ? x - 6 : x + 6, y, short(k), 'var(--rd-ink)', x > W * 0.6 ? 'end' : 'start')}
            </g>
          );
        })}
        <text x={L} y={14} fontSize={11} fill="var(--rd-ok)">{`green: up to ${fmt(limit, 2)} V from the most noble`}</text>
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--rd-ink)">anodic index (V): noble ← → anodic</text>
      </svg>
    </Figure>
  );
}

function useLimit(env: string, lim: string) {
  const own = num(lim), e = ENVIRONMENTS.find((x) => x.key === env) ?? ENVIRONMENTS[0];
  return own >= 0 ? { v: own, src: 'your programme limit' } : { v: e.limit, src: `usual guidance, ${e.name.toLowerCase()} environment (${e.desc})` };
}

function Pair() {
  const { v } = useForm();
  const notes: { tone: Tone; text: string }[] = [];
  const a = v.p_a, b = v.p_b, c = couple(a, b)!, lim = useLimit(v.p_env, v.p_lim), ok = c.dV <= lim.v + 1e-9;
  if (!ok) notes.push({ tone: 'bad', text: 'Above the limit: break the cell. Keep the water out (sealant, wet installation, drainage), isolate the metals (washer, sleeve, barrier ply), or change a finish to bring the two indices closer.' });
  if (c.anode && ['steel', 'al', 'al2', 'mg'].includes(c.anode.key)) notes.push({ tone: 'info', text: 'Coat the cathode, or both. Never coat only the anode: a small damage in the coating becomes a small anode next to a large cathode.' });
  if ([a, b].includes('cfrp')) notes.push({ tone: 'warn', text: 'Carbon fibre is a good cathode and conducts. Put a glass-fibre ply or an adhesive film between CFRP and aluminium or steel, and use titanium or stainless fasteners with sealant.' });
  if ([a, b].includes('steel')) notes.push({ tone: 'info', text: 'Bare carbon and low-alloy steel rusts without a second metal. It needs its own protection (plating, primer, oil or a controlled environment) in any case.' });
  const ca = c.cathode ?? metal(a)!;
  return (
    <>
      <Readouts>
        <Readout label="Potential difference" value={fmt(c.dV, 2)} unit="V" primary tone={ok ? 'ok' : 'bad'} sub={`limit ${fmt(lim.v, 2)} V: ${lim.src}`} />
        <Readout label="Anode" value={c.anode ? short(c.anode.key) : 'none'} sub={c.anode ? `this side corrodes; ${short(c.cathode!.key)} is protected` : 'the same index: no galvanic drive'} />
      </Readouts>
      <Ladder marks={[a, b]} limit={lim.v} cathode={ca.index}
        caption="The anodic index of each metal (grey dots) and the two selected ones. A metal in the green band is close enough to the cathode for the selected limit." />
      <Notes items={notes} />
    </>
  );
}

function Joint() {
  const { v } = useForm();
  const notes: { tone: Tone; text: string }[] = [];
  const stack = [0, 1, 2, 3, 4].map((i) => v[`j_${i}`]).filter(Boolean), lim = useLimit(v.j_env, v.j_lim);
  const j = checkJoint(stack, lim.v);
  if (!j.pairs.length) return <Notes items={[{ tone: 'bad', text: 'Select at least two items in contact.' }]} />;
  if (!j.ok) notes.push({ tone: 'bad', text: `The worst contact is ${short(j.worst!.a)} / ${short(j.worst!.b)}. Change that item, isolate that contact, or keep the water out of it.` });
  notes.push({ tone: 'info', text: 'The fastener is in the faying surfaces, the hole and the head. Install it wet with sealant, and seal the edges of the joint, so that no electrolyte can bridge two metals.' });
  return (
    <>
      <Readouts>
        <Readout label="Joint" value={j.ok ? 'every contact passes' : 'a contact fails'} primary tone={j.ok ? 'ok' : 'bad'} sub={`limit ${fmt(lim.v, 2)} V: ${lim.src}`} />
        {j.pairs.map((p, i) => (
          <Readout key={i} label={`${short(p.a)} / ${short(p.b)}`} value={fmt(p.dV, 2)} unit="V" tone={p.ok ? undefined : 'bad'} sub={p.anode ? `${short(p.anode.key)} is the anode` : 'no drive'} />
        ))}
      </Readouts>
      <Ladder marks={stack} limit={lim.v} cathode={Math.min(...stack.map((k) => metal(k)!.index))}
        caption="The metals of the joint on the anodic index scale. Each contact must stay within the limit; the green band starts at the most noble item." />
      <Notes items={notes} />
    </>
  );
}

function Rate() {
  const { v } = useForm();
  const notes: { tone: Tone; text: string }[] = [];
  const an = v.r_an, wet = (num(v.r_wet) || 0) / 100, t = num(v.r_t), years = num(v.r_y) || 0;
  const r = galvanicAttack({ anode: an, cathodeArea: num(v.r_ac), anodeArea: num(v.r_aa), ic: num(v.r_ic), wet, years });
  if (!r || !Number.isFinite(r.rate)) return <Notes items={[{ tone: 'bad', text: 'Enter the two wetted areas, the current density and the time of wetness.' }]} />;
  const share = t > 0 ? r.depth / t : NaN;
  if (r.ratio > 10) notes.push({ tone: 'warn', text: 'A large cathode next to a small anode: the attack concentrates. Make the anode the large part, or coat the cathode.' });
  if (r.ratio < 0.1) notes.push({ tone: 'info', text: 'A small cathode in a large anode: the current spreads, and the galvanic attack is small. A steel or titanium fastener in an aluminium part is usually this case.' });
  notes.push({ tone: 'info', text: 'A uniform estimate. Real attack concentrates at the edge of the contact, in crevices and at coating damage, and can be several times deeper. Confirm with a corrosion test (for example salt spray to ASTM B117 or a cyclic test) on the real joint.' });
  const W = 420, H = 250, L = 52, R = 14, Tp = 26, B = 40;
  const lo = -2, hi = 3, X = (q: number) => L + ((Math.log10(q) - lo) / (hi - lo)) * (W - L - R);
  const per = r.rate / Math.max(r.ratio, 1e-12), dmax = Math.max(r.depth * 2, t || 0, 1e-6) * 1.1;
  const Y = (d: number) => H - B - (Math.min(d, dmax) / dmax) * (H - B - Tp);
  const pts = Array.from({ length: 101 }, (_, i) => 10 ** (lo + ((hi - lo) * i) / 100)).map((q) => `${X(q).toFixed(1)},${Y(per * q * years).toFixed(1)}`);
  return (
    <>
      <Readouts>
        <Readout label="Attack on the anode" value={g3(r.depth)} unit="mm" primary tone={share >= 0.5 ? 'bad' : share >= 0.1 ? 'warn' : 'ok'} sub={`in ${fmt(years, 0)} years · ${g3(r.rate)} mm/year`} />
        <Readout label="Area ratio" value={g3(r.ratio)} sub={`cathode ÷ anode · anode current ${g3(r.ia)} µA/cm² while wet`} />
        <Readout label="Faraday" value={fmt(r.perUnit, 4)} unit="mm/year" sub={`for each µA/cm² on ${(ANODES.find((x) => x.key === an) ?? ANODES[0]).name.toLowerCase()}`} />
        {t > 0 ? <Readout label="Share of the wall or coating" value={`${fmt(100 * share, 0)}%`} tone={share >= 0.5 ? 'bad' : undefined} sub={`of ${g3(t)} mm`} /> : null}
      </Readouts>
      <Figure label="Attack on the anode against the area ratio" caption="Attack on the anode after the exposure time against the area ratio, for the same current density. The dot is your case.">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {[0.01, 0.1, 1, 10, 100, 1000].map((q) => (
            <g key={q}>
              <line x1={X(q)} x2={X(q)} y1={Tp} y2={H - B} stroke="var(--rd-line)" />
              <text x={X(q)} y={H - B + 14} textAnchor="middle" fontSize={11} fill="var(--rd-muted)">{String(q)}</text>
            </g>
          ))}
          <polyline points={pts.join(' ')} fill="none" stroke="var(--rd-blue)" strokeWidth={2.2} />
          {t > 0 ? (
            <>
              <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--rd-accent)" strokeDasharray="5 3" />
              {T(L + 4, Y(t) - 5, `${g3(t)} mm to protect`, 'var(--rd-accent)')}
            </>
          ) : null}
          <circle cx={X(Math.max(0.01, Math.min(1000, r.ratio)))} cy={Y(r.depth)} r={5} fill="var(--rd-accent)" stroke="var(--rd-panel)" strokeWidth={1.5} />
          <text x={12} y={(Tp + H - B) / 2} textAnchor="middle" fontSize={11} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(Tp + H - B) / 2})`}>attack (mm)</text>
          <text x={L - 4} y={Tp + 4} textAnchor="end" fontSize={11} fill="var(--rd-muted)">{g3(dmax)}</text>
          <text x={L - 4} y={H - B} textAnchor="end" fontSize={11} fill="var(--rd-muted)">0</text>
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--rd-ink)">area ratio, cathode ÷ anode (log)</text>
        </svg>
      </Figure>
      <Notes items={notes} />
    </>
  );
}

function Body() {
  const { v } = useForm();
  return (
    <>
      <Wide>
        <ModeTabs name="tab" options={[{ value: 'pair', label: 'Two metals' }, { value: 'joint', label: 'Joint stack' }, { value: 'rate', label: 'Area & attack' }]} />
      </Wide>
      <Inputs>
        {v.tab === 'pair' ? (
          <Group
            legend="Two metals in contact"
            hint="Harsh: salt spray, outdoors, unprotected. Normal: sheltered, humidity not controlled. Controlled: sealed, temperature and humidity controlled. Use the finish that is in contact: a plated bolt is its plating, not its base metal. An anodized or painted surface breaks the contact only while the film is intact."
          >
            <Choice name="p_a" label="Metal or finish A" options={metalOpts()} search />
            <Choice name="p_b" label="Metal or finish B" options={metalOpts()} search />
            <FieldRow>
              <Choice name="p_env" label="Environment" options={envOpts} />
              <Num name="p_lim" label="Programme limit" unit="V" placeholder="optional" />
            </FieldRow>
          </Group>
        ) : v.tab === 'joint' ? (
          <Group
            legend="The joint, in the order of contact"
            hint="Each item touches the next one. Leave an item as “(none)” to remove it. An isolating washer or sleeve breaks the contact: leave it out of the stack and check the two sides apart."
          >
            {STACK_LABELS.map((l, i) => <Choice key={i} name={`j_${i}`} label={l} options={metalOpts(i >= 1)} search />)}
            <FieldRow>
              <Choice name="j_env" label="Environment" options={envOpts} />
              <Num name="j_lim" label="Programme limit" unit="V" placeholder="optional" />
            </FieldRow>
          </Group>
        ) : (
          <Group
            legend="Area ratio and attack (screening)"
            hint="Defaults: the steel case at a damaged bond edge, next to the CFRP skirt. The cathode current density is the oxygen-reduction rate on the cathode: approximately 5 to 30 µA/cm² in aerated water. Wetted areas, not part areas: in a thin film the cell works only a few millimetres from the joint."
          >
            <Choice name="r_an" label="Anode metal" options={ANODES.map((a) => ({ value: a.key, label: a.name }))} />
            <FieldRow>
              <Num name="r_ac" label="Wetted cathode area" unit="cm²" />
              <Num name="r_aa" label="Wetted anode area" unit="cm²" />
            </FieldRow>
            <FieldRow>
              <Num name="r_ic" label="Cathode current density" unit="µA/cm²" />
              <Num name="r_wet" label="Time of wetness" unit="%" />
            </FieldRow>
            <FieldRow>
              <Num name="r_y" label="Exposure" unit="years" />
              <Num name="r_t" label="Wall or coating to protect" unit="mm" />
            </FieldRow>
          </Group>
        )}
      </Inputs>
      <Outputs>{v.tab === 'pair' ? <Pair /> : v.tab === 'joint' ? <Joint /> : <Rate />}</Outputs>
    </>
  );
}

export default function Galvanic() {
  return (
    <Calc
      id="galvanic"
      title="Galvanic corrosion: anodic index, joint, area ratio"
      defaults={{
        tab: 'pair', p_a: 'al', p_b: 'ss18', p_env: 'normal', p_lim: '',
        j_0: 'ti', j_1: 'ss18', j_2: 'al', j_3: 'steel', j_4: '', j_env: 'normal', j_lim: '',
        r_an: 'steel', r_ac: '20', r_aa: '2', r_ic: '10', r_wet: '10', r_y: '10', r_t: '1.377',
      }}
      foot="Anodic index in seawater relative to gold, after MIL-STD-889 and MIL-F-14072. Environment limits: usual design guidance. Attack: cathode-limited current, Faraday's law, uniform over the wetted anode area. Local pits and crevices can be much deeper. A screen, not a corrosion test."
    >
      <Body />
    </Calc>
  );
}
