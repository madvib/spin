# @spinjs/preset

The Uno renderer: `spinPreset`, the utility vocabulary, the primitives, and
the engine answers the checker reads. Theme in, CSS out — no sibling areas.

```ts
import { spinPreset } from "@spinjs/preset";

export default {
  presets: [spinPreset({ themes })],
};
```

## Subpaths

- `@spinjs/preset` — the preset, catalog, organization, and answers.
- `@spinjs/preset/elements` — generated custom-element declarations (the DOM map every framework reads).
- `@spinjs/preset/elements/react`, `/solid`, `/svelte`, `/vue` — the per-framework module augmentations over the same tags.
- `@spinjs/preset/css` — CSS helpers for variable naming and scoping.
