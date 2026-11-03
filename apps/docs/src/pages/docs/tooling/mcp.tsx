/**
 * MCP Server: the eight tools and two resources for coding agents.
 */
import type { JSX } from "solid-js";
import { Markdown } from "../../../markdown.tsx";
import { Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import { TOOLING_SNIPPETS } from "./tooling.snippets.ts";
import mcpMd from "../../../content/mcp.md?raw";

const TOOL_ITEMS: readonly PropEntry[] = [
  {
    name: "theme",
    badge: "list · read · create · write · analyze · delete",
    description:
      "Read, scaffold, fork, or validate whole DTCG theme documents.",
  },
  {
    name: "token",
    badge: "set · remove · rename",
    description:
      "Atomic token edits — read, mutate, write, and validate in a single call.",
  },
  {
    name: "component",
    badge: "list · contract · copy",
    description:
      "Inspect primitive and machine tags, variants, token reads, and copy example .html templates.",
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
];

export default function Mcp(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="MCP Server"
        lede="Connect coding agents directly to your project's themes, token vocabulary, and component contracts over stdio or daemon RPC."
      />
      <Markdown text={mcpMd} />

      <Section id="tools" title="The eight MCP tools">
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
