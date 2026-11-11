/** Type faces — the faces a theme loads, and the stack each family reads. */

import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { FamilyField, firstFamily } from "../../components/FamilyField.tsx";
import { tokenStatus } from "../../lib/live-edit.ts";
import { activeMode, activeName, noteRefusal, registry, themeText } from "../../lib/store.ts";
import { editFontFamily } from "../../lib/editing.ts";
import { fontDeclarationFor, injectFontFaces, type CatalogFont } from "../../lib/fonts.ts";
import { spinClient } from "../../lib/client.ts";
import StudioSelect from "../../components/StudioSelect.tsx";
import {
  Badge,
  ConcernPage,
  Frame,
  Section,
  TokenLine,
} from "../../components/Concern.tsx";
import { declaredFaces, familyRows, loadedFamilies, SYSTEM_STACKS } from "./type-shared.ts";

export default function TypeFacesPage() {
  return (
    <ConcernPage title="Type">
      <Section
        title="Faces"
        fact={`${declaredFaces().length} faces`}
        info="The faces the theme loads, and the stack each family reads. Pick a webfont into the library or use system fonts."
      >
        <Show
          when={declaredFaces().length > 0}
          fallback={
            <p>
              This theme declares no faces yet.
            </p>
          }
        >
          <ul class="stack-sm">
            <For each={declaredFaces()}>
              {(slot) => <FacePickerRow slot={slot} />}
            </For>
          </ul>
        </Show>
        <FontDiscovery />
      </Section>
    </ConcernPage>
  );
}

/** One family as a picker row: the stack it reads, edited in place. */
function FacePickerRow(props: { slot: string }) {
  const rows = createMemo(familyRows);
  const row = () =>
    rows().find((entry) => entry.path === `font.family.${props.slot}`);
  const family = () => firstFamily(row()?.value ?? "");
  const loaded = () => loadedFamilies();
  const status = createMemo(() =>
    tokenStatus(
      themeText(),
      registry()?.find((t) => t.name === activeName())?.text,
      `font.family.${props.slot}`,
      activeMode(),
    )
  );
  return (
    <TokenLine
      path={`font.family.${props.slot}`}
      specimen={
        <span
          data-studio-specimen=""
          class="min-w-0 flex-1 truncate px-2 type-title"
          style={row() ? { "font-family": `var(${row()!.variable})` } : undefined}
        >
          AaBbCc 0123
        </span>
      }
      editor={
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <Show when={status().aliasOf}>
            {(target) => (
              <span
                class="rounded-sm bg-surface-sunken px-1 py-1 type-code text-muted"
                title={`Points at ${target()}`}
              >
                → {target().split(".").pop() ?? target()}
              </span>
            )}
          </Show>
          <Badge tone={loaded().includes(family()) ? "primary" : "info"}>
            {loaded().includes(family()) ? "webfont" : "system fonts"}
          </Badge>
          <div class="min-w-0 flex-1">
            <FamilyField
              value={row()?.value ?? ""}
              label={`font.family.${props.slot}`}
              onCommit={(stack, font) =>
                editFontFamily(["font", "family", props.slot], stack, font)}
            />
            <Show when={status().aliasOf}>
              <span class="block truncate type-caption text-muted" title={row()?.value ?? ""}>
                {row()?.value ?? ""}
              </span>
            </Show>
          </div>
        </div>
      }
    />
  );
}

/** Font discovery: webfonts from the catalogue plus system fonts, selected into the library. */
function FontDiscovery() {
  const [query, setQuery] = createSignal("");
  const [picked, setPicked] = createSignal<CatalogFont | undefined>(undefined);
  const [stack, setStack] = createSignal(SYSTEM_STACKS[0]!.stack);
  const [matches] = createResource(query, async (needle) => {
    if (needle.trim() === "") return [];
    const client = await spinClient();
    const listed = await client.fonts.catalog({ query: needle });
    const fonts = listed as readonly CatalogFont[];
    injectFontFaces(fonts.map((font) => fontDeclarationFor(font)));
    return fonts.slice(0, 8);
  });
  const selectIntoLibrary = (font: CatalogFont): void => {
    const declaration = fontDeclarationFor(font);
    injectFontFaces([declaration]);
    setPicked(font);
  };
  const commitLibraryPick = (): boolean => {
    const font = picked();
    if (font === undefined) {
      noteRefusal("Pick a webfont from the discovery list first.");
      return false;
    }
    return editFontFamily(
      ["font", "family", "sans"],
      `"${font.family}", ui-sans-serif, system-ui, sans-serif`,
      fontDeclarationFor(font),
    );
  };
  return (
    <Frame class="stack-sm">
      <div class="flex flex-nowrap items-center gap-2">
        <label class="flex flex-row flex-nowrap items-center gap-2">
          Discover
          <input
            type="text"
            class="w-36"
            placeholder="Inter, Fraunces, JetBrains Mono"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            aria-label="Discover webfonts by name"
          />
        </label>
        <Show when={matches.loading}>
          <span>Searching…</span>
        </Show>
      </div>
      <Show when={(matches() ?? []).length > 0}>
        <ul class="stack-xs">
          <For each={matches() ?? []}>
            {(font) => (
              <li class="row-sm flex-wrap">
                <button
                  type="button"
                  class="secondary s-sm"
                  aria-pressed={picked()?.id === font.id}
                  onClick={() => selectIntoLibrary(font)}
                >
                  {font.family}
                </button>
                <span>{font.category}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <div class="stack-sm border-t pt-3">
        <span class="flex flex-nowrap items-center gap-2">
          System fonts
          <StudioSelect
            label="System fonts for a family kept local"
            value={stack()}
            items={SYSTEM_STACKS.map((entry) => ({ value: entry.stack, label: entry.label }))}
            onPick={(value) => setStack(value)}
          />
        </span>
        <div class="row-sm flex-wrap">
          <button
            type="button"
            class="secondary s-sm"
            onClick={() => editFontFamily(["font", "family", "sans"], stack())}
          >
            Use system fonts
          </button>
          <Show when={picked()}>
            {(font) => (
              <button
                type="button"
                class="secondary s-sm"
                onClick={commitLibraryPick}
              >
                Select {font().family} into the library
              </button>
            )}
          </Show>
        </div>
      </div>
    </Frame>
  );
}
