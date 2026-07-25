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
const cursorEnabled = process.argv.includes('--cursor');
const output = join(
  root,
  'res',
  'gifs',
  cursorEnabled ? 'preview-editor-cursor.gif' : 'preview-editor.gif',
);
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

async function installCursorOverlay(page) {
  if (!cursorEnabled) return;

  await page.addStyleTag({
    content: `
      @keyframes demo-cursor-ripple {
        from { opacity: 0.95; transform: translate(-50%, -50%) scale(0.3); }
        to { opacity: 0; transform: translate(-50%, -50%) scale(2.2); }
      }

      @keyframes demo-cursor-badge {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
        20%, 75% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
      }

      #demo-cursor {
        filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
        height: 38px;
        left: 0;
        pointer-events: none;
        position: fixed;
        top: 0;
        transform: translate3d(72px, 72px, 0);
        transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
        width: 30px;
        z-index: 2147483647;
      }

      .demo-cursor-ripple,
      .demo-cursor-badge {
        left: 0;
        pointer-events: none;
        position: fixed;
        top: 0;
        z-index: 2147483646;
      }

      .demo-cursor-ripple {
        animation: demo-cursor-ripple 650ms ease-out forwards;
        border: 3px solid #f9e2af;
        border-radius: 999px;
        height: 34px;
        width: 34px;
      }

      .demo-cursor-badge {
        align-items: center;
        animation: demo-cursor-badge 850ms ease-out forwards;
        background: #f9e2af;
        border: 2px solid #2e3440;
        border-radius: 999px;
        color: #2e3440;
        display: flex;
        font: 700 16px/1 Rubik, Arial, sans-serif;
        height: 30px;
        justify-content: center;
        width: 30px;
      }
    `,
  });

  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.dataset.x = '72';
    cursor.dataset.y = '72';
    cursor.innerHTML = `
      <svg viewBox="0 0 30 38" aria-hidden="true">
        <path
          d="M3 2.5 4.5 31l7.1-7.2 6.2 12.1 6.1-3.1-6.1-11.8 10.2-1.2Z"
          fill="#fff"
          stroke="#20242c"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
    `;
    document.body.appendChild(cursor);
  });
}

async function moveCursor(page, locator, duration = 520) {
  if (!cursorEnabled) return;

  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Could not locate a cursor target in the viewport.');

  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await page.evaluate(
    ({ x, y, duration }) => new Promise((resolve) => {
      const cursor = document.querySelector('#demo-cursor');
      cursor.dataset.x = String(x);
      cursor.dataset.y = String(y);
      cursor.style.transitionDuration = `${duration}ms`;
      requestAnimationFrame(() => {
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        setTimeout(resolve, duration + 80);
      });
    }),
    { x, y, duration },
  );
}

async function showCursorClick(page, label = '') {
  if (!cursorEnabled) return;

  await page.evaluate((label) => {
    const cursor = document.querySelector('#demo-cursor');
    const x = Number(cursor.dataset.x);
    const y = Number(cursor.dataset.y);

    const ripple = document.createElement('span');
    ripple.className = 'demo-cursor-ripple';
    ripple.style.transformOrigin = `${x}px ${y}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });

    if (label) {
      const badge = document.createElement('span');
      badge.className = 'demo-cursor-badge';
      badge.textContent = label;
      badge.style.left = `${x + 34}px`;
      badge.style.top = `${y - 28}px`;
      document.body.appendChild(badge);
      badge.addEventListener('animationend', () => badge.remove(), { once: true });
    }
  }, label);
}

async function guidedAction(page, locator, action, { label = '', pauseAfter = 700 } = {}) {
  await moveCursor(page, locator);
  await showCursorClick(page, label);
  await action();
  await pause(page, pauseAfter);
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
  await installCursorOverlay(page);
  await pause(page, 1100);

  const frontField = page.locator('#field-front');
  await guidedAction(
    page,
    frontField,
    async () => {
      await frontField.fill('');
      await frontField.pressSequentially(
        '<p><strong>Edit cards live.</strong></p><p>Every field updates instantly.</p>',
        { delay: 18 },
      );
    },
    { pauseAfter: 900 },
  );

  const appearance = page.locator('#appearance');
  await guidedAction(page, appearance, () => appearance.selectOption('light'), { pauseAfter: 850 });

  const viewport = page.locator('#viewport');
  await guidedAction(page, viewport, () => viewport.selectOption('mobile'), { pauseAfter: 950 });

  const side = page.locator('#side');
  await guidedAction(page, side, () => side.selectOption('back'), { pauseAfter: 900 });

  const fixture = page.locator('#fixture');
  await guidedAction(page, fixture, () => fixture.selectOption('images'), { pauseAfter: 450 });
  await guidedAction(page, side, () => side.selectOption('front'), { pauseAfter: 450 });
  await guidedAction(page, viewport, () => viewport.selectOption('desktop'), { pauseAfter: 450 });
  await guidedAction(page, appearance, () => appearance.selectOption('dark'), { pauseAfter: 900 });

  const image = page.frameLocator('#card-frame').locator('#qa img').first();
  await guidedAction(page, image, () => image.click(), { label: '1', pauseAfter: 550 });
  await guidedAction(page, image, () => image.click(), { label: '2', pauseAfter: 550 });
  await guidedAction(page, image, () => image.click(), { label: '3', pauseAfter: 950 });
  await page.keyboard.press('Escape');
  await pause(page, 800);

  const noteType = page.locator('#note-type');
  await guidedAction(page, noteType, () => noteType.selectOption('cloze'), { pauseAfter: 450 });
  await guidedAction(page, fixture, () => fixture.selectOption('rich'), { pauseAfter: 450 });
  await guidedAction(page, side, () => side.selectOption('front'), { pauseAfter: 850 });

  const textField = page.locator('#field-text');
  await guidedAction(
    page,
    textField,
    () => textField.fill('A {{c1::live cloze::hint}} preview with instant rendering.'),
    { pauseAfter: 1100 },
  );

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
