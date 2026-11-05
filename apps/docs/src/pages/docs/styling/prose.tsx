/**
 * Typography: the named type styles the theme declares, spent with
 * `type-<name>` or carried by elements by default — plus the list
 * primitives (`ul`/`ol` reset, `row-list`, `flow-list`).
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import {
  ELEMENT_STYLE_DEFAULTS,
  resolveTheme,
  starterThemes,
} from "@spinjs/spin/theme";
import { mode, theme } from "@spinjs/kit";
import {
  Code,
  PageHeader,
  PropList,
  Section,
  type PropEntry,
} from "../../../ui/index.ts";

const SAMPLE = "The quick brown fox jumps over the lazy dog";

const DEFAULT_ELEMENTS: readonly string[] = Object.keys(
  ELEMENT_STYLE_DEFAULTS,
);

function styleInline(name: string): Record<string, string> {
  const doc = starterThemes[theme() as keyof typeof starterThemes];
  const resolved = resolveTheme(doc, mode() === "dark" ? "dark" : "light");
  const read = (field: string): string => {
    const value = resolved.values[`font.style.${name}.${field}`];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : "inherit";
  };
  return {
    "font-family": read("family"),
    "font-size": read("size"),
    "font-weight": read("weight"),
    "letter-spacing": read("tracking"),
    "line-height": read("leading"),
  };
}

function declarationOf(name: string): string {
  const doc = starterThemes[theme() as keyof typeof starterThemes];
  const resolved = resolveTheme(doc, mode() === "dark" ? "dark" : "light");
  const read = (field: string): string => {
    const value = resolved.values[`font.style.${name}.${field}`];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : "—";
  };
  return `${read("family")} · ${read("size")} · ${read("weight")}`;
}

const LIST_PATTERNS: readonly PropEntry[] = [
  {
    name: "Bare <ul> / <ol>",
    badge: "reset layer",
    description: (
      <>
        Reset to <code>margin: 0; padding: 0; list-style: none</code> in the
        base stylesheet so navigation rails, menus, comboboxes, and tab bars
        never have to strip browser bullets or indentation.
      </>
    ),
  },
  {
    name: "<prose> <ul> / <ol>",
    badge: "document lists",
    description: (
      <>
        Inside <code>&lt;prose&gt;</code> (or <code>.prose</code>),{" "}
        <code>&lt;ul&gt;</code> restores <code>list-style-type: disc</code> and{" "}
        <code>&lt;ol&gt;</code> restores <code>list-style-type: decimal</code>{" "}
        with inline-start padding and item spacing.
      </>
    ),
  },
  {
    name: "class=\"row-list\"",
    badge: "horizontal list",
    description: (
      <>
        Expands to a horizontal flex row (<code>display: flex; align-items: center; list-style-type: none; margin: 0; padding: 0</code>) and zeroes{" "}
        <code>li + li</code> top margin so the first item and subsequent items
        align on the exact same baseline. Use on horizontal navs,
        breadcrumbs, and steppers.
      </>
    ),
  },
  {
    name: "class=\"flow-list\"",
    badge: "vertical list",
    description: (
      <>
        Vertical list with markers and indentation off and theme-spaced{" "}
        <code>li + li</code> block gaps. Use for stacked sidebar links, feeds,
        and settings lists outside <code>&lt;prose&gt;</code>.
      </>
    ),
  },
];

const PROSE_AND_LIST_SNIPPET = `<!-- Long-form article or Markdown container -->
<prose>
  <h2>Incident postmortem</h2>
  <p>
    Traffic shifted away from <code>us-east-1</code> within 40 seconds. Follow-up
    actions before the next release window:
  </p>
  <ul>
    <li>Lower health-check interval to 5 seconds</li>
    <li>Pin canary error budget in <code>spin/default.json</code></li>
  </ul>
</prose>

<!-- Horizontal navigation list outside <prose>: use row-list -->
<nav aria-label="Primary">
  <ul class="row-list gap-4">
    <li><a href="/overview">Overview</a></li>
    <li><a href="/deployments">Deployments</a></li>
    <li><a href="/settings">Settings</a></li>
  </ul>
</nav>`;

const ATTACH_SNIPPET = `<!-- The caption voice, worn by a span inside a figure -->
<figure>
  <img src="/chart.svg" alt="Weekly error budget" />
  <figcaption><span class="type-caption-strong">Figure 3.</span> Burn-down across regions.</figcaption>
</figure>`;

export default function StylingProse(): JSX.Element {
  const names = (): readonly string[] => {
    const doc = starterThemes[theme() as keyof typeof starterThemes];
    const resolved = resolveTheme(doc, mode() === "dark" ? "dark" : "light");
    const found = new Set<string>();
    for (const key of Object.keys(resolved.values)) {
      if (!key.startsWith("font.style.")) continue;
      const rest = key.slice("font.style.".length);
      const dot = rest.indexOf(".");
      if (dot > 0) found.add(rest.slice(0, dot));
    }
    return [...found].sort();
  };
   return (
     <main class="flex flex-col">
      <PageHeader
        title="Typography"
        lede="Write semantic HTML and get finished type: every element arrives carrying a named style, and one type-<name> class changes the voice — the whole tuple at once, never letter by letter."
      />

      <Section id="defaults" title="Elements arrive with their voice">
        <p class="max-w-prose">
          Write <code>&lt;h1&gt;</code> and get the page's loudest statement;{" "}
          write <code>&lt;p&gt;</code> and get the reading voice; write{" "}
          <code>&lt;small&gt;</code> and get the small print. Each element
          carries one of your theme's named styles by default, so your markup
          reads as a document instead of a pile of sizes:
        </p>
        <ul class="flex flex-col gap-4">
          <For each={DEFAULT_ELEMENTS}>
            {(element) => (
              <li class="flex flex-col gap-2">
                <card>
                  <div class="flex flex-wrap items-baseline gap-x-2">
                    <code>&lt;{element}&gt;</code>
                    <small>reads</small>
                    <code>type-{ELEMENT_STYLE_DEFAULTS[element]}</code>
                    <small>
                      from <code>font.style.{ELEMENT_STYLE_DEFAULTS[element]}</code>
                    </small>
                  </div>
                  <div class="rounded-md border border-border bg-surface p-3">
                    <p style={styleInline(ELEMENT_STYLE_DEFAULTS[element] ?? "body")}>
                      {SAMPLE}
                    </p>
                  </div>
                </card>
              </li>
            )}
          </For>
        </ul>
      </Section>

      <Section id="restyle" title="One class changes the voice">
        <p class="max-w-prose">
          To change how a run of text reads, write one{" "}
          <code>type-&lt;name&gt;</code> class — it spends the whole tuple
          (face, size, weight, tracking, leading) at once. Sizing and weighing
          by hand with <code>text-sm</code> or <code>font-medium</code> names
          nothing your theme can make, so the build fails and names the style
          to write instead. Every style below renders live from your active
          starter theme, beside the class that spends it and the theme
          location that owns it:
        </p>
        <ul class="flex flex-col gap-4">
          <For each={names()}>
            {(name) => (
              <li class="flex flex-col gap-2">
                <card>
                  <div class="flex flex-wrap items-baseline gap-x-2">
                    <code>type-{name}</code>
                    <small>
                      from <code>font.style.{name}</code>
                    </small>
                    <small>{declarationOf(name)}</small>
                  </div>
                  <div class="rounded-md border border-border bg-surface p-3">
                    <p style={styleInline(name)}>{SAMPLE}</p>
                  </div>
                </card>
              </li>
            )}
          </For>
        </ul>
      </Section>

      <Section id="placement" title="Styles attach anywhere">
        <p class="max-w-prose">
          A style is a voice, not a seat: put a theme-declared style on any
          element — <code>&lt;span class="type-caption"&gt;</code> captions a
          figure from inside a paragraph. The only constraint is the
          vocabulary: the style must be one your theme declares, so{" "}
          <code>type-headline</code> on a theme with no{" "}
          <code>font.style.headline</code> fails the build and names the
          nearest style that exists. Where a style sits is advice, never a
          rule — no warning fires when a caption lands on a span.
        </p>
        <Code
          code={ATTACH_SNIPPET}
          lang="html"
          title="A declared style on any element"
        />
      </Section>

      <Section id="theme" title="The theme owns the set">
        <p class="max-w-prose">
          The styles above are not built into Spin — they are your theme's{" "}
          <code>font.style.*</code> entries, read live on this page. A
          designer trims or extends the set in{" "}
          <code>spin/&lt;name&gt;.json</code> (or the{" "}
          <A href="/studio">Studio</A> Styles section) and every specimen here
          follows; the <code>font.size.*</code> steps are the ladder the
          styles are built from, so moving a step moves every style that
          stands on it. The full token surface lives in the{" "}
          <A href="/docs/themes/reference">token reference</A>.
        </p>
      </Section>

      <Section id="lists" title="Lists: UI reset vs. document prose">
        <p class="max-w-prose">
          Most <code>&lt;ul&gt;</code> and <code>&lt;ol&gt;</code> elements in
          an application are UI chrome (menus, nav rails, steppers, combobox
          options), not bulleted prose. Spin resets bare lists to{" "}
          <code>list-style: none; margin: 0; padding: 0</code> by default,
          restores markers inside <code>&lt;prose&gt;</code>, and ships{" "}
          <code>row-list</code> and <code>flow-list</code> for structured UI
          lists:
        </p>
        <PropList items={LIST_PATTERNS} />
        <Code
          code={PROSE_AND_LIST_SNIPPET}
          lang="html"
          title="Prose container vs. row-list navigation"
        />
      </Section>

      <Section id="escape" title="The escape, honestly">
        <p class="max-w-prose">
          One voice on this site is genuinely one-off: the Spin wordmark in
          the corner, set in the brand face at one deliberate size no theme
          scale has reason to name. That element carries{" "}
          <code>data-spin-escape</code>, the author's explicit word that its
          classes are deliberate — so no warning fires about placement
          there — while the vocabulary rule still fires, because deliberate
          code still names nothing dead. Reach for
          it for a brand lockup or a hero moment, never for copy the theme
          could say; if you reach for it twice, the theme is missing a style
          worth naming. The full contract lives in the{" "}
          <A href="/docs/tooling/lints">lints guide</A>.
        </p>
      </Section>
    </main>
  );
}
