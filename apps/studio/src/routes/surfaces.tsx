import { createMemo, For, Show } from "solid-js";
import TokenGroupEditor from "../components/demos/TokenGroupEditor";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";

/**
 * The surfaces page.
 *
 * A border colour is a thing you see, so the page shows it: a filled bar
 * next to its row, a rounded square per radius step, a card lifted by each
 * shadow. The utilities a theme declares for these groups are named in the
 * catalog and rendered as a list, which reads as documentation and has to be
 * read back by hand to know what `rounded-lg` actually looks like.
 *
 * Each row carries the specimen beside the control, so changing a value
 * moves the thing being changed in the same glance. The rows are the same
 * `TokenRow` every other page edits, so there is one way to set a value.
 */

/** The radius group, read from the theme rather than listed by hand. */
const GROUPS: Array<{ title: string; blurb: string; groups: string[][] }> = [
  {
    title: "Radius",
    blurb: "A box's corners, from square to a pill.",
    groups: [["radius"]],
  },
  {
    title: "Elevation",
    blurb: "Shadows, and what each one lifts.",
    groups: [["shadow"]],
  },
  {
    title: "Layering",
    blurb: "Which wins when boxes overlap.",
    groups: [["z-index"]],
  },
];

export default function SurfacesPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const sections = createMemo(() => {
    const current = tree();
    if (!current) return [];
    return GROUPS.map((section) => ({
      ...section,
      rows: groupTokens(current, section.groups, activeMode()),
    })).filter((section) => section.rows.length > 0);
  });

  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0 stack">
      <div>
        <h1 class="text-2xl">Surfaces</h1>
        <p>
          Corners, edges, elevation, and layering of boxes in space. Each row
          shows what its value looks like beside the control that sets it.
        </p>
      </div>

      <For each={sections()}>
        {(section) => (
          <section class="stack-sm">
            <h2 class="text-xl">{section.title}</h2>
            <p class="text-text-muted">{section.blurb}</p>
            <Show
              when={section.title === "Radius"}
              fallback={
                <div class="panel">
                  <TokenGroupEditor tokens={section.rows} onEdit={editToken} />
                </div>
              }
            >
              {
                /*
                Radius is the one group where a row's value is visible as a
                shape, so the rows are squares that round by the value they
                set rather than a swatch beside a number.
              */
              }
              <div class="flex flex-wrap gap-4 p-4 panel">
                <For each={section.rows}>
                  {(row) => (
                    <div class="w-24 stack-sm">
                      <div
                        class="h-16 bg-surface-raised border-2 border-accent"
                        style={{ "border-radius": `var(${row.variable})` }}
                      />
                      <code class="text-xs">{row.path.split(".").pop()}</code>
                      <span class="text-xs text-text-muted">{row.value}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>
        )}
      </For>
    </div>
  );
}
