/**
 * Quickstart: install Spin, import your stylesheet, write HTML, and shape your brand in Studio.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, PageHeader, Section } from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./getting-started.snippets.ts";

export default function Quickstart(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Quickstart"
        lede="Go from a fresh project to styled HTML and the visual Theme Studio in two minutes."
      />

      <Section id="install" title="1. Install and scaffold">
        <p class="max-w-prose">
          Install Spin's build toolchain and component runtime, then run the
          interactive initializer. Spin detects your bundler, wires the plugin,
          and seeds a starter brand you can customize in Studio.
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={GETTING_STARTED_SNIPPETS.install}
            lang="bash"
            title="Install packages"
          />
          <Code
            code={GETTING_STARTED_SNIPPETS.init}
            lang="bash"
            title="Scaffold project"
          />
        </div>
      </Section>

      <Section id="styles" title="2. Import your stylesheet">
        <p class="max-w-prose">
          Add Spin's virtual stylesheet once in your application entry file:
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.entry}
            lang="ts"
            title="src/main.ts"
          />
        </div>
      </Section>

      <Section id="studio" title="3. Shape your brand in Studio">
        <p class="max-w-prose">
          Start your dev server (on Vite, Studio mounts automatically alongside
          your app) or launch Studio standalone from the terminal. Pick a
          starting design language, adjust your colors, font pairings, and
          spacing against live UI previews, and click <strong>Save</strong>.
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.studioServe}
            lang="bash"
            title="Launch standalone Studio"
          />
        </div>
      </Section>

      <Section id="markup" title="4. Write your first UI">
        <p class="max-w-prose">
          Standard HTML controls and Spin surfaces render styled from your brand
          immediately, arranged with familiar flex, grid, and spacing utilities:
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.firstMarkup}
            lang="html"
            title="App.tsx"
          />
        </div>
        <p class="max-w-prose text-muted">
          Ready to add interactive widgets like selects, comboboxes, menus, or
          date pickers? See{" "}
          <A href="/docs/authoring/components">Interactive Components</A>. Using
          Claude Code, Cursor, or another AI editor? See{" "}
          <A href="/docs/tooling/mcp">MCP Server</A>.
        </p>
      </Section>
    </main>
  );
}
