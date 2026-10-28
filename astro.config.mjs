// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

// SITE_URL / BASE_PATH are set by the GitHub Pages workflow so the same config
// works for https://<user>.github.io/<repo>/ and for a custom domain at "/".
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        rehypeKatex,
        rehypeSlug,
        // A "#" link after each section heading, so a reader can copy a link to any section. The "#" is drawn by CSS
        // so it stays out of the heading text (the table of contents and the search index read that text).
        [rehypeAutolinkHeadings, {
          behavior: 'append',
          test: ['h2', 'h3'],
          properties: { class: 'heading-link', ariaLabel: 'Link to this section' },
          content: [],
        }],
      ],
    }),
  },
  integrations: [
    mdx(),
    react(),
    // The frozen classic site and the v1 archive are kept for old links, not for search engines.
    sitemap({ filter: (page) => !/\/(classic|legacy)\//.test(page) }),
  ],
  vite: {
    // Cast UI is a React Native library. "react-native" is installed as an npm alias of react-native-web (see
    // package.json), so Cast's own require('react-native') and our imports resolve to the same single copy.
    resolve: { extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'] },
    define: { __DEV__: 'false', global: 'globalThis' },
  },
});
