/**
 * The docs' single navigation source: the top sections and both sidebars.
 *
 * The top bar switches worlds — Docs vs Components — and the left rail is
 * contextual to the world the reader is in. The component tree is derived
 * from the preset's own taxonomy, so a primitive added to the rules appears
 * in the rail on the next build with no list to maintain.
 */
import {
  primitiveCategories,
  primitiveContracts,
  primitiveElements,
} from "@spin/preset";

export interface NavLink {
  readonly title: string;
  readonly href: string;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavLink[];
}

/** The top bar's worlds, with the path prefixes each one is current for. */
export const TOP_SECTIONS: readonly (NavLink & {
  readonly active: readonly string[];
})[] = [
  {
    title: "Docs",
    href: "/guide/install",
    active: ["/why", "/guide", "/themes", "/tokens"],
  },
  { title: "Components", href: "/components", active: ["/components"] },
];

/** The Docs world's left rail. */
export const DOCS_GROUPS: readonly NavGroup[] = [
  { label: "Overview", items: [{ title: "Why Spin", href: "/why" }] },
  {
    label: "Getting Started",
    items: [
      { title: "Install", href: "/guide/install" },
      { title: "Markup", href: "/guide/markup" },
      { title: "Themes", href: "/guide/themes" },
      { title: "Verify", href: "/guide/verify" },
    ],
  },
  {
    label: "Themes & Tokens",
    items: [
      { title: "Theme Contract", href: "/themes" },
      { title: "Authoring & Gates", href: "/themes/authoring" },
      { title: "Token Schema", href: "/themes/schema" },
      { title: "Starters", href: "/themes/starters" },
      { title: "Style References", href: "/themes/styles" },
      { title: "Tokens & Utilities", href: "/tokens" },
    ],
  },
];

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

/**
 * The Components world's left rail, read off the preset's taxonomy.
 *
 * Every element the manifest knows, filed where the manifest files it — the
 * same taxonomy the studio's rail and the reference app's rail read — so a
 * filing cannot disagree between surfaces. A category the manifest empties
 * is dropped rather than drawn as a heading over nothing.
 */
export const COMPONENT_GROUPS: readonly ComponentNavGroup[] =
  primitiveCategories
    .map((category) => ({
      id: category.id,
      label: category.label,
      items: primitiveElements
        .filter(
          (element) =>
            element.category === category.id &&
            element.name in primitiveContracts,
        )
        .map((element) => ({
          name: element.name,
          icon: element.icon,
          href: `/components/${element.name}`,
        })),
    }))
    .filter((group) => group.items.length > 0);
