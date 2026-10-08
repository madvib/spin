import { createSignal, For, Show } from "solid-js";
import { SpinAccordion } from "../components/SpinAccordion.tsx";
import type { AccordionItem } from "../elements.ts";

const BASE_ITEMS: readonly AccordionItem[] = [
  {
    value: "controller",
    label: "Who owns the data?",
    content: "Solid. The route holds the item array in a signal and writes it onto the element as a property.",
  },
  {
    value: "events",
    label: "How does a toggle get back out?",
    content: "The trigger click bubbles out of the custom element; the wrapper maps it to the item it owns and calls onToggle.",
  },
  {
    value: "state",
    label: "Who owns open/closed?",
    content: "The element. The Zag machine keeps disclosure state; the controller only seeds data and observes the result.",
  },
];

export default function AccordionSpecimen() {
  const [items, setItems] = createSignal<readonly AccordionItem[]>(BASE_ITEMS);
  const [last, setLast] = createSignal("nothing toggled yet");
  let appended = 0;

  const append = () => {
    appended += 1;
    setItems([
      ...items(),
      {
        value: `appended-${appended}`,
        label: `Appended row ${appended}`,
        content: "Pushed down from the controller after connection.",
      },
    ]);
  };

  return (
    <section>
      <h2 class="text-xl mb-1">Accordion</h2>
      <p class="text-muted mb-4">
        Solid owns the items and passes them down; the element's toggles bubble back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <button type="button" onClick={append}>Append item</button>
        <span class="text-sm text-muted">
          last toggle: <span id="last-toggle">{last()}</span>
        </span>
      </div>

      <SpinAccordion
        items={items()}
        onToggle={(change) =>
          setLast(`${change.item.label} → ${change.open ? "open" : "closed"}`)}
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
