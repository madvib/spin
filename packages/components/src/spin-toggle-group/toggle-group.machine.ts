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
  | { type: "VALUE.SET"; value: readonly string[] }
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

export interface ToggleGroupInitial {
  readonly value?: unknown;
  readonly defaultValue?: unknown;
  readonly items?: unknown;
  readonly multiple?: unknown;
  readonly deselectable?: unknown;
  readonly rovingFocus?: unknown;
  readonly loopFocus?: unknown;
  readonly orientation?: unknown;
  readonly disabled?: unknown;
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

export function initial(raw: ToggleGroupInitial, authored: (name: string) => boolean): ToggleGroupContext {
  const list: unknown = typeof raw.items === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw.items as string);
      } catch {
        return null;
      }
    })()
    : raw.items;
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
  return {
    value: parseValues(authored("value") ? raw.value : null) ?? parseValues(raw.defaultValue) ?? [],
    items,
    focusedId: null,
    multiple: raw.multiple === true,
    deselectable: raw.deselectable !== false,
    rovingFocus: raw.rovingFocus !== false,
    loopFocus: raw.loopFocus !== false,
    orientation: raw.orientation === "vertical" ? "vertical" : "horizontal",
    disabled: raw.disabled === true,
    clickFocus: false,
    tabbingBackward: false,
  };
}

export const config = {
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

export const implementations = {
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
      return { value: [...event.value] };
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
