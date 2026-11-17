# Design system — the single source of design truth for the two public sites

**This file bootstraps a separate repository**, `verdanttongues/design-system`. It is the design
for the design tokens both public sites build from — the [marketing site](marketing-site.md) and
the [documentation site](documentation-site.md) — and that the [Sanity Studio](sanity-studio.md)
reads for its theme-colour choices: where design is made, how it enters the repository, what the
repository produces, and how the sites take it. Copy it into the new repository as `CLAUDE.md`,
and [`design-system.env.example`](design-system.env.example) beside it as `.env.example`
([A382](decisions.md)).

**Links in this file point into `core`'s `docs/`** and do not resolve in the design-system
repository.

**Claude Code setup ([A378](decisions.md)).** This file becomes the new repository's `CLAUDE.md` and
stays its master: edit it here and re-copy it byte-identical, never edit the copy
([A382](decisions.md)). Commit a `.claude/settings.json` holding `core`'s git deny list and the
`vt-shared` plugin entries ([local-setup.md](local-setup.md) → §9; [A379](decisions.md)) beside this
repository's own rules — here, a deny on `Read`, `Edit` and `Write` of `./.env`, so a session never
holds `FIGMA_ACCESS_TOKEN` (§6). Launch Claude inside this repository; to follow a link into `core`, run
`claude --add-dir ../core`. Commit a `design-system.code-workspace` listing `.` first and `../core`
second.

**Decided 2026-11-13 ([A388](decisions.md)); the repository was created and scaffolded the same
day**: the build, the §5 checks and CI exist, with no tokens, fonts or icons in them. The Figma file
does not exist yet: the pipeline below is decided and built, the first design is not. **The
repository's own decisions** — its token layout, mode selector and stack — are `DS<n>` rows in its
`docs/decisions.md`, never here.

## 0. What is already fixed

1. **This repository is the source of design truth.** Not Figma, not Sanity, not either site. A
   value both sites render — a colour, a type size, a spacing step, a shadow, a font file, an icon —
   is defined here once, in a reviewed change, and nowhere else.
2. **Design happens in Figma, and flows one way: Figma → this repository → the sites.** A decided
   design change in Figma becomes a pull request here. Figma is never written back to by this
   repository, and a value edited only in Figma is not shipped until it arrives here.
3. **Sanity holds no design** ([A386](decisions.md)). No stylesheet, script, font or icon field
   exists in the Studio. The Studio *reads* this repository's colour tokens so the theme-colour
   field can only name a brand colour ([A389](decisions.md)).
4. **Everything ships in each site's own bundle, same-origin.** `/register`, `/claim` and
   `/connected` load no third-party origin under their CSP ([marketing-site.md](marketing-site.md)
   → §6.1), so no font CDN, no remote stylesheet and no `url()` to another host — on any page, so the
   rule never needs a per-page exception.

## 1. The pipeline

```
Figma (Variables, text and effect styles)
  ├─ A: built-in variable export (DTCG JSON)  ──┐
  ├─ B: REST API read (styles, descriptions,    ├─► scripts/import → tokens/*.tokens.json (DTCG) ─► PR, review
  │     which values the frames use)            │                         │
  └─ C: screenshots — findings only, never values┘                        ▼
                                                     Style Dictionary build (CI)
                                                       ├─ dist/tokens.css      CSS custom properties
                                                       ├─ dist/tokens.json     flat values (Studio, tests)
                                                       ├─ fonts/, icons/       self-hosted assets
                                                       └─ style guide          generated documentation
                                                                  │
                         marketing-site · documentation-site · sanity-studio
                         install it as a git dependency pinned to a commit SHA
```

## 2. Importing from Figma — three sources, one precedence

| Source | What it gives | Role |
|---|---|---|
| **A — Figma's built-in variable export (DTCG JSON)** | Every variable in a collection: exact values, names, groups, aliases, modes | **Primary.** Values come from here first |
| **B — Figma's REST API, scripted** | Text styles (family, weight, size, line height, letter spacing), effect styles (shadows, blur), descriptions, and which values the frames actually use | **Fills A's gaps.** Typography and effects are usually Figma *styles*, not variables, so A lacks them; A's export also drops descriptions |
| **C — Screenshots** | How the design looks: colours used, contrast in place | **Findings only, never values.** Sampled colours are approximate (compression, colour profiles) |

**Rules:**

1. **A value comes from A, or from B where A has none — never from C.**
2. **A disagreement between sources is reported, never averaged.** The import writes a conflict
   report to the pull request; a human picks the value.
3. **C produces findings**: a colour in the design that no token holds, a token no frame uses, a
   pair that fails contrast as rendered.
4. **The import normalises before it commits**: strips `$extensions.com.figma` (Figma's ids and
   scopes), restores descriptions from B, and renames to this repository's token naming. The
   committed `tokens/` files are DTCG and readable without Figma.
5. **Re-importing into Figma is not relied on.** Figma's DTCG import has reported failures; Figma
   is kept in step by a designer, not by a round trip.

**Two token tiers.** *Primitive* tokens are the palette and scales (`color.green.600`, `space.4`).
*Semantic* tokens name a use and alias a primitive (`color.text.default`, `color.surface.brand`).
Sites style with semantic tokens only, so a palette change is one alias edit.

**The Figma file is shaped so its export needs no renaming** ([A396](decisions.md) for the plan):

| In Figma | Holds | Becomes |
|---|---|---|
| Variable collection **`primitive`** | The palette and scales as raw values: `color/green/600`, `space/4` (number, px) | `tokens/primitive/` |
| Variable collection **`semantic`** | Uses, **each an alias of a primitive variable**, never a raw value, each with a description: `color/text/default` | `tokens/semantic/` |
| Text styles `type/<name>`; effect styles `shadow/<name>` | Typography (family, size, weight, line height, letter spacing only — DS7) and shadows; read by B | `tokens/primitive/` |
| A **Contrast pairs** frame on the Semantic page | Each text-on-background pair a site renders, and its size (body, large, UI) | `tokens/contrast-pairs.json`, copied at import |
| The **Icons** page | Favicon, app icons, logo marks as vector frames, each marked VT-made or licensed | `icons/` and `icons/licences.json` |

Names are lowercase letters, digits and single hyphens, grouped by `/`; **colours sit under
`color/` and nothing else does**; a semantic name says its use, never its colour
(`color/surface/default`, not `color/surface/white`), so a later mode re-points aliases and renames
nothing ([A396](decisions.md)). One file holds the design system.

## 3. What this repository produces

- **`dist/tokens.css`** — every token as a CSS custom property on `:root`, with each mode (e.g.
  dark) as a `[data-mode="<mode>"]` block of its overrides (DS3). Each site imports it into its own
  CSS, so it is bundled and hashed with the site. **Until GA there is no mode**: both sites ship
  light only, and dark mode is a GA deliverable ([A396](decisions.md)), since the Starter plan has
  no variable modes.
- **`dist/tokens.json`** — flat name → value, for the Studio's theme-colour list and for tests; one
  `dist/tokens.<mode>.json` per mode. **`dist/` is committed** (§5.2).
- **`fonts/`** — self-hosted WOFF2 files and their `@font-face` rules, with each font's licence
  file beside it. **A font's licence must allow self-hosting and embedding in a website**, and is
  an item under [L20](decisions.md) (third-party licences) before the first font ships.
- **`icons/`** — the favicon set, the app icons and the logo marks. Sites copy them into their
  build output; they are never served from Sanity's CDN.
- **The style guide** — a static page generated from the tokens: colour swatches with the contrast
  of each declared text/background pair, the type scale, spacing, shadows, fonts and icons.
  **Internal**: built by CI as an artifact and locally on demand, never deployed to a public host.
  It is the design system's documentation, and it cannot drift from what ships because it is built
  from the same files.

## 4. How the sites and the Studio take it

- **A git dependency pinned to a commit SHA**, e.g.
  `"@verdanttongues/design-system": "github:verdanttongues/design-system#<sha>"` with the release tag
  in a comment — the same rule as pinned actions ([A307](decisions.md)). A design change reaches a
  site only when that site bumps the SHA in a reviewed change.
- **Releases are tagged `design-v<major>.<minor>.<patch>`.** Removing or renaming a semantic token is
  a major release.
- **The marketing site and the docs site** import `dist/tokens.css` and the `@font-face` rules,
  and copy `icons/`. Neither defines a colour, size or font of its own outside its components'
  use of tokens.
- **The Studio** imports `dist/tokens.json` to build the theme-colour list ([A389](decisions.md)).
  It ships nothing visual from here.

## 5. What its CI owes

Pin every workflow `uses:` to a commit SHA ([A307](decisions.md)).

1. **Valid DTCG.** Every file under `tokens/` parses, every alias resolves, no cycle.
2. **The build is reproducible.** **`dist/` is committed**, and CI rebuilds it and fails unless it
   matches byte for byte (`npm run check:dist`). Decided at scaffold (DS1): a git dependency pinned
   to a commit installs without building, and the CSS a change ships is in its diff.
3. **Contrast.** Every declared text/background pair meets **WCAG 2.2 AA** (4.5:1 body, 3:1 large
   text and UI), in every mode. A failing pair fails the build.
4. **No other origin.** Fail on any `@import`, `url()` or font source naming a host. Fonts and icons
   are files in this repository.
5. **Licences present.** Every font file has its licence file; every icon is VT-made or licensed.
6. **The style guide builds** and is uploaded as an artifact.

## 6. Secrets

- **`FIGMA_ACCESS_TOKEN`** — a Figma personal access token, **read-only**, for source B. It lives in
  the developer's uncommitted `.env` only: **never in CI, never committed, never in a session that
  writes it into a file.** The import runs on a developer's machine and opens a pull request with
  its output; CI builds from the committed tokens and needs no Figma access.
- Nothing in this repository is a secret otherwise: tokens, fonts and icons are published in both
  sites' bundles.

## 7. Legal

Figma holds VT's own design work and VT staff accounts — the same shape as Sanity
([L32](decisions.md)): no customer or data-subject data. **Never put customer material, analysis
output or a real person's image into the Figma file**; that would reopen the question for Figma as
L32's events reopen it for Sanity. Font licences are [L20](decisions.md)'s.

## 8. Status and open items

- **The Figma file does not exist yet.** The first design produces the first export (A) and read (B).
- **The Figma plan is Starter** (recorded 2026-11-17, [A396](decisions.md)): no variable modes,
  one team, one folder, three files. The seat type is not recorded. Source B's styles and file
  endpoints work on any plan; Figma's Variables REST endpoints are Enterprise-only and are not
  relied on, since A covers variables. **Unconfirmed: whether Starter can export variables to
  JSON (A)** — Figma's help states no per-plan rule; checked at the first export, and if it cannot,
  the fallback is decided then.
- **The typefaces** are not chosen; each needs its licence checked under L20 first.
- **The repository is scaffolded** (2026-11-13) with no design in it: the build, the §5 checks
  and CI run over an empty `tokens/`, `fonts/` and `icons/`. **The import (§2) is not written** — it
  is built against the first real export. No release is tagged; the first is `design-v0.1.0`, once
  the first token set lands. Neither site is scaffolded.

## Commands

Verified at scaffold, except `import`, which is not written yet.

```sh
npm run build        # every check, then Style Dictionary → dist/ (commit what it writes)
npm test             # DTCG validity, contrast, no other origin, licences, and the build's own tests
npm run check:dist   # fails unless the committed dist/ equals a fresh build — CI runs it
npm run styleguide   # the generated style guide → build/styleguide/index.html
npm run import -- --file <figma-file-key> --export <path-to-dtcg-export.json>
                     # NOT WRITTEN: A + B → tokens/, plus the conflict report; needs FIGMA_ACCESS_TOKEN
```
