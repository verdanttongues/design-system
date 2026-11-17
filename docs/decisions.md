# Decisions — design system

This repository's own decisions. Ids are `DS<n>`, so they never collide with `core`'s prefixes
(`A`, `G`, `L`, `M`, `T`). A `core` id cited here (A307, A388, L20, …) lives in `core`'s
`docs/decisions.md`. A decision that changes what CLAUDE.md states is made in `core` first
(`core/docs/design-system.md` is CLAUDE.md's master, A382); this file records only what `core`
left to the repository.

## Open

| Id | Question | Notes |
|---|---|---|
| **DS6** | **Does a mode also follow the system preference?** A `dark` mode could also apply under `@media (prefers-color-scheme: dark)` when a page sets no `data-mode` | **Deferred to GA with dark mode itself** (`core` A396, 2026-11-17): the Starter plan has no variable modes, so `tokens/modes/` stays empty until then. Decide with the first dark design: CSS-only following needs the media block; a site toggle needs the attribute (DS3), and both can coexist |

## Decided

| Id | Decision | Why |
|---|---|---|
| **DS1** | **`dist/` is committed**, and CI rebuilds it in memory and fails unless it matches the committed files byte for byte (`npm run check:dist`). Closes CLAUDE.md → §5.2's "decide at scaffold" (decided 2026-11-13) | The sites install this repository as a git dependency pinned to a commit (§4). npm builds a git dependency only through a `prepare` script, which would install Style Dictionary into every site's install, so a committed `dist/` is what makes the pin installable as-is. It also puts the exact CSS change in the pull request a reviewer approves, and in the diff a site reviews when it bumps the SHA |
| **DS2** | **Token layout and tiers.** `tokens/primitive/` and `tokens/semantic/` are the base; `tokens/modes/<mode>/` overrides semantic tokens only; any other `*.tokens.json` fails. **A semantic token, and a mode's override, is exactly one alias to a primitive**; primitives alias only primitives. Names are lowercase letters, digits and single hyphens; a name is defined once. **Colours live under `color`, and only colours do.** Declared contrast pairs are `tokens/contrast-pairs.json`, each naming two semantic colours and a `size` (`body` 4.5:1, `large` 3:1, `ui` 3:1). Rules in full: `tokens/README.md` (decided 2026-11-13) | §2's two tiers, made checkable: "a palette change is one alias edit" holds only if a semantic token is never a raw value. One alias per semantic token keeps the tier boundary visible in review. The `color` prefix lets `dist/tokens.json` stay a flat name → value map (§3) and still give the Studio its colour list (A389) |
| **DS3** | **A mode ships as a `[data-mode="<mode>"]` block** after `:root` in `dist/tokens.css`, listing only that mode's overrides as `var()` references to primitives; `dist/tokens.<mode>.json` is the whole set as that mode resolves it (decided 2026-11-13) | §3 allows an attribute or a media-query block. An attribute works for a site toggle and for a scoped region (the style guide shows each mode side by side with it); whether the media query is added too is DS6 |
| **DS4** | **The stack:** Node ≥ 22.12 (as `sanity-studio`), plain ESM JavaScript, `node:test`, and **Style Dictionary 5.8.0**, pinned exactly, as the only dependency — a devDependency, since nothing it pulls in ships. The §5 checks (DTCG validity, contrast, origin, licences) are written here, in `lib/`, rather than taken from further packages. CI runs `npm audit --audit-level=high`, as `sanity-studio` does (decided 2026-11-13) | The checks are short, and each is tested against the failure it exists for (`test/`). Fewer packages means fewer advisories on a repository whose output is plain files. **At scaffold** `npm audit` reports 2 low and 4 moderate advisories, all in Style Dictionary's bundled `deepmerge`, `glob` and `minimatch`, all build-time; they are reviewed when a Style Dictionary release fixes them |
| **DS5** | **Asset rules.** A font ships as **WOFF2 only**, in a folder per family **with its licence file beside it**. Every file under `icons/` is listed in `icons/licences.json` as VT-made or licensed, with the licence file. **A stylesheet's `url()` must be a relative path to a file in this repository** — so a `data:` URL is refused as well as any host. An icon SVG carries no script and no reference outside itself. A token value never names a URL (decided 2026-11-13) | §5.4 forbids a font source "naming a host"; refusing `data:` too means no font or image can enter inline and skip §5.5's licence check |
| **DS7** | **A typography token ships as one CSS custom property per field** — `--type-body-font-family`, `--type-body-font-size`, `--type-body-font-weight`, `--type-body-line-height`, `--type-body-letter-spacing` — not as a `font` shorthand. `dist/tokens.json` keeps it as one entry. A typography token holds DTCG's five fields only (decided 2026-11-13) | Found at scaffold: Style Dictionary's shorthand cannot carry letter spacing and warns, which the build treats as an error, so the first real type token would have failed the build. A site sets `letter-spacing` from its own property; nothing is dropped. A field outside DTCG's five would have become a property no browser reads |

## Recorded for later

- **The import (`npm run import`, CLAUDE.md → §2) is not written.** It is built against the first
  real export, since its normalising and conflict report are defined by what Figma emits.
- **The first release** is `design-v0.1.0`, tagged by a human once the first token set lands.
