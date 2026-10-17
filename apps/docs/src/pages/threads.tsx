/**
 * Threads: the token system, shown live.
 *
 * Every swatch chip is a theme utility (`bg-surface`, `bg-primary`, …) —
 * the same class the product spends, resolved by the sheet for the deck
 * the page wears. The ink column sits in a probe subtree that re-declares
 * `data-theme` and `data-mode`, so both renderings of a token hang side by
 * side, resolved by the CSS, not by JS. The character table reads the four
 * starter documents and shows exactly where each one disagrees.
 */
import { createMemo, For } from "solid-js";
import type { JSX } from "solid-js";
import { starterThemes } from "@spin/theme/themes";
import { mode, starterList, theme } from "../shell.tsx";
import { Chip, deckOf, Probe, Section } from "./bits.tsx";

type Cell = Record<string, unknown>;
const leaf = (root: unknown, path: string): unknown => {
  let cur: unknown = root;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Cell)[part];
  }
  return cur;
};
/** The value the document states for a token path, or "—". */
const stated = (doc: unknown, path: string): string => {
  const v = leaf(doc, `${path}.$value`);
  return v === undefined || v === null ? "—" : String(v);
};

/** The other mode of the worn deck, if it has one. */
const otherMode = () => (mode() === "dark" ? "light" : "dark");

export function Threads(): JSX.Element {
  const doc = createMemo(() => deckOf());
  const worn = theme;
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-14">
      <h1 class="text-2xl tracking-tight">Threads</h1>
      <p class="text-text-muted max-w-prose mt-1">
        A theme is a document; a deck is the CSS it becomes. The thread is the
        custom property: one name, strung between every element that spends it.
        This page wears <strong class="text-text">{worn()}</strong>{" "}
        — switch the header deck and everything below re-resolves.
      </p>

      <Section id="pipeline" title="Document → deck">
        <p>
          A theme document states tokens (colors, scales, character), the modes
          it answers to, and the faces it loads. The pipeline parses it,
          validates it against the legibility floor — no fill sells without a
          readable foreground — and emits the sheet: variables scoped by{" "}
          <code class="font-mono">data-theme</code>, mode restatements scoped by
          {" "}
          <code class="font-mono">data-mode</code>, and font preflights that
          load only what the deck promises.
        </p>
        <p class="mt-2">
          The property name is the token's identity:{" "}
          <code class="font-mono">color.semantic.error</code> and{" "}
          <code class="font-mono">color-semantic-error</code>{" "}
          are the same thread, spelled two ways. Dotted or dashed, the CSS
          variable is{" "}
          <code class="font-mono">--color-semantic-error</code>, and nothing
          else.
        </p>
      </Section>

      <Section id="palette" title="The palette, live">
        <p>
          Each row is a token. The left chip is this page's rendering, in the
          mode the page wears right now. The right chip renders inside a probe
          that has re-declared the deck for{" "}
          <em class="text-text">{otherMode()}</em>{" "}
          — the deck's other rendering, by the same CSS. Values shown are what
          the DOCUMENT states: references ({"{"}color.neutral.50{"}"}-style)
          name their thread instead of restating a hex.
        </p>
        <div class="mt-5 grid gap-x-10 gap-y-7 md:grid-cols-2">
          <div>
            <p class="m-0 mb-3 text-sm font-semibold text-text">
              page and separates
            </p>
            <div class="grid gap-1.5">
              <For
                each={[
                  "surface",
                  "surface-sunken",
                  "surface-raised",
                  "text",
                  "text-muted",
                  "border",
                  "border-strong",
                  "field",
                ]}
              >
                {(name) => <SwatchToken name={name} doc={doc()} />}
              </For>
            </div>
          </div>
          <div>
            <p class="m-0 mb-3 text-sm font-semibold text-text">the red</p>
            <div class="grid gap-1.5">
              <For
                each={[
                  "primary",
                  "on-primary",
                  "secondary",
                  "on-secondary",
                  "accent",
                  "on-accent",
                  "link",
                  "focus-ring",
                ]}
              >
                {(name) => <SwatchToken name={name} doc={doc()} />}
              </For>
            </div>
          </div>
        </div>
      </Section>

      <Section id="ink" title="Paper and ink, side by side">
        <p>
          The same worn-deck swatches, rendered under a subtree that has
          re-declared{" "}
          <code class="font-mono">data-mode="…"</code>. Decks with two modes
          (this one) show the other rendering; decks with one show the truth of
          one.
        </p>
        <div class="mt-4 border border-border rounded-md bg-surface-raised p-4">
          <Probe>
            <div class="grid gap-1.5">
              <For
                each={[
                  "primary",
                  "surface",
                  "text",
                  "text-muted",
                  "border",
                  "semantic-error",
                ]}
              >
                {(name) => <SwatchToken name={name} doc={doc()} />}
              </For>
            </div>
          </Probe>
        </div>
      </Section>

      <Section id="character" title="Where the starters disagree">
        <p>
          Four decks, four opinions — read straight out of each document, so the
          table follows them wherever they change their minds.
        </p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4 font-semibold text-text">decision</th>
                <For each={starterList}>
                  {(name) => (
                    <th class="py-2 pr-4 font-mono text-xs">
                      {name}
                    </th>
                  )}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={CHARACTER_ROWS}>
                {(row) => (
                  <tr class="border-b border-border">
                    <td class="py-1.5 pr-4 text-text-muted">{row.label}</td>
                    <For each={starterList}>
                      {(name) => (
                        <td
                          class={`py-1.5 pr-4 font-mono text-xs break-all ${
                            theme() === name ? "text-text font-semibold" : ""
                          }`}
                        >
                          {row.read(
                            starterThemes[
                              name as keyof typeof starterThemes
                            ] as unknown as Record<string, unknown>,
                          )}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="fonts" title="Faces">
        <p>
          A deck declares the faces it loads (<code class="font-mono">
            $extensions.spin.fonts
          </code>), and nothing else is fetched. The didone this page's headings
          speak is{" "}
          {stated(doc(), "font.family.heading").split(",")[0]}, declared by{" "}
          {worn()}; ink or paper, they are the same face — the mode changes the
          sheet, not the voice.
        </p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <For each={Object.keys(doc().font as Record<string, unknown>)}>
            {(group) => <Chip>{`font.${group}`}</Chip>}
          </For>
        </div>
      </Section>
    </main>
  );
}

/** A single swatch token: chip (worn rendering) + authored values. */
function SwatchToken(props: { name: string; doc: unknown }): JSX.Element {
  const d = props.doc as Cell;
  const color = (d["color"] ?? {}) as Cell;
  const token = (color[props.name] ?? {}) as Cell;
  const base = String(token["$value"] ?? "—");
  const ink = String(
    (token["modes"] as Cell | undefined)?.["dark"] ?? "",
  );
  const value = ink ? `${base}  ·  ink ${ink}` : base;
  return (
    <div class="flex items-center gap-2.5">
      <div
        class={`h-7 w-12 shrink-0 rounded-sm border border-border-strong bg-${props.name}`}
      />
      <div class="min-w-0 text-sm">
        <span class="font-mono text-xs text-text">{props.name}</span>
        <span class="ml-2 font-mono text-xs text-text-muted break-all">
          {value}
        </span>
      </div>
    </div>
  );
}

const CHARACTER_ROWS: readonly {
  label: string;
  read: (doc: unknown) => string;
}[] = [
  { label: "button case", read: (d) => stated(d, "button.case") },
  { label: "button tracking", read: (d) => stated(d, "button.tracking") },
  { label: "badge pill", read: (d) => stated(d, "badge.pill") },
  { label: "checkbox depth", read: (d) => stated(d, "checkbox.depth") },
  { label: "radius md", read: (d) => stated(d, "radius.md") },
  { label: "motion base", read: (d) => stated(d, "motion.duration.base") },
  { label: "heading face", read: (d) => stated(d, "font.family.heading") },
];
