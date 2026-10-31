/**
 * Studio: the visual workbench for the theme document.
 *
 * The workflow narrative lives in `../../content/studio.md`. This file keeps
 * the product framing, the wiring snippet, and the cross-links into the
 * contract pages.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Code, Section } from "../bits.tsx";
import { Markdown } from "../markdown.tsx";
import studioMd from "../content/studio.md?raw";

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

/** What the workbench edits, in the order a theme is usually shaped. */
const SURFACES: readonly { readonly title: string; readonly copy: string }[] = [
  {
    title: "Theme & type",
    copy: "Palettes, spacing and radius scales, faces, and per-element typography overrides.",
  },
  {
    title: "Contrast gates",
    copy: "Light and dark pairs checked against AA and AAA before a value can land.",
  },
  {
    title: "Icons",
    copy: "Search the installed Iconify collections and vendor a glyph into spin/icons.",
  },
  {
    title: "Motion",
    copy: "Transitions and cubic-bezier easing, edited on the same theme document.",
  },
  {
    title: "Recipes",
    copy: "Copy a component's markup and the classes it reads into your repo.",
  },
  {
    title: "Findings",
    copy: "Source diagnostics by rule, with fixes applied to files and vocabulary promoted.",
  },
];

export default function Studio(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <p class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
        Workbench
      </p>
      <h1 class="mt-2">Studio</h1>
      <p class="mt-3 max-w-screen-md text-text-muted">
        The visual workbench for the theme document. Studio runs beside your
        running app, so a token edit repaints the real page before it touches
        disk — and every edit is gated before it lands. This site presents the
        Studio; the editor itself mounts in your project's dev server.
      </p>

      <div class="mt-6 grid gap-3 md:grid-cols-3">
        {SURFACES.map((surface) => (
          <div class="rounded-md border border-border bg-surface-raised p-4">
            <h2 class="text-sm font-semibold text-text">{surface.title}</h2>
            <p class="mt-1 text-xs text-text-muted">{surface.copy}</p>
          </div>
        ))}
      </div>

      <div class="mt-10">
        <Markdown text={studioMd} />
      </div>

      <Section id="wire" title="The wiring snippet">
        <p>
          One option on the plugin mounts the Studio beside the API on the same
          origin — the editing loop runs against your live app:
        </p>
        <Code class="mt-3" code={WIRE_STUDIO} lang="ts" />
        <p>
          The contract the Studio edits is on{" "}
          <A href="/themes">Theme Contract & Modes</A>; the gates every edit is
          held to are on <A href="/themes/authoring">Authoring & Gates</A>.
        </p>
      </Section>
    </main>
  );
}
