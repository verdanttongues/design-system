// Colour parsing and WCAG 2.2 contrast (CLAUDE.md → §5.3).

/** Parses a resolved DTCG colour into sRGB { r, g, b, a }, each 0–1. Throws if it cannot. */
export function parseColor(value) {
  if (typeof value === 'string') return parseHex(value);
  if (value && typeof value === 'object') {
    const a = value.alpha ?? 1;
    if (value.colorSpace === 'srgb') {
      const [r, g, b] = value.components;
      if ([r, g, b].some((c) => typeof c !== 'number')) {
        throw new Error('an sRGB colour needs three numeric components ("none" is not supported)');
      }
      return { r, g, b, a };
    }
    if (typeof value.hex === 'string') return { ...parseHex(value.hex), a };
    throw new Error(`colour space "${value.colorSpace}" has no hex fallback; contrast needs sRGB`);
  }
  throw new Error('not a colour');
}

function parseHex(hex) {
  let h = hex.replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)) throw new Error(`"${hex}" is not a hex colour`);
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
}

/** #rrggbb, or #rrggbbaa when translucent. */
export function toHex({ r, g, b, a }) {
  const x = (c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}${a < 1 ? x(a) : ''}`;
}

const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function luminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * WCAG contrast of a foreground over an opaque background. A translucent foreground is
 * composited over the background first; a translucent background is refused, since what
 * lies beneath it is unknown.
 */
export function contrastRatio(fg, bg) {
  if (bg.a < 1) throw new Error('the background is translucent; its contrast depends on what lies beneath it');
  const over = {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  };
  const [hi, lo] = [luminance(over), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text (1.4.3) and UI components (1.4.11). */
export const REQUIRED = { body: 4.5, large: 3, ui: 3 };
