import type { APIRoute } from 'astro';
import { site } from '../site';

/**
 * robots.txt, generated rather than kept as a static file in public/.
 *
 * It reads the same `live` flag as the noindex tag in Base.astro, so there is
 * one switch for "is this site public yet" instead of two. Two of them is how
 * a site ends up half-launched: the flag flipped, a stale robots.txt still
 * saying Disallow, and no error anywhere to tell you.
 *
 * While live is false this asks crawlers to stay out entirely. That is belt
 * and braces next to the noindex — noindex keeps a page out of results, and
 * Disallow stops the fetch in the first place.
 */
export const GET: APIRoute = () => {
  const body = site.live
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${site.url}/sitemap-index.xml`,
        '',
      ].join('\n')
    : [
        '# Not launched yet — see `live` in src/site.ts',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
