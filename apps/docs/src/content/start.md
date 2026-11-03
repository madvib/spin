Spin replaces the patchwork of utility frameworks, component libraries, and ad-hoc CSS files with one closed, verifiable system.

When humans or coding agents build UI against an open-ended styling layer, every screen drifts: 15-class utility strings on every button, arbitrary hex values, duplicated dropdowns, and bloated client bundles. Spin constrains the surface so only on-brand, zero-bloat code can ship:

- **One theme file (`spin/*.json`).** Palette roles (light and dark), typography, spacing steps, corner radii, shadows, and motion live in one JSON document. Tune them live in the [Studio](/studio) or edit JSON directly.
- **Closed-scale utilities (`spin/styles.css`).** Layout shortcuts (`stack`, `row`, `split`, `cluster`) and token-backed utilities (`p-4`, `gap-2`, `bg-surface-raised`) resolve strictly against your theme. Arbitrary values (`w-[320px]`, `bg-[#ff0000]`) emit zero CSS and fail `spin lint`.
- **Styled HTML elements (`primitives`).** Native tags (`<button>`, `<input>`, `<select>`, `<table>`, `<dialog>`) and Spin surfaces (`<card>`, `<badge>`, `<alert>`) arrive styled by the theme (`classless: true` by default).
- **Compiled interactive components (`@spinjs/components`).** Need a select, combobox, tabs, or date picker? Copy the `.html` template into your repo (`npx spin component copy select basic`). Spin compiles it into a lightweight custom element backed by a state machine — portable across Solid, React, Vue, Svelte, or plain HTML.
