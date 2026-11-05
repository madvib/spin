import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { analyzeTheme } from "../lib/theme.ts";
import { summarySwatches, surfaceSteps, tokenValue } from "../lib/overview.ts";
import type { Chip, SwatchGroup } from "../lib/overview.ts";
import { facesOf, injectFontFaces } from "../lib/fonts.ts";
import { PANGRAM } from "../lib/specimen-copy.ts";

export const ensureDraftFontStyles = injectFontFaces;
export { facesOf };

export function ThemePreview(props: { text: string; name: string; static?: boolean }) {
  const [mode, setMode] = createSignal("light");

  const state = createMemo(() => analyzeTheme(props.text));
  const groups = createMemo<readonly SwatchGroup[]>(() => summarySwatches(props.text));

  createEffect(() => {
    ensureDraftFontStyles(facesOf(props.text));
  });

  const activeGroup = createMemo<SwatchGroup | undefined>(() => {
    const gs = groups();
    if (gs.length === 0) return undefined;
    return gs.find((g) => g.mode === mode()) ?? gs[0];
  });

  const tree = createMemo(() => state().tree);
  const shownMode = createMemo(() => activeGroup()?.mode ?? "light");

  const token = (path: string): string | undefined => {
    const t = tree();
    if (!t) return undefined;
    return tokenValue(t, shownMode(), path);
  };

  const headingStack = createMemo(() => token("font.family.heading"));
  const bodyStack = createMemo(() => token("font.family.body"));
  const primary = createMemo(() => token("color.primary"));
  const onPrimary = createMemo(() => token("color.on-primary"));
  const surface = createMemo(() => token("color.surface"));
  const raised = createMemo(() => token("color.surface-raised"));
  const text = createMemo(() => token("color.text"));
  const muted = createMemo(() => token("color.text-muted"));
  const border = createMemo(() => token("color.border"));

  const surfaces = createMemo<readonly Chip[]>(() => {
    if (!tree()) return [];
    return surfaceSteps(props.text, shownMode());
  });

  const primaryLabel = "color.primary";

  const invalid = createMemo(() => groups().length === 0);

  return (
    <Show
      when={!invalid()}
      fallback={
        <div class="rounded-md border border-border min-h-24" />
      }
    >
      <div
        class="w-full min-w-0 rounded-md border border-solid p-3"
        style={{ background: surface() ?? "transparent", "border-color": border() ?? "currentColor" }}
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="truncate type-body-strong"
            style={{ "font-family": headingStack() ?? "inherit", color: text() ?? "inherit" }}
          >
            {props.name}
          </span>
          <Show when={groups().length >= 2 && props.static !== true}>
            <div class="flex gap-1">
              <button
                type="button"
                class="bare type-caption"
                style={{ color: muted() ?? "inherit" }}
                onClick={() => setMode("light")}
              >
                Light
              </button>
              <button
                type="button"
                class="bare type-caption"
                style={{ color: muted() ?? "inherit" }}
                onClick={() => setMode("dark")}
              >
                Dark
              </button>
            </div>
          </Show>
        </div>
        <Show when={props.static !== true}>
          <p
            class="mt-1"
            style={{ "font-family": bodyStack() ?? "inherit", color: muted() ?? "inherit" }}
          >
            {PANGRAM}
          </p>
        </Show>
        <div
          class="mt-2 flex items-center gap-2 rounded-md border border-solid p-2"
          style={{ background: raised() ?? "transparent", "border-color": border() ?? "currentColor" }}
        >
          <span
            class="inline-block rounded-md px-3 py-2 type-code"
            style={{
              "font-family": bodyStack() ?? "inherit",
              background: primary() ?? "transparent",
              color: onPrimary() ?? "inherit",
            }}
          >
            {primaryLabel}
          </span>
          <Show when={props.static !== true}>
            <span
              class="truncate type-caption"
              style={{ "font-family": bodyStack() ?? "inherit", color: text() ?? "inherit" }}
            >
              {PANGRAM}
            </span>
          </Show>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <For each={surfaces()}>
            {(chip: Chip) => (
              <span
                class="h-6 flex-1 rounded-sm border border-solid"
                style={{ background: chip.value, "border-color": border() ?? "currentColor" }}
                title={`${chip.label} ${chip.value}`}
              />
            )}
          </For>
        </div>
        <div class="mt-2 stack-sm">
          <Show
            when={props.static !== true}
            fallback={
              <For each={groups()}>
                {(group: SwatchGroup) => (
                  <div class="flex items-center gap-2">
                    <span
                      class="w-10 shrink-0 type-code"
                      style={{ color: muted() ?? "inherit" }}
                    >
                      {group.mode}
                    </span>
                    <div
                      class="flex h-6 flex-1 overflow-hidden rounded-sm border border-solid"
                      style={{ "border-color": border() ?? "currentColor" }}
                    >
                      <For each={group.chips}>
                        {(chip: Chip) => (
                          <span
                            class="flex-1"
                            style={{ background: chip.value }}
                            title={`${chip.label} ${chip.value}`}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            }
          >
            <Show when={activeGroup()}>
              {(group: () => SwatchGroup) => (
                <div class="flex items-center gap-2">
                  <span
                    class="w-10 shrink-0 type-code"
                    style={{ color: muted() ?? "inherit" }}
                  >
                    {group().mode}
                  </span>
                  <div
                    class="flex h-6 flex-1 overflow-hidden rounded-sm border border-solid"
                    style={{ "border-color": border() ?? "currentColor" }}
                  >
                    <For each={group().chips}>
                      {(chip: Chip) => (
                        <span
                          class="flex-1"
                          style={{ background: chip.value }}
                          title={`${chip.label} ${chip.value}`}
                        />
                      )}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </div>
      </div>
    </Show>
  );
}

export default ThemePreview;
