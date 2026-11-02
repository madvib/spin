/**
 * Quickstart: from an empty folder to a themed app with the Studio open.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { BundlerPicker, Code, Section } from "../../../bits.tsx";
import { PageHeader } from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./getting-started.snippets.ts";

export default function Quickstart(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Quickstart"
        lede="Four steps: initialize or install, wire your bundler, import the stylesheet and component registry, then vendor a component and open the Studio."
      />

      <Section id="install" title="1. Initialize or install">
        <p class="max-w-prose">
          Starting from an empty folder, <code>npx spin init</code> detects
          your bundler, writes the first theme to <code>spin/default.json</code>,
          and wires the plugin into your bundler config. In an existing
          project, install the three packages directly: the toolchain as a
          devDependency, the components and their runtime as dependencies.
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.install}
            lang="bash"
            title="Terminal"
          />
        </div>
        <p class="max-w-prose">
          Three packages, released in lockstep: the toolchain (
          <code>@spinjs/spin</code>), the stateful components (
          <code>@spinjs/components</code>), and the component runtime (
          <code>@spinjs/runtime</code>).
        </p>
      </Section>

      <Section id="bundler" title="2. Wire your bundler">
        <p class="max-w-prose">
          Pick your bundler below. Every <code>spin.&lt;bundler&gt;()</code>{" "}
          plugin compiles the <code>uno.css</code> stylesheet and your
          project's <code>lib/components/*.html</code>; Vite additionally
          mounts the Studio on its own dev server, while the other six pair
          with <code>npx spin studio</code> alongside your dev server.
        </p>
        <div class="mt-3">
          <BundlerPicker />
        </div>
      </Section>

      <Section
        id="sheet"
        title="3. Import the stylesheet and component registry"
      >
        <p class="max-w-prose">
          The plugin answers for <code>uno.css</code> as a virtual module and
          for <code>spin/components</code> as the registry of your project's
          compiled components. Import both from the entry your bundler reads.
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.entry}
            lang="ts"
            title="src/main.ts"
          />
        </div>
        <p class="max-w-prose">
          Under TypeScript, declare the virtual modules once.
        </p>
        <div class="mt-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.declareCss}
            lang="ts"
            title="src/uno.d.ts"
          />
        </div>
      </Section>

      <Section id="component" title="4. Vendor a component and open the Studio">
        <p class="max-w-prose">
          Components are copied into your project, not imported from a package:
          you own the markup and restyle it through the theme.
        </p>
        <div class="my-3">
          <Code
            code="npx spin component copy select basic"
            lang="bash"
            title="Terminal"
          />
        </div>
        <p class="max-w-prose">
          That writes <code>lib/components/select.html</code>, which the plugin
          compiles into a custom element you mount as{" "}
          <code>&lt;app-select&gt;</code>. Then open the Studio against the
          running project and edit the theme live.
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.studioServe}
            lang="bash"
            title="Terminal"
          />
        </div>
        <p class="max-w-prose">
          The Studio's own walkthrough — themes, colors, type, icons, motion,
          spacing, components, and findings — is on{" "}
          <A href="/studio">Using the Studio</A>.
        </p>
      </Section>
    </main>
  );
}
