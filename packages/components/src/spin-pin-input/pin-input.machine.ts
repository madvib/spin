/**
 * Pin-input machine: the per-cell characters, the index the keyboard talks
 * to, and whether the value is complete.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion } from "@spin/runtime/fsm";
const clearFocusedValue = (ctx: PinInputContext) : Partial<PinInputContext> => {
        if (ctx.focusedIndex === -1) return {};
        const value = [...viewOf(ctx).chars];
        value.splice(ctx.focusedIndex, 1);
        value.push("");
        return { value };
      };

const setFocusedIndex = (ctx: PinInputContext, event: EventUnion<PinInputEvents>) : Partial<PinInputContext> => {
        if (event.type !== "INPUT.FOCUS") return {};
        // A cell beyond what the value has filled is not reachable by focus:
        // the browser is moved back to the first empty cell instead.
        const view = viewOf(ctx);
        const maxIndex = Math.min(view.filled, view.length - 1);
        return { focusedIndex: Math.min(event.index, maxIndex) };
      };

const setFocusIndexToFirst = () : Partial<PinInputContext> => { return ({ focusedIndex: 0 }); };

const advanceFocusedIndex = (ctx: PinInputContext) : Partial<PinInputContext> => { return ({
        focusedIndex: Math.min(ctx.focusedIndex + 1, viewOf(ctx).length - 1),
      }); };

const setPrevFocusedIndex = (ctx: PinInputContext) : Partial<PinInputContext> => { return ({
        focusedIndex: Math.max(ctx.focusedIndex - 1, 0),
      }); };

const hasValue = (ctx: PinInputContext) : boolean => { return (viewOf(ctx).chars[ctx.focusedIndex] ?? "") !== ""; };



export interface PinInputContext {
  /** One character per cell, filled to `count` by every assign. */
  value: string[];
  /** The cell the keyboard talks to; -1 when nothing holds focus. */
  focusedIndex: number;
  count: number;
}
const DEFAULT_COUNT = 4;

/**
 * The pin-input's arguments: the values the host may set.
 *
 * The twin (`defaultValue`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 */
export interface PinInputArgs {
  count?: number;
  value?: string | readonly string[];
  autoFocus?: boolean;
  defaultCount?: number;
}

const parseChars = (raw: unknown): string[] => {
  const parts = Array.isArray(raw)
    ? raw.filter((part): part is string => typeof part === "string")
    : typeof raw === "string"
      ? raw.split(",").map((part) => part.trim())
      : [];
  return parts.filter((part) => part.length === 1);
};

/** The machine's context, from its arguments: the cell count, the
 * characters the host wrote (filled to the count), and the index the
 * keyboard talks to.
 *
 * The seed twin (`defaultValue`) is the host's write of the characters —
 * the framework resolved it into the args — so it counts as a write too.
 */
export function initial(args: PinInputArgs, authored: (name: string) => boolean): PinInputContext {
  // A host that wrote `defaultValue` wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const count =
    typeof args.count === "number" && Number.isFinite(args.count)
      ? Math.max(0, Math.trunc(args.count))
      : DEFAULT_COUNT;
  const chars = written("value") ? parseChars(args.value) : [];
  return {
    value: fill(chars, count),
    focusedIndex: args.autoFocus === true ? 0 : -1,
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

export interface PinInputEvents {
  "VALUE.SET": { value: readonly string[]; index?: undefined } | { value: string; index: number };
  "VALUE.CLEAR": {};
  "INPUT.FOCUS": { index: number };
  "INPUT.BLUR": { index: number };
  "INPUT.CHANGE": { index: number; value: string };
  "INPUT.PASTE": { value: string };
  "INPUT.ADVANCE": {};
  "INPUT.BACKSPACE": {};
  "INPUT.DELETE": {};
  "INPUT.ARROW_LEFT": {};
  "INPUT.ARROW_RIGHT": {};
  "INPUT.HOME": {};
  "INPUT.END": {};
  "VALUE.INVALID": { value: string };
}

export type PinInputEvent = EventUnion<PinInputEvents>;


export function pinInput(
  args: PinInputArgs = {},
  authored: (name: string) => boolean,
): Machine<PinInputContext, PinInputEvents> {
  return createMachine<PinInputContext, PinInputEvents>({
    id: "pin-input",
    initial: "idle",
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      value: { event: "VALUE.SET" },
      count: {},
    },
    context: initial(args, authored),
    // The value events work from every state, so the host's commands and
    // the controlled channel write the value without knowing whether a cell
    // holds focus.
    on: {
      "VALUE.SET": [
        { cond: (_ctx, event) => { return event.type === "VALUE.SET" && event.index !== undefined; }, assign: (ctx, event) => {
        if (event.type !== "VALUE.SET" || event.index === undefined) return {};
        const chars = viewOf(ctx).chars;
        const write = getNextValue(chars[ctx.focusedIndex] ?? "", event.value);
        if (chars[event.index] === write) return {};
        const value = [...chars];
        value[event.index] = write;
        return { value };
      } },
        { assign: (ctx, event) => { return event.type === "VALUE.SET" && event.index === undefined
          // The value arrives the way the host wrote it; the machine shapes it.
          ? { value: fill(parseChars(event.value), ctx.count) }
          : {}; } },
      ],
      // VALUE.CLEAR also parks the index on the first cell: the value is
      // empty, so the next keystroke belongs there.
      "VALUE.CLEAR": { assign: [(ctx) => { return ({ value: fill([], ctx.count) }); }, setFocusIndexToFirst] },
    },
    states: {
      idle: {
        on: {
          "INPUT.FOCUS": { target: "focused", assign: setFocusedIndex },
        },
      },
      focused: {
        on: {
          "INPUT.CHANGE": { assign: [(ctx, event) => {
        if (event.type !== "INPUT.CHANGE" || ctx.focusedIndex === -1) return {};
        const chars = viewOf(ctx).chars;
        const write = getNextValue(chars[ctx.focusedIndex] ?? "", event.value);
        const value = [...chars];
        value[ctx.focusedIndex] = write;
        return { value };
      }, advanceFocusedIndex] },
          "INPUT.ADVANCE": { assign: advanceFocusedIndex },
          "INPUT.PASTE": { assign: [(ctx, event) => {
        const view = viewOf(ctx);
        // A paste lands at the first cell the value has not filled yet, never
        // behind it — the tail the value already holds stays put.
        const startIndex = Math.min(ctx.focusedIndex, view.filled);
        const left = startIndex > 0 ? view.asString.substring(0, ctx.focusedIndex) : "";
        const right = event.value.substring(0, view.length - startIndex);
        return { value: fill(`${left}${right}`.split(""), view.length) };
      }, (ctx) => { return ({
        focusedIndex: Math.min(viewOf(ctx).filled, viewOf(ctx).length - 1),
      }); }] },
          "INPUT.FOCUS": { assign: setFocusedIndex },
          "INPUT.BLUR": { target: "idle", assign: () => { return ({ focusedIndex: -1 }); } },
          "INPUT.DELETE": [
            { cond: hasValue, assign: clearFocusedValue },
          ],
          "INPUT.ARROW_LEFT": { assign: setPrevFocusedIndex },
          "INPUT.ARROW_RIGHT": { assign: (ctx) => {
        const view = viewOf(ctx);
        return { focusedIndex: Math.min(ctx.focusedIndex + 1, Math.min(view.filled, view.length - 1)) };
      } },
          "INPUT.HOME": { assign: setFocusIndexToFirst },
          "INPUT.END": { assign: (ctx) => { return ({
        focusedIndex: Math.max(viewOf(ctx).filled - 1, 0),
      }); } },
          // Backspace on a filled cell clears it and steps back; on an empty
          // cell it only steps back.
          "INPUT.BACKSPACE": [
            { cond: hasValue, assign: [clearFocusedValue, setPrevFocusedIndex] },
            { assign: [setPrevFocusedIndex, clearFocusedValue] },
          ],
        },
      },
    },});
}

/**
 * The value padded (or truncated) to the cell count. A cell the value does
 * not reach reads as the empty string.
 */
export function fill(value: readonly string[], count: number): string[] {
  const length = count || value.length;
  return Array.from({ length }).fill("").map((_char, index) => value[index] || "");
}

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
 * The character a keystroke lands on when the cell already holds one. The
 * incoming value may carry both the old and the new character (a browser
 * appends over a selected cell), and the one that differs from the current
 * character is the write.
 */
export function getNextValue(current: string, next: string): string {
  let nextValue = next;
  if (current[0] === next[0]) {
    nextValue = next[1] ?? "";
  } else if (current[0] === next[1]) {
    nextValue = next[0] ?? "";
  }
  // The upstream version calls split on whatever survived, which throws when
  // the current character equals a single-character incoming value; the view
  // guards that case (a re-typed character is an ADVANCE), so the empty read
  // here is unreachable by construction.
  const chars = nextValue.split("");
  return chars[chars.length - 1] ?? "";
}

const viewOf = (ctx: PinInputContext): PinValueView => pinView(ctx.value, ctx.count);
