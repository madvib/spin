/**
 * The Solid side of the L4 controller loop for `<spin-accordion>`.
 *
 * The controller owns the data and passes it DOWN as a property write — the
 * live prop contract of `define`, so the element re-renders when the array
 * changes. The element owns its open/closed state; the clicks its triggers
 * emit bubble OUT of the custom element, and this wrapper maps the event back
 * to the item it owns to report it UP.
 */
import { createEffect } from "solid-js";
import type { AccordionItem } from "../elements.ts";

type AccordionElement = HTMLElement & { items?: readonly AccordionItem[] };

export interface AccordionToggle {
  readonly item: AccordionItem;
  readonly open: boolean;
}

export interface SpinAccordionProps {
  readonly items: readonly AccordionItem[];
  readonly onToggle?: (change: AccordionToggle) => void;
}

export function SpinAccordion(props: SpinAccordionProps) {
  let el: AccordionElement | undefined;

  createEffect(() => {
    if (el) el.items = props.items;
  });

  const onToggle = (event: MouseEvent) => {
    if (!el) return;
    const trigger = (event.target as Element | null)?.closest("button[data-state]");
    if (!trigger) return;
    const triggers = [...el.querySelectorAll("button[data-state]")];
    const item = props.items[triggers.indexOf(trigger)];
    if (item) props.onToggle?.({ item, open: trigger.getAttribute("data-state") === "open" });
  };

  return (
    <spin-accordion
      ref={(node) => {
        el = node as AccordionElement;
        el.items = props.items;
      }}
      onClick={onToggle}
    />
  );
}
