import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { AccordionItem, AccordionValueChange } from "../elements.ts";

type AccordionElement = HTMLElement & { items?: readonly AccordionItem[] };

const BASE_ITEMS: readonly AccordionItem[] = [
  {
    value: "controller",
    label: "Who owns the data?",
    content: "Solid. The route holds the item array in a signal and writes it onto the element as a property.",
  },
  {
    value: "events",
    label: "How does a toggle get back out?",
    content: "The element emits a value-change CustomEvent; the route listens with addEventListener like any framework would.",
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
  let el: AccordionElement | undefined;

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

  // Down: property writes. Up: the value-change CustomEvent. This is the
  // whole interop story — no wrapper component, in Solid or anywhere else.
  createEffect(() => {
    if (el) el.items = items();
  });
  createEffect(() => {
    if (!el) return;
    const onValueChange = (event: Event) => {
      const change = (event as CustomEvent<AccordionValueChange>).detail;
      const labels = change.value.map(
        (value) => items().find((item) => item.value === value)?.label ?? value,
      );
      setLast(labels.length > 0 ? `${labels.join(", ")} → open` : "all closed");
    };
    el.addEventListener("value-change", onValueChange);
    onCleanup(() => el?.removeEventListener("value-change", onValueChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Accordion</h2>
      <p class="text-muted mb-4">
        Solid owns the items and passes them down; the element's value-change event bubbles back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <button type="button" class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface" onClick={append}>Append item</button>
        <span class="text-sm text-muted">
          last toggle: <span id="last-toggle">{last()}</span>
        </span>
      </div>

      <spin-accordion
        ref={(node) => {
          el = node as AccordionElement;
          el.items = items();
        }}
      >
        <div slot="header" class="px-4 py-2 text-sm font-medium text-text">Slotted header from the consumer</div>
      </spin-accordion>

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
