// Loads and validates the DTCG token files under tokens/, and resolves every alias.
//
// The layout (DS2): tokens/primitive/ and tokens/semantic/ form the base set;
// tokens/modes/<mode>/ overrides semantic tokens for one mode. Every rule this file
// enforces is listed in tokens/README.md, and CLAUDE.md → §2 and §5.1 are its source.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const TYPES = new Set([
  'color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number',
  'strokeStyle', 'border', 'transition', 'shadow', 'gradient', 'typography',
]);
const TOKEN_KEYS = new Set(['$value', '$type', '$description', '$extensions', '$deprecated']);
const GROUP_KEYS = new Set(['$type', '$description', '$extensions', '$deprecated']);
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const REF = /^\{([^{}]+)\}$/;
const TOKEN_FILE = /\.tokens\.json$/;

/** Every file under `dir`, recursively, sorted, as absolute paths. Missing dir → []. */
export function listFiles(dir, predicate = () => true) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map((p) => join(dir, String(p)))
    .filter((p) => statSync(p).isFile() && predicate(p))
    .sort();
}

/** The token files, by layer. */
export function tokenFiles(root) {
  const t = join(root, 'tokens');
  const modesDir = join(t, 'modes');
  const modes = existsSync(modesDir)
    ? readdirSync(modesDir).filter((m) => statSync(join(modesDir, m)).isDirectory()).sort()
    : [];
  return {
    primitive: listFiles(join(t, 'primitive'), (p) => TOKEN_FILE.test(p)),
    semantic: listFiles(join(t, 'semantic'), (p) => TOKEN_FILE.test(p)),
    modes: Object.fromEntries(modes.map((m) => [m, listFiles(join(modesDir, m), (p) => TOKEN_FILE.test(p))])),
    all: listFiles(t, (p) => TOKEN_FILE.test(p)),
  };
}

function checkExtensions(ext, where, errors) {
  if (ext === undefined) return;
  if (typeof ext !== 'object' || ext === null || Array.isArray(ext)) {
    errors.push(`${where}: $extensions must be an object`);
  } else {
    // Figma writes both a nested "com.figma" object and flat "com.figma.<key>" keys
    // ("com.figma.variableId", "com.figma.scopes", "com.figma.modeName", "com.figma.type").
    const figma = Object.keys(ext).filter((k) => k === 'com.figma' || k.startsWith('com.figma.'));
    if (figma.length) {
      errors.push(`${where}: $extensions ${figma.map((k) => `"${k}"`).join(', ')} must be stripped by the import (CLAUDE.md → §2 rule 4)`);
    }
  }
}

/** Parses one file into tokens: Map<dotted path, { path, value, type, description, file }>. */
export function parseTokenFile(file, text, root, errors) {
  const rel = relative(root, file);
  const tokens = new Map();
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    errors.push(`${rel}: not valid JSON (${e.message})`);
    return tokens;
  }
  const walk = (node, path, inheritedType) => {
    const where = `${rel}: ${path.length ? path.join('.') : '(root)'}`;
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      errors.push(`${where}: a group or token must be an object`);
      return;
    }
    const isToken = '$value' in node;
    const allowed = isToken ? TOKEN_KEYS : GROUP_KEYS;
    for (const key of Object.keys(node)) {
      if (key.startsWith('$') && !allowed.has(key)) {
        errors.push(`${where}: "${key}" is not a DTCG ${isToken ? 'token' : 'group'} property`);
      }
    }
    if (node.$type !== undefined && !TYPES.has(node.$type)) {
      errors.push(`${where}: unknown $type "${node.$type}"`);
    }
    checkExtensions(node.$extensions, where, errors);
    const type = node.$type ?? inheritedType;
    if (isToken) {
      if (path.length === 0) {
        errors.push(`${where}: the file root cannot be a token`);
        return;
      }
      for (const key of Object.keys(node)) {
        if (!key.startsWith('$')) errors.push(`${where}: a token cannot contain "${key}"`);
      }
      tokens.set(path.join('.'), {
        path, value: node.$value, type, description: node.$description, file: rel,
      });
      return;
    }
    for (const key of Object.keys(node)) {
      if (key.startsWith('$')) continue;
      if (!NAME.test(key)) {
        errors.push(`${where}: name "${key}" must be lowercase letters, digits and single hyphens`);
        continue;
      }
      walk(node[key], [...path, key], type);
    }
  };
  walk(doc, [], undefined);
  return tokens;
}

/** Every reference inside a value, whole-string aliases only (DTCG has no partial ones). */
function references(value, where, errors) {
  const out = [];
  const visit = (v) => {
    if (typeof v === 'string') {
      const m = REF.exec(v);
      if (m) out.push(m[1]);
      else if (v.includes('{') || v.includes('}')) errors.push(`${where}: "${v}" is not a whole alias`);
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(value);
  return out;
}

const TYPOGRAPHY_FIELDS = ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'];
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const DIM_STRING = /^-?\d+(\.\d+)?(px|rem)$/;

/** A shape check per type. Composite types are checked for their container only. */
export function checkValueShape(type, value) {
  switch (type) {
    case 'color':
      if (typeof value === 'string') {
        return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? null : 'a colour string must be #rgb, #rgba, #rrggbb or #rrggbbaa';
      }
      if (value && typeof value === 'object' && typeof value.colorSpace === 'string'
        && Array.isArray(value.components) && value.components.length === 3
        && (value.alpha === undefined || isNum(value.alpha))) return null;
      return 'a colour must be a hex string or { colorSpace, components[3], alpha? }';
    case 'dimension':
      if (typeof value === 'string') return DIM_STRING.test(value) ? null : 'a dimension string must be a number with px or rem';
      return value && isNum(value.value) && ['px', 'rem'].includes(value.unit) ? null : 'a dimension must be { value, unit: px | rem }';
    case 'duration':
      return value && isNum(value.value) && ['ms', 's'].includes(value.unit) ? null : 'a duration must be { value, unit: ms | s }';
    case 'number':
      return isNum(value) ? null : 'a number must be a finite number';
    case 'fontWeight':
      return (isNum(value) && value >= 1 && value <= 1000) || typeof value === 'string' ? null : 'a font weight must be 1–1000 or a keyword';
    case 'fontFamily':
      return typeof value === 'string' || (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string'))
        ? null : 'a font family must be a string or a non-empty list of strings';
    case 'cubicBezier':
      return Array.isArray(value) && value.length === 4 && value.every(isNum) ? null : 'a cubic Bézier must be four numbers';
    case 'typography': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return 'a typography must be an object';
      const extra = Object.keys(value).filter((k) => !TYPOGRAPHY_FIELDS.includes(k));
      return extra.length ? `a typography holds ${TYPOGRAPHY_FIELDS.join(', ')} only, not ${extra.join(', ')}` : null;
    }
    case 'shadow':
    case 'gradient':
      return (Array.isArray(value) || (value && typeof value === 'object')) ? null : `a ${type} must be an object or a list`;
    default:
      return value && typeof value === 'object' ? null : `a ${type} must be an object`;
  }
}

/** Replaces every alias inside `value` with its target's resolved value. */
function substitute(value, resolveRef) {
  if (typeof value === 'string') {
    const m = REF.exec(value);
    return m ? resolveRef(m[1]) : value;
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, resolveRef));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, resolveRef)]));
  }
  return value;
}

/**
 * Resolves one layer (a Map of tokens). Returns Map<name, { value, type, description, token }>
 * where `value` has every alias replaced. Records cycles, dangling aliases and type errors.
 */
function resolveLayer(tokens, layerName, errors) {
  const resolved = new Map();
  const visiting = new Set();
  const resolveToken = (name, chain) => {
    if (resolved.has(name)) return resolved.get(name);
    const token = tokens.get(name);
    if (visiting.has(name)) {
      errors.push(`${layerName}: alias cycle ${[...chain, name].join(' → ')}`);
      return null;
    }
    visiting.add(name);
    let type = token.type;
    let failed = false;
    const value = substitute(token.value, (ref) => {
      if (!tokens.has(ref)) {
        errors.push(`${token.file}: ${name} aliases {${ref}}, which is not a token`);
        failed = true;
        return null;
      }
      const target = resolveToken(ref, [...chain, name]);
      if (!target) { failed = true; return null; }
      if (REF.test(token.value)) {
        if (type && target.type && type !== target.type) {
          errors.push(`${token.file}: ${name} is ${type} but aliases {${ref}}, which is ${target.type}`);
        }
        type ??= target.type;
      }
      return target.value;
    });
    visiting.delete(name);
    if (failed) return null;
    if (!type) {
      errors.push(`${token.file}: ${name} has no $type (own, inherited or from its alias)`);
      return null;
    }
    const shape = checkValueShape(type, value);
    if (shape) errors.push(`${token.file}: ${name}: ${shape}`);
    const out = { value, type, description: token.description, token };
    resolved.set(name, out);
    return out;
  };
  for (const name of tokens.keys()) resolveToken(name, []);
  return resolved;
}

/**
 * Loads, validates and resolves everything under tokens/.
 * Returns { errors, files, base, modes } — base and each mode are resolved Maps.
 */
export function loadTokens(root) {
  const errors = [];
  const files = tokenFiles(root);
  const read = (file) => parseTokenFile(file, readFileSync(file, 'utf8'), root, errors);

  const placed = new Set([...files.primitive, ...files.semantic, ...Object.values(files.modes).flat()]);
  for (const f of files.all) {
    if (!placed.has(f)) errors.push(`${relative(root, f)}: a token file must be under tokens/primitive, tokens/semantic or tokens/modes/<mode>`);
  }
  for (const mode of Object.keys(files.modes)) {
    if (!NAME.test(mode)) errors.push(`tokens/modes/${mode}: a mode name must be lowercase letters, digits and single hyphens`);
  }

  const tier = new Map(); // name → 'primitive' | 'semantic'
  const base = new Map();
  const add = (tierName, file) => {
    for (const [name, token] of read(file)) {
      if (base.has(name)) {
        errors.push(`${token.file}: ${name} is already defined in ${base.get(name).file}`);
        continue;
      }
      base.set(name, token);
      tier.set(name, tierName);
    }
  };
  files.primitive.forEach((f) => add('primitive', f));
  files.semantic.forEach((f) => add('semantic', f));

  // Tiers: a primitive aliases primitives only; a semantic token is one alias to a primitive.
  for (const [name, token] of base) {
    const where = `${token.file}: ${name}`;
    const refs = references(token.value, where, errors);
    if (tier.get(name) === 'semantic') {
      if (!(typeof token.value === 'string' && REF.test(token.value))) {
        errors.push(`${where}: a semantic token's $value must be one alias to a primitive`);
      }
    }
    for (const ref of refs) {
      if (tier.get(ref) === 'semantic') errors.push(`${where}: aliases {${ref}}, a semantic token; alias a primitive`);
    }
  }

  // Modes: each overrides existing semantic tokens only, each with one alias to a primitive.
  const modeTokens = {};
  for (const [mode, modeFiles] of Object.entries(files.modes)) {
    const overrides = new Map();
    for (const file of modeFiles) {
      for (const [name, token] of read(file)) {
        const where = `${token.file}: ${name}`;
        if (overrides.has(name)) {
          errors.push(`${where}: is already overridden in ${overrides.get(name).file}`);
          continue;
        }
        if (tier.get(name) !== 'semantic') {
          errors.push(`${where}: a mode overrides an existing semantic token only`);
          continue;
        }
        references(token.value, where, errors);
        if (!(typeof token.value === 'string' && REF.test(token.value)) || tier.get(REF.exec(token.value)[1]) !== 'primitive') {
          errors.push(`${where}: a mode's $value must be one alias to a primitive`);
        }
        overrides.set(name, { ...token, type: token.type ?? base.get(name).type });
      }
    }
    modeTokens[mode] = overrides;
  }

  const resolvedBase = resolveLayer(base, 'base', errors);
  const modes = {};
  for (const [mode, overrides] of Object.entries(modeTokens)) {
    const layer = new Map(base);
    for (const [name, token] of overrides) layer.set(name, token);
    const resolved = resolveLayer(layer, `mode ${mode}`, errors);
    for (const [name, r] of resolved) {
      const baseType = resolvedBase.get(name)?.type;
      if (overrides.has(name) && baseType && r.type !== baseType) {
        errors.push(`${overrides.get(name).file}: ${name} is ${r.type} in mode ${mode} but ${baseType} in the base`);
      }
    }
    modes[mode] = resolved;
  }

  // Colours live under `color`, and only colours do, so tokens.json is readable by prefix.
  for (const [name, r] of resolvedBase) {
    const underColor = name.split('.')[0] === 'color';
    if (r.type === 'color' && !underColor) errors.push(`${r.token.file}: ${name} is a colour; colours live under "color"`);
    if (r.type !== 'color' && underColor) errors.push(`${r.token.file}: ${name} is under "color" but is ${r.type}`);
  }

  return { errors: [...new Set(errors)], files, tier, base: resolvedBase, modes };
}
