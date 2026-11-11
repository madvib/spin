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
        title: "Why Spin",
        href: "/docs/getting-started/overview",
        summary:
          "Stop rewriting button styles on every page. Your brand lives in one place, every tag and utility reads it, and lints catch drift before it ships.",
      },
      {
        title: "How Spin Works",
        href: "/docs/getting-started/architecture",
        summary:
          "Your brand tokens, finished HTML elements, layout utilities, and interactive components — and which layer to change when the design moves.",
      },
      {
        title: "Quickstart",
        href: "/docs/getting-started/quickstart",
        summary:
          "Install the packages, scaffold your brand, and open the Studio in two minutes.",
      },
      {
        title: "Bundler Setup",
        href: "/docs/getting-started/install",
        summary:
          "Project layout, the init command and its flags, and configurations for all seven bundlers.",
      },
      {
        title: "Incremental Adoption",
        href: "/docs/getting-started/paths",
        summary:
          "Bring Spin into an existing app piecemeal: the full plugin, shared brands, the preset-only path, or the standalone Studio.",
      },
    ],
  },
  {
    id: "themes",
    label: "Brand & Studio",
    items: [
      {
        title: "Your Brand & Studio",
        href: "/docs/themes/overview",
        summary:
          "Shape your brand visually in the Studio, seeded from a design language. What you save becomes the spin/<brand>/ directory your build serves.",
      },
      {
        title: "Color & Contrast",
        href: "/docs/themes/palettes",
        summary:
          "Name colors by their job — primary, surface, ink — and let paired foregrounds keep every fill legible in light and dark.",
      },
      {
        title: "Light & Dark Modes",
        href: "/docs/themes/modes",
        summary:
          "Design one palette with two answers. Switch modes on the page or a subtree without touching markup.",
      },
      {
        title: "Typography & Voices",
        href: "/docs/themes/fonts",
        summary:
          "Load web fonts and spend complete type styles — display, body, caption — with one class each.",
      },
      {
        title: "Palettes & Density",
        href: "/docs/themes/facets",
        summary:
          "Swap a subtree's ink or rhythm independently of the brand: seasonal palettes, compact sidebars, generous marketing pages.",
      },
      {
        title: "Brand Files",
        href: "/docs/themes/customization",
        summary:
          "How spin/<brand>/ splits identity, scales, element voices, and per-component overrides — and how each file becomes CSS variables.",
      },
      {
        title: "Theme Checks",
        href: "/docs/themes/validation",
        summary:
          "Contrast floors and completeness checks that run while you edit, at build time, and in CI.",
      },
      {
        title: "Token Reference",
        href: "/docs/themes/reference",
        summary:
          "Every token group your brand can declare: color roles, type scales, spacing, radii, shadows, motion, and per-element voices.",
      },
    ],
  },
  {
    id: "primitives",
    label: "Primitives",
    items: [
      {
        title: "HTML Elements & Surfaces",
        href: "/docs/styling/elements",
        summary:
          "Write plain buttons, cards, and inputs that arrive styled. Reach for a variant when one control plays a different role.",
      },
      {
        title: "Text & Prose",
        href: "/docs/styling/prose",
        summary:
          "Headings and paragraphs that read right out of the box, named type styles for UI, and document versus interface lists.",
      },
    ],
  },
  {
    id: "styling",
    label: "Utilities",
    items: [
      {
        title: "Utility Syntax",
        href: "/docs/styling/tailwind",
        summary:
          "The utility grammar you already know, verified against your brand at build time — no silent no-ops.",
      },
      {
        title: "Spacing & Layout",
        href: "/docs/styling/space",
        summary:
          "Pad, gap, and size from your brand's spacing scale, reflow across breakpoints, and pin floating panels with CSS anchors.",
      },
      {
        title: "Surfaces & Alpha",
        href: "/docs/styling/color",
        summary:
          "Paint semantic surfaces once for both modes, and thin any brand color toward transparency without minting values.",
      },
      {
        title: "Motion & Transitions",
        href: "/docs/styling/animation",
        summary:
          "Brand-governed timing and easing for state changes, named entrances for arrivals — and stillness for readers who ask.",
      },
      {
        title: "Project Shortcuts",
        href: "/docs/styling/utilities",
        summary:
          "Name the layouts your app repeats so every page spells them the same way, checked at build time.",
      },
      {
        title: "Utility Reference",
        href: "/docs/styling/catalog",
        summary:
          "Every utility family, the CSS it emits, and the brand tokens it reads.",
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
        summary: "Copy a tested select, dialog, or date picker into your repo and drive it from any framework.",
      },
      {
        title: "Statechart Machines",
        href: "/docs/authoring/machines",
        summary: "How the components think: explicit states, guarded transitions, and reactive signals you can read.",
      },
    ],
  },
  {
    id: "tooling",
    label: "Verification & AI",
    items: [
      {
        title: "Lints & Guardrails",
        href: "/docs/tooling/lints",
        summary: "Six theme-aware rules that catch unknown classes, broken overrides, and unreadable pairings — with autofixes.",
      },
      {
        title: "CLI & Build Options",
        href: "/docs/tooling/cli",
        summary: "Every spin command and plugin option: scaffold, serve Studio, lint, inspect brands, and copy components.",
      },
      {
        title: "MCP Server",
        href: "/docs/tooling/mcp",
        summary: "Connect your coding agent to the live project so it writes brand-true UI the first time.",
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
