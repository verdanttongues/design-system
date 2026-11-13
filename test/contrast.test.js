// CLAUDE.md → §5.3: every declared pair meets WCAG 2.2 AA in every mode; a failing pair fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, contrastRatio } from '../lib/color.js';
import { loadTokens } from '../lib/dtcg.js';
import { checkContrast } from '../lib/contrast.js';
import { makeRepo, VALID } from './helpers.js';

const ratio = (a, b) => contrastRatio(parseColor(a), parseColor(b));
const check = (files) => {
  const root = makeRepo(files);
  return checkContrast(root, loadTokens(root));
};

test('known WCAG ratios', () => {
  assert.equal(ratio('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(ratio('#ffffff', '#ffffff').toFixed(2), '1.00');
  assert.equal(ratio('#767676', '#ffffff').toFixed(2), '4.54'); // the lightest grey passing 4.5:1 on white
  assert.equal(ratio('#777777', '#ffffff').toFixed(2), '4.48');
});

test('shorthand hex, DTCG objects and a hex fallback parse alike', () => {
  assert.deepEqual(parseColor('#fff'), parseColor('#ffffff'));
  assert.deepEqual(parseColor({ colorSpace: 'srgb', components: [1, 1, 1] }), parseColor('#ffffff'));
  assert.deepEqual(parseColor({ colorSpace: 'oklch', components: [1, 0, 0], hex: '#ffffff' }), parseColor('#ffffff'));
  assert.throws(() => parseColor({ colorSpace: 'oklch', components: [1, 0, 0] }), /no hex fallback/);
});

test('translucent text is composited over its background', () => {
  // 50% black over white is sRGB grey 0.5 exactly (3.98:1 against white).
  const half = { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.5 };
  const grey = { colorSpace: 'srgb', components: [0.5, 0.5, 0.5] };
  assert.equal(ratio(half, '#ffffff'), ratio(grey, '#ffffff'));
  assert.equal(ratio(half, '#ffffff').toFixed(2), '3.98');
});

test('a translucent background is refused', () => {
  assert.throws(() => ratio('#000000', '#ffffff80'), /translucent/);
});

test('the valid set passes in the base and in dark', () => {
  const { errors, results } = check(VALID);
  assert.deepEqual(errors, []);
  assert.deepEqual(results.map((r) => [r.mode, r.pass]), [['base', true], ['dark', true]]);
});

test('a pair failing in one mode only fails, naming the mode', () => {
  const { errors } = check({
    ...VALID,
    'tokens/primitive/grey.tokens.json': { color: { grey: { $type: 'color', $value: '#777777' } } },
    'tokens/modes/dark/color.tokens.json': { color: { text: { default: { $value: '{color.grey}' } }, surface: { default: { $value: '{color.white}' } } } },
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\(dark, body\): 4\.48:1, needs 4\.5:1/);
});

test('large text and UI need 3:1', () => {
  const { 'tokens/modes/dark/color.tokens.json': _dark, ...base } = VALID;
  const files = (size) => ({
    ...base,
    'tokens/primitive/grey.tokens.json': { color: { grey: { $type: 'color', $value: '#777777' } } },
    'tokens/semantic/muted.tokens.json': { color: { muted: { $type: 'color', $value: '{color.grey}' } } },
    'tokens/contrast-pairs.json': { pairs: [{ text: 'color.muted', background: 'color.surface.default', size }] },
  });
  assert.deepEqual(check(files('large')).errors, []);
  assert.equal(check(files('body')).errors.length, 1);
});

test('a pair naming a primitive, a missing token or a non-colour fails', () => {
  const pair = (text) => ({ ...VALID, 'tokens/contrast-pairs.json': { pairs: [{ text, background: 'color.surface.default', size: 'body' }] } });
  assert.match(check(pair('color.white')).errors[0], /not semantic/);
  assert.match(check(pair('color.nope')).errors[0], /not a token/);
  assert.match(check(pair('space.4')).errors.join('\n'), /not a colour/);
});

test('a malformed or duplicated pair fails', () => {
  assert.match(check({ ...VALID, 'tokens/contrast-pairs.json': { pairs: [{ text: 'a' }] } }).errors[0], /needs "text", "background" and "size"/);
  const p = VALID['tokens/contrast-pairs.json'].pairs[0];
  assert.match(check({ ...VALID, 'tokens/contrast-pairs.json': { pairs: [p, p] } }).errors.join('\n'), /declared twice/);
});
