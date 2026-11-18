# Figma exports — what Figma writes, what the import does, and how to export

Source A (CLAUDE.md → §2) is Figma's built-in variable export, **downloaded by hand and handed to
the import unchanged**. This file records what that export actually contains, as observed, and the
practices that keep an import clean. `npm run import` is written against it.

**Observed 2026-11-18** from three test exports of Figma kit content (`Dimensions`, `Font theme`,
`Color`) and one alias test from VT's own file (`Primitive`, `Semantic`, one variable each); none
is VT's design. Re-check this file when Figma changes its export.

## 1. What Figma writes

| Aspect | Observed |
|---|---|
| **Delivery** | One `.zip` per collection, **named after the collection** (`Color.zip`). Two layouts seen: the files at the zip's root (`Color`, `Font theme`), or inside one folder named after the collection (`Dimensions/`) |
| **Files** | One `<mode name>.tokens.json` per mode (`SDS Light.tokens.json`). The mode name is also at the root, as `$extensions["com.figma.modeName"]` |
| **Collection name** | **Only in the zip's name** (or its one folder). Nothing inside a file names its collection |
| **Names** | Figma's own, unchanged: capitals, spaces, `+` (`App Icon W+D`, `Padding Top + Bottom`). A `/` in a variable name becomes a nested group |
| **Colour** | `$type: "color"`, a DTCG object: `{ colorSpace: "srgb", components: [r, g, b] (0–1), alpha, hex: "#RRGGBB" }` |
| **Number** | `$type: "number"`, **no unit**. Sizes, radii, font sizes and spacing all arrive this way |
| **String** | `$type: "string"` — not a DTCG type. Font families (`"Roboto"`) and weight names (`"SemiBold"`) arrive this way |
| **Precision** | 32-bit float noise: `alpha: 0.800000011920929`, `25.33300018310547` |
| **Alias within a collection** | `"{Status Bar.Height}"` — a DTCG alias, Figma's names, dot-separated |
| **Alias into another collection** | **Not a DTCG alias.** `$value` holds a *copy* of the target's value, and the alias exists only in `$extensions["com.figma.aliasData"]`: `targetVariableName` (`"Neutral/0"`) and `targetVariableSetName` (`"Primitive"`), plus ids. **The target id does not match the target's own `com.figma.variableId`** in its collection's file, so only the collection and name identify it |
| **Descriptions** | **Exported** as `$description` when set (`Color`). *(Corrected in CLAUDE.md → §2 by `core` A398.)* An aliased variable's description is exported too (`Surface/Default`, re-exported) |
| **Figma metadata** | Flat keys under `$extensions`: `com.figma.variableId`, `com.figma.scopes` (e.g. `FRAME_FILL`, `STROKE`, `ALL_SCOPES`), `com.figma.codeSyntax`, `com.figma.type`, `com.figma.aliasData`, and `com.figma.modeName` at the root. String variables carried no scopes in the sample |
| **A single-mode collection** | One file, `Mode 1.tokens.json` (Figma's default mode name) |

## 2. What the import does with it

Planned; `npm run import` is not written yet.

1. **Reads the zips as downloaded.** The collection is the zip's name (or its one folder); each
   mode is a file name less `.tokens.json`. Nothing needs renaming or unzipping by hand.
2. **Maps each collection to a tier** through a committed `figma-collections.json`
   (`{ "Color": "primitive", "Semantic": "semantic" }`), so Figma's collection names stay as the
   designer chose them. An unmapped collection is refused, by name.
3. **Refuses a collection with more than one mode** until GA (`core` A396: no modes on Starter, dark
   mode at GA).
4. **Renames to the repository's naming**: each segment lowercased, every run of other characters
   one hyphen (`App Icon W+D` → `app-icon-w-d`); a colour is placed under `color.`. **Two names that
   rename alike are refused**, never merged. Aliases are rewritten to match.
5. **Types from scopes**: a number scoped to corner radius, gap, width/height, stroke, font size,
   line height or letter spacing becomes a `dimension` in px; font weight becomes `fontWeight`;
   opacity stays a `number`. A string scoped to font family becomes `fontFamily`; a weight name
   (`Thin` … `Black`, `SemiBold`) becomes its number (100 … 900). **A number or string with no
   specific scope — including `ALL_SCOPES` — is refused**, since its type would be a guess.
6. **Rebuilds every alias into another collection from `com.figma.aliasData`**, before stripping:
   the target is found by **collection and name** (`Primitive` / `Neutral/0` →
   `{color.neutral.0}`), never by id. A target missing from the export is refused, by name. **The
   copied `$value` is discarded**, but must equal the target's value — a mismatch is reported, never
   resolved by picking one. If the alias were lost, `npm test` would refuse the semantic token
   (*one alias to a primitive*), so a dropped alias cannot ship.
7. **Rounds** to 4 decimal places (`0.8`, `25.333`).
8. **Keeps `$description`**, and keeps a description already in `tokens/` when Figma's is empty.
9. **Strips every `com.figma.*` key** (`npm test` fails on any left over).
10. **Writes `tokens/` and a report** of every rename, conversion, rounding and refusal, for the
   pull request.

## 3. How to export — best practices

**In Figma:**

1. **Export only VT's collections** — never a community kit's.
2. **One mode per collection** until GA.
3. **Give every variable a specific scope** — corner radius, gap, width/height, font size, line
   height, letter spacing, font weight, font family, fill, stroke. `ALL_SCOPES` (the default) is
   refused, because the scope is how a bare number becomes a size.
4. **Font weights as numbers** (`400`, `500`, `600`) where possible; a standard weight name is
   converted, anything else is refused.
5. **Semantic variables are aliases** of primitives, never raw values, and **named for their use**
   (`Surface/Default`, not `Surface/White`), so dark mode at GA re-points them and renames nothing.
6. **Write a description** on each semantic variable — it is exported.
7. **Keep names stable.** Figma's names may use capitals and spaces, but a rename in Figma is a
   rename of the token — a major release for a semantic one. Avoid two names that differ only by
   punctuation or case (`Padding Top + Bottom` / `Padding Top Bottom`).
8. **Round values in Figma** — a fractional value usually comes from a layout, not a decision.

**Handing it over:**

9. **Export every collection, every time**, so a deleted variable shows up as a deletion.
10. **Leave each zip as Figma names it.** Its name is the collection's name.
11. **Put the zips in one folder outside the repository**, e.g. `~/Downloads/figma-export/`, and
    never commit them.
12. **Tell Claude the folder** (or run `npm run import -- <folder>` once it exists), then delete
    the zips once the pull request is merged.

## 4. Still to observe

- **A name clash across collections** (the same name in `Primitive` and `Semantic`) was not
  exported. `aliasData` names the target's collection, so an alias stays unambiguous either way.
- **A typography or shadow variable group** has not been exported yet. Typography and shadows are
  variable groups (`core` A398: text and effect styles are not in the export, and the REST API is
  out), so the first such export settles how the import combines them.

**Settled:** VT's own Starter file exports (2026-11-18; `core` A398 answers A396).
