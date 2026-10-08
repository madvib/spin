import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { TabsItem } from "../elements.ts";
import type { TabsValueChange } from "../../src/spin-tabs/tabs.machine-def.ts";

type TabsElement = HTMLElement & { items?: readonly TabsItem[] };

const BASE_ITEMS: readonly TabsItem[] = [
  {
    value: "controller",
    label: "Who owns the data?",
    content: "Solid. The route holds the item array in a signal and writes it onto the element as a property.",
  },
  {
    value: "events",
    label: "How does a selection get back out?",
    content: "The element emits a value-change CustomEvent; the route listens with addEventListener like any framework would.",
  },
];

export default function TabsSpecimen() {
  const [items, setItems] = createSignal<readonly TabsItem[]>(BASE_ITEMS);
  const [last, setLast] = createSignal("nothing selected yet");
  let appended = 0;
  let el: TabsElement | undefined;

  const append = () => {
    appended += 1;
    setItems([
      ...items(),
      {
        value: `appended-${appended}`,
        label: `Appended tab ${appended}`,
        content: "Pushed down from the controller after connection.",
      },
    ]);
  };

  // Down: property writes. Up: the value-change CustomEvent. No wrapper.
  createEffect(() => {
    if (el) el.items = items();
  });
  createEffect(() => {
    if (!el) return;
    const onValueChange = (event: Event) => {
      setLast((event as CustomEvent<TabsValueChange>).detail.value);
    };
    el.addEventListener("value-change", onValueChange);
    onCleanup(() => el?.removeEventListener("value-change", onValueChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Tabs</h2>
      <p class="text-muted mb-4">
        Solid owns the items and passes them down; the element's value-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <button type="button" class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface" onClick={append}>Append item</button>
        <span class="text-sm text-muted">
          last selection: <span id="last-selection">{last()}</span>
        </span>
      </div>

      <spin-tabs
        ref={(node) => {
          el = node as TabsElement;
          el.items = items();
        }}
      />

      <Show when={items().length > BASE_ITEMS.length}>
        <ul class="mt-4 text-sm text-muted">
          <For each={items().slice(BASE_ITEMS.length)}>
            {(item) => <li>appended: {item.label}</li>}
          </For>
        </ul>
      </Show>
    </section>
  );
}
