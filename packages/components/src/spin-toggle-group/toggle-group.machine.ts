/**
 * Toggle-group machine: idle/focused over Zag's two states.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const clearClickFocus = () : Partial<ToggleGroupContext> => { return ({ clickFocus: false }); };

const setTabbingBackward = () : Partial<ToggleGroupContext> => { return ({ tabbingBackward: true }); };

const setFocusedId = (ctx: ToggleGroupContext, event: EventUnion<ToggleGroupEvents>) : Partial<ToggleGroupContext> => {
      if (event.type !== "TOGGLE.FOCUS") return {};
      void ctx;
      return { focusedId: event.id };
    };



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

export interface ToggleGroupEvents {
  "VALUE.SET": { value: string | readonly string[] };
  "TOGGLE.CLICK": { id: string; value: string };
  "ROOT.MOUSE_DOWN": {};
  "ROOT.FOCUS": {};
  "ROOT.BLUR": {};
  "TOGGLE.FOCUS": { id: string };
  "TOGGLE.FOCUS_NEXT": { id: string };
  "TOGGLE.FOCUS_PREV": { id: string };
  "TOGGLE.FOCUS_FIRST": { id: string };
  "TOGGLE.FOCUS_LAST": { id: string };
  "TOGGLE.SHIFT_TAB": { isShiftTab: boolean; firstId: string };
  "SET_DISABLED": { disabled: boolean };
}

export type ToggleGroupEvent = EventUnion<ToggleGroupEvents>;


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

const config: MachineSpec<ToggleGroupContext, ToggleGroupEvents> = {
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
    "VALUE.SET": { assign: (ctx, event) => {
      void ctx;
      return { value: parseValues(event.value) ?? [] };
    } },
    "TOGGLE.CLICK": { assign: (ctx, event) => {
      if (ctx.multiple) {
        return {
          value: ctx.value.includes(event.value)
            ? ctx.value.filter((current) => current !== event.value)
            : [...ctx.value, event.value],
        };
      }
      const selected = ctx.value.length === 1 && ctx.value[0] === event.value;
      return { value: selected && ctx.deselectable ? [] : [event.value] };
    } },
    "ROOT.MOUSE_DOWN": { assign: () => { return ({ clickFocus: true }); } },
    SET_DISABLED: { assign: (ctx, event) => {
      void ctx;
      return { disabled: event.disabled };
    } },
  },
  states: {
    idle: {
      on: {
        "ROOT.FOCUS": [
          {
            cond: (ctx) => { return !ctx.clickFocus && !ctx.tabbingBackward; },
            target: "focused",
            assign: clearClickFocus,
          },
        ],
        "TOGGLE.FOCUS": { target: "focused", assign: setFocusedId },
      },
    },
    focused: {
      on: {
        "ROOT.BLUR": {
          target: "idle",
          assign: [() => { return ({ tabbingBackward: false }); }, () => { return ({ focusedId: null }); }, clearClickFocus],
        },
        "TOGGLE.FOCUS": { assign: setFocusedId },
        "TOGGLE.FOCUS_NEXT": { assign: (ctx, event) => {
      void ctx;
      return { focusedId: event.id };
    } },
        "TOGGLE.FOCUS_PREV": { assign: (ctx, event) => {
      void ctx;
      return { focusedId: event.id };
    } },
        "TOGGLE.FOCUS_FIRST": { assign: (ctx, event) => {
      void ctx;
      return { focusedId: event.id };
    } },
        "TOGGLE.FOCUS_LAST": { assign: (ctx, event) => {
      void ctx;
      return { focusedId: event.id };
    } },
        "TOGGLE.SHIFT_TAB": [
          {
            cond: (ctx, event) => {
      if (event.type !== "TOGGLE.SHIFT_TAB") return false;
      return ctx.focusedId !== event.firstId;
    },
            target: "idle",
            assign: setTabbingBackward,
          },
          { assign: setTabbingBackward },
        ],
      },
    },
  },
};

const implementations = {};

export function toggleGroup(
  args: ToggleGroupArgs = {},
  authored: (name: string) => boolean,
): Machine<ToggleGroupContext, ToggleGroupEvents> {
  return createMachine<ToggleGroupContext, ToggleGroupEvents>({
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
  });
}
