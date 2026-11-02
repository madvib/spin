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
    badge: "dependency",
    description:
      "Reactive signals, custom-element bridges, and finite-state machines that power @spinjs/components.",
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
      "The shipped starter theme to seed from (spin, silk, brutalist, console, bloom).",
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
    defaultValue: "app",
    description: (
      <>
        Custom-element tag prefix for compiled project components (e.g.{" "}
        <code>&lt;app-select&gt;</code>).
      </>
    ),
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
        lede="Spin ships as three lockstep packages: the toolchain as a devDependency, and the component machines and runtime as dependencies."
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
          Pick your bundler below. All seven <code>spin.&lt;bundler&gt;()</code>{" "}
          plugins compile the stylesheet and project components; Vite
          additionally mounts the Studio in-process, while the other six pair
          with <code>npx spin studio</code> alongside your dev server.
        </p>
        <div class="my-4">
          <BundlerPicker />
        </div>
        <p class="max-w-prose">
          Import the generated stylesheet once in your entry file, and declare
          the virtual module for TypeScript:
        </p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={GETTING_STARTED_SNIPPETS.entry}
            lang="ts"
            title="src/main.ts"
          />
          <Code
            code={GETTING_STARTED_SNIPPETS.declareCss}
            lang="ts"
            title="src/uno.d.ts"
          />
        </div>
      </Section>

      <Section id="first-markup" title="First markup">
        <p class="max-w-prose">
          Native elements are styled by the theme. Utilities are for the
          layout decisions the element leaves open.
        </p>
        <div class="mt-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.firstMarkup}
            lang="html"
            title="App.tsx"
          />
        </div>
      </Section>

      <Section id="layout" title="Project layout">
        <PropList
          items={[
            {
              name: "spin/*.json",
              badge: "themes",
              description:
                "DTCG theme documents and spin/config.json seating configuration.",
            },
            {
              name: "lib/components/*.html",
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
                "Auto-generated DOM and JSX type declarations for your project components.",
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
