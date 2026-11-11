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
        title: "Overview",
        href: "/docs/getting-started/overview",
        summary:
          "Why Spin claims bare HTML tags, enforces a closed token vocabulary, and prevents CSS drift across humans and coding agents.",
      },
      {
        title: "Ownership",
        href: "/docs/getting-started/architecture",
        summary:
          "Which layer owns each visual or behavioral change, why lints refuse callsite overrides, and the 4-step customization staircase.",
      },
      {
        title: "Quickstart",
        href: "/docs/getting-started/quickstart",
        summary:
          "Install the packages, scaffold spin/<brand>/, and open the Studio in two minutes.",
      },
      {
        title: "Installation",
        href: "/docs/getting-started/install",
        summary:
          "Project layout, spin init flags, and configurations for all seven bundlers.",
      },
      {
        title: "Adoption",
        href: "/docs/getting-started/paths",
        summary:
          "Full bundler plugin, shared brand packages, UnoCSS preset-only, or standalone Studio daemon.",
      },
    ],
  },
  {
    id: "themes",
    label: "Themes",
    items: [
      {
        title: "Brands",
        href: "/docs/themes/overview",
        summary:
          "Design languages ($extends), your brand in spin/<brand>/, runtime facets, and live editing in the Studio.",
      },
      {
        title: "Layers",
        href: "/docs/themes/customization",
        summary:
          "How spin/<brand>/ splits tokens.json, reference.json, elements.json, and primitives/*.json, and how tokens map to CSS variables.",
      },
      {
        title: "Palettes",
        href: "/docs/themes/palettes",
        summary:
          "Semantic color roles, paired foreground inks (bg-* + text-on-*), neutral ramps, and enforced WCAG contrast floors.",
      },
      {
        title: "Modes",
        href: "/docs/themes/modes",
        summary:
          "Light and dark mode resolution via $modes, mode-relative aliases, subtree scoping with data-mode, and mode invariance.",
      },
      {
        title: "Facets",
        href: "/docs/themes/facets",
        summary:
          "Optional *.palette.json (data-palette) and *.spacing.json (data-spacing) overlays that compose with your brand and mode.",
      },
      {
        title: "Typography",
        href: "/docs/themes/fonts",
        summary:
          "Loading web fonts with @font-face generation, font family roles, the 13 named font.style.* tuples, and .type aliases.",
      },
      {
        title: "Validation",
        href: "/docs/themes/validation",
        summary:
          "Automatic theme checks in spin lint, CLI analysis, WCAG contrast floors, and validateTheme().",
      },
      {
        title: "Reference",
        href: "/docs/themes/reference",
        summary:
          "Complete reference of DTCG token groups, required roles, contrast pairs, and per-element tokens.",
      },
    ],
  },
  {
    id: "primitives",
    label: "Primitives",
    items: [
      {
        title: "Elements",
        href: "/docs/styling/elements",
        summary:
          "Write semantic HTML tags and Spin custom elements — <button>, <card>, <input> — and get finished controls that agree across your page, with variants, .bare semantics, and incremental adoption.",
      },
      {
        title: "Prose",
        href: "/docs/styling/prose",
        summary:
          "Named type styles (type-<name>), default heading and paragraph typography, inline link/strong modifiers, and document vs. UI list rules.",
      },
    ],
  },
  {
    id: "styling",
    label: "Utilities",
    items: [
      {
        title: "Tailwind",
        href: "/docs/styling/tailwind",
        summary:
          "Use the Tailwind utility and variant grammar you already know over a theme your project owns — with closed-vocabulary build verification, numeric measurement brackets, and automatic dark mode.",
      },
      {
        title: "Layout",
        href: "/docs/styling/space",
        summary:
          "Pad, gap, and size elements from your theme's spacing scale, reflow across breakpoints, pin top-layer popovers with CSS anchors, and clear control chrome with .bare.",
      },
      {
        title: "Color",
        href: "/docs/styling/color",
        summary:
          "Spend semantic surface, fill, border, and ink utilities once for light and dark mode, and thin any theme color with /0–/100 alpha modifiers.",
      },
      {
        title: "Motion",
        href: "/docs/styling/animation",
        summary:
          "Theme-governed transition durations, cubic-bezier easing curves, keyframe entrances, and automatic prefers-reduced-motion support.",
      },
      {
        title: "Shortcuts",
        href: "/docs/styling/utilities",
        summary:
          "Declare repeated layout arrangements in spin.vite({ shortcuts }), verify shortcut utilities at build time, and detect repeated class strings with spin lint.",
      },
      {
        title: "Catalog",
        href: "/docs/styling/catalog",
        summary:
          "Grammar reference for every utility rule family, the CSS declarations it emits, and the active theme token scale it reads.",
      },
    ],
  },
  {
    id: "authoring",
    label: "Authoring",
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
        title: "CLI",
        href: "/docs/tooling/cli",
        summary: "Complete reference for spin CLI subcommands, flags, and SpinPluginOptions.",
      },
      {
        title: "MCP",
        href: "/docs/tooling/mcp",
        summary: "Connecting coding agents to your live Spin project over MCP.",
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
