// CLAUDE.md → §3, §5.2: what the build produces, that it is deterministic, and that it refuses a
// failing set.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutputs } from '../lib/build.js';
import { makeRepo, VALID } from './helpers.js';

test('the valid set builds CSS with a mode block and flat JSON per layer', async () => {
  const { errors, outputs } = await buildOutputs(makeRepo(VALID));
  assert.equal(errors, undefined);
  assert.deepEqual(Object.keys(outputs).sort(), ['tokens.css', 'tokens.dark.json', 'tokens.json']);

  const css = outputs['tokens.css'];
  assert.match(css, /:root \{[^}]*--color-green-900: #0b3d1a;/);
  assert.match(css, /:root \{[^}]*--color-text-default: var\(--color-green-900\);/);
  assert.match(css, /\[data-mode="dark"\] \{\s*--color-text-default: var\(--color-white\);\s*--color-surface-default: var\(--color-green-900\);\s*\}/);
  assert.doesNotMatch(css.split('[data-mode="dark"]')[1], /--space-4|--color-white:/, 'a mode block lists its overrides only');

  assert.deepEqual(JSON.parse(outputs['tokens.json']), {
    'color.green.900': '#0b3d1a',
    'color.surface.default': '#ffffff',
    'color.text.default': '#0b3d1a',
    'color.white': '#ffffff',
    'space.4': '16px',
  });
  assert.equal(JSON.parse(outputs['tokens.dark.json'])['color.text.default'], '#ffffff');
});

test('two builds are byte-identical', async () => {
  const root = makeRepo(VALID);
  assert.deepEqual((await buildOutputs(root)).outputs, (await buildOutputs(root)).outputs);
});

test('an empty set builds an empty :root and an empty map', async () => {
  const { outputs } = await buildOutputs(makeRepo());
  assert.match(outputs['tokens.css'], /:root \{\s*\}/);
  assert.equal(outputs['tokens.json'], '{}\n');
});

test('a failing check refuses the build', async () => {
  const { errors, outputs } = await buildOutputs(makeRepo({ ...VALID, 'dist/x.css': '@import "y";' }));
  assert.equal(outputs, undefined);
  assert.match(errors.origin[0], /@import/);
});

test('every CSS custom property is its token name with dots as hyphens', async () => {
  const files = { ...VALID, 'tokens/primitive/x.tokens.json': { space: { $type: 'dimension', h1: { $value: '4px' }, '2xl': { $value: '8px' }, 'gray2-a': { $value: '1px' } } } };
  const { outputs } = await buildOutputs(makeRepo(files));
  for (const name of Object.keys(JSON.parse(outputs['tokens.json']))) {
    assert.match(outputs['tokens.css'], new RegExp(`--${name.replaceAll('.', '-')}: `), name);
  }
});

test('typography expands to one property per field; shadows and font families are CSS-ready', async () => {
  const files = {
    'tokens/primitive/type.tokens.json': {
      font: { serif: { $type: 'fontFamily', $value: ['Source Serif 4', 'serif'] } },
      type: {
        body: {
          $type: 'typography',
          $value: { fontFamily: '{font.serif}', fontSize: { value: 1, unit: 'rem' }, fontWeight: 400, lineHeight: 1.5, letterSpacing: { value: 0.5, unit: 'px' } },
        },
      },
      shadow: { sm: { $type: 'shadow', $value: { color: '#00000033', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 1, unit: 'px' }, blur: { value: 2, unit: 'px' }, spread: { value: 0, unit: 'px' } } } },
    },
  };
  const { errors, outputs } = await buildOutputs(makeRepo(files));
  assert.equal(errors, undefined, JSON.stringify(errors));
  const css = outputs['tokens.css'];
  assert.match(css, /--type-body-letter-spacing: 0\.5px;/);
  assert.match(css, /--type-body-font-size: 1rem;/);
  assert.match(css, /--font-serif: 'Source Serif 4', serif;/);
  assert.match(css, /--shadow-sm: 0px 1px 2px 0px #00000033;/);
  assert.ok('type.body' in JSON.parse(outputs['tokens.json']), 'tokens.json keeps one entry per token');
});
