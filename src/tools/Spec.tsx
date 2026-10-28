// Material specification builder: pick a sheet, product form, condition and finish, and get a drawing callout to
// copy. Callout assembly in src/lib/callout.ts (unit-tested); the sheets come from the wrapper (src/data).
import React, { useState } from 'react';
import { Button } from '@castui/cast-ui';
import { parseStandard, buildCallout, type SpecSheet } from '../lib/callout';
import { Calc, Inputs, Outputs, Group, Choice, Check, Hint, SubHead, Actions, useForm, type OptionGroup, type Values } from './kit';

const FAM: Record<string, string> = { steel: 'Steels', ss: 'Stainless & PH steels', ti: 'Titanium', al: 'Aluminium', ni: 'Nickel alloys', cu: 'Copper' };
const opts = (items: string[]) => items.map((t, i) => ({ value: String(i), label: t }));

/** Field values for the first form and the first temper and finish of a sheet. */
const startOf = (s: SpecSheet): Values => ({ form: '0', std: '0', temper: s.tempers.length ? '0' : '-1', finish: s.finishes.length ? '0' : '-1' });

function Body({ sheets }: { sheets: SpecSheet[] }) {
  const { v } = useForm();
  const [copied, setCopied] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const groups: OptionGroup[] = Object.entries(FAM)
    .map(([k, label]) => ({ label, options: sheets.map((s, i) => ({ s, i })).filter(({ s }) => s.family === k).map(({ s, i }) => ({ value: String(i), label: s.name })) }))
    .filter((g) => g.options.length);
  const s = sheets[+v.sheet] ?? sheets[0];
  const fi = Math.min(+v.form || 0, s.forms.length - 1), ti = +v.temper, ni = +v.finish;
  const f = s.forms[fi];
  const alts = parseStandard(f.standard).alternatives;
  const std = alts[+v.std] ?? alts[0] ?? '';
  const temper = ti >= 0 ? s.tempers[ti] : null, finish = ni >= 0 ? s.finishes[ni] : null;
  const callout = buildCallout({ sheet: s, formIndex: fi, standard: std, temperIndex: temper ? ti : -1, finishIndex: finish ? ni : -1, afterFinish: v.after === 'true', traceability: v.trace === 'true', certificate: v.cert === 'true' });
  const copy = async () => {
    try { await navigator.clipboard.writeText(callout); setCopied('Copied'); setFallback(false); }
    catch { setCopied('Select the callout and copy'); setFallback(true); }
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <>
      <Inputs>
        <Group legend="Material" hint={`${s.base}${s.composition ? ` · ${s.composition}` : ''}`}>
          <Choice name="sheet" label="Specification sheet" groups={groups} search then={(val) => startOf(sheets[+val])} />
        </Group>
        <Group legend="1 · Product form" hint={`${f.standard}${f.note ? `: ${f.note}` : ''}`}>
          <Choice name="form" label="Form" options={opts(s.forms.map((x) => x.form))} then={() => ({ std: '0' })} />
          <Choice name="std" label="Governing standard" options={opts(alts)} />
        </Group>
        <Group legend="2 · Condition" hint={temper ? temper.note : 'Leaving the condition off the drawing leaves it to the supplier.'}>
          <Choice name="temper" label="Temper or heat treatment" options={[{ value: '-1', label: '— not stated —' }, ...opts(s.tempers.map((x) => x.code))]} />
        </Group>
        <Group legend="3 · Finish" hint={finish ? `${finish.spec}: ${finish.note}` : 'No finish called up.'}>
          <Choice name="finish" label="Finish" options={[{ value: '-1', label: '— none —' }, ...opts(s.finishes.map((x) => x.name))]} />
        </Group>
        <Group legend="Extra lines">
          <Check name="cert" label="Inspection certificate (BS EN 10204 3.1)" />
          <Check name="trace" label="Batch marking and traceability" />
          <Check name="after" label="Dimensions apply after finish" />
        </Group>
      </Inputs>
      <Outputs>
        <SubHead>Your callout</SubHead>
        <pre className="tool-pre" tabIndex={0} aria-label="Drawing callout">{callout}</pre>
        <Actions>
          <Button size="small" intent="brand" leadingIcon="content_copy" onPress={copy}>{copied ?? 'Copy callout'}</Button>
        </Actions>
        {fallback ? <textarea className="tool-copytext" readOnly rows={8} value={callout} aria-label="Callout to copy" onFocus={(e) => e.currentTarget.select()} /> : null}
        <Hint>Placeholders in &lt;angle brackets&gt; are yours to fill. Check every standard is the issue your programme invokes.</Hint>
        {s.callout ? (
          <>
            <SubHead>How v1 wrote it for this material</SubHead>
            <pre className="tool-pre muted" tabIndex={0} aria-label="Example callout from v1">{s.callout}</pre>
          </>
        ) : null}
        <SubHead>Practical tips</SubHead>
        <ul className="tool-list">{s.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </Outputs>
    </>
  );
}

export default function Spec({ sheets }: { sheets: SpecSheet[] }) {
  const d6 = Math.max(0, sheets.findIndex((s) => s.name === 'D6AC'));
  const defaults: Values = { sheet: String(d6), ...startOf(sheets[d6]), cert: 'true', trace: 'false', after: 'true' };
  return (
    <Calc id="spec-builder" title="Material specification builder" defaults={defaults}>
      <Body sheets={sheets} />
    </Calc>
  );
}
