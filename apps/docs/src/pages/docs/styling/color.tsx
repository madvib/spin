/**
 * Color & Dark Mode guide (Stage D4): semantic role utilities, paired fills and
 * inks, dark mode via theme tokens and data-mode, alpha thinning via color-mix,
 * and honest scale edges.
 */
import { A } from "@solidjs/router";
import { createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { mode, theme } from "@spinjs/kit";
import {
  PageHeader,
  Section,
  Specimen,
} from "../../../ui/index.ts";

interface RoleSwatch {
  readonly job: string;
  readonly sample: string;
  readonly detail: string;
  readonly boxClass: string;
  readonly detailClass: string;
  readonly tokens: readonly string[];
}

const ROLE_SWATCHES: readonly RoleSwatch[] = [
  {
    job: "Page surface",
    sample: "Default canvas & body ink",
    detail: "Secondary caption in muted ink",
    boxClass: "border bg-surface",
    detailClass: "text-muted",
    tokens: ["bg-surface", "text-muted", "border"],
  },
  {
    job: "Raised surface",
    sample: "Card or elevated sheet",
    detail: "Hairline border separates layers",
    boxClass: "border bg-surface-raised",
    detailClass: "text-muted",
    tokens: ["bg-surface-raised", "border"],
  },
  {
    job: "Primary role",
    sample: "Primary call to action",
    detail: "Paired foreground on primary",
    boxClass: "bg-primary text-on-primary",
    detailClass: "opacity-90",
    tokens: ["bg-primary", "text-on-primary"],
  },
  {
    job: "Secondary role",
    sample: "Supporting action surface",
    detail: "Paired foreground on secondary",
    boxClass: "bg-secondary text-on-secondary",
    detailClass: "opacity-90",
    tokens: ["bg-secondary", "text-on-secondary"],
  },
  {
    job: "Accent role",
    sample: "Highlight & badge tone",
    detail: "Paired foreground on accent",
    boxClass: "bg-accent text-on-accent",
    detailClass: "opacity-90",
    tokens: ["bg-accent", "text-on-accent"],
  },
];

interface PairedFill {
  readonly label: string;
  readonly fill: string;
  readonly ink: string;
  readonly swatchClass: string;
}

const PAIRED_FILLS: readonly PairedFill[] = [
  {
    label: "Primary",
    fill: "bg-primary",
    ink: "text-on-primary",
    swatchClass: "bg-primary text-on-primary",
  },
  {
    label: "Secondary",
    fill: "bg-secondary",
    ink: "text-on-secondary",
    swatchClass: "bg-secondary text-on-secondary",
  },
  {
    label: "Accent",
    fill: "bg-accent",
    ink: "text-on-accent",
    swatchClass: "bg-accent text-on-accent",
  },
  {
    label: "Selected",
    fill: "bg-selected",
    ink: "text-on-selected",
    swatchClass: "bg-selected text-on-selected",
  },
  {
    label: "Success",
    fill: "bg-semantic-success",
    ink: "text-on-semantic-success",
    swatchClass: "bg-semantic-success text-on-semantic-success",
  },
  {
    label: "Warning",
    fill: "bg-semantic-warning",
    ink: "text-on-semantic-warning",
    swatchClass: "bg-semantic-warning text-on-semantic-warning",
  },
  {
    label: "Error",
    fill: "bg-semantic-error",
    ink: "text-on-semantic-error",
    swatchClass: "bg-semantic-error text-on-semantic-error",
  },
  {
    label: "Info",
    fill: "bg-semantic-info",
    ink: "text-on-semantic-info",
    swatchClass: "bg-semantic-info text-on-semantic-info",
  },
  {
    label: "Disabled",
    fill: "bg-disabled",
    ink: "text-on-disabled",
    swatchClass: "bg-disabled text-on-disabled",
  },
];

interface AlphaStep {
  readonly step: string;
  readonly utility: string;
  readonly swatchClass: string;
}

const ALPHA_RAMP: readonly AlphaStep[] = [
  { step: "100%", utility: "bg-primary/100", swatchClass: "bg-primary/100" },
  { step: "80%", utility: "bg-primary/80", swatchClass: "bg-primary/80" },
  { step: "60%", utility: "bg-primary/60", swatchClass: "bg-primary/60" },
  { step: "40%", utility: "bg-primary/40", swatchClass: "bg-primary/40" },
  { step: "20%", utility: "bg-primary/20", swatchClass: "bg-primary/20" },
  { step: "0%", utility: "bg-primary/0", swatchClass: "bg-primary/0" },
];

const MODE_SPECIMEN_SNIPPET = `<div data-theme="editorial" data-mode="dark" class="rounded-lg border bg-surface p-4">
  <div class="flex items-center justify-between gap-3 rounded-md border bg-surface-raised p-3">
    <div>
      <strong>Release channel</strong>
      <div class="text-muted">Production traffic is healthy</div>
    </div>
    <span class="rounded-sm bg-semantic-success px-2 py-1 text-on-semantic-success">
      Healthy
    </span>
  </div>
  <div class="mt-3 flex items-center gap-2">
    <button type="button" class="primary">Deploy now</button>
    <button type="button">Inspect logs</button>
  </div>
</div>`;

export default function StylingColor(): JSX.Element {
  const [specimenOverride, setSpecimenOverride] = createSignal<
    "light" | "dark" | null
  >(null);

  const specimenMode = (): "light" | "dark" =>
    specimenOverride() ?? (mode() === "dark" ? "dark" : "light");

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Color"
        lede="Name the role an element plays on the page and let your brand supply the palette. Write role utilities once for light and dark mode, pair every painted fill with its readable ink, and thin any theme color toward transparency."
      />

      <Section id="roles" title="Roles, not colors">
        <p class="max-w-prose">
          Write <code>bg-primary</code>, <code>text-muted</code>, and{" "}
          <code>border</code> to name the job an element performs on the
          page, never the pigment it wears. The theme chooses what primary is;
          your markup chooses where primary goes. Switch design languages or
          toggle light and dark mode in the top bar and every swatch below
          repaints from the active palette without changing a class name:
        </p>

        <div class="my-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For each={ROLE_SWATCHES}>
            {(item) => (
              <div class="flex flex-col justify-between gap-2 rounded-lg border bg-surface p-2">
                <div
                  class={`flex min-h-24 flex-col justify-between rounded-md p-3 ${item.boxClass}`}
                >
                  <span class={`type-caption ${item.detailClass}`}>
                    {item.job}
                  </span>
                  <div class="flex flex-col gap-1">
                    <span class="type-body-emphasized">{item.sample}</span>
                    <span class={`type-caption ${item.detailClass}`}>
                      {item.detail}
                    </span>
                  </div>
                </div>
                <div class="flex flex-wrap gap-1 px-1 pb-1">
                  <For each={item.tokens}>
                    {(tok) => <code class="whitespace-nowrap">{tok}</code>}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="paired-inks" title="Every fill has its ink">
        <p class="max-w-prose">
          Pair every painted surface with the foreground ink built to sit on it:
          write <code>bg-primary</code> with <code>text-on-primary</code>, or{" "}
          <code>bg-semantic-error</code> with{" "}
          <code>text-on-semantic-error</code>. Every pair stays readable in both
          light and dark mode, verified by the{" "}
          <A href="/docs/themes/validation">theme gates</A>; on{" "}
          <code>bg-surface</code> and <code>bg-surface-raised</code>, body copy
          already inherits the page&apos;s default ink and needs no ink class of
          its own. Leave a painted fill without its paired ink — or restate an
          ink the element already carries — and{" "}
          <A href="/docs/tooling/lints">the lint</A> offers the matching class
          before you ship.
        </p>

        <div class="my-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For each={PAIRED_FILLS}>
            {(pair) => (
              <div class="flex flex-col justify-between gap-2 rounded-lg border bg-surface p-2">
                <div
                  class={`flex items-center justify-between rounded-md px-3 py-3 ${pair.swatchClass}`}
                >
                  <span class="type-body-emphasized">{pair.label}</span>
                  <span class="type-code">Readable in both modes</span>
                </div>
                <div class="flex flex-wrap items-center gap-1 px-1 pb-1">
                  <code>{pair.fill}</code>
                  <small>+</small>
                  <code>{pair.ink}</code>
                </div>
              </div>
            )}
          </For>
        </div>

        <p class="max-w-prose">
          Browse the full set of required color roles, status inks, and contrast
          floors in the <A href="/docs/themes/reference">Token Reference</A>.
        </p>
      </Section>

      <Section id="dark-mode" title="Dark mode is a theme, not a variant">
        <p class="max-w-prose">
          Write each color utility once and switch modes with{" "}
          <code>data-mode=&quot;light&quot;</code> or{" "}
          <code>data-mode=&quot;dark&quot;</code> on <code>&lt;html&gt;</code>{" "}
          or on any nested container — never by scattering <code>dark:</code>{" "}
          classes across your templates. Because the dark theme declares its own
          token values, one class has two honest answers; per-class theme
          patches would say &ldquo;your theme is incomplete&rdquo; while
          appearing to fix it one element at a time. Flip the{" "}
          <code>data-mode</code> switch on the specimen below to repaint the
          same markup in place:
        </p>

        <div class="my-2">
          <Specimen
            title="Same markup in both modes — zero dark: classes"
            code={MODE_SPECIMEN_SNIPPET}
            controls={
              <>
                <code>data-mode=&quot;{specimenMode()}&quot;</code>
                <button
                  type="button"
                  class={
                    specimenMode() === "light"
                      ? "primary s-sm type-code"
                      : "s-sm type-code"
                  }
                  onClick={() => setSpecimenOverride("light")}
                >
                  light
                </button>
                <button
                  type="button"
                  class={
                    specimenMode() === "dark"
                      ? "primary s-sm type-code"
                      : "s-sm type-code"
                  }
                  onClick={() => setSpecimenOverride("dark")}
                >
                  dark
                </button>
              </>
            }
            preview={
              <div
                data-theme={theme()}
                data-mode={specimenMode()}
                class="flex flex-col gap-3 rounded-lg border bg-surface p-4"
              >
                <div class="flex items-center justify-between gap-3 rounded-md border bg-surface-raised p-3">
                  <div class="flex flex-col gap-1">
                    <strong>Release channel</strong>
                    <small>Production traffic is healthy</small>
                  </div>
                  <span class="rounded-sm bg-semantic-success px-2 py-1 type-caption-emphasized text-on-semantic-success">
                    Healthy
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" class="primary">
                    Deploy now
                  </button>
                  <button type="button">Inspect logs</button>
                </div>
              </div>
            }
          />
        </div>
      </Section>

      <Section id="alpha" title="Thinning without minting">
        <p class="max-w-prose">
          Append an <code>/0</code>–<code>/100</code> alpha suffix such as{" "}
          <code>bg-surface/80</code>, <code>bg-primary/60</code>, or{" "}
          <code>border-strong/50</code> to mix any color role toward
          transparency via <code>color-mix(in srgb, …)</code> so the color stays
          the theme&apos;s while only the strength is yours:
        </p>

        <div class="my-2 flex flex-col gap-3 rounded-lg border bg-surface-raised p-4">
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border-strong/50 bg-surface/80 px-3 py-2">
            <span class="type-body-emphasized">
              Floating bar thinned over raised canvas
            </span>
            <div class="flex flex-wrap items-center gap-1">
              <code>bg-surface/80</code>
              <code>border-strong/50</code>
            </div>
          </div>

          <div class="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <For each={ALPHA_RAMP}>
              {(item) => (
                <div class="flex min-w-0 flex-col gap-2 rounded-md border bg-surface p-2">
                  <div
                    class={`h-12 w-full rounded-sm border-strong/50 ${item.swatchClass}`}
                  />
                  <div class="flex min-w-0 flex-wrap items-center justify-between gap-1">
                    <code class="whitespace-nowrap">{item.utility}</code>
                    <small>{item.step}</small>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Section>

      <Section id="edges" title="What the scale doesn't do">
        <p class="max-w-prose">
          Write a raw color literal into a bracket class like{" "}
          <code>bg-[#fff]</code>, <code>text-[rgb(0,0,0)]</code>, or{" "}
          <code>border-[red]</code> and the stylesheet emits nothing for it,
          because a color written in a class is a value the theme never chose;
          use a semantic role or declare a token under <code>color.*</code> in{" "}
          <code>spin/&lt;brand&gt;/tokens.json</code> instead.
        </p>

        <p class="max-w-prose">
          Write <code>border-current</code>, <code>bg-current</code>, or{" "}
          <code>text-current</code> (including alpha suffixes like{" "}
          <code>border-current/20</code>) when a border, divider, or icon should
          inherit the element&apos;s computed text color; camelCase{" "}
          <code>currentColor</code> (<code>border-currentColor</code>,{" "}
          <code>bg-currentColor</code>) and <code>transparent</code> (
          <code>bg-transparent</code>, <code>border-transparent</code>) resolve
          alongside them:
        </p>

        <div class="my-2 flex flex-wrap items-center gap-3 rounded-lg border bg-surface-raised p-4">
          <div class="inline-flex items-center gap-2 rounded-md border border-current px-3 py-1 type-body text-primary">
            <span>Inherits primary ink</span>
            <code>border-current</code>
          </div>
          <div class="inline-flex items-center gap-2 rounded-md border border-current/20 px-3 py-1 type-body text-accent">
            <span>Thinned current border</span>
            <code>border-current/20</code>
          </div>
          <div class="inline-flex items-center gap-2 rounded-md border border-currentColor bg-transparent px-3 py-1 type-body text-secondary">
            <span>CSS keyword spelling</span>
            <code>border-currentColor</code>
            <code>bg-transparent</code>
          </div>
        </div>

        <p class="max-w-prose">
          Leave <code>dark:</code> and <code>light:</code> variant prefixes out
          of your class lists — neither variant exists by design (
          <A href="#dark-mode">Dark mode is a theme, not a variant</A>), not by
          omission, so every mode switch flows through your theme tokens and{" "}
          <code>data-mode</code>.
        </p>
      </Section>
    </main>
  );
}
