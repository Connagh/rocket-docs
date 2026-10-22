# Writing a topic page

Every topic page follows the same structure so a reader who has used one page can navigate all of them. Copy the
structure of [`src/content/docs/motor/case-sizing.mdx`](src/content/docs/motor/case-sizing.mdx).

1. **At a glance** (`<div class="glance">`) — the idea in one line, the prerequisite page, the legacy zone it replaces.
2. **Why this matters** — the real-hardware consequence of getting it wrong.
3. **Intuition** — at least one `<Analogy>` and one diagram before the first equation.
4. **The physics** — equations in KaTeX (`$…$`, `$$…$$`), every symbol defined in words.
5. **Tool** — an interactive component in `src/components/`, calling pure functions in `src/lib/`.
6. **Worked example** — the tool's default inputs, solved by hand step by step. The same numbers are asserted in
   `tests/`.
7. **Where this stops** — the method's limits and the classic mistakes.
8. **On the drawing** — how the result is specified and verified.
9. **References** — open literature first, then the governing standards.

## Rules for numbers

- Calculation logic lives in `src/lib/*.ts` as pure functions. UI components never contain formulas.
- Every published worked example has a matching test in `tests/`. Run `npm test` before committing.
- Material data comes from `src/data/materials.json`. Regenerate it from v1 with `npm run extract:legacy`; once v1 is
  retired, edit the JSON directly and cite the source of each change in the commit message.
- Label screening values as screening values. Fracture toughness is always "indicative".
- Prefer SI units (MPa, mm, kg, °C). Show bar/psi as secondary where engineers expect them.

## Analogies and visuals

- An analogy must be **physically faithful**, not just evocative. Say where it breaks down if that matters.
- Diagrams are inline SVG using the `--rd-*` colour tokens in `src/styles/custom.css` so they work in light and dark
  mode. Give every SVG a `<desc>` describing what it shows.
- Mark schematic drawings "not to scale". Mark drawings that *are* to scale, because that is often the lesson.

## What must never go on this site

This is a public site. Only content that is already in the open literature belongs here.

- Nothing from an employer or customer: no proprietary design rules, drawings, data, test results, programme names
  or part numbers.
- Nothing export-controlled (e.g. UK Strategic Export Control Lists, US ITAR/EAR) and nothing classified. Solid
  rocket motor technology is controlled in many jurisdictions; general textbook principles are not, but specific
  design data, formulations and manufacturing know-how can be. **If in doubt, leave it out** and ask your export
  control officer.
- No propellant formulation, processing or energetics manufacturing detail.

### Scope compared with REF·DB v1

v1 deliberately stayed mechanical and structural, leaving out internal ballistics and grain performance. **v2 widens
that on purpose** (owner's decision, October 2026): textbook-level internal ballistics — burn rate laws, chamber
pressure balance, grain burn-back and thrust profiles — is in scope, because it is open-literature teaching material
(Sutton, NASA SP-8076) and the structural topics depend on it. Everything in the list above still stays out:
formulations, energetics processing and initiation, and anything beyond what a standard textbook already publishes.
