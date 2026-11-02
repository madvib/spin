/**
 * Ways to use Spin: the plugin, the UnoCSS preset alone, the standalone
 * Studio, and the CLI/MCP. The table states what each entry gives and what it
 * does not, so choosing one is an explicit trade.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Code, Section } from "../../bits.tsx";
import { SNIPPETS } from "../../snippets.ts";

export default function Paths(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Ways to use Spin</h1>
      <p class="max-w-prose text-text-muted">
        Spin is one theme language with four supported entry points. They share
        the token contract and the CSS vocabulary; they differ in what reads
        your project and what runs beside your app.
      </p>

      <div class="mt-6 overflow-x-auto">
        <table class="wrap">
          <thead>
            <tr>
              <th>Need</th>
              <th>Entry</th>
              <th>Gives</th>
              <th>Does not give</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>App + live Studio</td>
              <td>
                <code>spin.vite()</code>
              </td>
              <td>
                sheet, primitives, project theme discovery, project component
                transform/types, Studio overlay/live repaint
              </td>
              <td>—</td>
            </tr>
            <tr>
              <td>Stylesheet in an existing UnoCSS app</td>
              <td><code>spinPreset</code></td>
              <td>
                token sheet, utilities, and element CSS from explicit theme
                documents
              </td>
              <td>
                component syntax and runtime bundling, project transform/types,
                mounted Studio, <code>spin/*.json</code> discovery; themes are
                copied into the config and can drift
              </td>
            </tr>
            <tr>
              <td>Theme editing without an app</td>
              <td><code>spin studio</code></td>
              <td>
                Studio at <code>/studio/</code>, API at <code>/rpc</code>
              </td>
              <td>app sheet, overlay</td>
            </tr>
            <tr>
              <td>Source/theme tools</td>
              <td>
                <code>spin lint</code>, <code>spin theme</code>,{" "}
                <code>spin component</code>, <code>spin mcp</code>
              </td>
              <td>
                lints, theme/component reads, MCP
              </td>
              <td>CSS generation</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Section id="plugin" title="Full plugin">
        <p>
          The Spin plugin is the unplugin, in all seven shapes:{" "}
          <code>spin.vite()</code>, <code>spin.rspack()</code>,{" "}
          <code>spin.webpack()</code>, <code>spin.rollup()</code>,{" "}
          <code>spin.rolldown()</code>, <code>spin.esbuild()</code>, and{" "}
          <code>spin.bun()</code>. It replaces <code>@unocss/vite</code>, owns
          the sheet, discovers <code>spin/*.json</code>, transforms project{" "}
          <code>lib/components/*.html</code>, generates{" "}
          <code>src/spin-components.d.ts</code>, and mounts the Studio on
          its own dev server. Vite is the only shape with the Studio
          overlay and live repaint; the other unplugin shapes get the sheet and
          the build stages.
        </p>
        <p>
          <code>spin init</code> scaffolds seven unplugin targets:{" "}
          <code>vite</code>, <code>rspack</code>, <code>webpack</code>,{" "}
          <code>rollup</code>, <code>rolldown</code>, <code>esbuild</code>, and{" "}
          <code>bun</code>, all importing <code>@spinjs/spin/vite</code>.
          A project already on <code>uno.config.ts</code> is not scaffolded:
          see the preset boundary below.
        </p>
        <Code class="mt-3" code={SNIPPETS.vite} lang="ts" />
        <Code class="mt-3" code={SNIPPETS.studio} lang="ts" />
        <p>
          The plugin's options are typed; see{" "}
          <A href="/tooling/cli#plugin">CLI &amp; plugin options</A>.
        </p>
      </Section>

      <Section id="preset" title="Stylesheet only, in an existing UnoCSS app">
        <div class="mt-4 stack-sm rounded-md border border-border bg-surface-raised p-4">
          <p class="font-semibold text-text">
            This is not a Spin app. It is the stylesheet.
          </p>
          <p class="text-text-muted">
            <code>spinPreset</code> is for a project that already owns{" "}
            <code>uno.config.ts</code> and wants spin's tokens, utilities, and
            element CSS <em>and nothing else</em>. The component syntax, the
            machine components' bundling, the project <code>.html</code>
            transform, the generated component types, and the mounted Studio
            all come from the plugin. The standalone Studio can still be run
            by hand.
          </p>
        </div>
        <p>
          The theme is explicit: import the document and put it in the{" "}
          <code>themes</code> map. The preset does not read{" "}
          <code>spin/*.json</code>, so every new theme is a config edit and the
          config can drift from the project's theme directory. That drift is
          the main reason this is an alternative, not the default.
        </p>
        <Code class="mt-3" code={SNIPPETS.unocss} lang="ts" />
        <p>
          An existing <code>uno.config.ts</code> that is already wired is left
          untouched by <code>spin init</code>; add each new theme to its{" "}
          <code>themes</code> map yourself. The preset path does not provide
          the overlay, the project <code>.html</code> transform, or the
          generated component types.
        </p>
        <p>
          Components are ordinary JavaScript packages bundled by the
          consumer's bundler; the preset supplies their CSS, not their JS or
          the transform. Use <code>@spinjs/components</code> and{" "}
          <code>@spinjs/runtime</code> directly when you want the machine
          components.
        </p>
      </Section>

      <Section id="studio" title="Standalone Studio">
        <p>
          Theme editing without an app: <code>spin studio</code> starts the
          daemon and serves the editor at{" "}
          <code>http://localhost:7463/studio/</code>. It edits themes; it does
          not mount an app overlay or generate an app sheet.
        </p>
        <Code class="mt-3" code={SNIPPETS.studioServe} lang="bash" />
        <p>
          The published package ships the Studio bundle. A source checkout
          needs <code>bun run build:studio</code> before the route is served.
        </p>
      </Section>

      <Section id="tools" title="CLI and MCP">
        <p>
          The CLI and the MCP server work without the plugin. They read the
          project's files and answer; they do not generate CSS. Lint a path:
        </p>
        <Code class="mt-3" code={SNIPPETS.lint} lang="bash" />
        <Code class="mt-3" code={SNIPPETS.lintFix} lang="bash" />
        <p>
          The MCP server runs over stdio and reads the project in-process, or
          dials a running daemon with <code>--url</code>:
        </p>
        <Code class="mt-3" code={SNIPPETS.mcp} lang="bash" />
        <p>
          <code>spin studio</code> serves the RPC that{" "}
          <code>spin mcp --url</code> dials. The{" "}
          <A href="/tooling/mcp">MCP page</A> lists the tools and resources.
        </p>
      </Section>

      <Section id="components" title="Components">
        <p>
          <code>@spinjs/components</code> and <code>@spinjs/runtime</code> are
          ordinary packages; any bundler can build them. The plugin adds the
          project <code>.html</code> component transform and the generated
          types on top. See <A href="/components">Components</A> for the
          library.
        </p>
      </Section>

      <p class="text-sm text-text-muted">
        Read next: <A href="/themes">Theme contract</A>,{" "}
        <A href="/studio">Studio</A>,{" "}
        <A href="/tooling/mcp">MCP &amp; agents</A>, and{" "}
        <A href="/components">Components</A>.
      </p>
    </main>
  );
}
