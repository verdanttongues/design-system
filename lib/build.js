// Builds dist/ from tokens/ with Style Dictionary (CLAUDE.md → §3; A388). Outputs are returned
// in memory so that scripts/check-dist.js can compare them with the committed dist/ (DS1).
//
//   dist/tokens.css         :root { every token }, then [data-mode="<mode>"] { its overrides } (DS3);
//                           a typography token becomes one property per field (DS7)
//   dist/tokens.json        flat "dotted.name": value, base set
//   dist/tokens.<mode>.json flat, the whole set as that mode resolves it

import StyleDictionary from 'style-dictionary';
import { checkAll, formatErrors } from './check.js';

const flat = ({ dictionary }) => {
  const entries = dictionary.allTokens
    .map((t) => [t.path.join('.'), t.$value])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`;
};

const HEADER = /^\/\*\*[\s\S]*?\*\/\n\n/;

// The css group less the typography shorthand, which warns on letter spacing (DS7).
const JSON_TRANSFORMS = StyleDictionary.hooks.transformGroups.css.filter((t) => t !== 'typography/css/shorthand');

// CSS expands typography: the `font` shorthand cannot carry letter spacing (DS7). JSON does
// not, so tokens.json keeps one entry per token name.
async function format(config, { css, json }) {
  const sd = new StyleDictionary({
    usesDtcg: true,
    hooks: { formats: { 'vt/json-flat': flat } },
    platforms: {
      css: { transformGroup: 'css', expand: { include: ['typography'] }, files: [css] },
      json: { transforms: JSON_TRANSFORMS, files: [json] },
    },
    ...config,
  });
  const out = {};
  for (const platform of ['css', 'json']) {
    for (const o of await sd.formatPlatform(platform)) out[o.destination] = o.output;
  }
  return out;
}

/** Returns { errors } if a check fails, else { outputs: { 'tokens.css': string, … } }. */
export async function buildOutputs(root) {
  const { loaded, errors } = checkAll(root);
  if (Object.values(errors).some((list) => list.length)) return { errors };

  const { primitive, semantic, modes } = loaded.files;
  const baseFiles = [...primitive, ...semantic];
  // Warnings are errors in the base build: a collision or a dangling alias must not ship.
  try {
    return { outputs: await formatAll(baseFiles, modes) };
  } catch (e) {
    return { errors: { build: [`Style Dictionary: ${e.message.trim()}`] } };
  }
}

async function formatAll(baseFiles, modes) {
  const base = await format(
    { source: baseFiles, log: { warnings: 'error', verbosity: 'silent' } },
    {
      css: { destination: 'tokens.css', format: 'css/variables', options: { outputReferences: true } },
      json: { destination: 'tokens.json', format: 'vt/json-flat' },
    },
  );

  const outputs = { 'tokens.css': base['tokens.css'], 'tokens.json': base['tokens.json'] };
  for (const [mode, modeFiles] of Object.entries(modes)) {
    // The mode block lists its overrides only, which alias primitives the base block defines;
    // Style Dictionary warns that those primitives are filtered out of the block, which is the
    // intent. checkAll() has already validated every alias.
    const built = await format(
      { include: baseFiles, source: modeFiles, log: { warnings: 'disabled', verbosity: 'silent' } },
      {
        css: {
          destination: 'mode.css',
          format: 'css/variables',
          filter: (t) => t.isSource,
          options: { selector: `[data-mode="${mode}"]`, outputReferences: true },
        },
        json: { destination: 'mode.json', format: 'vt/json-flat' },
      },
    );
    outputs['tokens.css'] += `\n${built['mode.css'].replace(HEADER, '')}`;
    outputs[`tokens.${mode}.json`] = built['mode.json'];
  }
  return outputs;
}

export { formatErrors };
