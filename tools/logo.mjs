/**
 * The MORDAZ marks, at every size something actually asks for.
 *
 *   npm run logo              draw the whole set
 *   npm run logo -- --marks   just the five profile squares
 *
 * Rendered by headless Edge over tools/logo-template.html, for the same
 * reason as the share cards: the mark is Archivo at 'wdth' 74, and a
 * renderer that ignores the width axis draws a different letterform.
 *
 * Favicons are drawn at their true pixel size rather than downscaled from
 * one big square. A 32px favicon made by shrinking a 1000px one turns the
 * counters of the M into grey mush; drawn at 32px the hinting holds.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const template = join(here, 'logo-template.html');

const marksOnly = process.argv.slice(2).includes('--marks');

/* The chosen mark. Everything that represents the publication in one glyph
   uses this; change it here and the favicon, the touch icon and the header
   all follow. */
const MARK = 'pair';

const logoDir = join(root, 'public', 'assets', 'img', 'logo');
const publicDir = join(root, 'public');
mkdirSync(logoDir, { recursive: true });

const edge = [
  join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe'),
  join(process.env.ProgramFiles ?? '', 'Microsoft/Edge/Application/msedge.exe'),
].find((p) => existsSync(p));
if (!edge) {
  console.error('Microsoft Edge not found — it is what renders the marks.');
  process.exit(1);
}

function shoot({ v, w, h }, outPath) {
  const hash = encodeURIComponent(JSON.stringify({ v, w, h }));
  const target = `${pathToFileURL(template).href}#${hash}`;
  const profile = join(tmpdir(), `mordaz-logo-${Math.random().toString(36).slice(2, 10)}`);

  const r = spawnSync(edge, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${w},${h}`,
    '--virtual-time-budget=5000',
    `--user-data-dir=${profile}`,
    `--screenshot=${outPath}`,
    target,
  ], { stdio: 'ignore' });

  if (r.error) throw r.error;
  if (!existsSync(outPath)) throw new Error(`Edge produced nothing for ${outPath}`);
  return (readFileSync(outPath).length / 1024).toFixed(1);
}

const jobs = [];

/* The five profile squares, so the sheet can be re-compared later. */
for (const v of ['block', 'strike', 'pair', 'stack', 'serif']) {
  jobs.push({ v, w: 1000, h: 1000, out: join(logoDir, `mordaz-${v}.png`) });
}

if (!marksOnly) {
  jobs.push(
    /* Browser tab. 32 is what a tab actually shows; 16 is the legacy size
       and 48 is what Windows uses for a pinned shortcut. */
    { v: MARK, w: 32, h: 32, out: join(publicDir, 'favicon-32.png') },
    { v: MARK, w: 48, h: 48, out: join(publicDir, 'favicon-48.png') },
    /* iOS home screen. Square, no transparency, 180 is current. */
    { v: MARK, w: 180, h: 180, out: join(publicDir, 'apple-touch-icon.png') },
    /* Android / PWA, and the generic large icon. */
    { v: MARK, w: 512, h: 512, out: join(publicDir, 'icon-512.png') },
    /* X / Twitter header. */
    { v: 'banner', w: 1500, h: 500, out: join(logoDir, 'x-header.png') },
  );
}

for (const job of jobs) {
  const kb = shoot(job, job.out);
  const name = job.out.slice(root.length + 1).replace(/\\/g, '/');
  console.log(`  +  ${name}  ${job.w}×${job.h}  (${kb} KB)`);
}

console.log(`\n  ${jobs.length} drawn. Mark in use: ${MARK}.`);
