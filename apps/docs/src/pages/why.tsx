/**
 * Why spin: the argument, then the specimen, then where to start.
 *
 * The narrative lives in `../content/why.md` — Markdown the owner edits
 * without touching JSX. This file keeps the two things Markdown cannot do:
 * the live THEME + MARKUP specimen and the route links into the manual.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, Section } from "../bits.tsx";
import { Markdown } from "../markdown.tsx";
import whyMd from "../content/why.md?raw";

/** The theme, and the markup it buys. */
const THEME = `{
  "color": {
    "primary": { "$value": "#c8102e" },
    "on-primary": { "$value": "#ffffff" }
  },
  "spacing": {
    "4": { "$value": "1rem" }
  }
}`;

const MARKUP =
  `<article class="rounded-md border border-border bg-surface-raised p-4">
  <p class="text-text-muted">Apricot, jasmine, black tea</p>
  <p class="text-primary">Ethiopia Guji</p>
</article>`;

export default function Why(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-md px-4 py-10 md:py-16">
      <Markdown text={whyMd} />

      <Section id="specimen" title="The theme, and the markup it buys">
        <p>
          The markup names the decision. The theme holds the value. Replace the
          document and the product's look changes. The markup does not.
        </p>
        <Code class="mt-3" code={THEME} lang="json" />
        <Code class="mt-3" code={MARKUP} lang="html" />
      </Section>

      <Section id="start" title="Start here">
        <p>Three pages, in this order.</p>
        <ul class="grid gap-2 list-disc">
          <li>
            <A href="/guide/install">
              Install & Wiring
            </A>{" "}
            says what to put in your{" "}
            <code>deno.json</code>, how to wire the plugin, and which recipe
            belongs to your bundler. v0.1 is source-first, so the page is
            explicit about where the packages come from.
          </li>
          <li>
            <A href="/themes">Theme Contract & Modes</A>{" "}
            says what a theme is, the token language, the roles a theme owes and
            the floors it has to hold, and how to fork a starter. Read it before
            you write one: the contract is the whole thing.
          </li>
          <li>
            <A href="/tooling/lints">Lints & Dials</A>{" "}
            says what the source checks catch, how strict they are, and how to
            wire them into oxlint, ESLint, or the CLI.
          </li>
        </ul>
        <p>
          The elements are in{" "}
          <A href="/components">
            Element Library
          </A>
          , the rendered checks in{" "}
          <A href="/tooling/check">Browser Checks</A>, and the starters side by
          side in <A href="/utilities">Utilities & Scales</A>.
        </p>
      </Section>
    </main>
  );
}
