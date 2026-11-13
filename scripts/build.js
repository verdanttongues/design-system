// npm run build — every check, then tokens/ → dist/. dist/ is committed (DS1): commit what this writes.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOutputs, formatErrors } from '../lib/build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const { errors, outputs } = await buildOutputs(root);
if (errors) {
  console.error(`Build refused; nothing written.\n${formatErrors(errors)}`);
  process.exit(1);
}
mkdirSync(dist, { recursive: true });
for (const stale of readdirSync(dist)) {
  if (!(stale in outputs)) rmSync(join(dist, stale), { recursive: true });
}
for (const [name, content] of Object.entries(outputs)) writeFileSync(join(dist, name), content);
console.log(`dist/: ${Object.keys(outputs).join(', ')}`);
