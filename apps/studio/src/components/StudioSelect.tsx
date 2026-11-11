/**
 * One shared select for the studio's own chrome: the Kind filter, the
 * active-theme picker, the system-stack picker, and the two type-attachment
 * pickers all wear this instead of the browser's control.
 *
 * A `studio-select` element driven by the select machine. The studio feeds
 * it items and the held value; the pick it reports is the new value — the
 * machine owns open/highlight/select, the caller owns what the rows mean.
 */

import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { select } from "@spinjs/components/select";

export interface StudioSelectItem {
  readonly value: string;
  readonly label: string;
}

export default function StudioSelect(props: {
  /** The rows the picker offers. */
  items: readonly StudioSelectItem[];
  /** The held value, or "" for none. */
  value: string;
  /** The pick the caller keeps. */
  onPick: (value: string) => void;
  /** The trigger's accessible name. */
  label: string;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, select);
  createEffect(() =>
    ctl.bind(
      {
        items: props.items.map((row) => ({ value: row.value, label: row.label })),
        // An array, never the bare string: the machine splits a string value
        // on commas, and a font stack IS commas.
        value: props.value === "" ? [] : [props.value],
      },
      {
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          const picked = event.detail.value[0];
          if (picked === undefined) return;
          props.onPick(picked);
        },
      },
    )
  );
  return (
    <studio-select
      ref={setElement}
      aria-label={props.label}
      prop:items={props.items.map((row) => ({ value: row.value, label: row.label }))}
      prop:value={props.value === "" ? [] : [props.value]}
    />
  );
}
