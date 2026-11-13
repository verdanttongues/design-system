// Two checks over the files this repository ships:
//   no other origin (CLAUDE.md → §0.4, §5.4) and licences present (§5.5).

import { readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname, basename, extname, resolve, sep } from 'node:path';
import { listFiles } from './dtcg.js';

const SKIP = new Set(['node_modules', '.git', 'build']);
const shipped = (root, p) => !relative(root, p).split(sep).some((part) => SKIP.has(part));
const HAS_HOST = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/** Every url() target in a stylesheet, unquoted. */
export function cssUrls(css) {
  const out = [];
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
  for (let m; (m = re.exec(css));) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/**
 * No other origin. In any shipped stylesheet: no @import, and every url() is a relative path to
 * a file in this repository. In any icon SVG: no href to another origin, no script. In any token
 * string: no url() and no scheme.
 */
export function checkOrigins(root, loaded) {
  const errors = [];
  for (const file of listFiles(root, (p) => extname(p) === '.css' && shipped(root, p))) {
    const rel = relative(root, file);
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/@import\b/i.test(css)) errors.push(`${rel}: @import is not allowed; everything ships in one bundle`);
    for (const url of cssUrls(css)) {
      if (HAS_HOST.test(url)) {
        errors.push(`${rel}: url(${url}) names another origin; ship the file here`);
      } else if (url.startsWith('/')) {
        errors.push(`${rel}: url(${url}) is root-relative; use a path relative to the stylesheet`);
      } else {
        const target = resolve(dirname(file), url.split(/[?#]/)[0]);
        if (!target.startsWith(resolve(root) + sep) || !existsSync(target)) {
          errors.push(`${rel}: url(${url}) is not a file in this repository`);
        }
      }
    }
  }
  for (const file of listFiles(join(root, 'icons'), (p) => extname(p) === '.svg')) {
    const rel = relative(root, file);
    const svg = readFileSync(file, 'utf8');
    if (/<script\b/i.test(svg)) errors.push(`${rel}: an icon carries no script`);
    for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) {
      if (!m[1].startsWith('#')) errors.push(`${rel}: href="${m[1]}" points outside the icon`);
    }
    for (const url of cssUrls(svg)) {
      if (!url.startsWith('#')) errors.push(`${rel}: url(${url}) points outside the icon`);
    }
  }
  for (const [name, r] of loaded?.base ?? []) {
    const strings = JSON.stringify(r.token.value);
    if (/url\(/i.test(strings) || /[a-z][a-z0-9+.-]*:\/\//i.test(strings)) {
      errors.push(`${r.token.file}: ${name} names a URL; a token holds a value, never a location`);
    }
  }
  return errors;
}

export const FONT_LICENCE = /^(licen[cs]e|ofl|copying)(\.(txt|md))?$/i;
export const ICON_MANIFEST = 'icons/licences.json';

/**
 * Licences present. A font is a .woff2 in a folder holding its licence file. An icon is listed in
 * icons/licences.json as { "source": "vt" } or { "source": "licensed", "licence": "<file>" }.
 */
export function checkLicences(root) {
  const errors = [];
  const fonts = join(root, 'fonts');
  for (const file of listFiles(fonts)) {
    const rel = relative(root, file);
    const ext = extname(file).toLowerCase();
    if (['.woff', '.ttf', '.otf', '.eot'].includes(ext)) {
      errors.push(`${rel}: fonts ship as WOFF2 only`);
    } else if (ext === '.woff2') {
      const hasLicence = listFiles(dirname(file)).some((p) => dirname(p) === dirname(file) && FONT_LICENCE.test(basename(p)));
      if (!hasLicence) errors.push(`${rel}: no licence file beside it (LICENSE, OFL.txt, …); core L20 first`);
    }
  }

  const icons = join(root, 'icons');
  const manifestFile = join(root, ICON_MANIFEST);
  if (!existsSync(manifestFile)) return [...errors, `${ICON_MANIFEST} is missing`];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch (e) {
    return [...errors, `${ICON_MANIFEST}: not valid JSON (${e.message})`];
  }
  const entries = manifest.icons ?? {};
  const licences = new Set();
  for (const [path, entry] of Object.entries(entries)) {
    const where = `${ICON_MANIFEST}: ${path}`;
    if (!existsSync(join(icons, path))) errors.push(`${where}: no such file under icons/`);
    if (entry?.source === 'vt') continue;
    if (entry?.source === 'licensed' && typeof entry.licence === 'string') {
      licences.add(entry.licence);
      if (!existsSync(join(icons, entry.licence))) errors.push(`${where}: licence file ${entry.licence} is missing`);
      continue;
    }
    errors.push(`${where}: needs { "source": "vt" } or { "source": "licensed", "licence": "<file>" }`);
  }
  for (const file of listFiles(icons)) {
    const rel = relative(icons, file).split(sep).join('/');
    if (rel === 'README.md' || rel === 'licences.json' || licences.has(rel) || basename(file) === '.gitkeep') continue;
    if (!(rel in entries)) errors.push(`icons/${rel}: not listed in ${ICON_MANIFEST}`);
  }
  return errors;
}
