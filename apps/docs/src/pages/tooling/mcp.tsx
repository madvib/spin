/**
 * MCP & Agents: the eight tools, the two resources, and the house skill.
 *
 * The workflow narrative lives in `../../content/mcp.md`. This file keeps
 * the tool table the Markdown cannot keep in sync with the server — read
 * from the same action verbs the server registers.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Code, Section } from "../../bits.tsx";
import { Markdown } from "../../markdown.tsx";
import mcpMd from "../../content/mcp.md?raw";
import { SNIPPETS } from "../../snippets.ts";

const TOOLS: readonly { tool: string; actions: string; what: string }[] = [
  {
    tool: "theme",
    actions: "list · read · create · write · analyze · delete",
    what:
      "Whole DTCG documents. Create forks a theme or scaffolds the required roles.",
  },
  {
    tool: "token",
    actions: "set · remove · rename",
    what: "Atomic token edits — read, mutate, write, validate in one call.",
  },
  {
    tool: "component",
    actions: "list · contract",
    what: "Tags, variants, token reads, component tokens, example HTML.",
  },
  {
    tool: "utility",
    actions: "—",
    what: "The project theme's utilities, grouped by intent.",
  },
  {
    tool: "icon",
    actions: "search · body",
    what: "Five Iconify collections: find glyph names, fetch SVG bodies.",
  },
  {
    tool: "savedIcon",
    actions: "list · read · save · remove",
    what: "Your spin/icons/*.json, with attribution.",
  },
  {
    tool: "font",
    actions: "—",
    what: "The Fontsource catalog by family name.",
  },
  {
    tool: "preview",
    actions: "—",
    what: "Scoped .spin-preview CSS for a theme plus a markup snippet.",
  },
];

export default function Mcp(): JSX.Element {
  return (
    <main class="mx-auto w-full max-w-screen-lg px-6 py-10 md:py-16">
      <h1>MCP &amp; Agents</h1>
      <Markdown text={mcpMd} />

      <Section id="tools" title="The eight tools, at a glance">
        <div class="mt-3 overflow-x-auto">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">tool</th>
                <th class="py-2 pr-4">actions</th>
                <th class="py-2 pr-4">what the agent gets</th>
              </tr>
            </thead>
            <tbody>
              <For each={TOOLS}>
                {(row) => (
                  <tr class="border-b border-border">
                    <td class="font-mono text-xs">
                      {row.tool}
                    </td>
                    <td class="font-mono text-xs text-text-muted">
                      {row.actions}
                    </td>
                    <td class="text-text-muted">{row.what}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="connect" title="Launch the server from the project root">
        <Code class="mt-3" code={SNIPPETS.mcpConfig} lang="json" />
        <p>
          Read-only clients use the resources instead:{" "}
          <code>spin://project</code> for what the project holds,{" "}
          <code>spin://themes/{"{name}"}</code> for one theme as DTCG JSON.
          Add <code>--url http://127.0.0.1:7463/rpc</code> to dial a running
          daemon instead of starting in-process.
        </p>
      </Section>
    </main>
  );
}
