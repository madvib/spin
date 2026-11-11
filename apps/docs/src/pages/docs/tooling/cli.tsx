/**
 * CLI & Plugin Options: every `spin` subcommand, flag, `SpinPluginOptions`
 * field, and published package subpath rendered as structured PropList cards.
 */
import type { JSX } from "solid-js";
import { Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "../getting-started/getting-started.snippets.ts";

const commandItems = (): readonly PropEntry[] => [
  {
    name: "spin init",
    badge: "scaffold",
    description: (
      <>
        Detects your bundler, writes the initial theme to{" "}
        <code>spin/default/tokens.json</code>, and wires the plugin into your bundler
        config. Rejects <code>bundler: "unocss"</code> — init wires the plugin,
        never a preset-only config.
      </>
    ),
    detail:
      "Flags: --name, --language, --bundler, --themes-dir, --components-dir, --prefix, --vendor, --root, --from, --url, -y / --yes",
  },
  {
    name: "spin studio",
    badge: "daemon",
    defaultValue: "127.0.0.1:7463",
    description: (
      <>
        Opens the standalone theme editor: RPC daemon at <code>/rpc</code> and
        Studio UI at <code>/studio/</code>.
      </>
    ),
    detail: "Flags: --root, --port (default 7463), --host (default 127.0.0.1)",
  },
  {
    name: "spin lint",
    badge: "verification",
    description:
      "Runs the six theme-aware lint rules over a path: closed vocabulary, theme values, semantic HTML, and paired inks.",
    detail:
      "Flags: --format text|json, --strictness strict|balanced|lenient, --semantic-tags all|native|spin|none, --rule (repeatable), --fix",
  },
  {
    name: "spin brand",
    badge: "inspection",
    description: (
      <>
        Reads or renames a brand: <code>list</code>, <code>analyze</code>, and{" "}
        <code>rename</code> — a document's composition decides completeness,
        and the engine judges it.
      </>
    ),
    detail: "Flags: --root, --url, --format text|json, --contract[=a,b], --migrate",
  },
  {
    name: "spin component",
    badge: "components",
    description: (
      <>
        Lists components (<code>list</code>), prints a machine's{" "}
        <code>contract</code>, or copies an example recipe (<code>copy</code>)
        into <code>src/lib/components/</code>.
      </>
    ),
    detail: "Flags: --root, --url, --format text|json",
  },
  {
    name: "spin mcp",
    badge: "agent server",
    description: (
      <>
        Starts the MCP server over stdio, reading the project in-process or
        dialing a running daemon via <code>--url</code>.
      </>
    ),
    detail: "Flags: --root, --url",
  },
  {
    name: "spin lsp",
    badge: "editor",
    description: (
      <>
        Starts the language server over stdio: the same lint findings as{" "}
        <code>spin lint</code>, plus hover, completion, and quick-fix code
        actions from your theme. Point any LSP client at it — no config file
        required.
      </>
    ),
    detail: "Flags: --root",
  },
];

const pluginOptions = (): readonly PropEntry[] => [
  {
    name: "themes",
    badge: "Record<string, ThemeDocument>",
    description: (
      <>
        Explicit theme documents to serve verbatim. When omitted, the plugin
        serves <code>extends.themes</code> overlaid with{" "}
        <code>spin/&lt;brand&gt;/</code> from the project root.
      </>
    ),
  },
  {
    name: "extends",
    badge: "{ themes?, componentsDir? }",
    description:
      "Shared brand layer imported as values, overlaid by the project's local spin/<brand>/ and src/lib/components/*.html.",
  },
  {
    name: "presets",
    badge: "Preset[]",
    description:
      "Additional UnoCSS presets composed alongside Spin's preset (such as @unocss/preset-icons).",
  },
  {
    name: "shortcuts",
    badge: "Record<string, string>",
    description:
      "Your project's own utility compositions — the preset ships none. The worked example lives on Install & Bundlers.",
  },
  {
    name: "content",
    badge: "{ filesystem?, pipeline? }",
    description:
      "Filesystem globs and pipeline include filters for class extraction.",
  },
  {
    name: "primitives",
    badge: "string[] | false",
    defaultValue: "all",
    description: (
      <>
        Which primitive element rules to emit: omitted ships all,{" "}
        <code>false</code> ships none, or pass an array of element names.
      </>
    ),
  },
  {
    name: "safelist",
    badge: "string[]",
    description:
      "Utility classes to emit unconditionally even when constructed dynamically.",
  },
  {
    name: "studio",
    badge: "boolean",
    defaultValue: "true",
    description: (
      <>
        Mounts the Studio UI and RPC API on the Vite dev server. Set{" "}
        <code>false</code> to disable both the mount and the launcher.
      </>
    ),
  },
  {
    name: "launcher",
    badge: "boolean",
    defaultValue: "true",
    description: "Injects the floating Studio overlay launcher in dev mode.",
  },
  {
    name: "themesDir",
    badge: "string",
    defaultValue: '"spin"',
    description: "Local project directory holding DTCG theme JSON files.",
  },
  {
    name: "componentsDir",
    badge: "string",
    defaultValue: '"src/lib/components"',
    description: "Local project directory holding authored .html components.",
  },
  {
    name: "prefix",
    badge: "string",
    defaultValue: 'package name || "app"',
    description:
      "Custom-element prefix for compiled project components (e.g. <app-select>).",
  },
];

const SPIN_SUBPATHS: readonly PropEntry[] = [
  { name: "@spinjs/dev/vite", badge: "plugin", description: "Unplugin entry for Vite, Rspack, webpack, Rollup, Rolldown, esbuild, and Bun, plus SpinPluginOptions." },
  { name: "@spinjs/dev/preset", badge: "preset", description: "Standalone UnoCSS preset (spinPreset), CSS variable helpers (/preset/css), and custom-element types (/elements)." },
  { name: "@spinjs/dev/theme", badge: "tokens", description: "Token parser, alias resolver, six-gate validator (themeGates), designLanguages, and facets." },
  { name: "@spinjs/dev/diagnostics", badge: "lints", description: "The six spin/* oxlint rules over project facts, plus the shared check engine." },
  { name: "@spinjs/dev/eslint", badge: "eslint", description: "ESLint flat-config plugin: spread spin.configs.recommended, then tune per rule." },
  { name: "@spinjs/dev/cli", badge: "cli", description: "The spin CLI command runner and argument parser." },
  { name: "@spinjs/dev/mcp", badge: "mcp", description: "Stdio MCP server for coding agents (theme, token, component, utility, icon, savedIcon, font, preview, findings)." },
  { name: "@spinjs/dev/lsp", badge: "lsp", description: "Language server over stdio: live lint diagnostics, quick fixes, hover, and completions from your brand." },
  { name: "@spinjs/dev/api", badge: "api", description: "Daemon RPC surface the Studio and MCP server compose." },
  { name: "@spinjs/dev/skill", badge: "skill", description: "Agent skill text and authoring helpers for brand and component work." },
  { name: "@spinjs/dev/compositions", badge: "compositions", description: "Project-declared utility compositions." },
  { name: "@spinjs/dev/examples", badge: "examples", description: "Component example recipes for copy, list, and contract flows." },
];

const COMPONENT_SUBPATHS: readonly PropEntry[] = [
  { name: "@spinjs/components/<name>", badge: "machine", description: "Individual machine definitions (select, combobox, date-picker, toc, tabs, and 31 more)." },
  { name: "@spinjs/components/solid", badge: "adapter", description: "createSpinComponent — reactive controller hook for Solid." },
  { name: "@spinjs/components/react", badge: "adapter", description: "useSpinComponent — reactive controller hook for React." },
  { name: "@spinjs/components/controller", badge: "adapter", description: "spinComponentCtl — controller for vanilla DOM, Vue, and Svelte." },
  { name: "@spinjs/components/spin-element", badge: "custom element", description: "Base HTMLElement class extended by compiled .html components." },
];

const RUNTIME_SUBPATHS: readonly PropEntry[] = [
  { name: "@spinjs/components/runtime", badge: "core", description: "Signals (signal, computed, effect, batch), defineComponent, and defineController." },
  { name: "@spinjs/components/fsm", badge: "statechart", description: "createMachine and interpret statechart runtime." },
  { name: "@spinjs/components/props", badge: "props", description: "Authored prop helpers (authoredProps, textProp, defineComponent props)." },
  { name: "@spinjs/components/load", badge: "load", description: "Compiled-component loader: binds templates, directives, and actions at runtime." },
  { name: "@spinjs/components/actions", badge: "directives", description: "createAction plus anchor, drag, hover-delay, interact-outside, form-control, scroll-into-view, and observe." },
  { name: "@spinjs/components/testing", badge: "testing", description: "DOM and statechart test helpers." },
];

export default function ToolingCli(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="CLI"
        lede="Complete reference for the spin CLI subcommands, SpinPluginOptions fields, and published package subpaths."
      />

      <Section id="commands" title="Commands and flags">
        <p class="max-w-prose">
          Exit codes: <code>0</code> when clean (or warnings only),{" "}
          <code>1</code> on validation/lint errors, and <code>2</code> on
          invalid arguments or unreadable files.
        </p>
        <div class="mt-3">
          <PropList items={commandItems()} />
        </div>
      </Section>

      <Section id="plugin" title="SpinPluginOptions">
        <p class="max-w-prose">
          All seven bundler plugins — <code>spin.vite()</code>,{" "}
          <code>spin.rspack()</code>, <code>spin.webpack()</code>,{" "}
          <code>spin.rollup()</code>, <code>spin.rolldown()</code>,{" "}
          <code>spin.esbuild()</code>, and <code>spin.bun()</code> — accept the
          same <code>SpinPluginOptions</code> object from{" "}
          <code>@spinjs/dev/vite</code>:
        </p>
        <div class="my-4">
          <PropList items={pluginOptions()} />
        </div>
        <Code
          code={GETTING_STARTED_SNIPPETS.viteOptions}
          lang="ts"
          title="Narrowed primitives & explicit classes"
        />
      </Section>

      <Section id="subpaths" title="Published package subpaths">
        <h3>@spinjs/dev (devDependency)</h3>
        <PropList items={SPIN_SUBPATHS} />

        <h3>@spinjs/components (dependency)</h3>
        <PropList items={COMPONENT_SUBPATHS} />

        <h3>@spinjs/components/runtime (in the components package)</h3>
        <PropList items={RUNTIME_SUBPATHS} />
      </Section>
    </main>
  );
}
