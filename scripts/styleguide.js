// npm run styleguide — writes build/styleguide/ (gitignored): index.html beside copies of
// dist/tokens.css, fonts/ and icons/. Open build/styleguide/index.html in a browser.
// Internal only (CLAUDE.md → §3): CI uploads it as an artifact; it is never deployed.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAll, formatErrors } from '../lib/check.js';
import { renderStyleguide } from '../lib/styleguide.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build', 'styleguide');

const checked = checkAll(root);
const failed = Object.values(checked.errors).some((l) => l.length);
if (failed) {
  // The guide still builds, so a failing pair can be seen; the exit code reports the failure.
  console.error(formatErrors(checked.errors));
}
if (!existsSync(join(root, 'dist', 'tokens.css'))) {
  console.error('dist/tokens.css is missing — run `npm run build` first.');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'dist', 'tokens.css'), join(out, 'tokens.css'));
cpSync(join(root, 'fonts'), join(out, 'fonts'), { recursive: true });
cpSync(join(root, 'icons'), join(out, 'icons'), { recursive: true });
writeFileSync(join(out, 'index.html'), renderStyleguide(root, checked));
console.log(`Style guide: ${join('build', 'styleguide', 'index.html')}`);
process.exit(failed ? 1 : 0);
