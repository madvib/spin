/**
 * Surfaces & Opacity (Utilities): practical guide to background, border, text,
 * opacity-modifier, and scoped mode classes in markup.
 */
import { A } from "@solidjs/router";
import { createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { mode, theme } from "@spinjs/kit";
import { PageHeader, Section, Specimen } from "../../../ui/index.ts";

const SURFACE_CARDS: readonly {
  readonly name: string;
  readonly usage: string;
  readonly boxClass: string;
  readonly classes: readonly string[];
}[] = [
  {
    name: "Page canvas",
    usage: "Default app background and primary reading ink.",
    boxClass: "border bg-surface",
    classes: ["bg-surface", "border"],
  },
  {
    name: "Raised surface",
    usage: "Elevated cards, headers, menus, and floating panels.",
    boxClass: "border bg-surface-raised shadow-sm",
    classes: ["bg-surface-raised", "shadow-sm"],
  },
  {
    name: "Sunken well",
    usage: "Segmented tab tracks, code wells, and recessed toolbars.",
    boxClass: "border bg-surface-sunken",
    classes: ["bg-surface-sunken", "text-muted"],
  },
];

const ALPHA_STEPS: readonly {
  readonly utility: string;
  readonly swatchClass: string;
  readonly pct: string;
}[] = [
  { utility: "bg-primary/10", swatchClass: "bg-primary/10", pct: "10%" },
  { utility: "bg-primary/20", swatchClass: "bg-primary/20", pct: "20%" },
  { utility: "bg-primary/40", swatchClass: "bg-primary/40", pct: "40%" },
  { utility: "bg-primary/60", swatchClass: "bg-primary/60", pct: "60%" },
  { utility: "bg-primary/80", swatchClass: "bg-primary/80", pct: "80%" },
  { utility: "bg-primary", swatchClass: "bg-primary", pct: "100%" },
];

const SCOPED_MODE_SNIPPET = `<div data-mode="dark" class="rounded-lg border bg-surface p-4">
  <div class="flex items-center justify-between gap-3 rounded-md border bg-surface-raised p-3">
    <div>
      <strong>Scoped dark preview</strong>
      <small class="block">Same utility classes, inverted subtree</small>
    </div>
    <badge class="badge-success">Live</badge>
  </div>
</div>`;

export default function StylingColor(): JSX.Element {
  const [scopedMode, setScopedMode] = createSignal<"light" | "dark" | null>(
    null,
  );
  const activeScopedMode = (): "light" | "dark" =>
    scopedMode() ?? (mode() === "dark" ? "light" : "dark");

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Surfaces"
        lede="Apply surface layers, borders, text tones, and opacity modifiers in your templates."
      />

      <Section id="layers" title="Surface elevation">
        <p class="max-w-prose">
          Three surface utilities handle most container backgrounds — the base
          page canvas, raised cards and bars above it, and sunken wells recessed
          into it. Body text inherits the default foreground color automatically;
          add <code>text-muted</code> for secondary labels and metadata.
        </p>
        <div class="my-3 grid gap-3 sm:grid-cols-3">
          <For each={SURFACE_CARDS}>
            {(item) => (
              <div class="flex flex-col justify-between gap-2 rounded-lg border bg-surface p-2">
                <div
                  class={`flex min-h-24 flex-col justify-between rounded-md p-3 ${item.boxClass}`}
                >
                  <span class="type-body-emphasized">{item.name}</span>
                  <span class="type-caption text-muted">{item.usage}</span>
                </div>
                <div class="flex flex-wrap gap-1 px-1 pb-1">
                  <For each={item.classes}>
                    {(cls) => <code>{cls}</code>}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="alpha" title="Opacity modifiers">
        <p class="max-w-prose">
          Add a <code>/0</code> to <code>/100</code> percentage to any
          background, text, or border color class — such as{" "}
          <code>bg-surface/80</code> for a translucent sticky header or{" "}
          <code>bg-primary/10</code> for a subtle highlight tint:
        </p>
        <div class="my-3 grid grid-cols-2 gap-2 rounded-lg border bg-surface-raised p-4 sm:grid-cols-3 lg:grid-cols-6">
          <For each={ALPHA_STEPS}>
            {(step) => (
              <div class="flex flex-col gap-2 rounded-md border bg-surface p-2">
                <div class={`h-12 w-full rounded-sm border ${step.swatchClass}`} />
                <div class="flex items-center justify-between gap-1">
                  <code class="whitespace-nowrap">{step.utility}</code>
                  <small>{step.pct}</small>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="scoped-mode" title="Scoping light or dark subtrees">
        <p class="max-w-prose">
          Color classes adapt automatically to dark mode without repeating{" "}
          <code>dark:</code> prefixes on every element. If a single sidebar,
          hero banner, or preview frame needs to stay dark inside a light page
          (or vice versa), set <code>data-mode</code> on that container:
        </p>
        <div class="my-3">
          <Specimen
            title="Scoped subtree mode"
            code={SCOPED_MODE_SNIPPET}
            controls={
              <>
                <button
                  type="button"
                  class={
                    activeScopedMode() === "light"
                      ? "primary s-sm"
                      : "secondary s-sm"
                  }
                  onClick={() => setScopedMode("light")}
                >
                  Light
                </button>
                <button
                  type="button"
                  class={
                    activeScopedMode() === "dark"
                      ? "primary s-sm"
                      : "secondary s-sm"
                  }
                  onClick={() => setScopedMode("dark")}
                >
                  Dark
                </button>
              </>
            }
            preview={
              <div
                data-theme={theme()}
                data-mode={activeScopedMode()}
                class="w-full max-w-md rounded-lg border bg-surface p-4"
              >
                <div class="flex items-center justify-between gap-3 rounded-md border bg-surface-raised p-3">
                  <div>
                    <strong>Scoped {activeScopedMode()} preview</strong>
                    <small class="block">
                      Same utility classes, inverted subtree
                    </small>
                  </div>
                  <badge class="badge-success">Live</badge>
                </div>
              </div>
            }
          />
        </div>
        <p class="max-w-prose text-muted">
          To customize your brand's palette roles or check contrast ratios, see{" "}
          <A href="/docs/themes/palettes">Colors</A>.
        </p>
      </Section>
    </main>
  );
}
