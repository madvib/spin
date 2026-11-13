# @spinjs/diagnostics

The checks: the six `spin/*` rules, the lint service, and the editor plugins.
The core decides what is wrong; oxlint, ESLint, and the LSP deliver
the same answer.

```ts
import { lint } from "@spinjs/diagnostics";

const report = await lint("src/");
```

```jsonc
// .oxlintrc.json
{ "jsPlugins": ["@spinjs/diagnostics"] }
```

```js
// eslint.config.js
import spin from "@spinjs/diagnostics/eslint";
```

## Subpaths

- `@spinjs/diagnostics` — rules, service, corpus, facts, and the oxlint
  plugin (the default export).
- `@spinjs/diagnostics/eslint` — the flat-config ESLint plugin: the same
  six rules under the same names.
