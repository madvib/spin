import { DOCS_GROUPS } from "../../src/shell/nav.ts";

export function buildLlmsTxt(): string {
  const lines: string[] = [
    "# Spin Documentation",
    "",
    "> Spin is a theme-first UI system and verification layer: DTCG design tokens (`spin/<brand>/`), classless HTML element rules, closed-scale UnoCSS utilities, and headless state-machine components.",
    "",
    "## Core Rules for Coding Agents",
    "",
    "1. **Theme owns every visual value (`spin/<brand>/`).** Never write `.css` files, `<style>` blocks, inline `style={{}}`, or arbitrary bracket utilities (`w-[320px]`, `bg-[#fff]`).",
    "2. **Classless elements first.** Use `<button>` (neutral), `<button class=\"primary\">` (CTA), `.secondary`, `.outline`, `.ghost`, `.danger`, `.bare`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<field>`, `<card>` (`<card-header>`, `<card-title>`, `<card-description>`, `<card-action>`, `<card-content>`, `<card-footer>`), `<panel>`, `<dialog>`, `<table>`, `<badge variant=\"primary\">`, `<alert variant=\"info\">`. Never re-declare styles the element already owns (`spin/no-redundant-class`, `spin/prefer-theme-value`).",
    "3. **Layout compositions & paired inks.** Declare the compositions your app repeats in `spin.vite({ shortcuts: { ... } })` (the worked example lives on `/docs/getting-started/install#config`) — the preset ships none. Pair every fill with its semantic ink (`bg-primary text-on-primary`, `bg-semantic-success text-on-semantic-success`). Dark mode is automatic via `[data-mode=\"dark\"]` — never write `dark:*` classes.",
    "4. **Interactive widgets via `@spinjs/components`.** Never hand-roll custom select, combobox, tabs, dialog, menu, popover, or date-picker widgets. Run `npx spin component list` and `npx spin component copy <name> <example>`, then bind with `createSpinComponent` / `useSpinComponent`.",
    "5. **Verify before finishing.** Run `npx spin lint .` and `npx spin theme analyze` (or use the `spin` MCP server tools in `.mcp.json`).",
    "",
    "Fetch any documentation page as Markdown by appending `.md` to its URL or sending `Accept: text/markdown`.",
    "",
  ];
  for (const group of DOCS_GROUPS) {
    lines.push(`## ${group.label}`, "");
    for (const item of group.items) {
      lines.push(
        `- [${item.title}](${item.href}.md)${
          item.summary ? `: ${item.summary}` : ""
        }`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
