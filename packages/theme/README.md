# @spinjs/theme

The value layer: DTCG parsing, alias resolution, the six-gate validator, and
the six starter themes. Zero workspace dependencies — every other package
reads values from here.

```ts
import { parseTokens, starterThemes, validateTheme } from "@spinjs/theme";

const report = validateTheme(text);
```

## Subpaths

- `@spinjs/theme` — parsing, validation, composition, brand procedures.
- `@spinjs/theme/themes` — `starterThemes`: minimal, editorial, material,
  neobrutalist, neumorphic, glassmorphic.
- `@spinjs/theme/base` — the base vocabulary the starters layer over.
- `@spinjs/theme/theme-types` — shared token and document types.
