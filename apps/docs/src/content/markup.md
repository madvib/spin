<!-- USER COPY SLOT: markup-intro — your own markup philosophy, or the default below. -->

# Markup & Elements

Write HTML. The theme dresses it.

Native elements arrive styled with no classes: `<button>`, `<input>`,
`<select>`, `<textarea>`, `<dialog>`, `<details>`, `<table>`, `<fieldset>`,
`<progress>`, `<meter>`, `<hr>`, `<kbd>`, `<label>` — plus type on
`<h1>`–`<h6>`, `<p>`, `<a>`, `<code>`, `<blockquote>`, and `<small>`.

The decisions no native tag owns live in Spin elements: `<card>`, `<alert>`,
`<badge>`, `<stat>`, `<avatar>`, `<breadcrumbs>`, `<join>`, `<prose>`,
`<rating>`, `<skeleton>`, `<icon>`, `<popover>`, `<tooltip>`. They are elements,
not classes — the tag is the whole opt-in.

The rule is the same for both: the element owns its skin, and you spend
utilities on what it does not own.

## TypeScript

The custom tags need declaring once, in a `.d.ts` file in your project.
`@spin/preset` publishes the full tag list from the rules via codegen
(`@spin/preset/elements`, a DOM-global `HTMLElementTagNameMap`), so React,
Svelte, and Vue read the vocabulary with no per-framework file. Solid's `JSX`
namespace is self-contained and does not consult the DOM global, so a Solid
project declares the tags it uses:

```ts
// src/elements.d.ts — the tags this project writes
import "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      card: { variant?: string };
      badge: { variant?: string };
      // ...only what you write; the preset's elements list names the rest
    }
  }
}
```

The elements themselves are framework-agnostic — they are HTML the browser
already styles. The types are the only per-framework seam, and it is one small
file.

## Narrowing the library

The plugin's `primitives` and `classless` options decide how much of the element
library ships, set where you configure the plugin (the same `spin.vite()` call
from the install page):

```ts
spin.vite({
  // primitives: ["button", "card"] — ship a subset; false ships none
  // classless: false — each primitive claims only its own class,
  // so <button> is a button only where you write the class
});
```

`classless: false` is the escape hatch for markup you do not control:
third-party HTML stays unstyled, and your own components opt in by name.

<!-- USER COPY SLOT: markup-close — framework notes (React, Svelte) or migration guidance. -->
