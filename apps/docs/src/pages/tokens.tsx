/**
 * The token system, shown live.
 *
 * Every swatch chip is a theme utility (`bg-surface`, `bg-primary`, …) —
 * the same class the product spends, resolved by the sheet for the theme
 * the page renders with. The right column sits in a probe subtree that
 * re-declares `data-theme` and `data-mode`, so both renderings of a token
 * hang side by side, resolved by the CSS, not by JS.
 */
import { createMemo, For } from "solid-js";
import type { JSX } from "solid-js";
import { starterThemes } from "@spinjs/theme/themes";
import { mode, starterList, theme } from "@spinjs/kit";
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

/**
 * The colour roles the document declares, read from the colour group.
 *
 * A group holds the ramps (`neutral`, `semantic`); a token is a role — a
 * surface, an ink, a fill. The list is the theme's own, so a role a theme
 * declares shows up here without this page knowing its name.
 */
function colorRoles(doc: unknown): string[] {
  const color = leaf(doc, "color") as Cell | undefined;
  if (color === undefined) return [];
  const out: string[] = [];
  for (const [name, value] of Object.entries(color)) {
    if (name.startsWith("$")) continue;
    if (value === null || typeof value !== "object") continue;
    // A role states a value; a ramp holds more roles.
    if ("$value" in (value as Cell)) out.push(name);
  }
  return out;
}

/** The other mode of the active theme, if it has one. */
const otherMode = () => (mode() === "dark" ? "light" : "dark");

export default function Tokens(): JSX.Element {
  const doc = createMemo(() => starterDoc());
  const active = theme;
  return (
    <main class="mx-auto max-w-screen-lg px-6 py-10 md:py-16">
      <h1>Tokens</h1>

      <Section id="pipeline" title="Document → sheet">
        <p>
          A document parses, validates against the legibility floor — no fill
          without a readable foreground — and emits custom properties scoped by
          {" "}
          <code>data-theme</code>, restated per <code>data-mode</code>.{" "}
          <code>color.semantic.error</code> and{" "}
          <code>color-semantic-error</code> are the same token; the property is
          {" "}
          <code>--color-semantic-error</code>.
        </p>
      </Section>

      <Section id="palette" title="The palette, live">
        <div class="mt-5 grid gap-x-10 gap-y-7 md:grid-cols-2">
          <div>
            <p class="text-sm font-semibold text-text">
              {mode()}
            </p>
            <div class="grid gap-2 sm:grid-cols-2">
              <For each={colorRoles(doc())}>
                {(name) => <SwatchToken name={name} doc={doc()} />}
              </For>
            </div>
          </div>
          <div>
            <p class="text-sm font-semibold text-text">
              {otherMode()}
            </p>
            <Probe>
              <div class="grid gap-2 sm:grid-cols-2">
                <For each={colorRoles(doc())}>
                  {(name) => <SwatchToken name={name} doc={doc()} />}
                </For>
              </div>
            </Probe>
          </div>
        </div>
      </Section>

      <Section id="modes" title="The other mode, same markup">
        <div class="mt-4 border border-border rounded-md bg-surface-raised p-4">
          <Probe>
            <div class="grid gap-2 sm:grid-cols-2">
              <For each={colorRoles(doc())}>
                {(name) => <SwatchToken name={name} doc={doc()} />}
              </For>
            </div>
          </Probe>
        </div>
      </Section>

      <Section id="character" title="Where the starters disagree">
        <div class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">decision</th>
                <For each={starterList}>
                  {(name) => (
                    <th class="py-2 pr-4 font-mono">
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
                    <td class="text-text-muted">{row.label}</td>
                    <For each={starterList}>
                      {(name) => (
                        <td
                          class={`font-mono text-xs break-all ${
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
          The document declares the faces it loads — the sheet emits{" "}
          <code>@font-face</code> for them and fetches nothing else.{" "}
          <strong>{active()}</strong> loads:
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
    (token["$modes"] as Cell | undefined)?.["dark"] ?? "",
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
  { label: "motion loop", read: (d) => stated(d, "motion.duration.loop") },
  { label: "heading face", read: (d) => stated(d, "font.family.heading") },
  { label: "brand face", read: (d) => stated(d, "font.family.brand") },
];
