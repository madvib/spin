/**
 * Quickstart: from an empty folder to a themed app with the Studio open.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { BundlerPicker, Code, Section } from "../../bits.tsx";
import { SNIPPETS } from "../../snippets.ts";

export default function Quickstart(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1>Quickstart</h1>
      <p class="max-w-screen-md text-text-muted">
        Four steps: initialize or install, wire your bundler, import the
        stylesheet and the component registry, then vendor a component and open
        the Studio.
      </p>

      <div class="mt-8 grid gap-2">
        <Section id="install" title="1. Initialize or install">
          <p>
            Starting from an empty folder, <code>npx spin init</code> detects
            your bundler, writes the first theme to <code>spin/default.json</code>,
            and wires the plugin into your bundler config. In an existing
            project, install the three packages directly: the toolchain as a
            devDependency, the components and their runtime as dependencies.
          </p>
          <Code code={SNIPPETS.install} lang="bash" />
          <p>
            Three packages, released in lockstep: the toolchain
            (<code>@spinjs/spin</code>), the stateful components
            (<code>@spinjs/components</code>), and the component runtime
            (<code>@spinjs/runtime</code>).
          </p>
        </Section>

        <Section id="bundler" title="2. Wire your bundler">
          <p>
            Pick your bundler below. Every <code>spin.&lt;bundler&gt;()</code>
            plugin compiles the <code>uno.css</code> stylesheet and your
            project's <code>lib/components/*.html</code>; Vite additionally
            mounts the Studio on its own dev server, while the other six
            pair with <code>npx spin studio</code> alongside your dev
            server.
          </p>
          <BundlerPicker />
        </Section>

        <Section id="sheet" title="3. Import the stylesheet and component registry">
          <p>
            The plugin answers for <code>uno.css</code> as a virtual module and
            for <code>spin/components</code> as the registry of your project's
            compiled components. Import both from the entry your bundler reads.
          </p>
          <Code code={SNIPPETS.entry} lang="ts" />
          <p>
            Under TypeScript, declare the virtual modules once.
          </p>
          <Code code={SNIPPETS.declareCss} lang="ts" />
        </Section>

        <Section id="component" title="4. Vendor a component and open the Studio">
          <p>
            Components are copied into your project, not imported from a
            package: you own the markup and restyle it through the theme.
          </p>
          <Code code="npx spin component copy select basic" lang="bash" />
          <p>
            That writes <code>lib/components/select.html</code>, which the
            plugin compiles into a custom element you mount as{" "}
            <code>&lt;app-select&gt;</code>. Then open the Studio against the
            running project and edit the theme live.
          </p>
          <Code code={SNIPPETS.studioServe} lang="bash" />
          <p>
            The Studio's own walkthrough — themes, colors, type, icons, motion,
            spacing, components, and findings — is on{" "}
            <A href="/studio">Using the Studio</A>.
          </p>
        </Section>
      </div>

      <nav
        aria-label="Continue"
        class="mt-6 flex flex-wrap gap-2 border-t border-border pt-5 text-sm"
      >
        <A
          href="/start/model"
          class="rounded-sm border border-border px-3 py-2 no-underline transition-colors duration-fast hover:bg-surface-raised"
        >
          Mental model
        </A>
        <A
          href="/themes"
          class="rounded-sm border border-border px-3 py-2 no-underline transition-colors duration-fast hover:bg-surface-raised"
        >
          Themes
        </A>
        <A
          href="/guide/markup"
          class="rounded-sm border border-border px-3 py-2 no-underline transition-colors duration-fast hover:bg-surface-raised"
        >
          Markup &amp; elements
        </A>
      </nav>
    </main>
  );
}
