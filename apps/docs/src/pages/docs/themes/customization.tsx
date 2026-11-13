/**
 * Themes Customization: token-to-utility mapping, palette roles, spatial scales, and per-element overrides.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Chip, Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";
import { elementGroups, elementTokens } from "../../../markdown/theme-docs.ts";
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

const BRAND_LAYER_ITEMS: readonly PropEntry[] = [
  {
    name: "spin/<brand>/tokens.json",
    badge: "Brand core",
    description:
      "Every token override the brand states: \"$extends\" (the starting design language), font faces ($extensions.spin.fonts), the 13 named font.style.* tuples, semantic color roles with $modes.dark, element type assignments (element.h1.type), per-primitive slots (button.radius, card.title.type), and brand shape/motion.",
  },
  {
    name: "spin/reference.json",
    badge: "Reference scales",
    description:
      "Optional global layer for raw color ramps (color.neutral.50–900) and spatial or typographic scale steps that semantic tokens alias via {path}. Composes under every brand.",
  },
  {
    name: "spin/<brand>/themes/*.palette.json",
    badge: "Palette facets",
    description:
      "Optional runtime palette swaps served under data-palette, shape-checked on load.",
  },
  {
    name: "spin/<brand>/themes/*.spacing.json",
    badge: "Spacing facets",
    description:
      "Optional runtime spacing swaps served under data-spacing, shape-checked on load.",
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


export default function ThemesCustomization(): JSX.Element {
  const groups = elementGroups();

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Theme Files"
        lede="Edit your spin/<brand>/ JSON files directly in code and customize individual elements when needed."
      />

      <Section id="layers" title="Files inside spin/<brand>/">
        <p class="max-w-prose">
          A brand directory starts with a single <code>tokens.json</code> file
          and grows into focused layer files only when you override specific
          scales, HTML element type assignments, or individual primitives:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.brandLayers}
            lang="bash"
            title="Brand directory layout"
          />
        </div>
        <PropList items={BRAND_LAYER_ITEMS} />
      </Section>
      <Section id="mapping" title="How tokens become CSS variables and utilities">
        <p class="max-w-prose">
          A token path is a contract: the segments join with{" "}
          <code>-</code> to form the CSS custom property name, and the
          utilities spend that variable. Learn one row of this cheat sheet and
          the rest of the theme reads the same way:
        </p>
        <PropList items={MAPPING_ITEMS} />
      </Section>

      <Section id="palette" title="Palette roles & paired inks">
        <p class="max-w-prose">
          Color roles (<code>color.surface</code>, <code>color.primary</code>),
          their paired foreground inks (<code>color.on-primary</code>,{" "}
          <code>color.on-semantic-success</code>), neutral ramps (
          <code>color.neutral.50</code>–<code>900</code>), and WCAG contrast
          floors live in the dedicated{" "}
          <A href="/docs/themes/palettes">Colors</A> guide.
        </p>
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
          <A href="/docs/themes/fonts">Typography</A> guide.
        </p>
        <PropList items={SCALE_ITEMS} />
      </Section>

      <Section id="elements" title="Per-element overrides">
        <p class="max-w-prose">
          By default, elements derive their appearance from the global token
          groups (<code>button</code> uses <code>radius.md</code> and{" "}
          <code>color.border</code>), and each element reads its style from
          its <code>.type</code> token — <code>element.h1.type</code> reads{" "}
          <code>display</code>, <code>button.type</code> reads{" "}
          <code>label</code>. When you want to give a specific element its
          own character — such as pill badges or deeper card shadows —
          without altering the global scales, declare optional per-element
          tokens; when you want an element to use another style,
          re-point its <code>.type</code> alias instead:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.elementOverride}
            lang="json"
            title="Per-element token overrides"
          />
        </div>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.typeAlias}
            lang="json"
            title="Type aliases in spin/<brand>/tokens.json"
          />
        </div>
        <p class="max-w-prose text-muted">
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
