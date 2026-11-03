/**
 * Quickstart: from an empty folder to a themed app with the Studio open.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, Section } from "../../../bits.tsx";
import { PageHeader } from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./getting-started.snippets.ts";

export default function Quickstart(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Quickstart"
        lede="Five steps: install and initialize, import the stylesheet and component registry, write classless markup and vendor a component, open the Studio, and onboard your coding agent."
      />

      <Section id="init" title="1. Install and initialize">
        <p class="max-w-prose">
          Install the toolchain as a devDependency alongside the stateful
          components and their runtime, then run <code>npx spin init</code>.
          Spin detects your bundler, writes <code>spin/default.json</code>{" "}
          (complete with light + dark modes and web fonts), wires{" "}
          <code>spin.vite()</code> into <code>vite.config.ts</code>, and writes{" "}
          <code>.mcp.json</code> plus <code>src/spin-components.d.ts</code> (see{" "}
          <A href="/docs/getting-started/install#wire">Install &amp; Bundlers</A>{" "}
          for Rspack, webpack, Rollup, Rolldown, esbuild, Bun, and UnoCSS).
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={GETTING_STARTED_SNIPPETS.install}
            lang="bash"
            title="1. Install packages"
          />
          <Code
            code={GETTING_STARTED_SNIPPETS.init}
            lang="bash"
            title="2. Scaffold spin/default.json, bundler & MCP config"
          />
        </div>
      </Section>

      <Section
        id="sheet"
        title="2. Import the stylesheet and component registry"
      >
        <p class="max-w-prose">
          The plugin serves <code>spin/styles.css</code> as the token + utility
          stylesheet and <code>spin/components</code> as the registry of your
          project's compiled custom elements. Import both once in your app's
          entry file — <code>src/spin-components.d.ts</code> is generated
          automatically so TypeScript knows both virtual modules with zero
          manual <code>.d.ts</code> files:
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={GETTING_STARTED_SNIPPETS.entry}
            lang="ts"
            title="src/main.ts"
          />
          <Code
            code={GETTING_STARTED_SNIPPETS.declareCss}
            lang="ts"
            title="src/spin-components.d.ts (auto-generated)"
          />
        </div>
      </Section>

      <Section
        id="markup"
        title="3. Write classless markup and vendor a component"
      >
        <p class="max-w-prose">
          Semantic HTML elements are styled directly by your theme, while layout
          and composition utilities (such as <code>stack</code>) spend theme
          spacing steps. Stateful interactive controls are copied into your
          repository so you own the markup:
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
            title="Vendor select/basic.html into lib/components/"
          />
        </div>
        <p class="max-w-prose">
          Copying a recipe writes{" "}
          <code>lib/components/select/basic.html</code>, updates{" "}
          <code>src/spin-components.d.ts</code>, and compiles it into a custom
          element you mount as <code>&lt;app-select-basic&gt;</code> (using your{" "}
          <code>package.json</code> prefix, or move it to{" "}
          <code>lib/components/select.html</code> to mount as{" "}
          <code>&lt;app-select&gt;</code>).
        </p>
      </Section>

      <Section id="studio" title="4. Open the Studio">
        <p class="max-w-prose">
          On Vite, the Studio is mounted automatically on your dev server at{" "}
          <code>http://localhost:5173/__spin/studio/</code> and reachable from
          the bottom-right launcher pill in development with zero extra
          commands. On Rspack, webpack, Rollup, Rolldown, esbuild, or Bun, run
          the standalone Studio daemon alongside your dev server:
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.studioServe}
            lang="bash"
            title="Non-Vite bundlers"
          />
        </div>
        <p class="max-w-prose">
          The Studio's walkthrough — themes, colors, type, icons, motion,
          spacing, components, and findings — is on{" "}
          <A href="/studio">Using the Studio</A>.
        </p>
      </Section>

      <Section id="agents" title="5. Onboard your coding agent">
        <p class="max-w-prose">
          <code>npx spin init</code> automatically writes{" "}
          <code>.mcp.json</code> at your project root so Claude Code, Cursor,
          and MCP-compatible agents can call <code>npx spin mcp</code> to
          inspect tokens, copy components, and run diagnostics. Paste the
          instructions below into your project's <code>AGENTS.md</code> or{" "}
          <code>CLAUDE.md</code> (or send it directly to your agent) so it
          writes idiomatic classless Spin markup instead of ad-hoc CSS:
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.agentPrompt}
            lang="md"
            title="AGENTS.md / Copy for your coding agent"
          />
        </div>
      </Section>
    </main>
  );
}
