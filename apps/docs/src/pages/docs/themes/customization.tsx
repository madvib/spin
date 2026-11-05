/**
 * Themes Customization: token-to-utility mapping, palette roles, spatial scales, and per-element overrides.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Chip, Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import { elementGroups, elementTokens } from "../../../theme-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const MAPPING_ITEMS: readonly PropEntry[] = [
  {
    name: "color.primary → --color-primary",
    badge: "bg-primary / text-primary / border-primary",
    description:
      "Every color role becomes a CSS variable and a set of utilities: backgrounds, inks, borders, and outlines all spend the same token.",
  },
  {
    name: "spacing.4 → --spacing-4",
    badge: "p-4 / m-4 / gap-4",
    description:
      "Every spatial step becomes a variable spent by padding, margin, and gap utilities — one scale, three axes.",
  },
  {
    name: "radius.md → --radius-md",
    badge: "rounded-md",
    description:
      "Every corner step becomes a variable spent by rounded-* utilities and by element rules (cards, buttons, inputs).",
  },
  {
    name: "shadow.md → --shadow-md",
    badge: "shadow-md",
    description:
      "Every elevation step becomes a variable spent by shadow-* utilities and floating surfaces (dropdowns, popovers, dialogs).",
  },
];

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
        lede="Customize your theme's color roles, tune spacing and corner radii, or override individual HTML elements — every token becomes a CSS variable and a utility class, with no forks or custom CSS files."
      />

      <Section id="mapping" title="How tokens become CSS variables and utilities">
        <p class="max-w-prose">
          A token path is a contract: the segments join with{" "}
          <code>-</code> to form the CSS custom property name, and the
          utilities spend that variable. Learn one row of this cheat sheet and
          the rest of the theme reads the same way:
        </p>
        <PropList items={MAPPING_ITEMS} />
      </Section>

      <Section id="palette" title="Palette and semantic roles">
        <p class="max-w-prose">
          Instead of scattering raw color scales (<code>blue-500</code>,{" "}
          <code>gray-200</code>) across components, Spin components and
          elements read semantic color roles. You can define raw hex
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
                <span class="truncate type-code type-caption">
                  {item.label}
                </span>
              </div>
            )}
          </For>
        </div>

        <PropList items={PALETTE_LAYERS} />
      </Section>

      <Section id="scales" title="Spatial scales, shape, and motion">
        <p class="max-w-prose">
          Every spacing utility (<code>p-4</code>, <code>gap-6</code>), radius
          utility (<code>rounded-md</code>), shadow (<code>shadow-lg</code>),
          and transition (<code>duration-fast ease-standard</code>) reads its
          value from your theme's scales. Adjusting{" "}
          <code>radius.md</code> from <code>6px</code> to <code>0px</code>{" "}
          sharpens every card, input, and button across the app in one edit.
          Typography — families, the <code>2xs</code>–<code>display</code>{" "}
          scale, weights, and tracking — lives on the dedicated{" "}
          <A href="/docs/themes/fonts">Fonts</A> guide.
        </p>
        <PropList items={SCALE_ITEMS} />
      </Section>

      <Section id="elements" title="Per-element overrides">
        <p class="max-w-prose">
          By default, elements derive their appearance from the
          global token groups (<code>button</code> uses <code>radius.md</code>,{" "}
          the <code>label</code> named style, and <code>color.border</code>).
          When you want to give a specific element its own
          character — such as semibold tracked buttons, pill badges, or deeper
          card shadows — without altering the global scales, declare optional
          per-element tokens (or tune the named style the element reads):
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.elementOverride}
            lang="json"
            title="Per-element token overrides"
          />
        </div>
        <p class="max-w-prose  text-text-muted">
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
