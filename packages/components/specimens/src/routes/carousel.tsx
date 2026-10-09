import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { CarouselPageChange } from "../../../src/spin-carousel/carousel.machine-def.ts";

export interface CarouselItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

type CarouselElement = HTMLElement & { items?: readonly CarouselItem[] };

const BASE_ITEMS: readonly CarouselItem[] = [
  { value: "one", label: "Slide one", content: "The first slide's content." },
  { value: "two", label: "Slide two", content: "The second slide's content." },
  { value: "three", label: "Slide three", content: "The third slide's content." },
];

export default function CarouselSpecimen() {
  const [items, setItems] = createSignal<readonly CarouselItem[]>(BASE_ITEMS);
  const [last, setLast] = createSignal("nothing paged yet");
  let appended = 0;
  let el: CarouselElement | undefined;

  const append = () => {
    appended += 1;
    setItems([
      ...items(),
      {
        value: `appended-${appended}`,
        label: `Slide appended ${appended}`,
        content: "Pushed down from the controller after connection.",
      },
    ]);
  };

  // Down: property writes. Up: the page-change CustomEvent. No wrapper.
  createEffect(() => {
    if (el) el.items = items();
  });
  createEffect(() => {
    if (!el) return;
    const onPageChange = (event: Event) => {
      setLast(`page ${(event as CustomEvent<CarouselPageChange>).detail.page + 1}`);
    };
    el.addEventListener("page-change", onPageChange);
    onCleanup(() => el?.removeEventListener("page-change", onPageChange));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Carousel</h2>
      <p class="text-muted mb-4">
        Solid owns the slides and passes them down; the element's page-change event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <button type="button" class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface" onClick={append}>Append slide</button>
        <span class="text-sm text-muted">
          last page: <span id="last-page">{last()}</span>
        </span>
      </div>

      <spin-carousel
        ref={(node) => {
          el = node as CarouselElement;
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
