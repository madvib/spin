/**
 * The home page: the pitch, rendered with the product.
 *
 * Every specimen below runs on the same plugin and the same starters a
 * consumer would use. Switching a starter re-declares `data-theme` on the
 * document element, and the page re-resolves in that theme's own CSS.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { setTheme, starterList, theme } from "../shell.tsx";
import { Mark } from "../mark.tsx";
import { Code, Section } from "../bits.tsx";
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
    body: "Install, wire, and write your first themed UI.",
  },
  {
    href: "/threads",
    title: "Threads",
    body: "Watch your theme do its job — light and dark, side by side.",
  },
  {
    href: "/components",
    title: "Components",
    body: "Every element, with live examples you can copy.",
  },
];

const TENETS = [
  [
    "One place to style everything.",
    "Every decision — color, space, radius, motion — is a named token in the theme. Change the theme, everything follows.",
  ],
  [
    "Just utility classes.",
    "No style blocks, no runtime style injection. Your markup and one stylesheet; nothing hidden in between.",
  ],
  [
    "Finished elements to build from.",
    "Buttons, badges, inputs, switches — ready-made and themed, so agents can't invent their own.",
  ],
  [
    "Verified, not eyeballed.",
    "Contrast, layout, and rendering checked mechanically — in every theme and both modes.",
  ],
];

export default function Home(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-xl px-4 py-10 md:px-8 md:py-16">
      <section class="flex flex-col items-start gap-10 md:flex-row md:items-center">
        <Mark class="h-24 w-24 shrink-0" />
        <div class="min-w-0 max-w-screen-lg">
          <h1 class="m-0 text-3xl tracking-tighter">
            Give an agent a web it can hold.
          </h1>
          <p class="mt-4 max-w-screen-md text-md">
            This whole page — every color, every button, every font — is one
            theme document and one vite plugin. Flip the theme in the rail: same
            markup, instant repaint, real CSS. That's the product, running.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <A
              href="/guide"
              class="border border-border bg-surface-raised text-text rounded-sm px-3 py-2 text-sm hover:border-border-strong transition-colors duration-fast"
            >
              get started
            </A>
            <A
              href="/components"
              class="border border-border bg-surface-raised text-text rounded-sm px-3 py-2 text-sm hover:border-border-strong transition-colors duration-fast"
            >
              browse elements
            </A>
          </div>
        </div>
      </section>

      <section class="mt-12">
        <Section title="Starters">
          <p>
            Remix a starter, or write your own from scratch. Each one ships with
            light and dark, contrast that passed the floor, and its own opinions
            about buttons and checkboxes. The switch below is the product's real
            {" "}
            <code class="font-mono">data-theme</code>{" "}
            mechanism — the same one your app gets.
          </p>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <For each={starterList}>
              {(name) => (
                <button
                  type="button"
                  onClick={() => setTheme(name)}
                  aria-pressed={theme() === name}
                  class={`px-3 py-2 text-sm ${
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
      </section>

      <section class="mt-6">
        <Section title="Write markup, not CSS decisions">
          <p>
            A bare tag paints itself, variant classes change it, utilities
            fine-tune it — everything it spends comes from the theme. Hover the
            rows, tab through them, read the code.
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
      </section>

      <div class="mt-10 grid gap-4 md:grid-cols-3">
        <For each={PAGES}>
          {(page) => (
            <A
              href={page.href}
              class="block border border-border bg-surface-raised rounded-md p-4 hover:border-border-strong transition-colors duration-fast"
            >
              <p class="m-0 font-heading text-lg tracking-tight">
                {page.title}
              </p>
              <p class="m-0 mt-2 text-sm text-text-muted">{page.body}</p>
            </A>
          )}
        </For>
      </div>

      <div class="mt-10">
        <Section title="One line of wiring">
          <p>
            It replaces your Uno plugin and turns your theme documents into the
            stylesheet. Every starter is an import away.
          </p>
          <Code code={WIRING} />
        </Section>
      </div>

      <div class="mt-10">
        <Section title="Guardrails, built in">
          <div class="mt-4 grid gap-4 md:grid-cols-2 max-w-screen-xl">
            <For each={TENETS}>
              {([claim, body]) => (
                <div class="border-l-4 border-primary bg-surface-raised rounded-md p-4">
                  <p class="m-0 font-semibold text-text">{claim}</p>
                  <p class="m-0 mt-2 text-sm">{body}</p>
                </div>
              )}
            </For>
          </div>
        </Section>
      </div>
    </main>
  );
}
