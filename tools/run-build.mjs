import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const forwardedArgs = process.argv.slice(2);
const localCandidates = process.platform === 'win32'
  ? [join(root, '.venv', 'Scripts', 'python.exe')]
  : [join(root, '.venv', 'bin', 'python')];

const candidates = [
  ...localCandidates.filter(existsSync),
  ...(process.platform === 'win32' ? ['py', 'python'] : ['python3', 'python']),
];

for (const command of candidates) {
  const result = spawnSync(
    command,
    ['tools/build.py', ...forwardedArgs],
    {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    },
  );

  if (result.error?.code === 'ENOENT') continue;
  process.exit(result.status ?? 1);
}

console.error('Python was not found. Install Python 3.12+ or create .venv as described in README.md.');
process.exit(1);
