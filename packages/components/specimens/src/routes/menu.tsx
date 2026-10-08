import { createSignal } from "solid-js";
import { SpinMenu } from "../components/SpinMenu.tsx";
import type { MenuItem } from "../elements.ts";

const BASE_ITEMS: readonly MenuItem[] = [
  { value: "profile", label: "Profile" },
  { value: "billing", label: "Billing", disabled: true },
];

export default function MenuSpecimen() {
  const [last, setLast] = createSignal("nothing selected yet");

  return (
    <section>
      <h2 class="text-xl mb-1">Menu</h2>
      <p class="text-muted mb-4">
        Solid owns the items and passes them down; the element's item clicks bubble back up.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <SpinMenu
          items={BASE_ITEMS}
          onSelect={(change) => setLast(`${change.item.label} (${change.item.value})`)}
        />
        <span class="text-sm text-muted">
          last selection: <span id="last-selection">{last()}</span>
        </span>
      </div>
    </section>
  );
}
