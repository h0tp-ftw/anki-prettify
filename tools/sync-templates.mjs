import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const templatePaths = [
  'src/templates/default/basic/basic-front.html',
  'src/templates/default/basic/basic-back.html',
  'src/templates/default/basic_reverse/basic_reverse-front.html',
  'src/templates/default/basic_reverse/basic_reverse-back.html',
  'src/templates/default/cloze/cloze-front.html',
  'src/templates/default/cloze/cloze-back.html',
];

export const runtimeMarker = '<!-- PRETTIFY_RUNTIME -->';

export function runtimeScript(runtime) {
  return `<script>\n/* Generated from src/runtime/card.js */\n${runtime.trim()}\n</script>`;
}

export function injectRuntime(template, runtime) {
  const markerCount = template.split(runtimeMarker).length - 1;
  if (markerCount !== 1) {
    throw new Error(`Expected exactly one ${runtimeMarker} marker, found ${markerCount}.`);
  }
  if (/<script(?:\s[^>]*)?>/i.test(template)) {
    throw new Error('Source templates must not contain handwritten script blocks.');
  }
  return template.replace(runtimeMarker, runtimeScript(runtime));
}

export async function checkTemplates() {
  const runtime = await readFile(new URL('../src/runtime/card.js', import.meta.url), 'utf8');
  new Function(runtime);

  for (const path of templatePaths) {
    const template = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    injectRuntime(template, runtime);
  }
  console.log('Source templates and shared runtime are valid.');
}

export async function exportTemplates(outputRoot = new URL('../dist/templates/', import.meta.url)) {
  const runtime = await readFile(new URL('../src/runtime/card.js', import.meta.url), 'utf8');
  new Function(runtime);

  for (const path of templatePaths) {
    const template = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    const relativePath = path.replace(/^src\/templates\//, '');
    const destination = new URL(relativePath, outputRoot);
    await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
    await writeFile(destination, injectRuntime(template, runtime), 'utf8');
  }
  console.log(`Exported ${templatePaths.length} self-contained templates to dist/templates.`);
}

const invokedPath = process.argv[1]?.replaceAll('\\', '/');
const modulePath = new URL(import.meta.url).pathname;
if (invokedPath && (modulePath.endsWith(invokedPath) || invokedPath.endsWith('tools/sync-templates.mjs'))) {
  if (process.argv.includes('--check')) await checkTemplates();
  else await exportTemplates();
}
