/**
 * The font picker — a face, chosen from the catalogue.
 *
 * The studio used to offer a text input containing a CSS stack, which is
 * output rather than a decision: you could type `red` into it and nothing
 * would tell you that is not a font. This asks fontsource what exists,
 * lists the matching families, and stores the one you pick as a face the
 * build can install.
 */

import { createResource, createSignal, For, Show } from "solid-js";
import { type CatalogFont, searchCatalog } from "../lib/fonts.ts";

/** Every family the catalogue has, fetched once. */
function useCatalog() {
  const [fonts] = createResource(async () => {
    const client = await (await import("../lib/client.ts")).spinClient();
    const listed = await client.fonts.catalog({});
    return listed.map((entry: CatalogFont) => ({
      id: entry.id,
      family: entry.family,
      subsets: entry.subsets,
      weights: entry.weights,
      styles: entry.styles,
      variable: entry.variable,
      category: entry.category,
    })) satisfies CatalogFont[];
  });
  return fonts;
}

export default function FontPicker(props: {
  /** The slot being edited — `heading`, `body`, `serif`, `mono`. */
  slot: string;
  /** The face currently assigned, if any. */
  value: string;
  /** Called with the chosen face's stack, ready to store as a token. */
  onPick: (stack: string, face: string) => void;
}) {
  const fonts = useCatalog();
  const [query, setQuery] = createSignal("");
  // Closed until the field is used. An always-open list over the page it sits
  // on is a wall, and it covers the very specimens the user is judging.
  const [open, setOpen] = createSignal(false);

  const matches = () => searchCatalog(fonts() ?? [], query(), 24);

  return (
    <div class="stack-sm">
      <div class="row-sm">
        <input
          type="search"
          placeholder="Search 2,103 families…"
          value={query()}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A deferred close: the click that would choose a family has to
          // land before the field loses focus, and an immediate close eats it.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </div>
      <Show when={open()}>
        <Show
          when={fonts() !== undefined}
          fallback={<p class="text-sm text-text-muted">loading catalogue…</p>}
        >
          <div class="absolute inset-x-0 top-1 z-10 max-h-[14rem] overflow-y-auto rounded-md border border-border bg-surface-raised p-2 shadow-lg">
            <div class="flex flex-wrap gap-2">
              <For each={matches()}>
                {(font) => (
                  <button
                    type="button"
                    classList={{
                      "border-primary text-text": props.value.includes(
                        font.family,
                      ),
                      "border-border text-text-muted": !props.value.includes(
                        font.family,
                      ),
                    }}
                    class="secondary s-sm text-left hover:border-primary"
                    onClick={() =>
                      props.onPick(
                        `"${font.family}", ${
                          font.category.includes("serif")
                            ? "Georgia, serif"
                            : font.category.includes("mono")
                            ? "ui-monospace, monospace"
                            : "ui-sans-serif, system-ui, sans-serif"
                        }`,
                        font.id,
                      )}
                  >
                    <span class="flex flex-col items-start">
                      <strong
                        class="text-sm"
                        style={{ "font-family": `"${font.family}"` }}
                      >
                        {font.family}
                      </strong>
                      <span class="text-xs">
                        {font.variable
                          ? `variable · ${font.weights.length} weights`
                          : font.weights.join(" ")}
                      </span>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
