/**
 * Bundler Setup: package roles, reactive bundler config tabs, and project files with clear lifecycle.
 */
import { createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import {
  Code,
  CodeFrame,
  PageHeader,
  PropList,
  Section,
  type PropEntry,
} from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./getting-started.snippets.ts";

interface BundlerTab {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly code: string;
  readonly note: JSX.Element;
}

const bundlerList = (): readonly BundlerTab[] => [
  {
    id: "vite",
    name: "Vite",
    file: "vite.config.ts",
    code: GETTING_STARTED_SNIPPETS.vite,
    note: (
      <>
        Compiles your theme and utility CSS, builds any{" "}
        <A href="/docs/authoring/components">interactive HTML components</A> in
        your project, and mounts Studio during local development.
      </>
    ),
  },
  {
    id: "rspack",
    name: "Rspack",
    file: "rspack.config.ts",
    code: GETTING_STARTED_SNIPPETS.rspack,
    note: (
      <>
        Compiles your theme stylesheet and any{" "}
        <A href="/docs/authoring/components">interactive HTML components</A>{" "}
        during Rspack dev and production builds.
      </>
    ),
  },
  {
    id: "webpack",
    name: "webpack",
    file: "webpack.config.mjs",
    code: GETTING_STARTED_SNIPPETS.webpack,
    note: (
      <>
        Compiles your theme stylesheet and any{" "}
        <A href="/docs/authoring/components">interactive HTML components</A>{" "}
        during webpack builds.
      </>
    ),
  },
  {
    id: "rollup",
    name: "Rollup",
    file: "rollup.config.mjs",
    code: GETTING_STARTED_SNIPPETS.rollup,
    note: (
      <>
        Compiles your theme stylesheet and any{" "}
        <A href="/docs/authoring/components">interactive HTML components</A>{" "}
        in Rollup bundles.
      </>
    ),
  },
  {
    id: "rolldown",
    name: "Rolldown",
    file: "rolldown.config.ts",
    code: GETTING_STARTED_SNIPPETS.rolldown,
    note: (
      <>
        Compiles your theme stylesheet and any{" "}
        <A href="/docs/authoring/components">interactive HTML components</A>{" "}
        in Rolldown bundles.
      </>
    ),
  },
  {
    id: "esbuild",
    name: "esbuild",
    file: "spin.config.ts",
    code: GETTING_STARTED_SNIPPETS.esbuild,
    note: (
      <>
        Compiles your theme stylesheet and any{" "}
        <A href="/docs/authoring/components">interactive HTML components</A>{" "}
        for esbuild pipelines.
      </>
    ),
  },
  {
    id: "bun",
    name: "Bun",
    file: "spin.config.ts",
    code: GETTING_STARTED_SNIPPETS.bun,
    note: (
      <>
        Compiles your theme stylesheet and any{" "}
        <A href="/docs/authoring/components">interactive HTML components</A>{" "}
        for Bun bundler builds.
      </>
    ),
  },
  {
    id: "unocss",
    name: "UnoCSS",
    file: "uno.config.ts",
    code: GETTING_STARTED_SNIPPETS.unocss,
    note: (
      <>
        Stylesheet-only preset for existing UnoCSS setups — pass your brand
        theme document directly to <code>spinPreset</code>.
      </>
    ),
  },
];

function BundlerPicker(): JSX.Element {
  const list = bundlerList();
  const [selectedId, setSelectedId] = createSignal("vite");
  const current = (): BundlerTab =>
    list.find((item) => item.id === selectedId()) ?? list[0]!;

  return (
    <div class="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Bundler"
        class="flex flex-wrap gap-1 rounded-lg border bg-surface-sunken p-1"
      >
        <For each={list}>
          {(tab) => {
            const active = () => selectedId() === tab.id;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={active()}
                onClick={() => setSelectedId(tab.id)}
                class={`bare rounded-md px-3 py-1 type-caption-emphasized transition-colors duration-fast ${
                  active()
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted hover:text-primary"
                }`}
              >
                {tab.name}
              </button>
            );
          }}
        </For>
      </div>
      <CodeFrame
        code={current().code}
        lang="ts"
        title={current().file}
      />
      <p class="max-w-prose text-muted">{current().note}</p>
    </div>
  );
}

const PACKAGE_ITEMS: readonly PropEntry[] = [
  {
    name: "@spinjs/dev",
    badge: "devDependency",
    description:
      "Build-time toolchain: bundler plugins, theme compiler, visual Studio, CLI, editor LSP, lints, and MCP server.",
  },
  {
    name: "@spinjs/components",
    badge: "dependency",
    description:
      "Headless statechart machines and lightweight client runtime with React, Solid, Vue, Svelte, and vanilla DOM bindings.",
  },
];

export default function Install(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Bundler Setup"
        lede="Configure Spin in Vite, Rspack, webpack, Rollup, Rolldown, esbuild, Bun, or an existing UnoCSS setup."
      />

      <Section id="packages" title="1. Install the packages">
        <div class="mb-4">
          <Code
            code={GETTING_STARTED_SNIPPETS.install}
            lang="bash"
            title="Terminal"
          />
        </div>
        <PropList items={PACKAGE_ITEMS} />
      </Section>

      <Section id="wire" title="2. Add the bundler plugin">
        <p class="max-w-prose">
          Running <code>npx spin init</code> configures your bundler
          automatically. To set it up by hand, add the plugin below and import{" "}
          <code>spin/styles.css</code> once in your app entry:
        </p>
        <div class="my-4">
          <BundlerPicker />
        </div>
        <div class="mt-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.entry}
            lang="ts"
            title="src/main.ts"
          />
        </div>
      </Section>

      <Section id="layout" title="3. What gets added to your project (and when)">
        <p class="max-w-prose">
          Spin keeps its footprint explicit — nothing is added until a specific
          step needs it, and every directory path can be customized in plugin
          options:
        </p>
        <PropList
          items={[
            {
              name: "spin/",
              badge: "created on spin init",
              description:
                "Holds your brand's theme files. Shaped visually in Studio or edited directly in git (customizable via themesDir).",
            },
            {
              name: ".mcp.json",
              badge: "created on spin init",
              description:
                "Optional MCP server config so Claude Code, Cursor, and other coding agents can query your live theme and components.",
            },
            {
              name: "src/spin-components.d.ts",
              badge: "auto-generated on dev/build",
              description:
                "TypeScript module declarations for Spin's virtual stylesheet and any interactive components in your project.",
            },
            {
              name: "Interactive component folder",
              badge: "created when you copy a component",
              description: (
                <>
                  Created only when you copy an interactive component into your
                  project (defaults to <code>src/lib/components/</code>,
                  customizable via <code>componentsDir</code>). See{" "}
                  <A href="/docs/authoring/components">Interactive Components</A>.
                </>
              ),
            },
          ]}
        />
        <p class="max-w-prose text-muted">
          See <A href="/docs/tooling/cli">CLI &amp; Build Options</A> for all
          custom directory and shortcut settings, or{" "}
          <A href="/docs/getting-started/paths">Incremental Adoption</A> to roll
          Spin into an existing codebase step by step.
        </p>
      </Section>
    </main>
  );
}
