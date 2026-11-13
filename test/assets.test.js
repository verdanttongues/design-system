// CLAUDE.md → §5.4 (no other origin) and §5.5 (licences present).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOrigins, checkLicences } from '../lib/assets.js';
import { loadTokens } from '../lib/dtcg.js';
import { makeRepo } from './helpers.js';

const origins = (files) => {
  const root = makeRepo(files);
  return checkOrigins(root, loadTokens(root));
};
const licences = (files) => checkLicences(makeRepo(files));

test('a relative url() to a file here passes', () => {
  assert.deepEqual(origins({
    'fonts/fonts.css': '@font-face { font-family: X; src: url("x/x.woff2") format("woff2"); }',
    'fonts/x/x.woff2': 'bytes',
  }), []);
});

for (const [label, css, pattern] of [
  ['@import', '@import "other.css";', /@import is not allowed/],
  ['an https url()', 'a { background: url(https://cdn.example/x.png) }', /names another origin/],
  ['a protocol-relative url()', "a { src: url('//fonts.example/x.woff2') }", /names another origin/],
  ['a data: url()', 'a { background: url(data:image/png;base64,AAAA) }', /names another origin/],
  ['a root-relative url()', 'a { background: url(/x.png) }', /root-relative/],
  ['a url() to a missing file', 'a { background: url(missing.png) }', /not a file in this repository/],
  ['a url() escaping the repository', 'a { background: url(../../../etc/passwd) }', /not a file in this repository/],
]) {
  test(`${label} in shipped CSS fails`, () => {
    const errors = origins({ 'dist/tokens.css': css });
    assert.ok(errors.some((e) => pattern.test(e)), errors.join('\n'));
  });
}

test('an @import inside a comment is ignored', () => {
  assert.deepEqual(origins({ 'dist/tokens.css': '/* never @import url(https://x) */ :root {}' }), []);
});

test('CSS under node_modules or build/ is not shipped and not checked', () => {
  assert.deepEqual(origins({ 'node_modules/x/a.css': '@import "y";', 'build/styleguide/a.css': '@import "y";' }), []);
});

test('an SVG with an external href or a script fails; a fragment href passes', () => {
  assert.deepEqual(origins({ 'icons/ok.svg': '<svg><use href="#a"/><path fill="url(#g)"/></svg>' }), []);
  assert.match(origins({ 'icons/x.svg': '<svg><image xlink:href="https://x/y.png"/></svg>' })[0], /points outside the icon/);
  assert.match(origins({ 'icons/x.svg': '<svg><script>alert(1)</script></svg>' })[0], /no script/);
});

test('a token value naming a URL fails', () => {
  const errors = origins({ 'tokens/primitive/f.tokens.json': { font: { body: { $type: 'fontFamily', $value: 'https://fonts.example/x' } } } });
  assert.match(errors[0], /names a URL/);
});

test('a woff2 with its licence passes; without it fails', () => {
  assert.deepEqual(licences({ 'fonts/x/x.woff2': 'b', 'fonts/x/OFL.txt': 'licence' }), []);
  assert.match(licences({ 'fonts/x/x.woff2': 'b' })[0], /no licence file beside it/);
});

test('a licence in a different folder does not count', () => {
  assert.match(licences({ 'fonts/x/x.woff2': 'b', 'fonts/LICENSE': 'l' })[0], /no licence file beside it/);
});

test('fonts other than WOFF2 fail', () => {
  assert.match(licences({ 'fonts/x/x.ttf': 'b', 'fonts/x/LICENSE': 'l' })[0], /WOFF2 only/);
});

test('an icon must be listed, and a licensed icon needs its licence file', () => {
  assert.match(licences({ 'icons/logo.svg': '<svg/>' })[0], /not listed/);
  assert.deepEqual(licences({ 'icons/logo.svg': '<svg/>', 'icons/licences.json': { icons: { 'logo.svg': { source: 'vt' } } } }), []);
  assert.deepEqual(licences({
    'icons/x.svg': '<svg/>', 'icons/licences/x.txt': 'l',
    'icons/licences.json': { icons: { 'x.svg': { source: 'licensed', licence: 'licences/x.txt' } } },
  }), []);
  assert.match(licences({
    'icons/x.svg': '<svg/>',
    'icons/licences.json': { icons: { 'x.svg': { source: 'licensed', licence: 'licences/x.txt' } } },
  })[0], /licence file licences\/x\.txt is missing/);
  assert.match(licences({ 'icons/licences.json': { icons: { 'gone.svg': { source: 'vt' } } } })[0], /no such file/);
  assert.match(licences({ 'icons/x.svg': '<svg/>', 'icons/licences.json': { icons: { 'x.svg': { source: 'found-online' } } } })[0], /needs \{ "source": "vt" \}/);
});
