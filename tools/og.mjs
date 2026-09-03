/**
 * Share cards for every piece.
 *
 *   npm run og                 fill in whatever is missing
 *   npm run og -- --force      redraw everything (after a domain change)
 *   npm run og -- --social     also make the square and vertical crops
 *
 * Rendered by headless Edge over tools/og-template.html so the cards are set
 * in the site's real Archivo at its real width axis. The variable-font
 * renderers available to Node collapse 'wdth' 74 back to 100, which is a
 * different typeface to look at, so a browser does the drawing.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const piecesDir = join(root, 'src', 'content', 'pieces');
const outDir = join(root, 'public', 'assets', 'img');
const template = join(here, 'og-template.html');

const args = process.argv.slice(2);
const force = args.includes('--force');
const social = args.includes('--social');

/* ── the site's own values, read rather than duplicated ─────────────── */
const siteSrc = readFileSync(join(root, 'src', 'site.ts'), 'utf8');
const pick = (key) => {
  /* Scanned line by line rather than matched with a built-up RegExp. A
     constructed pattern is easy to get subtly wrong, and the failure here is
     silent: pick() returns '' and the wrong domain is printed onto every
     card, which is only visible by opening the PNGs. */
  for (const line of siteSrc.split('\n')) {
    const t = line.trim();
    if (!t.startsWith(key + ':')) continue;
    const q = t.slice(key.length + 1).match(/'([^']*)'/);
    if (q) return q[1];
  }
  return '';
};
const siteUrl = pick('url');
if (!siteUrl) {
  console.error("Could not read `url` from src/site.ts — refusing to draw cards");
  console.error('with no domain on them. Check the file still exports it.');
  process.exit(1);
}
const domain = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
const placeholderDomain = domain.endsWith('.example');

/* ── frontmatter ────────────────────────────────────────────────────────
   A deliberately small parser. The schema is fixed by content.config.ts and
   the CMS only ever writes plain or quoted scalars, so a YAML dependency
   would be more surface area than the job needs. */
function frontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v === '' || v === '>' || v === '|' || v === '>-' || v === '|-') continue;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[kv[1]] = v;
  }
  return out;
}

const edge = [
  join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe'),
  join(process.env.ProgramFiles ?? '', 'Microsoft/Edge/Application/msedge.exe'),
].find((p) => existsSync(p));
if (!edge) {
  console.error('Microsoft Edge not found — it is what renders the cards.');
  process.exit(1);
}

function shoot(payload, outPath) {
  const hash = encodeURIComponent(JSON.stringify(payload));
  const target = `${pathToFileURL(template).href}#${hash}`;
  const profile = join(tmpdir(), `mordaz-og-${Math.random().toString(36).slice(2, 10)}`);

  const r = spawnSync(edge, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${payload.w},${payload.h}`,
    '--virtual-time-budget=5000',
    `--user-data-dir=${profile}`,
    `--screenshot=${outPath}`,
    target,
  ], { stdio: 'ignore' });

  if (r.error) throw r.error;
  if (!existsSync(outPath)) throw new Error(`Edge produced nothing for ${outPath}`);
  return (readFileSync(outPath).length / 1024).toFixed(1);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

mkdirSync(outDir, { recursive: true });

if (placeholderDomain) {
  console.log(`\n  ! The domain in src/site.ts is still ${domain}, so that is what`);
  console.log(`    gets printed on every card. Re-run with --force once the real`);
  console.log(`    domain is set.\n`);
}

const files = readdirSync(piecesDir).filter((f) => f.endsWith('.md'));
let made = 0, skipped = 0, drafts = 0;

for (const file of files) {
  const id = file.replace(/\.md$/, '');
  const d = frontmatter(readFileSync(join(piecesDir, file), 'utf8'));
  if (!d) { console.log(`  ?  ${id} — no frontmatter, skipped`); continue; }
  if (d.draft === 'true') { drafts++; continue; }

  const jobs = [{ w: 1200, h: 630, name: `og-${id}.png` }];
  if (social) {
    jobs.push({ w: 1080, h: 1080, name: `social-${id}-square.png` });
    jobs.push({ w: 1080, h: 1920, name: `social-${id}-vertical.png` });
  }

  for (const job of jobs) {
    const outPath = join(outDir, job.name);
    if (existsSync(outPath) && !force) { skipped++; continue; }
    const kb = shoot({
      w: job.w, h: job.h,
      title: d.title ?? '',
      kicker: d.theySay ?? '',
      meta: [d.beat ? cap(d.beat) : '', d.date ? longDate(d.date) : '', domain]
        .filter(Boolean).join('  ·  '),
    }, outPath);
    console.log(`  +  ${job.name}  (${kb} KB)`);
    made++;
  }
}

/* The card every page falls back to when a piece has none of its own. */
const homePath = join(outDir, 'og.png');
if (!existsSync(homePath) || force) {
  const kb = shoot({
    w: 1200, h: 630,
    title: 'Every piece starts with something everybody says',
    kicker: '',
    meta: ['Sport  ·  Politics  ·  Economics', domain].join('  ·  '),
  }, homePath);
  console.log(`  +  og.png  (${kb} KB)`);
  made++;
} else { skipped++; }

console.log(`\n  ${made} drawn, ${skipped} already there, ${drafts} draft${drafts === 1 ? '' : 's'} ignored.`);
