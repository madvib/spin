/**
 * Toggle-group machine: idle/focused over Zag's two states.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface ToggleGroupItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface ToggleGroupContext {
  value: string[];
  items: readonly ToggleGroupItem[];
  focusedId: string | null;
  multiple: boolean;
  deselectable: boolean;
  rovingFocus: boolean;
  loopFocus: boolean;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
  /** A mousedown preceded the focus: don't steal it. Zag uses a ref; this
   * fork has no ref tier, so it is a flag. */
  clickFocus: boolean;
  tabbingBackward: boolean;
}

export type ToggleGroupEvent =
  // The host may write the value as a JSON text or a list.
  | { type: "VALUE.SET"; value: string | readonly string[] }
  | { type: "TOGGLE.CLICK"; id: string; value: string }
  | { type: "ROOT.MOUSE_DOWN" }
  | { type: "ROOT.FOCUS" }
  | { type: "ROOT.BLUR" }
  | { type: "TOGGLE.FOCUS"; id: string }
  | { type: "TOGGLE.FOCUS_NEXT"; id: string }
  | { type: "TOGGLE.FOCUS_PREV"; id: string }
  | { type: "TOGGLE.FOCUS_FIRST"; id: string }
  | { type: "TOGGLE.FOCUS_LAST"; id: string }
  | { type: "TOGGLE.SHIFT_TAB"; isShiftTab: boolean; firstId: string }
  | { type: "SET_DISABLED"; disabled: boolean };

export type ToggleGroupValueChange = {
  readonly value: string[];
};

export function isInteractive(ctx: ToggleGroupContext): boolean {
  return !ctx.disabled;
}

export function isPressed(ctx: ToggleGroupContext, value: string): boolean {
  return ctx.value.includes(value);
}

export interface ToggleGroupRow {
  readonly value?: unknown;
  readonly label?: unknown;
  readonly disabled?: unknown;
}

/**
 * The toggle-group's arguments: the values the host may set.
 */
export interface ToggleGroupArgs {
  readonly value?: string;
  readonly items?: string;
  readonly multiple?: boolean;
  readonly deselectable?: boolean;
  readonly rovingFocus?: boolean;
  readonly loopFocus?: boolean;
  readonly orientation?: string;
  readonly disabled?: boolean;
}

const parseValues = (raw: unknown): string[] | null => {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return null;
  return list.every((item) => typeof item === "string") ? [...(list as string[])] : null;
};

export function initial(args: ToggleGroupArgs, authored: (name: string) => boolean): ToggleGroupContext {
  const list: unknown = typeof args.items === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(args.items as string);
      } catch {
        return null;
      }
    })()
    : args.items;
  const items: ToggleGroupItem[] = [];
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (typeof entry === "object" && entry !== null) {
        const record = entry as Record<string, unknown>;
        const value = record["value"];
        if (typeof value !== "string" || value.length === 0) continue;
        const label = record["label"];
        items.push({
          value,
          label: typeof label === "string" && label.length > 0 ? label : value,
          ...(record["disabled"] === true ? { disabled: true as const } : {}),
        });
      } else if (typeof entry === "string" && entry.length > 0) {
        items.push({ value: entry, label: entry });
      }
    }
  }
  // The twin counts as the host's write — the framework has already
  // resolved `defaultValue` into the argument.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    value: written("value") ? parseValues(args.value) ?? [] : [],
    items,
    focusedId: null,
    multiple: written("multiple") ? args.multiple === true : false,
    deselectable: written("deselectable") ? args.deselectable !== false : true,
    rovingFocus: written("rovingFocus") ? args.rovingFocus !== false : true,
    loopFocus: written("loopFocus") ? args.loopFocus !== false : true,
    orientation: written("orientation")
      ? (args.orientation === "vertical" ? "vertical" : "horizontal")
      : "horizontal",
    disabled: written("disabled") ? args.disabled === true : false,
    clickFocus: false,
    tabbingBackward: false,
  };
}

const config = {
  id: "toggle-group",
  initial: "idle",
  context: {
    value: [] as string[],
    items: [] as ToggleGroupItem[],
    focusedId: null as string | null,
    multiple: false,
    deselectable: true,
    rovingFocus: true,
    loopFocus: true,
    orientation: "horizontal" as "horizontal" | "vertical",
    disabled: false,
    clickFocus: false,
    tabbingBackward: false,
  },
  on: {
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "TOGGLE.CLICK": { actions: [{ assign: "toggleValue" }] },
    "ROOT.MOUSE_DOWN": { actions: [{ assign: "setClickFocus" }] },
    SET_DISABLED: { actions: [{ assign: "setDisabled" }] },
  },
  states: {
    idle: {
      on: {
        "ROOT.FOCUS": [
          {
            cond: "shouldStealFocus",
            target: "focused",
            actions: [{ assign: "clearClickFocus" }],
          },
        ],
        "TOGGLE.FOCUS": { target: "focused", actions: [{ assign: "setFocusedId" }] },
      },
    },
    focused: {
      on: {
        "ROOT.BLUR": {
          target: "idle",
          actions: [
            { assign: "clearTabbingBackward" },
            { assign: "clearFocusedId" },
            { assign: "clearClickFocus" },
          ],
        },
        "TOGGLE.FOCUS": { actions: [{ assign: "setFocusedId" }] },
        "TOGGLE.FOCUS_NEXT": { actions: [{ assign: "focusNext" }] },
        "TOGGLE.FOCUS_PREV": { actions: [{ assign: "focusPrev" }] },
        "TOGGLE.FOCUS_FIRST": { actions: [{ assign: "focusFirst" }] },
        "TOGGLE.FOCUS_LAST": { actions: [{ assign: "focusLast" }] },
        "TOGGLE.SHIFT_TAB": [
          {
            cond: "isNotFirstFocused",
            target: "idle",
            actions: [{ assign: "setTabbingBackward" }],
          },
          { actions: [{ assign: "setTabbingBackward" }] },
        ],
      },
    },
  },
};

const implementations = {
  conds: {
    shouldStealFocus: (ctx: ToggleGroupContext): boolean => !ctx.clickFocus && !ctx.tabbingBackward,
    isNotFirstFocused: (ctx: ToggleGroupContext, event: ToggleGroupEvent): boolean => {
      if (event.type !== "TOGGLE.SHIFT_TAB") return false;
      return ctx.focusedId !== event.firstId;
    },
  },
  assigns: {
    setValue: (ctx: ToggleGroupContext, event: ToggleGroupEvent): Partial<ToggleGroupContext> => {
      if (event.type !== "VALUE.SET") return {};
      void ctx;
      return { value: parseValues(event.value) ?? [] };
    },
    toggleValue: (ctx: ToggleGroupContext, event: ToggleGroupEvent): Partial<ToggleGroupContext> => {
      if (event.type !== "TOGGLE.CLICK") return {};
      if (ctx.multiple) {
        return {
          value: ctx.value.includes(event.value)
            ? ctx.value.filter((current) => current !== event.value)
            : [...ctx.value, event.value],
        };
      }
      const selected = ctx.value.length === 1 && ctx.value[0] === event.value;
      return { value: selected && ctx.deselectable ? [] : [event.value] };
    },
    setClickFocus: (): Partial<ToggleGroupContext> => ({ clickFocus: true }),
    clearClickFocus: (): Partial<ToggleGroupContext> => ({ clickFocus: false }),
    setTabbingBackward: (): Partial<ToggleGroupContext> => ({ tabbingBackward: true }),
    clearTabbingBackward: (): Partial<ToggleGroupContext> => ({ tabbingBackward: false }),
    setFocusedId: (ctx: ToggleGroupContext, event: ToggleGroupEvent): Partial<ToggleGroupContext> => {
      if (event.type !== "TOGGLE.FOCUS") return {};
      void ctx;
      return { focusedId: event.id };
    },
    clearFocusedId: (): Partial<ToggleGroupContext> => ({ focusedId: null }),
    // Roving moves write the focused id; the view focuses the node as a
    // reflex. The order lives on the events: the bridge resolves the
    // neighbor and attaches it, since functions cannot cross the scope channel.
    focusNext: (ctx: ToggleGroupContext, event: ToggleGroupEvent): Partial<ToggleGroupContext> => {
      if (event.type !== "TOGGLE.FOCUS_NEXT") return {};
      void ctx;
      return { focusedId: event.id };
    },
    focusPrev: (ctx: ToggleGroupContext, event: ToggleGroupEvent): Partial<ToggleGroupContext> => {
      if (event.type !== "TOGGLE.FOCUS_PREV") return {};
      void ctx;
      return { focusedId: event.id };
    },
    focusFirst: (ctx: ToggleGroupContext, event: ToggleGroupEvent): Partial<ToggleGroupContext> => {
      if (event.type !== "TOGGLE.FOCUS_FIRST") return {};
      void ctx;
      return { focusedId: event.id };
    },
    focusLast: (ctx: ToggleGroupContext, event: ToggleGroupEvent): Partial<ToggleGroupContext> => {
      if (event.type !== "TOGGLE.FOCUS_LAST") return {};
      void ctx;
      return { focusedId: event.id };
    },
    setDisabled: (ctx: ToggleGroupContext, event: ToggleGroupEvent): Partial<ToggleGroupContext> => {
      if (event.type !== "SET_DISABLED") return {};
      void ctx;
      return { disabled: event.disabled };
    },
  },
};

export function toggleGroup(
  args: ToggleGroupArgs = {},
  authored: (name: string) => boolean,
): Machine<ToggleGroupContext, ToggleGroupEvent> {
  return createMachine<ToggleGroupContext, ToggleGroupEvent>({
    ...config,
    context: initial(args, authored),
    /**
     * A field with an event is REPORTED: the host's write is an event, the
     * machine decides, and the change reaches the host. A field without one
     * is SILENT: the write lands in the field, and nothing reports.
     */
    fields: {
      value: { event: "VALUE.SET" },
      multiple: {},
      deselectable: {},
      rovingFocus: {},
      loopFocus: {},
      orientation: {},
      disabled: {},
    },
    assigns: implementations.assigns,
    conds: implementations.conds,
  });
}
