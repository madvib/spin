/**
 * The Solid side of the L4 controller loop for `<spin-tabs>`.
 *
 * The controller owns the data and passes it DOWN as a property write — the
 * live prop contract of `define`, so the element re-renders when the array
 * changes. The element owns its selection state; the clicks its triggers
 * emit bubble OUT of the custom element, and this wrapper maps the event back
 * to the item it owns to report it UP.
 */
import { createEffect } from "solid-js";
import type { TabsItem } from "../elements.ts";

type TabsElement = HTMLElement & { items?: readonly TabsItem[] };

export interface TabsChange {
  readonly value: string;
}

export interface SpinTabsProps {
  readonly items: readonly TabsItem[];
  readonly onSelect?: (change: TabsChange) => void;
}

export function SpinTabs(props: SpinTabsProps) {
  let el: TabsElement | undefined;

  createEffect(() => {
    if (el) el.items = props.items;
  });

  const onSelect = (event: MouseEvent) => {
    if (!el) return;
    const trigger = (event.target as Element | null)?.closest("button[role='tab']");
    if (!trigger) return;
    const triggers = [...el.querySelectorAll("button[role='tab']")];
    const item = props.items[triggers.indexOf(trigger)];
    if (item) props.onSelect?.({ value: item.value });
  };

  return (
    <spin-tabs
      ref={(node) => {
        el = node as TabsElement;
        el.items = props.items;
      }}
      onClick={onSelect}
    />
  );
}