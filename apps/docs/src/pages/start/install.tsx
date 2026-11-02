/**
 * Install & bundlers: the devDependency split, every bundler's config, init
 * flags, and the project layout.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { BundlerPicker, Code, Section } from "../../bits.tsx";
import { SNIPPETS } from "../../snippets.ts";

export default function Install(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Install &amp; bundlers</h1>
      <p class="max-w-screen-md text-text-muted">
        Spin is three packages, installed in two steps: the toolchain as a
        devDependency, the components and their runtime as dependencies.
      </p>

      <Section id="packages" title="Install the packages">
        <Code code={SNIPPETS.install} lang="bash" />
        <div class="mt-4 flex flex-col gap-2">
          <div class="flex flex-col gap-1 border-l-4 border-primary bg-surface-raised rounded-md p-4 md:flex-row md:items-baseline md:gap-4">
            <code class="shrink-0">@spinjs/spin</code>
            <span class="text-sm">
              The build toolchain — a devDependency. The bundler plugins, the
              UnoCSS preset, the theme engine, the `.html` component compiler,
              the CLI, the MCP server, and the Studio.
            </span>
          </div>
          <div class="flex flex-col gap-1 border-l-4 border-primary bg-surface-raised rounded-md p-4 md:flex-row md:items-baseline md:gap-4">
            <code class="shrink-0">@spinjs/components</code>
            <span class="text-sm">
              The stateful components: combobox, date picker, carousel, and the
              rest. Copy a component into your project when you use it.
            </span>
          </div>
          <div class="flex flex-col gap-1 border-l-4 border-primary bg-surface-raised rounded-md p-4 md:flex-row md:items-baseline md:gap-4">
            <code class="shrink-0">@spinjs/runtime</code>
            <span class="text-sm">
              The signals, elements, and machines the components are built on.
              Import it directly only when you build your own component.
            </span>
          </div>
        </div>
      </Section>

      <Section id="init" title="Or start from nothing">
        <p>
          <code>npx spin init</code> detects your bundler, writes the first
          theme, and wires the plugin into your bundler config. The flags name
          what it writes and where.
        </p>
        <table class="wrap">
          <thead>
            <tr>
              <th>Flag</th>
              <th>What it sets</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>--root</code></td>
              <td>The project root to scaffold in. Defaults to the current directory.</td>
            </tr>
            <tr>
              <td><code>--name</code></td>
              <td>The name of the first theme — the file stem under <code>spin/</code>. Defaults to <code>default</code>.</td>
            </tr>
            <tr>
              <td><code>--starter</code></td>
              <td>The starter the theme is seeded from. Defaults to <code>spin</code>.</td>
            </tr>
            <tr>
              <td><code>--bundler</code></td>
              <td>The bundler the generated build config wires: <code>vite</code>, <code>rspack</code>, <code>webpack</code>, <code>rollup</code>, <code>rolldown</code>, <code>esbuild</code>, or <code>bun</code>. Detected when omitted.</td>
            </tr>
            <tr>
              <td><code>--themes-dir</code></td>
              <td>Where the theme documents live. Defaults to <code>spin/</code>.</td>
            </tr>
            <tr>
              <td><code>--components-dir</code></td>
              <td>Where project components live. Defaults to <code>lib/components/</code>.</td>
            </tr>
            <tr>
              <td><code>--prefix</code></td>
              <td>The custom-element prefix compiled components mount under. Defaults to <code>app</code>.</td>
            </tr>
            <tr>
              <td><code>-y</code>, <code>--yes</code></td>
              <td>Skip the interactive prompts.</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="wire" title="Wire your bundler">
        <p>
          Pick your bundler below. All seven <code>spin.&lt;bundler&gt;()</code>
          plugins compile the stylesheet and the project components; only Vite
          mounts the Studio in-process — the other six pair with{" "}
          <code>npx spin studio</code> alongside your dev server.
        </p>
        <BundlerPicker />
        <p>
          Import the generated stylesheet and the component registry once in
          your entry.
        </p>
        <Code code={SNIPPETS.entry} lang="ts" />
        <p>
          Under TypeScript, declare the virtual module.
        </p>
        <Code code={SNIPPETS.declareCss} lang="ts" />
      </Section>

      <Section id="first-markup" title="First markup">
        <p>
          Native elements are styled by the theme. Utilities are for the
          decisions the element leaves open.
        </p>
        <Code code={SNIPPETS.firstMarkup} lang="html" />
      </Section>

      <Section id="layout" title="Project layout">
        <ul class="flow-list">
          <li>
            <code>spin/*.json</code> — the theme documents.
          </li>
          <li>
            <code>lib/components/*.html</code> — project components, compiled
            into <code>&lt;prefix&gt;-&lt;name&gt;</code> custom elements.
          </li>
          <li>
            <code>src/spin-components.d.ts</code> — generated component types
            for DOM and JSX typechecking.
          </li>
        </ul>
        <p>
          The plugin's options are typed; see{" "}
          <A href="/tooling/cli#plugin">CLI &amp; plugin options</A>.
        </p>
        <p>
          The preset path for existing UnoCSS apps is described on{" "}
          <A href="/start/paths#preset">Ways to use Spin</A>.
        </p>
      </Section>
    </main>
  );
}
