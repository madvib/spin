/**
 * The guide's parent page: the heading, the section row — and an
 * `<Outlet/>` the section pages render themselves into.
 *
 * Installation lives under Start here, so the guide keeps the two authoring
 * sections: markup and CSS edges. Bare `/guide` redirects to
 * `/guide/markup` in `app.tsx`.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";

const GUIDE_SECTIONS: readonly {
  readonly slug: string;
  readonly title: string;
}[] = [
  { slug: "markup", title: "Markup & Elements" },
  { slug: "css", title: "CSS & Edges" },
];
const CHIP = (active: boolean): string =>
  `rounded-sm px-3 py-2 text-sm no-underline transition-colors duration-fast ${
    active ? "bg-primary text-on-primary" : "text-text-muted hover:text-text"
  }`;

export default function Guide(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  return (
    <main class="mx-auto w-full max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Guide</h1>
      <p class="max-w-prose text-text-muted">
        Write semantic HTML and Spin custom elements without class
        boilerplate, then learn the exact CSS boundaries where Spin's closed
        token vocabulary takes over from utility CSS. Installation and
        wiring live under Start here.
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
