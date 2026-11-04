/**
 * Utilities & Layout: closed-scale utility classes, editor/linter tooling,
 * paired semantic fills & inks, project compositions, and spacing scale.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
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

/**
 * The compositions the docs declare in `vite.config.ts` — the worked
 * example the install page shows, kept beside the pages that use it.
 */
const PROJECT_COMPOSITIONS: readonly PropEntry[] = [
  {
    name: "stack / stack-xs / stack-sm / stack-lg",
    badge: "project shortcut",
    description: (
      <>
        Vertical flex column (<code>flex flex-col</code>) with{" "}
        <code>gap-4</code> (<code>stack</code>), <code>gap-1</code> (
        <code>stack-xs</code>), <code>gap-2</code> (<code>stack-sm</code>),
        or <code>gap-8</code> (<code>stack-lg</code>).
      </>
    ),
  },
  {
    name: "row / row-sm / split",
    badge: "project shortcut",
    description: (
      <>
        Centered horizontal flex row (<code>flex items-center</code>) with{" "}
        <code>gap-4</code> (<code>row</code>) or <code>gap-2</code> (
        <code>row-sm</code>); <code>split</code> adds{" "}
        <code>justify-between</code>.
      </>
    ),
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
    ink: "text-text-muted",
    classes: "border border-border bg-surface-raised text-text-muted",
  },
];

export default function StylingUtilities(): JSX.Element {

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
        lede="Token-backed utility classes, paired fills and inks, project compositions, and how Spin's editor tooling catches unknown classes before you leave your editor."
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

      <Section id="shortcuts" title="Project shortcuts, live">
        <p class="max-w-prose">
          Spin ships no shortcuts of its own. The compositions below are the
          ones this docs site declares in its own <code>vite.config.ts</code>{" "}
          via <code>spin.vite({"{"} shortcuts {"}"})</code> — the worked
          example on <A href="/docs/getting-started/install#config">Install</A>.
          Your project declares its own the same way, and{" "}
          <code>spin/closed-vocabulary</code> flags any other composition
          name as unknown.
        </p>
        <PropList items={PROJECT_COMPOSITIONS} />
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
