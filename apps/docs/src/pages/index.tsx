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
import { Logo, Mark } from "../mark.tsx";
import { Code, Section } from "../bits.tsx";

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
    href: "/tokens",
    title: "Tokens",
    body: "Colors, modes, type — every starter side by side.",
  },
  {
    href: "/components",
    title: "Components",
    body: "Every element, with live examples you can copy.",
  },
];

const HIGHLIGHTS = [
  [
    "Everything syncs from the theme.",
    "Utilities, primitives, components — all of it resolves from one document. Change a token and the whole app follows, in both modes.",
  ],
  [
    "Agents write themed code by default.",
    "The vocabulary is closed: a color, a radius, a duration an agent spends is a token. Off-theme styling has nowhere to live.",
  ],
  [
    "The studio.",
    "In dev it mounts into your app — open it from any page, edit the theme document, and the running UI repaints.",
  ],
  [
    "Verified, not eyeballed.",
    "Oracles render your app in a real browser and check contrast, layout, and overflow — every theme, both modes.",
  ],
  [
    "Web components, soon.",
    "A component runtime in development: branded components that travel with the theme and embed in any web framework.",
  ],
];

const CTA = "no-underline";
const GHOST = "ghost no-underline";

export default function Home(): JSX.Element {
  return (
    <main class="min-h-dvh bg-surface text-text font-sans text-md">
      {/* The first screen: mark, pitch, switch. */}
      <section class="grid min-h-dvh md:grid-cols-2">
        <div class="flex flex-col justify-between px-6 py-5 md:px-12 md:py-10">
          <header class="flex items-center justify-between">
            <Logo size="lg" class="text-text" />
          </header>

          <div class="max-w-screen-md py-12">
            <h1 class="m-0 text-3xl tracking-tighter">
              Spin your own web.
            </h1>
            <p class="mt-5 text-md text-text-muted">
              spin is a frontend framework for style and components: themes,
              utility classes, primitives, and components, all kept in sync.
              Built so AI agents write consistent, themed UI — and it embeds
              into the framework you already use.
            </p>
            <Code
              class="mt-6 max-w-fit text-xs"
              code={`<button>Ship it</button>
<button class="secondary">Cancel</button>`}
            />
            <div class="mt-8 flex flex-wrap items-center gap-3">
              <A href="/guide" role="button" class={CTA}>get started</A>
              <A href="/components" role="button" class={GHOST}>
                browse elements
              </A>
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

      {/* Below the fold: what it actually does. */}
      <div class="mx-auto max-w-screen-xl px-4 py-16 md:px-8">
        <div class="grid gap-4 md:grid-cols-2 max-w-screen-xl">
          <For each={HIGHLIGHTS}>
            {([claim, body]) => (
              <div class="border-solid border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4">
                <p class="m-0 font-semibold text-text">{claim}</p>
                <p class="m-0 mt-2 text-sm">{body}</p>
              </div>
            )}
          </For>
        </div>

        <div class="mt-10">
          <Section title="One line of wiring">
            <Code code={WIRING} />
          </Section>
        </div>

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
      </div>
    </main>
  );
}
