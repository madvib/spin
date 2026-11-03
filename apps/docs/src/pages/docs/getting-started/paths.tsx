/**
 * Ways to Use Spin: full bundler plugin, UnoCSS preset-only, standalone Studio,
 * and CLI / MCP tools.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Code, Section } from "../../../bits.tsx";
import { PageHeader, PropList, type PropEntry } from "../../../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./getting-started.snippets.ts";
import { TOOLING_SNIPPETS } from "../tooling/tooling.snippets.ts";

const ENTRY_PATHS: readonly PropEntry[] = [
  {
    name: "spin.vite() / spin.<bundler>()",
    badge: "Full app + Studio",
    description:
      "Provides the token stylesheet, classless primitives, spin/*.json discovery, project lib/components/*.html compiler and types, plus the live Studio overlay on Vite.",
  },
  {
    name: "spin.vite({ extends: brand })",
    badge: "Multi-app brand",
    description:
      "Layers a shared brand package's themes and components beneath local spin/*.json and lib/components/*.html overrides.",
  },
  {
    name: "spinPreset({ themes })",
    badge: "Stylesheet only",
    description:
      "Drops into an existing uno.config.ts for token CSS, utilities, and element rules from explicit theme objects. Does not transform .html components or auto-discover spin/*.json.",
  },
  {
    name: "npx spin studio",
    badge: "Standalone daemon",
    description:
      "Serves the visual theme editor at /studio/ and RPC daemon at /rpc without running an application bundler.",
  },
  {
    name: "spin lint / theme / component / mcp",
    badge: "CLI & Agent tools",
    description:
      "Runs source lints, theme validation gates, component scaffolding, and the stdio MCP server.",
  },
];

export default function Paths(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Ways to Use Spin"
        lede="Spin is one token contract with five entry points. Choose the full bundler plugin for single apps, layer a shared brand package across a monorepo, or adopt individual layers in existing projects."
      />

      <Section id="matrix" title="Entry points at a glance">
        <PropList items={ENTRY_PATHS} />
      </Section>

      <Section id="plugin" title="Full bundler plugin">
        <p class="max-w-prose">
          The Spin plugin ships for all seven bundlers:{" "}
          <code>spin.vite()</code>, <code>spin.rspack()</code>,{" "}
          <code>spin.webpack()</code>, <code>spin.rollup()</code>,{" "}
          <code>spin.rolldown()</code>, <code>spin.esbuild()</code>, and{" "}
          <code>spin.bun()</code>. It replaces <code>@unocss/vite</code>, owns
          the stylesheet, discovers <code>spin/*.json</code>, transforms{" "}
          <code>lib/components/*.html</code>, generates{" "}
          <code>src/spin-components.d.ts</code>, and mounts the Studio on its
          own dev server.
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={GETTING_STARTED_SNIPPETS.vite}
            lang="ts"
            title="vite.config.ts"
          />
          <Code
            code={GETTING_STARTED_SNIPPETS.studio}
            lang="ts"
            title="Disable Studio in prod/tools"
          />
        </div>
        <p class="max-w-prose">
          See <A href="/docs/tooling/cli#plugin">CLI &amp; Plugin Options</A>{" "}
          for every field on <code>SpinPluginOptions</code>.
        </p>
      </Section>

      <Section id="extends" title="Shared brand packages (extends)">
        <p class="max-w-prose">
          Multi-app teams can publish a shared brand package that exports{" "}
          <code>{"{ themes, componentsDir }"}</code> and pass it to{" "}
          <code>{"spin.vite({ extends: brand })"}</code> (or any{" "}
          <code>{"spin.<bundler>({ extends: brand })"}</code>). Local{" "}
          <code>spin/&lt;name&gt;.json</code> themes and{" "}
          <code>lib/components/&lt;name&gt;.html</code> components take
          precedence over brand entries of the same name, and un-forked brand
          themes open read-only in the Studio with a one-click copy into local{" "}
          <code>spin/</code>:
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-2">
          <Code
            code={GETTING_STARTED_SNIPPETS.brandExport}
            lang="ts"
            title="packages/brand/src/spin.ts"
          />
          <Code
            code={GETTING_STARTED_SNIPPETS.viteExtends}
            lang="ts"
            title="apps/web/vite.config.ts"
          />
        </div>
      </Section>

      <Section id="preset" title="Stylesheet only in an existing UnoCSS app">
        <alert variant="info" class="my-3">
          <p>
            <strong>Stylesheet-only mode:</strong> <code>spinPreset</code> is
            for projects that already own <code>uno.config.ts</code> and want
            Spin's tokens, utilities, and element CSS without the component
            compiler or mounted Studio.
          </p>
        </alert>
        <p class="max-w-prose">
          Themes are passed explicitly in the <code>themes</code> map. Because{" "}
          <code>spinPreset</code> does not scan <code>spin/*.json</code> on
          disk, register each theme in <code>uno.config.ts</code> directly:
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.unocss}
            lang="ts"
            title="uno.config.ts"
          />
        </div>
      </Section>

      <Section id="studio" title="Standalone Studio">
        <p class="max-w-prose">
          <code>spin studio</code> starts the daemon and serves the editor at{" "}
          <code>http://localhost:7463/studio/</code> for editing{" "}
          <code>spin/*.json</code> themes independent of your app server.
        </p>
        <div class="my-3">
          <Code
            code={GETTING_STARTED_SNIPPETS.studioServe}
            lang="bash"
            title="Terminal"
          />
        </div>
      </Section>

      <Section id="tools" title="CLI and MCP">
        <p class="max-w-prose">
          The CLI and MCP server inspect your project files directly on disk or
          connect to a running Studio daemon via <code>--url</code>:
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-3">
          <Code code={TOOLING_SNIPPETS.lint} lang="bash" title="Lint check" />
          <Code code={TOOLING_SNIPPETS.lintFix} lang="bash" title="Autofix" />
          <Code code={TOOLING_SNIPPETS.mcp} lang="bash" title="MCP server" />
        </div>
        <p class="max-w-prose">
          See <A href="/docs/tooling/mcp">MCP Server</A> for client
          configurations and tool schemas.
        </p>
      </Section>
    </main>
  );
}
