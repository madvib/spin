# @spin/theme

Design tokens: DTCG JSON in, token trees and CSS custom properties out. Zero
runtime dependencies.

## Exports

Two entries. `@spin/theme` is the value layer; `@spin/theme/base` is the
document a theme makes before any component exists.

```
@spin/theme
  parse        parseTokens · parseDocument · isTokenType
  resolve      resolveAliases · indexTree · lookupNode · cssVarName · detectCycles
  validate     validateTokens · validateLegibility
  author       setToken · removeToken · renameToken · treeToJson · scaffoldTheme
  emit         generateCss · generateThemeCss · generateTypes
  contract     BASE_ROLES · requiredPaths · themeSchema · spinThemeJsonSchema
  colour       parseColor · formatHex · mixColors · generateScale · contrastRatio
  procedures   themeContract · themeRouter

@spin/theme/base
  basePreflights · PreflightProvider · documentDefaults · readFonts · fontFaces
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
deno task test     # 384 passing
deno task schema   # regenerate schema.json from the role declarations
```
