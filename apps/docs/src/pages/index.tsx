/**
 * The landing: the product at full volume.
 *
 * No rail here — the first screen is the mark, the pitch, and the switch.
 * Every specimen below runs on the same plugin and the same starters a
 * consumer gets; flipping a starter re-declares `data-theme` on the
 * document and the page re-resolves in its own CSS.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { setTheme, starterList, theme } from "@spin/kit";
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

const CTA =
  "border border-border bg-surface-raised text-text rounded-sm px-3 py-2 text-sm no-underline hover:border-border-strong transition-colors duration-fast";
const GHOST =
  "px-3 py-2 text-sm text-text-muted rounded-sm no-underline hover:text-text transition-colors duration-fast";

export default function Home(): JSX.Element {
  return (
    <main class="min-h-dvh bg-surface text-text font-sans text-md">
      {/* The first screen: mark, pitch, switch. */}
      <section class="grid min-h-dvh md:grid-cols-2">
        <div class="flex flex-col justify-between px-6 py-5 md:px-12 md:py-10">
          <header class="flex items-center justify-between">
            <span class="flex items-center gap-3 text-text">
              <Mark class="h-8 w-8" />
              <span class="font-heading text-lg tracking-tighter">spin</span>
            </span>
            <nav class="flex items-center gap-1 text-sm">
              <A href="/guide" class={GHOST}>guide</A>
              <A href="/threads" class={GHOST}>threads</A>
              <A href="/components" class={CTA}>components</A>
            </nav>
          </header>

          <div class="max-w-screen-md py-12">
            <h1 class="m-0 text-3xl tracking-tighter">
              Give an agent a web it can hold.
            </h1>
            <p class="mt-5 text-md text-text-muted">
              One theme document and one vite plugin — and every color, button,
              and font on this page obeys it. Flip the switch below: the whole
              page repaints in real CSS, because that's the product, running.
            </p>
            <div class="mt-8 flex flex-wrap gap-3">
              <A href="/guide" class={CTA}>get started</A>
              <A href="/components" class={GHOST}>browse elements</A>
            </div>
          </div>

          <div>
            <p class="m-0 text-xs font-semibold text-text-muted">theme</p>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <For each={starterList}>
                {(name) => (
                  <button
                    type="button"
                    onClick={() => setTheme(name)}
                    aria-pressed={theme() === name}
                    class={`px-3 py-2 text-sm rounded-sm transition-colors duration-fast ${
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
          </div>
        </div>

        <div class="flex items-center justify-center overflow-hidden border-t border-border md:border-t-0 md:border-l">
          <Mark class="w-full max-w-screen-md text-text" />
        </div>
      </section>

      {/* Below the fold: the sheet, lived. */}
      <div class="mx-auto max-w-screen-xl px-4 py-16 md:px-8">
        <Section title="Steal the markup">
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
          <ExampleRow
            name="fields"
            html={componentExamples.input.rows[0].html}
          />
        </Section>

        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <For each={PAGES}>
            {(page) => (
              <A
                href={page.href}
                class="block border border-border bg-surface-raised rounded-md p-4 no-underline hover:border-border-strong transition-colors duration-fast"
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

        <div class="mt-10">
          <Section title="One line of wiring">
            <p>
              It replaces your Uno plugin and turns your theme documents into
              the stylesheet. Every starter is an import away.
            </p>
            <Code code={WIRING} />
          </Section>
        </div>
      </div>
    </main>
  );
}
