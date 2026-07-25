import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const destination = join(root, 'dist', 'preview');

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

await writeFile(
  join(destination, 'index.html'),
  '<!doctype html><meta http-equiv="refresh" content="0; url=./tools/preview/">\n',
  'utf8',
);

console.log(`Exported static preview to ${destination}`);
