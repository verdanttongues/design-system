# tokens/

The design tokens, as [DTCG](https://www.designtokens.org/tr/drafts/format/) JSON. The import
writes them from Figma (CLAUDE.md → §2), and they are changed by pull request only. Values come
from Figma's variable export (source A), or its REST API where A has none (B), and never from a
screenshot (C).

`npm test` checks every rule below, and `npm run build` refuses to run on a set that breaks one.
What Figma's export contains, what the import changes, and how to export: `docs/figma-export.md`.

## Layout (DS2)

| Path | Holds |
|---|---|
| `primitive/*.tokens.json` | The palette and scales: `color.green.600`, `space.4`. Values, or aliases to other primitives |
| `semantic/*.tokens.json` | Uses: `color.text.default`, `color.surface.brand`. **Each is exactly one alias to a primitive.** Sites style with these only |
| `modes/<mode>/*.tokens.json` | One mode's overrides (e.g. `dark`). **Overrides existing semantic tokens only**, each with one alias to a primitive |
| `contrast-pairs.json` | Every text/background pair a site renders, each with a `size`: `body` (4.5:1), `large` (3:1) or `ui` (3:1) |

A `*.tokens.json` file anywhere else is an error.

## Rules

- **Names** are lowercase letters, digits and single hyphens (`green`, `600`, `text-muted`). A
  token's full name is its path joined by dots.
- **A name is defined once** across `primitive/` and `semantic/`.
- **Every token has a `$type`**: its own, its group's, or its alias target's. An alias's type
  matches its target's.
- **Colours live under `color`, and only colours do**, so `dist/tokens.json` can be read by prefix.
- **Aliases are whole values** (`"{color.green.600}"`), resolve to a token, and form no cycle.
- **No `$extensions["com.figma"]`**: the import strips Figma's ids and scopes.
- **No token value names a URL.**
- Colours are `#rrggbb` / `#rrggbbaa` strings or DTCG objects (`{ colorSpace, components, alpha }`);
  contrast is computed in sRGB, and a non-sRGB colour needs its `hex` fallback. Dimensions are
  `{ value, unit }` in `px` or `rem`. A typography token holds `fontFamily`, `fontSize`,
  `fontWeight`, `letterSpacing` and `lineHeight` only, and ships as one CSS property per field
  (DS7).
