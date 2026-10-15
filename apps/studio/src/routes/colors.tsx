import { createMemo, createSignal, For } from "solid-js";
import { inDrawer } from "../app.tsx";
import ValueInput from "../components/demos/ValueInput.tsx";
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

/** One swatch: the color, selected to edit, edited in place. */
function Swatch(props: {
  row: TokenRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const id = `token-${props.row.path}`;
  return (
    <div class="stack-sm">
      <button
        type="button"
        class={`h-12 w-full rounded-md border shrink-0 ${
          props.selected ? "border-focus-ring" : "border-border"
        }`}
        style={{ background: `var(${props.row.variable})` }}
        aria-label={props.row.path}
        aria-pressed={props.selected}
        title={props.row.path}
        onClick={props.onSelect}
      />
      <span class="truncate text-center text-xs text-text-muted">
        {props.row.path.split(".").pop()}
      </span>
      {props.selected && (
        <div class="stack-sm rounded-md border border-border bg-surface p-2">
          <code class="text-xs">{props.row.path}</code>
          <ValueInput
            id={id}
            value={props.row.value}
            type={props.row.type}
            onCommit={(value) => editToken(props.row.path.split("."), value)}
          />
        </div>
      )}
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
  const [selectedPath, setSelectedPath] = createSignal<string | undefined>(
    undefined,
  );

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
                {(row) => (
                  <Swatch
                    row={row}
                    selected={selectedPath() === row.path}
                    onSelect={() =>
                      setSelectedPath(
                        selectedPath() === row.path ? undefined : row.path,
                      )}
                  />
                )}
              </For>
            </div>
          </section>
        )}
      </For>
    </div>
  );
}
