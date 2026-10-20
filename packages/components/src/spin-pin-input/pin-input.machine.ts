/**
 * Pin-input machine: the per-cell characters, the index the keyboard talks
 * to, and whether the value is complete.
 *
 * Zag ships two states — `idle` and `focused` — with the value events on
 * the root tier, and that maps straight onto the fork: the root `on`
 * carries `VALUE.SET`/`VALUE.CLEAR` (the events that work everywhere,
 * including from the host's imperative commands), `idle` is the start, and
 * `focused` is per-cell editing.
 *
 * Zag's watch blocks — focus an input when the index moves, blur and submit
 * when the value completes, write the value into the inputs, report the
 * invalid keystroke — are all view reflexes in this port: the machine holds
 * characters and an index and reads nothing else. `count` is context
 * because every assign fills the value to it, and the bridge syncs it from
 * the scope prop.
 */

export interface PinInputContext {
  /** One character per cell, filled to `count` by every assign. */
  value: string[];
  /** The cell the keyboard talks to; -1 when nothing holds focus. */
  focusedIndex: number;
  /** The cell count — a machine scalar synced from scope by the bridge. */
  count: number;
}
/** Default cell count when the prop arrives unwritten. */
const DEFAULT_COUNT = 4;

export interface PinInputInitial {
  readonly count?: unknown;
  readonly autoFocus?: unknown;
  readonly value?: unknown;
  readonly defaultValue?: unknown;
}

const parseChars = (raw: unknown): string[] => {
  const parts = Array.isArray(raw)
    ? raw.filter((part): part is string => typeof part === "string")
    : typeof raw === "string"
      ? raw.split(",").map((part) => part.trim())
      : [];
  return parts.filter((part) => part.length === 1);
};

export function initial(raw: PinInputInitial, authored: (name: string) => boolean): PinInputContext {
  const count =
    typeof raw.count === "number" && Number.isFinite(raw.count)
      ? Math.max(0, Math.trunc(raw.count))
      : DEFAULT_COUNT;
  const autoFocus = raw.autoFocus === true;
  const rawValue = authored("value") ? raw.value : raw.defaultValue;
  const chars = parseChars(rawValue);
  return {
    value: fill(chars, count),
    focusedIndex: autoFocus ? 0 : -1,
    count,
  };
}

export interface PinInputValueChange {
  readonly value: string[];
  readonly valueAsString: string;
}

export interface PinInputValueComplete {
  readonly value: string[];
  readonly valueAsString: string;
}

export interface PinInputValueInvalid {
  readonly value: string;
  readonly index: number;
}

export type PinInputEvent =
  | { type: "VALUE.SET"; value: readonly string[]; index?: undefined }
  | { type: "VALUE.SET"; value: string; index: number }
  | { type: "VALUE.CLEAR" }
  | { type: "INPUT.FOCUS"; index: number }
  | { type: "INPUT.BLUR"; index: number }
  | { type: "INPUT.CHANGE"; index: number; value: string }
  | { type: "INPUT.PASTE"; value: string }
  | { type: "INPUT.ADVANCE" }
  | { type: "INPUT.BACKSPACE" }
  | { type: "INPUT.DELETE" }
  | { type: "INPUT.ARROW_LEFT" }
  | { type: "INPUT.ARROW_RIGHT" }
  | { type: "INPUT.HOME" }
  | { type: "INPUT.END" }
  | { type: "VALUE.INVALID"; value: string };

export const config = {
  id: "pin-input",
  initial: "idle",
  context: {
    value: [] as string[],
    focusedIndex: -1,
    count: 0,
  },
  // The root tier, exactly as Zag: the value events work from every state,
  // which is what lets the host's commands and the controlled channel write
  // the value without knowing whether a cell holds focus.
  on: {
    "VALUE.SET": [
      { cond: "hasIndex", actions: [{ assign: "setValueAtIndex" }] },
      { actions: [{ assign: "setValue" }] },
    ],
    // Zag's VALUE.CLEAR also parks the index on the first cell: the value is
    // empty, so the next keystroke belongs there.
    "VALUE.CLEAR": { actions: [{ assign: "clearValue" }, { assign: "setFocusIndexToFirst" }] },
  },
  states: {
    idle: {
      on: {
        "INPUT.FOCUS": { target: "focused", actions: [{ assign: "setFocusedIndex" }] },
      },
    },
    focused: {
      on: {
        "INPUT.CHANGE": { actions: [{ assign: "setFocusedValue" }, { assign: "advanceFocusedIndex" }] },
        "INPUT.ADVANCE": { actions: [{ assign: "advanceFocusedIndex" }] },
        "INPUT.PASTE": { actions: [{ assign: "setPastedValue" }, { assign: "setLastValueFocusIndex" }] },
        "INPUT.FOCUS": { actions: [{ assign: "setFocusedIndex" }] },
        "INPUT.BLUR": { target: "idle", actions: [{ assign: "clearFocusedIndex" }] },
        "INPUT.DELETE": [
          { cond: "hasValue", actions: [{ assign: "clearFocusedValue" }] },
        ],
        "INPUT.ARROW_LEFT": { actions: [{ assign: "setPrevFocusedIndex" }] },
        "INPUT.ARROW_RIGHT": { actions: [{ assign: "setNextFocusedIndex" }] },
        "INPUT.HOME": { actions: [{ assign: "setFocusIndexToFirst" }] },
        "INPUT.END": { actions: [{ assign: "setFocusIndexToLast" }] },
        // Backspace on a filled cell clears it and steps back; on an empty
        // cell it only steps back. Both orders are Zag's.
        "INPUT.BACKSPACE": [
          { cond: "hasValue", actions: [{ assign: "clearFocusedValue" }, { assign: "setPrevFocusedIndex" }] },
          { actions: [{ assign: "setPrevFocusedIndex" }, { assign: "clearFocusedValue" }] },
        ],
      },
    },
  },
};

/**
 * Zag's `fill`: the value padded (or truncated) to the cell count. A cell
 * the value does not reach reads as the empty string, which is what every
 * assign and every bag reads.
 */
export function fill(value: readonly string[], count: number): string[] {
  const length = count || value.length;
  return Array.from({ length }).fill("").map((_char, index) => value[index] || "");
}

/** Zag's `computed._value` plus the facts the view reads off it. */
export interface PinValueView {
  readonly chars: readonly string[];
  readonly length: number;
  readonly filled: number;
  readonly complete: boolean;
  readonly asString: string;
}

export function pinView(value: readonly string[], count: number): PinValueView {
  const chars = fill(value, count);
  const filled = chars.filter((char) => char.trim() !== "").length;
  return {
    chars,
    length: chars.length,
    filled,
    complete: chars.length === filled,
    asString: chars.join(""),
  };
}

/**
 * Zag's `getNextValue`: the character a keystroke lands on when the cell
 * already holds one. The incoming value may carry both the old and the new
 * character (a browser appends over a selected cell), and the one that
 * differs from the current character is the write.
 */
export function getNextValue(current: string, next: string): string {
  let nextValue = next;
  if (current[0] === next[0]) {
    nextValue = next[1] ?? "";
  } else if (current[0] === next[1]) {
    nextValue = next[0] ?? "";
  }
  // Zag's version calls split on whatever survived, which throws when the
  // current character equals a single-character incoming value; the view
  // guards that case upstream (a re-typed character is an ADVANCE), so the
  // empty read here is unreachable by construction.
  const chars = nextValue.split("");
  return chars[chars.length - 1] ?? "";
}

const viewOf = (ctx: PinInputContext): PinValueView => pinView(ctx.value, ctx.count);

export const implementations = {
  conds: {
    hasValue: (ctx: PinInputContext): boolean => (viewOf(ctx).chars[ctx.focusedIndex] ?? "") !== "",
    isValueComplete: (ctx: PinInputContext): boolean => viewOf(ctx).complete,
    hasIndex: (_ctx: PinInputContext, event: PinInputEvent): boolean =>
      event.type === "VALUE.SET" && event.index !== undefined,
  },
  assigns: {
    setValue: (ctx: PinInputContext, event: PinInputEvent): Partial<PinInputContext> =>
      event.type === "VALUE.SET" && event.index === undefined
        ? { value: fill(event.value, ctx.count) }
        : {},
    setValueAtIndex: (ctx: PinInputContext, event: PinInputEvent): Partial<PinInputContext> => {
      if (event.type !== "VALUE.SET" || event.index === undefined) return {};
      const chars = viewOf(ctx).chars;
      const write = getNextValue(chars[ctx.focusedIndex] ?? "", event.value);
      if (chars[event.index] === write) return {};
      const value = [...chars];
      value[event.index] = write;
      return { value };
    },
    setFocusedValue: (ctx: PinInputContext, event: PinInputEvent): Partial<PinInputContext> => {
      if (event.type !== "INPUT.CHANGE" || ctx.focusedIndex === -1) return {};
      const chars = viewOf(ctx).chars;
      const write = getNextValue(chars[ctx.focusedIndex] ?? "", event.value);
      const value = [...chars];
      value[ctx.focusedIndex] = write;
      return { value };
    },
    setPastedValue: (ctx: PinInputContext, event: PinInputEvent): Partial<PinInputContext> => {
      if (event.type !== "INPUT.PASTE") return {};
      const view = viewOf(ctx);
      // A paste lands at the first cell the value has not filled yet, never
      // behind it — the tail the value already holds stays put.
      const startIndex = Math.min(ctx.focusedIndex, view.filled);
      const left = startIndex > 0 ? view.asString.substring(0, ctx.focusedIndex) : "";
      const right = event.value.substring(0, view.length - startIndex);
      return { value: fill(`${left}${right}`.split(""), view.length) };
    },
    clearValue: (ctx: PinInputContext): Partial<PinInputContext> => ({ value: fill([], ctx.count) }),
    clearFocusedValue: (ctx: PinInputContext): Partial<PinInputContext> => {
      if (ctx.focusedIndex === -1) return {};
      const value = [...viewOf(ctx).chars];
      value.splice(ctx.focusedIndex, 1);
      value.push("");
      return { value };
    },
    setFocusedIndex: (ctx: PinInputContext, event: PinInputEvent): Partial<PinInputContext> => {
      if (event.type !== "INPUT.FOCUS") return {};
      // A cell beyond what the value has filled is not reachable by focus:
      // the browser is moved back to the first empty cell instead.
      const view = viewOf(ctx);
      const maxIndex = Math.min(view.filled, view.length - 1);
      return { focusedIndex: Math.min(event.index, maxIndex) };
    },
    setFocusIndexToFirst: (): Partial<PinInputContext> => ({ focusedIndex: 0 }),
    setFocusIndexToLast: (ctx: PinInputContext): Partial<PinInputContext> => ({
      focusedIndex: Math.max(viewOf(ctx).filled - 1, 0),
    }),
    setLastValueFocusIndex: (ctx: PinInputContext): Partial<PinInputContext> => ({
      focusedIndex: Math.min(viewOf(ctx).filled, viewOf(ctx).length - 1),
    }),
    advanceFocusedIndex: (ctx: PinInputContext): Partial<PinInputContext> => ({
      focusedIndex: Math.min(ctx.focusedIndex + 1, viewOf(ctx).length - 1),
    }),
    setNextFocusedIndex: (ctx: PinInputContext): Partial<PinInputContext> => {
      const view = viewOf(ctx);
      return { focusedIndex: Math.min(ctx.focusedIndex + 1, Math.min(view.filled, view.length - 1)) };
    },
    setPrevFocusedIndex: (ctx: PinInputContext): Partial<PinInputContext> => ({
      focusedIndex: Math.max(ctx.focusedIndex - 1, 0),
    }),
    clearFocusedIndex: (): Partial<PinInputContext> => ({ focusedIndex: -1 }),
  },
};
