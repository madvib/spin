/**
 * Palettes & Paired Inks: semantic color roles, paired foreground inks,
 * neutral ramps, and enforced WCAG contrast floors across light and dark modes.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import {
  Code,
  PageHeader,
  PropList,
  Section,
  type PropEntry,
} from "../../../ui/index.ts";
import { FLOORS } from "../../../markdown/theme-docs.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const PALETTE_LAYERS: readonly PropEntry[] = [
  {
    name: "Surfaces (inherit body ink)",
    badge: "surface · surface-raised · surface-sunken · field · scrim",
    description:
      "The page background (surface), elevated cards and popovers (surface-raised), recessed wells and code blocks (surface-sunken), form inputs (field), and modal backdrops (scrim). Surfaces wear default body copy (color.text, ≥ 4.5:1) and secondary metadata (color.text-muted, ≥ 3:1).",
  },
  {
    name: "Body & Link Inks",
    badge: "text · text-muted · link · link-hover · link-visited",
    description:
      "Primary body copy (text), secondary captions and metadata (text-muted), and anchor states verified against surface and surface-raised in every declared mode.",
  },
  {
    name: "Brand & Action Fills (require paired on-* ink)",
    badge: "primary · secondary · accent + on-*",
    description:
      "Interactive fills for primary CTAs, secondary controls, and accent highlights. Each fill owns a dedicated foreground ink (on-primary, on-secondary, on-accent, ≥ 4.5:1) plus hover and active states.",
  },
  {
    name: "Semantic Status & Selection Fills (require paired on-* ink)",
    badge: "semantic.{success,warning,error,info} · selected · disabled + on-*",
    description:
      "Status banners, badges, selected rows, and disabled controls, each paired with its own foreground ink (on-semantic-*, on-selected, on-disabled) plus hairline dividers (border, border-strong) and keyboard focus outlines (focus-ring, ≥ 3:1).",
  },
];

const PAIRED_ROLES: readonly {
  readonly label: string;
  readonly fill: string;
  readonly ink: string;
  readonly classes: string;
}[] = [
  {
    label: "primary",
    fill: "bg-primary",
    ink: "text-on-primary",
    classes: "bg-primary text-on-primary",
  },
  {
    label: "secondary",
    fill: "bg-secondary",
    ink: "text-on-secondary",
    classes: "bg-secondary text-on-secondary",
  },
  {
    label: "accent",
    fill: "bg-accent",
    ink: "text-on-accent",
    classes: "bg-accent text-on-accent",
  },
  {
    label: "semantic-success",
    fill: "bg-semantic-success",
    ink: "text-on-semantic-success",
    classes: "bg-semantic-success text-on-semantic-success",
  },
  {
    label: "semantic-warning",
    fill: "bg-semantic-warning",
    ink: "text-on-semantic-warning",
    classes: "bg-semantic-warning text-on-semantic-warning",
  },
  {
    label: "semantic-error",
    fill: "bg-semantic-error",
    ink: "text-on-semantic-error",
    classes: "bg-semantic-error text-on-semantic-error",
  },
  {
    label: "semantic-info",
    fill: "bg-semantic-info",
    ink: "text-on-semantic-info",
    classes: "bg-semantic-info text-on-semantic-info",
  },
  {
    label: "surface-raised",
    fill: "bg-surface-raised",
    ink: "text-muted",
    classes: "border bg-surface-raised text-muted",
  },
];

const FLOOR_ITEMS: readonly PropEntry[] = FLOORS.map((f) => ({
  name: `${f.fg} on ${f.bg}`,
  badge: `≥ ${f.min}:1`,
  description: `Verified across every mode declared by the brand before the stylesheet builds.`,
}));

export default function ThemesPalettes(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Color & Contrast"
        lede="Name colors by their job — primary, surface, ink — and let paired foregrounds keep every fill legible in light and dark."
      />

      <Section id="paired-inks" title="Why fills and inks travel in pairs">
        <p class="max-w-prose">
          In a raw utility sheet, a callsite paints{" "}
          <code>bg-blue-600 text-white</code> and hopes the contrast holds when
          the brand palette changes or dark mode activates. In Spin, paired
          inks are part of the theme contract in{" "}
          <code>spin/&lt;brand&gt;/tokens.json</code>: every painted role (
          <code>color.primary</code>, <code>color.secondary</code>,{" "}
          <code>color.accent</code>, <code>color.semantic.*</code>,{" "}
          <code>color.selected</code>, <code>color.disabled</code>) declares its
          own foreground partner (<code>color.on-primary</code>,{" "}
          <code>color.on-secondary</code>, and so on).
        </p>
        <p class="max-w-prose">
          Toggle light and dark mode in the top bar — each pill below spends its
          fill and paired ink utility with zero <code>dark:</code> classes, and{" "}
          <code>spin/no-unpaired-ink</code> flags any template that pairs a
          fill with the wrong ink:
        </p>
        <div class="my-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <For each={PAIRED_ROLES}>
            {(item) => (
              <div
                class={`flex flex-col gap-1 rounded-md p-3 ${item.classes}`}
              >
                <span class="type-caption-emphasized">{item.label}</span>
                <span class="type-code opacity-90">
                  {item.fill} + {item.ink}
                </span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="roles" title="Surfaces vs. painted fills">
        <p class="max-w-prose">
          Spin divides color roles into two families so body copy stays quiet
          while interactive controls stay legible:
        </p>
        <PropList items={PALETTE_LAYERS} />
      </Section>

      <Section id="ramps" title="Neutral ramps and role aliases">
        <p class="max-w-prose">
          Instead of scattering raw scale steps (<code>neutral-100</code>,{" "}
          <code>neutral-800</code>) across templates, define your neutral ramp
          under <code>color.neutral.50</code>–<code>900</code> in{" "}
          <code>tokens.json</code> (or <code>reference.json</code>) and point
          your semantic surface, text, and border roles at the ramp with{" "}
          <code>{"{color.neutral.*}"}</code> aliases. When{" "}
          <code>color.neutral.50</code> declares a <code>$modes.dark</code>{" "}
          value, <code>color.surface</code> automatically resolves to the dark
          step in dark mode:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.modeToken}
            lang="json"
            title="spin/acme/tokens.json"
          />
        </div>
      </Section>

      <Section id="contrast-floors" title="Enforced WCAG contrast floors">
        <p class="max-w-prose">
          Both the <A href="/studio">Studio</A> Color workbench and{" "}
          <code>npx spin lint</code> check every fill-and-ink pair against its
          WCAG contrast floor across every mode the brand declares. In Studio,
          any pair that drops below its floor displays a one-click{" "}
          <strong>Fix</strong> button that nudges lightness to the nearest
          passing value:
        </p>
        <PropList items={FLOOR_ITEMS} />
      </Section>
    </main>
  );
}
