/**
 * The Solid side of the L4 controller loop for `<spin-menu>`.
 *
 * The controller owns the data and passes it DOWN as a property write — the
 * live prop contract of `define`, so the element re-renders when the array
 * changes. The element owns its open/closed state; the clicks its items emit
 * bubble OUT of the custom element, and this wrapper maps the event back to
 * the item it owns to report it UP.
 */
import { createEffect } from "solid-js";
import type { MenuItem } from "../elements.ts";

type MenuElement = HTMLElement & { items?: readonly MenuItem[] };

export interface MenuSelect {
  readonly item: MenuItem;
}

export interface SpinMenuProps {
  readonly items: readonly MenuItem[];
  readonly onSelect?: (change: MenuSelect) => void;
}

export function SpinMenu(props: SpinMenuProps) {
  let el: MenuElement | undefined;

  createEffect(() => {
    if (el) el.items = props.items;
  });

  const onSelect = (event: MouseEvent) => {
    if (!el) return;
    const item = (event.target as Element | null)?.closest("[data-value]");
    if (!item) return;
    const items = [...el.querySelectorAll("[data-value]")];
    const owned = props.items[items.indexOf(item)];
    if (owned && !owned.disabled) props.onSelect?.({ item: owned });
  };

  return (
    <spin-menu
      ref={(node) => {
        el = node as MenuElement;
        el.items = props.items;
      }}
      onClick={onSelect}
    />
  );
}
