// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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
      logo: { src: './src/assets/logo.svg', replacesTitle: false },
      favicon: '/favicon.svg',
      customCss: [
        '@fontsource/ibm-plex-sans/400.css',
        '@fontsource/ibm-plex-sans/600.css',
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/600.css',
        'katex/dist/katex.min.css',
        './src/styles/custom.css',
      ],
      lastUpdated: true,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'How to use this site', slug: 'start/how-to-use' },
            { label: 'Migration roadmap', slug: 'start/roadmap' },
          ],
        },
        {
          label: 'Fundamentals',
          items: [{ label: 'How a solid rocket motor works', slug: 'fundamentals/how-a-solid-motor-works' }],
        },
        {
          label: 'Motor hardware',
          items: [
            { label: 'Case & pressure vessel sizing', slug: 'motor/case-sizing' },
            { label: 'Propellant grain', slug: 'motor/propellant-grain' },
            { label: 'Insulation & ablative liners', slug: 'motor/insulation' },
          ],
        },
        {
          label: 'Legacy reference',
          items: [
            {
              label: 'REF·DB v1 (all 64 zones)',
              link: '/legacy/',
              attrs: { target: '_blank', rel: 'noopener' },
            },
          ],
        },
      ],
    }),
  ],
});
