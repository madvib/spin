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
} from "@spinjs/spin/preset";

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
        title: "Overview",
        href: "/docs/getting-started/overview",
        summary: "How themes, bare-tag HTML elements, utilities, and state machines fit together.",
      },
      {
        title: "Quickstart",
        href: "/docs/getting-started/quickstart",
        summary: "Install the packages, wire your bundler, and open the Studio in two minutes.",
      },
      {
        title: "Installation",
        href: "/docs/getting-started/install",
        summary: "Project layout, spin init flags, and configurations for all seven bundlers.",
      },
      {
        title: "Entry Points",
        href: "/docs/getting-started/paths",
        summary: "Full bundler plugin, UnoCSS preset-only, or standalone Studio daemon.",
      },
      {
        title: "Architecture",
        href: "/docs/getting-started/architecture",
        summary: "Which layer owns each visual or behavioral change, and the checks that verify it.",
      },
    ],
  },
  {
    id: "themes",
    label: "Themes",
    items: [
      {
        title: "Overview",
        href: "/docs/themes/overview",
        summary: "Designing your brand theme in the Studio, previewing starters, and configuring spin/*.json.",
      },
      {
        title: "Modes",
        href: "/docs/themes/modes",
        summary: "Light and dark mode resolution, subtree scoping with data-mode, mode invariance, and mode pickers.",
      },
      {
        title: "Fonts",
        href: "/docs/themes/fonts",
        summary: "Loading web fonts with @font-face generation, font family roles, and the monotonic type scale.",
      },
      {
        title: "Customization",
        href: "/docs/themes/customization",
        summary: "How tokens map to utilities, semantic palette roles, spatial scales, and per-element overrides.",
      },
      {
        title: "Validation",
        href: "/docs/themes/validation",
        summary: "Automatic theme checks in spin lint, CLI analysis, WCAG contrast floors, and validateTheme().",
      },
      {
        title: "Token Reference",
        href: "/docs/themes/reference",
        summary: "Complete reference of DTCG token groups, required roles, contrast pairs, and per-element tokens.",
      },
    ],
  },
  {
    id: "styling",
    label: "Styling",
    items: [
      {
        title: "Primitives",
        href: "/docs/styling/elements",
        summary: "Stylesheet cascade layers, HTML and custom element primitives (tag or class mode), variants, .bare, and compound parts.",
      },
      {
        title: "Typography & Lists",
        href: "/docs/styling/prose",
        summary: "Element-owned typography (h1-h6, p, code, blockquote, <prose>) and list primitives (ul/ol reset, row-list, flow-list).",
      },
      {
        title: "Color & Dark Mode",
        href: "/docs/styling/color",
        summary: "Name the job an element performs on the page and let your theme supply the palette. Write role utilities once for light and dark mode, pair every painted fill with its readable ink, and thin any theme color toward transparency without minting new values.",
      },
      {
        title: "Space, Layout & Responsive",
        href: "/docs/styling/space",
        summary: "Pad, gap, and size elements from your theme's spacing scale, name the flex and grid compositions your project repeats, and reflow across your theme's breakpoints. Pin floating panels to their triggers in the top layer and strip default control chrome when a custom trigger needs button semantics without button paint.",
      },
      {
        title: "Utilities",
        href: "/docs/styling/utilities",
        summary: "Closed-scale utility classes, linter-neutral editor diagnostics, paired fills and inks, and project compositions.",
      },
      {
        title: "Motion",
        href: "/docs/styling/animation",
        summary: "Add a transition or an entrance to an element and let your theme set the pace. Every hover state, dialog entrance, and loading indicator moves at the speed and curve your theme sets once — and stills automatically when a visitor asks for less motion.",
      },
      {
        title: "Utility Reference",
        href: "/docs/styling/catalog",
        summary: "Grammar reference for every utility rule family, the CSS declarations it emits, and the active theme token scale it reads.",
      },
    ],
  },
  {
    id: "authoring",
    label: "Components & Runtime",
    items: [
      {
        title: "Components",
        href: "/docs/authoring/components",
        summary: "HTML component compiler and framework controllers for React, Solid, Vue, and Svelte.",
      },
      {
        title: "Machines",
        href: "/docs/authoring/machines",
        summary: "Authoring headless statecharts, reactive signals, and DOM directives.",
      },
    ],
  },
  {
    id: "tooling",
    label: "Tooling",
    items: [
      {
        title: "Lints",
        href: "/docs/tooling/lints",
        summary: "Every spin/* lint rule, strictness dial, and autofix behavior.",
      },
      {
        title: "CLI Reference",
        href: "/docs/tooling/cli",
        summary: "Complete reference for spin CLI subcommands, flags, and SpinPluginOptions.",
      },
      {
        title: "MCP Server",
        href: "/docs/tooling/mcp",
        summary: "Connecting coding agents to your live Spin project over MCP.",
      },
      {
        title: "Browser Checks",
        href: "/docs/tooling/check",
        summary: "Running automated geometry, contrast, and interaction checks in a real browser.",
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
  "/themes/starters": "/docs/themes/overview",
  "/themes/styles": "/docs/themes/customization",
  "/docs/themes/authoring": "/docs/themes/validation",
  "/docs/themes/schema": "/docs/themes/reference",
  "/docs/themes/starters": "/docs/themes/overview",
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
  "/tooling/check": "/docs/tooling/check",
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
