import type { AssignFor } from "@spinjs/components/fsm";
import type { MenuEvents } from "./menu.events.ts";
import type { MenuContext, MenuEntry } from "./menu.state.ts";

type MenuAssign<K extends keyof MenuEvents = keyof MenuEvents> = AssignFor<
  MenuContext,
  MenuEvents,
  K
>;

export const clearAnchor: MenuAssign = () => ({ anchorPoint: null });

export const clearAll: MenuAssign = () => ({
  highlightedValue: null,
  openSubmenu: null,
  anchorPoint: null,
});

export const contextMenuAssign: MenuAssign<"CONTEXT_MENU"> = (_ctx, event) =>
  event.type === "CONTEXT_MENU"
    ? { anchorPoint: event.point, highlightedValue: null }
    : {};

export const highlightAssign: MenuAssign<"HIGHLIGHT"> = (ctx, event) =>
  event.type === "HIGHLIGHT" && event.value !== ctx.highlightedValue
    ? { highlightedValue: event.value, openSubmenu: null }
    : {};

export const entriesSetAssign: MenuAssign<"ENTRIES.SET"> = (ctx, event) =>
  // sameEntries comparison stays in machine? We'll inline check here.
  sameEntries(ctx.entries, event.entries) ? {} : { entries: event.entries };

export const submenuOpenAssign: MenuAssign<"SUBMENU_OPEN"> = (ctx, event) =>
  event.type === "SUBMENU_OPEN"
    ? { openSubmenu: event.value, highlightedValue: event.value }
    : { openSubmenu: ctx.openSubmenu };

export const submenuCloseAssign: MenuAssign<"SUBMENU_CLOSE"> = () => ({
  openSubmenu: null,
});

// helper sameEntries moved to state? keep here
function sameEntries(
  a: readonly MenuEntry[],
  b: readonly MenuEntry[],
): boolean {
  // import MenuEntry type
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    if (other === undefined) return false;
    const sep = (candidate: MenuEntry): boolean =>
      "separator" in candidate && candidate.separator === true;
    if (sep(entry) || sep(other)) return sep(entry) === sep(other);
    if ("group" in entry || "group" in other) {
      if (!("group" in entry) || !("group" in other)) return false;
      if (entry.group !== other.group) return false;
      return sameEntries(entry.items, other.items);
    }
    if (!("value" in entry) || !("value" in other)) return false;
    if (entry.value !== other.value || entry.label !== other.label) {
      return false;
    }
    if (entry.shortcut !== other.shortcut) return false;
    if (entry.disabled !== other.disabled) return false;
    if (entry.checked !== other.checked) return false;
    return sameEntries(entry.children ?? [], other.children ?? []);
  });
}
