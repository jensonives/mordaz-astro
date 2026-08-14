import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * One piece = one Markdown file in src/content/pieces/.
 *
 * Everything the old static site duplicated — the claim in three places, the
 * headline in five, the date in five, the domain in seven — now lives here
 * once. The front page, the archive, the plates, the meta tags and the JSON-LD
 * are all derived from it, so they cannot drift apart.
 *
 * The schema is enforced at build time: a missing field or a malformed date
 * fails the build with a readable error rather than silently producing a
 * broken page. That is the whole point of doing it this way.
 */
const pieces = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pieces' }),
  schema: z.object({
    /** The headline. 4–9 words reads best at the sizes it's set in. */
    title: z.string().min(1),

    /** The received view being attacked. Stated fairly, 4–9 words. */
    theySay: z.string().min(1),

    /** The rebuttal. 4–9 words. */
    inFact: z.string().min(1),

    /** The standfirst under the headline. 22–34 words. */
    standfirst: z.string().min(1),

    beat: z.enum(['sport', 'politics', 'economics']),

    /** Publication date. Drives ordering everywhere. */
    date: z.coerce.date(),

    /** Reading time in minutes. */
    minutes: z.number().int().positive(),

    /**
     * Optional photograph, relative to /public — e.g. "assets/img/stadium.jpg".
     * Omit it and the piece gets a generated plate instead.
     */
    photo: z.string().optional(),
    photoAlt: z.string().optional(),
    photoCredit: z.string().optional(),

    /** Set true to keep a piece out of the site while you work on it. */
    draft: z.boolean().default(false),
  })
  /* A photo without alt text is an accessibility failure, so make it a build
     failure instead — it is the one thing that can't be generated. */
  .refine((d) => !d.photo || (d.photoAlt && d.photoAlt.length > 0), {
    message: 'photoAlt is required whenever photo is set — describe what the photograph shows.',
    path: ['photoAlt'],
  }),
});

export const collections = { pieces };
