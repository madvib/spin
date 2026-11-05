/**
 * Lints & Verification: the six theme-aware rules, dials, and side-by-side specimens.
 */
import type { JSX } from "solid-js";
import { For } from "solid-js";
import { Markdown } from "../../../markdown.tsx";
import { Code, PageHeader, Section } from "../../../ui/index.ts";
import lintsMd from "../../../content/lints.md?raw";

function Pair(props: {
  rule: string;
  bad: string;
  good: string;
  note: string;
}): JSX.Element {
  return (
    <div class="mt-4 rounded-lg border border-border bg-surface-raised p-4">
      <code>{props.rule}</code>
      <p class="text-text-muted">{props.note}</p>
      <div class="grid gap-3 md:grid-cols-2">
        <Code code={props.bad} lang="html" title="Flagged" />
        <Code code={props.good} lang="html" title="Remedy" />
      </div>
    </div>
  );
}

const PAIRS: readonly {
  rule: string;
  bad: string;
  good: string;
  note: string;
}[] = [
  {
    rule: "spin/closed-vocabulary",
    bad: `<p class="text-md p-13">Quarterly revenue</p>`,
    good: `<p class="text-md p-4">Quarterly revenue</p>`,
    note:
      "p-13 is not a declared spacing step — it emits no CSS. The fix names a declared step.",
  },
  {
    rule: "spin/no-redundant-class",
    bad: `<h3 class="text-xl">Revenue</h3>`,
    good: `<h3>Revenue</h3>`,
    note:
      "The element already sets text-xl. The fix drops the redundant class.",
  },
  {
    rule: "spin/prefer-theme-value",
    bad: `<button class="bg-accent">Pay now</button>`,
    good: `<button class="secondary">Pay now</button>`,
    note:
      "The button owns its background. Pick the variant or update the theme token.",
  },
  {
    rule: "spin/prefer-element",
    bad: `<span class="text-3xl">Revenue</span>`,
    good: `<h1>Revenue</h1>`,
    note:
      "The level-one size belongs to exactly one element, so this is an error. A size several elements share stays a suggestion.",
  },
  {
    rule: "spin/no-unpaired-ink",
    bad: `<badge variant="primary" class="text-primary">new</badge>`,
    good: `<badge variant="primary" class="text-on-primary">new</badge>`,
    note:
      "The primary fill pairs with text-on-primary. Surfaces are the exception — the default ink belongs there.",
  },
  {
    rule: "spin/no-handwritten-tokens",
    bad: `el.style.setProperty("color", "var(--color-primary)")`,
    good: `<span class="text-primary">…</span>`,
    note:
      "Spend the token through a utility instead of referencing CSS custom properties by hand.",
  },
];

export default function Lints(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Lints & Verification"
        lede="Six theme-aware rules that run across oxlint, ESLint, and the standalone spin lint CLI, reading your project's live themes and shortcuts."
      />
      <Markdown text={lintsMd} />

      <Section id="specimens" title="Flagged and fixed, side by side">
        <p class="max-w-prose">
          Each pair below shows a lint finding alongside its remedy:
        </p>
        <For each={PAIRS}>
          {(pair) => (
            <Pair
              rule={pair.rule}
              bad={pair.bad}
              good={pair.good}
              note={pair.note}
            />
          )}
        </For>
      </Section>
    </main>
  );
}
