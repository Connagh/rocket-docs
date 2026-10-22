// Material callout builder: turns a spec sheet + chosen form, condition and finish
// into a drawing material block. The three-part rule: alloy and condition, product
// form standard (with its tolerance standard), and the finish with its own spec.

export interface SpecForm { form: string; standard: string; note: string; }
export interface SpecTemper { code: string; note: string; }
export interface SpecFinish { name: string; spec: string; note: string; }
export interface SpecSheet {
  name: string; designation: string; family: string; base: string; composition: string;
  forms: SpecForm[]; tempers: SpecTemper[]; finishes: SpecFinish[]; callout: string; tips: string[];
}

const stripNotes = (s: string) => s.replace(/\s*\([^)]*\)/g, '').trim();

/** Split a form standard into the property standard alternatives and the tolerance standard(s). */
export function parseStandard(raw: string) {
  const parts = raw.split(/\s\+\s/).map(stripNotes).filter(Boolean);
  const alternatives = (parts[0] ?? '').split(/\s\/\s/).map((s) => s.trim()).filter(Boolean);
  return { alternatives, tolerances: parts.slice(1) };
}

/** First code of a temper entry: 'T6 / T651' → 'T6'. */
export const temperCode = (raw: string) => raw.split(/\s\/\s/)[0].trim();

/** Finish spec without bracketed notes; generic company specs become a placeholder. */
export const finishSpec = (raw: string) => {
  const s = stripNotes(raw).split(/\s\/\s/)[0].trim();
  return /company/i.test(s) ? '<COMPANY SPEC>' : s;
};

export interface CalloutChoice {
  sheet: SpecSheet;
  formIndex: number;
  standard: string; // one of the parsed alternatives
  temperIndex: number; // -1 = none
  finishIndex: number; // -1 = none
  afterFinish: boolean;
  traceability: boolean;
  certificate: boolean;
}

const pad = (k: string) => (k + ':').padEnd(10, ' ');
const CONT = ' '.repeat(10);

export function buildCallout(c: CalloutChoice) {
  const s = c.sheet;
  const form = s.forms[c.formIndex];
  const { tolerances } = parseStandard(form.standard);
  const temper = c.temperIndex >= 0 ? s.tempers[c.temperIndex] : null;
  const finish = c.finishIndex >= 0 ? s.finishes[c.finishIndex] : null;
  const FORM = form.form.toUpperCase().replace(/&/g, 'AND');
  const lines: string[] = [];

  if (s.family === 'al' && temper) {
    // EN aluminium: the temper is part of the designation (EN AW-6082-T6)
    lines.push(`${pad('MATERIAL')}${s.designation}-${temperCode(temper.code)} ${FORM} TO ${c.standard}`);
  } else {
    lines.push(`${pad('MATERIAL')}${s.designation} ${FORM} TO ${c.standard}`);
    if (temper) lines.push(`${CONT}CONDITION: ${temperCode(temper.code).toUpperCase()}`);
  }
  for (const t of tolerances) lines.push(`${CONT}TOLERANCES TO ${t}`);
  if (finish) lines.push(`${pad('FINISH')}${finish.name.toUpperCase()} TO ${finishSpec(finish.spec)}`);
  if (c.certificate) lines.push(`${pad('CERTS')}SUPPLY WITH BS EN 10204 TYPE 3.1 INSPECTION CERTIFICATE`);
  if (c.traceability) lines.push(`${pad('MARK')}BATCH / HEAT NO. BY <METHOD> AT <LOCATION>`, `${CONT}NO STAMPING ON FRACTURE-CRITICAL SURFACES`);
  if (c.afterFinish && finish) lines.push(`${pad('NOTE')}DIMENSIONS APPLY AFTER FINISH`);
  return lines.join('\n');
}
