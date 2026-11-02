/**
 * Lints & Dials: the six theme-aware rules, the two dials, and the three
 * ways to run them.
 *
 * The rule reference lives in `../../content/lints.md`. This file keeps the
 * bad/good specimen pairs the Markdown cannot render live.
 */
import type { JSX } from "solid-js";
import { For } from "solid-js";
import { Code, Section } from "../../bits.tsx";
import { Markdown } from "../../markdown.tsx";
import lintsMd from "../../content/lints.md?raw";

/** One rule's specimen: the flagged line and its fix, side by side. */
function Pair(props: {
  rule: string;
  bad: string;
  good: string;
  note: string;
}): JSX.Element {
  return (
    <div class="mt-4 border border-border bg-surface-raised rounded-md p-4">
      <p class="font-mono text-xs text-text">
        {props.rule}
      </p>
      <p class="text-sm text-text-muted">{props.note}</p>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p class="text-xs font-semibold text-text-muted">flagged</p>
          <Code class="mt-1" code={props.bad} lang="html" />
        </div>
        <div>
          <p class="text-xs font-semibold text-text-muted">instead</p>
          <Code class="mt-1" code={props.good} lang="html" />
        </div>
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
      "p-13 is not a declared spacing step — it emits no CSS. The fix names the step you meant.",
  },
  {
    rule: "spin/no-redundant-class",
    bad: `<h3 class="text-xl">Revenue</h3>`,
    good: `<h3>Revenue</h3>`,
    note:
      "The element already sets text-xl. The fix drops the class, not the size.",
  },
  {
    rule: "spin/prefer-theme-value",
    bad: `<button class="bg-accent">Pay now</button>`,
    good: `<button class="secondary">Pay now</button>`,
    note:
      "The button owns its background. The fix picks the variant that carries the accent — or changes the token.",
  },
  {
    rule: "spin/prefer-element",
    bad: `<span class="text-3xl">Revenue</span>`,
    good: `<h1>Revenue</h1>`,
    note:
      "A suggestion, not an error: the size belongs to a heading. The fix changes the tag, not the class.",
  },
  {
    rule: "spin/no-unpaired-ink",
    bad: `<badge variant="primary" class="text-text">new</badge>`,
    good: `<badge variant="primary" class="text-on-primary">new</badge>`,
    note:
      "The primary fill pairs with text-on-primary. Surfaces are the exception — text-text belongs there.",
  },
  {
    rule: "spin/no-handwritten-tokens",
    bad: `el.style.setProperty("color", "var(--color-primary)")`,
    good: `<span class="text-primary">…</span>`,
    note:
      "Spend the token through a utility instead of reaching for the variable by hand.",
  },
];

export default function Lints(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Lints &amp; Dials</h1>
      <Markdown text={lintsMd} />
      <Section id="specimens" title="Flagged and fixed, side by side">
        <p>
          Each pair below is a finding and its remedy — what the linter flags,
          and the line it wants instead.
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
