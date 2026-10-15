import { createMemo, createResource, For, Show } from "solid-js";
import Sample from "../components/demos/Sample";
import { catalogSections } from "../lib/catalog";
import { cssDeclarations, previewCssSafely } from "../lib/preview";
import { analyzeTheme } from "../lib/theme";
import { activeName, themeText } from "../lib/store";
import { createSignal } from "solid-js";

export default function UtilitiesPage() {
  const [query, setQuery] = createSignal("");
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const matches = createMemo(() => {
    const current = tree();
    if (!current) return [];
    const q = query().trim();
    return catalogSections(current)
      .flatMap((section) =>
        section.utilities.map((utility) => ({ section: section.id, utility }))
      )
      .filter(({ utility }) => utility.includes(q));
  });
  const [css] = createResource(
    () => ({ text: themeText(), name: activeName() }),
    ({ text }) => previewCssSafely(text, activeName()),
  );
  const decls = createMemo(() => {
    const rendered = css();
    if (rendered === undefined || typeof rendered !== "string") {
      return new Map<string, string>();
    }
    return cssDeclarations(
      rendered,
      matches().map(({ utility }) => utility),
    );
  });

  return (
    <div class="drawer-scroll flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Utilities</h1>
      <p>Search every generated utility against the active theme.</p>
      <input
        class="text-sm p-2 border border-border rounded-md"
        type="search"
        placeholder="bg-"
        value={query()}
        onInput={(event) => setQuery(event.currentTarget.value)}
      />
      <Show when={css.loading}>
        <span>rendering…</span>
      </Show>
      <div class="flex flex-wrap gap-4">
        <For each={matches().slice(0, 120)}>
          {({ section, utility }) => (
            <div class="bg-surface-raised rounded-lg shadow-sm p-4 border border-border">
              <Sample section={section} utility={utility} />
              <code>{utility}</code>
              <code>
                {decls().get(utility) ?? ""}
              </code>
            </div>
          )}
        </For>
      </div>
      <Show when={matches().length > 120}>
        <p>Showing 120 of {matches().length} matches. Keep typing.</p>
      </Show>
    </div>
  );
}
