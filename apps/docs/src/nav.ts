/**
 * Explicit five-track navigation for the documentation site.
 *
 * Ordered by reader workflow:
 * 1. Overview — what Spin is, why it exists, and how the four layers fit.
 * 2. Start — installing packages, authoring markup, and CSS/UnoCSS/wind4 edges.
 * 3. Themes & Studio — DTCG token contract, modes, Studio workflow, gates, schema, starters, styles.
 * 4. Elements & Utilities — classless/custom element contracts and the closed utility catalog.
 * 5. Tooling — source lints and dials, Playwright browser checks, and MCP server tools.
 */

export interface NavItem {
  readonly title: string;
  readonly href: string;
}

export interface NavTrack {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_TRACKS: readonly NavTrack[] = [
  {
    label: "Overview",
    items: [{ title: "Why Spin", href: "/why" }],
  },
  {
    label: "Start",
    items: [
      { title: "Install & Wiring", href: "/guide/install" },
      { title: "Markup & Elements", href: "/guide/markup" },
      { title: "CSS & Edges", href: "/guide/css" },
    ],
  },
  {
    label: "Themes & Studio",
    items: [
      { title: "Theme Contract & Modes", href: "/themes" },
      { title: "Using the Studio", href: "/themes/studio" },
      { title: "Authoring & Gates", href: "/themes/authoring" },
      { title: "Token Schema", href: "/themes/schema" },
      { title: "Starters", href: "/themes/starters" },
      { title: "Style References", href: "/themes/styles" },
    ],
  },
  {
    label: "Elements & Utilities",
    items: [
      { title: "Element Library", href: "/components" },
      { title: "Utilities & Scales", href: "/utilities" },
    ],
  },
  {
    label: "Tooling",
    items: [
      { title: "Lints & Dials", href: "/tooling/lints" },
      { title: "Browser Checks", href: "/tooling/check" },
      { title: "MCP & Agents", href: "/tooling/mcp" },
    ],
  },
];
