# @spin/theme

Design tokens: DTCG JSON in, token trees and CSS custom properties out. Zero
runtime dependencies.

## Exports

`@spin/theme` is the value layer; `@spin/theme/base` is the document a theme
makes before any component exists; `@spin/theme/themes` is the shipped starter
set; `@spin/theme/theme-types` the generated token types.

```
@spin/theme
  parse        parseTokens · parseDocument · isTokenType
  resolve      resolveAliases · indexTree · lookupNode · cssVarName · detectCycles · aliasTarget
  validate     validateTokens · validateLegibility · everyTokenTypeIsDecided
  author       setToken · removeToken · renameToken · treeToJson · scaffoldTheme
  emit         generateCss · generateThemeCss · generateTypes
  contract     BASE_ROLES · ELEMENT_ROLES · requiredPaths · themeSchema · spinThemeJsonSchema
  colour       parseColor · formatHex · isColor · mixColors · generateScale · invertColor · contrastRatio · relativeLuminance · CSS_WIDE_COLORS
  uno          themeRef · themeKey
  procedures   themeContract · themeRouter

@spin/theme/base
  basePreflights · PreflightProvider · documentDefaults · readFonts · fontFaces

@spin/theme/themes
  silkTheme · neobrutTheme · consoleTheme · spinTheme · starterThemes · themeModes · supportsDark

@spin/theme/theme-types
  ThemeTokens · ThemeTokenPath · ThemeCssVar
```

Every entry point is total. `parseTokens` returns `{ ok: false, error }` rather
than throwing; mutations return `{ ok }` unions.

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

## Development

```
deno task test     # the token pipeline's own suite
deno task schema   # regenerate schema.json from the role declarations
```
