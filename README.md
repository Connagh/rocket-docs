# REF·DB

**Live site: [dashroyy.github.io/ref-db](https://dashroyy.github.io/ref-db/)**

A learning-first engineering reference for **solid rocket motor** and **mechanical design** — pressure vessels, motor
components, materials, joints, tolerancing and design standards. Every topic explains the idea with an analogy and a
diagram before the equations, then gives you an interactive tool, a worked example and the traps.

Version 2 is a static website built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).
The original single-file REF·DB v1 (64 zones) is kept intact at [`public/legacy/index.html`](public/legacy/index.html)
and served at `/legacy/` while its zones are rebuilt one by one — see the
[migration roadmap](src/content/docs/start/roadmap.md).

## Run it locally

Requires Node.js 22 or later.

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # unit tests for the calculation library
npm run build      # static site in dist/
```

## Project layout

```
src/
  content/docs/     topic pages (Markdown / MDX) — the sidebar mirrors this
  components/       interactive diagrams and calculators (.astro)
  lib/              calculation code, pure TypeScript, unit-tested in tests/
  data/             materials.json, extracted from the v1 database
  styles/custom.css theme (v1 palette) and shared tool styles
public/legacy/      REF·DB v1, unchanged
scripts/            extract-legacy-data.mjs — regenerates src/data from v1
```

## Deploying

Pushing to `main` runs the tests, builds the site and publishes it with GitHub Pages
(`.github/workflows/deploy.yml`). In the repository on GitHub: **Settings → Pages → Source: GitHub Actions**.

## Content rules

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: every number needs a source, every tool needs a worked example and a
test, and every page says where its method stops.

## Disclaimer

Educational and early-design screening material only. Values are typical published data, not design allowables.
Always verify against the current issue of the governing standard and your organisation's approved data, and have
analysis signed off by the responsible authority. Content is drawn from open literature only — see
[CONTRIBUTING.md](CONTRIBUTING.md#what-must-never-go-on-this-site).
