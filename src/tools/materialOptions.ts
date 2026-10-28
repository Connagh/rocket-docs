// Server-side helper for tool wrappers: a material list as grouped dropdown options (by family, in library order).
// Kept out of the islands so the material library JSON is not shipped to the browser with every tool.
import { grouped, withProps, type Material, type Prop, type Kind } from '../lib/materials';
import type { OptionGroup } from './kit';

export const materialGroups = (list: { key: string; name: string; family: string }[]): OptionGroup[] =>
  grouped(list as Material[]).map((g) => ({ label: g.label, options: g.items.map((m) => ({ value: m.key, label: m.name })) }));

type FillProp = 'E' | 'nu' | 'Fty' | 'Ftu' | 'kic';

/**
 * Data for <MaterialFill>: the materials that have every property a tool's fill needs, as dropdown groups, plus the
 * property values by key. `fields` maps a library property to the tool's field name.
 */
export function materialFill(fields: Partial<Record<FillProp, string>>, kinds: Kind[] = ['metal']) {
  const props = Object.keys(fields) as Prop[];
  const list = withProps(props, kinds);
  return {
    fields,
    groups: materialGroups(list),
    data: Object.fromEntries(list.map((m) => [m.key, Object.fromEntries(props.map((p) => [p, m[p as keyof Material] as number]))])),
  };
}
export type MaterialFillData = ReturnType<typeof materialFill>;
