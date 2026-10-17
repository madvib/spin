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
  contract     BASE_ROLES · requiredPaths · themeSchema · spinThemeJsonSchema
  colour       parseColor · formatHex · isColor · mixColors · generateScale · invertColor · contrastRatio · relativeLuminance · CSS_WIDE_COLORS
  uno          refFamilies · refFamilyFor · themeRef · REF_SPECS
  procedures   themeContract · themeRouter

@spin/theme/base
  basePreflights · PreflightProvider · documentDefaults · readFonts · fontFaces

@spin/theme/themes
  defaultTheme · neobrutTheme · consoleTheme · starterThemes · themeModes · supportsDark

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

A theme may declare `$extensions.spin` with `id`, `modes`, `components` and
`fonts`. `parseTokens` returns tokens only; `parseDocument` returns tokens and
extensions together.

## Stages

`parse → resolve → validate → emit`. Each stage is independent and can be
entered on its own. Aliases emit as `var(--token)`, never inlined, so switching
themes is a selector swap.

## Development

```
deno task test     # 114 passing (count pending orchestrator refresh)
deno task schema   # regenerate schema.json from the role declarations
```
