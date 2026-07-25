import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  injectRuntime,
  runtimeMarker,
  templatePaths,
} from '../tools/sync-templates.mjs';

const runtimeUrl = new URL('../src/runtime/card.js', import.meta.url);

async function readTemplate(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function scriptsFrom(template) {
  return [...template.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
}

test('shared runtime has valid JavaScript', async () => {
  const runtime = await readFile(runtimeUrl, 'utf8');
  assert.doesNotThrow(() => new Function(runtime));
});

for (const path of templatePaths) {
  test(`${path} is declarative and has exactly one runtime marker`, async () => {
    const template = await readTemplate(path);
    assert.equal(template.split(runtimeMarker).length - 1, 1);
    assert.equal(scriptsFrom(template).length, 0, 'source template should not contain handwritten scripts');
  });

  test(`${path} exports to one self-contained valid script`, async () => {
    const [template, runtime] = await Promise.all([
      readTemplate(path),
      readFile(runtimeUrl, 'utf8'),
    ]);
    const exported = injectRuntime(template, runtime);
    const scripts = scriptsFrom(exported);

    assert.equal(scripts.length, 1);
    assert.doesNotThrow(() => new Function(scripts[0]));
    assert.equal(exported.includes(runtimeMarker), false);
    assert.equal(exported.slice(exported.toLowerCase().lastIndexOf('</script>') + 9).trim(), '');
  });
}

test('shared runtime owns one image controller and explicit lifecycle cleanup', async () => {
  const runtime = await readFile(runtimeUrl, 'utf8');
  assert.equal((runtime.match(/function manageImages\s*\(/g) ?? []).length, 1);
  assert.equal((runtime.match(/function setupFullscreenZoom\s*\(/g) ?? []).length, 0);
  assert.equal((runtime.match(/if\s*\(1\s*===\s*1\)/g) ?? []).length, 0);
  assert.match(runtime, /__ankiPrettifyRuntime/);
  assert.match(runtime, /previousRuntime\.cleanup\(\)/);
  assert.match(runtime, /runtime\.observer\.disconnect\(\)/);
  assert.match(runtime, /removeEventListener/);
});

test('shared runtime preserves authored formatting and image styles', async () => {
  const runtime = await readFile(runtimeUrl, 'utf8');
  assert.match(runtime, /trimEmptyFieldEdges/);
  assert.doesNotMatch(runtime, /replace\(\/\(<br/);
  assert.doesNotMatch(runtime, /image\.removeAttribute\('style'\)/);
  assert.match(runtime, /prettify-image--contrast/);
  assert.match(runtime, /image\.dataset\.zoomLevel = '0'/);
});

test('Nord selects Rubik before system fallbacks', async () => {
  const [scss, css] = await Promise.all([
    readFile(new URL('../src/styles/scss/nord.scss', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/css/nord.css', import.meta.url), 'utf8'),
  ]);

  for (const source of [scss, css]) {
    assert.match(source, /--font-family:\s*"Rubik",\s*"Arial"/);
    assert.match(source, /font-family:\s*Rubik/);
    assert.match(source, /local\("Rubik Regular"\)/);
  }
});

test('preview self-hosts and reports the Rubik font', async () => {
  const [html, app, previewCss, exporter, server, packageJson] = await Promise.all([
    readFile(new URL('../tools/preview/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../tools/preview/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../tools/preview/preview.css', import.meta.url), 'utf8'),
    readFile(new URL('../tools/preview/export-static.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../tools/preview/server.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(html, /id="font-status"/);
  assert.doesNotMatch(app, /PREVIEW_FONT_STYLESHEET|fonts\.googleapis\.com/);
  assert.match(app, /resolveStylesheetAssets/);
  assert.match(app, /fonts\.check\('16px "Rubik"'\)/);
  assert.match(previewCss, /url\("\.\.\/\.\.\/src\/styles\/css\/_Rubik-Regular\.woff2"\)/);
  assert.match(exporter, /rubik-latin-400-normal\.woff2/);
  assert.match(exporter, /Rubik-OFL\.txt/);
  assert.match(server, /_Rubik-Regular\.woff2/);
  assert.match(packageJson, /"@fontsource\/rubik": "5\.3\.0"/);
});

test('template field contracts remain aligned with note types', async () => {
  const contracts = {
    'src/templates/default/basic/basic-front.html': ['{{edit:Front}}'],
    'src/templates/default/basic/basic-back.html': ['{{edit:Front}}', '{{Back}}'],
    'src/templates/default/basic_reverse/basic_reverse-front.html': ['{{edit:Front}}'],
    'src/templates/default/basic_reverse/basic_reverse-back.html': ['{{edit:Front}}', '{{Back}}'],
    'src/templates/default/cloze/cloze-front.html': ['{{edit:cloze:Text}}'],
    'src/templates/default/cloze/cloze-back.html': ['{{edit:cloze:Text}}', '{{Back Extra}}'],
  };

  for (const [path, tokens] of Object.entries(contracts)) {
    const template = await readTemplate(path);
    for (const token of tokens) assert.ok(template.includes(token), `${path} missing ${token}`);
    assert.ok(template.includes('{{Deck}}'));
    assert.ok(template.includes('{{#Tags}}'));
  }
});
