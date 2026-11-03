Spin is a **theme-first UI system and verification layer** for humans and coding agents.

Most UI codebases drift into long utility chains, one-off hex values, and duplicated component styles. Spin flips the model: your visual decisions live in one DTCG theme file (`spin/default.json`), native HTML elements arrive styled automatically, and the compiler and linter mechanically reject anything outside the theme.

## How Spin works

1. **One theme owns the look (`spin/*.json`).** Palette roles (light and dark), typography, spacing steps, corner radii, shadows, and motion live in one JSON file. Tune them visually against your live app in the [Studio](/studio) or edit the JSON directly.
2. **HTML elements arrive styled.** Write `<button class="primary">`, `<input>`, `<select>`, `<table>`, `<dialog>`, or `<card>`. Elements read your theme tokens directly — no 15-class utility strings just to render a button or input.
3. **Closed-scale layout utilities.** Use layout shortcuts (`stack`, `row`, `split`, `cluster`) and token-backed utilities (`p-4`, `gap-2`, `bg-surface-raised`) for composition. Arbitrary values (`w-[320px]`, `bg-[#ff0000]`) emit zero CSS and fail `spin lint`.
4. **Owned interactive components.** Need a select, combobox, tabs, or date picker? Copy the template into your repo (`npx spin component copy select basic`). Spin compiles `lib/components/**/*.html` into custom elements backed by tested state machines.

## Packages

| Package | Role |
| --- | --- |
| `@spinjs/spin` (`devDependency`) | Bundler plugins (`spin.vite()`, etc.), UnoCSS preset, `.html` component compiler, Studio, CLI, linter, and MCP server. |
| `@spinjs/components` (`dependency`) | 37 headless statechart machines and controllers with Solid, React, Vue, Svelte, and DOM adapters. |
| `@spinjs/runtime` (`dependency`) | Fine-grained signals, template directives, and statechart interpreter powering compiled components. |
