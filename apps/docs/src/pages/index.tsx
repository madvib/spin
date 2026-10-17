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
  },
  "radius": { "md": { "$value": "0.25rem" } },
  "spacing": { "4": { "$value": "1rem" } }
}`;

const CARD_CODE =
  `<article class="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4 shadow-sm">
  <div class="flex items-baseline justify-between gap-3">
    <h3 class="m-0 text-lg font-semibold">Ethiopia Guji</h3>
    <span class="text-sm text-text-muted">$19</span>
  </div>
  <p class="m-0 text-sm text-text-muted">Apricot, jasmine, black tea</p>
  <div class="flex flex-wrap items-center gap-2">
    <button type="button" class="s-sm">Add to box</button>
  </div>
</article>`;

const DIALOG_CODE = `<dialog id="sold-out">
  <p>Next roast lands Tuesday.</p>
  <button type="button" onclick="sold-out.close()">Close</button>
</dialog>
<button type="button" onclick="sold-out.showModal()">Check stock</button>`;

/** The card in the utilities panel keeps a real count: the button is a JS
 * action, which is what `type="button"` is for. */
const [inBox, setInBox] = createSignal(0);

const SWATCHES: readonly (readonly [string, string])[] = [
  ["--color-primary", "bg-primary"],
  ["--color-surface", "bg-surface"],
  ["--color-text", "bg-text"],
  ["--radius-md", "rounded-md"],
];

const layers = (): readonly { label: string; panel: JSX.Element }[] => [
  {
    label: "0 · design tokens",
    panel: (
      <div class="grid gap-6 md:grid-cols-2">
        <div>
          <p class="m-0">
            One JSON file per theme: your colors, spacing, type, radii, shadows,
            and durations — light and dark side by side. The build emits it as
            CSS custom properties (the swatches here are four of them), and
            everything above this layer spends those names. Replace the file and
            you have a different product.
          </p>
          <Code class="mt-4 text-xs" code={TOKEN_JSON} />
        </div>
        <div class="flex flex-col justify-center gap-4">
          <For each={SWATCHES}>
            {([name, paint]) => (
              <span class="flex items-center gap-3">
                <span
                  class={`h-8 w-16 shrink-0 border border-border-strong ${paint}`}
                />
                <code class="text-xs">{name}</code>
              </span>
            )}
          </For>
        </div>
      </div>
    ),
  },
  {
    label: "1 · utilities",
    panel: (
      <div class="grid gap-6 md:grid-cols-2">
        <div>
          <p class="m-0">
            Utility classes replace CSS files. Every name is generated from the
            theme: <code class="text-xs">bg-primary</code> is your primary,{" "}
            <code class="text-xs">p-4</code>{" "}
            is a step on your spacing scale, and hover and focus states come
            from the same scale. The default theme alone generates 957 of them,
            across color, spacing, type, layout, borders, shadows, and motion —
            and the ones you never use are never generated.
          </p>
          <Code class="mt-4 text-xs" code={CARD_CODE} />
        </div>
        <div class="flex items-center justify-center">
          <article class="flex w-full max-w-xs flex-col gap-3 rounded-md border border-border bg-surface-raised p-4 shadow-sm">
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="m-0 text-lg font-semibold">Ethiopia Guji</h3>
              <span class="text-sm text-text-muted">$19</span>
            </div>
            <p class="m-0 text-sm text-text-muted">
              Apricot, jasmine, black tea
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="s-sm"
                onClick={() => setInBox((n) => n + 1)}
              >
                Add to box
              </button>
              {inBox() > 0 && <badge variant="success">{inBox()} in box</badge>}
            </div>
          </article>
        </div>
      </div>
    ),
  },
  {
    label: "2 · primitives",
    panel: (
      <div class="grid gap-6 md:grid-cols-2">
        <div>
          <p class="m-0">
            Thirty elements, for the parts of an interface that have behavior:
            dialog, tabs, switch, checkbox, radio, select, range, rating,
            popover, table, progress, meter, disclosure, avatar, alert, badge,
            card, breadcrumbs, kbd — styled HTML, not widgets built from divs. A
            switch is a checkbox wearing{" "}
            <code class="text-xs">role="switch"</code>; a dialog is a{" "}
            <code class="text-xs">&lt;dialog&gt;</code>, so focus trapping,
            Escape, and the backdrop come from the browser.
          </p>
          <Code class="mt-4 text-xs" code={DIALOG_CODE} />
        </div>
        <div class="flex flex-col justify-center gap-5">
          <label>
            <input type="checkbox" role="switch" checked />{" "}
            Notify me when the roast lands
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <badge variant="success">shipped</badge>
            <badge variant="accent">roaster's pick</badge>
            <badge variant="neutral">decaf</badge>
          </div>
          <div>
            <button
              type="button"
              ref={(el) => {
                el.addEventListener("click", () =>
                  el.nextElementSibling instanceof HTMLDialogElement &&
                  el.nextElementSibling.showModal());
              }}
            >
              Check stock
            </button>
            <dialog
              aria-label="Stock"
              ref={(el) => {
                el.addEventListener("close", () =>
                  el.close());
              }}
              class="w-80 rounded-md border border-border bg-surface-raised p-4 text-text shadow-lg"
            >
              <p class="m-0">
                Next roast lands Tuesday. Focus is trapped until you close this
                — the browser does it.
              </p>
              <div class="mt-4 flex justify-end">
                <button
                  type="button"
                  class="secondary"
                  onClick={(e) =>
                    e.currentTarget.closest("dialog")?.close()}
                >
                  Close
                </button>
              </div>
            </dialog>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "3 · component runtime",
    panel: (
      <div class="grid gap-6 md:grid-cols-2">
        <div>
          <p class="m-0">
            The runtime turns these elements into custom elements —
            <code class="text-xs">&lt;ui-button&gt;</code>,{" "}
            <code class="text-xs">&lt;ui-dialog&gt;</code>{" "}
            — branded components that carry the theme with them. The theme is
            CSS custom properties, and custom elements are native platform: drop
            the same component into React, Svelte, Vue, or a page with no
            framework at all, and it arrives already painted in your brand. One
            component, every framework, no runtime to ship for it — which is
            also where the speed comes from.
          </p>
          <p class="mt-3 mb-0 text-sm text-text-muted">
            Building it now. The primitives above are the same components, and
            the theme document you write today is the one they will wear.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 self-center">
          <Chip>react</Chip>
          <Chip>svelte</Chip>
          <Chip>vue</Chip>
          <Chip>solid</Chip>
          <Chip>plain html</Chip>
        </div>
      </div>
    ),
  },
];

const STUDIO_FEATURES: readonly string[] = [
  "Every theme on disk, palette and all — click one and the app re-themes",
  "Editors for color, type, icons, motion, spacing, radius, and shadows, each with live specimens",
  "Light and dark per theme, flipped while the app repaints",
  "New theme from a copy of one you have, or scaffolded from the required roles",
  "An issues list: values that fail validation, linked to the editor that fixes them",
  "Undo, redo, save — it writes spin/*.json in your repo, the file your build reads",
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
      <section class="relative grid min-h-dvh md:grid-cols-2">
        <header class="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 px-6 py-5 md:px-12">
          <Logo size="lg" class="text-text" />
          <div class="flex items-center gap-3">
            <span class="hidden text-xs font-semibold text-text-muted sm:block">
              theme
            </span>
            <div class="flex flex-wrap items-center gap-2">
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
                    title={`Switch to the ${name} theme`}
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
        </header>

        <div class="flex flex-col justify-center px-6 py-5 md:px-12 md:py-10">
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
        </div>

        <div class="flex items-center justify-center overflow-hidden border-t border-border md:border-t-0 md:border-l">
          <Mark class="w-full max-w-screen-md text-text" />
        </div>
      </section>

      {/* Below the fold: the layers, then where to go. */}
      <div class="mx-auto max-w-screen-xl px-4 py-16 md:px-8">
        <Reveal>
          <Section title="The layers">
            <p class="m-0 mb-6 max-w-prose text-text-muted">
              Nothing here is all-or-nothing. Bring tokens to an app you already
              have, add utility classes where you want to stop writing CSS, pull
              in an element when you want its behavior, and take the component
              runtime when you want the same branded component in a second
              framework. Each layer reads the one below it, and you can stop at
              any of them.
            </p>
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
          <div class="mt-16">
            <Section title="The studio">
              <div class="grid gap-6 md:grid-cols-2">
                <p class="m-0 max-w-prose">
                  The studio is the theme editor, mounted into the app it is
                  editing — this site included, as below. It docks to either
                  side of that app or takes the whole screen, and every change
                  repaints the app beside it: themes, palettes, type, motion,
                  spacing, the components. The <strong>Theme</strong>{" "}
                  button in the corner of this page opens it on this page.
                </p>
                <div class="flex flex-col justify-center gap-2 md:max-w-xs">
                  <For each={STUDIO_FEATURES}>
                    {(line) => (
                      <span class="flex gap-2 text-sm">
                        <span class="shrink-0 font-semibold text-primary">
                          —
                        </span>
                        <span class="text-text-muted">{line}</span>
                      </span>
                    )}
                  </For>
                </div>
              </div>
              <img
                src="/studio.png"
                loading="lazy"
                alt="This site with the studio docked to its right, editing the theme the site is wearing"
                class="mt-6 w-full rounded-md border border-border"
              />
              <div class="mt-6 grid gap-6 md:grid-cols-2">
                <p class="m-0">
                  Drag <code class="text-xs">color.primary</code>{" "}
                  and every button, badge, and bar on this page repaints with
                  it. The value below is the one the page is using right now.
                </p>
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
                    <button type="button">Add to box</button>
                    <badge variant="success">shipped</badge>
                    <span class="h-7 w-16 rounded-sm border border-border-strong bg-primary" />
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </Reveal>

        <Reveal>
          <div class="mt-16">
            <Section title="Tooling for agents">
              <div class="grid gap-4 md:grid-cols-3">
                <div class="border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4">
                  <p class="m-0 font-semibold text-text">
                    An MCP client reads the project.
                  </p>
                  <p class="m-0 mt-2 text-sm">
                    Claude, Cursor, or any MCP client connects to the running
                    dev server and reads what is actually there: the token
                    document, the utilities the preset generates, the elements
                    it ships. Code it writes uses those names instead of
                    inventing parallel ones.
                  </p>
                </div>
                <div class="border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4">
                  <p class="m-0 font-semibold text-text">
                    Lint errors name the fix.
                  </p>
                  <p class="m-0 mt-2 text-sm">
                    <code class="text-xs">@spin/lint</code>{" "}
                    runs in oxlint: a hardcoded{" "}
                    <code class="text-xs">#c8102e</code>{" "}
                    fails with the token to use instead; a class the preset will
                    not generate fails as one that does not exist; a utility
                    parked on an element that styles itself fails with where it
                    belongs.
                  </p>
                </div>
                <div class="border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4">
                  <p class="m-0 font-semibold text-text">
                    Every theme opens in a browser.
                  </p>
                  <p class="m-0 mt-2 text-sm">
                    The gates render each starter in both modes and check
                    contrast, layout, overflow, and stacking — failures that
                    never show up in a code review, only on the page.
                  </p>
                </div>
              </div>
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
