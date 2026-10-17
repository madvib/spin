/**
 * The home page: the pitch, the wiring, and the deck switcher — which is
 * not a screenshot of the product, it IS the product. Switching decks
 * re-declares `data-theme` on the whole document; there is no iframe and
 * no second copy of anything.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Link, setTheme, starterList, theme } from "../shell.tsx";
import { Mark } from "../mark.tsx";
import { Code, Eyebrow, Section } from "./bits.tsx";
import { componentExamples } from "@spin/preset/rules/primitives/examples-index.ts";
import { ExampleRow } from "../example-row.tsx";

const WIRING = `import { spin } from "@spin/preset/plugin";
import solid from "vite-plugin-solid";

export default {
  plugins: [solid(), spin.vite()],
};`;

const PAGES = [
  {
    href: "/guide",
    title: "Guide",
    body:
      "Add the packages, wire one plugin, write markup. Tags are the opt-in.",
  },
  {
    href: "/threads",
    title: "Threads",
    body:
      "Tokens, modes, and what each of the four starters decides differently.",
  },
  {
    href: "/components",
    title: "Components",
    body:
      "Every element's contract and its live markup — from the primitives themselves.",
  },
  {
    href: "/runtime",
    title: "Runtime",
    body: "What v0.1 ships as a styling layer, and what merges onto it after.",
  },
];

const TENETS = [
  [
    "The theme is the only way to style.",
    "No inline styles, no ad-hoc files, no one-off hex. If a visual decision exists, it is a token.",
  ],
  [
    "UnoCSS is the only way to apply.",
    "Utilities only. No style blocks, no CSS modules, nothing runtime-injected.",
  ],
  [
    "Primitives are the only way to build.",
    "No assembly that duplicates a finished element's behavior.",
  ],
  [
    "Tokens are the only values.",
    "Color, space, radius, motion — a value with no name does not ship.",
  ],
];

export function Home(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-xl px-4 py-10 md:py-16">
      <div class="flex flex-col gap-8 md:flex-row md:items-start">
        <Mark class="h-36 w-36 shrink-0 md:h-44 md:w-44" />
        <div class="max-w-prose">
          <Eyebrow>
            spin · the styling layer for agent-authored UI
          </Eyebrow>
          <h1 class="m-0 mt-3 text-3xl tracking-tighter leading-none">
            Give an agent a web it can hold.
          </h1>
          <p class="mt-4">
            spin gives agents a closed vocabulary instead of a blank box:{" "}
            <em>design tokens</em> carry every decision, <em>primitives</em>
            {" "}
            paint the finished elements from them, utilities apply nothing
            outside the system, and oracles verify the result — mechanically, in
            every deck you ship. The reason generated UI felt generated was
            never the generation; it was the missing rules.
          </p>
          <div class="mt-5">
            <Code code={WIRING} />
            <p class="mt-2 text-xs text-text-muted">
              One plugin owns the toolchain — no{" "}
              <code class="font-mono">uno.config</code>, no theme plumbing,
              nothing to keep in sync. Distributions publish to npm at v0.1;
              today the packages compose source-first.
            </p>
          </div>
        </div>
      </div>

      <div class="mt-12">
        <Section id="decks" title="Four starters. The page is wearing one.">
          <p>
            A starter is a complete theme document — validated against the
            legibility floor, mode-aware, fonts wired, with an opinion about its
            buttons and its checkboxes. Pick one and the whole site re-themes:
            this is not a preview of the product, it is the product's{" "}
            <code class="font-mono">data-theme</code>{" "}
            switch doing exactly what it would do in your app.
          </p>
          <div class="mt-4 flex flex-wrap items-center gap-2 max-w-screen-md">
            <For each={starterList}>
              {(name) => (
                <button
                  type="button"
                  onClick={() => setTheme(name)}
                  aria-pressed={theme() === name}
                  class={`px-3.5 py-2 text-sm ${
                    theme() === name
                      ? "bg-primary text-on-primary"
                      : "border border-border bg-surface-raised text-text hover:border-border-strong"
                  }`}
                >
                  {name}
                </button>
              )}
            </For>
          </div>
        </Section>
      </div>

      <div class="mt-2">
        <Section title="What the markup looks like">
          <p>
            Nothing to buy: a bare tag carries its paint, variant classes change
            it, and the utilities spend the deck's scales. The row below is the
            primitives' own example data, rendered live — hover it, tab to it,
            read the code.
          </p>
          <ExampleRow
            name="buttons"
            html={componentExamples.button.rows[0].html}
          />
          <ExampleRow
            name="badges"
            html={componentExamples.badge.rows[0].html}
          />
        </Section>
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <For each={PAGES}>
          {(page) => (
            <Link
              href={page.href}
              class="block border border-border bg-surface-raised rounded-md p-4 hover:border-border-strong transition-colors duration-150"
            >
              <p class="m-0 font-heading text-lg tracking-tight">
                {page.title}
              </p>
              <p class="m-0 mt-1.5 text-sm text-text-muted">{page.body}</p>
            </Link>
          )}
        </For>
      </div>

      <div class="mt-12">
        <Section title="Rules of the sheet">
          <p>
            spin is opinionated because agents need opinions to be useful. Four
            rules hold the whole thing up:
          </p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 max-w-screen-md">
            <For each={TENETS}>
              {([claim, body]) => (
                <div class="border-l-4 border-primary bg-surface-raised rounded-md p-4">
                  <p class="m-0 font-semibold text-text">{claim}</p>
                  <p class="m-0 mt-1.5 text-sm">{body}</p>
                </div>
              )}
            </For>
          </div>
        </Section>
      </div>
    </main>
  );
}
