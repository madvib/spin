Spin replaces the patchwork of utility frameworks, component libraries, and ad-hoc stylesheets with one closed, verifiable UI system built for both humans and coding agents.

## Utility-only UI drifts. Spin holds by construction.

In an open-ended utility framework, a bare `<button>`, `<input>`, or `<h1>` is an unstyled box. Every screen re-declares a dozen utilities just to render a control — and when the next teammate or AI coding agent touches another route, padding, radii, or dark-mode ink quietly drift apart.

Spin flips the ownership model so the design system holds by construction:

- **Shape your brand in the Studio.** Open the visual editor, pick one of six design languages as your starting point, and tune colors, type, spacing, and modes until the preview reads like your product. What you save becomes the `spin/<brand>/` directory your build serves — never locked to a canned theme.
- **Semantic HTML arrives styled.** Native tags (`<button>`, `<input>`, `<select>`, `<table>`, `<dialog>`, headings) and Spin surfaces (`<card>`, `<badge>`, `<alert>`) come finished out of the box. Reach for a variant (`.primary`, `.secondary`, `.ghost`, `.danger`) when one control plays a different role, or change the token once so every screen updates together.
- **Utilities stay for layout.** Spend `flex`, `grid`, `gap-4`, and `p-6` to arrange elements and style plain containers. Every class resolves against your brand; a class your brand cannot produce emits nothing and fails loudly instead of shipping dead styles.
- **Copy components for complex interaction.** When a widget needs keyboard navigation, focus management, and orchestrated state — a select, combobox, tabs, menu, or date picker — copy its tested template into your repo and drive it from Solid, React, Vue, Svelte, or plain HTML.
- **Guardrails catch mistakes automatically.** Lints verify templates against your live brand while you edit, the build refuses unknown classes and unreadable color pairings, and your coding agent reads the same tokens through the MCP server — so drift gets caught before it ships, not in review.
