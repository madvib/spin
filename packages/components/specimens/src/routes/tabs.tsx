import { createSignal, For, Show } from "solid-js";
import { SpinTabs } from "../components/SpinTabs.tsx";
import type { TabsItem } from "../elements.ts";

const BASE_ITEMS: readonly TabsItem[] = [
  {
    value: "controller",
    label: "Who owns the data?",
    content: "Solid. The route holds the item array in a signal and writes it onto the element as a property.",
  },
  {
    value: "events",
    label: "How does a selection get back out?",
    content: "The trigger click bubbles out of the custom element; the wrapper maps it to the item it owns and calls onSelect.",
  },
];

export default function TabsSpecimen() {
  const [items, setItems] = createSignal<readonly TabsItem[]>(BASE_ITEMS);
  const [last, setLast] = createSignal("nothing selected yet");
  let appended = 0;

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

  return (
    <section>
      <h2 class="text-xl mb-1">Tabs</h2>
      <p class="text-muted mb-4">
        Solid owns the items and passes them down; the element's selections bubble back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <button type="button" onClick={append}>Append item</button>
        <span class="text-sm text-muted">
          last selection: <span id="last-selection">{last()}</span>
        </span>
      </div>

      <SpinTabs
        items={items()}
        onSelect={(change) => setLast(change.value)}
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