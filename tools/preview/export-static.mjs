import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const destination = join(root, 'dist', 'preview');
const fontDestination = join(destination, 'src', 'styles', 'css');
const rubikPackage = join(root, 'node_modules', '@fontsource', 'rubik');
const fontFiles = new Map([
  ['rubik-latin-400-normal.woff2', '_Rubik-Regular.woff2'],
  ['rubik-latin-700-normal.woff2', '_Rubik-Bold.woff2'],
  ['rubik-latin-400-italic.woff2', '_Rubik-Italic.woff2'],
  ['rubik-latin-700-italic.woff2', '_Rubik-BoldItalic.woff2'],
]);

await rm(destination, { force: true, recursive: true });
await mkdir(destination, { recursive: true });

for (const source of [
  'tools/preview',
  'src/templates/default',
  'src/runtime',
  'src/styles/css',
]) {
  await cp(join(root, source), join(destination, source), { recursive: true });
}

for (const [source, target] of fontFiles) {
  await cp(join(rubikPackage, 'files', source), join(fontDestination, target));
}
await cp(join(rubikPackage, 'LICENSE'), join(fontDestination, 'Rubik-OFL.txt'));

await writeFile(
  join(destination, 'index.html'),
  '<!doctype html><meta http-equiv="refresh" content="0; url=./tools/preview/">\n',
  'utf8',
);

console.log(`Exported static preview to ${destination}`);
