/**
 * Install: the packages, the plugin, the options — and the bundlers.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Code, Section } from "../../bits.tsx";

const ADD = `npm install @spinjs/spin`;

const WIRE = `import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.vite()],
}`;

const WIRE_THEMES = `import { spin } from "@spinjs/spin/vite";
import { starterThemes } from "@spinjs/spin/theme";
import myTheme from "./theme.json" with { type: "json" };

export default {
  plugins: [spin.vite({
    // A host that owns its documents passes them here. Omit the option
    // and the app serves the shipped starters, forked by spin/*.json —
    // the files the studio edits.
    themes: { myTheme, ...starterThemes },
  })],
};`;

const WIRE_STUDIO = `import { resolve } from "node:path";
import { spin } from "@spinjs/spin/vite";
import { mountSpinApp } from "@spinjs/spin/api";

export default {
  plugins: [spin.vite({
    // The studio, mounted beside the API on one origin. The API reads and
    // writes the project's theme; the studio is the editor that talks to
    // it. The studio is an app, not an npm package yet, so studioDir
    // points at a bundle you built from it.
    mount: mountSpinApp(import.meta.dirname, {
      studioDir: resolve(import.meta.dirname, "studio/dist"),
    }),
  })],
};`;

const IMPORT_CSS =
  `// Your entry: the sheet is a virtual module — the plugin answers
// for this specifier and hands back the generated CSS.
import "uno.css";`;

const DECLARE_CSS = `// uno.d.ts — for TypeScript, the virtual module's shape.
declare module "uno.css";`;

const ROLLUP = `import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.rollup()],
};`;

const RSPACK = `import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.rspack()],
};`;

const WEBPACK = `const { spin } = require("@spinjs/spin/vite");

module.exports = {
  plugins: [spin.webpack()],
};`;

const GET = [
  [
    "@spinjs/spin",
    "the toolchain — the Uno preset, the plugin, the CLI, the MCP server, and the Studio in dev",
  ],
  [
    "@spinjs/spin/theme",
    "the starter themes and their contract — validated documents",
  ],
  ["@spinjs/spin/api", "mountSpinApp() — the Studio's server, mounted in dev"],
  ["@spinjs/spin/eslint", "the lint rules — authored markup checked, in CI"],
  [
    "@spinjs/components",
    "the machine components — framework-agnostic markup with React and Solid adapters",
  ],
];

/** The bundlers, and what each one changes. */
const BUNDLERS: readonly {
  readonly name: string;
  readonly code: string;
  readonly note: string;
}[] = [
  {
    name: "vite",
    code: WIRE,
    note:
      "The whole thing: the sheet, the studio on /__spin, the launcher in " +
      "the corner of every page, and the sheet repainting as you edit the " +
      "theme. The plugin replaces @unocss/vite — there is no uno.config.ts " +
      "to keep in step.",
  },
  {
    name: "rspack",
    code: RSPACK,
    note: "The sheet only. The plugin's dev half hangs on Vite's hooks, so " +
      "there is no studio mount and no live repaint: the theme is read when " +
      "the build runs. The sheet arrives as a virtual CSS module, so it goes " +
      "through your CSS rule like any stylesheet.",
  },
  {
    name: "rollup",
    code: ROLLUP,
    note: "The sheet only, for the same reason: a build, not a dev server. " +
      "Rollup has no CSS handling of its own, so the sheet needs a CSS " +
      "plugin to become a stylesheet.",
  },
  {
    name: "webpack",
    code: WEBPACK,
    note: "The sheet only, for the same reason. The virtual module is CSS, " +
      "so it goes through your CSS rule like any stylesheet.",
  },
];

export default function Install(): JSX.Element {
  return (
    <>
      <Section id="install" title="Install">
        <p>
          One package, one plugin, one stylesheet import. The package carries
          the toolchain; its runtime and components peers install with it.
          Bun, pnpm, and Yarn resolve the same tarball.
        </p>
        <Code code={ADD} lang="bash" />
        <p>
          It replaces your Uno plugin and turns your theme documents into the
          stylesheet.
        </p>
        <Code code={WIRE} lang="ts" />
        <p>
          Import the sheet in your entry, and the utilities resolve against your
          theme.
        </p>
        <Code code={IMPORT_CSS} lang="ts" />
        <p>
          Under TypeScript, declare the module — it is virtual, so there is no
          file to resolve.
        </p>
        <Code code={DECLARE_CSS} lang="ts" />
        <p>
          Omit the options and the app serves the shipped starters, forked by
          {" "}
          <code>spin/*.json</code>{" "}
          off your root — the files the studio edits. Pass a map when the
          documents come from somewhere else:
        </p>
        <Code code={WIRE_THEMES} lang="ts" />
        <p>
          The studio rides the same dev server, mounted beside the API on one
          origin: a FAB in the corner of every page opens it, and the editing
          loop runs against your live app.
        </p>
        <Code code={WIRE_STUDIO} lang="ts" />
      </Section>

      <Section id="bundlers" title="Bundlers">
        <p>
          The plugin is one unplugin, so it answers to each bundler's own plugin
          shape. The sheet is the same everywhere — the utilities, the elements,
          the theme — and what changes is the dev half: the studio and the live
          repaint need a dev server, and only Vite's hooks are there to hang
          them on.
        </p>
        <For each={BUNDLERS}>
          {(bundler) => (
            <div class="mt-4">
              <h3 class="text-text">{bundler.name}</h3>
              <Code code={bundler.code} lang="ts" />
              <p class="text-sm">{bundler.note}</p>
            </div>
          )}
        </For>
      </Section>

      <Section id="get" title="What you get">
        <div class="mt-4">
          <For each={GET}>
            {([pkg, what]) => <Line pkg={pkg} what={what} />}
          </For>
        </div>
      </Section>
    </>
  );
}

function Line(props: { pkg: string; what: string }): JSX.Element {
  return (
    <div class="flex flex-col gap-1 border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4 mt-2 md:flex-row md:items-baseline md:gap-4">
      <code class="shrink-0">{props.pkg}</code>
      <span class="text-sm">{props.what}</span>
    </div>
  );
}
