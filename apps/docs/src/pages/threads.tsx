/**
 * Threads: the token system, shown live.
 *
 * Every swatch chip is a theme utility (`bg-surface`, `bg-primary`, …) —
 * the same class the product spends, resolved by the sheet for the theme
 * the page renders with. The mode column sits in a probe subtree that
 * re-declares
 * `data-theme` and `data-mode`, so both renderings of a token hang side by
 * side, resolved by the CSS, not by JS. The character table reads the
 * starter documents and shows exactly where they disagree.
 */
import { createMemo, For } from "solid-js";
import type { JSX } from "solid-js";
import { starterThemes } from "@spin/theme/themes";
import { mode, starterList, theme } from "../shell.tsx";
import { Chip, Probe, Section, starterDoc } from "../bits.tsx";

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

/** The other mode of the active theme, if it has one. */
const otherMode = () => (mode() === "dark" ? "light" : "dark");

export default function Threads(): JSX.Element {
  const doc = createMemo(() => starterDoc());
  const active = theme;
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1 class="text-2xl tracking-tight">Threads</h1>
      <p class="text-text-muted max-w-screen-md mt-1">
        Watch your theme work. Every swatch below is a real utility class,
        painted by the active theme (<strong class="text-text">
          {active()}
        </strong>
        ). Flip light and dark in the rail — the sheet re-resolves in front of
        you.
      </p>

      <Section id="pipeline" title="Document → sheet">
        <p>
          A theme document states tokens (colors, scales, character), the modes
          it answers to, and the faces it loads. The pipeline parses it,
          validates it against the legibility floor — no fill sells without a
          readable foreground — and emits the sheet: variables scoped by{" "}
          <code class="font-mono">data-theme</code>, mode restatements scoped by
          {" "}
          <code class="font-mono">data-mode</code>, and font preflights that
          load only what the theme promises.
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
          active mode. The right chip renders inside a probe that has
          re-declared the theme as <em class="text-text">{otherMode()}</em>{" "}
          — the theme's other rendering, by the same CSS. Values shown are what
          the DOCUMENT states: references ({"{"}color.neutral.50{"}"}-style)
          name their thread instead of restating a hex.
        </p>
        <div class="mt-5 grid gap-x-10 gap-y-7 md:grid-cols-2">
          <div>
            <p class="m-0 mb-3 text-sm font-semibold text-text">
              the page
            </p>
            <div class="grid gap-2">
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
            <Probe>
              <div class="grid gap-2">
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
            </Probe>
          </div>
        </div>
      </Section>

      <Section id="modes" title="Light and dark, side by side">
        <p>
          The same swatches, rendered under a subtree that has re-declared{" "}
          <code class="font-mono">data-mode="…"</code>. Themes with two modes
          (this one) show the other rendering; themes with one show the truth of
          one.
        </p>
        <div class="mt-4 border border-border rounded-md bg-surface-raised p-4">
          <Probe>
            <div class="grid gap-2">
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
          Every starter, read straight out of its own document.
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
                    <td class="py-2 pr-4 text-text-muted">{row.label}</td>
                    <For each={starterList}>
                      {(name) => (
                        <td
                          class={`py-2 pr-4 font-mono text-xs break-all ${
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
          A theme declares the faces it loads (<code class="font-mono">
            $extensions.spin.fonts
          </code>), and nothing else is fetched. The didone this page's headings
          speak is{" "}
          {stated(doc(), "font.family.heading").split(",")[0]}, declared by{" "}
          {active()}; light or dark, they are the same face — the mode changes
          the sheet, not the voice.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={Object.keys(doc().font as Record<string, unknown>)}>
            {(group) => <Chip>{`font.${group}`}</Chip>}
          </For>
        </div>
        <p class="mt-3 mb-0">
          The faces <code class="font-mono">{active()}</code>{" "}
          declares — the load manifest the sheet turns into{" "}
          <code class="font-mono">@font-face</code>{" "}
          rules, so a theme owns its own voices and fetches nothing beyond them:
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={faces(doc())}>
            {(face) => (
              <Chip>
                {face.family}
                {face.weight
                  ? (
                    <span class="text-text-muted">
                      {` · ${face.weight.replace(" ", "–")}`}
                    </span>
                  )
                  : null}
              </Chip>
            )}
          </For>
        </div>
      </Section>
    </main>
  );
}

/** The theme's load manifest: the faces declared under `$extensions.spin.fonts`. */
function faces(
  doc: unknown,
): readonly { family: string; weight?: string }[] {
  const extensions = (doc as Cell)?.$extensions as Cell | undefined;
  const fonts = (extensions?.spin as Cell | undefined)?.fonts;
  return Array.isArray(fonts)
    ? fonts as { family: string; weight?: string }[]
    : [];
}

/** A single swatch token: chip (the active rendering) + authored values. */
function SwatchToken(props: { name: string; doc: unknown }): JSX.Element {
  const d = props.doc as Cell;
  const color = (d["color"] ?? {}) as Cell;
  const token = (color[props.name] ?? {}) as Cell;
  const base = String(token["$value"] ?? "—");
  const dark = String(
    (token["modes"] as Cell | undefined)?.["dark"] ?? "",
  );
  const value = dark ? `${base}  ·  dark ${dark}` : base;
  return (
    <div class="flex items-center gap-3">
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
