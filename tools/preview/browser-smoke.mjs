import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = 4175;
const baseUrl = `http://127.0.0.1:${port}/tools/preview/`;
const cases = [
  {
    name: 'basic front image interactions',
    query: 'fixture=images&note=basic&side=front&appearance=dark',
  },
  {
    name: 'cloze back image interactions',
    query: 'fixture=images&note=cloze&side=back&appearance=light',
  },
  {
    name: 'reverse card 2 back',
    query: 'fixture=rich&note=basic_reverse&side=back&card=2&appearance=dark',
  },
  {
    name: 'empty optional fields on mobile',
    query: 'fixture=minimal&note=cloze&side=back&appearance=dark&viewport=mobile',
  },
];

function commandPath(command) {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(locator, [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).find(Boolean) || null;
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    commandPath('google-chrome'),
    commandPath('google-chrome-stable'),
    commandPath('chromium'),
    commandPath('chromium-browser'),
    commandPath('chrome'),
    commandPath('msedge'),
  ];

  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA;
    candidates.push(
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      localAppData && join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppData && join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    );
  }

  return candidates.find((candidate) => candidate && existsSync(candidate)) || null;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Preview server did not start within four seconds.');
}

function runBrowser(browser, profile, url) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        `--user-data-dir=${profile}`,
        '--virtual-time-budget=4000',
        '--dump-dom',
        url,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Headless browser exited with ${code}.\n${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

const browser = findBrowser();
if (!browser) {
  console.log('Browser smoke test skipped: Chrome, Chromium, or Edge was not found.');
  process.exit(0);
}

const server = spawn(process.execPath, ['tools/preview/server.mjs', '--port', String(port)], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
});
const profile = await mkdtemp(join(tmpdir(), 'anki-prettify-browser-'));

try {
  await waitForServer();

  for (const testCase of cases) {
    const dom = await runBrowser(browser, profile, `${baseUrl}?${testCase.query}&smoke=1`);
    assert.match(dom, /All resolved/, `${testCase.name}: unresolved Anki token`);
    assert.match(dom, /Interaction smoke test passed/, `${testCase.name}: interaction check failed`);
    assert.doesNotMatch(dom, /Smoke test failed/, `${testCase.name}: smoke test reported failure`);
    assert.match(
      dom,
      /font-status[^>]*>(?:Rubik loaded|Rubik unavailable — using fallback)</,
      `${testCase.name}: font diagnostic did not settle`,
    );
    assert.doesNotMatch(dom, /runtime-status[^>]*>[^<]*runtime error/i, `${testCase.name}: runtime error reported`);
    console.log(`Passed: ${testCase.name}`);
  }

  console.log(`Browser smoke matrix passed with ${browser}`);
} finally {
  server.kill();
  await rm(profile, { force: true, recursive: true });
}
