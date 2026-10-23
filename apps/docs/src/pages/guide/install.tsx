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
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <Markdown text={installMd} />

      <Section id="source" title="While v0.1 is source-first">
        <p>
          Published tarballs do not exist yet. Map the package to its source in
          the meantime — exactly as this site does:
        </p>
        <Code code={SOURCE_FIRST} lang="json" />
      </Section>
    </main>
  );
}
