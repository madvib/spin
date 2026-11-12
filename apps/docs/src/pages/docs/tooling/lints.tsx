/**
 * Lints & Verification: the principles, the six theme-aware rules, dials, and side-by-side specimens.
 */
import type { JSX } from "solid-js";
import { For } from "solid-js";
import { Markdown } from "../../../markdown/markdown.tsx";
import { Code, PageHeader, Section } from "../../../ui/index.ts";
import lintsMd from "../../../content/lints.md?raw";
import principlesMd from "../../../content/lint-principles.md?raw";
import { PAIRS } from "./lints.specimens.ts";

function Pair(props: {
  rule: string;
  bad: string;
  good: string;
  note: string;
}): JSX.Element {
  return (
    <div class="mt-4 rounded-lg border bg-surface-raised p-4">
      <code>{props.rule}</code>
      <p class="text-muted">{props.note}</p>
      <div class="grid gap-3 md:grid-cols-2">
        <Code code={props.bad} lang="html" title="Flagged" />
        <Code code={props.good} lang="html" title="Remedy" />
      </div>
    </div>
  );
}

export default function Lints(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Lints & Guardrails"
        lede="One rule engine behind your bundler, linter, and editor — unknown classes and conflicting overrides fail before they ship."
      />
      <Markdown text={lintsMd} />

      <Section id="principles" title="Lint principles">
        <Markdown text={principlesMd} />
      </Section>

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
