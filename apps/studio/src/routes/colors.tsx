import { createMemo, createSignal, For, Show } from "solid-js";
import { BASE_ROLES, generateScale, valuesInMode } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { inDrawer } from "../app.tsx";
import { analyzeTheme } from "../lib/theme.ts";
import { groupTokens, type TokenRow } from "../lib/tokens.ts";
import { activeMode, activeModes, themeText } from "../lib/store.ts";
import { editToken } from "../lib/editing.ts";
import Page from "../components/Page";
import { tokenValue } from "../lib/overview.ts";

/**
 * Colors — every color token, grouped by family, edited beside its swatch.
 *
 * One card per token was a list of disconnected swatches: a big rounded
 * chip, a name, a hex field, repeated thirty times with no family in sight.
 * A color page is a palette first — the families read as rows of swatches,
 * and the selected swatch expands its editor inline. The swatch IS the
 * control's label: click it to edit, see the value move in place.
 *
 * Both modes are on the page at once, because a preview stands in one mode
 * at a time and dark overrides are invisible until you switch into them.
 * Each slot writes where it sits: light the token's own `$value`, dark its
 * `$modes.dark` — and a dark slot saying what the light slot says is a slot
 * with nothing to say, so it drops out of the document.
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
/**
 * The roles the contract knows.
 *
 * The theme package's role declaration is the one list of them: a colour the
 * contract names as a role is a job. The page reads that list rather than
 * keeping its own, so a role added to the contract lands here without this
 * page learning its name — the dead pair among them.
 */
const CONTRACT_ROLES = new Set(
  BASE_ROLES
    .map((role) => role.path)
    .filter((path) => path.startsWith("color."))
    .map((path) => path.slice("color.".length)),
);

/**
 * The families a theme names its own roles by.
 *
 * Shapes rather than names: the surface, text and border families, the inks
 * (`on-`) and the focus ring.
 */
const ROLE_PREFIXES = ["surface-", "text-", "border-", "on-", "focus-"];

/**
 * The palette's own accents: the fills a theme PICKS.
 *
 * The contract names them as roles, and they are not jobs — a theme chooses
 * its brand colours the way it chooses a hue — so they stay in the swatch
 * grid, where the studio can pick them.
 */
const PICKS = new Set(["primary", "secondary", "accent"]);

function familyOf(path: string): string {
  const leaf = path.split(".").slice(1).join(".");
  if (leaf === "neutral" || leaf.startsWith("neutral.")) return "neutral";
  if (leaf === "semantic" || leaf.startsWith("semantic.")) return "semantic";
  if (isRole(leaf)) return "roles";
  return "accents";
}

/** True when a colour name is a job rather than a colour to pick. */
function isRole(leaf: string): boolean {
  if (ROLE_PREFIXES.some((prefix) => leaf.startsWith(prefix))) return true;
  return CONTRACT_ROLES.has(leaf) && !PICKS.has(leaf);
}

/** Where a slot's commit lands: the token's own value, or the dark one. */
function commitSlot(mode: string): "base" | "dark" {
  return mode === "dark" ? "dark" : "base";
}

/** What a token is worth in a mode, references followed. */
function valueIn(tree: TokenTree | undefined, mode: string, path: string) {
  return tree === undefined ? undefined : tokenValue(tree, mode, path);
}

/** A slot's chip: the color this mode actually renders, as data. */
function ModeChip(props: { path: string; mode: string }) {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  return (
    <span
      class="h-8 w-12 shrink-0 rounded-sm border border-border"
      // The active mode's variable would resolve both chips to the one mode
      // being previewed; each chip is its own mode's answer, drawn from the
      // document. A value the document cannot resolve paints nothing.
      style={{ background: valueIn(tree(), props.mode, props.path) ?? "" }}
      title={`${props.path} · ${props.mode}`}
      aria-hidden="true"
    />
  );
}

/**
 * One hue: its slots side by side, light first.
 *
 * Light stays the swatch's first input, so the first colour the page offers * is the token's own `$value` — the one an oracle or a script reaches for
 * without naming a mode.
 */
function Swatch(props: { row: TokenRow }) {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
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
      <div class="flex h-12 gap-1">
        <For each={activeModes()}>
          {(mode) => {
            const value = () =>
              valueIn(tree(), mode, props.row.path) ?? props.row.value;
            return (
              <label
                class="block h-12 flex-1 cursor-pointer rounded-md border border-border shrink-0"
                style={{ background: value() }}
                title={`${props.row.path} · ${mode}`}
              >
                <span class="visually-hidden">
                  {props.row.path} in {mode}
                </span>
                <input
                  id={`token-${props.row.path}-${mode}`}
                  type="color"
                  class="visually-hidden"
                  value={value()}
                  onChange={(event) =>
                    editToken(
                      props.row.path.split("."),
                      event.currentTarget.value,
                      commitSlot(mode),
                    )}
                />
              </label>
            );
          }}
        </For>
      </div>
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
    <Page
      title="Colors"
      note="What exists, then what it is for."
    >
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
    </Page>
  );
}

/**
 * One role: the job named, then a line per mode — that mode's resolved
 * color as a chip, and the hue list its reference points at. A dark role
 * often points somewhere else entirely (surface on the dark surface, on-*
 * flipped onto light ink), so both references are the role's value and both
 * edit here. No hex field — a role holds a reference, and the control makes
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
  /** This mode's authored value: the reference as written, or a raw color. */
  function raw(mode: string): string | null {
    const current = tree();
    if (!current) return null;
    const value = valuesInMode(current, mode).get(props.row.path);
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : null;
  }
  const target = (mode: string) => raw(mode)?.match(/^\{(.+)\}$/)?.[1] ?? null;
  return (
    <div class="stack-sm rounded-md border border-border p-2">
      <span class="truncate font-medium">
        {props.row.path.split(".").slice(1).join(" ")}
      </span>
      <For each={activeModes()}>
        {(mode) => (
          <div class="row-sm">
            <ModeChip path={props.row.path} mode={mode} />
            <span class="w-10 shrink-0 text-xs text-text-muted">{mode}</span>
            <select
              class="min-w-0 flex-1"
              aria-label={`${props.row.path} points at in ${mode}`}
              value={target(mode) ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.value;
                if (next) {
                  editToken(
                    props.row.path.split("."),
                    `{${next}}`,
                    commitSlot(mode),
                  );
                }
              }}
            >
              <Show when={target(mode) === null}>
                <option value="">a raw value — pick a hue to reference</option>
              </Show>
              <For each={hues()}>
                {(hue) => (
                  <option value={hue.path}>
                    {hue.path.split(".").slice(1).join(" ")}
                  </option>
                )}
              </For>
            </select>
          </div>
        )}
      </For>
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
