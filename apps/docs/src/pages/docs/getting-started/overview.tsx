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
    title: "Architecture & Ownership",
    href: "/docs/getting-started/architecture",
    blurb: "Why Spin claims HTML tags, how elements and utilities divide work, and the 4-step customization staircase.",
  },
  {
    title: "Quickstart",
    href: "/docs/getting-started/quickstart",
    blurb: "Install the packages, create your brand in spin/<brand>/, and open the Studio.",
  },
  {
    title: "Installation & Bundlers",
    href: "/docs/getting-started/install",
    blurb: "The devDependency split, every bundler's config, and the project layout.",
  },
  {
    title: "Adoption Paths",
    href: "/docs/getting-started/paths",
    blurb: "The full plugin, shared brand packages, incremental primitives migration, or standalone Studio.",
  },
];

export default function GettingStartedOverview(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Overview"
        lede="Brand tokens, intrinsic HTML primitives, closed-scale utilities, and statechart machines in one verifiable system — so humans and coding agents ship UI with zero CSS drift."
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
