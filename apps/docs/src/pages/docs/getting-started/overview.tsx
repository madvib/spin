/**
 * What is Spin: the overview and entry point into `/docs/*`.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Markdown } from "../../../markdown.tsx";
import { PageHeader, PlaygroundEmbed } from "../../../ui/index.ts";
import { Section } from "../../../bits.tsx";
import startMd from "../../../content/start.md?raw";

const NEXT: readonly {
  readonly title: string;
  readonly href: string;
  readonly blurb: string;
}[] = [
  {
    title: "Quickstart",
    href: "/docs/getting-started/quickstart",
    blurb: "Install the three packages, wire your bundler, and open the Studio.",
  },
  {
    title: "Install & Bundlers",
    href: "/docs/getting-started/install",
    blurb: "The devDependency split, every bundler's config, and the project layout.",
  },
  {
    title: "Ways to Use Spin",
    href: "/docs/getting-started/paths",
    blurb: "The plugin, the preset alone, or the standalone Studio.",
  },
  {
    title: "Architecture & Layers",
    href: "/docs/getting-started/architecture",
    blurb: "Which layer owns a change, and the checks that verify it.",
  },
];

export default function GettingStartedOverview(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="What is Spin?"
        lede="A theme-driven UI system: DTCG design tokens, classless HTML elements, closed-scale UnoCSS utilities, and headless state-machine components."
        playgroundExample="elements-form"
      />
      <Markdown text={startMd} />

      <Section id="live-preview" title="Interactive preview">
        <p class="max-w-prose">
          Edit the markup below to see how standard HTML tags and Spin tokens
          render live under the active theme and mode.
        </p>
        <div class="mt-3">
          <PlaygroundEmbed exampleId="elements-form" compact />
        </div>
      </Section>

      <Section id="next-steps" title="Explore Getting Started">
        <div class="mt-2 grid gap-3 sm:grid-cols-2">
          <For each={NEXT}>
            {(item) => (
              <A
                href={item.href}
                class="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 no-underline transition-colors duration-fast hover:border-border-strong hover:bg-surface-raised"
              >
                <div class="font-semibold text-text">{item.title}</div>
                <small>{item.blurb}</small>
              </A>
            )}
          </For>
        </div>
      </Section>
    </main>
  );
}
