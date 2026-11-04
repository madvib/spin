/**
 * Spin & Tailwind divergence guide (Stage D1): what transfers from Tailwind,
 * the one principle (theme-owned values + build-time unknown-class errors),
 * numbers vs. colors in arbitrary values, dark mode via theme tokens,
 * bare-tag primitives with utility adjustments, what Spin adds, and what Spin
 * deliberately omits.
 */
import { A } from "@solidjs/router";
import { createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { mode, theme } from "@spinjs/kit";
import {
  Code,
  PageHeader,
  Section,
  starterDoc,
} from "../../../ui/index.ts";

const TRANSFERS_SNIPPET = `<div class="rounded-lg border border-border bg-surface p-4">
  <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
    <div>
      <strong>Edge routing</strong>
      <small class="block">3 regions active across 12 pop nodes</small>
    </div>
    <div
      tabindex="0"
      class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 transition-colors duration-fast hover:bg-surface-raised"
    >
      <strong>Inspect routes</strong>
      <kbd>⌘K</kbd>
    </div>
  </div>
  <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
    <div class="rounded-md border border-border bg-surface-raised p-3">
      <strong>us-east</strong>
      <small class="block">14 ms p95</small>
    </div>
    <div class="rounded-md border border-border bg-surface-raised p-3">
      <strong>eu-central</strong>
      <small class="block">19 ms p95</small>
    </div>
    <div class="rounded-md border border-border bg-surface-raised p-3">
      <strong>ap-northeast</strong>
      <small class="block">27 ms p95</small>
    </div>
  </div>
</div>`;

const PRINCIPLE_BUILD_SNIPPET = `[spin] \`p-13\` in src/App.tsx generates no CSS — it is not in the spin vocabulary. Did you mean \`p-12\`?
[spin] \`bg-blue-500\` in src/App.tsx generates no CSS — it is not in the spin vocabulary. Drop it.`;

const ARBITRARY_SNIPPET = `<!-- Numeric measurements resolve as a designed escape for one-off geometry -->
<div class="relative rounded-md border border-border bg-surface/80 p-3 w-[13rem]">
  <span class="absolute top-[3px] right-2 h-2 w-2 rounded-full bg-primary text-on-primary"></span>
  <strong>Pinned rail</strong>
  <small class="block">w-[13rem] · top-[3px]</small>
</div>`;

const ELEMENTS_ADJUST_SNIPPET = `<card>
  <card-header>
    <card-title>Invoice summary</card-title>
    <card-description>Bare tags supply the control chrome; utilities adjust placement.</card-description>
  </card-header>
  <card-content>
    <table>
      <thead>
        <tr>
          <th>Environment</th>
          <th>Requests</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Production</td>
          <td>1.4M</td>
        </tr>
      </tbody>
    </table>
    <button type="button" class="primary mt-4 w-full">
      Download statement
    </button>
  </card-content>
</card>`;

const ADDITIONS_SNIPPET = `<!-- 1. Horizontal and vertical UI lists without bullet or baseline drift -->
<ul class="row-list">
  <li><a href="#what-spin-adds">Overview</a></li>
  <li><a href="#what-spin-adds">Regions</a></li>
  <li><a href="#what-spin-adds">Audit log</a></li>
</ul>

<!-- 2. Top-layer anchor positioning pinned to its trigger -->
<div class="isolate relative">
  <button type="button" class="anchor-region-menu">Region target</button>
  <div class="z-dropdown position-anchor-region-menu position-area-bottom-span-right rounded-md border border-border bg-surface-raised p-3 shadow-md">
    <strong>Pinned to --region-menu</strong>
  </div>
</div>

<!-- 3. Component-token utilities spending the theme's button decisions -->
<div class="inline-flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-1 button-weight button-case button-tracking">
  <span>Matches active button type tokens</span>
</div>`;

interface AbsenceItem {
  readonly tailwindForm: string;
  readonly spinAnswer: string;
  // Render-lazy: module-level JSX with router primitives (<A>) executes
  // at import, outside any <Route>. Functions defer to render time.
  readonly reason: () => JSX.Element;
}

const ABSENCE_ITEMS: readonly AbsenceItem[] = [
  {
    tailwindForm: "text-base",
    spinAnswer: "text-md (or bare <p>)",
    reason: () => (
      <>
        Use <code>text-md</code> or write a bare <code>&lt;p&gt;</code> when you
        want the body font-size step. The type scale uses the same{" "}
        <code>2xs</code>–<code>3xl</code> step names as radii, shadows, and
        control sizes so you never switch between <code>base</code> on type and{" "}
        <code>md</code> everywhere else.
      </>
    ),
  },
  {
    tailwindForm: "dark:bg-* / light:bg-*",
    spinAnswer: "bg-surface + data-mode=\"dark\"",
    reason: () => (
      <>
        Switch modes with <code>data-mode=&quot;light&quot;</code> or{" "}
        <code>data-mode=&quot;dark&quot;</code> instead of prefixing utilities
        with <code>dark:</code> or <code>light:</code>. Your theme declares its
        own dark values under <code>$modes.dark</code>, so a single role class
        repaints cleanly in both modes (see{" "}
        <A href="/docs/styling/color#dark-mode">Color &amp; Dark Mode</A>).
      </>
    ),
  },
  {
    tailwindForm: "container / @container / @md:*",
    spinAnswer: "mx-auto w-full max-w-screen-lg",
    reason: () => (
      <>
        Cap and center columns explicitly with <code>mx-auto</code>,{" "}
        <code>w-full</code>, and a named breakpoint measure such as{" "}
        <code>max-w-screen-lg</code> or <code>max-w-lg</code> so the stopping
        edge is visible in markup. Container-query variants (
        <code>@container</code>, <code>@md:</code>) are not yet in the
        vocabulary and are tracked on the post-launch roadmap (see{" "}
        <A href="/docs/styling/space#responsive">
          Space, Layout &amp; Responsive
        </A>
        ).
      </>
    ),
  },
  {
    tailwindForm: "bg-[#fff] / bg-blue-500 / text-[14px]",
    spinAnswer: "bg-surface / bg-primary / text-sm",
    reason: () => (
      <>
        Reach for semantic color roles (<code>bg-surface</code>,{" "}
        <code>bg-primary</code>, <code>text-text-muted</code>) and declared{" "}
        <code>font.size.*</code> steps (<code>text-2xs</code> through{" "}
        <code>text-3xl</code>), or add a token to{" "}
        <code>spin/&lt;name&gt;.json</code>. Default numbered color palettes and
        bracketed color or font-size literals are omitted so switching themes
        never leaves unthemed colors or off-scale type behind.
      </>
    ),
  },
];

function readThemeToken(
  group: string,
  step: string,
  fallback: string,
): string {
  const doc = starterDoc() as Record<string, unknown>;
  const table = doc[group] as Record<string, { $value?: unknown }> | undefined;
  const raw = table?.[step]?.$value;
  return typeof raw === "string" || typeof raw === "number"
    ? String(raw)
    : fallback;
}

export default function StylingTailwind(): JSX.Element {
  const [specimenOverride, setSpecimenOverride] = createSignal<
    "light" | "dark" | null
  >(null);

  const activeMode = (): "light" | "dark" =>
    specimenOverride() ?? (mode() === "dark" ? "dark" : "light");

  return (
    <main class="flex flex-col">
      <PageHeader
        title="I know Tailwind — what transfers, what doesn't, and why?"
        lede="Use the Tailwind utility and variant grammar you already know over a theme your project owns. Every utility reads a declared token, unknown classes fail the build instead of disappearing, and elements arrive styled by their HTML tags."
      />

      <Section id="what-transfers" title="What transfers">
        <p class="max-w-prose">
          Write the utility and variant grammar you already know from Tailwind —{" "}
          <code>p-4</code>, <code>bg-surface</code>, <code>hover:</code>,{" "}
          <code>md:</code>, <code>flex</code>, and <code>grid</code> — and you
          are productive on your first screen. Your muscle memory for flexbox
          and grid composition, spacing steps, state prefixes, and responsive
          breakpoints transfers directly, compiled under the hood by UnoCSS:
        </p>

        <div class="my-2 grid gap-4 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-raised p-4">
            <div class="rounded-lg border border-border bg-surface p-4">
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <strong>Edge routing</strong>
                  <small class="block">
                    3 regions active across 12 pop nodes
                  </small>
                </div>
                <div
                  tabindex="0"
                  class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 transition-colors duration-fast hover:bg-surface-raised"
                >
                  <strong>Inspect routes</strong>
                  <kbd>⌘K</kbd>
                </div>
              </div>
              <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div class="rounded-md border border-border bg-surface-raised p-3">
                  <strong>us-east</strong>
                  <small class="block">14 ms p95</small>
                </div>
                <div class="rounded-md border border-border bg-surface-raised p-3">
                  <strong>eu-central</strong>
                  <small class="block">19 ms p95</small>
                </div>
                <div class="rounded-md border border-border bg-surface-raised p-3">
                  <strong>ap-northeast</strong>
                  <small class="block">27 ms p95</small>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1">
              <code>p-4</code>
              <code>bg-surface</code>
              <code>hover:bg-surface-raised</code>
              <code>md:flex-row</code>
              <code>md:grid-cols-3</code>
              <code>flex</code>
              <code>grid</code>
            </div>
          </div>

          <Code
            code={TRANSFERS_SNIPPET}
            lang="html"
            title="One markup sample valid in both grammars, rendered live"
          />
        </div>
      </Section>

      <Section
        id="the-one-principle"
        title="The one principle: every value comes from your theme"
      >
        <p class="max-w-prose">
          Write a utility class and it resolves against the tokens your theme
          declares in <code>spin/&lt;name&gt;.json</code> — <code>p-4</code>{" "}
          spends <code>spacing.4</code>, <code>bg-surface-raised</code> spends{" "}
          <code>color.surface-raised</code>, and <code>rounded-md</code> spends{" "}
          <code>radius.md</code>. Because a closed vocabulary that fails
          silently is a footgun, a class your theme cannot produce renders
          nothing and fails your build with the file, the unknown class, and the
          nearest valid replacement (see{" "}
          <A href="/docs/tooling/lints">Lints &amp; Diagnostics</A>).
        </p>

        <div class="my-2 grid gap-4 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-raised p-4">
            <div class="rounded-md border border-border bg-surface p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <strong>Resolved against {theme()}</strong>
                <badge variant="success">Build green</badge>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <code>
                  p-4 → {readThemeToken("spacing", "4", "1rem")}
                </code>
                <code>
                  rounded-md → {readThemeToken("radius", "md", "0.375rem")}
                </code>
                <code>bg-surface-raised</code>
              </div>
            </div>

            <div class="rounded-md border border-border bg-surface p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <strong>Undeclared step or palette class</strong>
                <badge variant="danger">Build error</badge>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <code>p-13</code>
                <small>→ suggests</small>
                <code>p-12</code>
                <code>bg-blue-500</code>
                <small>→ flagged for removal or role replacement</small>
              </div>
            </div>
          </div>

          <Code
            code={PRINCIPLE_BUILD_SNIPPET}
            lang="bash"
            title="Build output when markup names a class the theme cannot produce"
          />
        </div>
      </Section>

      <Section
        id="decisions-vs-measurements"
        title="Colors are decisions, numbers are measurements"
      >
        <p class="max-w-prose">
          Pass a bracketed number to a sizing or inset utility like{" "}
          <code>w-[13rem]</code> or <code>top-[3px]</code> when a single
          element needs a one-off measurement — the size and inset bracket
          syntax exists as a designed escape for geometry your theme scale has
          no reason to name. Write a bracketed color like{" "}
          <code>bg-[#fff]</code> or an arbitrary font size like{" "}
          <code>text-[14px]</code> and the stylesheet emits nothing and fails
          validation, because a number sizes one element while a color or type
          size repaints the system without telling the theme; thin a declared
          color role with an alpha suffix like <code>bg-surface/80</code> and
          pick type sizes from your <code>font.size.*</code> scale (
          <code>text-2xs</code> through <code>text-3xl</code>).
        </p>
        <p class="max-w-prose">
          A bracketed measurement carries no scale promise, so switching
          themes never silently unstyles it — the cross-theme report covers
          declared steps. Reach for the scale first and the bracket only for
          the geometry the scale has no name for; the authoring skill and the
          agent guidance point the same way. No build fails for measuring one
          element past the scale.
        </p>
        <div class="my-2 grid gap-4 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-raised p-4">
            <div class="relative rounded-md border border-border bg-surface/80 p-3 w-[13rem]">
              <span
                class="absolute top-[3px] right-2 h-2 w-2 rounded-full bg-primary text-on-primary"
                aria-hidden="true"
              />
              <strong>Pinned rail</strong>
              <small class="block">
                Measured with <code>w-[13rem]</code> and <code>top-[3px]</code>
              </small>
            </div>

            <div class="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-1">
                  <code>w-[13rem]</code>
                  <code>top-[3px]</code>
                  <code>bg-surface/80</code>
                </div>
                <badge variant="success">Emits CSS</badge>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-1">
                  <code>bg-[#fff]</code>
                  <code>text-[14px]</code>
                </div>
                <badge variant="danger">Dead on arrival</badge>
              </div>
            </div>
          </div>

          <Code
            code={ARBITRARY_SNIPPET}
            lang="html"
            title="Numeric size/inset measurements resolve; color and type-size literals do not"
          />
        </div>
      </Section>

      <Section id="dark-mode" title="Dark mode is a theme, not a variant">
        <p class="max-w-prose">
          Write each color utility once (<code>bg-surface</code>,{" "}
          <code>bg-surface-raised</code>,{" "}
          <code>bg-primary text-on-primary</code>, <code>border-border</code>)
          and switch modes with <code>data-mode=&quot;light&quot;</code> or{" "}
          <code>data-mode=&quot;dark&quot;</code> on <code>&lt;html&gt;</code>{" "}
          or any nested container — never by scattering <code>dark:</code>{" "}
          variants across your markup. Because the dark theme declares its own
          token values, one class has two honest answers and never needs
          per-element theme patches; see{" "}
          <A href="/docs/styling/color#dark-mode">Color &amp; Dark Mode</A> for
          the full walkthrough:
        </p>

        <div class="my-2 flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <code>data-mode=&quot;{activeMode()}&quot;</code>
              <small>
                Active theme: <code>{theme()}</code>
              </small>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class={activeMode() === "light" ? "primary s-sm" : "s-sm"}
                onClick={() => setSpecimenOverride("light")}
              >
                light
              </button>
              <button
                type="button"
                class={activeMode() === "dark" ? "primary s-sm" : "s-sm"}
                onClick={() => setSpecimenOverride("dark")}
              >
                dark
              </button>
            </div>
          </div>

          <div
            data-theme={theme()}
            data-mode={activeMode()}
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4"
          >
            <div>
              <strong>Same class list in both modes</strong>
              <small class="block">
                <code>bg-surface</code> · <code>border-border</code> ·{" "}
                <code>bg-primary text-on-primary</code>
              </small>
            </div>
            <button type="button" class="primary">
              Primary action
            </button>
          </div>
        </div>
      </Section>

      <Section
        id="elements-and-utilities"
        title="Elements arrive styled; utilities adjust"
      >
        <p class="max-w-prose">
          Write bare <code>&lt;button&gt;</code>, <code>&lt;table&gt;</code>,{" "}
          <code>&lt;p&gt;</code>, and <code>&lt;card&gt;</code> tags to get
          finished controls and document typography without assembling a long
          utility string on every element. Because utilities sit above element
          rules in the stylesheet cascade, adding a layout or spacing utility
          like <code>w-full</code> or <code>mt-4</code> adjusts a bare element
          cleanly for a one-off placement — while any visual adjustment that
          recurs across screens belongs in your theme tokens so every instance
          agrees (see the{" "}
          <A href="/docs/styling/elements">Primitives guide</A>):
        </p>

        <div class="my-2 grid gap-4 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-raised p-4">
            <card>
              <card-header>
                <card-title>Invoice summary</card-title>
                <card-description>
                  Bare tags supply the control chrome; utilities adjust
                  placement.
                </card-description>
              </card-header>
              <card-content>
                <table>
                  <thead>
                    <tr>
                      <th>Environment</th>
                      <th>Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Production</td>
                      <td>1.4M</td>
                    </tr>
                  </tbody>
                </table>
                <button type="button" class="primary mt-4 w-full">
                  Download statement
                </button>
              </card-content>
            </card>
            <div class="flex flex-wrap items-center gap-1">
              <code>&lt;card&gt;</code>
              <code>&lt;table&gt;</code>
              <code>&lt;button class=&quot;primary mt-4 w-full&quot;&gt;</code>
            </div>
          </div>

          <Code
            code={ELEMENTS_ADJUST_SNIPPET}
            lang="html"
            title="Bare tags provide the look; mt-4 and w-full adjust layout"
          />
        </div>
      </Section>

      <Section
        id="what-spin-adds"
        title="What Spin adds, and why each earns its place"
      >
        <p class="max-w-prose">
          Write <code>row-list</code> on a horizontal <code>&lt;ul&gt;</code>{" "}
          or <code>&lt;ol&gt;</code> to lay items out in a centered flex row
          with markers cleared and every item aligned on the same baseline, or{" "}
          <code>flow-list</code> for a vertical UI list with markers off and
          theme block spacing preserved. Because document lists space adjacent{" "}
          <code>li + li</code> items vertically so prose lists breathe, putting
          plain <code>flex</code> on a <code>&lt;ul&gt;</code> leaves the second
          item sitting lower than the first; <code>row-list</code> zeroes that
          sibling margin and sets the row gap in one class.
        </p>

        <p class="max-w-prose">
          Name a trigger control with <code>anchor-&lt;name&gt;</code> (such as{" "}
          <code>anchor-region-menu</code>) and pin its floating panel to it with{" "}
          <code>position-anchor-&lt;name&gt;</code> and a{" "}
          <code>position-area-*</code> placement like{" "}
          <code>position-area-bottom-span-right</code> or{" "}
          <code>position-area-top</code>. When a native <code>[popover]</code>{" "}
          or menu renders in the browser&apos;s top layer, no ancestor box
          positions it — <code>absolute top-full</code> measures against the
          viewport instead of the button that opened it — so anchor utilities
          let the panel track its trigger directly in markup.
        </p>

        <p class="max-w-prose">
          Apply a component-token utility such as <code>button-weight</code>,{" "}
          <code>button-case</code>, <code>button-tracking</code>,{" "}
          <code>table-header-weight</code>, or <code>stat-value-weight</code>{" "}
          when a custom surface needs to spend the exact typographic decision
          your theme made for that primitive. Instead of guessing whether the
          active theme styles buttons in bold uppercase or medium sentence case,
          your custom trigger reads the component token directly and follows
          every theme change (see{" "}
          <A href="/docs/themes/customization">Customization</A> and{" "}
          <A href="/docs/themes/reference#elements">Token Reference</A>):
        </p>

        <div class="my-2 grid gap-4 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface-raised p-4">
            <div class="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
              <small class="block">
                1. Horizontal list (<code>row-list</code>) vs. vertical UI list
                (<code>flow-list</code>)
              </small>
              <ul class="row-list">
                <li>
                  <a href="#what-spin-adds">Overview</a>
                </li>
                <li>
                  <a href="#what-spin-adds">Regions</a>
                </li>
                <li>
                  <a href="#what-spin-adds">Audit log</a>
                </li>
              </ul>
              <ul class="flow-list">
                <li>Primary region healthy</li>
                <li>Failover rehearsal passed</li>
              </ul>
            </div>

            <div class="isolate relative min-h-24 rounded-md border border-border bg-surface p-3">
              <small class="block">
                2. Top-layer anchor utilities (<code>anchor-region-menu</code> +{" "}
                <code>position-anchor-region-menu</code>)
              </small>
              <div class="mt-2">
                <button type="button" class="s-sm anchor-region-menu">
                  Region target
                </button>
                <div class="z-dropdown position-anchor-region-menu position-area-bottom-span-right mt-1 inline-flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-1 shadow-md">
                  <strong>Pinned to --region-menu</strong>
                </div>
              </div>
            </div>

            <div class="rounded-md border border-border bg-surface p-3">
              <small class="block">
                3. Component-token utilities (<code>button-weight</code> ·{" "}
                <code>button-case</code> · <code>button-tracking</code>)
              </small>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <div class="inline-flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-1 button-weight button-case button-tracking">
                  <span>Matches active button type tokens</span>
                </div>
              </div>
            </div>
          </div>

          <Code
            code={ADDITIONS_SNIPPET}
            lang="html"
            title="List orientation, CSS anchor positioning, and component-token utilities"
          />
        </div>
      </Section>

      <Section id="what-spin-lacks" title="What Spin lacks, honestly">
        <p class="max-w-prose">
          Reach for the Spin equivalent below whenever a Tailwind habit is
          deliberately absent from the vocabulary — every omission either avoids
          a second way to state a theme decision or points to the roadmap item
          tracking it:
        </p>

        <div class="my-2 grid gap-3 sm:grid-cols-2">
          <For each={ABSENCE_ITEMS}>
            {(item) => (
              <div class="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-raised p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-1">
                    <small>Tailwind:</small>
                    <code>{item.tailwindForm}</code>
                  </div>
                  <div class="flex flex-wrap items-center gap-1">
                    <small>Spin:</small>
                    <code>{item.spinAnswer}</code>
                  </div>
                </div>
                <p>{item.reason()}</p>
              </div>
            )}
          </For>
        </div>

        <p class="max-w-prose">
          Declare any repeated flex or grid arrangements your project wants to
          name (such as <code>stack</code>, <code>row</code>, or{" "}
          <code>split</code>) under{" "}
          <code>spin.vite({"{"} shortcuts {"}"})</code> in your bundler config —
          the preset ships no built-in layout shortcuts of its own so every
          composition name in your templates is one your project chose (see{" "}
          <A href="/docs/styling/space#compositions">
            Space, Layout &amp; Responsive
          </A>{" "}
          and browse every shipped utility rule in the{" "}
          <A href="/docs/styling/catalog">Utility Reference</A>).
        </p>
      </Section>
    </main>
  );
}
