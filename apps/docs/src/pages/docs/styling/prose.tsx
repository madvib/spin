/**
 * Typography & Lists: element-owned typography (`h1`–`h6`, `p`, `code`,
 * `blockquote`, `<prose>`) and list primitives (`ul`/`ol` reset, `row-list`,
 * `flow-list`).
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import {
  Chip,
  Code,
  PageHeader,
  PropList,
  Section,
  starterDoc,
  type PropEntry,
} from "../../../ui/index.ts";

const TYPOGRAPHY_ELEMENTS: readonly PropEntry[] = [
  {
    name: "<h1> – <h6>",
    badge: "headings",
    description: (
      <>
        Spend <code>font.family.heading</code>, the monotonic{" "}
        <code>font.size.*</code> ramp (<code>2xl</code> down to{" "}
        <code>sm</code>), <code>font.weight.bold</code> /{" "}
        <code>semibold</code>, and <code>font.leading.tight</code>. Never
        add <code>font-bold</code> or <code>text-*</code> to a heading —{" "}
        <code>spin/no-redundant-class</code> and{" "}
        <code>spin/prefer-theme-value</code> flag overrides.
      </>
    ),
  },
  {
    name: "<p>, <small>, <strong>",
    badge: "body copy",
    description: (
      <>
        Spend <code>font.family.sans</code> (or <code>font.family.body</code>),{" "}
        <code>font.size.md</code> (<code>font.size.xs</code> on{" "}
        <code>&lt;small&gt;</code>), and <code>color.text</code>. Write copy in{" "}
        <code>&lt;p&gt;</code> and <code>&lt;small&gt;</code> rather than{" "}
        <code>&lt;div class="text-sm"&gt;</code>.
      </>
    ),
  },
  {
    name: "<code>, <pre>, <kbd>",
    badge: "monospace",
    description: (
      <>
        Spend <code>font.family.mono</code>, <code>color.surface-raised</code>,
        and <code>color.border</code>. Inline <code>&lt;code&gt;</code> and{" "}
        <code>&lt;kbd&gt;</code> carry their own pill chrome;{" "}
        <code>&lt;pre&gt;</code> resets nested <code>&lt;code&gt;</code> chrome
        automatically.
      </>
    ),
  },
  {
    name: "<blockquote>, <a>, <hr>",
    badge: "editorial",
    description: (
      <>
        <code>&lt;blockquote&gt;</code> renders an accent inline-start border
        and muted ink; <code>&lt;a&gt;</code> spends <code>color.link</code>{" "}
        and <code>color.link-hover</code>; <code>&lt;hr&gt;</code> renders a{" "}
        <code>border.width</code> rule (with <code>.divider-dashed</code> and{" "}
        <code>.divider-vertical</code> modifiers).
      </>
    ),
  },
  {
    name: "<prose> / .prose",
    badge: "document container",
    description: (
      <>
        Sets a readable measure (<code>max-width: 65ch</code>), vertical rhythm
        between headings, paragraphs, code blocks, and tables, and restores{" "}
        <code>disc</code> / <code>decimal</code> markers on nested{" "}
        <code>&lt;ul&gt;</code> and <code>&lt;ol&gt;</code> lists.
      </>
    ),
  },
];

const LIST_PATTERNS: readonly PropEntry[] = [
  {
    name: "Bare <ul> / <ol>",
    badge: "reset layer",
    description: (
      <>
        Reset to <code>margin: 0; padding: 0; list-style: none</code> in the
        base stylesheet so navigation rails, menus, comboboxes, and tab bars
        never have to strip browser bullets or indentation.
      </>
    ),
  },
  {
    name: "<prose> <ul> / <ol>",
    badge: "document lists",
    description: (
      <>
        Inside <code>&lt;prose&gt;</code> (or <code>.prose</code>),{" "}
        <code>&lt;ul&gt;</code> restores <code>list-style-type: disc</code> and{" "}
        <code>&lt;ol&gt;</code> restores <code>list-style-type: decimal</code>{" "}
        with inline-start padding and item spacing.
      </>
    ),
  },
  {
    name: "class=\"row-list\"",
    badge: "horizontal list",
    description: (
      <>
        Expands to a horizontal flex row (<code>display: flex; align-items: center; list-style-type: none; margin: 0; padding: 0</code>) and zeroes{" "}
        <code>li + li</code> top margin so the first item and subsequent items
        align on the exact same baseline. Use on horizontal navs, breadcrumbs,
        and steppers.
      </>
    ),
  },
  {
    name: "class=\"flow-list\"",
    badge: "vertical list",
    description: (
      <>
        Vertical list with markers and indentation off and theme-spaced{" "}
        <code>li + li</code> block gaps. Use for stacked sidebar links, feeds,
        and settings lists outside <code>&lt;prose&gt;</code>.
      </>
    ),
  },
];

const PROSE_AND_LIST_SNIPPET = `<!-- Long-form article or Markdown container -->
<prose>
  <h2>Incident postmortem</h2>
  <p>
    Traffic shifted away from <code>us-east-1</code> within 40 seconds. Follow-up
    actions before the next release window:
  </p>
  <ul>
    <li>Lower health-check interval to 5 seconds</li>
    <li>Pin canary error budget in <code>spin/default.json</code></li>
  </ul>
</prose>

<!-- Horizontal navigation list outside <prose>: use row-list -->
<nav aria-label="Primary">
  <ul class="row-list gap-4">
    <li><a href="/overview">Overview</a></li>
    <li><a href="/deployments">Deployments</a></li>
    <li><a href="/settings">Settings</a></li>
  </ul>
</nav>`;

export default function StylingProse(): JSX.Element {
  const fontScale = (): readonly string[] => {
    const font = (starterDoc().font ?? {}) as Record<string, unknown>;
    const size = (font["size"] ?? {}) as Record<string, unknown>;
    return Object.keys(size).filter((k) => !k.startsWith("$"));
  };

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Typography & Lists"
        lede="In Spin, semantic HTML elements own typography: headings, paragraphs, inline code, and <prose> read the theme's font scale directly, while ul/ol reset cleanly for UI chrome and restore markers inside <prose>."
      />

      <Section id="ownership" title="Elements own typography">
        <p class="max-w-prose">
          Instead of scattering <code>text-2xl font-bold tracking-tight</code>{" "}
          onto <code>&lt;div&gt;</code> and <code>&lt;span&gt;</code> tags,
          write semantic HTML tags. Each typographic element claims its family,
          size, weight, line height, and color from your theme's{" "}
          <code>font.*</code> tokens, and <A href="/docs/tooling/lints">Spin's lint rules</A>{" "}
          flag utilities that duplicate or fight the element's own styling:
        </p>
        <PropList items={TYPOGRAPHY_ELEMENTS} />
      </Section>

      <Section id="lists" title="Lists: UI reset vs. document prose">
        <p class="max-w-prose">
          Most <code>&lt;ul&gt;</code> and <code>&lt;ol&gt;</code> elements in
          an application are UI chrome (menus, nav rails, steppers, combobox
          options), not bulleted prose. Spin resets bare lists to{" "}
          <code>list-style: none; margin: 0; padding: 0</code> by default,
          restores markers inside <code>&lt;prose&gt;</code>, and ships{" "}
          <code>row-list</code> and <code>flow-list</code> for structured UI
          lists:
        </p>
        <PropList items={LIST_PATTERNS} />
        <Code
          code={PROSE_AND_LIST_SNIPPET}
          lang="html"
          title="Prose container vs. row-list navigation"
        />
      </Section>

      <Section id="scale" title="Active theme font.size ramp">
        <p class="max-w-prose">
          The monotonic <code>font.size.*</code> steps declared by the active
          starter theme. When styling non-prose UI chrome (such as a badge
          counter or a metadata label), <code>text-&lt;step&gt;</code> spends
          these steps:
        </p>
        <div class="flex flex-wrap gap-2">
          <For each={fontScale()}>{(step) => <Chip>text-{step}</Chip>}</For>
        </div>
      </Section>
    </main>
  );
}
