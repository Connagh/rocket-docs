// Margin report builder: one row per failure mode per load case, plus a combined-loading interaction check.
// Maths in src/lib/margins.ts (unit-tested).
import React, { useState } from 'react';
import { View } from 'react-native';
import { Accordion, AccordionItem, Button } from '@castui/cast-ui';
import { evaluateRow, interaction, reportTsv, type MarginRow, type Mode } from '../lib/margins';
import { readFactor, awaitingMessage } from '../lib/factors';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, TextField, Readouts, Readout, Notes, Figure, DataTable, Actions, Hint, useForm, num, fmt, type Tone, type Values } from './kit';

const msTxt = (v: number) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${fmt(v, 2)}` : '—');
const ROWS = [
  { item: 'Case cylinder', lc: 'MEOP', fail: 'Hoop yield at proof', mode: 'yield', app: '1094', all: '1305', basis: 'A-basis yield × weld 0.9, 20 °C', extra: '', ref: 'Case sizing' },
  { item: 'Case cylinder', lc: 'MEOP', fail: 'Hoop burst', mode: 'ultimate', app: '1094', all: '1368', basis: 'A-basis ultimate × weld 0.9, 20 °C', extra: '', ref: 'Case sizing' },
  { item: 'Case cylinder (empty)', lc: 'Vacuum check', fail: 'Buckling, external pressure', mode: 'other', app: '0.101', all: '0.1262', basis: 'SP-8007 knocked-down buckling pressure', extra: '', ref: 'Shell buckling' },
  { item: '', lc: '', fail: '', mode: 'ultimate', app: '', all: '', basis: '', extra: '', ref: '' },
];
const DEFAULTS: Values = {
  fy: '', fu: '', fo: '',
  ...Object.fromEntries(ROWS.flatMap((r, k) => [[`it${k}`, r.item], [`lc${k}`, r.lc], [`fm${k}`, r.fail], [`md${k}`, r.mode], [`ap${k}`, r.app], [`al${k}`, r.all], [`ba${k}`, r.basis], [`ex${k}`, r.extra], [`rf${k}`, r.ref]])),
  ci: 'Aft-closure bolt', cl: 'MEOP + side load', n1: 'Tension (kN)', a1: '18', u1: '60', n2: 'Shear (kN)', a2: '4', u2: '40', ix: '2,2', e1: '2', e2: '2', cx: '1.15',
};

function RowEditors() {
  const { v } = useForm();
  return (
    <Accordion type="single" size="small">
      {ROWS.map((_, k) => {
        const it = v[`it${k}`].trim(), fm = v[`fm${k}`].trim();
        return (
          <AccordionItem key={k} value={String(k)} title={`Row ${k + 1}: ${it || fm ? [it, fm].filter(Boolean).join(' · ') : 'empty: add your own'}`}>
            <View style={{ gap: 8, paddingBottom: 12 }}>
              <FieldRow>
                <TextField name={`it${k}`} label="Item" />
                <TextField name={`lc${k}`} label="Load case" />
              </FieldRow>
              <FieldRow>
                <TextField name={`fm${k}`} label="Failure mode" />
                <Choice name={`md${k}`} label="Factor" options={[{ value: 'yield', label: 'Yield' }, { value: 'ultimate', label: 'Ultimate' }, { value: 'other', label: 'Other' }]} />
              </FieldRow>
              <FieldRow>
                <Num name={`ap${k}`} label="Applied, at limit" />
                <Num name={`al${k}`} label="Allowable" />
              </FieldRow>
              <TextField name={`ba${k}`} label="Allowable basis and condition" placeholder="e.g. A-basis yield, 100 °C, LT" />
              <FieldRow>
                <Num name={`ex${k}`} label="Special factor(s)" placeholder="none" />
                <TextField name={`rf${k}`} label="Reference" />
              </FieldRow>
            </View>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function IntChart({ comb, k }: { comb: ReturnType<typeof interaction> | null; k: number | null }) {
  const { v } = useForm();
  const W = 480, H = 260, L = 50, R = 14, T = 12, B = 40;
  const e1 = num(v.e1), e2 = num(v.e2);
  const r1 = (k ?? 1) * num(v.a1) / num(v.u1), r2 = (k ?? 1) * num(v.a2) / num(v.u2);
  const m = Math.max(1.15, r1 * 1.1, r2 * 1.1);
  const X = (x: number) => L + (x / m) * (W - L - R), Y = (y: number) => H - B - (y / m) * (H - T - B);
  const grid: number[] = []; for (let g = 0; g <= m + 1e-9; g += 0.25) grid.push(g);
  const pts = Array.from({ length: 101 }, (_, i) => i / 100).map((a) => [a, Math.pow(Math.max(0, 1 - Math.pow(a, e1)), 1 / e2)]);
  const lam = comb && Number.isFinite(comb.lambda) ? comb.lambda : NaN;
  const right = X(r1 * lam) > W * 0.55;
  return (
    <Figure label="Interaction diagram for the combined loading"
      caption="Interaction diagram. The dot is the factored load; the ray shows how far all loads can grow together before reaching the curve: that distance is the margin.">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {grid.map((g) => (
          <g key={g}>
            <line x1={X(g)} x2={X(g)} y1={T} y2={H - B} stroke="var(--rd-line)" />
            <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="var(--rd-line)" />
            <text x={X(g)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="var(--rd-muted)">{g.toFixed(2)}</text>
            <text x={L - 6} y={Y(g) + 3} textAnchor="end" fontSize={10} fill="var(--rd-muted)">{g.toFixed(2)}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--rd-ink)">{`R₁: ${v.n1}`}</text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={11} fill="var(--rd-ink)" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>{`R₂: ${v.n2}`}</text>
        <path d={pts.map(([a, b], i) => `${i ? 'L' : 'M'}${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join('') + ` L${X(0)},${Y(0)} Z`} fill="var(--rd-ok)" fillOpacity={0.1} stroke="var(--rd-accent)" strokeWidth={2.2} />
        {Number.isFinite(lam) ? (
          <>
            <line x1={X(0)} y1={Y(0)} x2={X(r1 * lam)} y2={Y(r2 * lam)} stroke="var(--rd-muted)" strokeDasharray="3 3" />
            <circle cx={X(r1 * lam)} cy={Y(r2 * lam)} r={3.5} fill="var(--rd-accent)" />
            <text x={X(r1 * lam) + (right ? -8 : 8)} y={Y(r2 * lam) - 8} textAnchor={right ? 'end' : 'start'} fontSize={10} fill="var(--rd-accent)">{`× ${fmt(lam, 2)} reaches the curve`}</text>
          </>
        ) : null}
        <circle cx={X(r1)} cy={Y(r2)} r={6} fill="var(--rd-panel)" stroke="var(--rd-ink)" strokeWidth={2.5} />
        <text x={X(r1) + 9} y={Y(r2) + 14} fontSize={10} fill="var(--rd-ink)">{k === null ? 'unfactored' : 'factored loads'}</text>
      </svg>
    </Figure>
  );
}

function CopyButtons({ rows, res }: { rows: MarginRow[]; res: ReturnType<typeof evaluateRow>[] }) {
  const [label, setLabel] = useState<Record<string, string>>({});
  const [fallback, setFallback] = useState<string | null>(null);
  const copy = async (kind: 'tsv' | 'md') => {
    const tsv = reportTsv(rows, res);
    const text = kind === 'md'
      ? tsv.split('\n').map((l, i) => `| ${l.split('\t').map((c) => c.replace(/\|/g, '/')).join(' | ')} |${i === 0 ? `\n|${' --- |'.repeat(l.split('\t').length)}` : ''}`).join('\n')
      : tsv;
    try {
      await navigator.clipboard.writeText(text);
      setFallback(null);
      setLabel({ [kind]: 'Copied' });
    } catch {
      // Clipboard blocked (embedded browser, policy): show the text so it can be selected and copied by hand.
      setFallback(text);
      setLabel({ [kind]: 'Select the text below and copy' });
    }
    setTimeout(() => setLabel({}), 2500);
  };
  return (
    <>
      <Actions>
        <Button size="small" leadingIcon="table" onPress={() => copy('tsv')}>{label.tsv ?? 'Copy for a spreadsheet'}</Button>
        <Button size="small" leadingIcon="content_copy" onPress={() => copy('md')}>{label.md ?? 'Copy as Markdown'}</Button>
      </Actions>
      {fallback ? <textarea className="tool-copytext" readOnly rows={6} value={fallback} aria-label="Report text to copy" onFocus={(e) => e.currentTarget.select()} /> : null}
    </>
  );
}

function Results() {
  const { v } = useForm();
  const factors = { yield: readFactor(v.fy), ultimate: readFactor(v.fu), other: readFactor(v.fo) };
  const rows: MarginRow[] = ROWS.map((_, k) => ({
    item: v[`it${k}`].trim(), loadCase: v[`lc${k}`].trim(), failure: v[`fm${k}`].trim(), mode: v[`md${k}`] as Mode,
    applied: num(v[`ap${k}`]), allowable: num(v[`al${k}`]), allowableBasis: v[`ba${k}`].trim(), extra: readFactor(v[`ex${k}`]), ref: v[`rf${k}`].trim(),
  })).filter((x) => x.applied > 0 && x.allowable > 0);

  // the combined-loading check becomes a report row of its own
  const custom = v.ix === 'custom';
  const [e1, e2] = custom ? [num(v.e1), num(v.e2)] : v.ix.split(',').map(Number);
  const cx = readFactor(v.cx) ?? 1;
  const kU = factors.ultimate;
  const comb = kU !== null && num(v.u1) > 0 && num(v.u2) > 0
    ? interaction([(kU * cx * num(v.a1)) / num(v.u1), (kU * cx * num(v.a2)) / num(v.u2)], [e1, e2]) : null;
  const results = rows.map((x) => evaluateRow(x, factors));
  const combRow: MarginRow = {
    item: v.ci.trim(), loadCase: v.cl.trim(), failure: `${v.n1.trim()} + ${v.n2.trim()} interaction (${e1}, ${e2})`, mode: 'ultimate',
    applied: NaN, allowable: NaN, allowableBasis: `${num(v.a1)} of ${num(v.u1)} and ${num(v.a2)} of ${num(v.u2)}, ultimate allowables`, extra: cx === 1 ? null : cx, ref: 'Combined loading',
  };
  const combRes = { factor: kU === null ? null : kU * cx, ms: comb ? comb.ms : NaN, rf: comb ? comb.lambda : NaN, mismatch: null };
  const allRows = [...rows, combRow], allRes = [...results, combRes];
  const all = allRes.map((x, i) => ({ x, row: allRows[i] }));
  const evald = all.filter((a) => Number.isFinite(a.x.ms));
  const low = [...evald].sort((a, b) => a.x.ms - b.x.ms)[0];
  const flags = all.filter((a) => a.x.mismatch).length, heavy = evald.filter((a) => a.x.ms > 0.5).length;

  const missing = (['yield', 'ultimate', 'other'] as const).filter((m) => factors[m] === null && allRows.some((x) => x.mode === m));
  const out: { tone: Tone; text: string }[] = [];
  if (missing.length) out.push({ tone: 'warn', text: awaitingMessage(missing.map((m) => `${m} factor`), 'the margins') });
  for (const a of all) if (a.x.mismatch) out.push({ tone: 'warn', text: `${a.row.item}, ${a.row.failure}: ${a.x.mismatch}. Pair yield with yield and ultimate with ultimate.` });
  for (const a of evald) if (a.x.ms > 0.5) out.push({ tone: 'info', text: `${a.row.item}, ${a.row.failure}: MS ${msTxt(a.x.ms)}. On a mass-driven part a large margin is a finding, not a success: either the part is heavy or another failure mode governs.` });
  if (low && low.x.ms < 0) out.push({ tone: 'bad', text: `${low.row.item}, ${low.row.failure} fails with MS ${msTxt(low.x.ms)}.` });

  return (
    <>
      <Readouts>
        <Readout label="Lowest margin" value={low ? msTxt(low.x.ms) : 'needs your factors'} primary tone={low ? (low.x.ms < 0 ? 'bad' : 'ok') : undefined}
          sub={low ? `${low.row.item}: ${low.row.failure}` : undefined} />
        <Readout label="Rows checked" value={`${evald.length} of ${all.length}`} />
        <Readout label="Findings" value={String(flags + heavy)} tone={flags ? 'warn' : undefined} sub={`${flags} pairing · ${heavy} heavy`} />
      </Readouts>
      <DataTable
        columns={[{ label: 'Item · failure mode' }, { label: 'Factor' }, { label: 'Applied vs allowable' }, { label: 'MS', numeric: true }]}
        rows={all.map(({ x, row }) => {
          const isComb = !Number.isFinite(row.applied);
          return [
            <span key="i" className="wrap"><b>{row.item}</b> <small>{row.loadCase}</small><br />{row.failure}{x.mismatch ? <><br /><span className="flag">⚠ {x.mismatch}</span></> : null}</span>,
            <span key="f">{row.mode}<br />{x.factor === null ? <span className="flag">needed</span> : fmt(x.factor, 3)}</span>,
            <span key="p" className="wrap">{isComb ? 'interaction' : `${fmt(row.applied, row.applied < 10 ? 3 : 0)} vs ${fmt(row.allowable, row.allowable < 10 ? 4 : 0)}`}<br /><small>{row.allowableBasis}</small></span>,
            { value: msTxt(x.ms), tone: !Number.isFinite(x.ms) ? undefined : x.ms < 0 ? 'bad' : 'ok' },
          ];
        })}
      />
      <CopyButtons rows={allRows} res={allRes} />
      <IntChart comb={comb} k={kU === null ? null : kU * cx} />
      <Notes items={out} />
    </>
  );
}

function CombinedFields() {
  const { v } = useForm();
  const custom = v.ix === 'custom';
  return (
    <Group legend="Combined loading" hint="Uses the ultimate factor × the special factor. The interaction form and exponents come from your governing standard (for spaceflight fasteners, NASA-STD-5020).">
      <FieldRow>
        <TextField name="ci" label="Item" />
        <TextField name="cl" label="Load case" />
      </FieldRow>
      <TextField name="n1" label="Load 1" />
      <FieldRow>
        <Num name="a1" label="Load 1 applied" />
        <Num name="u1" label="Load 1 allowable" />
      </FieldRow>
      <TextField name="n2" label="Load 2" />
      <FieldRow>
        <Num name="a2" label="Load 2 applied" />
        <Num name="u2" label="Load 2 allowable" />
      </FieldRow>
      <Choice name="ix" label="Interaction" options={[{ value: '2,2', label: 'Elliptical: R₁² + R₂² ≤ 1' }, { value: '1,1', label: 'Linear: R₁ + R₂ ≤ 1' }, { value: 'custom', label: 'Other exponents' }]} />
      <FieldRow>
        <Num name="e1" label="Exponent a" disabled={!custom} />
        <Num name="e2" label="Exponent b" disabled={!custom} />
      </FieldRow>
      <Num name="cx" label="Special factor(s)" />
    </Group>
  );
}

export default function Margin() {
  return (
    <Calc
      id="margin-report"
      title="Margin report builder: one row per failure mode per load case"
      defaults={DEFAULTS}
      example={{ values: { fy: '1.10', fu: '1.25', fo: '1.25' }, note: 'Worked-example factors loaded: yield 1.10, ultimate 1.25, other 1.25', factorFields: ['fy', 'fu', 'fo'] }}
      foot="MS = allowable ÷ (factor × applied) − 1 with stresses or loads that respond linearly. For buckling, contact, preloaded joints and other non-linear responses, apply the factor to the load and analyse at the factored load."
    >
      <Inputs>
        <Group legend="Your programme's factors" hint="Factors come from your governing requirement, not from this site. Special factors (fitting, bearing, casting, weld, model uncertainty) go on the row they apply to and multiply the basic factor.">
          <FieldRow>
            <Num name="fy" label="Yield factor" placeholder="your value" />
            <Num name="fu" label="Ultimate factor" placeholder="your value" />
            <Num name="fo" label="Other (e.g. buckling)" placeholder="your value" />
          </FieldRow>
        </Group>
        <Group legend="Report rows">
          <Hint>Open a row to edit it; the report lists them all. Leave applied or allowable blank to drop a row.</Hint>
          <RowEditors />
        </Group>
        <CombinedFields />
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
