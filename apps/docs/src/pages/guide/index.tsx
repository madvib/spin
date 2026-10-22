/**
 * The guide's parent page: the heading, the pitch, the section row — and an
 * `<Outlet/>` the section pages render themselves into.
 *
 * The section row is derived by globbing this directory, exactly like the
 * router derives the routes: the file names ARE the sections, in
 * alphabetical order (install → markup → themes → verify).
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";

/** The section files beside this one — file name → /guide/<name>. */
const SECTION_FILES = import.meta.glob<string>("./*.tsx");
const SECTIONS: readonly string[] = Object.keys(SECTION_FILES)
  .map((path) => path.replace(/^\.\//, "").replace(/\.tsx$/, ""))
  .filter((name) => name !== "index")
  .sort();

const CHIP = (active: boolean): string =>
  `rounded-sm px-3 py-2 text-sm no-underline transition-colors duration-fast ${
    active ? "bg-primary text-on-primary" : "text-text-muted hover:text-text"
  }`;

export default function Guide(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  return (
    <main class="mx-auto max-w-screen-md px-4 py-10 md:py-16">
      <h1>Guide</h1>
      <p class="text-text-muted">
        What you bring: a design, as a theme — colors, type, spacing, motion,
        the character of your components. What spin gives back: utilities that
        spend those decisions, finished elements your agent can't get wrong, and
        oracles that verify the result mechanically. The page you're reading was
        built with it.
      </p>
      <nav class="mt-6 flex flex-wrap items-center gap-1 border-b border-border pb-4 text-sm">
        <For each={SECTIONS}>
          {(name) => (
            <A
              href={`/guide/${name}`}
              class={CHIP(location.pathname === `/guide/${name}`)}
            >
              {name}
            </A>
          )}
        </For>
      </nav>
      {props.children}
    </main>
  );
}
