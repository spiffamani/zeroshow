import { cpSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const managed = path.join(root, 'contracts', 'managed', 'zeroshow');
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

if (!existsSync(path.join(managed, 'keys'))) {
  throw new Error('Compiled keys missing. Run npm run compile from the repo root first.');
}

for (const folder of ['keys', 'zkir', 'compiler']) {
  const from = path.join(managed, folder);
  const to = path.join(publicDir, folder);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

console.log('Copied ZK keys into web/public');
