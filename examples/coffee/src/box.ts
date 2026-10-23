/**
 * The box: what a customer is carrying, shared by every page.
 *
 * One module signal — the header badge, the cards' own buttons and the box
 * page all read the same list, so adding here shows up there without
 * threading props through the router. The store is the app's state; nothing
 * about it is spin.
 */
import { createSignal } from "solid-js";

export interface BoxItem {
  readonly origin: string;
  readonly price: number;
  readonly image: string;
}

const [items, setItems] = createSignal<readonly BoxItem[]>([]);

/** What is in the box right now. */
export function box(): readonly BoxItem[] {
  return items();
}

/** Whether a bean is already in it — the card's button reads this. */
export function inBox(origin: string): boolean {
  return items().some((item) => item.origin === origin);
}

export function addToBox(item: BoxItem): void {
  setItems((list) =>
    list.some((entry) => entry.origin === item.origin) ? list : [
      ...list,
      item,
    ]
  );
}

export function removeFromBox(origin: string): void {
  setItems((list) => list.filter((item) => item.origin !== origin));
}

export function clearBox(): void {
  setItems([]);
}
