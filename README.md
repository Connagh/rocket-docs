# REF·DB

**Live site: [rocketengdatabase.com](https://rocketengdatabase.com/)**

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
  data/zones.mjs    THE ZONE PLAN — single source of truth for the rail, numbering, banners,
                    orbit map, route footer, home status board and roadmap (v1 ZONE_PLAN + PHASES)
  content/docs/     topic pages (Markdown / MDX)
  components/       interactive diagrams and calculators (.astro)
    overrides/      Starlight overrides: mission rail, zone banner, route footer, HUD header,
                    dark-by-default theme switch, page frame
    hud/            deep-field sky (ported from v1), mission-control home, roadmap
  lib/              calculation code, pure TypeScript, unit-tested in tests/
  data/             materials, specs, cross-reference and O-ring data extracted from v1
  styles/           custom.css (tokens, tools) and hud.css (the mission HUD layer)
public/legacy/      REF·DB v1 — unchanged except a small appended script for ?z=<zone> deep links
                    and a link back to v2
scripts/            extract-legacy-data.mjs — regenerates src/data from v1
```

To add a rebuilt zone: write the page, then map its zone key to the page slug in `REBUILT` in
`src/data/zones.mjs`. Everything else — rail, numbering, banners, roadmap — follows. `npm test` fails if a page is
orphaned or a mapped page is missing.

## Deploying

Pushing to `main` runs the tests, builds the site and publishes it with GitHub Pages at
https://rocketengdatabase.com (custom domain set in the repository's Pages settings; DNS at Namecheap)
(`.github/workflows/deploy.yml`). In the repository on GitHub: **Settings → Pages → Source: GitHub Actions**.

## Content rules

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: every number needs a source, every tool needs a worked example and a
test, and every page says where its method stops.

## Disclaimer

Educational and early-design screening material only. Values are typical published data, not design allowables.
Always verify against the current issue of the governing standard and your organisation's approved data, and have
analysis signed off by the responsible authority. Content is drawn from open literature only — see
[CONTRIBUTING.md](CONTRIBUTING.md#what-must-never-go-on-this-site).
