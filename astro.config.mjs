// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  /* Must match `url` in src/site.ts — Astro uses it for the sitemap and for
     resolving absolute URLs at build time. */
  site: 'https://mordaz.co.uk',

  /* Pieces live at /puzzle/ rather than /puzzle.html, and the trailing slash
     is enforced so canonical URLs never end up duplicated in search results. */
  trailingSlash: 'always',

  markdown: {
    /* Smart punctuation is on by default in Astro 7 — the old `smartypants`
       flag here is deprecated and moved onto the processor. Leaving it off
       keeps the build warning-free and the quotes are still curly. */
    /* No syntax-highlighting theme to ship — this is prose, not a code blog. */
    syntaxHighlight: false,
  },

  build: {
    /* /puzzle/index.html — what static hosts expect. */
    format: 'directory',
  },
});
