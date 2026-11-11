/**
 * Single navigation source for the docs site: top-level worlds, the
 * subgrouped `/docs/*` handbook rail, and the unified `/components/*`
 * taxonomy rail.
 */
import {
  COMPONENT_ICONS,
  UNIFIED_COMPONENT_GROUPS,
} from "@spinjs/components";
import {
  primitiveContracts,
  primitiveElements,
} from "@spinjs/preset";

export interface NavLink {
  readonly title: string;
  readonly href: string;
  readonly summary?: string;
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavLink[];
}

/** The top bar's worlds, with the path prefixes each one is current for. */
export const TOP_SECTIONS: readonly (NavLink & {
  readonly active: readonly string[];
})[] = [
  {
    title: "Docs",
    href: "/docs/getting-started/overview",
    active: ["/docs"],
  },
  {
    title: "Components",
    href: "/components",
    active: ["/components"],
  },
  {
    title: "Playground",
    href: "/playground",
    active: ["/playground"],
  },
  {
    title: "Studio",
    href: "/studio",
    active: ["/studio"],
  },
];

/** The `/docs/*` handbook rail, organized by topic subgroup. */
export const DOCS_GROUPS: readonly NavGroup[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    items: [
      {
        title: "Introduction",
        href: "/docs/getting-started/overview",
        summary:
          "What Spin includes, how it compares to stitching together separate styling and widget libraries, and where to start.",
      },
      {
        title: "How Spin Works",
        href: "/docs/getting-started/architecture",
        summary:
          "How themes, native HTML elements, layout utilities, and interactive components fit together.",
      },
      {
        title: "Quickstart",
        href: "/docs/getting-started/quickstart",
        summary:
          "Install the two packages, initialize your project, and launch the live Studio in two minutes.",
      },
      {
        title: "Bundler Setup",
        href: "/docs/getting-started/install",
        summary:
          "Configure Spin in Vite, Rspack, webpack, Rollup, Rolldown, esbuild, Bun, or UnoCSS.",
      },
      {
        title: "Incremental Adoption",
        href: "/docs/getting-started/paths",
        summary:
          "Adopt Spin gradually in an existing app: start with tokens and utilities, opt in to HTML elements, or add single components.",
      },
    ],
  },
  {
    id: "themes",
    label: "Theming",
    items: [
      {
        title: "Studio",
        href: "/docs/themes/overview",
        summary:
          "Create and edit your brand visually inside your running app, starting from one of six design languages.",
      },
      {
        title: "Colors",
        href: "/docs/themes/palettes",
        summary:
          "Semantic surface, action, and status colors with paired foreground text that stays readable in every mode.",
      },
      {
        title: "Dark Mode",
        href: "/docs/themes/modes",
        summary:
          "Support light and dark appearances across the whole page or scoped to a single section without dark: utility clutter.",
      },
      {
        title: "Typography",
        href: "/docs/themes/fonts",
        summary:
          "Load web fonts and apply consistent heading, body, label, and monospace text styles.",
      },
      {
        title: "Alternate Palettes",
        href: "/docs/themes/facets",
        summary:
          "Offer multiple colorways for your brand or re-theme individual sections without duplicating typography or spacing.",
      },
      {
        title: "Density",
        href: "/docs/themes/density",
        summary:
          "Adjust padding and layout spacing globally or inside dense tables, sidebars, and toolbars.",
      },
      {
        title: "Theme Files",
        href: "/docs/themes/customization",
        summary:
          "Edit your spin/<brand>/ JSON files directly in code and customize individual elements when needed.",
      },
      {
        title: "Contrast Checks",
        href: "/docs/themes/validation",
        summary:
          "Automatic contrast, scale, and completeness checks in Studio, your editor, and CI.",
      },
      {
        title: "Token Reference",
        href: "/docs/themes/reference",
        summary:
          "Complete catalog of color roles, typography, spacing, radius, shadow, and element tokens.",
      },
    ],
  },
  {
    id: "primitives",
    label: "Elements",
    items: [
      {
        title: "HTML Elements",
        href: "/docs/styling/elements",
        summary:
          "Styled native buttons, inputs, dialogs, tables, and cards with semantic variants and sizes.",
      },
      {
        title: "Prose",
        href: "/docs/styling/prose",
        summary:
          "Readable headings, paragraphs, lists, blockquotes, and code blocks for articles and docs.",
      },
    ],
  },
  {
    id: "styling",
    label: "Utilities",
    items: [
      {
        title: "Utility Classes",
        href: "/docs/styling/tailwind",
        summary:
          "Tailwind-compatible layout and surface classes backed by your theme and verified at build time.",
      },
      {
        title: "Layout",
        href: "/docs/styling/space",
        summary:
          "Padding, gaps, sizing, responsive breakpoints, and CSS anchor positioning.",
      },
      {
        title: "Surfaces",
        href: "/docs/styling/color",
        summary:
          "Backgrounds, borders, text roles, and opacity modifiers that adapt automatically to dark mode.",
      },
      {
        title: "Motion",
        href: "/docs/styling/animation",
        summary:
          "Theme-timed transitions, entrance animations, and automatic reduced-motion support.",
      },
      {
        title: "Shortcuts",
        href: "/docs/styling/utilities",
        summary:
          "Define reusable layout class combinations once in your bundler config.",
      },
      {
        title: "Utility Reference",
        href: "/docs/styling/catalog",
        summary:
          "Searchable reference of every utility class available in Spin.",
      },
    ],
  },
  {
    id: "authoring",
    label: "Components",
    items: [
      {
        title: "Interactive Components",
        href: "/docs/authoring/components",
        summary:
          "Copy accessible selects, comboboxes, dialogs, and date pickers into your repo for React, Solid, Vue, Svelte, or HTML.",
      },
      {
        title: "State Machines",
        href: "/docs/authoring/machines",
        summary:
          "Use Spin's headless statecharts directly when building custom interactive widgets.",
      },
    ],
  },
  {
    id: "tooling",
    label: "Tooling",
    items: [
      {
        title: "Lint Rules",
        href: "/docs/tooling/lints",
        summary:
          "Catch hardcoded colors, unknown classes, and unreadable contrast pairs in oxlint or ESLint.",
      },
      {
        title: "CLI Reference",
        href: "/docs/tooling/cli",
        summary:
          "Command flags, bundler plugin options, and package exports.",
      },
      {
        title: "MCP Server",
        href: "/docs/tooling/mcp",
        summary:
          "Connect coding agents to your live tokens, components, and diagnostics.",
      },
    ],
  },
];

/** Flat ordered list of all docs pages with their parent group label. */
export interface DocsPageEntry extends NavLink {
  readonly groupId: string;
  readonly groupLabel: string;
}

export const ALL_DOCS_PAGES: readonly DocsPageEntry[] = DOCS_GROUPS.flatMap(
  (group) =>
    group.items.map((item) => ({
      ...item,
      groupId: group.id,
      groupLabel: group.label,
    })),
);

/** Look up a docs page entry and its previous/next neighbors by pathname. */
export function docsPageContext(pathname: string): {
  readonly current?: DocsPageEntry;
  readonly prev?: DocsPageEntry;
  readonly next?: DocsPageEntry;
} {
  const clean = pathname.replace(/\/$/, "");
  const idx = ALL_DOCS_PAGES.findIndex((entry) => entry.href === clean);
  if (idx === -1) return {};
  return {
    current: ALL_DOCS_PAGES[idx],
    prev: idx > 0 ? ALL_DOCS_PAGES[idx - 1] : undefined,
    next: idx + 1 < ALL_DOCS_PAGES.length ? ALL_DOCS_PAGES[idx + 1] : undefined,
  };
}

/** Legacy URL redirects so existing bookmarks and links resolve to `/docs/*`. */
export const LEGACY_DOCS_REDIRECTS: Readonly<Record<string, string>> = {
  "/docs": "/docs/getting-started/overview",
  "/docs/getting-started": "/docs/getting-started/overview",
  "/docs/themes": "/docs/themes/overview",
  "/docs/styling": "/docs/styling/elements",
  "/docs/authoring": "/docs/authoring/components",
  "/docs/tooling": "/docs/tooling/lints",
  "/start": "/docs/getting-started/overview",
  "/start/quickstart": "/docs/getting-started/quickstart",
  "/start/install": "/docs/getting-started/install",
  "/start/paths": "/docs/getting-started/paths",
  "/start/model": "/docs/getting-started/architecture",
  "/why": "/docs/getting-started/overview",
  "/themes": "/docs/themes/overview",
  "/themes/authoring": "/docs/themes/validation",
  "/themes/schema": "/docs/themes/reference",
  "/themes/languages": "/docs/themes/overview",
  "/themes/styles": "/docs/themes/customization",
  "/docs/themes/authoring": "/docs/themes/validation",
  "/docs/themes/schema": "/docs/themes/reference",
  "/docs/themes/languages": "/docs/themes/overview",
  "/docs/themes/styles": "/docs/themes/customization",
  "/guide": "/docs/styling/elements",
  "/guide/markup": "/docs/styling/elements",
  "/guide/css": "/docs/styling/utilities",
  "/guide/components": "/docs/authoring/components",
  "/guide/machines": "/docs/authoring/machines",
  "/guide/install": "/docs/getting-started/install",
  "/guide/themes": "/docs/themes/overview",
  "/guide/verify": "/docs/tooling/lints",
  "/utilities": "/docs/styling/catalog",
  "/tokens": "/docs/styling/catalog",
  "/tooling": "/docs/tooling/lints",
  "/tooling/lints": "/docs/tooling/lints",
  "/tooling/cli": "/docs/tooling/cli",
  "/tooling/mcp": "/docs/tooling/mcp",
};

export interface ComponentNavItem {
  readonly name: string;
  readonly icon: string;
  readonly href: string;
}

export interface ComponentNavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly ComponentNavItem[];
}

/** Tag names that resolve to the component that owns them. */
export const COMPONENT_ALIASES: Readonly<Record<string, string>> = {
  input: "field",
  textarea: "field",
  typography: "prose",
};

/** Machine members, read off the shared table's `component-` prefix. */
const MACHINES = new Set(
  UNIFIED_COMPONENT_GROUPS.flatMap((group) =>
    group.members
      .filter((member) => member.startsWith("component-"))
      .map((member) => member.slice("component-".length))
  ),
);
function unifiedHref(member: string): string {
  const bare = member.replace(/^component-/, "");
  return MACHINES.has(bare) ? `/components/machine-${bare}` : `/components/${bare}`;
}
function unifiedIcon(member: string): string {
  const bare = member.replace(/^component-/, "");
  if (MACHINES.has(bare)) return COMPONENT_ICONS[bare] ?? "i-lucide-box";
  return primitiveElements.find((element) => element.name === bare)?.icon ?? "i-lucide-box";
}
function unifiedKnown(member: string): boolean {
  const bare = member.replace(/^component-/, "");
  return MACHINES.has(bare) || bare in primitiveContracts;
}
export const COMPONENT_GROUPS: readonly ComponentNavGroup[] =
  UNIFIED_COMPONENT_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.members
      .filter(unifiedKnown)
      .map((member) => ({
        name: member.replace(/^component-/, ""),
        icon: unifiedIcon(member),
        href: unifiedHref(member),
      })),
  })).filter((group) => group.items.length > 0);
