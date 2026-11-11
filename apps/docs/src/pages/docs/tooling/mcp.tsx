/**
 * MCP Server: the sixteen tools and two resources for coding agents.
 */
import type { JSX } from "solid-js";
import { Markdown } from "../../../markdown/markdown.tsx";
import { Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import { TOOLING_SNIPPETS } from "./tooling.snippets.ts";
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
      "Atomic token edits — read, mutate, write, and validate in a single call.",
  },
  {
    name: "component",
    badge: "list · contract · examples · copy",
    description:
      "Inspect primitive and machine tags, variants, token reads, list a machine's examples, and copy example .html templates.",
  },
  {
    name: "utility",
    badge: "catalog",
    description:
      "Query the active project theme's generated utility classes grouped by intent.",
  },
  {
    name: "icon",
    badge: "search · body",
    description:
      "Search across five Iconify collections and fetch raw SVG glyph bodies.",
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
      "Query the Fontsource catalog by family name for $extensions.spin.fonts.",
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
      "Run the project lints and corpus analysis: list findings grouped by rule, apply a fix, or rewrite class order.",
  },
  {
    name: "brand_create",
    badge: "brand",
    description:
      "Create a brand: its spin/<brand>/ directory, brand.json definition, and config seating. Zero tokens.",
  },
  {
    name: "brand_setDesignLanguage",
    badge: "brand",
    description:
      "Name the brand's design language: writes $extends in tokens.json, nothing else.",
  },
  {
    name: "brand_setPalette",
    badge: "brand",
    description:
      "Seed the brand's palette from one primary color plus an optional neutral seed. Floors validated before write.",
  },
  {
    name: "brand_setType",
    badge: "brand",
    description:
      "Set the brand's type: a curated suggestion by design language, explicit faces, and the icon collection plus stroke.",
  },
  {
    name: "brand_get",
    badge: "brand",
    description:
      "Read a brand: its definition, its sparse layers, and the composition's judgment.",
  },
  {
    name: "brand_rename",
    badge: "brand",
    description:
      "Rename a brand: its directory, the config seating and order naming it, and the name inside its definition.",
  },
  {
    name: "facet_create",
    badge: "palette · spacing",
    description:
      "Write one facet file beside the theme it composes over. Shape-checked before write; a refusal names the file and the wrong keys.",
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

      <Section id="tools" title="The sixteen MCP tools">
        <PropList items={TOOL_ITEMS} />
      </Section>

      <Section id="connect" title="Client configuration">
        <div class="my-3">
          <Code
            code={TOOLING_SNIPPETS.mcpConfig}
            lang="json"
            title=".mcp.json / claude_desktop_config.json"
          />
        </div>
        <p class="max-w-prose">
          Read-only clients can also query the two MCP resources:{" "}
          <code>spin://project</code> (project summary) and{" "}
          <code>spin://themes/{"{name}"}</code> (raw DTCG JSON). Pass{" "}
          <code>--url http://127.0.0.1:7463/rpc</code> to connect to a running{" "}
          <code>spin studio</code> daemon.
        </p>
      </Section>
    </main>
  );
}
