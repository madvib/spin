import { createMemo, createSignal, For, Show } from "solid-js";
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
/**
 * Hues group by family; roles group by job. A role is a reference to a hue,
 * not a color to pick, so surface/text/border/on-* read as one Roles family
 * with reference pickers, not swatches mixed into the hues.
 */
const ROLE_EXACT = new Set(["surface", "text", "border", "link", "field"]);
const ROLE_PREFIXES = ["surface-", "text-", "border-", "on-", "focus-"];
function familyOf(path: string): string {
  const leaf = path.split(".").slice(1).join(".");
  if (leaf === "neutral" || leaf.startsWith("neutral.")) return "neutral";
  if (leaf === "semantic" || leaf.startsWith("semantic.")) return "semantic";
  if (ROLE_EXACT.has(leaf)) return "roles";
  if (ROLE_PREFIXES.some((prefix) => leaf.startsWith(prefix))) return "roles";
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
        <span class="visually-hidden">{props.row.path}</span>
        <input
          id={id}
          type="color"
          class="visually-hidden"
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
  const split = createMemo(() => {
    const current = tree();
    if (!current) return { hues: [], roles: [] };
    const rows = groupTokens(current, [["color"]], activeMode());
    const hues: TokenRow[] = [];
    const roles: TokenRow[] = [];
    for (const row of rows) {
      (familyOf(row.path) === "roles" ? roles : hues).push(row);
    }
    return { hues, roles };
  });

  return (
    <div class="drawer-scroll flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Colors</h1>
      <p>
        What exists, then what it is for. Editing writes to the active mode.
      </p>
      <section class="stack-sm mb-6" aria-label="Hues">
        <h2 class="text-xl">Hues</h2>
        <div
          class="grid gap-3"
          classList={{
            "grid-cols-3": inDrawer(),
            "grid-cols-4": !inDrawer(),
            "sm:grid-cols-6": !inDrawer(),
            "lg:grid-cols-8": !inDrawer(),
          }}
        >
          <For each={split().hues}>{(row) => <Swatch row={row} />}</For>
        </div>
      </section>
      <section class="stack-sm mb-6 max-w-screen-md" aria-label="Surfaces">
        <h2 class="text-xl">Surfaces</h2>
        <p class="text-sm text-text-muted">
          Each row points at a hue above — the reference is the value.
        </p>
        <For each={split().roles}>{(row) => <RoleRow row={row} />}</For>
      </section>
      <RampBuilder />
    </div>
  );
}

/**
 * One role: the job named, the current hue as a chip, the picker as a list
 * of hues. No hex field — a role holds a reference, and the control makes
 * anything else unrepresentable instead of validated.
 */
function RoleRow(props: { row: TokenRow }) {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const hues = createMemo(() => {
    const current = tree();
    if (!current) return [];
    return groupTokens(current, [["color"]], activeMode()).filter(
      (row) => familyOf(row.path) !== "roles",
    );
  });
  const target = () => props.row.value.match(/^\{(.+)\}$/)?.[1] ?? null;
  return (
    <div class="row-sm rounded-md border border-border p-2">
      <span
        class="h-8 w-12 shrink-0 rounded-sm border border-border"
        style={{ background: `var(${props.row.variable})` }}
        aria-hidden="true"
      />
      <span class="min-w-[8rem] flex-1 truncate font-medium">
        {props.row.path.split(".").slice(1).join(" ")}
      </span>
      <select
        class="min-w-0 flex-1"
        aria-label={`${props.row.path} points at`}
        value={target() ?? ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (next) editToken(props.row.path.split("."), `{${next}}`);
        }}
      >
        <Show when={target() === null}>
          <option value="">a raw value — pick a hue to reference</option>
        </Show>
        <For each={hues()}>
          {(hue) => (
            <option value={hue.path} selected={hue.path === target()}>
              {hue.path.split(".").slice(1).join(" ")}
            </option>
          )}
        </For>
      </select>
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
