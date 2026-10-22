// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PHASES, BRIEFING, route } from './src/data/zones.mjs';

// The visible rail is rendered by src/components/overrides/Sidebar.astro from the
// zone plan; this config mirrors the same plan (v2 pages only) as Starlight's fallback.
const sidebar = [
  { label: 'Briefing', items: BRIEFING.map((b) => ({ label: b.label, slug: b.slug })) },
  ...PHASES.map((p) => ({
    label: p.n,
    items: route()
      .filter((z) => z.phase === p.k && z.slug)
      .map((z) => ({ label: `${z.tag} ${z.label}`, slug: /** @type {string} */ (z.slug) })),
  })).filter((g) => g.items.length > 0),
];

// SITE_URL / BASE_PATH are set by the GitHub Pages workflow so the same config
// works for https://<user>.github.io/<repo>/ and for a custom domain at "/".
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.BASE_PATH || '/',
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }),
  },
  integrations: [
    starlight({
      title: 'REF·DB',
      description:
        'Solid rocket motor and mechanical design reference — learn the concepts, then use the tools.',
      favicon: '/favicon.svg',
      customCss: [
        '@fontsource/ibm-plex-sans/400.css',
        '@fontsource/ibm-plex-sans/600.css',
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/600.css',
        'katex/dist/katex.min.css',
        './src/styles/custom.css',
        './src/styles/hud.css',
      ],
      lastUpdated: true,
      pagination: false,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      components: {
        ThemeProvider: './src/components/overrides/ThemeProvider.astro',
        ThemeSelect: './src/components/overrides/ThemeSelect.astro',
        SocialIcons: './src/components/overrides/SocialIcons.astro',
        SiteTitle: './src/components/overrides/SiteTitle.astro',
        PageFrame: './src/components/overrides/PageFrame.astro',
        Sidebar: './src/components/overrides/Sidebar.astro',
        PageTitle: './src/components/overrides/PageTitle.astro',
        Footer: './src/components/overrides/Footer.astro',
      },
      sidebar,
    }),
  ],
});
