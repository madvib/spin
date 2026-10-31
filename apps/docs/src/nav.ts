/**
 * The docs' single navigation source: the top sections and both sidebars.
 *
 * The top bar switches worlds — Docs vs Components — and the left rail is
 * contextual to the world the reader is in. The component tree is filed by
 * the shared unified taxonomy, so a component added to the library appears
 * in the rail on the next build with no list to maintain.
 */
import {
  COMPONENT_ICONS,
  UNIFIED_COMPONENT_GROUPS,
} from "@spinjs/components";
import { exampleMachines } from "@spinjs/components/examples";
import {
  primitiveContracts,
  primitiveElements,
} from "@spinjs/preset";

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
    active: ["/why", "/guide", "/themes", "/tokens", "/utilities", "/tooling"],
  },
  { title: "Studio", href: "/studio", active: ["/studio"] },
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
 * The Components world's left rail, filed by the shared unified taxonomy —
 * the same table the studio's rail reads — so a filing cannot disagree
 * between surfaces. Primitives link to their page; machines link to their
 * machine page. A group the library empties is dropped rather than drawn
 * as a heading over nothing.
 */
const MACHINES = new Set(exampleMachines());
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
