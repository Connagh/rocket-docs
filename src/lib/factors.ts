// REF·DB rule (from v1): factor values are never supplied. Safety, proof, burst and
// life factors come from the programme's governing requirement; calculators start
// with them blank and only compute what needs them once the user enters them.
// Each calculator offers "Load worked example" to fill the page's example inputs.

/** A factor read from a text input: null if blank, not a number, or below its minimum. */
export function readFactor(raw: string, min = 1): number | null {
  if (raw.trim() === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= min ? v : null;
}

const list = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** The message shown in place of results that need a factor the user hasn't entered. */
export const awaitingMessage = (names: string[], what = 'this', example = true) =>
  `Enter your programme's ${list(names)} to see ${what}. Factors come from your governing requirement (programme design rules or the applicable standard), not from this site.${example ? ' Or press “Load worked example”.' : ''}`;

/**
 * Wire a "Load worked example" button: fills every named field, shows a note naming the
 * example's factors, and clears the note as soon as the user edits any factor field.
 */
export function wireWorkedExample(opts: {
  root: HTMLElement;
  values: Record<string, string>;
  factorFields: string[];
  note: string; // e.g. "Worked-example factors: proof 1.10, burst 1.25"
  onLoad: () => void;
}) {
  const { root, values, factorFields, note, onLoad } = opts;
  const form = root.querySelector('form');
  const btn = root.querySelector<HTMLButtonElement>('[data-load-example]');
  const noteEl = root.querySelector<HTMLElement>('[data-example-note]');
  if (!form || !btn) return;
  const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
  btn.addEventListener('click', () => {
    for (const [k, v] of Object.entries(values)) {
      const f = field(k);
      if (!f) continue;
      if (f instanceof HTMLInputElement && f.type === 'checkbox') f.checked = v === 'true';
      else f.value = v;
      f.dispatchEvent(new Event('change', { bubbles: false }));
    }
    const replace = factorFields.length > 1 ? "them with your programme's values" : "it with your programme's value";
    if (noteEl) { noteEl.textContent = `${note}. Replace ${replace}.`; noteEl.hidden = false; }
    onLoad();
  });
  for (const n of factorFields) field(n)?.addEventListener('input', () => { if (noteEl) noteEl.hidden = true; });
}
