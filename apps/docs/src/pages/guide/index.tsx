/**
 * The guide's parent page: the heading, the pitch, the section row — and an
 * `<Outlet/>` the section pages render themselves into.
 *
 * The sections are explicit and ordered by workflow: install wires the
 * plugin, markup writes the elements, css learns the cascade boundaries.
 * Bare `/guide` redirects to `/guide/install` in `app.tsx`.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";

const GUIDE_SECTIONS: readonly {
  readonly slug: string;
  readonly title: string;
}[] = [
  { slug: "install", title: "1. Install & Wiring" },
  { slug: "markup", title: "2. Markup & Elements" },
  { slug: "css", title: "3. CSS & Edges" },
];
const CHIP = (active: boolean): string =>
  `rounded-sm px-3 py-2 text-sm no-underline transition-colors duration-fast ${
    active ? "bg-primary text-on-primary" : "text-text-muted hover:text-text"
  }`;

export default function Guide(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1>Start Guide</h1>
      <p class="max-w-screen-md text-text-muted">
        Wire the preset into your bundler, write semantic HTML and Spin custom
        elements without class boilerplate, and learn the exact CSS boundaries
        where Spin's closed token vocabulary takes over from utility CSS.
      </p>
      <nav class="mt-6 flex flex-wrap items-center gap-1 border-b border-border pb-4 text-sm">
        <For each={GUIDE_SECTIONS}>
          {(section) => (
            <A
              href={`/guide/${section.slug}`}
              class={CHIP(location.pathname === `/guide/${section.slug}`)}
            >
              {section.title}
            </A>
          )}
        </For>
      </nav>
      {props.children}
    </main>
  );
}
