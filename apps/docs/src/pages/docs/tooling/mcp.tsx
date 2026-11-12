/**
 * MCP Server: quick setup, agent workflows, and the tool reference for coding agents.
 */
import type { JSX } from "solid-js";
import { Markdown } from "../../../markdown/markdown.tsx";
import { PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import mcpMd from "../../../content/mcp.md?raw";

const TOOL_ITEMS: readonly PropEntry[] = [
  {
    name: "theme",
    badge: "list · read · create · write · analyze · delete",
    description:
      "Read, copy, or validate whole DTCG theme documents.",
  },
  {
    name: "token",
    badge: "set · remove · rename",
    description:
      "Edit individual tokens — set, remove, or rename in a single validated call.",
  },
  {
    name: "component",
    badge: "list · contract · examples · copy",
    description:
      "List primitives and machines, read the tags and variants each one supports, and copy example templates.",
  },
  {
    name: "utility",
    badge: "catalog",
    description:
      "List the project's generated utility classes grouped by intent.",
  },
  {
    name: "icon",
    badge: "search · body",
    description:
      "Search the five installed Iconify collections and read raw SVG bodies.",
  },
  {
    name: "savedIcon",
    badge: "list · read · save · remove",
    description:
      "Manage project-vendored icons in spin/icons/*.json with license attribution.",
  },
  {
    name: "font",
    badge: "search",
    description:
      "Search the Fontsource catalog by family name.",
  },
  {
    name: "preview",
    badge: "render",
    description:
      "Compile scoped .spin-preview CSS for a theme plus an HTML snippet.",
  },
  {
    name: "findings",
    badge: "list · fix · corpus · order · shortcut",
    description:
      "List the project's lint findings grouped by rule, apply a fix, or rewrite class order.",
  },
  {
    name: "brand_create",
    badge: "brand",
    description:
      "Create a brand: its spin/<brand>/ directory and definition.",
  },
  {
    name: "brand_setDesignLanguage",
    badge: "brand",
    description:
      "Set the brand's parent design language in tokens.json.",
  },
  {
    name: "brand_setPalette",
    badge: "brand",
    description:
      "Seed the brand's palette from one primary color. Contrast floors are validated before writing.",
  },
  {
    name: "brand_setType",
    badge: "brand",
    description:
      "Set the brand's type pairing: a curated suggestion or explicit faces.",
  },
  {
    name: "brand_get",
    badge: "brand",
    description:
      "Read a brand back: its definition and composed values.",
  },
  {
    name: "brand_rename",
    badge: "brand",
    description:
      "Rename a brand: its directory and every name pointing at it.",
  },
  {
    name: "facet_create",
    badge: "palette · spacing",
    description:
      "Write one palette or spacing overlay beside the theme it composes over. Shape-checked before writing.",
  },
];

export default function Mcp(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="MCP Server"
        lede="Connect coding agents to your live tokens, components, and diagnostics."
      />
      <Markdown text={mcpMd} />

      <Section id="tools" title="Tool and resource reference">
        <PropList items={TOOL_ITEMS} />
        <p class="max-w-prose">
          Read-only clients can also query the two MCP resources:{" "}
          <code>spin://project</code> (project summary of brands, primitives, and
          shortcuts) and <code>spin://themes/{"{name}"}</code> (one theme as DTCG
          JSON).
        </p>
      </Section>
    </main>
  );
}
