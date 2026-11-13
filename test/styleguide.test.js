// CLAUDE.md → §3, §5.6: the style guide builds from the same files, every mode and pair shown.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAll } from '../lib/check.js';
import { renderStyleguide } from '../lib/styleguide.js';
import { makeRepo, VALID } from './helpers.js';

test('the style guide shows each colour per mode, each pair with its ratio, and every token', () => {
  const root = makeRepo({ ...VALID, 'icons/logo.svg': '<svg/>', 'icons/licences.json': { icons: { 'logo.svg': { source: 'vt' } } } });
  const html = renderStyleguide(root, checkAll(root));
  assert.match(html, /<td data-mode="dark"><span class="swatch" style="background:var\(--color-text-default\)"><\/span><code>#ffffff<\/code>/);
  assert.match(html, /<td>base<\/td>.*?<td>body<\/td><td>[0-9.]+:1<\/td><td>4\.5:1<\/td><td>AA<\/td>/s);
  assert.match(html, /<td>dark<\/td>/);
  assert.match(html, /<img src="icons\/logo\.svg"/);
  assert.match(html, /<code>space\.4<\/code>/);
  assert.doesNotMatch(html, /https?:\/\//, 'the page itself names no other origin');
});

test('an empty repository renders, saying what is missing', () => {
  const root = makeRepo();
  const html = renderStyleguide(root, checkAll(root));
  assert.match(html, /No colour tokens yet/);
  assert.match(html, /No fonts yet/);
});
