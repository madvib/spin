import { createEffect, createSignal, onCleanup } from "solid-js";
import type { MenuItem } from "../elements.ts";
import type { MenuSelect } from "../../src/spin-menu/menu.machine-def.ts";

type MenuElement = HTMLElement & { items?: readonly MenuItem[] };

const BASE_ITEMS: readonly MenuItem[] = [
  { value: "profile", label: "Profile" },
  { value: "billing", label: "Billing", disabled: true },
];

export default function MenuSpecimen() {
  const [last, setLast] = createSignal("nothing selected yet");
  let el: MenuElement | undefined;

  // Down: property writes. Up: the select CustomEvent, mapped back to the
  // owned items. No wrapper component.
  createEffect(() => {
    if (el) el.items = BASE_ITEMS;
  });
  createEffect(() => {
    if (!el) return;
    const onSelect = (event: Event) => {
      const value = (event as CustomEvent<MenuSelect>).detail.value;
      const item = BASE_ITEMS.find((candidate) => candidate.value === value);
      if (item && !item.disabled) setLast(`${item.label} (${item.value})`);
    };
    el.addEventListener("select", onSelect);
    onCleanup(() => el?.removeEventListener("select", onSelect));
  });

  return (
    <section>
      <h2 class="text-xl mb-1">Menu</h2>
      <p class="text-muted mb-4">
        Solid owns the items and passes them down; the element's select event comes back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <spin-menu
          ref={(node) => {
            el = node as MenuElement;
            el.items = BASE_ITEMS;
          }}
        />
        <span class="text-sm text-muted">
          last selection: <span id="last-selection">{last()}</span>
        </span>
      </div>
    </section>
  );
}
