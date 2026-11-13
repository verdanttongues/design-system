// Runs every §5 check over this repository itself: tokens/, dist/, fonts/ and icons/ as committed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAll, formatErrors } from '../lib/check.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('this repository passes every check', () => {
  const { errors } = checkAll(root);
  assert.equal(formatErrors(errors), '');
});
