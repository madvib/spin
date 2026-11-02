/**
 * CLI & plugin options: every `spin` command and flag, every
 * `SpinPluginOptions` field, and every published package subpath.
 */
import type { JSX } from "solid-js";
import { Code, Section } from "../../bits.tsx";
import { SNIPPETS } from "../../snippets.ts";

export default function ToolingCli(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>CLI &amp; plugin options</h1>
      <p class="max-w-prose text-text-muted">
        The <code>spin</code> command, the plugin that wires it into your
        bundler, and the subpaths the three packages publish. Options below
        are quoted from the CLI's own usage text and the{" "}
        <code>SpinPluginOptions</code> interface — not a copy.
      </p>

      <Section id="commands" title="Commands">
        <table class="wrap">
          <thead>
            <tr>
              <th>Command</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>spin init</code></td>
              <td>Makes a project: detects the bundler, writes the first theme, and wires the plugin into the bundler config. Rejects <code>bundler: "unocss"</code> — init wires the plugin, never a preset-only config.</td>
            </tr>
            <tr>
              <td><code>spin studio</code></td>
              <td>Opens the standalone theme editor: the API at <code>/rpc</code> and the Studio at <code>/studio/</code>.</td>
            </tr>
            <tr>
              <td><code>spin lint</code></td>
              <td>Runs the rules over a path: closed vocabulary, theme values, semantic HTML, and the source dials.</td>
            </tr>
            <tr>
              <td><code>spin theme</code></td>
              <td>Reads the themes: <code>list</code>, <code>analyze</code>, or <code>scaffold</code> one.</td>
            </tr>
            <tr>
              <td><code>spin component</code></td>
              <td>Reads the components: <code>list</code>, <code>contract</code>, or <code>copy</code> an example into the project.</td>
            </tr>
            <tr>
              <td><code>spin mcp</code></td>
              <td>Runs the agent server over stdio, in-process or dialing a daemon with <code>--url</code>.</td>
            </tr>
            <tr>
              <td><code>spin check</code></td>
              <td>Runs the rendered browser checks over a running app, from the app's check configuration.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Exit codes: <code>0</code> for nothing to report (or only warnings),{" "}
          <code>1</code> for an error to report, <code>2</code> when the CLI
          could not read what it was asked to read.
        </p>
      </Section>

      <Section id="flags" title="Flags, per command">
        <table class="wrap">
          <thead>
            <tr>
              <th>Command</th>
              <th>Flag</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>init</code></td>
              <td><code>--name</code>, <code>--starter</code>, <code>--bundler</code>, <code>--themes-dir</code>, <code>--components-dir</code>, <code>--prefix</code>, <code>--root</code>, <code>--url</code>, <code>-y</code>/<code>--yes</code></td>
              <td>What to write and where. See <code>#init</code> on Install &amp; bundlers.</td>
            </tr>
            <tr>
              <td><code>studio</code></td>
              <td><code>--root</code>, <code>--port</code> (default <code>7463</code>), <code>--host</code> (default <code>127.0.0.1</code>)</td>
              <td>The project to serve and the address to bind.</td>
            </tr>
            <tr>
              <td><code>mcp</code></td>
              <td><code>--root</code>, <code>--url</code></td>
              <td>The project to serve in-process, or the daemon to dial.</td>
            </tr>
            <tr>
              <td><code>theme</code></td>
              <td><code>--root</code>, <code>--url</code>, <code>--format text|json</code></td>
              <td>Where to read, and how the answer is printed.</td>
            </tr>
            <tr>
              <td><code>component</code></td>
              <td><code>--root</code>, <code>--url</code>, <code>--format text|json</code></td>
              <td>Where to read, and how the answer is printed.</td>
            </tr>
            <tr>
              <td><code>lint</code></td>
              <td><code>--format text|json</code>, <code>--strictness strict|balanced|lenient</code>, <code>--semantic-tags all|native|spin|none</code>, <code>--rule</code> (repeatable), <code>--fix</code></td>
              <td>How findings print, which rules run, and whether fixes land in files.</td>
            </tr>
            <tr>
              <td><code>check</code></td>
              <td><code>--format text|json</code>, <code>--config</code> (required), <code>--harness</code>, <code>--route</code> (repeatable), <code>--themes a,b,c</code></td>
              <td>The app's check configuration, which routes and themes to render, and how findings print.</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="plugin" title="Plugin options">
        <p>
          All seven bundler shapes — <code>spin.vite()</code>,{" "}
          <code>spin.rspack()</code>, <code>spin.webpack()</code>,{" "}
          <code>spin.rollup()</code>, <code>spin.rolldown()</code>,{" "}
          <code>spin.esbuild()</code>, <code>spin.bun()</code> — take the same{" "}
          <code>SpinPluginOptions</code> from <code>@spinjs/spin/vite</code>:
        </p>
        <table class="wrap">
          <thead>
            <tr>
              <th>Field</th>
              <th>What it sets</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>themes</code></td>
              <td>The documents to serve verbatim. Omitted, the project serves the brand layer (<code>extends.themes</code>), forked by <code>spin/*.json</code> at its root.</td>
            </tr>
            <tr>
              <td><code>extends</code></td>
              <td>The shared brand as imported values: <code>themes</code> documents plus the brand's <code>componentsDir</code>, resolved like the top-level option.</td>
            </tr>
            <tr>
              <td><code>presets</code></td>
              <td>Presets composed alongside ours — icons are the usual reason.</td>
            </tr>
            <tr>
              <td><code>shortcuts</code></td>
              <td>The project's own class compositions, as an object literal the lint reads too.</td>
            </tr>
            <tr>
              <td><code>content</code></td>
              <td>What to scan: filesystem globs and the pipeline include list.</td>
            </tr>
            <tr>
              <td><code>primitives</code></td>
              <td>Which primitive components to ship: omitted ships all, <code>false</code> ships none, an array ships the named subset.</td>
            </tr>
            <tr>
              <td><code>classless</code></td>
              <td>Whether primitives claim their elements by tag. Default <code>true</code>; <code>false</code> makes the primitive classes explicit.</td>
            </tr>
            <tr>
              <td><code>safelist</code></td>
              <td>Safelists the catalog so a utility named only as data still resolves.</td>
            </tr>
            <tr>
              <td><code>studio</code></td>
              <td>Mounts the Studio and its API on the dev server. Default <code>true</code>; <code>false</code> disables the mount and the launcher entirely.</td>
            </tr>
            <tr>
              <td><code>mount</code></td>
              <td>Overrides the Studio mount — a custom root or studio directory. Omitted, the plugin mounts its own API at the resolved project root.</td>
            </tr>
            <tr>
              <td><code>apiBase</code></td>
              <td>Where the mounted app lives, so the injected overlay script dials the right address.</td>
            </tr>
            <tr>
              <td><code>studioUrl</code></td>
              <td>A studio dev server for the overlay to load instead of the mounted bundle — hot reload while working on the Studio itself.</td>
            </tr>
            <tr>
              <td><code>launcher</code></td>
              <td>Injects the overlay launcher into the app's document. Default <code>true</code>; <code>studio: false</code> disables it too.</td>
            </tr>
            <tr>
              <td><code>themesDir</code></td>
              <td>Project directory holding theme documents. Default <code>"spin"</code>; local paths only — shared trees arrive through <code>extends</code>.</td>
            </tr>
            <tr>
              <td><code>componentsDir</code></td>
              <td>Project directory holding authored <code>.html</code> components. Default <code>"lib/components"</code>; local paths only — shared trees arrive through <code>extends</code>.</td>
            </tr>
            <tr>
              <td><code>prefix</code></td>
              <td>Custom-element prefix for compiled components. Defaults to the sanitized <code>package.json</code> name, else <code>"app"</code>.</td>
            </tr>
          </tbody>
        </table>
        <p>
          A narrowed example — two primitives, explicit classes:
        </p>
        <Code code={SNIPPETS.viteOptions} lang="ts" />
      </Section>

      <Section id="subpaths" title="Published subpaths">
        <p>
          <code>@spinjs/spin</code> — the toolchain. Install as a devDependency:
        </p>
        <table class="wrap">
          <thead>
            <tr>
              <th>Subpath</th>
              <th>What it is</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>@spinjs/spin/vite</code></td>
              <td>The unplugin in all seven shapes, plus <code>SpinPluginOptions</code>.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/preset</code></td>
              <td>The UnoCSS preset (<code>spinPreset</code>), the stylesheet-only path.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/cli</code></td>
              <td>The <code>spin</code> command implementation.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/mcp</code></td>
              <td>The MCP agent server.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/api</code></td>
              <td>The daemon API surface, including <code>mountSpinApp</code>.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/theme</code></td>
              <td>The theme engine: parsing, validation, gates, and starters.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/kit</code></td>
              <td>Shared page bits: code blocks, sections, specimens, theme controls.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/animation</code></td>
              <td>Theme-driven keyframes and the animation contract.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/eslint</code>, <code>@spinjs/spin/oxlint</code></td>
              <td>The lint plugins for editors and CI.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/diagnostics</code></td>
              <td>The lint rules and their schemas.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/project</code></td>
              <td>Project reads and writes: themes, components, configuration.</td>
            </tr>
            <tr>
              <td><code>@spinjs/spin/skill</code></td>
              <td>The house skill assembly the docs site serves to agents.</td>
            </tr>
          </tbody>
        </table>
        <p>
          <code>@spinjs/components</code> — one subpath per component, plus the
          three adapters and the element base:
        </p>
        <table class="wrap">
          <thead>
            <tr>
              <th>Subpath</th>
              <th>What it is</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>@spinjs/components/&lt;name&gt;</code></td>
              <td>One component's <code>DefinedComponent</code> — <code>select</code>, <code>combobox</code>, <code>date-picker</code>, and the other thirty-four.</td>
            </tr>
            <tr>
              <td><code>@spinjs/components/react</code></td>
              <td><code>useSpinComponent</code> — drive a mounted element from React.</td>
            </tr>
            <tr>
              <td><code>@spinjs/components/solid</code></td>
              <td><code>createSpinComponent</code> — drive a mounted element from Solid.</td>
            </tr>
            <tr>
              <td><code>@spinjs/components/controller</code></td>
              <td><code>spinComponentCtl</code> — drive a mounted element from vanilla DOM, Vue, or Svelte.</td>
            </tr>
            <tr>
              <td><code>@spinjs/components/spin-element</code></td>
              <td>The custom-element base the compiled components extend.</td>
            </tr>
          </tbody>
        </table>
        <p>
          <code>@spinjs/runtime</code> — the reactive core and its seams:
        </p>
        <table class="wrap">
          <thead>
            <tr>
              <th>Subpath</th>
              <th>What it is</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>@spinjs/runtime</code></td>
              <td>Signals, <code>defineComponent</code>, <code>defineController</code>, directives, and math.</td>
            </tr>
            <tr>
              <td><code>@spinjs/runtime/fsm</code></td>
              <td><code>createMachine</code> and <code>interpret</code> — the statechart interpreter.</td>
            </tr>
            <tr>
              <td><code>@spinjs/runtime/actions</code></td>
              <td><code>createAction</code> plus the shipped element actions.</td>
            </tr>
            <tr>
              <td><code>@spinjs/runtime/props</code></td>
              <td>Prop coercion helpers for machine input.</td>
            </tr>
            <tr>
              <td><code>@spinjs/runtime/load</code></td>
              <td>The component loader the compiled elements call.</td>
            </tr>
            <tr>
              <td><code>@spinjs/runtime/testing</code></td>
              <td>Test harnesses for machines and components.</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </main>
  );
}
