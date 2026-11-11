/**
 * What is Spin: the overview and entry point into `/docs/*`.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Markdown } from "../../../markdown/markdown.tsx";
import { PageHeader, PlaygroundEmbed, Section } from "../../../ui/index.ts";
import startMd from "../../../content/start.md?raw";

const NEXT: readonly {
  readonly title: string;
  readonly href: string;
  readonly blurb: string;
}[] = [
  {
    title: "How Spin Works",
    href: "/docs/getting-started/architecture",
    blurb: "See how your theme, HTML elements, utilities, and interactive components fit together.",
  },
  {
    title: "Quickstart",
    href: "/docs/getting-started/quickstart",
    blurb: "Install Spin, initialize a brand, and open the visual Studio in two minutes.",
  },
  {
    title: "Bundler Setup",
    href: "/docs/getting-started/install",
    blurb: "Wire the plugin into Vite, Rspack, webpack, Rollup, Rolldown, esbuild, or Bun.",
  },
  {
    title: "Incremental Adoption",
    href: "/docs/getting-started/paths",
    blurb: "Bring Spin into an existing app gradually — tokens and utilities first, elements and components as you go.",
  },
];

export default function GettingStartedOverview(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Introduction"
        lede="What Spin includes, how it replaces stitched-together styling stacks, and where to start."
        playgroundExample="elements-form"
      />
      <Markdown text={startMd} />

      <Section id="live-preview" title="Interactive preview">
        <p class="max-w-prose">
          Switch themes and light or dark mode in the top bar to see how
          semantic HTML and Spin elements adapt live, or open the example in
          the full Playground.
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
                class="flex flex-col gap-1 rounded-lg border bg-surface p-4 no-underline transition-colors duration-fast hover:border-strong hover:bg-surface-raised"
              >
                <div class="type-body-emphasized">{item.title}</div>
                <small>{item.blurb}</small>
              </A>
            )}
          </For>
        </div>
      </Section>
    </main>
  );
}
