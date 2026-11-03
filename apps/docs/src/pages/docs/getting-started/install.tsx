/**
 * Install & Bundlers: package split, `spin init` flags, bundler configs,
 * and project layout.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { BundlerPicker, Code, Section } from "../../../bits.tsx";
import { PageHeader, PropList, type PropEntry } from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./getting-started.snippets.ts";

const PACKAGE_ITEMS: readonly PropEntry[] = [
  {
    name: "@spinjs/spin",
    badge: "devDependency",
    description:
      "The build toolchain: bundler plugins, UnoCSS preset, theme engine, .html component compiler, CLI, MCP server, and Studio.",
  },
  {
    name: "@spinjs/components",
    badge: "dependency",
    description:
      "Headless state-machine components (combobox, date picker, select, toc, carousel, and more) with React, Solid, Vue, and Svelte adapters.",
  },
  {
    name: "@spinjs/runtime",
    badge: "transitive",
    description:
      "Signals, custom-element bridges, and finite-state machines installed automatically with @spinjs/components.",
  },
];

const PLUGIN_OPTIONS: readonly PropEntry[] = [
  {
    name: "themesDir",
    badge: "string",
    defaultValue: '"spin"',
    description: "Local directory containing DTCG theme JSON files.",
  },
  {
    name: "componentsDir",
    badge: "string",
    defaultValue: '"lib/components"',
    description: "Local directory containing .html components compiled into custom elements.",
  },
  {
    name: "prefix",
    badge: "string",
    defaultValue: "package.json name",
    description: "Tag prefix for compiled project components (fallback: \"app\").",
  },
  {
    name: "extends",
    badge: "{ themes?, componentsDir? }",
    description: "Shared brand package whose themes and components sit beneath local overrides.",
  },
  {
    name: "shortcuts",
    badge: "Record<string, string>",
    description: "Project-specific utility compositions layered on top of spinShortcuts.",
  },
  {
    name: "primitives",
    badge: "string[] | boolean",
    defaultValue: "true",
    description: "Subset of element rules to include, or false for a utility-only build.",
  },
  {
    name: "classless",
    badge: "boolean",
    defaultValue: "true",
    description: "When true, element rules style bare tags (<button>, <table>); when false, they require explicit classes (.button, .table).",
  },
  {
    name: "icons",
    badge: "boolean",
    defaultValue: "true",
    description: "Register @unocss/preset-icons with the shipped offline Iconify collections.",
  },
  {
    name: "studio",
    badge: "boolean",
    defaultValue: "true",
    description: "Mount the Studio and /__spin/rpc API on the dev server.",
  },
];

const initFlags = (): readonly PropEntry[] => [
  {
    name: "--root",
    defaultValue: ".",
    description: "The project root directory to scaffold in.",
  },
  {
    name: "--name",
    defaultValue: "default",
    description: (
      <>
        The name of the first theme — written to{" "}
        <code>spin/&lt;name&gt;.json</code>.
      </>
    ),
  },
  {
    name: "--starter",
    defaultValue: "spin",
    description:
      "The shipped starter theme to seed from (spin, silk, material, neobrut, industrial).",
  },
  {
    name: "--bundler",
    defaultValue: "auto-detected",
    description: (
      <>
        Target bundler config to wire: <code>vite</code>, <code>rspack</code>,{" "}
        <code>webpack</code>, <code>rollup</code>, <code>rolldown</code>,{" "}
        <code>esbuild</code>, or <code>bun</code>.
      </>
    ),
  },
  {
    name: "--themes-dir",
    defaultValue: "spin/",
    description: "Directory where DTCG theme JSON documents live.",
  },
  {
    name: "--components-dir",
    defaultValue: "lib/components/",
    description: "Directory where project .html components live.",
  },
  {
    name: "--prefix",
    defaultValue: "derived",
    description: (
      <>
        Custom-element tag prefix derived from <code>package.json</code> name
        (fallback: <code>app</code>), e.g. <code>&lt;app-select&gt;</code>.
      </>
    ),
  },
  {
    name: "--url",
    defaultValue: "in-process",
    description:
      "Connect to a running Studio daemon instead of running in-process.",
  },
  {
    name: "-y, --yes",
    description: "Skip interactive prompts and accept defaults.",
  },
];

export default function Install(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Install & Bundlers"
        lede="Package setup, spin init flags, bundler adapters, plugin configuration reference, and project layout."
      />

      <Section id="packages" title="Install the packages">
        <div class="mb-4">
          <Code
            code={GETTING_STARTED_SNIPPETS.install}
            lang="bash"
            title="Terminal"
          />
        </div>
        <PropList items={PACKAGE_ITEMS} />
      </Section>

      <Section id="init" title="Scaffold with spin init">
        <p class="max-w-prose">
          <code>npx spin init</code> detects your bundler, writes the first
          theme, and wires the plugin into your bundler config.
        </p>
        <div class="mt-3">
          <PropList items={initFlags()} />
        </div>
      </Section>

      <Section id="wire" title="Wire your bundler">
        <p class="max-w-prose">
          Pick your bundler below, then import <code>spin/styles.css</code> and{" "}
          <code>spin/components</code> once in your entry file:
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

      <Section id="config" title="Plugin configuration reference">
        <p class="max-w-prose">
          Every <code>spin.&lt;bundler&gt;(options)</code> adapter accepts the
          same <code>SpinPluginOptions</code> object. All fields are optional:
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.viteOptions}
            lang="ts"
            title="vite.config.ts"
          />
        </div>
        <PropList items={PLUGIN_OPTIONS} />
      </Section>
      <Section id="layout" title="Project layout">
        <PropList
          items={[
            {
              name: "spin/*.json",
              badge: "themes",
              description:
                "DTCG theme documents declaring your palette, scales, modes, and element overrides.",
            },
            {
              name: "spin/config.json",
              badge: "config",
              description:
                "Optional project seating configuration (activeTheme and themeOrder) written by the Studio.",
            },
            {
              name: "lib/components/**/*.html",
              badge: "components",
              description: (
                <>
                  Vendored and custom HTML components compiled into{" "}
                  <code>&lt;prefix&gt;-&lt;name&gt;</code> custom elements.
                </>
              ),
            },
            {
              name: "src/spin-components.d.ts",
              badge: "generated",
              description:
                "Auto-generated virtual module declarations (spin/styles.css, spin/components) and DOM/JSX types for your project components.",
            },
            {
              name: ".mcp.json",
              badge: "agents",
              description:
                "Written by spin init so coding agents automatically connect to the npx spin mcp stdio server.",
            },
          ]}
        />
        <p class="max-w-prose">
          Plugin options are documented in{" "}
          <A href="/docs/tooling/cli#plugin">CLI &amp; Plugin Options</A>. The
          preset-only path for existing UnoCSS apps is covered on{" "}
          <A href="/docs/getting-started/paths#preset">Ways to Use Spin</A>.
        </p>
      </Section>
    </main>
  );
}
