/**
 * Utilities & Layout: closed-scale utility classes, editor/linter tooling,
 * paired semantic fills & inks, project compositions, and spacing scale.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Markdown } from "../../../markdown/markdown.tsx";
import {
  Chip,
  Code,
  PageHeader,
  PropList,
  Section,
  Specimen,
  languageDoc,
  type PropEntry,
} from "../../../ui/index.ts";
import cssMd from "../../../content/css-edges.md?raw";

const COMPOSITION_BEFORE_SNIPPET = `<div class="flex flex-col gap-4 rounded-lg border bg-surface p-4">
  <div class="flex items-center justify-between gap-4">
    <strong>Release pipeline</strong>
    <badge variant="success">Ready</badge>
  </div>
  <div class="flex items-center gap-4">
    <button type="button" class="primary">Promote build</button>
    <button type="button">Compare diff</button>
  </div>
</div>`;

const COMPOSITION_AFTER_SNIPPET = `<div class="stack rounded-lg border bg-surface p-4">
  <div class="split">
    <strong>Release pipeline</strong>
    <badge variant="success">Ready</badge>
  </div>
  <div class="row">
    <button type="button" class="primary">Promote build</button>
    <button type="button">Compare diff</button>
  </div>
</div>`;

const SHORTCUTS_CONFIG_SNIPPET = `import { spin } from "@spinjs/dev/vite";

export default {
  plugins: [
    spin.vite({
      shortcuts: {
        stack: "flex flex-col gap-4",
        row: "flex items-center gap-4",
        split: "flex items-center justify-between gap-4",
      },
    }),
  ],
};`;

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


export default function StylingUtilities(): JSX.Element {

  const spacing = (): readonly string[] =>
    Object.keys(
      (languageDoc().spacing ?? {}) as Readonly<Record<string, unknown>>,
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
        title="Shortcuts"
        lede="Declare the layout compositions your project repeats in spin.vite({ shortcuts }), verify every expanded utility against your brand, and let spin lint spot repeated utility strings for you."
      />
      <Markdown text={cssMd} />

      <Section id="shortcuts" title="Project shortcuts, live">
        <p class="max-w-prose">
          Compose flex and grid utilities directly (<code>flex</code>,{" "}
          <code>flex-col</code>, <code>items-center</code>,{" "}
          <code>justify-between</code>, <code>gap-4</code>) while a layout is
          taking shape, then name the arrangements your project repeats. Because
          the preset ships no built-in layout shortcuts, every composition word
          in your markup (<code>stack</code>, <code>row</code>,{" "}
          <code>split</code>) is one your project chose:
        </p>

        <div class="my-2 flex flex-col gap-4">
          <Specimen
            title="Before — raw utilities on every container"
            code={COMPOSITION_BEFORE_SNIPPET}
            preview={
              <div class="flex flex-col gap-4 rounded-lg border bg-surface p-4">
                <div class="flex items-center justify-between gap-4">
                  <strong>Release pipeline</strong>
                  <badge variant="success">Ready</badge>
                </div>
                <div class="flex flex-wrap items-center gap-4">
                  <button type="button" class="primary">
                    Promote build
                  </button>
                  <button type="button">Compare diff</button>
                </div>
              </div>
            }
          />

          <Specimen
            title="After — named compositions (stack, split, row)"
            code={COMPOSITION_AFTER_SNIPPET}
            preview={
              <div class="stack rounded-lg border bg-surface p-4">
                <div class="split">
                  <strong>Release pipeline</strong>
                  <badge variant="success">Ready</badge>
                </div>
                <div class="row flex-wrap">
                  <button type="button" class="primary">
                    Promote build
                  </button>
                  <button type="button">Compare diff</button>
                </div>
              </div>
            }
          />
        </div>

        <p class="max-w-prose">
          Promote a utility list to a named composition the third time you write
          the same arrangement across your templates, and declare it under{" "}
          <code>spin.vite({"{"} shortcuts {"}"})</code> in your bundler config
          (see the full plugin setup on{" "}
          <A href="/docs/getting-started/install#config">Install &amp; Bundlers</A>
          ). Every composition still spends your theme&apos;s spacing scale —{" "}
          <code>gap-4</code> inside <code>stack</code>, <code>row</code>, and{" "}
          <code>split</code> rescales whenever the theme changes — and the build
          verifies both the composition name and the utilities it expands to:
        </p>

        <div class="my-2">
          <Code
            code={SHORTCUTS_CONFIG_SNIPPET}
            lang="ts"
            title="vite.config.ts"
          />
        </div>

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
