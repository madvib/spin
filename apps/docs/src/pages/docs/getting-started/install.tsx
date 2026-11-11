/**
 * Install & Bundlers: package split, `spin init` flags, bundler configs,
 * and project layout.
 */
import { createEffect, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { createSpinComponent } from "@spinjs/components/solid";
import { tabs } from "@spinjs/components/tabs";
import {
  Code,
  CodeFrame,
  PageHeader,
  PropList,
  Section,
  type PropEntry,
} from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./getting-started.snippets.ts";

const BUNDLER_TABS: Readonly<
  Record<
    string,
    {
      readonly name: string;
      readonly file: string;
      readonly code: string;
      readonly note: string;
    }
  >
> = {
  vite: {
    name: "Vite",
    file: "vite.config.ts",
    code: GETTING_STARTED_SNIPPETS.vite,
    note: "Compiles styles, builds HTML components, and injects the floating Studio launcher during development.",
  },
  rspack: {
    name: "Rspack",
    file: "rspack.config.ts",
    code: GETTING_STARTED_SNIPPETS.rspack,
    note: "Compiles spin/styles.css and transforms src/lib/components/**/*.html.",
  },
  webpack: {
    name: "webpack",
    file: "webpack.config.mjs",
    code: GETTING_STARTED_SNIPPETS.webpack,
    note: "Compiles spin/styles.css and transforms src/lib/components/**/*.html.",
  },
  rollup: {
    name: "Rollup",
    file: "rollup.config.mjs",
    code: GETTING_STARTED_SNIPPETS.rollup,
    note: "Compiles spin/styles.css and transforms src/lib/components/**/*.html.",
  },
  rolldown: {
    name: "Rolldown",
    file: "rolldown.config.ts",
    code: GETTING_STARTED_SNIPPETS.rolldown,
    note: "Compiles spin/styles.css and transforms src/lib/components/**/*.html.",
  },
  esbuild: {
    name: "esbuild",
    file: "spin.config.ts",
    code: GETTING_STARTED_SNIPPETS.esbuild,
    note: "Compiles spin/styles.css and transforms src/lib/components/**/*.html.",
  },
  bun: {
    name: "Bun",
    file: "spin.config.ts",
    code: GETTING_STARTED_SNIPPETS.bun,
    note: "Compiles spin/styles.css and transforms src/lib/components/**/*.html.",
  },
  unocss: {
    name: "UnoCSS",
    file: "uno.config.ts",
    code: GETTING_STARTED_SNIPPETS.unocss,
    note: "Stylesheet only: `spinPreset` in an existing UnoCSS app, with explicit theme documents.",
  },
};

function BundlerPicker(): JSX.Element {
  const [tabsEl, setTabsEl] = createSignal<HTMLElement>();
  const tabsCtl = createSpinComponent(tabsEl, tabs);
  const [selected, setSelected] = createSignal("vite");

  createEffect(() => {
    tabsCtl.bind(
      { value: selected() },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          if (event.detail.value in BUNDLER_TABS) {
            setSelected(event.detail.value);
          }
        },
      },
    );
  });

  const current = () => BUNDLER_TABS[selected()] ?? BUNDLER_TABS.vite!;

  return (
    <div class="flex flex-col gap-3">
      <docs-bundler-tabs ref={setTabsEl} />
      <CodeFrame
        code={current().code}
        lang="ts"
        title={current().file}
      />
      <p class="text-muted">{current().note}</p>
    </div>
  );
}

const PACKAGE_ITEMS: readonly PropEntry[] = [
  {
    name: "@spinjs/dev",
    badge: "devDependency",
    description:
      "The build toolchain: bundler plugins, UnoCSS preset, theme engine, .html component compiler, CLI, LSP, lints, MCP server, and Studio.",
  },
  {
    name: "@spinjs/components",
    badge: "dependency",
    description:
      "Headless state-machine components (combobox, date picker, select, toc, carousel, and more) with React, Solid, Vue, and Svelte adapters.",
  },
  {
    name: "@spinjs/components/runtime",
    badge: "subpath",
    description:
      "Signals, custom-element bridges, and finite-state machines — a subpath of @spinjs/components, no separate install.",
  },
];

export default function Install(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Bundler Setup"
        lede="Configure Spin in Vite, Rspack, webpack, Rollup, Rolldown, esbuild, Bun, or UnoCSS."
      />

      <Section id="packages" title="1. Install the two packages">
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
          Run <code>npx spin init</code> to wire your bundler automatically, or
          add the plugin to your config manually and import{" "}
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

      <Section id="layout" title="3. Files added to your project">
        <PropList
          items={[
            {
              name: "spin/<brand>/tokens.json",
              badge: "theme",
              description:
                "Your brand's colors, typography, spacing, radii, and dark mode overrides.",
            },
            {
              name: "src/lib/components/",
              badge: "components",
              description:
                "Interactive components copied into your repo with npx spin component copy.",
            },
            {
              name: "src/spin-components.d.ts",
              badge: "types",
              description:
                "Generated TypeScript declarations for spin/styles.css and your project's custom elements.",
            },
            {
              name: ".mcp.json",
              badge: "AI",
              description:
                "Connects Claude Code, Cursor, and other MCP-compatible coding agents to your project.",
            },
          ]}
        />
        <p class="max-w-prose text-muted">
          Need CLI flags or advanced plugin options? See the{" "}
          <A href="/docs/tooling/cli">CLI Reference</A>. Adopting Spin inside an
          existing app? Read{" "}
          <A href="/docs/getting-started/paths">Incremental Adoption</A>.
        </p>
      </Section>
    </main>
  );
}
