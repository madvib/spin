/**
 * Install: one package, one plugin, one stylesheet import.
 *
 * The narrative lives in `../../content/install.md`. This file keeps the
 * source-first note for v0.1 — the one thing the Markdown cannot say
 * without dating itself.
 */
import type { JSX } from "solid-js";
import { Code, Section } from "../../bits.tsx";
import { Markdown } from "../../markdown.tsx";
import installMd from "../../content/install.md?raw";

const SOURCE_FIRST = `{
  // v0.1 is source-first: the npm manifests exist but publishing is still
  // somebody's decision. Until then, take the package from source.
  "@spin/preset": "npm:@spin/preset"
}`;

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
        <Code code={ADD} lang="json" />
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

      <Section id="source" title="While v0.1 is source-first">
        <p>
          Published tarballs do not exist yet. Map the package to its source in
          the meantime — exactly as this site does:
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
    </main>
  );
}
