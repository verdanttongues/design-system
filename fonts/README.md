# fonts/

Self-hosted fonts and their `@font-face` rules (CLAUDE.md → §3). Sites import
`@verdanttongues/design-system/fonts.css` and bundle the files it names.

- **One folder per family**, e.g. `fonts/<family>/`, holding its `.woff2` files and **its licence
  file** (`LICENSE`, `OFL.txt`, …). A `.woff2` with no licence beside it fails `npm test`.
- **WOFF2 only.** `.woff`, `.ttf`, `.otf` and `.eot` fail.
- **A font's licence must allow self-hosting and embedding in a website**, and is checked under
  `core`'s L20 before the font is committed.
- **`fonts.css`** holds the `@font-face` rules. Every `url()` is relative to it and names a file in
  this folder; `@import` and any other origin fail `npm test`.
