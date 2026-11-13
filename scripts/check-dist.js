// npm run check:dist — rebuilds in memory and fails unless the committed dist/ matches byte for
// byte (CLAUDE.md → §5.2; DS1). Writes nothing.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOutputs, formatErrors } from '../lib/build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const { errors, outputs } = await buildOutputs(root);
if (errors) {
  console.error(`Build refused.\n${formatErrors(errors)}`);
  process.exit(1);
}
const problems = [];
const committed = existsSync(dist) ? readdirSync(dist) : [];
for (const [name, content] of Object.entries(outputs)) {
  const file = join(dist, name);
  if (!existsSync(file)) problems.push(`dist/${name} is missing`);
  else if (readFileSync(file, 'utf8') !== content) problems.push(`dist/${name} differs from a fresh build`);
}
for (const name of committed) {
  if (!(name in outputs)) problems.push(`dist/${name} is not produced by the build`);
}
if (problems.length) {
  console.error(`dist/ is stale — run \`npm run build\` and commit dist/.\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('dist/ matches a fresh build.');
