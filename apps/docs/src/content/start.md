Spin keeps your interface decisions in one theme file and makes the whole
web surface obey them — every page, every app, every framework.

You write the decisions once — color, type, spacing, radius, motion — as a JSON
theme. Spin turns that theme into the CSS, the styled HTML elements, the
utilities, and the interactive components your interfaces are built from. Change
the theme and everything follows.

## One brand across every stack

A company's web surface is never one stack. The marketing site is Astro, the
dashboard is React, the admin console is Solid, the docs are something else —
and each one drifts toward its own look, its own button, its own spacing.

Spin is the answer to that drift. The theme is the brand, stated once in
`spin/*.json`. From it Spin generates one stylesheet: native elements
(`<button>`, `<input>`, `<table>`, `<dialog>`) that arrive styled, utilities
for layout and the decisions the elements leave open, and compiled interactive
components that drop into any page as standard custom elements. React, Solid,
Vue, Svelte, Astro, or plain HTML — every stack reads the same tokens and wears
the same brand, across all eight supported bundlers (`Vite`, `Rspack`,
`webpack`, `Rollup`, `Rolldown`, `esbuild`, `Bun`, and the `UnoCSS` preset).

## Compiled components, fine-grained runtime

Interactive components are authored once in clean HTML plus TypeScript —
`lib/components/select.html` — and compiled into fast, zero-framework custom
elements (`<app-select>`) backed by signals and statecharts. There is no
framework runtime in the middle: the component is a DOM element any host can
mount, driven from React, Solid, or vanilla DOM through typed controllers.

When a piece needs behavior you do not write, the components package supplies
it: thirty-seven headless statechart machines — comboboxes, date pickers,
carousels, menus, dialogs, and the rest — each with a copyable `.html`
template you own and restyle through the theme.

## The three packages

| Package | Install as | What it is |
| --- | --- | --- |
| `@spinjs/spin` | devDependency | The bundler plugins (Vite, Rspack, webpack, Rollup, Rolldown, esbuild, Bun), the UnoCSS preset, the `.html` component compiler, the theme engine, the Studio, the CLI, the lint plugins, and the MCP server. |
| `@spinjs/components` | dependency | The 37 statechart machines and platform controllers, with React, Solid, and DOM adapters. |
| `@spinjs/runtime` | dependency | The signals, template directives, element actions, and finite-state machine interpreter the components run on. |

Install all three together; they are released in lockstep:

```bash
npm install -D @spinjs/spin
npm install @spinjs/components @spinjs/runtime
```

## What you get

- **One theme.** A JSON document per look, with light and dark values on the
  same tokens.
- **Styled elements.** Native HTML arrives finished; no class required.
- **A closed utility set.** Spacing, color, type, and layout come from the
  theme. A value the theme does not declare generates no CSS.
- **Compiled components.** Headless machines plus the `.html` templates you
  copy, own, and mount anywhere.
- **Tools.** A lint pass, an MCP server for agents, browser checks, and a
  Studio for editing the theme against a live page.
