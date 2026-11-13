import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

/**
 * A throwaway repository. `files` maps a path to its content (objects are written as JSON).
 * The pairs file and icon manifest exist by default, empty, as in the real repository.
 */
export function makeRepo(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vt-ds-'));
  const all = {
    'tokens/contrast-pairs.json': { pairs: [] },
    'icons/licences.json': { icons: {} },
    ...files,
  };
  for (const [path, content] of Object.entries(all)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

/** A small valid set: two primitives, two semantic tokens, a dark mode, one declared pair. */
export const VALID = {
  'tokens/primitive/color.tokens.json': {
    color: {
      $type: 'color',
      green: { 900: { $value: '#0b3d1a' } },
      white: { $value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1, hex: '#ffffff' } },
    },
  },
  'tokens/primitive/space.tokens.json': {
    space: { $type: 'dimension', 4: { $value: { value: 16, unit: 'px' } } },
  },
  'tokens/semantic/color.tokens.json': {
    color: {
      text: { default: { $type: 'color', $value: '{color.green.900}', $description: 'Body text' } },
      surface: { default: { $value: '{color.white}' } },
    },
  },
  'tokens/modes/dark/color.tokens.json': {
    color: {
      text: { default: { $value: '{color.white}' } },
      surface: { default: { $value: '{color.green.900}' } },
    },
  },
  'tokens/contrast-pairs.json': {
    pairs: [{ text: 'color.text.default', background: 'color.surface.default', size: 'body' }],
  },
};
