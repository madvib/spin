/**
 * Utilities & Layout: closed-scale utility classes, editor/linter tooling,
 * paired semantic fills & inks, layout shortcuts, and spacing scale.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { spinShortcuts } from "@spinjs/spin/preset";
import { Markdown } from "../../../markdown.tsx";
import {
  Chip,
  PageHeader,
  PropList,
  Section,
  starterDoc,
  type PropEntry,
} from "../../../ui/index.ts";
import cssMd from "../../../content/css-edges.md?raw";

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
    ink: "text-text",
    classes: "border border-border bg-surface-raised text-text",
  },
];

export default function StylingUtilities(): JSX.Element {
  const shortcutItems = (): readonly PropEntry[] =>
    Object.entries(spinShortcuts as Record<string, string>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, expansion]) => ({
        name,
        badge: "shortcut",
        description: (
          <>
            Expands to <code>{expansion}</code>
          </>
        ),
      }));

  const spacing = (): readonly string[] =>
    Object.keys(
      (starterDoc().spacing ?? {}) as Readonly<Record<string, unknown>>,
    )
      .filter((step) => !step.startsWith("$"))
      .sort((a, b) => {
        const left = Number(a);
        const right = Number(b);
        return Number.isFinite(left) && Number.isFinite(right)
          ? left - right
          : a.localeCompare(b);
      });

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Utilities & Layout"
        lede="Token-backed utility classes, paired fills and inks, layout shortcuts, and how Spin's editor tooling catches unknown classes before you leave your editor."
      />
      <Markdown text={cssMd} />

      <Section id="paired-fills" title="Paired fills & inks, live">
        <p class="max-w-prose">
          Each pill below uses its exact fill and paired foreground ink utility
          from the active theme. Toggle light and dark mode in the top bar —
          every pair maintains its WCAG contrast floor without a{" "}
          <code>dark:</code> class:
        </p>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <For each={PAIRED_ROLES}>
            {(item) => (
              <div
                class={`flex flex-col gap-1 rounded-md p-3 ${item.classes}`}
              >
                <span class="font-mono text-xs font-semibold">
                  {item.label}
                </span>
                <span class="font-mono text-xs opacity-90">
                  {item.fill} + {item.ink}
                </span>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="shortcuts" title="Shipped shortcuts, live">
        <p class="max-w-prose">
          Every entry in <code>spinShortcuts</code>, read directly from{" "}
          <code>@spinjs/spin/preset</code>:
        </p>
        <PropList items={shortcutItems()} />
      </Section>

      <Section id="spacing" title="Active theme spacing scale">
        <p class="max-w-prose">
          The active theme's declared <code>spacing.*</code> steps, read
          directly from its document. Every step generates <code>p-*</code>,{" "}
          <code>px-*</code>, <code>py-*</code>, <code>m-*</code>,{" "}
          <code>gap-*</code>, <code>w-*</code>, <code>h-*</code>, and{" "}
          <code>inset-*</code> utilities; any step not listed here is flagged by{" "}
          <code>spin/closed-vocabulary</code>.
        </p>
        <div class="flex flex-wrap gap-2">
          <For each={spacing()}>{(step) => <Chip>{step}</Chip>}</For>
        </div>
        <p class="max-w-prose">
          See <A href="/docs/styling/animation">Animations &amp; Motion</A> for
          transition and keyframe utilities, or browse every utility class in the{" "}
          <A href="/docs/styling/catalog">Utility Catalog</A>.
        </p>
      </Section>
    </main>
  );
}
