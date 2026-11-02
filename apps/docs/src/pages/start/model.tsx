/**
 * Mental model: which layer owns which change, and what checks it.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";

const rows = (): readonly {
  readonly change: string;
  readonly edit: JSX.Element;
  readonly check: string;
}[] => [
  {
    change: "A colour, type step, spacing, radius, or motion",
    edit: (
      <>
        The theme document in <code>spin/*.json</code>; see{" "}
        <A href="/themes">Themes</A>
      </>
    ),
    check: "The contract gates",
  },
  {
    change: "A utility class",
    edit: (
      <>
        A theme token; the closed vocabulary is in{" "}
        <A href="/utilities">Utilities &amp; CSS</A>
      </>
    ),
    check: "spin lint",
  },
  {
    change: "A native element's skin",
    edit: (
      <>
        A theme token or a variant; see{" "}
        <A href="/guide/markup">Markup &amp; elements</A>
      </>
    ),
    check: "prefer-theme-value",
  },
  {
    change: "A multi-step behaviour",
    edit: (
      <>
        A headless machine; copy an example from{" "}
        <A href="/components">Components</A>
      </>
    ),
    check: "The machine test",
  },
  {
    change: "The rendered result",
    edit: (
      <>
        The app's own page; the visual harness is internal in 0.1
      </>
    ),
    check: "spin check",
  },
];

export default function Model(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Mental model</h1>
      <p class="max-w-screen-md text-text-muted">
        One theme feeds CSS variables; utilities and elements spend those
        variables. Machines are a separate, optional layer. A change belongs to
        the layer that owns the decision, and each layer has its own check.
      </p>

      <div class="my-6 overflow-x-auto">
        <table class="wrap">
          <thead>
            <tr>
              <th class="text-left">Change</th>
              <th class="text-left">Edit</th>
              <th class="text-left">Check</th>
            </tr>
          </thead>
          <tbody>
            {rows().map((row) => (
              <tr>
                <td>{row.change}</td>
                <td>{row.edit}</td>
                <td>
                  <code>{row.check}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p class="max-w-screen-md">
        The theme is the single source of truth. Utilities and native elements
        read it through CSS variables; a class outside the vocabulary emits no
        CSS. The machine components read it too, but they add behaviour rather
        than values. The source lints read the project and the theme; the
        rendered harness reads the browser, and is internal in 0.1. Neither
        check can tell you whether the theme is good — only whether it holds
        its floor.
      </p>

      <nav
        aria-label="Continue"
        class="mt-6 flex flex-wrap gap-2 border-t border-border pt-5 text-sm"
      >
        <A
          href="/themes"
          class="rounded-sm border border-border px-3 py-2 no-underline transition-colors duration-fast hover:bg-surface-raised"
        >
          Theme contract
        </A>
        <A
          href="/guide/markup"
          class="rounded-sm border border-border px-3 py-2 no-underline transition-colors duration-fast hover:bg-surface-raised"
        >
          Markup &amp; elements
        </A>
        <A
          href="/tooling/lints"
          class="rounded-sm border border-border px-3 py-2 no-underline transition-colors duration-fast hover:bg-surface-raised"
        >
          Verify
        </A>
      </nav>
    </main>
  );
}
