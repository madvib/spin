import { createMemo, createSignal, For } from "solid-js";
import { generateScale } from "@spin/theme";
import { inDrawer } from "../app.tsx";
import { analyzeTheme } from "../lib/theme.ts";
import { groupTokens, type TokenRow } from "../lib/tokens.ts";
import { activeMode, themeText } from "../lib/store.ts";
import { editToken } from "../lib/editing.ts";

/**
 * Colors — every color token, grouped by family, edited beside its swatch.
 *
 * One card per token was a list of disconnected swatches: a big rounded
 * chip, a name, a hex field, repeated thirty times with no family in sight.
 * A color page is a palette first — the families read as rows of swatches,
 * and the selected swatch expands its editor inline. The swatch IS the
 * control's label: click it to edit, see the value move in place.
 */

/**
 * `color.neutral.50` → `neutral`, the family the palette groups by.
 * Singletons (primary, accent, link) are accents, not an "other" drawer:
 * a family of one is a name for a color with no relatives, and the palette
 * reads better with them together than scattered under a junk heading.
 */
function familyOf(path: string): string {
  const segments = path.split(".").slice(1);
  if (segments.length > 1) {
    const [head] = segments;
    // surface-*, text-*, on-* and border stay out: they are roles, and their
    // families are the surfaces and the text pages' problem.
    if (head === "neutral" || head === "semantic") return head;
  }
  return "accents";
}

/** One swatch: the color itself, opening its picker in place. */
function Swatch(props: { row: TokenRow }) {
  const id = `token-${props.row.path}`;
  return (
    <div class="stack-sm">
      {
        /*
        The swatch is a label for a color input: one click opens the native
        picker, and the commit writes the token. No intermediate drawer, no
        second tiny color well — picking IS the action, and the token name
        rides as the tooltip because the only thing a swatch needs named is
        itself on hover.
      */
      }
      <label
        class="block h-12 w-full cursor-pointer rounded-md border border-border shrink-0"
        style={{ background: `var(${props.row.variable})` }}
        title={props.row.path}
      >
        <span class="sr-only">{props.row.path}</span>
        <input
          id={id}
          type="color"
          class="sr-only"
          value={props.row.value}
          onChange={(event) =>
            editToken(props.row.path.split("."), event.currentTarget.value)}
        />
      </label>
      <span class="truncate text-center text-xs text-text-muted">
        {props.row.path.split(".").pop()}
      </span>
    </div>
  );
}

export default function ColorsPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const families = createMemo(() => {
    const current = tree();
    if (!current) return [];
    const rows = groupTokens(current, [["color"]], activeMode());
    const byFamily = new Map<string, TokenRow[]>();
    for (const row of rows) {
      const family = familyOf(row.path);
      const list = byFamily.get(family) ?? [];
      list.push(row);
      byFamily.set(family, list);
    }
    return [...byFamily.entries()];
  });

  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Colors</h1>
      <p>Every color token. Editing writes to the active mode.</p>
      <For each={families()}>
        {([family, rows]) => (
          <section class="stack-sm mb-6">
            <h2 class="text-xl capitalize">{family}</h2>
            <div
              class="grid gap-3"
              classList={{
                "grid-cols-3": inDrawer(),
                "grid-cols-4": !inDrawer(),
                "sm:grid-cols-6": !inDrawer(),
                "lg:grid-cols-8": !inDrawer(),
              }}
            >
              <For each={rows}>
                {(row) => <Swatch row={row} />}
              </For>
            </div>
          </section>
        )}
      </For>
      <RampBuilder />
    </div>
  );
}

/**
 * A ramp from a base: the theme's own scale generator, exposed.
 *
 * Picking thirty colors by hand produces thirty unrelated colors. The theme
 * builds ramps from a base hue in OKLab, so the page offers the same
 * operation: choose a base, see the eleven steps, apply them into the
 * neutral family. The generator is the theme's, not the page's — the page
 * names a base and spends what comes back.
 */
function RampBuilder() {
  const [base, setBase] = createSignal("#7c2d12");
  const steps = createMemo(() => {
    try {
      return generateScale(base(), 11);
    } catch {
      return [];
    }
  });
  return (
    <section class="stack-sm mb-6">
      <h2 class="text-xl">Ramp</h2>
      <p class="text-sm text-text-muted">
        Eleven steps from black to white in the base's hue. Apply writes them
        into <code>color.neutral.*</code>.
      </p>
      <div class="row-sm">
        <label for="ramp-base">Base</label>
        <input
          id="ramp-base"
          type="color"
          value={base()}
          onInput={(event) => setBase(event.currentTarget.value)}
        />
        <button
          type="button"
          onClick={() => {
            const scale = steps();
            const names = [
              "50",
              "100",
              "200",
              "300",
              "400",
              "500",
              "600",
              "700",
              "800",
              "900",
              "950",
            ];
            scale.forEach((hex, i) => {
              if (names[i] !== undefined) {
                editToken(["color", "neutral", names[i]], hex);
              }
            });
          }}
        >
          Apply to neutral
        </button>
      </div>
      <div class="flex gap-1">
        <For each={steps()}>
          {(hex) => (
            <div
              class="h-10 flex-1 rounded-sm border border-border"
              style={{ background: hex }}
              title={hex}
            />
          )}
        </For>
      </div>
    </section>
  );
}
