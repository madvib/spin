/**
 * Quickstart: from an empty folder to a themed app with the Studio open.
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
        lede="From an empty project to a themed app with the Studio and MCP server wired."
      />

      <Section id="init" title="1. Install and initialize">
        <p class="max-w-prose">
          Install the packages and run <code>npx spin init</code>. Spin detects
          your bundler, writes <code>spin/default.json</code>, wires{" "}
          <code>spin.vite()</code> into <code>vite.config.ts</code>, and
          generates <code>.mcp.json</code> plus{" "}
          <code>src/spin-components.d.ts</code>.
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={GETTING_STARTED_SNIPPETS.install}
            lang="bash"
            title="1. Install"
          />
          <Code
            code={GETTING_STARTED_SNIPPETS.init}
            lang="bash"
            title="2. Initialize"
          />
        </div>
      </Section>

      <Section id="sheet" title="2. Import styles and components">
        <p class="max-w-prose">
          Import <code>spin/styles.css</code> and <code>spin/components</code>{" "}
          in your entry file:
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.entry}
            lang="ts"
            title="src/main.ts"
          />
        </div>
      </Section>

      <Section id="markup" title="3. Write markup and copy a component">
        <p class="max-w-prose">
          Native tags and Spin elements (<code>&lt;card&gt;</code>,{" "}
          <code>&lt;button class="primary"&gt;</code>,{" "}
          <code>&lt;input&gt;</code>) arrive styled by the theme. Copy stateful
          components into <code>src/lib/components/</code> when you need interactive
          behavior:
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={GETTING_STARTED_SNIPPETS.firstMarkup}
            lang="html"
            title="App.tsx"
          />
          <Code
            code="npx spin component copy select basic"
            lang="bash"
            title="Writes src/lib/components/select/basic.html -> <app-select-basic>"
          />
        </div>
      </Section>

      <Section id="studio" title="4. Open the Studio & connect your agent">
        <p class="max-w-prose">
          During development, the <A href="/studio">Studio</A> mounts at{" "}
          <code>/__spin/studio/</code> on your dev server (or run{" "}
          <code>npx spin studio</code> standalone).{" "}
          <code>npx spin init</code> also writes <code>.mcp.json</code> so
          coding agents automatically connect to <code>npx spin mcp</code> —
          pair it with the{" "}
          <a href="/llms.txt" target="_blank" rel="noreferrer">
            /llms.txt agent guide
          </a>{" "}
          or the prompt below:
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.agentPrompt}
            lang="md"
            title="Prompt for your coding agent"
          />
        </div>
      </Section>
    </main>
  );
}
