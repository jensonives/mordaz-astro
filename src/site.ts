/**
 * Site-wide values. Change them here and every page follows — the canonical
 * links, Open Graph tags, Twitter cards and JSON-LD all read from this.
 *
 * In the old static site the domain alone appeared seven times per page and
 * had to be rewritten by a script. Now it is one line.
 */
export const site = {
  name: 'MORDAZ',
  author: 'Jenson Ives',

  /** No trailing slash. Also set `site:` in astro.config.mjs to match. */
  url: 'https://mordaz.co.uk',

  /**
   * FALSE until the real writing is up and the real domain is pointed.
   *
   * While false every page carries `noindex`, so Google never sees the site
   * on its temporary netlify.app address and never indexes placeholder text.
   * Getting indexed under the wrong domain with the wrong content is a mess
   * to undo; a flag is cheap.
   *
   * Flip to true on launch day. That is the switch that makes it public.
   */
  live: false,

  email: 'hello@example.com',

  tagline: 'Opinion on sport, politics and economics',
  description:
    'Every piece starts with something everybody says, and explains why it is wrong.',

  /** The masthead gloss. */
  pronunciation: '/moɾˈðas/',
  partOfSpeech: 'adj.',
  gloss: 'biting, scathing — of criticism, and of the person writing it',

  /** Shown in the hero. 12–22 words. */
  blurb:
    'Every piece starts with something everybody says, and explains why it is wrong.',
} as const;

export const beats = ['sport', 'politics', 'economics'] as const;
export type Beat = (typeof beats)[number];

/** Title Case for display: "economics" -> "Economics". */
export const beatLabel = (b: string) => b.charAt(0).toUpperCase() + b.slice(1);

/** "3 Aug" — the archive and card format. */
export const shortDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** "3 August 2026" — the byline format. */
export const longDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** "2026-08-03" — for <time datetime> and structured data. */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
