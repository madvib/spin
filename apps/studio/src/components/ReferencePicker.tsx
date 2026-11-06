import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { combobox } from "@spinjs/components/combobox";
import { humanName } from "../lib/colors.ts";
export function ReferencePicker(props: {
  /** Every colour the theme declares, with what each is worth now. */
  targets: readonly { path: string; name: string; hex: string | null; ramp?: boolean }[];
  /** The path the role follows, when it follows one. */
  current: string | null | undefined;
  /** The role's own hex when set: choosing it back unsets the reference. */
  ownHex?: string;
  onPick: (path: string) => void;
  onUnlink: () => void;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const box = createSpinComponent(element, combobox);
  const [query, setQuery] = createSignal("");
  // The machine lists; the host filters. `getRows` answers every row the
  // collection holds, so the query narrows the collection itself: rows
  // whose name or path do not contain the query never reach the panel.
  // Fresh array identity per query, because the row cache keys on it.
  const items = () => {
    const q = query().trim().toLowerCase();
    const prefix = q === ""
      ? []
      : props.targets.filter((target) =>
          humanName(target.path).toLowerCase().startsWith(q)
        );
    const matched = prefix.length > 0
      ? prefix
      : props.targets.filter((target) =>
          q === "" ||
          humanName(target.path).toLowerCase().includes(q) ||
          target.path.toLowerCase().includes(q)
        );
    return matched.map((target) => ({
      value: `{${target.path}}`,
      label: humanName(target.path),
      meta: target.hex ? { swatch: target.hex } : undefined,
    }));
  };
  createEffect(() =>
    box.bind(
      {
        items: items(),
        inputValue: "",
        allowCustomValue: false,
        selectionBehavior: "clear",
        placeholder: "Search the palette…",
      },
      {
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          const next = event.detail.value[0];
          if (next !== undefined) props.onPick(next.slice(1, -1));
        },
        "input-value-change": (event: CustomEvent<{ inputValue: string }>) => {
          setQuery(event.detail.inputValue);
        },
      },
    ),
  );
  // The machine owns selection: value-change is the only commit channel.
  // Typing is search, not a draft — a half-typed query tabbed out of must
  // not commit, and custom values are refused: the palette is closed, so
  // only a pick writes. The committed choice shows in the chip above,
  // never in the box: the box always reads empty and searching, because
  // `clear` empties it on every pick and nothing here refills it. (The
  // literal-taking fields keep their own Enter/blur wiring in
  // ReferenceField; this component picks references, it does not take
  // values.)
  const active = () => props.targets.find((target) => target.path === props.current);
  const paletteTargets = createMemo(() =>
    props.targets.filter((target) =>
      !target.ramp &&
      target.hex !== null &&
      (target.name === "primary" ||
        target.name === "secondary" ||
        target.name === "accent" ||
        target.name === "link" ||
        target.name.startsWith("semantic."))
    )
  );
  const rampTargets = createMemo(() =>
    props.targets.filter((target) => target.ramp && target.hex !== null)
  );
  return (
    <div class="stack-sm">
      <Show when={active()}>
        {(target) => (
          <div class="split rounded-md border border-primary bg-surface px-2 py-1 type-caption">
            <span class="row-sm rounded-sm" title={target().path}>
              <swatch class="s-sm" style={{ "--swatch": target().hex ?? "" }} aria-hidden="true" />
              <span class="truncate type-caption-strong">Follows {humanName(target().path)}</span>
            </span>
            <button
              type="button"
              class="bare shrink-0 cursor-pointer p-0 opacity-80 hover:opacity-100"
              title={props.ownHex ? `Use ${props.ownHex} instead` : "Stop following token"}
              aria-label={`Stop following ${humanName(target().path)}`}
              onClick={() => props.onUnlink()}
            >
              <span class="i-lucide-x icon-sm" aria-hidden="true" />
            </button>
          </div>
        )}
      </Show>
      <Show when={paletteTargets().length > 0}>
        <div class="flex flex-wrap gap-1">
          <For each={paletteTargets()}>
            {(target) => (
              <button
                type="button"
                class="bare cursor-pointer rounded-sm p-0 transition-transform hover:scale-110"
                classList={{
                  "border-2 border-primary": props.current === target.path,
                }}
                title={`Follow ${humanName(target.path)} (${target.hex ?? ""})`}
                aria-label={`Follow ${humanName(target.path)}`}
                onClick={() => props.onPick(target.path)}
              >
                <swatch class="s-md" style={{ "--swatch": target.hex ?? "" }} aria-hidden="true" />
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={rampTargets().length > 0}>
        <div class="flex gap-1">
          <For each={rampTargets()}>
            {(target) => (
              <button
                type="button"
                class="bare h-5 flex-1 cursor-pointer rounded-sm border p-0 transition-transform hover:scale-105"
                classList={{
                  "border-2 border-primary": props.current === target.path,
                }}
                style={{ background: target.hex ?? undefined }}
                title={`Follow ${humanName(target.path)} (${target.hex ?? ""})`}
                aria-label={`Follow ${humanName(target.path)}`}
                onClick={() => props.onPick(target.path)}
              />
            )}
          </For>
        </div>
      </Show>
      <studio-token-combobox ref={(el: HTMLElement) => setElement(el)} prop:items={items()} prop:inputValue={""} prop:allowCustomValue={false} prop:selectionBehavior="clear" placeholder="Search the palette…" />
    </div>
  );
}
