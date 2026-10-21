/**
 * Install: the packages, the plugin, the options — and the bundlers.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Code, Section } from "../../bits.tsx";

const ADD = `{
  // deno.json / package.json — the packages
  "@spin/theme":    "npm:@spin/theme",
  "@spin/preset":   "npm:@spin/preset"
}`;

const WIRE = `import { spin } from "@spin/preset/plugin";

export default {
  plugins: [spin.vite()],
}`;

const WIRE_THEMES = `import { spin } from "@spin/preset/plugin";
import { starterThemes } from "@spin/theme/themes";
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
import { spin } from "@spin/preset/plugin";
import { mountSpinApp } from "@spin/api";

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

const ROLLUP = `import { spin } from "@spin/preset/plugin";

export default {
  plugins: [spin.rollup()],
};`;

const RSPACK = `import { spin } from "@spin/preset/plugin";

export default {
  plugins: [spin.rspack()],
};`;

const WEBPACK = `const { spin } = require("@spin/preset/plugin");

module.exports = {
  plugins: [spin.webpack()],
};`;

const GET = [
  ["@spin/preset", "the Uno preset — theme utilities + primitive classes"],
  [
    "@spin/theme/themes",
    "the starter themes — imports that carry validated documents",
  ],
  ["@spin/api", "mountSpinApp() — the theme studio, served in dev"],
  ["@spin/lint", "the oxlint plugin — authored markup checked, in CI"],
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
          v0.1 is source-first: the npm distributions are built, not yet
          published, so today you take the packages from their source — exactly
          as this site does. Add them to <code>deno.json</code> /
          <code>package.json</code> and map the subpaths you'll import.
        </p>
        <Code code={ADD} />
        <p>
          It replaces your Uno plugin and turns your theme documents into the
          stylesheet.
        </p>
        <Code code={WIRE} />
        <p>
          Import the sheet in your entry, and the utilities resolve against your
          theme.
        </p>
        <Code code={IMPORT_CSS} />
        <p>
          Under TypeScript, declare the module — it is virtual, so there is no
          file to resolve.
        </p>
        <Code code={DECLARE_CSS} />
        <p>
          Omit the options and the app serves the shipped starters, forked by
          {" "}
          <code>spin/*.json</code>{" "}
          off your root — the files the studio edits. Pass a map when the
          documents come from somewhere else:
        </p>
        <Code code={WIRE_THEMES} />
        <p>
          The studio rides the same dev server, mounted beside the API on one
          origin: a FAB in the corner of every page opens it, and the editing
          loop runs against your live app.
        </p>
        <Code code={WIRE_STUDIO} />
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
              <h3 class="mb-2 font-mono text-sm text-text">{bundler.name}</h3>
              <Code code={bundler.code} />
              <p class="mt-2 text-sm">{bundler.note}</p>
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
      <code class="shrink-0 font-mono text-sm">{props.pkg}</code>
      <span class="text-sm">{props.what}</span>
    </div>
  );
}
