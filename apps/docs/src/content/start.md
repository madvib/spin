Spin gives web teams one coherent UI layer: a visual Studio for your design tokens, styled native HTML elements, Tailwind-compatible layout utilities, 38 accessible interactive components across React, Solid, Vue, Svelte, and HTML, and static checks that keep humans and AI coding agents consistent.

## What ships in Spin

Most codebases stitch together a CSS utility library, a headless widget kit, a hand-rolled theme file, and review comments trying to keep colors and dark mode consistent across screens. Spin unifies those pieces without locking you into a rigid component black box:

- **Visual Theme Studio.** Click the floating **Studio** button in the corner of your running dev app to pick a starting design language, tune colors, fonts, radii, and spacing against your live UI, and save clean JSON files to git.
- **Styled native HTML.** Standard tags (`<button>`, `<input>`, `<select>`, `<dialog>`, `<table>`, `<h1>`–`<h6>`) and lightweight custom elements (`<card>`, `<badge>`, `<alert>`) work out of the box with built-in variants (`.primary`, `.secondary`, `.ghost`, `.danger`).
- **Tailwind-familiar layout utilities.** Arrange screens with `flex`, `grid`, `gap-4`, `p-6`, `bg-surface`, and `rounded-md`. Unknown classes and hardcoded hex values are caught immediately instead of failing silently.
- **Copy-and-own interactive components.** Scaffold accessible selects, comboboxes, menus, tabs, dialogs, and date pickers directly into your repository and bind them in React, Solid, Vue, Svelte, or plain HTML.
- **Editor lints and MCP server.** Built-in lint rules catch unreadable contrast pairs and broken overrides as you type, and the included MCP server gives Claude Code, Cursor, and other agents live access to your project's tokens and components.
