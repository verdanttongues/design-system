// Checks every declared text/background pair in tokens/contrast-pairs.json against WCAG 2.2 AA,
// in the base and in every mode (CLAUDE.md → §5.3).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseColor, contrastRatio, REQUIRED } from './color.js';

export const PAIRS_FILE = 'tokens/contrast-pairs.json';

/** Reads the declared pairs. Returns { pairs, errors }. */
export function readPairs(root) {
  const errors = [];
  const file = join(root, PAIRS_FILE);
  if (!existsSync(file)) return { pairs: [], errors: [`${PAIRS_FILE} is missing`] };
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    return { pairs: [], errors: [`${PAIRS_FILE}: not valid JSON (${e.message})`] };
  }
  if (!Array.isArray(doc.pairs)) return { pairs: [], errors: [`${PAIRS_FILE}: "pairs" must be a list`] };
  const seen = new Set();
  const pairs = [];
  doc.pairs.forEach((p, i) => {
    const where = `${PAIRS_FILE}: pairs[${i}]`;
    if (!p || typeof p.text !== 'string' || typeof p.background !== 'string' || !(p.size in REQUIRED)) {
      errors.push(`${where}: needs "text", "background" and "size" (${Object.keys(REQUIRED).join(' | ')})`);
      return;
    }
    const key = `${p.text}|${p.background}|${p.size}`;
    if (seen.has(key)) errors.push(`${where}: declared twice`);
    seen.add(key);
    pairs.push(p);
  });
  return { pairs, errors };
}

/**
 * Checks each pair in each layer. `loaded` is loadTokens()'s result.
 * Returns { errors, results: [{ mode, text, background, size, ratio, required, pass }] }.
 */
export function checkContrast(root, loaded) {
  const { pairs, errors } = readPairs(root);
  const results = [];
  const layers = [['base', loaded.base], ...Object.entries(loaded.modes)];
  for (const p of pairs) {
    const where = `${PAIRS_FILE}: ${p.text} on ${p.background}`;
    let usable = true;
    for (const name of [p.text, p.background]) {
      const t = loaded.base.get(name);
      if (!t) { errors.push(`${where}: ${name} is not a token`); usable = false; continue; }
      if (t.type !== 'color') { errors.push(`${where}: ${name} is not a colour`); usable = false; }
      if (loaded.tier.get(name) !== 'semantic') { errors.push(`${where}: ${name} is not semantic; pairs name uses`); usable = false; }
    }
    if (!usable) continue;
    for (const [mode, layer] of layers) {
      const required = REQUIRED[p.size];
      let ratio;
      try {
        ratio = contrastRatio(parseColor(layer.get(p.text).value), parseColor(layer.get(p.background).value));
      } catch (e) {
        errors.push(`${where} (${mode}): ${e.message}`);
        continue;
      }
      const pass = ratio >= required;
      results.push({ mode, ...p, ratio, required, pass });
      if (!pass) {
        errors.push(`${where} (${mode}, ${p.size}): ${ratio.toFixed(2)}:1, needs ${required}:1 (WCAG 2.2 AA)`);
      }
    }
  }
  return { errors, results };
}
