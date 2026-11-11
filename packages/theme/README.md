# @spinjs/theme

The value layer: DTCG parsing, alias resolution, the six-gate validator,
design languages, and runtime facets. Zero workspace dependencies — every other
package reads values from here.

```ts
import { designLanguages, parseTokens, validateTheme } from "@spinjs/theme";

const report = validateTheme(text);
```

## Subpaths

- `@spinjs/theme` — parsing, validation, composition, design languages (`designLanguages`), facets (`demoPalettes`, `demoSpacings`), and brand procedures.
- `@spinjs/theme/base` — the base document layers and preflights.
- `@spinjs/theme/theme-types` — shared token and document types.
