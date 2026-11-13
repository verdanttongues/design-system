// The style guide (CLAUDE.md → §3): a static page generated from the same files that ship.
// Samples use the CSS custom properties from dist/tokens.css, and each mode is shown inside a
// [data-mode] block, so the page renders exactly what a site receives. Internal: built by CI as
// an artifact and locally on demand, never deployed.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseColor, toHex } from './color.js';
import { ICON_MANIFEST } from './assets.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cssVar = (name) => `var(--${name.replaceAll('.', '-')})`;
const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
const empty = (what) => `<p class="empty">No ${what} yet.</p>`;

function hex(value) {
  try { return toHex(parseColor(value)); } catch { return show(value); }
}

// dist/tokens.css expands a typography token into one property per field (DS7).
const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
function typographyStyle(name, value) {
  return Object.keys(value).map((k) => `${kebab(k)}:${cssVar(`${name}.${kebab(k)}`)}`).join(';');
}

function section(title, body) {
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

function colours(loaded, modes) {
  const names = [...loaded.base].filter(([, r]) => r.type === 'color').map(([n]) => n);
  if (!names.length) return empty('colour tokens');
  const head = ['base', ...modes].map((m) => `<th>${esc(m)}</th>`).join('');
  const rows = names.map((n) => {
    const tier = loaded.tier.get(n);
    const cells = ['base', ...modes].map((m) => {
      const layer = m === 'base' ? loaded.base : loaded.modes[m];
      const attr = m === 'base' ? '' : ` data-mode="${esc(m)}"`;
      return `<td${attr}><span class="swatch" style="background:${cssVar(n)}"></span><code>${esc(hex(layer.get(n)?.value))}</code></td>`;
    }).join('');
    return `<tr><td><code>${esc(n)}</code><br><small>${tier}</small></td>${cells}</tr>`;
  });
  return `<table><tr><th>Token</th>${head}</tr>${rows.join('')}</table>`;
}

function contrast(results) {
  if (!results.length) return empty('declared text/background pairs (tokens/contrast-pairs.json)');
  const rows = results.map((r) => {
    const attr = r.mode === 'base' ? '' : ` data-mode="${esc(r.mode)}"`;
    return `<tr class="${r.pass ? 'pass' : 'fail'}"><td>${esc(r.mode)}</td>`
      + `<td${attr}><span class="sample" style="color:${cssVar(r.text)};background:${cssVar(r.background)}">Aa</span></td>`
      + `<td><code>${esc(r.text)}</code><br>on <code>${esc(r.background)}</code></td><td>${esc(r.size)}</td>`
      + `<td>${r.ratio.toFixed(2)}:1</td><td>${r.required}:1</td><td>${r.pass ? 'AA' : 'FAILS'}</td></tr>`;
  });
  return `<table><tr><th>Mode</th><th></th><th>Pair</th><th>Size</th><th>Ratio</th><th>Needs</th><th></th></tr>${rows.join('')}</table>`;
}

function byType(loaded, types, render) {
  const list = [...loaded.base].filter(([, r]) => types.includes(r.type));
  if (!list.length) return empty(`${types.join(' / ')} tokens`);
  return `<table>${list.map(([n, r]) => `<tr><td><code>${esc(n)}</code></td><td><code>${esc(show(r.value))}</code></td><td>${render(n, r)}</td></tr>`).join('')}</table>`;
}

function fonts(root) {
  const file = join(root, 'fonts', 'fonts.css');
  const css = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const families = [...new Set([...css.matchAll(/font-family\s*:\s*["']?([^;"']+)["']?\s*;/g)].map((m) => m[1].trim()))];
  if (!families.length) return empty('fonts');
  return families.map((f) => `<p style="font-family:'${esc(f)}'"><strong>${esc(f)}</strong> — The quick brown fox jumps over the lazy dog 0123456789</p>`).join('');
}

function icons(root) {
  const file = join(root, ICON_MANIFEST);
  const entries = existsSync(file) ? Object.entries(JSON.parse(readFileSync(file, 'utf8')).icons ?? {}) : [];
  if (!entries.length) return empty('icons');
  return `<div class="icons">${entries.map(([p, e]) => `<figure><img src="icons/${esc(p)}" alt=""><figcaption><code>${esc(p)}</code><br><small>${esc(e.source)}</small></figcaption></figure>`).join('')}</div>`;
}

/** Renders the page. `checked` is checkAll()'s result. */
export function renderStyleguide(root, checked) {
  const { loaded, contrast: c } = checked;
  const modes = Object.keys(loaded.modes);
  const all = [...loaded.base].map(([n, r]) => `<tr><td><code>${esc(n)}</code></td><td>${esc(r.type)}</td><td>${esc(loaded.tier.get(n))}</td><td><code>${esc(show(r.value))}</code></td><td>${esc(r.description ?? '')}</td></tr>`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Verdant Tongues design system — style guide (internal)</title>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="fonts/fonts.css">
<style>
  body { font: 15px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 72rem; padding: 0 1rem; color: #111; background: #fff; }
  table { border-collapse: collapse; width: 100%; } td, th { border-bottom: 1px solid #ddd; padding: .4rem .6rem; text-align: left; vertical-align: middle; }
  .swatch { display: inline-block; width: 2.5rem; height: 1.5rem; border: 1px solid #0003; margin-right: .5rem; vertical-align: middle; }
  .sample { display: inline-block; padding: .2rem .6rem; font-weight: 600; }
  .fail { background: #fee; } .empty { color: #666; font-style: italic; }
  .bar { display: inline-block; height: .8rem; background: #888; } .shadow { width: 4rem; height: 2.5rem; background: #fff; }
  .icons { display: flex; flex-wrap: wrap; gap: 1rem; } .icons img { width: 64px; height: 64px; object-fit: contain; }
</style>
</head>
<body>
<h1>Verdant Tongues design system</h1>
<p>Internal. Generated from <code>tokens/</code>, <code>dist/tokens.css</code>, <code>fonts/</code> and <code>icons/</code>; never deployed. Modes: ${modes.length ? modes.map(esc).join(', ') : 'none'}.</p>
${section('Colour', colours(loaded, modes))}
${section('Contrast (WCAG 2.2 AA)', contrast(c.results))}
${section('Typography', byType(loaded, ['typography', 'fontFamily', 'fontWeight'], (n, r) => r.type === 'typography' ? `<span style="${typographyStyle(n, r.value)}">The quick brown fox</span>` : ''))}
${section('Dimensions', byType(loaded, ['dimension'], (n) => `<span class="bar" style="width:${cssVar(n)}"></span>`))}
${section('Shadows', byType(loaded, ['shadow'], (n) => `<div class="shadow" style="box-shadow:${cssVar(n)}"></div>`))}
${section('Fonts', fonts(root))}
${section('Icons', icons(root))}
${section('Every token', all.length ? `<table><tr><th>Name</th><th>Type</th><th>Tier</th><th>Value</th><th>Description</th></tr>${all.join('')}</table>` : empty('tokens'))}
</body>
</html>
`;
}
