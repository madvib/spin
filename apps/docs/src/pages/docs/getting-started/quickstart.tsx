/**
 * Quickstart: from an empty folder to a themed app with the Studio open.
 */
import type { JSX } from "solid-js";
import { Code, PageHeader, Section } from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./getting-started.snippets.ts";

export default function Quickstart(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Quickstart"
        lede="Install the two packages, initialize your project, and launch the live Studio in two minutes."
      />

      <Section id="init" title="1. Install and initialize">
        <p class="max-w-prose">
          Install <code>@spinjs/dev</code> and <code>@spinjs/components</code>,
          then run <code>npx spin init</code>. Spin detects your bundler, creates
          your starter brand in <code>spin/&lt;brand&gt;/tokens.json</code>, adds
          the bundler plugin, and sets up TypeScript and MCP editor integration.
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
            title="2. Initialize your brand"
          />
        </div>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.brandTree}
            lang="bash"
            title="Your brand directory on disk"
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

      <Section id="studio" title="4. Customize visually in Studio">
        <p class="max-w-prose">
          Start your dev server and click the floating <strong>Studio</strong>{" "}
          button in the bottom-right corner of your app (or run{" "}
          <code>npx spin studio</code> if your bundler doesn't run a dev
          server). Adjust colors, fonts, spacing, and radii against your live UI
          and click <strong>Save</strong> to write changes to{" "}
          <code>spin/&lt;brand&gt;/</code>.
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
