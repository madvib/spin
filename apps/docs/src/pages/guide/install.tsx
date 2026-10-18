/**
 * Install: the packages, the plugin, the options — and the studio note.
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

const GET = [
  ["@spin/preset", "the Uno preset — theme utilities + primitive classes"],
  [
    "@spin/theme/themes",
    "the starter themes — imports that carry validated documents",
  ],
  ["@spin/api", "mountSpinApp() — the theme studio, served in dev"],
  ["@spin/lint", "the oxlint plugin — authored markup checked, in CI"],
];

export default function Install(): JSX.Element {
  return (
    <>
      <Section id="install" title="Install">
        <p>
          v0.1 is source-first — the npm distributions land at launch. Until
          then you get the packages straight from their source URLs, exactly as
          this site does. Add them to <code>deno.json</code> /
          <code>package.json</code> and map the subpaths you'll import.
        </p>
        <Code code={ADD} />
        <p>
          It replaces your Uno plugin and turns your theme documents into the
          stylesheet.
        </p>
        <Code code={WIRE} />
        <p>
          Omit the options and the app serves the shipped starters, forked by
          {" "}
          <code>spin/*.json</code>{" "}
          off your root — the files the studio edits. Pass a map when the
          documents come from somewhere else:
        </p>
        <Code code={WIRE_THEMES} />
        <p>
          In dev the same plugin serves the studio on <code>/__spin</code>{" "}
          — a FAB in the corner of every page opens it and the editing loop runs
          against your live app.
        </p>
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
