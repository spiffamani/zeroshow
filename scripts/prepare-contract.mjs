import { copyFile, mkdir } from 'node:fs/promises';

const source = new URL('../managed/contract/', import.meta.url);
const destination = new URL('../src/managed/contract/', import.meta.url);
await mkdir(destination, { recursive: true });
await Promise.all(['index.js', 'index.d.ts', 'index.js.map'].map((file) =>
  copyFile(new URL(file, source), new URL(file, destination)),
));
