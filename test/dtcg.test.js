// CLAUDE.md → §5.1: every file parses, every alias resolves, no cycle — plus tokens/README.md's rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTokens } from '../lib/dtcg.js';
import { makeRepo, VALID } from './helpers.js';

const errorsFor = (files) => loadTokens(makeRepo(files)).errors;
const assertError = (files, pattern) => {
  const errors = errorsFor(files);
  assert.ok(errors.some((e) => pattern.test(e)), `expected ${pattern}, got:\n${errors.join('\n') || '(none)'}`);
};
const color = (tokens) => ({ 'tokens/primitive/c.tokens.json': { color: { $type: 'color', ...tokens } } });

test('the valid set loads with no error and resolves through aliases', () => {
  const loaded = loadTokens(makeRepo(VALID));
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.base.get('color.text.default').value, '#0b3d1a');
  assert.equal(loaded.base.get('color.text.default').type, 'color');
  assert.equal(loaded.modes.dark.get('color.text.default').value.hex, '#ffffff');
  assert.equal(loaded.modes.dark.get('space.4').value.value, 16);
});

test('an empty repository is valid', () => {
  assert.deepEqual(errorsFor({}), []);
});

test('invalid JSON fails', () => {
  assertError({ 'tokens/primitive/x.tokens.json': '{ nope' }, /not valid JSON/);
});

test('a dangling alias fails', () => {
  assertError(color({ a: { $value: '{color.missing}' } }), /aliases \{color\.missing\}, which is not a token/);
});

test('an alias to a group, not a token, fails', () => {
  assertError(color({ a: { $value: '{color}' }, b: { $value: '#fff' } }), /aliases \{color\}, which is not a token/);
});

test('an alias cycle fails', () => {
  assertError(color({ a: { $value: '{color.b}' }, b: { $value: '{color.a}' } }), /alias cycle/);
});

test('a self-alias fails', () => {
  assertError(color({ a: { $value: '{color.a}' } }), /alias cycle/);
});

test('a partial alias inside a string fails', () => {
  assertError({ 'tokens/primitive/s.tokens.json': { space: { $type: 'dimension', a: { $value: '{space.b}px' }, b: { $value: '4px' } } } }, /not a whole alias/);
});

test('a token with no type anywhere fails', () => {
  assertError({ 'tokens/primitive/x.tokens.json': { misc: { a: { $value: 3 } } } }, /has no \$type/);
});

test('an unknown $type fails', () => {
  assertError({ 'tokens/primitive/x.tokens.json': { misc: { a: { $type: 'colour', $value: '#fff' } } } }, /unknown \$type "colour"/);
});

test('an alias whose type differs from its target fails', () => {
  assertError({
    'tokens/primitive/x.tokens.json': {
      color: { a: { $type: 'color', $value: '#fff' } },
      space: { a: { $type: 'dimension', $value: '{color.a}' } },
    },
  }, /is dimension but aliases \{color\.a\}, which is color/);
});

test('a malformed colour fails', () => {
  assertError(color({ a: { $value: 'green' } }), /colour string must be/);
});

test('a dimension in em fails', () => {
  assertError({ 'tokens/primitive/s.tokens.json': { space: { a: { $type: 'dimension', $value: { value: 1, unit: 'em' } } } } }, /dimension must be/);
});

test('a name with capitals or dots fails', () => {
  assertError(color({ Green: { $value: '#fff' } }), /name "Green"/);
});

test('an unknown $ property fails', () => {
  assertError(color({ a: { $value: '#fff', $scopes: [] } }), /"\$scopes" is not a DTCG token property/);
});

test('a token holding child tokens fails', () => {
  assertError(color({ a: { $value: '#fff', b: { $value: '#000' } } }), /a token cannot contain "b"/);
});

test('Figma\'s flat extension keys, as its export writes them, fail — on a token and on the root', () => {
  assertError(color({ a: { $value: '#fff', $extensions: { 'com.figma.variableId': 'VariableID:x', 'com.figma.scopes': ['ALL_SCOPES'] } } }), /"com\.figma\.variableId", "com\.figma\.scopes" must be stripped/);
  assertError({ 'tokens/primitive/c.tokens.json': { color: { $type: 'color', a: { $value: '#fff' } }, $extensions: { 'com.figma.modeName': 'Mode 1' } } }, /"com\.figma\.modeName" must be stripped/);
});

test('another vendor\'s extension is kept', () => {
  assert.deepEqual(errorsFor(color({ a: { $value: '#fff', $extensions: { 'org.example.note': 1 } } })), []);
});

test('Figma extensions left in by the import fail', () => {
  assertError(color({ a: { $value: '#fff', $extensions: { 'com.figma': { variableId: 'x' } } } }), /com\.figma/);
});

test('a name defined twice fails', () => {
  assertError({
    'tokens/primitive/a.tokens.json': { color: { a: { $type: 'color', $value: '#fff' } } },
    'tokens/primitive/b.tokens.json': { color: { a: { $type: 'color', $value: '#000' } } },
  }, /color\.a is already defined/);
});

test('a semantic token holding a raw value fails', () => {
  assertError({ 'tokens/semantic/x.tokens.json': { color: { text: { $type: 'color', $value: '#000' } } } }, /semantic token's \$value must be one alias/);
});

test('a primitive aliasing a semantic token fails', () => {
  assertError({
    ...VALID,
    'tokens/primitive/z.tokens.json': { color: { z: { $type: 'color', $value: '{color.text.default}' } } },
  }, /a semantic token; alias a primitive/);
});

test('a semantic token aliasing a semantic token fails', () => {
  assertError({
    ...VALID,
    'tokens/semantic/z.tokens.json': { color: { link: { $type: 'color', $value: '{color.text.default}' } } },
  }, /a semantic token; alias a primitive/);
});

test('a mode adding a new token fails', () => {
  assertError({ ...VALID, 'tokens/modes/dark/new.tokens.json': { color: { brand: { $type: 'color', $value: '{color.white}' } } } }, /overrides an existing semantic token only/);
});

test('a mode overriding a primitive fails', () => {
  assertError({ ...VALID, 'tokens/modes/dark/p.tokens.json': { color: { white: { $value: '#eeeeee' } } } }, /overrides an existing semantic token only/);
});

test('a mode overriding with a raw value fails', () => {
  assertError({ ...VALID, 'tokens/modes/dark/color.tokens.json': { color: { text: { default: { $value: '#ffffff' } } } } }, /mode's \$value must be one alias to a primitive/);
});

test('a token file outside the three layers fails', () => {
  assertError({ 'tokens/stray.tokens.json': {} }, /must be under tokens\/primitive/);
});

test('a colour outside "color", or a non-colour inside it, fails', () => {
  assertError({ 'tokens/primitive/x.tokens.json': { brand: { $type: 'color', $value: '#fff' } } }, /colours live under "color"/);
  assertError({ 'tokens/primitive/x.tokens.json': { color: { gap: { $type: 'number', $value: 4 } } } }, /under "color" but is number/);
});

test('a typography field outside DTCG\'s five fails', () => {
  assertError({ 'tokens/primitive/t.tokens.json': { type: { a: { $type: 'typography', $value: { fontFamily: 'X', textCase: 'upper' } } } } }, /not textCase/);
});
