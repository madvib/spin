/**
 * What is Spin: the argument, then the three ways into the handbook.
 *
 * The narrative and the trade-offs live in `../content/start.md`. This file
 * keeps the route links Markdown does not own.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Markdown } from "../markdown.tsx";
import startMd from "../content/start.md?raw";

const NEXT: readonly {
  readonly title: string;
  readonly href: string;
  readonly blurb: string;
}[] = [
  {
    title: "Quickstart",
    href: "/start/quickstart",
    blurb: "Install the three packages, wire your bundler, and open the Studio.",
  },
  {
    title: "Install & bundlers",
    href: "/start/install",
    blurb: "The devDependency split, every bundler's config, and the project layout.",
  },
  {
    title: "Ways to use Spin",
    href: "/start/paths",
    blurb: "The plugin, the preset alone, or the standalone Studio.",
  },
  {
    title: "Architecture & layers",
    href: "/start/model",
    blurb: "Which layer owns a change, and the checks that verify it.",
  },
];

export default function Start(): JSX.Element {
  return (
    <main class="mx-auto w-full max-w-screen-lg px-6 py-10 md:py-16">
      <h1>What is Spin?</h1>
      <Markdown text={startMd} />
      <nav aria-label="Start here" class="mt-10 grid gap-3 border-t border-border pt-6 md:grid-cols-2">
        <For each={NEXT}>
          {(item) => (
            <A
              href={item.href}
              class="block rounded-sm border border-border px-4 py-3 no-underline transition-colors duration-fast hover:bg-surface-raised"
            >
              <div class="font-semibold text-text">{item.title}</div>
              <small>{item.blurb}</small>
            </A>
          )}
        </For>
      </nav>
    </main>
  );
}
