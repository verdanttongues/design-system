# icons/

The favicon set, the app icons and the logo marks (CLAUDE.md → §3). Sites copy them into their
build output; they are never served from Sanity's CDN.

- **Every file here is listed in `licences.json`**, keyed by its path under `icons/`:
  `{ "source": "vt" }` for VT-made, or `{ "source": "licensed", "licence": "<path under icons/>" }`.
  An unlisted file, a listed file that is missing, or a missing licence fails `npm test`.
- **An SVG is self-contained**: no `<script>`, and no `href` or `url()` other than to a fragment
  (`#id`) in the same file.
