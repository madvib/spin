import type { MachineDef } from "@spin/runtime";
import { createStore, group } from "@zag-js/toast";

/**
 * The toast's Zag wiring — Zag's toast GROUP machine (`group.machine` /
 * `group.connect`, verified in the vendored dist's `index.mjs`).
 *
 * Why the group machine: the plain toast machine is architecturally a child
 * of the group — its `ensureProps` requires `parent` (the group service),
 * and its computed values (`zIndex`, `height`, `frontmost`) all read
 * `prop("parent").context`. It cannot stand alone. The group machine is the
 * one that fits the single-element consume shape: it owns a toast store, and
 * its connect exposes `getToasts()` (render source) and `getGroupProps()`
 * (the region spread).
 *
 * The store: scope props cannot be `object`, so the Toaster lives here at
 * module level. The route writes plain `items: { id, title, description }[]`
 * (object-array) down; `toMachineProps` syncs them into the store via
 * `store.create` / `store.remove` and hands the store to the machine as its
 * `store` prop. The runtime resolves machine props through a computed, so
 * a property write re-runs `toMachineProps` and the sync follows — the same
 * identity-cached pattern tree-view and carousel use. One store is shared by
 * every `<spin-toast>` on the page, which is the correct semantics for a
 * single toaster region.
 *
 * Sync details: the diff runs only when the `items` reference changes (a
 * property write of the same array is a no-op). Store toasts whose ids left
 * the list are removed; listed ids are created or updated in place. Ids
 * dismissed through the close button are remembered and never re-created,
 * so a dismissed toast stays dismissed even if the writer's list still
 * contains it — otherwise the next sync would resurrect it.
 *
 * Events: the group machine declares no `on*` callback props (verified in
 * `toast-group.machine.mjs` — the only callbacks in the package are the plain
 * machine's `onStatusChange`, which this element does not consume). There is
 * therefore no out-side CustomEvent to bridge; dismissal is store-driven.
 */

export interface ToastItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

const store = createStore();

let syncedItems: unknown;

export const toast: MachineDef = {
  machine: group.machine,
  connect: group.connect,
  toMachineProps: (values) => {
    // Dismissal is route-owned: the route removes the item from its own
    // array, the sync below removes it from the store. No resurrection
    // problem exists because the writer's list is the source of truth.
    const items = (values.items ?? []) as ToastItem[];
    if (syncedItems !== values.items) {
      syncedItems = values.items;
      const ids = new Set(items.map((item) => item.id));
      for (const existing of store.getVisibleToasts()) {
        // A toast id is authored; a missing one is a data error, and
        // dropping the toast silently would hide it.
        if (existing.id === undefined) continue;
        if (!ids.has(existing.id)) store.remove(existing.id);
      }
      for (const item of items) {
        store.create({ id: item.id, title: item.title, description: item.description });
      }
    }
    return { store };
  },
};
