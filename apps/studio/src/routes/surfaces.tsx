import { createMemo, For } from "solid-js";
import Sample from "../components/demos/Sample";
import TokenGroupEditor from "../components/demos/TokenGroupEditor";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";
import { catalogSections } from "../lib/catalog";

export default function SurfacesPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const tokens = createMemo(() => {
    const current = tree();
    return current
      ? groupTokens(
        current,
        [["radius"], ["shadow"], ["z-index"]],
        activeMode(),
      )
      : [];
  });
  const demos = createMemo(() => {
    const current = tree();
    if (!current) return [];
    const byId = new Map(
      catalogSections(current).map((section) => [section.id, section]),
    );
    const pick = (id: string, match?: (u: string) => boolean) =>
      (byId.get(id)?.utilities ?? [])
        .filter((utility) => !match || match(utility))
        .map((utility) => ({ section: id, utility }));
    return [
      ...pick("radius"),
      ...pick("border"),
      ...pick("shadow"),
      ...pick("position", (utility) => utility.startsWith("z-")),
    ];
  });

  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Surfaces</h1>
      <p>Corners, edges, elevation, and layering of boxes in space.</p>
      <div class="flex flex-wrap gap-4">
        <For each={demos()}>
          {({ section, utility }) => (
            <div class="bg-surface-raised rounded-lg shadow-sm p-4 border border-border">
              <Sample section={section} utility={utility} />
              <code>{utility}</code>
            </div>
          )}
        </For>
      </div>
      <h2 class="text-xl">Tokens</h2>
      <TokenGroupEditor tokens={tokens()} onEdit={editToken} />
    </div>
  );
}
