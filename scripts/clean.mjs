import { existsSync, rmSync } from 'node:fs';

const targets = [
  'contracts/managed',
  '.midnight-state.json',
  '.midnight-wallet-state',
];

let failed = false;

for (const target of targets) {
  const existed = existsSync(target);
  try {
    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    if (existed) {
      console.log(`Removed ${target}`);
    }
  } catch (err) {
    failed = true;
    console.error(`Failed to remove ${target}: ${err.message}`);
  }
}

if (failed) {
  process.exit(1);
}
