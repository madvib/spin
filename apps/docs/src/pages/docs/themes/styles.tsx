/**
 * Style References: the house skill and visual direction guides for agents.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Section } from "../../../bits.tsx";
import { Markdown } from "../../../markdown.tsx";
import { PageHeader } from "../../../ui/index.ts";
import { SKILL_PATH, styleReferences } from "../../../style-docs.ts";
import type { StyleReference } from "../../../style-docs.ts";

const LAYERS: readonly (readonly [string, string])[] = [
  [
    "The house skill",
    "The invariant method: workflow order, token group checklist, validation gates, and final visual review.",
  ],
  [
    "The style reference",
    "The visual direction: how to spend typography, palette, corner geometry, elevation, motion, and density for a specific aesthetic.",
  ],
  [
    "The theme",
    "Your product's concrete DTCG JSON document combining the house contract, the chosen style direction, and brand-specific tokens.",
  ],
];

export default function Styles(): JSX.Element {
  const styles = styleReferences();
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Style References"
        lede={
          <>
            A style reference names a visual direction and explains how to
            spend Spin's token axes to achieve it. Pair one with{" "}
            <A href="/docs/themes/authoring">Authoring &amp; Gates</A> or
            install <a href={SKILL_PATH}>SKILL.md</a> for your coding agent.
          </>
        }
      />

      <Section id="layers" title="How skill, reference, and theme fit together">
        <ol class="grid gap-3 list-none md:grid-cols-3">
          <For each={LAYERS}>
            {([name, what]) => (
              <li class="rounded-md border border-border bg-surface-raised p-4">
                <p class="font-semibold text-text">{name}</p>
                <p class="text-sm">{what}</p>
              </li>
            )}
          </For>
        </ol>
      </Section>

      <Section id="references" title="Available style directions">
        <p class="max-w-prose">
          {styles.length} distinct aesthetic directions shipped alongside the
          house skill:
        </p>
        <div class="mt-4 flex flex-col gap-8">
          <For each={styles}>
            {(style) => <StyleCard style={style} />}
          </For>
        </div>
      </Section>
    </main>
  );
}

function StyleCard(props: { style: StyleReference }): JSX.Element {
  const style = props.style;
  return (
    <article class="overflow-hidden rounded-lg border border-border bg-surface text-text shadow-sm">
      <header class="border-b border-border bg-surface-raised p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3>{style.name}</h3>
          <a
            href={style.href}
            class="font-mono text-xs hover:underline break-all"
          >
            {style.href}
          </a>
        </div>
        <p class="text-sm">{style.mood}</p>
        <p class="text-xs text-text-muted">
          {style.audience} · anchor: {style.anchor}
        </p>
      </header>
      <div class="p-4">
        <Markdown text={style.body} />
      </div>
    </article>
  );
}
