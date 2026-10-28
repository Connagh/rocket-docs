// Searchable designation cross-reference (REF·DB v1 data).
import React from 'react';
import { Input, Text, useTheme } from '@castui/cast-ui';
import { Calc, Wide, ChipFilter, DataTable, useForm } from './kit';

export type XrefRow = { family: string; name: string; en: string; enNo: string; legacyBs: string; uns: string; aero: string; note: string };

const FAM: Record<string, string> = { al: 'Aluminium', mg: 'Magnesium', ti: 'Titanium', steel: 'Steel', ss: 'Stainless', ni: 'Nickel / cobalt', cu: 'Copper', refract: 'Refractory' };

function Table({ rows }: { rows: XrefRow[] }) {
  const { v, set } = useForm();
  const { scheme } = useTheme();
  const terms = (v.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((r) => (!v.fam || r.family === v.fam) && terms.every((t) => Object.values(r).join(' ').toLowerCase().includes(t)));
  return (
    <>
      <Input
        value={v.q}
        onChangeText={(t) => set('q', t)}
        leadingIcon="search"
        placeholder="Search any name or number: 6082, 1.4404, K24728, HE30, AMS 4911…"
        accessibilityLabel="Search designations"
        autoCapitalize="none"
      />
      <ChipFilter
        name="fam"
        label="Material family"
        options={[{ value: '', label: 'All' }, ...[...new Set(rows.map((r) => r.family))].map((f) => ({ value: f, label: FAM[f] ?? f }))]}
      />
      <Text type="body-sm" color={scheme.text.description}>{`${shown.length} of ${rows.length} designations`}</Text>
      <div className="xref-scroll">
        <DataTable
          columns={[{ label: 'Common name' }, { label: 'BS EN / ISO' }, { label: 'EN No.' }, { label: 'Legacy BS' }, { label: 'UNS' }, { label: 'Aero / other' }, { label: 'Note' }]}
          rows={shown.map((r) => [<b key="n">{r.name}</b>, r.en, r.enNo, r.legacyBs, r.uns, r.aero, <span key="note" className="xref-note">{r.note}</span>])}
        />
      </div>
    </>
  );
}

export default function Xref({ rows }: { rows: XrefRow[] }) {
  return (
    <Calc
      title="Designation cross-reference"
      defaults={{ q: '', fam: '' }}
      foot="Nearest equivalents, not interchangeable grades. Composition limits, melt practice, testing and acceptance differ between systems."
    >
      <Wide>
        <Table rows={rows} />
      </Wide>
    </Calc>
  );
}
