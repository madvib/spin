/**
 * Space, Layout & Responsive guide (Stage D5): spacing scale ladder,
 * project-declared layout compositions, responsive theme breakpoints,
 * positioning, CSS anchors, top-layer stacking, icon sizing, and the
 * `bare` control escape.
 */
import { A } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import {
  PageHeader,
  Section,
  Specimen,
  starterDoc,
} from "../../../ui/index.ts";

interface SpacingLadderStep {
  readonly step: string;
  readonly widthClass: string;
  readonly padUtil: string;
  readonly gapUtil: string;
  readonly widthUtil: string;
}

const SPACING_LADDER: readonly SpacingLadderStep[] = [
  { step: "0", widthClass: "w-0", padUtil: "p-0", gapUtil: "gap-0", widthUtil: "w-0" },
  { step: "1", widthClass: "w-1", padUtil: "p-1", gapUtil: "gap-1", widthUtil: "w-1" },
  { step: "2", widthClass: "w-2", padUtil: "p-2", gapUtil: "gap-2", widthUtil: "w-2" },
  { step: "3", widthClass: "w-3", padUtil: "p-3", gapUtil: "gap-3", widthUtil: "w-3" },
  { step: "4", widthClass: "w-4", padUtil: "p-4", gapUtil: "gap-4", widthUtil: "w-4" },
  { step: "5", widthClass: "w-5", padUtil: "p-5", gapUtil: "gap-5", widthUtil: "w-5" },
  { step: "6", widthClass: "w-6", padUtil: "p-6", gapUtil: "gap-6", widthUtil: "w-6" },
  { step: "7", widthClass: "w-7", padUtil: "p-7", gapUtil: "gap-7", widthUtil: "w-7" },
  { step: "8", widthClass: "w-8", padUtil: "p-8", gapUtil: "gap-8", widthUtil: "w-8" },
  { step: "10", widthClass: "w-10", padUtil: "p-10", gapUtil: "gap-10", widthUtil: "w-10" },
  { step: "12", widthClass: "w-12", padUtil: "p-12", gapUtil: "gap-12", widthUtil: "w-12" },
  { step: "14", widthClass: "w-14", padUtil: "p-14", gapUtil: "gap-14", widthUtil: "w-14" },
  { step: "16", widthClass: "w-16", padUtil: "p-16", gapUtil: "gap-16", widthUtil: "w-16" },
  { step: "20", widthClass: "w-20", padUtil: "p-20", gapUtil: "gap-20", widthUtil: "w-20" },
  { step: "24", widthClass: "w-24", padUtil: "p-24", gapUtil: "gap-24", widthUtil: "w-24" },
  { step: "36", widthClass: "w-36", padUtil: "p-36", gapUtil: "gap-36", widthUtil: "w-36" },
  { step: "40", widthClass: "w-40", padUtil: "p-40", gapUtil: "gap-40", widthUtil: "w-40" },
  { step: "56", widthClass: "w-56", padUtil: "p-56", gapUtil: "gap-56", widthUtil: "w-56" },
  { step: "60", widthClass: "w-60", padUtil: "p-60", gapUtil: "gap-60", widthUtil: "w-60" },
  { step: "64", widthClass: "w-64", padUtil: "p-64", gapUtil: "gap-64", widthUtil: "w-64" },
];

interface IconStepSpec {
  readonly step: "sm" | "md" | "lg";
  readonly sizeClass: string;
  readonly glyphClass: string;
  readonly label: string;
}

const ICON_STEPS: readonly IconStepSpec[] = [
  {
    step: "sm",
    sizeClass: "icon-sm",
    glyphClass: "i-lucide-compass",
    label: "Compact inline glyph",
  },
  {
    step: "md",
    sizeClass: "icon-md",
    glyphClass: "i-lucide-layers",
    label: "Default control glyph",
  },
  {
    step: "lg",
    sizeClass: "icon-lg",
    glyphClass: "i-lucide-sparkles",
    label: "Section header glyph",
  },
];

type PreviewWidth = "compact" | "sm" | "md" | "lg";


const DENSITY_SNIPPET = `<div class="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
  <strong>Release pipeline</strong>
  <div class="flex flex-wrap items-center gap-4">
    <button type="button" class="primary">Promote build</button>
    <button type="button">Compare diff</button>
  </div>
</div>

<!-- Same markup on the compact facet: spacing tightens, colors and fonts hold -->
<div data-spacing="compact" class="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
  <strong>Release pipeline</strong>
  <div class="flex flex-wrap items-center gap-4">
    <button type="button" class="primary">Promote build</button>
    <button type="button">Compare diff</button>
  </div>
</div>`;

const RESPONSIVE_SPECIMEN_SNIPPET = `<div class="mx-auto w-full max-w-screen-lg rounded-lg border border-border bg-surface p-4">
  <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
    <strong>Edge regions</strong>
    <badge variant="info" class="max-md:inline-flex md:hidden">Compact view</badge>
  </div>
  <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <card><card-header><card-title>us-east</card-title></card-header></card>
    <card><card-header><card-title>eu-central</card-title></card-header></card>
    <card><card-header><card-title>ap-northeast</card-title></card-header></card>
  </div>
</div>`;

const ANCHORED_PANEL_SNIPPET = `<div class="isolate relative">
  <button type="button" class="relative anchor-release-menu">
    <span>Release targets</span>
    <span class="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary text-on-primary"></span>
  </button>

  <div class="z-dropdown position-anchor-release-menu position-area-bottom-span-right rounded-md border border-border bg-surface-raised p-3 shadow-lg">
    <strong>Pinned to trigger</strong>
    <small>Opens in the top layer under --release-menu</small>
  </div>
</div>`;

const BARE_ESCAPE_SNIPPET = `<!-- Standard ghost button: keeps button height, padding, and weight -->
<button type="button" class="ghost">Ghost action</button>

<!-- Unpainted bare trigger: keeps <button> semantics, strips button chrome -->
<button
  type="button"
  class="bare inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1 type-code text-text-muted"
>
  <span>Command palette</span>
  <kbd>⌘K</kbd>
</button>

<!-- Painted bare trigger: names its paired ink explicitly -->
<button
  type="button"
  class="bare inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 type-caption-strong text-on-primary"
>
  <span>Live filter</span>
</button>`;

function readGroupStep(group: string, step: string, fallback: string): string {
  const doc = starterDoc() as Record<string, unknown>;
  const table = doc[group] as Record<string, { $value?: unknown }> | undefined;
  const raw = table?.[step]?.$value;
  return typeof raw === "string" || typeof raw === "number"
    ? String(raw)
    : fallback;
}

export default function StylingSpace(): JSX.Element {
  const [previewWidth, setPreviewWidth] = createSignal<PreviewWidth>("lg");
  const [anchorArea, setAnchorArea] = createSignal<"bottom" | "top">("bottom");
  const [panelOpen, setPanelOpen] = createSignal(true);

  const stageWidthClass = (): string => {
    const mode = previewWidth();
    if (mode === "compact") return "max-w-sm";
    if (mode === "sm") return "max-w-md";
    if (mode === "md") return "max-w-lg";
    return "w-full";
  };

  const gridReflowClass = (): string => {
    const mode = previewWidth();
    if (mode === "compact") return "mt-3 grid grid-cols-1 gap-3";
    if (mode === "sm") return "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2";
    if (mode === "md") return "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2";
    return "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
  };

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Space & Layout"
        lede="How do I lay things out, space them, and make them respond? Pad, gap, and size elements from your theme's spacing scale, name the flex and grid compositions your project repeats, and reflow across your theme's breakpoints. Pin floating panels to their triggers in the top layer and strip default control chrome when a custom trigger needs button semantics without button paint."
      />

      <Section id="scale" title="Space comes from the scale">
        <p class="max-w-prose">
          Write <code>p-4</code>, <code>gap-2</code>, or <code>m-0</code> to pad
          a box, space a row, or clear a margin using a step from your
          theme&apos;s spacing scale (<code>spacing.*</code>). Because every
          padding, margin, gap, and step-sized width or height (
          <code>w-4</code>, <code>h-4</code>) reads the same scale, tightening
          or loosening your theme in the Studio or in{" "}
          <code>spin/&lt;name&gt;.json</code> rescales the whole page at once.
          Write a step your theme never declared and it renders nothing —{" "}
          <A href="/docs/tooling/lints">the build and lint</A> name the missing
          class before you ship; for half-steps the scale omits, reach for the
          nearest neighbor (<code>gap-1</code> or <code>gap-2</code> in place of{" "}
          <code>gap-1.5</code>).
        </p>

        <div class="my-2 flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
          <div class="m-0 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-4">
            <div class="flex flex-wrap items-center gap-2">
              <strong>Live box on the active scale</strong>
              <small>
                Padded, gapped, and zero-margined from{" "}
                <code>spacing.*</code>
              </small>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <code>p-4</code>
              <code>gap-2</code>
              <code>m-0</code>
            </div>
          </div>

          <div class="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-surface p-3">
            <For each={SPACING_LADDER}>
              {(item) => (
                <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div class="flex shrink-0 items-center gap-1">
                    <code>{item.padUtil}</code>
                    <code>{item.gapUtil}</code>
                  </div>
                  <div class="flex min-w-24 grow items-center gap-2">
                    <div
                      class={`h-3 max-w-full shrink rounded-sm bg-primary text-on-primary ${item.widthClass}`}
                    />
                    <small>{readGroupStep("spacing", item.step, "—")}</small>
                  </div>
                  <div class="shrink-0">
                    <code>{item.widthUtil}</code>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        <p class="max-w-prose">
          Switch starter themes in the top bar (<code>material</code> widens the
          ramp, <code>industrial</code> tightens it) and watch every bar and gap
          resize together. Browse every directional axis (<code>px-*</code>,{" "}
          <code>py-*</code>, <code>ps-*</code>, <code>pe-*</code>,{" "}
          <code>mx-auto</code>) in the{" "}
          <A href="/docs/styling/catalog#spacing">Utility Reference</A> and the
          full <code>spacing.*</code> token group in the{" "}
          <A href="/docs/themes/reference#groups">Token Reference</A>.
        </p>
      </Section>

      <Section id="density" title="Density is a subtree decision">
        <p class="max-w-prose">
          A <code>compact.spacing.json</code> facet tightens the spacing ramp
          without touching colors or fonts, and it applies wherever you hang
          it: wrap a subtree in <code>&lt;div data-spacing=&quot;compact&quot;&gt;</code>{" "}
          and every <code>p-*</code>, <code>gap-*</code>, and component padding
          inside that subtree reads the compact steps while the rest of the page
          holds the base theme. The same arrangement, side by side — default
          spacing beside the compact subtree:
        </p>

        <div class="my-2">
          <Specimen
            title="Default spacing beside data-spacing=compact"
            description="computed padding tightens under compact; ink and type hold"
            code={DENSITY_SNIPPET}
            preview={
              <div class="grid min-w-0 gap-3 sm:grid-cols-2">
                <div class="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
                  <strong>Release pipeline</strong>
                  <div class="flex flex-wrap items-center gap-4">
                    <button type="button" class="primary">
                      Promote build
                    </button>
                    <button type="button">Compare diff</button>
                  </div>
                </div>
                <div
                  data-spacing="compact"
                  class="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
                >
                  <strong>Release pipeline</strong>
                  <div class="flex flex-wrap items-center gap-4">
                    <button type="button" class="primary">
                      Promote build
                    </button>
                    <button type="button">Compare diff</button>
                  </div>
                </div>
              </div>
            }
          />
        </div>

        <p class="max-w-prose">
          Hang the facet on <code>&lt;html&gt;</code> for page-wide density or
          on one panel for a dense table beside roomy prose. Declaring your own
          arrangements as named compositions lives in the{" "}
          <A href="/docs/styling/utilities#shortcuts">Utilities &amp; Shortcuts</A>{" "}
          guide.
        </p>
      </Section>


      <Section id="responsive" title="Responsive is the theme's breakpoints">
        <p class="max-w-prose">
          Prefix any utility with <code>sm:</code>, <code>md:</code>,{" "}
          <code>lg:</code>, or <code>xl:</code> to apply it at or above that
          viewport width, or write <code>max-md:</code> to apply it only below
          that edge. Each prefix reads its width from your theme&apos;s{" "}
          <code>breakpoint.*</code> tokens — when a project seats multiple
          themes, the first theme&apos;s breakpoint widths set the media queries
          for the stylesheet — and <code>max-w-screen-sm</code> through{" "}
          <code>max-w-screen-xl</code> cap a layout column to those same edges.
          Flip the width switch below (or resize your browser window) to watch
          the same workspace header and three-card grid reflow across{" "}
          <code>max-md:</code>, <code>sm:</code>, <code>md:</code>, and{" "}
          <code>lg:</code>:
        </p>

        <div class="my-2">
          <Specimen
            title="Reflowing across max-md:, sm:, md:, and lg:"
            code={RESPONSIVE_SPECIMEN_SNIPPET}
            controls={
              <>
                <button
                  type="button"
                  class={
                    previewWidth() === "compact"
                      ? "primary s-sm type-code"
                      : "s-sm type-code"
                  }
                  onClick={() => setPreviewWidth("compact")}
                >
                  max-md (&lt; {readGroupStep("breakpoint", "md", "48rem")})
                </button>
                <button
                  type="button"
                  class={
                    previewWidth() === "sm"
                      ? "primary s-sm type-code"
                      : "s-sm type-code"
                  }
                  onClick={() => setPreviewWidth("sm")}
                >
                  sm ({readGroupStep("breakpoint", "sm", "40rem")})
                </button>
                <button
                  type="button"
                  class={
                    previewWidth() === "md"
                      ? "primary s-sm type-code"
                      : "s-sm type-code"
                  }
                  onClick={() => setPreviewWidth("md")}
                >
                  md ({readGroupStep("breakpoint", "md", "48rem")})
                </button>
                <button
                  type="button"
                  class={
                    previewWidth() === "lg"
                      ? "primary s-sm type-code"
                      : "s-sm type-code"
                  }
                  onClick={() => setPreviewWidth("lg")}
                >
                  lg ({readGroupStep("breakpoint", "lg", "64rem")})
                </button>
              </>
            }
            preview={
              <div class="flex flex-col gap-3">
                <div
                  class={`mx-auto w-full rounded-lg border border-border bg-surface p-4 ${stageWidthClass()}`}
                >
                  <div
                    class={
                      previewWidth() === "compact" || previewWidth() === "sm"
                        ? "flex flex-col gap-2"
                        : "flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                    }
                  >
                    <div class="flex items-center gap-2">
                      <strong>Edge regions</strong>
                      <small>
                        Active edge:{" "}
                        <code>
                          {previewWidth() === "compact"
                            ? "max-md:"
                            : `${previewWidth()}:`}
                        </code>
                      </small>
                    </div>
                    <Show when={previewWidth() === "compact" || previewWidth() === "sm"}>
                      <badge variant="info" class="max-md:inline-flex">
                        Compact view (max-md:)
                      </badge>
                    </Show>
                    <Show when={previewWidth() === "md" || previewWidth() === "lg"}>
                      <badge variant="success">Multi-column row (md:)</badge>
                    </Show>
                  </div>
                  <div class={gridReflowClass()}>
                    <card>
                      <card-header>
                        <card-title>us-east</card-title>
                        <card-description>12 ms p95 · 4 replicas</card-description>
                      </card-header>
                    </card>
                    <card>
                      <card-header>
                        <card-title>eu-central</card-title>
                        <card-description>18 ms p95 · 3 replicas</card-description>
                      </card-header>
                    </card>
                    <card>
                      <card-header>
                        <card-title>ap-northeast</card-title>
                        <card-description>24 ms p95 · 3 replicas</card-description>
                      </card-header>
                    </card>
                  </div>
                </div>
              </div>
            }
          />
        </div>

        <p class="max-w-prose">
          Center and cap a page column explicitly with{" "}
          <code>mx-auto w-full max-w-screen-lg</code> (or a project composition)
          rather than a <code>container</code> class: <code>container</code> is
          omitted because a single automatic width rule hides which breakpoint
          edge the column stops at, and container-query variants (
          <code>@container</code>, <code>@md:</code>) are not yet part of the
          vocabulary and are tracked on the post-launch roadmap.
        </p>
      </Section>

      <Section id="positioning" title="Positioning, anchors, and the top layer">
        <p class="max-w-prose">
          Place a badge or floating control inside a <code>relative</code>{" "}
          parent with <code>absolute</code> or <code>fixed</code> and a
          spacing-scale offset (<code>top-1</code>, <code>right-1</code>,{" "}
          <code>top-2</code>, <code>inset-0</code>), and order overlapping
          surfaces with your theme&apos;s named <code>z-*</code> layers (
          <code>z-base</code>, <code>z-dropdown</code>, <code>z-modal</code>,{" "}
          <code>z-toast</code>) inside an <code>isolate</code> container instead
          of guessing magic numbers. When a menu or native{" "}
          <code>[popover]</code> renders in the top layer,{" "}
          <code>absolute top-full</code> measures against the viewport rather
          than the button that opened it — name the trigger with{" "}
          <code>anchor-&lt;name&gt;</code> and pin the panel to it with{" "}
          <code>position-anchor-&lt;name&gt;</code> and a{" "}
          <code>position-area-*</code> placement (
          <code>position-area-bottom-span-right</code>,{" "}
          <code>position-area-top</code>):
        </p>

        <div class="my-2">
          <Specimen
            title="Trigger-pinned panel in the top layer"
            code={ANCHORED_PANEL_SNIPPET}
            controls={
              <>
                <button
                  type="button"
                  class={
                    anchorArea() === "bottom"
                      ? "primary s-sm type-code"
                      : "s-sm type-code"
                  }
                  onClick={() => {
                    setAnchorArea("bottom");
                    setPanelOpen(true);
                  }}
                >
                  position-area-bottom-span-right
                </button>
                <button
                  type="button"
                  class={
                    anchorArea() === "top"
                      ? "primary s-sm type-code"
                      : "s-sm type-code"
                  }
                  onClick={() => {
                    setAnchorArea("top");
                    setPanelOpen(true);
                  }}
                >
                  position-area-top
                </button>
              </>
            }
            preview={
              <div class="isolate relative flex min-h-36 flex-col items-start justify-center gap-2 rounded-lg border border-border bg-surface p-4">
                <Show when={panelOpen() && anchorArea() === "top"}>
                  <div class="z-dropdown position-anchor-release-menu position-area-top flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3 shadow-lg">
                    <div class="flex items-center justify-between gap-3">
                      <strong>Pinned above trigger</strong>
                      <code>position-area-top</code>
                    </div>
                    <small>
                      <code>position-anchor-release-menu</code> on{" "}
                      <code>z-dropdown</code>
                    </small>
                  </div>
                </Show>
                <div class="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    class="relative anchor-release-menu"
                    onClick={() => setPanelOpen((open) => !open)}
                  >
                    <span>Release targets</span>
                    <span
                      class="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary text-on-primary"
                      aria-hidden="true"
                    />
                  </button>
                  <small>
                    Trigger carries <code>relative</code>,{" "}
                    <code>anchor-release-menu</code>, and an{" "}
                    <code>absolute top-1 right-1</code> indicator dot.
                  </small>
                </div>
                <Show when={panelOpen() && anchorArea() === "bottom"}>
                  <div class="z-dropdown position-anchor-release-menu position-area-bottom-span-right flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3 shadow-lg">
                    <div class="flex items-center justify-between gap-3">
                      <strong>Pinned below trigger</strong>
                      <code>position-area-bottom-span-right</code>
                    </div>
                    <small>
                      <code>position-anchor-release-menu</code> on{" "}
                      <code>z-dropdown</code>
                    </small>
                  </div>
                </Show>
              </div>
            }
          />
        </div>

        <p class="max-w-prose">
          Size any <code>i-*</code> glyph (<code>i-lucide-compass</code>,{" "}
          <code>i-lucide-layers</code>, <code>i-lucide-sparkles</code>) with{" "}
          <code>icon-sm</code>, <code>icon-md</code>, or <code>icon-lg</code> so
          its box reads your theme&apos;s <code>icon.*</code> scale and aligns
          inline on the text baseline:
        </p>

        <div class="my-2 grid min-w-0 gap-3 sm:grid-cols-3">
          <For each={ICON_STEPS}>
            {(item) => (
              <div class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-3 py-3">
                <div class="flex min-w-0 items-center gap-2">
                  <span
                    class={`${item.glyphClass} ${item.sizeClass} shrink-0 text-primary`}
                    aria-hidden="true"
                  />
                  <div class="flex min-w-0 flex-col">
                    <strong class="break-words">{item.label}</strong>
                    <small class="break-all">{readGroupStep("icon", item.step, "1em")}</small>
                  </div>
                </div>
                <div class="flex min-w-0 flex-col items-end gap-1">
                  <code class="break-all">{item.sizeClass}</code>
                  <code class="break-all">{item.glyphClass}</code>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="bare" title="The bare escape">
        <p class="max-w-prose">
          Add <code>bare</code> to a <code>&lt;button&gt;</code> (or{" "}
          <code>&lt;input class=&quot;bare&quot;&gt;</code>) when a custom
          trigger — a tab chip, a command-bar launcher, a disclosure header, or
          an inline tag editor — needs native button or input semantics and
          keyboard focus without wearing default button chrome. Adding{" "}
          <code>bare</code> strips the control&apos;s background fill, border
          width, corner radius, shadow, minimum height, and label weight while
          keeping <code>cursor: pointer</code> and focus-ring behavior intact.
          Because <code>bare</code> opts out of the element&apos;s default
          paint, any <code>bare</code> box that adds a fill (
          <code>bg-primary</code>, <code>bg-surface</code>) names its paired
          foreground ink (<code>text-on-primary</code>,{" "}
          <code>text-text-muted</code>) explicitly — reach for{" "}
          <code>bare</code> only when <code>.secondary</code> or{" "}
          <code>.ghost</code> still carries more chrome than the surface allows:
        </p>

        <div class="my-2">
          <Specimen
            title="Custom triggers with bare and explicit ink"
            code={BARE_ESCAPE_SNIPPET}
            preview={
              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-4">
                  <button type="button" class="ghost">
                    Ghost action
                  </button>
                  <button
                    type="button"
                    class="bare inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1 type-code text-text-muted"
                  >
                    <span>Command palette</span>
                    <kbd>⌘K</kbd>
                  </button>
                  <button
                    type="button"
                    class="bare inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 type-caption-strong text-on-primary"
                  >
                    <span>Live filter</span>
                  </button>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <code>.ghost</code>
                  <code>bare</code>
                  <code>bg-surface</code>
                  <code>text-text-muted</code>
                  <code>bg-primary</code>
                  <code>text-on-primary</code>
                </div>
              </div>
            }
          />
        </div>
      </Section>
    </main>
  );
}
