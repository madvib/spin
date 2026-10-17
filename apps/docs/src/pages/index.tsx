/**
 * The landing: the product at full volume.
 *
 * No rail here — the first screen is the mark, the pitch, and the switch.
 * Every specimen below runs on the same plugin and the same starters a
 * consumer gets; flipping a starter re-declares `data-theme` on the
 * document and the page re-resolves in its own CSS.
 */
import { createSignal, For, onMount } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { setTheme, starterList, theme } from "@spin/kit";
import { Logo, Mark } from "../mark.tsx";
import { Chip, Code, Reveal, Section } from "../bits.tsx";

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

/** The landing's below-the-fold argument: one section, four layers,
 * progressive disclosure — the radios are the tabs primitive itself. */
const TOKEN_JSON = `{
  "color": {
    "primary": {
      "$value": "#c8102e",
      "$modes": { "dark": "#f4646e" }
    }
  }
}`;

const UTILITIES_CODE = `<button>Ship it</button>
<button class="secondary">Cancel</button>
<button class="ghost">Later</button>`;

const PRIMITIVE_CODE =
  `<label><input type="checkbox" role="switch"> Notify me</label>
<badge variant="success">shipped</badge>`;

const layers = (): readonly { label: string; panel: JSX.Element }[] => [
  {
    label: "0 · design tokens",
    panel: (
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <p class="m-0">
            Named values in one JSON document — both modes, validated against
            the legibility floor. The sheet emits them as custom properties;
            everything above them spends those.
          </p>
          <Code class="mt-3 text-xs" code={TOKEN_JSON} />
        </div>
        <div class="flex flex-col justify-center gap-3">
          <span class="flex items-center gap-3">
            <span class="h-7 w-14 shrink-0 rounded-sm border border-border-strong bg-primary" />
            <code class="text-xs">--color-primary</code>
          </span>
          <span class="flex items-center gap-3">
            <span class="h-7 w-14 shrink-0 rounded-sm border border-border-strong bg-surface" />
            <code class="text-xs">--color-surface</code>
          </span>
          <span class="flex items-center gap-3">
            <span class="h-7 w-14 shrink-0 rounded-sm border border-border-strong bg-text" />
            <code class="text-xs">--color-text</code>
          </span>
        </div>
      </div>
    ),
  },
  {
    label: "1 · utilities",
    panel: (
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <p class="m-0">
            Classes spend those variables: the class exists because the token
            does, and a new starter re-resolves every one of them.
          </p>
          <Code class="mt-3 text-xs" code={UTILITIES_CODE} />
        </div>
        <div class="flex flex-wrap items-center gap-3 self-center">
          <button type="button">Ship it</button>
          <button type="button" class="secondary">Cancel</button>
          <button type="button" class="ghost">Later</button>
        </div>
      </div>
    ),
  },
  {
    label: "2 · primitives",
    panel: (
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <p class="m-0">
            Semantic elements that ship styled and interactive — the behavior
            comes with them, classes change the tone.
          </p>
          <Code class="mt-3 text-xs" code={PRIMITIVE_CODE} />
        </div>
        <div class="flex flex-col justify-center gap-5">
          <div class="flex flex-wrap items-center gap-4">
            <label>
              <input type="checkbox" role="switch" checked /> Notify me
            </label>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <badge variant="success">shipped</badge>
            <badge variant="accent">accent</badge>
            <badge variant="neutral">neutral</badge>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "3 · component runtime",
    panel: (
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <p class="m-0">
            Custom elements that carry the theme with them: branded components
            you embed in any rendering framework, painted from the same
            document.
          </p>
          <div class="mt-3">
            <badge variant="warning">in development</badge>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 self-center">
          <Chip>react</Chip>
          <Chip>svelte</Chip>
          <Chip>vue</Chip>
          <Chip>vanilla</Chip>
        </div>
      </div>
    ),
  },
];

const CTA = "no-underline";
const GHOST = "ghost no-underline";

export default function Home(): JSX.Element {
  /*
   * The studio's mechanism, live: writing `--color-primary` on the document
   * is exactly what editing the token does — the page spends it everywhere.
   */
  let colorInput: HTMLInputElement | undefined;
  const [brand, setBrand] = createSignal("");
  const syncBrand = () => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue(
      "--color-primary",
    ).trim();
    setBrand(hex);
    if (colorInput) colorInput.value = hex;
  };
  onMount(syncBrand);
  const paintBrand = (hex: string) => {
    document.documentElement.style.setProperty("--color-primary", hex);
    setBrand(hex);
  };
  const unpaintBrand = () => {
    document.documentElement.style.removeProperty("--color-primary");
    syncBrand();
  };
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
              Spin is a design system and portable UI framework. Built on
              familiar concepts like design tokens, utility classes, and web
              components, Spin can be adopted incrementally and works with any
              rendering framework. Agents are first class authors and are given
              tooling to create consistent and beautiful interfaces, fast.
            </p>
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
                    onClick={() => {
                      document.documentElement.style.removeProperty(
                        "--color-primary",
                      );
                      setTheme(name);
                      requestAnimationFrame(syncBrand);
                    }}
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

      {/* Below the fold: the layers, then where to go. */}
      <div class="mx-auto max-w-screen-xl px-4 py-16 md:px-8">
        <Reveal>
          <Section title="The layers">
            <tabs>
              <For each={layers()}>
                {(layer, i) => (
                  <div>
                    <label>
                      <input
                        type="radio"
                        name="spin-layers"
                        checked={i() === 0}
                      />
                      {layer.label}
                    </label>
                    <section class="pt-4">{layer.panel}</section>
                  </div>
                )}
              </For>
            </tabs>
          </Section>
        </Reveal>

        <Reveal>
          <div class="mt-10">
            <Section title="The studio">
              <div class="grid gap-6 md:grid-cols-2">
                <div>
                  <p class="m-0">
                    In dev it mounts into the app you're running — the button in
                    the corner opens it. The theme is a file in your repo; edit
                    it and the running page repaints, both modes.
                  </p>
                  <p class="mt-3 mb-0 text-sm">
                    The mechanism is on this page: move primary and every
                    button, bar, and badge spends it.
                  </p>
                </div>
                <div class="border border-border bg-surface-raised rounded-md p-4">
                  <div class="flex items-center justify-between gap-3">
                    <span class="font-mono text-sm">color.primary</span>
                    <code class="text-xs text-text-muted">{brand()}</code>
                  </div>
                  <div class="mt-3 flex items-center gap-3">
                    <input
                      ref={colorInput}
                      type="color"
                      aria-label="color.primary"
                      onInput={(e) => paintBrand(e.currentTarget.value)}
                      class="h-9 w-12 cursor-pointer rounded-sm border border-border-strong bg-transparent p-0"
                    />
                    <button type="button" class="ghost" onClick={unpaintBrand}>
                      reset
                    </button>
                  </div>
                  <div class="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button">Ship it</button>
                    <badge variant="accent">accent</badge>
                    <span class="h-7 w-16 rounded-sm border border-border-strong bg-primary" />
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </Reveal>

        <Reveal>
          <div class="mt-10">
            <Section title="Tooling for agents">
              <div class="grid gap-4 md:grid-cols-3">
                <div class="border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4">
                  <p class="m-0 font-semibold text-text">
                    Vocabulary over MCP.
                  </p>
                  <p class="m-0 mt-2 text-sm">
                    <code class="text-xs">spin daemon</code>{" "}
                    runs one process on one port: the CLI, the MCP server, and
                    the studio speak to the same surface, and a client lists
                    what's available while your app runs.
                  </p>
                </div>
                <div class="border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4">
                  <p class="m-0 font-semibold text-text">
                    Markup that fails the lint.
                  </p>
                  <p class="m-0 mt-2 text-sm">
                    <code class="text-xs">@spin/lint</code>{" "}
                    is an oxlint plugin — rules like{" "}
                    <code class="text-xs">no-raw-colors</code> and{" "}
                    <code class="text-xs">closed-vocabulary</code>{" "}
                    — so authored UI that steps outside the system fails before
                    it ships.
                  </p>
                </div>
                <div class="border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4">
                  <p class="m-0 font-semibold text-text">
                    Rendered, not eyeballed.
                  </p>
                  <p class="m-0 mt-2 text-sm">
                    Oracles open every starter in a real browser: contrast,
                    layout, overflow — every theme, both modes.
                  </p>
                </div>
              </div>
            </Section>
          </div>
        </Reveal>

        <Reveal>
          <div class="mt-10">
            <Section title="One line of wiring">
              <Code code={WIRING} />
            </Section>
          </div>
        </Reveal>

        <Reveal>
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
        </Reveal>
      </div>
    </main>
  );
}
