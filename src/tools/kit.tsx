// The calculator kit: every interactive tool on the site is built from these pieces, so they all look, read and
// behave the same way. Built on Cast UI; the maths stays in src/lib (pure, unit-tested) and never lives here.
//
//   <Calc title=… defaults=… example=… foot=…>      frame, form state, share link, worked example
//     <Inputs> <Group legend="Geometry"> <Num name="id" label="Internal diameter" unit="mm" /> … </Group> </Inputs>
//     <Outputs> <Readouts> <Readout label="Minimum wall" value={…} unit="mm" primary /> </Readouts> <Notes items={…} /> </Outputs>
//   </Calc>
//
// Form values are strings keyed by field name (exactly what goes in the share link); tools parse them with num().
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Accordion,
  AccordionItem,
  Button,
  Checkbox,
  Chip,
  Icon,
  Input,
  Select,
  SelectGroup,
  SelectOption,
  Slider,
  Tab,
  Tabs,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@castui/cast-ui';
import CastRoot from '../cast/CastRoot';

export type Values = Record<string, string>;
type Example = { values: Values; note: string; factorFields?: string[] };

type FormCtx = {
  v: Values;
  set: (name: string, value: string) => void;
  setMany: (values: Values) => void;
};
const Form = createContext<FormCtx | null>(null);

/** The tool's form state: current values and setters. */
export function useForm(): FormCtx {
  const f = useContext(Form);
  if (!f) throw new Error('useForm must be used inside <Calc>');
  return f;
}

// ---------------------------------------------------------------------------------------------------------------------
// Numbers

/** Parse a field: NaN when blank or not a number. */
export const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? NaN : Number(s));

/** en-GB number with fixed decimals; an em dash for anything that is not finite. */
export const fmt = (v: number, d = 2) =>
  Number.isFinite(v) ? v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

/** Scientific notation with a superscript exponent: 2.4 × 10⁻⁵. */
export const fmtSci = (v: number, d = 1) => {
  if (!Number.isFinite(v)) return '—';
  const [m, e] = v.toExponential(d).split('e');
  return `${m} × 10${String(+e).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)])}`;
};

/** Margin of safety: signed, three decimals, "0.000" at the limit. */
export const fmtMs = (v: number) => (!Number.isFinite(v) ? '—' : Math.abs(v) < 5e-4 ? '0.000' : `${v > 0 ? '+' : ''}${fmt(v, 3)}`);

/** Status of a margin: negative fails. */
export const msTone = (v: number): Tone | undefined => (!Number.isFinite(v) ? undefined : v < -1e-9 ? 'bad' : 'ok');

// ---------------------------------------------------------------------------------------------------------------------
// Frame

type CalcProps = {
  /** Shown in the tool's header bar, e.g. "Motor case sizing: metallic, membrane only". */
  title: string;
  /** Initial field values (strings). */
  defaults: Values;
  /** "Load worked example": the page's example inputs and the note naming its factors. */
  example?: Example;
  /** Fine print under the tool: what it does not cover. */
  foot?: React.ReactNode;
  /** Anchor id (the share link scrolls here). */
  id?: string;
  /** Turn off the share button (tools with no inputs worth sharing). */
  share?: boolean;
  children: React.ReactNode;
};

function useShare(v: Values, id: string) {
  const [label, setLabel] = useState('Copy link to these inputs');
  const share = useCallback(async () => {
    const q = new URLSearchParams();
    for (const [k, val] of Object.entries(v)) if (val !== '') q.set(k, val);
    const url = `${location.origin}${location.pathname}?${q}#${id}`;
    try {
      history.replaceState(null, '', url);
    } catch {} // throws in opaque origins
    try {
      await navigator.clipboard.writeText(url);
      setLabel('Link copied');
    } catch {
      setLabel('Link is in the address bar');
    }
    setTimeout(() => setLabel('Copy link to these inputs'), 2200);
  }, [v, id]);
  return { label, share };
}

function CalcFrame({ title, defaults, example, foot, id = 'calculator', share = true, children }: CalcProps) {
  const { scheme, spacing } = useTheme();
  const [v, setV] = useState<Values>(defaults);
  const [note, setNote] = useState<string | null>(null);
  const factorFields = useRef(example?.factorFields ?? []);

  // A share link reproduces the calculation: restore the inputs from the query string once mounted.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const restored: Values = {};
    for (const [k, val] of params) if (k in defaults) restored[k] = val;
    if (Object.keys(restored).length) setV((cur) => ({ ...cur, ...restored }));
  }, []);

  const ctx = useMemo<FormCtx>(
    () => ({
      v,
      set: (name, value) => {
        setV((cur) => ({ ...cur, [name]: value }));
        if (factorFields.current.includes(name)) setNote(null);
      },
      setMany: (values) => setV((cur) => ({ ...cur, ...values })),
    }),
    [v],
  );
  const { label: shareLabel, share: doShare } = useShare(v, id);

  const loadExample = () => {
    if (!example) return;
    setV((cur) => ({ ...cur, ...example.values }));
    const n = example.factorFields?.length ?? 0;
    setNote(n ? `${example.note}. Replace ${n > 1 ? "them with your programme's values" : "it with your programme's value"}.` : example.note);
  };

  return (
    <Form.Provider value={ctx}>
      <View
        {...({ dataSet: { calc: '' } } as object)}
        style={{ borderWidth: 1, borderColor: scheme.list.separator, borderRadius: 12, backgroundColor: scheme.surface.base }}
      >
        <View
          {...({ dataSet: { calcHead: '' } } as object)}
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: scheme.list.separator,
            backgroundColor: scheme.surface.subtle,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <Icon name="calculate" size="default" color={scheme.list.item.selected.fg} />
            <Text type="label-lg" color={scheme.text.primary} style={{ flexShrink: 1 }}>
              {title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, flexShrink: 1 }}>
            {example ? (
              <Button size="small" prominence="default" intent="brand" leadingIcon="science" onPress={loadExample}>
                Load worked example
              </Button>
            ) : null}
            {share ? (
              <Button size="small" prominence="subtle" leadingIcon="link" onPress={doShare}>
                {shareLabel}
              </Button>
            ) : null}
          </View>
        </View>
        {note ? (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <Note tone="info">{note}</Note>
          </View>
        ) : null}
        <View {...({ dataSet: { calcBody: '' } } as object)} style={{ padding: spacing.md, gap: spacing.lg }}>
          {children}
        </View>
        {foot ? (
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: scheme.list.separator }}>
            <RNText style={{ fontSize: 12.5, lineHeight: 18, color: scheme.text.description }}>{foot}</RNText>
          </View>
        ) : null}
      </View>
    </Form.Provider>
  );
}

/** A complete tool: Cast theme, frame and form state. */
export function Calc(props: CalcProps) {
  return (
    <CastRoot>
      <CalcFrame {...props} />
    </CastRoot>
  );
}

/** Left column (stacks above the results when the tool is narrow). */
export function Inputs({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View {...({ dataSet: { calcInputs: '' } } as object)} style={{ gap: spacing.md, minWidth: 0 }}>
      {children}
    </View>
  );
}

/** Right column. */
export function Outputs({ children, live = true }: { children: React.ReactNode; live?: boolean }) {
  const { spacing } = useTheme();
  return (
    <View
      {...({ dataSet: { calcOutputs: '' } } as object)}
      {...(live ? { 'aria-live': 'polite' } : {})}
      style={{ gap: spacing.md, minWidth: 0 }}
    >
      {children}
    </View>
  );
}

/** Full-width block under both columns. */
export function Wide({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View {...({ dataSet: { calcWide: '' } } as object)} style={{ gap: spacing.md, minWidth: 0 }}>
      {children}
    </View>
  );
}

/** A titled group of fields. */
export function Group({ legend, children, hint }: { legend: string; children: React.ReactNode; hint?: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View accessibilityRole={'group' as never} accessibilityLabel={legend} style={{ gap: spacing.sm }}>
      <SubHead>{legend}</SubHead>
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

/** Two (or more) fields side by side; wraps on a narrow tool. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-end' }}>
      {React.Children.map(children, (c) => (c ? <View style={{ flexGrow: 1, flexBasis: 120, minWidth: 0 }}>{c}</View> : null))}
    </View>
  );
}

/** Small uppercase label above a group of fields or results. */
export function SubHead({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      type="label-sm"
      color={colors.brand.default.default.fg}
      style={{ letterSpacing: 1, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
    >
      {children}
    </Text>
  );
}

/** Secondary text: a field hint, a source, a caveat. Accepts inline elements (sub/sup, links). */
export function Hint({ children, style }: { children: React.ReactNode; style?: object }) {
  const { scheme } = useTheme();
  return <RNText style={[{ fontSize: 13, lineHeight: 19, color: scheme.text.description }, style]}>{children}</RNText>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fields

const fieldLabel = (label: string, unit?: string) => (unit ? `${label} (${unit})` : label);

/** Number field. Blank is allowed (factor fields start blank by rule). */
export function Num({
  name,
  label,
  unit,
  placeholder,
  helper,
  error,
  disabled,
}: {
  name: string;
  label: string;
  unit?: string;
  placeholder?: string;
  helper?: string;
  error?: boolean;
  disabled?: boolean;
}) {
  const { v, set } = useForm();
  const raw = v[name] ?? '';
  const bad = error ?? (raw.trim() !== '' && !Number.isFinite(Number(raw)));
  return (
    <Input
      label={fieldLabel(label, unit)}
      value={raw}
      onChangeText={(t) => set(name, t.replace(',', '.'))}
      placeholder={placeholder}
      helperText={bad && !helper ? 'Enter a number' : helper}
      error={bad}
      disabled={disabled}
      keyboardType="decimal-pad"
      autoCapitalize="none"
    />
  );
}

/** Free-text field. */
export function TextField({ name, label, placeholder, helper }: { name: string; label: string; placeholder?: string; helper?: string }) {
  const { v, set } = useForm();
  return <Input label={label} value={v[name] ?? ''} onChangeText={(t) => set(name, t)} placeholder={placeholder} helperText={helper} />;
}

export type Option = { value: string; label: string; description?: string };
export type OptionGroup = { label: string; options: Option[] };

/** Dropdown. Pass `options`, or `groups` for an optgroup-style list. `search` adds a type-to-filter box. */
export function Choice({
  name,
  label,
  options,
  groups,
  helper,
  search,
  placeholder,
  then,
}: {
  name: string;
  label: string;
  options?: Option[];
  groups?: OptionGroup[];
  helper?: string;
  search?: boolean;
  placeholder?: string;
  /** Other fields to update when this one changes (e.g. a grade fills its strengths). */
  then?: (value: string) => Values | void;
}) {
  const { v, set, setMany } = useForm();
  const [q, setQ] = useState<string | undefined>(undefined);
  const all = groups ? groups.flatMap((g) => g.options) : (options ?? []);
  const value = v[name] ?? '';
  const current = all.find((o) => o.value === value);
  const match = (o: Option) => !q || o.label.toLowerCase().includes(q.toLowerCase());
  const render = (os: Option[]) =>
    os.filter(match).map((o) => (
      <SelectOption key={o.value} value={o.value} description={o.description}>
        {o.label}
      </SelectOption>
    ));
  return (
    <Select
      type={search ? 'combobox' : 'single'}
      label={label}
      helperText={helper}
      value={value}
      onValueChange={(val) => {
        set(name, val);
        setQ(undefined);
        const extra = then?.(val);
        if (extra) setMany(extra);
      }}
      searchValue={search ? q : undefined}
      onSearchChange={search ? setQ : undefined}
      // Options register on mount, so before hydration the trigger can't know the label: show it as the placeholder.
      placeholder={current?.label ?? placeholder ?? 'Select…'}
    >
      {groups
        ? groups.map((g) => {
            const os = render(g.options);
            return os.length ? (
              <SelectGroup key={g.label} label={g.label}>
                {os}
              </SelectGroup>
            ) : null;
          })
        : render(options ?? [])}
    </Select>
  );
}

/** Optional inputs folded away under a heading. */
export function More({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <Accordion type="single" size="small">
      <AccordionItem value="more" title={title}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>{children}</View>
      </AccordionItem>
    </Accordion>
  );
}

/** Two to four mutually exclusive options as a segmented control. */
export function Segmented({ name, label, options }: { name: string; label: string; options: Option[] }) {
  const { v, set } = useForm();
  const { spacing, scheme } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text type="label-md" color={scheme.text.primary}>
        {label}
      </Text>
      <ToggleButtonGroup
        exclusive
        value={v[name] ?? null}
        onValueChange={(val) => val !== null && set(name, val)}
        size="small"
        accessibilityLabel={label}
      >
        {options.map((o) => (
          <ToggleButton key={o.value} value={o.value}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </View>
  );
}

/** Checkbox; the value is "true" or "false". */
export function Check({ name, label }: { name: string; label: string }) {
  const { v, set } = useForm();
  return <Checkbox checked={v[name] === 'true'} onChange={(c) => set(name, c ? 'true' : 'false')}>{label}</Checkbox>;
}

/** Slider bound to a number field, with its value shown beside the label. */
export function Range({
  name,
  label,
  unit,
  min,
  max,
  step = 1,
  format = (x: number) => fmt(x, step < 1 ? Math.min(3, String(step).split('.')[1]?.length ?? 1) : 0),
}: {
  name: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const { v, set } = useForm();
  const { spacing, scheme } = useTheme();
  const value = num(v[name]);
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text type="label-md" color={scheme.text.primary}>
          {label}
        </Text>
        <Text type="label-md" color={scheme.text.description} style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {`${format(value)}${unit ? ` ${unit}` : ''}`}
        </Text>
      </View>
      <Slider
        value={Number.isFinite(value) ? value : min}
        min={min}
        max={max}
        step={step}
        onValueChange={(x) => set(name, String(Math.round(x / step) * step))}
        accessibilityLabel={fieldLabel(label, unit)}
      />
    </View>
  );
}

/** Tabs that switch between modes of one tool; the active tab is a form value so it is shared in links. */
export function ModeTabs({ name, options }: { name: string; options: Option[] }) {
  const { v, set } = useForm();
  return (
    <Tabs value={v[name]} onValueChange={(val) => set(name, val)} size="small">
      {options.map((o) => (
        <Tab key={o.value} value={o.value}>
          {o.label}
        </Tab>
      ))}
    </Tabs>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Results

export type Tone = 'ok' | 'bad' | 'warn' | 'info';

function toneColor(scheme: ReturnType<typeof useTheme>['scheme'], tone?: Tone) {
  switch (tone) {
    case 'ok':
      return { fg: 'var(--site-ok)', bg: 'var(--site-ok-bg)' };
    case 'bad':
      return { fg: 'var(--cast-intents-danger-default-default-fg)', bg: 'var(--site-danger-bg)' };
    case 'warn':
      return { fg: 'var(--site-warn)', bg: 'var(--site-warn-bg)' };
    case 'info':
      return { fg: 'var(--site-info)', bg: 'var(--site-info-bg)' };
    default:
      return { fg: scheme.text.primary, bg: scheme.surface.subtle };
  }
}

const TONE_ICON: Record<Tone, string> = { ok: 'check_circle', bad: 'cancel', warn: 'warning', info: 'info' };
const TONE_WORD: Record<Tone, string> = { ok: 'OK', bad: 'Fails', warn: 'Check', info: 'Note' };

/** A grid of readouts. */
export function Readouts({ children }: { children: React.ReactNode }) {
  return (
    <View {...({ dataSet: { readouts: '' } } as object)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {children}
    </View>
  );
}

/**
 * One result: label, value, unit. `tone` marks pass/fail; it is shown by colour AND an icon with a spoken word, never
 * by colour alone. `primary` is the headline number of the tool.
 */
export function Readout({
  label,
  value,
  unit,
  tone,
  primary,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  primary?: boolean;
  /** A short qualifier under the value, e.g. "thin wall". */
  sub?: string;
}) {
  const { scheme, colors } = useTheme();
  const t = toneColor(scheme, tone);
  const valueColor = tone ? t.fg : primary ? colors.brand.default.default.fg : scheme.text.primary;
  return (
    <View
      {...({ dataSet: { readout: primary ? 'primary' : '' } } as object)}
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}${tone ? `, ${TONE_WORD[tone]}` : ''}`}
      style={{
        flexGrow: 1,
        flexBasis: primary ? 200 : 140,
        minWidth: 0,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: primary ? colors.brand.default.default.border : tone ? t.fg : scheme.list.separator,
        backgroundColor: tone ? t.bg : scheme.surface.subtle,
        gap: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text type="label-sm" color={scheme.text.description} style={{ flexShrink: 1 }}>
          {label}
        </Text>
        {tone && tone !== 'info' ? <Icon name={TONE_ICON[tone]} size="xs" color={t.fg} /> : null}
      </View>
      <RNText
        style={{
          fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
          fontSize: primary ? 22 : 17,
          lineHeight: primary ? 28 : 24,
          fontWeight: primary ? '600' : '400',
          color: valueColor,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
        {unit ? <RNText style={{ fontSize: 12, color: scheme.text.description, fontWeight: '400' }}>{` ${unit}`}</RNText> : null}
      </RNText>
      {sub ? (
        <Text type="caption" color={scheme.text.description}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** A note or verdict with a tone icon. Children may be rich (bold, sub/superscripts). */
export function Note({ tone = 'info', children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  const { scheme } = useTheme();
  const t = toneColor(scheme, tone);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: t.fg,
        backgroundColor: t.bg,
      }}
    >
      <Icon name={TONE_ICON[tone]} size="default" color={t.fg} style={{ marginTop: 0 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <Text type="label-md" color={scheme.text.primary}>
            {title}
          </Text>
        ) : null}
        <RNText style={{ fontSize: 14, lineHeight: 21, color: scheme.text.primary }}>{children}</RNText>
      </View>
    </View>
  );
}

/** A list of notes; empty renders nothing. */
export function Notes({ items }: { items: { tone: Tone; text: React.ReactNode }[] }) {
  const { spacing } = useTheme();
  if (!items.length) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((n, i) => (
        <Note key={i} tone={n.tone}>
          {n.text}
        </Note>
      ))}
    </View>
  );
}

/** Frame for an SVG chart or drawing inside a tool. */
export function Figure({ children, caption, label, style }: { children: React.ReactNode; caption?: React.ReactNode; label?: string; style?: StyleProp<ViewStyle> }) {
  const { scheme } = useTheme();
  return (
    <View
      accessibilityRole={'figure' as never}
      accessibilityLabel={label}
      style={[{ borderWidth: 1, borderColor: scheme.list.separator, borderRadius: 8, padding: 10, backgroundColor: 'var(--rd-panel)' as never, gap: 6 }, style]}
    >
      {children}
      {caption ? <Hint>{caption}</Hint> : null}
    </View>
  );
}

/** Simple data table for tool output (Cast's Table is for flex layouts; this keeps column alignment for numbers). */
export function DataTable({
  columns,
  rows,
  caption,
}: {
  columns: { label: string; numeric?: boolean }[];
  rows: (React.ReactNode | { value: React.ReactNode; tone?: Tone })[][];
  caption?: string;
}) {
  const cell = (c: (typeof rows)[number][number]) =>
    c !== null && typeof c === 'object' && 'value' in (c as object) ? (c as { value: React.ReactNode; tone?: Tone }) : { value: c as React.ReactNode };
  return (
    <div className="tool-table" role="region" aria-label={caption} tabIndex={0}>
      <table>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} className={c.numeric ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => {
                const { value, tone } = cell(c);
                return (
                  <td key={j} className={[columns[j]?.numeric ? 'num' : '', tone ? `tone-${tone}` : ''].join(' ').trim() || undefined}>
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Inline helpers for rich text in notes and hints. */
export const Sub = ({ children }: { children: React.ReactNode }) => <sub>{children}</sub>;
export const Sup = ({ children }: { children: React.ReactNode }) => <sup>{children}</sup>;
export const B = ({ children }: { children: React.ReactNode }) => <RNText style={{ fontWeight: '600' }}>{children}</RNText>;

/** A small button row inside a tool (e.g. "Add row"). */
export function Actions({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

/** Plain pressable text link inside a tool. */
export function ToolLink({ href, children }: { href: string; children: string }) {
  const { colors } = useTheme();
  return (
    <Pressable {...({ href } as object)} accessibilityRole="link">
      <Text type="body-sm" color={colors.brand.default.default.fg} style={{ textDecorationLine: 'underline' }}>
        {children}
      </Text>
    </Pressable>
  );
}

/**
 * "Fill from the material library": a dropdown that copies library values into the tool's own fields. It starts
 * blank, so the worked-example values stay until a material is picked; the fields stay editable afterwards.
 * Data comes from materialFill() in the tool's .astro wrapper.
 */
export function MaterialFill({
  fill,
  label = 'Fill from the material library',
}: {
  fill: { fields: Record<string, string | undefined>; groups: OptionGroup[]; data: Record<string, Record<string, number>> };
  label?: string;
}) {
  const { setMany } = useForm();
  const [picked, setPicked] = useState('');
  const [q, setQ] = useState<string | undefined>(undefined);
  const all = fill.groups.flatMap((g) => g.options);
  const match = (o: Option) => !q || o.label.toLowerCase().includes(q.toLowerCase());
  return (
    <Select
      type="combobox"
      label={label}
      value={picked}
      placeholder={all.find((o) => o.value === picked)?.label ?? '— keep the values below —'}
      searchValue={q}
      onSearchChange={setQ}
      onValueChange={(key) => {
        setPicked(key);
        setQ(undefined);
        const m = fill.data[key];
        if (!m) return;
        const next: Values = {};
        for (const [prop, name] of Object.entries(fill.fields)) if (name && m[prop] !== undefined) next[name] = String(Number(m[prop].toPrecision(6)));
        setMany(next);
      }}
    >
      {fill.groups.map((g) => {
        const os = g.options.filter(match);
        return os.length ? (
          <SelectGroup key={g.label} label={g.label}>
            {os.map((o) => (
              <SelectOption key={o.value} value={o.value}>
                {o.label}
              </SelectOption>
            ))}
          </SelectGroup>
        ) : null;
      })}
    </Select>
  );
}

/** Filter chips (one selected), e.g. a material family filter. The value lives in the form like any other field. */
export function ChipFilter({ name, options, label }: { name: string; options: Option[]; label: string }) {
  const { v, set } = useForm();
  return (
    <View accessibilityRole={'radiogroup' as never} accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <Chip key={o.value} size="small" selected={(v[name] ?? '') === o.value} onPress={() => set(name, o.value)}>
          {o.label}
        </Chip>
      ))}
    </View>
  );
}

/** SVG text halo: keeps a label legible where it crosses a line. Spread onto <text>. */
export const HALO = { stroke: 'var(--rd-panel)', strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const;

/** An inline link inside a note or hint. */
export const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="tool-a">
    {children}
  </a>
);

export type BarGroup = { title: string; unit: string; bars: [label: string, value: number, color: string][]; digits?: number; div?: number };

/** Horizontal bars in labelled groups, each group scaled to its own largest bar. */
export function BarGroups({ groups, label, caption, width = 420 }: { groups: BarGroup[]; label: string; caption?: React.ReactNode; width?: number }) {
  const L = 8, R = 12;
  let y = 18;
  const blocks = groups.map((g) => {
    const top = y;
    const shown = g.bars.filter((b) => Number.isFinite(b[1]));
    y += 10 + shown.length * 22 + 30;
    const max = Math.max(...shown.map((b) => Math.max(0, b[1])), 0) * 1.05 || 1;
    return { g, top, shown, max };
  });
  const H = y - 20;
  return (
    <Figure label={label} caption={caption}>
      <svg viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
        {blocks.map(({ g, top, shown, max }) => (
          <g key={g.title}>
            <text x={L} y={top} fontSize={13} fontWeight={600} fill="var(--rd-ink)">{g.title}</text>
            {shown.map(([name, val, color], i) => {
              const yy = top + 10 + i * 22, w = (Math.max(0, val) / max) * (width - L - R);
              return (
                <g key={name}>
                  <rect x={L} y={yy} width={Math.max(2, w)} height={16} rx={2} fill={color} fillOpacity={0.75} />
                  <text x={L + 6} y={yy + 12} fontSize={12} fill="var(--rd-ink)" {...HALO}>
                    {`${name} ${fmt(val / (g.div ?? 1), g.digits ?? 2)} ${g.unit}`}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </Figure>
  );
}
