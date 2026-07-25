import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const port = 4177;
const baseUrl = `http://127.0.0.1:${port}/tools/preview/`;
const output = join(root, 'res', 'gifs', 'preview-editor.gif');
const temporary = await mkdtemp(join(tmpdir(), 'anki-prettify-readme-'));
const videoDirectory = join(temporary, 'video');

function findFfmpeg() {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(locator, ['ffmpeg'], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).find((candidate) => candidate && existsSync(candidate)) || null;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Preview server did not start within six seconds.');
}

async function pause(page, milliseconds = 700) {
  await page.waitForTimeout(milliseconds);
}

const ffmpeg = findFfmpeg();
if (!ffmpeg) throw new Error('ffmpeg is required to build the README GIF.');

await mkdir(videoDirectory, { recursive: true });
const server = spawn(process.execPath, ['tools/preview/server.mjs', '--port', String(port)], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
});

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext({
    colorScheme: 'dark',
    recordVideo: {
      dir: videoDirectory,
      size: { width: 1280, height: 720 },
    },
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}?fixture=rich&note=basic&side=front&appearance=dark&viewport=desktop`);
  await page.locator('#runtime-status').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#font-status')?.textContent === 'Rubik loaded');
  await pause(page, 1100);

  await page.locator('#field-front').scrollIntoViewIfNeeded();
  await page.locator('#field-front').fill('');
  await page.locator('#field-front').pressSequentially(
    '<p><strong>Edit cards live.</strong></p><p>Every field updates instantly.</p>',
    { delay: 18 },
  );
  await pause(page, 900);

  await page.locator('#appearance').selectOption('light');
  await pause(page, 850);
  await page.locator('#viewport').selectOption('mobile');
  await pause(page, 950);
  await page.locator('#side').selectOption('back');
  await pause(page, 900);

  await page.locator('#fixture').selectOption('images');
  await page.locator('#side').selectOption('front');
  await page.locator('#viewport').selectOption('desktop');
  await page.locator('#appearance').selectOption('dark');
  await pause(page, 900);

  const image = page.frameLocator('#card-frame').locator('#qa img').first();
  await image.click();
  await pause(page, 550);
  await image.click();
  await pause(page, 550);
  await image.click();
  await pause(page, 950);
  await page.keyboard.press('Escape');
  await pause(page, 800);

  await page.locator('#note-type').selectOption('cloze');
  await page.locator('#fixture').selectOption('rich');
  await page.locator('#side').selectOption('front');
  await pause(page, 850);
  await page.locator('#field-text').scrollIntoViewIfNeeded();
  await page.locator('#field-text').fill('A {{c1::live cloze::hint}} preview with instant rendering.');
  await pause(page, 1100);

  const video = page.video();
  await context.close();
  const videoPath = await video.path();

  const conversion = spawnSync(
    ffmpeg,
    [
      '-y',
      '-i', videoPath,
      '-filter_complex',
      'fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
      '-loop', '0',
      output,
    ],
    { cwd: root, encoding: 'utf8' },
  );

  if (conversion.status !== 0) {
    throw new Error(`ffmpeg failed:\n${conversion.stderr}`);
  }

  console.log(`Wrote ${output}`);
} finally {
  if (browser) await browser.close();
  server.kill();
  await rm(temporary, { force: true, recursive: true });
}
