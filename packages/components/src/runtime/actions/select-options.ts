import { createAction } from "./action.ts";
import type { ElementAction } from "./action.ts";

/**
 * select-options — keep the hidden native select's option list and value in
 * step with the collection and the selection.
 *
 * The recipe cannot template `<option>` children: the element parser drops
 * `<template>` inside a `<select>`, so the options are built here, from the
 * rows the bag hands over. The action runs every time the bag re-applies,
 * which is every collection or selection move, so a rebuild is always against
 * current values.
 *
 * The form's value is the reason this exists: a native select inside the form
 * posts this component's selection with no custom serialization, and the
 * form-control action's reset reads it back.
 */

export interface SelectOptionsRow {
  readonly value: string;
  readonly label: string;
}

export interface SelectOptionsParam {
  readonly rows: readonly SelectOptionsRow[];
  readonly value: readonly string[];
  readonly multiple: boolean;
}

export const selectOptions: ElementAction<SelectOptionsParam | undefined> =
  createAction(
    (node, param) => {
      if (param === undefined) return;
      const select = node as HTMLSelectElement;
      /** The sync, run at mount and again on every param change. */
      const apply = (current: SelectOptionsParam): void => {
        const wanted = current.rows;
        // Rebuild only when the option set actually changed: a value move
        // must not churn the option elements.
        const existing = [...select.options].map((option) => option.value);
        const same = existing.length === wanted.length &&
          existing.every((value, index) => value === wanted[index]?.value);
        if (!same) {
          select.replaceChildren();
          for (const row of wanted) {
            const option = document.createElement("option");
            option.value = row.value;
            option.textContent = row.label;
            select.append(option);
          }
        }
        // The IDL's value: for the single select one string, for the multiple
        // one the per-option selected flags — the IDL's `value` accepts no
        // union, so each branch uses the shape its control wants.
        if (current.multiple) {
          for (const option of [...select.options]) {
            option.selected = current.value.includes(option.value);
          }
        } else {
          select.value = current.value[0] ?? "";
        }
      };
      apply(param);
      return { update: apply };
    },
  );
