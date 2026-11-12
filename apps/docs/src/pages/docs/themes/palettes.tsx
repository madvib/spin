/**
 * Colors (Brand & Studio): how a Spin brand organizes surfaces, brand fills,
 * status tones, and contrast-checked foreground text across light and dark modes.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import {
  PageHeader,
  PropList,
  Section,
  type PropEntry,
} from "../../../ui/index.ts";

const COLOR_FAMILIES: readonly PropEntry[] = [
  {
    name: "Page & Card Surfaces",
    badge: "backgrounds",
    description:
      "Quiet neutral layers for the page canvas, elevated cards and popovers, recessed wells, and form fields. Body copy and muted captions sit directly on these surfaces.",
  },
  {
    name: "Brand Actions",
    badge: "primary · secondary · accent",
    description:
      "Your main call-to-action color, quiet secondary control fill, and accent highlight — each paired with a dedicated foreground text color so buttons and active pills stay sharp.",
  },
  {
    name: "Semantic Status",
    badge: "success · warning · error · info",
    description:
      "Dedicated fills and matching foreground text for alerts, validation feedback, and status badges so status meaning never collides with your primary brand color.",
  },
  {
    name: "Borders & Focus Ring",
    badge: "dividers & keyboard",
    description:
      "Subtle hairlines for layout dividers, stronger edges for interactive controls, and a high-visibility keyboard focus ring.",
  },
];

const LIVE_PAIRS: readonly {
  readonly title: string;
  readonly subtitle: string;
  readonly classes: string;
}[] = [
  {
    title: "Primary action",
    subtitle: "Main CTAs & active states",
    classes: "bg-primary text-on-primary",
  },
  {
    title: "Secondary control",
    subtitle: "Quiet actions & toolbars",
    classes: "border bg-secondary text-on-secondary",
  },
  {
    title: "Accent highlight",
    subtitle: "Badges & callouts",
    classes: "bg-accent text-on-accent",
  },
  {
    title: "Raised surface",
    subtitle: "Cards, dialogs & popovers",
    classes: "border bg-surface-raised text-muted",
  },
  {
    title: "Success",
    subtitle: "Healthy & completed",
    classes: "bg-semantic-success text-on-semantic-success",
  },
  {
    title: "Warning",
    subtitle: "Needs attention",
    classes: "bg-semantic-warning text-on-semantic-warning",
  },
  {
    title: "Error",
    subtitle: "Failed or destructive",
    classes: "bg-semantic-error text-on-semantic-error",
  },
  {
    title: "Info",
    subtitle: "Neutral guidance",
    classes: "bg-semantic-info text-on-semantic-info",
  },
];

export default function ThemesPalettes(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Colors"
        lede="How your brand organizes surfaces, actions, and status colors so every screen stays legible in light and dark mode."
      />

      <Section id="groups" title="Four groups, clear jobs">
        <p class="max-w-prose">
          Instead of asking developers to pick between dozens of raw numbered
          swatches on every screen, a Spin brand organizes color by what each
          surface or control actually does:
        </p>
        <PropList items={COLOR_FAMILIES} />
      </Section>

      <Section id="paired" title="Backgrounds and text stay readable together">
        <p class="max-w-prose">
          Hardcoding white text onto a brand button breaks the moment a lighter
          accent or dark mode flips the fill. In Spin, every colored fill has a
          matching foreground text role that travels with it. Switch design
          languages, palettes, or light/dark mode in the top bar to watch the
          live swatches below adapt together:
        </p>
        <div class="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <For each={LIVE_PAIRS}>
            {(item) => (
              <div
                class={`flex flex-col justify-between gap-2 rounded-md p-4 ${item.classes}`}
              >
                <span class="type-body-emphasized">{item.title}</span>
                <span class="type-caption opacity-90">{item.subtitle}</span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="studio-colors" title="Shaping your palette in Studio">
        <p class="max-w-prose">
          In <A href="/studio">Theme Studio</A>, you can seed a complete light
          and dark palette from a single primary color or tune individual roles
          side by side. Every background-and-text pair displays its live WCAG
          contrast ratio as you drag — if an edit drops below minimum
          readability, Studio offers a one-click <strong>Fix</strong> button
          that nudges the tone back into range.
        </p>
        <p class="max-w-prose text-muted">
          To apply surface, text, border, and opacity classes in your markup,
          see <A href="/docs/styling/color">Surfaces &amp; Opacity</A>. For
          contrast thresholds, see{" "}
          <A href="/docs/themes/validation">Contrast Checks</A>.
        </p>
      </Section>
    </main>
  );
}
