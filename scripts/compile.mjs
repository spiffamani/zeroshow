// Compact has no native Windows binary. On Windows we compile inside WSL.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = [
  'compile',
  'contracts/zeroshow.compact',
  'contracts/managed/zeroshow',
];

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  process.exit(result.status ?? 1);
}

if (process.platform === 'win32') {
  const wslPath = '/mnt/' + root.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase());
  const inner = [
    'export PATH="$HOME/.local/bin:$HOME/.compact/bin:$PATH"',
    `cd "${wslPath}"`,
    `compact ${args.join(' ')}`,
  ].join(' && ');
  run('wsl', ['-d', 'Ubuntu', '-e', '/bin/bash', '-c', inner]);
} else {
  run('compact', args, {
    env: {
      ...process.env,
      PATH: `${process.env.HOME}/.local/bin:${process.env.HOME}/.compact/bin:${process.env.PATH}`,
    },
  });
}
