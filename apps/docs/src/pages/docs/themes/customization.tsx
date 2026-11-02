/**
 * Themes Customization: palette roles, web fonts, spatial scales, and per-element token overrides.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Chip, Code, Section } from "../../../bits.tsx";
import { PageHeader, PropList, type PropEntry } from "../../../ui/index.ts";
import { elementGroups, elementTokens } from "../../../theme-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const PALETTE_LAYERS: readonly PropEntry[] = [
  {
    name: "Surfaces",
    badge: "surface · surface-raised · surface-sunken · field · scrim",
    description:
      "The page background (surface), elevated cards and popovers (surface-raised), recessed wells and code blocks (surface-sunken), form inputs (field), and modal backdrops (scrim).",
  },
  {
    name: "Inks",
    badge: "text · text-muted · link · link-hover · link-visited",
    description:
      "Primary body copy (text, ≥ 4.5:1 on surface and surface-raised), secondary captions and metadata (text-muted, ≥ 3:1), and anchor states.",
  },
  {
    name: "Brand & Actions",
    badge: "primary · secondary · accent + on-*",
    description:
      "Interactive fills for primary CTAs, secondary controls, and accent highlights, each paired with its own foreground ink (on-primary, on-secondary, on-accent, ≥ 4.5:1) and hover/active states.",
  },
  {
    name: "Status & Borders",
    badge: "semantic.{success,warning,error,info} · border · focus-ring",
    description:
      "Semantic status fills, their paired on-* inks, hairline dividers (border), emphasized borders (border-strong), and keyboard focus outlines (focus-ring, ≥ 3:1 on surface).",
  },
];

const SCALE_ITEMS: readonly PropEntry[] = [
  {
    name: "spacing",
    badge: "0 · 1 .. 64",
    description:
      "Monotonically increasing spatial scale spent by p-*, m-*, and gap-*. Steps must strictly increase from spacing.1 upward.",
  },
  {
    name: "radius",
    badge: "none · sm · md · lg · full",
    description:
      "Corner rounding steps consumed by rounded-* utilities and element rules (cards, buttons, inputs, dialogs).",
  },
  {
    name: "border & focus",
    badge: "width · width-2 · width-4 · width-8",
    description:
      "Stroke widths for dividers and outlines, plus focus.width and focus.offset for keyboard focus rings.",
  },
  {
    name: "shadow",
    badge: "sm · md · lg",
    description:
      "Elevation shadows consumed by shadow-* utilities and floating surfaces (dropdowns, popovers, dialogs).",
  },
  {
    name: "motion",
    badge: "fast · base · slow · loop + easing.*",
    description:
      "Transition durations (fast ≤ base ≤ slow, with loop ≥ 250ms) and cubic-bezier easing curves (standard, decelerate, accelerate, linear).",
  },
];

const ACTIVE_SWATCHES: readonly {
  readonly label: string;
  readonly bg: string;
}[] = [
  { label: "surface", bg: "bg-surface" },
  { label: "surface-raised", bg: "bg-surface-raised" },
  { label: "surface-sunken", bg: "bg-surface-sunken" },
  { label: "primary", bg: "bg-primary" },
  { label: "secondary", bg: "bg-secondary" },
  { label: "accent", bg: "bg-accent" },
  { label: "success", bg: "bg-semantic-success" },
  { label: "warning", bg: "bg-semantic-warning" },
  { label: "error", bg: "bg-semantic-error" },
  { label: "info", bg: "bg-semantic-info" },
];

export default function ThemesCustomization(): JSX.Element {
  const groups = elementGroups();

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Customization"
        lede="Customize your theme's color roles, load web fonts from Fontsource, tune spacing and corner radii, or override individual HTML elements without forks or custom CSS files."
      />

      <Section id="palette" title="Palette and semantic roles">
        <p class="max-w-prose">
          Instead of scattering raw color scales (<code>blue-500</code>,{" "}
          <code>gray-200</code>) across components, Spin components and
          classless elements read semantic color roles. You can define raw hex
          ramps under{" "}
          <code>color.neutral.*</code> or <code>color.brand.*</code> and point
          your semantic roles at them using <code>{"{color.neutral.50}"}</code>{" "}
          aliases:
        </p>

        <div class="my-4 grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-raised p-3 sm:grid-cols-5">
          <For each={ACTIVE_SWATCHES}>
            {(item) => (
              <div class="flex items-center gap-2 rounded-sm border border-border bg-surface p-2">
                <span
                  class={`h-5 w-5 shrink-0 rounded-sm border border-border ${item.bg}`}
                />
                <span class="truncate font-mono text-xs text-text">
                  {item.label}
                </span>
              </div>
            )}
          </For>
        </div>

        <PropList items={PALETTE_LAYERS} />
      </Section>

      <Section id="typography" title="Typography and web fonts">
        <p class="max-w-prose">
          The <code>font</code> group controls font families (
          <code>sans</code>, <code>heading</code>, <code>mono</code>, plus
          optional <code>body</code>, <code>serif</code>, and{" "}
          <code>brand</code>), the monotonic type size scale (
          <code>2xs</code> through <code>display</code>), weights, line heights,
          and letter-spacing.
        </p>
        <p class="max-w-prose">
          In the Studio's <strong>Type</strong> view, picking a family from the
          built-in Fontsource catalog writes its declaration into{" "}
          <code>$extensions.spin.fonts</code>. At build time, Spin bundles the
          font files and emits the corresponding <code>@font-face</code> rules
          automatically:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.webFonts}
            lang="json"
            title="Web fonts via $extensions.spin.fonts"
          />
        </div>
      </Section>

      <Section id="scales" title="Spatial scales, shape, and motion">
        <p class="max-w-prose">
          Every spacing utility (<code>p-4</code>, <code>gap-6</code>), radius
          utility (<code>rounded-md</code>), shadow (<code>shadow-lg</code>),
          and transition (<code>duration-fast ease-standard</code>) reads its
          value from your theme's scales. Adjusting{" "}
          <code>radius.md</code> from <code>6px</code> to <code>0px</code>{" "}
          sharpens every card, input, and button across the app in one edit.
        </p>
        <PropList items={SCALE_ITEMS} />
      </Section>

      <Section id="elements" title="Per-element overrides">
        <p class="max-w-prose">
          By default, classless elements derive their appearance from the
          global token groups (<code>button</code> uses <code>radius.md</code>,{" "}
          <code>font.weight.medium</code>, and <code>color.border</code>). When
          you want to give a specific element its own
          character — such as uppercase tracked buttons, pill badges, or deeper
          card shadows — without altering the global scales, declare optional
          per-element tokens:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.elementOverride}
            lang="json"
            title="Per-element token overrides"
          />
        </div>
        <p class="max-w-prose text-sm text-text-muted">
           Spin supports per-element overrides on {groups.length} element
          groups (see the full list in{" "}
          <A href="/docs/themes/reference#element-tokens">
            Token Reference — Per-element tokens
          </A>
          ):
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <For each={groups}>
            {(group) => (
              <Chip>
                {group}.* ({elementTokens(group).length})
              </Chip>
            )}
          </For>
        </div>
      </Section>
    </main>
  );
}
