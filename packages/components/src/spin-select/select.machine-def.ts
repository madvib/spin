import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/select";
import { ListCollection } from "@zag-js/collection";

/**
 * The select's Zag wiring.
 *
 * The machine needs `collection: ListCollection`, a constructed object —
 * scope props arrive as plain data, so `toMachineProps` builds it from raw
 * `items` here, beside the machine that consumes it. Plain
 * `{ value, label, disabled }` items need no options: the collection's
 * fallbacks read exactly those fields. One collection per items identity:
 * the props getter runs on every machine read, and rebuilding the list each
 * time is garbage churn.
 *
 * `value-change` is faithful to Zag's `onValueChange({ value, items })` —
 * the selected value array and the selected item objects, nothing derived.
 */

export interface SelectItem {
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
}

export interface SelectValueChange {
  readonly value: readonly string[];
  readonly items: readonly SelectItem[];
}

let cachedCollection: { items: unknown; collection: ListCollection<SelectItem> } | undefined;

export const select: MachineDef = {
  machine,
  connect,
  toMachineProps: (values) => {
    const items = (values.items ?? []) as SelectItem[];
    let collection = cachedCollection?.collection;
    if (cachedCollection?.items !== values.items || !collection) {
      const entry = {
        items: values.items,
        collection: new ListCollection<SelectItem>({ items }),
      };
      cachedCollection = entry;
      collection = entry.collection;
    }
    // Zag reads value/defaultValue as arrays; scope declares scalars.
    const value = values.value as string | undefined;
    const defaultValue = values.defaultValue as string | undefined;
    return {
      collection,
      ...(value !== undefined && value !== "" ? { value: [value] } : {}),
      ...(defaultValue !== undefined && defaultValue !== "" ? { defaultValue: [defaultValue] } : {}),
    };
  },
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: string[]; items: SelectItem[] }): SelectValueChange => ({
        value: change.value,
        items: change.items,
      }),
    },
  },
};
