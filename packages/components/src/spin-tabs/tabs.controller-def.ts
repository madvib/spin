import { signal } from "@spin/runtime";
import type { ControllerDef } from "@spin/runtime";

/**
 * Tabs on the controller tier: the selected value lives in a signal the
 * bags read, arrow keys move it with roving tabindex, and panels show
 * for the selected value. No machine — selection is local UI state the
 * platform has no native equivalent for, so the controller owns it the
 * way tooltip owns hover timing.
 *
 * Items ride the `items` prop as JSON (value/label/content), matching
 * the select/listbox object-array convention.
 */

export interface TabsValueChange {
  readonly value: string;
}

export interface TabsItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

export interface TabsApi {
  readonly value: string;
  select(value: string): void;
  getRootProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getTriggerProps(item: TabsItem): Record<string, unknown>;
  getContentProps(item: TabsItem): Record<string, unknown>;
}

/** Rows ride the bags, not the controller: markup iterates its own
 * `items` scope prop and passes each row in. The controller keeps only
 * selection — scope props never reach `attach` (values stay in the
 * template), so the default arrives as a `data-default` attribute on
 * the root, plain DOM the controller reads directly. */
export function attachTabs(el: Element): TabsApi {
  const selected = signal<string | undefined>(undefined);
  const current = (): string => selected() ?? el.getAttribute("data-default") ?? "";
  const emit = (value: string): void => {
    el.dispatchEvent(new CustomEvent("value-change", { detail: { value }, bubbles: true }));
  };
  const select = (value: string): void => {
    if (value.length === 0 || value === current()) return;
    selected(value);
    emit(value);
  };
  const move = (from: string, direction: 1 | -1): void => {
    const triggers = [...el.querySelectorAll('[role="tab"]')].filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.getAttribute("aria-disabled") !== "true",
    );
    if (triggers.length === 0) return;
    const at = triggers.findIndex((node) => node.getAttribute("data-tabs-value") === from);
    const next = triggers[(at + direction + triggers.length) % triggers.length];
    const value = next?.getAttribute("data-tabs-value");
    if (next === undefined || value === null || value === undefined) return;
    select(value);
    next.focus();
  };
  const onKeydown = (event: Event): void => {
    const key = (event as KeyboardEvent).key;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const value = target.getAttribute("data-tabs-value");
    if (value === null) return;
    if (key === "ArrowRight" || key === "ArrowDown") {
      event.preventDefault();
      move(value, 1);
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      event.preventDefault();
      move(value, -1);
    } else if (key === "Home") {
      event.preventDefault();
      const first = el.querySelector('[role="tab"]');
      const value = first?.getAttribute("data-tabs-value");
      if (first instanceof HTMLElement && value !== null && value !== undefined) {
        select(value);
        first.focus();
      }
    } else if (key === "End") {
      event.preventDefault();
      const tabs = el.querySelectorAll('[role="tab"]');
      const last = tabs[tabs.length - 1];
      const value = last?.getAttribute("data-tabs-value");
      if (last instanceof HTMLElement && value !== null && value !== undefined) {
        select(value);
        last.focus();
      }
    }
  };
  el.addEventListener("keydown", onKeydown);

  const rootId = `${el.id || "tabs"}:root`;
  return {
    get value(): string {
      return current();
    },
    select,
    getRootProps: () => ({ id: rootId }),
    getListProps: () => ({ role: "tablist", "aria-orientation": "horizontal" }),
    getTriggerProps: (item: TabsItem) => {
      const isSelected = current() === item.value;
      return {
        id: `${el.id || "tabs"}:trigger:${item.value}`,
        role: "tab",
        "data-tabs-value": item.value,
        "aria-selected": isSelected ? "true" : "false",
        "data-state": isSelected ? "active" : "inactive",
        tabindex: isSelected ? "0" : "-1",
        onClick: () => select(item.value),
      };
    },
    getContentProps: (item: TabsItem) => {
      const isSelected = current() === item.value;
      return {
        id: `${el.id || "tabs"}:panel:${item.value}`,
        role: "tabpanel",
        "data-tabs-value": item.value,
        "data-state": isSelected ? "active" : "inactive",
        hidden: isSelected ? undefined : true,
      };
    },
  };
}

export const tabs: ControllerDef = {
  attach: attachTabs,
  commands: ["select"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: TabsValueChange) => ({ value: change.value }),
    },
  },
};
