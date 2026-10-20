/**
 * Toggle-group machine: idle/focused over Zag's two states.
 *
 * The selection is a value list with single-or-multiple semantics (single
 * deselects when deselectable); the focus is a roving id with loop, Tab
 * awareness, and click-vs-keyboard disambiguation. The machine holds the
 * selection and the focus model — the view moves DOM focus as a reflex.
 *
 * Context stays serializable for the scope channel: values, the focused
 * item id, and the scalars the assigns read. Guards sit where Zag put
 * them: root focus steals to the first item except on click-focus and
 * shift-tab; shift-tab on a non-first item drops back to idle.
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
  /** The shaped rows, supplied once at instantiation via `initial`. */
  items: readonly ToggleGroupItem[];
  /** The focused item id, null when focus is outside the group. */
  focusedId: string | null;
  multiple: boolean;
  deselectable: boolean;
  rovingFocus: boolean;
  loopFocus: boolean;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
  /** A mousedown preceded the focus: don't steal it. Refs in Zag, plain
   * context here because the fork has no ref tier and it is a flag. */
  clickFocus: boolean;
  /** Shift-tabbing out backward: don't steal the re-entry. */
  tabbingBackward: boolean;
}

export type ToggleGroupEvent =
  // The value arrives the way the host wrote it: a JSON text or a list.
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
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twin
 * (`defaultValue`) is resolved by the framework before the factory is
 * called, so the machine only ever sees the live value.
 */
export interface ToggleGroupArgs {
  /** The selection, as the host wrote it. */
  readonly value?: string;
  /** The rows, as the host wrote them. */
  readonly items?: string;
  /** Whether more than one row may be pressed. */
  readonly multiple?: boolean;
  /** Whether a pressed row may be released. */
  readonly deselectable?: boolean;
  /** Whether the focus roves between the rows. */
  readonly rovingFocus?: boolean;
  /** Whether the roving focus wraps around. */
  readonly loopFocus?: boolean;
  /** The group's direction, as the host wrote it. */
  readonly orientation?: string;
  /** Whether the group is disabled. */
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
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention for the same write — a host that wrote
  // `defaultValue` wrote the channel too — and the framework has already
  // resolved the twin into the argument, so `args.value` carries it.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
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
      // The value arrives the way the host wrote it; the machine shapes
      // it, wherever it came from.
      return { value: parseValues(event.value) ?? [] };
    },
    // Single: replace, or clear when deselecting the pressed value.
    // Multiple: add or remove.
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
    // reflex. The order lives on the events (first/prev/next/last ids) —
    // functions cannot cross the scope channel, so the bridge attaches the
    // resolved neighbor to each focus event. The machine only records.
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

/**
 * The toggle-group machine: state and nothing else. It is headless — it
 * knows its own arguments, and nothing about props, markup, or the DOM.
 */
export function toggleGroup(
  args: ToggleGroupArgs = {},
  authored: (name: string) => boolean,
): Machine<ToggleGroupContext, ToggleGroupEvent> {
  return createMachine<ToggleGroupContext, ToggleGroupEvent>({
    ...config,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
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
