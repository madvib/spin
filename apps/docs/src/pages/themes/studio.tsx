/**
 * Using the Studio: the live theme editor beside your app.
 *
 * The workflow narrative lives in `../../content/studio.md`. This file keeps
 * the wiring snippet and the cross-links into the contract pages.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Code, Section } from "../../bits.tsx";
import { Markdown } from "../../markdown.tsx";
import studioMd from "../../content/studio.md?raw";

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

export default function Studio(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <Markdown text={studioMd} />

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
