# @spin/theme

Design tokens: DTCG JSON in, token trees and CSS custom properties out. Zero
runtime dependencies.

## Exports

`@spin/theme` is the value layer; `@spin/theme/base` is the document a theme
makes before any component exists; `@spin/theme/themes` is the shipped starter
set; `@spin/theme/skill` is the house skill, assembled from the contract; and
`@spin/theme/theme-types` the generated token types.

```
@spin/theme
  parse        parseTokens · parseDocument · isTokenType
  resolve      resolveAliases · indexTree · lookupNode · cssVarName · detectCycles · aliasTarget
  validate     validateTokens · validateTheme · validateLegibility · everyTokenTypeIsDecided
  author       setToken · removeToken · renameToken · treeToJson · scaffoldTheme
  emit         generateCss · generateThemeCss · generateTypes
  contract     BASE_ROLES · ELEMENT_ROLES · requiredPaths · themeSchema · spinThemeJsonSchema
  groups       contractGroups · documentGroups · themeGroups
  colour       parseColor · formatHex · isColor · mixColors · generateScale · invertColor · contrastRatio · relativeLuminance · CSS_WIDE_COLORS
  uno          themeRef · themeKey
  procedures   themeContract · themeRouter

@spin/theme/base
  basePreflights · PreflightProvider · documentDefaults · readFonts · fontFaces

@spin/theme/themes
  silkTheme · neobrutTheme · consoleTheme · spinTheme · starterThemes · themeModes · supportsDark · starterGroups

@spin/theme/skill
  renderSkill

@spin/theme/theme-types
  ThemeTokens · ThemeTokenPath · ThemeCssVar
```

Every entry point is total. `parseTokens` returns `{ ok: false, error }` rather
than throwing; mutations return `{ ok }` unions.

## The house skill

`skill/SKILL.md` is the module's manual: the order of the work, the gates, and
what each failure means. It is a product — agents install it and follow it — so
it lives with the language it describes, and the checklist it carries is emitted
rather than written down.

`renderSkill(template)` assembles the file: the groups it walks are the ones the
contract knows, in the order a theme document reads them, each with the guidance
the file carries for it. A group added to the contract is in the file without
anyone editing prose, and the site that serves the file reads the same bytes.

The order of the sections on disk is not the order that ships — the module emits
it — so moving a section there does not move it in the file an agent installs.

## Contract

A theme declares tokens under a closed set of `$type` values (`TOKEN_TYPES`). A
token with an unrecognised `$type` is a parse error naming every valid type.

A theme must declare the base roles (`BASE_ROLES`). Each carries its DTCG type,
the placeholder a scaffold writes, its documentation, and any contrast floor it
owes. `requiredPaths()`, `themeSchema()` and `scaffoldTheme()` derive from that
one declaration.

A theme may also declare the per-element groups (`ELEMENT_ROLES`): the decisions
one element owns — the card's corner, the alert's air, the field's edge, the
number a stat shows, the rule under a table row, the underline under a link.
They are optional, and a rule that finds one missing falls back to the shared
scale it would otherwise wear.

A theme may declare `$extensions.spin` with `fonts` (the faces the sheet loads)
and `components` (the primitives the studio previews). `parseTokens` returns
tokens only; `parseDocument` returns tokens and extensions together.

The root `modes` field says which modes the theme SERVES. A mode it serves but
does not override falls back to the base values, so a dark-only theme whose base
is already dark is a complete theme.

## Stages

`parse → resolve → validate → emit`. Each stage is independent and can be
entered on its own. Aliases emit as `var(--token)`, never inlined, so switching
themes is a selector swap.

## Judging a document

`validateTheme(text, options?)` is the operation over a whole document: it
parses the text, checks the tree against the roles the document owes, and
measures the contrast floors, then answers with the tree, the problems and the
verdict. It is the one answer to "is this theme valid" — a studio's issues panel
and the daemon's `theme.analyze` ask the same operation, so they cannot say
different things about one document.

The options are the caller's facts, not the module's guesses:

- `required` — the paths the document must declare. Absent: the base roles.
- `modes` — the modes the document **serves**. Absent: the caller makes no
  claim, so no override is judged dead. Existence cannot say what is served.
- `mode` — the mode the document is judged **in**. Absent: the base values. A
  theme is a different document in dark, and the floors are measured where the
  theme is read.

## Development

```
deno task test     # the token pipeline's own suite
deno task schema   # regenerate schema.json from the role declarations
deno task skill    # print the house skill, assembled from the contract
```
