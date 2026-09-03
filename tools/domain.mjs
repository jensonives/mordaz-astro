/**
 * Point the whole site at a domain.
 *
 *   npm run domain -- mordaz.co.uk          set the domain everywhere
 *   npm run domain -- mordaz.co.uk --live   ...and lift the noindex
 *   npm run domain -- --live                just lift the noindex
 *
 * The domain is written into four places that must agree: canonical links and
 * Open Graph tags read it from src/site.ts, the sitemap reads it from
 * astro.config.mjs, and the CMS uses it for its preview links. Three of the
 * four fail silently when they disagree — a wrong canonical still renders a
 * perfectly good-looking page — so this does all of them at once rather than
 * relying on remembering the list.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);

const args = process.argv.slice(2);
const goLive = args.includes('--live');
const raw = args.find((a) => !a.startsWith('--'));

if (!raw && !goLive) {
  console.error('Usage: npm run domain -- <domain> [--live]');
  console.error('   eg: npm run domain -- mordaz.co.uk');
  process.exit(1);
}

/* Accept mordaz.co.uk, https://mordaz.co.uk, or a pasted trailing slash. */
let host = null;
let url = null;
if (raw) {
  host = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) {
    console.error(`"${raw}" does not look like a domain.`);
    process.exit(1);
  }
  url = `https://${host}`;
}

const edits = [];

function rewrite(file, apply) {
  const path = join(root, file);
  const before = readFileSync(path, 'utf8');
  const after = apply(before);
  if (after === before) { edits.push(`  =  ${file} (already correct)`); return; }
  writeFileSync(path, after);
  edits.push(`  ✓  ${file}`);
}

/* Every replacement is anchored and checked. A silent no-op here is the whole
   failure mode this script exists to prevent, so a miss is a hard error. */
function must(s, re, next, what) {
  if (!re.test(s)) throw new Error(`Could not find ${what} — file has changed shape.`);
  return s.replace(re, next);
}

if (url) {
  rewrite('src/site.ts', (s) =>
    must(s, /^(\s*url:\s*)'[^']*'/m, `$1'${url}'`, 'url in src/site.ts'));

  rewrite('astro.config.mjs', (s) =>
    must(s, /^(\s*site:\s*)'[^']*'/m, `$1'${url}'`, 'site in astro.config.mjs'));

  rewrite('public/admin/config.yml', (s) => {
    s = must(s, /^site_url:.*$/m, `site_url: ${url}`, 'site_url in config.yml');
    s = must(s, /^display_url:.*$/m, `display_url: ${url}`, 'display_url in config.yml');
    return s;
  });
}

if (goLive) {
  rewrite('src/site.ts', (s) =>
    must(s, /^(\s*live:\s*)(true|false)/m, '$1true', 'live flag in src/site.ts'));
}

console.log('');
edits.forEach((e) => console.log(e));

console.log('');
if (url) {
  console.log(`  Domain is now ${url}`);
  console.log('  Next:  npm run og -- --force      (the old cards carry the old domain)');
}
if (goLive) {
  console.log('  noindex lifted — the next deploy is public and Google may index it.');
}
console.log('  Then:  npm run build              (to check it still compiles)');
console.log('');
