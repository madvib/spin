/**
 * Select machine: closed and unfocused (`idle`), closed and focused
 * (`focused`), open (`open`) — plus the selection, the highlight, and the
 * placement the content was last positioned at.
 *
 * The controlled-open events (`CONTROLLED.OPEN` / `CONTROLLED.CLOSE`) carry
 * the "was the open state authored" distinction: the bridge reports a host
 * write as one of these, and the machine moves only when the host owns the
 * state. Which of the two a close lands in (`focused` vs `idle`) is the
 * restoreFocus question, decided by who asked: a layer dismissal after a
 * non-focusable interaction lands in `idle`; everything else the trigger
 * focused, so it returns to `focused`.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion } from "@spin/runtime/fsm";
const setHighlighted = (ctx: SelectContext, event: EventUnion<SelectEvents>) : Partial<SelectContext> => {
        // The highlight arrives the way the host wrote it — a value, or
        // nothing at all.
        if (event.type === "HIGHLIGHTED_VALUE.SET") {
          return { highlightedValue: event.highlightedValue };
        }
        if (event.type === "ITEM.POINTER_MOVE") {
          return { highlightedValue: event.value };
        }
        return { highlightedValue: ctx.highlightedValue };
      };

const clearHighlighted = () : Partial<SelectContext> => { return ({
        highlightedValue: null,
      }); };

const clearValue = () : Partial<SelectContext> => { return ({ value: [] }); };

const selectClicked = (ctx: SelectContext, event: EventUnion<SelectEvents>) : Partial<SelectContext> => {
        if (event.type !== "ITEM.CLICK") return {};
        if (ctx.multiple) {
          return {
            value: ctx.value.includes(event.value)
              ? ctx.value.filter((value) => value !== event.value)
              : [...ctx.value, event.value],
          };
        }
        return { value: [event.value] };
      };

const highlightFirstOrSelected = (ctx: SelectContext) : Partial<SelectContext> => {
        const selected = ctx.value.find((value) => ctx.order.includes(value));
        if (selected !== undefined) return { highlightedValue: selected };
        return { highlightedValue: ctx.order[0] ?? null };
      };

const highlightFirst = (ctx: SelectContext) : Partial<SelectContext> => { return ({
        highlightedValue: ctx.order[0] ?? null,
      }); };

const highlightLast = (ctx: SelectContext) : Partial<SelectContext> => { return ({
        highlightedValue: ctx.order[ctx.order.length - 1] ?? null,
      }); };

const single = (ctx: SelectContext) : boolean => { return !ctx.multiple; };

const restoreFocus = (_ctx: SelectContext, event: EventUnion<SelectEvents>) : boolean => {
        if (
          event.type === "CONTROLLED.CLOSE" ||
          event.type === "LAYER.INTERACT_OUTSIDE"
        ) {
          return event.restoreFocus !== false;
        }
        return true;
      };



export interface SelectContext {
  value: string[];
  highlightedValue: string | null;
  /** The collection's values in order — a derived sync over the `items`
   * prop, not a host write. */
  order: string[];
  /** The collection's labels by value — a derived sync over the `items`
   * prop, not a host write. */
  labels: Record<string, string>;
  multiple: boolean;
  closeOnSelect: boolean;
  loopFocus: boolean;
}

export interface SelectEvents {
  "SELECTED_ITEMS.SYNC": {};
  "HIGHLIGHTED_VALUE.SET": { highlightedValue: string | null };
  "HIGHLIGHTED_VALUE.CLEAR": {};
  "ITEM.SELECT": { value: string };
  "ITEM.CLEAR": { value: string };
  "VALUE.SET": { value: readonly string[] };
  "VALUE.CLEAR": {};
  "CLEAR.CLICK": {};
  "OPEN": {};
  "CLOSE": {};
  "TOGGLE": {};
  "CONTROLLED.OPEN": {};
  "CONTROLLED.CLOSE": { restoreFocus?: boolean };
  "TRIGGER.CLICK": {};
  "TRIGGER.FOCUS": {};
  "TRIGGER.BLUR": {};
  "TRIGGER.ENTER": {};
  "TRIGGER.ARROW_UP": {};
  "TRIGGER.ARROW_DOWN": {};
  "TRIGGER.ARROW_LEFT": {};
  "TRIGGER.ARROW_RIGHT": {};
  "TRIGGER.HOME": {};
  "TRIGGER.END": {};
  "TRIGGER.TYPEAHEAD": { value: string };
  "ITEM.CLICK": { value: string };
  "ITEM.POINTER_MOVE": { value: string };
  "ITEM.POINTER_LEAVE": {};
  "CONTENT.HOME": {};
  "CONTENT.END": {};
  "CONTENT.ARROW_UP": {};
  "CONTENT.ARROW_DOWN": {};
  "CONTENT.TYPEAHEAD": { value: string };
  "LAYER.ESCAPE": {};
  "LAYER.INTERACT_OUTSIDE": { restoreFocus?: boolean };
}

export type SelectEvent = EventUnion<SelectEvents>;


export const selectLabel = (ctx: SelectContext): string => {
  if (ctx.value.length === 0) return "";
  if (!ctx.multiple) return ctx.labels[ctx.value[0]!] ?? "";
  return ctx.value.map((value) => ctx.labels[value] ?? value).join(", ");
};
export interface SelectRow {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/**
 * The select's arguments: the values the host may set.
 *
 * The twins (`defaultValue`, `defaultHighlightedValue`) are resolved by the
 * framework before the factory is called, so the machine only ever sees
 * the live values.
 */
export interface SelectArgs {
  value?: string | readonly string[];
  highlightedValue?: string;
  items?: string | readonly SelectRow[];
  multiple?: boolean;
  /**
   * Whether a pick closes the panel. The machine's own default is `!multiple`;
   * a host that writes the prop owns it, and the machine's contract carries
   * that write.
   */
  closeOnSelect?: boolean;
  loopFocus?: boolean;
  defaultCloseOnSelect?: boolean;
}

const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (trimmed === "") return [];
  return trimmed.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
};

const nullableProp = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

/** The collection's rows, off any transport: a row needs a value, and the
 * label falls back to the value. */
const rowsOf = (raw: unknown): SelectRow[] => {
  const rows: SelectRow[] = [];
  const arr = Array.isArray(raw) ? raw : [];
  for (const entry of arr) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const value = record["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    rows.push({
      value,
      label: typeof record["label"] === "string" ? record["label"] : value,
      disabled: record["disabled"] === true,
    });
  }
  return rows;
};

/** The machine's context, from its arguments: the selection, the
 * highlight, the collection's order and labels, and the select's modes.
 *
 * The seed twin (`defaultHighlightedValue`) is the host's write of the
 * highlight — the framework resolved it into the args — so it counts as a
 * write too.
 */
export function initial(args: SelectArgs, authored: (name: string) => boolean): SelectContext {
  // A host that wrote `defaultHighlightedValue` wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const rows = rowsOf(args.items);
  const multiple = args.multiple === true;
  // The default: a multiple select keeps its panel open over each pick.
  // The scope's `closeOnSelect` default is `true`, so the prop is never
  // absent and its presence says nothing: the authored predicate is what
  // says whether the host chose it.
  const closeOnSelect = written("closeOnSelect")
    ? args.closeOnSelect === true
    : !multiple;
  const loopFocus = args.loopFocus === true;
  const value = parseKeys(args.value);
  // The scope's `highlightedValue` default is "", so an unauthored
  // highlight looks present: the authored predicate is what says whether
  // the host chose it.
  const highlightedValue = written("highlightedValue")
    ? nullableProp(args.highlightedValue)
    : null;
  const order = rows.map((row) => row.value);
  const labels: Record<string, string> = Object.fromEntries(rows.map((row) => [row.value, row.label]));
  return {
    value,
    highlightedValue,
    order,
    labels,
    multiple,
    closeOnSelect,
    loopFocus,
  };
}

const inCollection = (
  ctx: SelectContext,
  value: string | null,
): value is string => value !== null && ctx.order.includes(value);

export function select(
  args: SelectArgs = {},
  authored: (name: string) => boolean,
): Machine<SelectContext, SelectEvents> {
  return createMachine<SelectContext, SelectEvents>({
    id: "select",
    initial: "idle",
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      highlightedValue: { event: "HIGHLIGHTED_VALUE.SET" },
      closeOnSelect: {},
    },
    context: initial(args, authored),
    // The value and highlight events fire from every state, so a controlled
    // write or a programmatic select lands the same whatever the panel is
    // doing.
    on: {
      "SELECTED_ITEMS.SYNC": { assign: (ctx) => {
        const value = ctx.value.filter((candidate) =>
          ctx.order.includes(candidate)
        );
        const highlighted = inCollection(ctx, ctx.highlightedValue)
          ? ctx.highlightedValue
          : (value[0] ?? null);
        const sameSelection = value.length === ctx.value.length;
        const sameHighlight = highlighted === ctx.highlightedValue;
        if (sameSelection && sameHighlight) return {};
        return { value, highlightedValue: highlighted };
      } },
      "HIGHLIGHTED_VALUE.SET": { assign: setHighlighted },
      "HIGHLIGHTED_VALUE.CLEAR": { assign: clearHighlighted },
      "ITEM.SELECT": { assign: (ctx, event) => {
        if (ctx.multiple) {
          return {
            value: ctx.value.includes(event.value)
              ? ctx.value.filter((value) => value !== event.value)
              : [...ctx.value, event.value],
          };
        }
        return { value: [event.value] };
      } },
      "ITEM.CLEAR": { assign: clearValue },
      "VALUE.SET": { assign: (_ctx, event) => { return event.type === "VALUE.SET" ? { value: [...event.value] } : {}; } },
      "VALUE.CLEAR": { assign: clearValue },
      "CLEAR.CLICK": { assign: () => { return ({
        value: [],
        highlightedValue: null,
      }); } },
    },
    states: {
      idle: {
        on: {
          "TRIGGER.FOCUS": { target: "focused" },
          // The imperative toggle: OPEN's own transition, so the highlight
          // pre-places as a gesture open does.
          TOGGLE: {
            target: "open",
            assign: highlightFirstOrSelected,
          },
          "TRIGGER.CLICK": {
            target: "open",
            assign: highlightFirstOrSelected,
          },
          OPEN: {
            target: "open",
            assign: highlightFirstOrSelected,
          },
          "CONTROLLED.OPEN": {
            target: "open",
            assign: highlightFirstOrSelected,
          },
        },
      },
      focused: {
        on: {
          "TRIGGER.BLUR": { target: "idle" },
          "TRIGGER.CLICK": {
            target: "open",
            assign: highlightFirstOrSelected,
          },
          TOGGLE: {
            target: "open",
            assign: highlightFirstOrSelected,
          },
          OPEN: {
            target: "open",
            assign: highlightFirstOrSelected,
          },
          "CONTROLLED.OPEN": {
            target: "open",
            assign: highlightFirstOrSelected,
          },
          // The trigger's own open gestures: Enter and the arrows open with
          // the highlight pre-placed (first for Enter/Down, last for Up).
          "TRIGGER.ARROW_DOWN": [
            { target: "open", assign: highlightFirst },
          ],
          "TRIGGER.ARROW_UP": [
            { target: "open", assign: highlightLast },
          ],
          "TRIGGER.ENTER": [
            { target: "open", assign: highlightFirst },
          ],
          // The closed-mode selection moves: single-select cycles the
          // selection itself while closed.
          "TRIGGER.ARROW_RIGHT": [
            { cond: single, assign: (ctx) => {
        const at = ctx.value.length === 0 ? -1 : ctx.order.indexOf(ctx.value[0]!);
        const next = ctx.order[at + 1];
        return next === undefined ? {} : { value: [next] };
      } },
          ],
          "TRIGGER.ARROW_LEFT": [
            { cond: single, assign: (ctx) => {
        const at = ctx.value.length === 0
          ? ctx.order.length
          : ctx.order.indexOf(ctx.value[0]!);
        const previous = ctx.order[at - 1];
        return previous === undefined ? {} : { value: [previous] };
      } },
          ],
          "TRIGGER.HOME": [
            { cond: single, assign: (ctx) => { return ({
        value: ctx.order.length === 0 ? ctx.value : [ctx.order[0]!],
      }); } },
          ],
          "TRIGGER.END": [
            { cond: single, assign: (ctx) => { return ({
        value: ctx.order.length === 0
          ? ctx.value
          : [ctx.order[ctx.order.length - 1]!],
      }); } },
          ],
          "TRIGGER.TYPEAHEAD": [
            { cond: single, assign: (ctx, event) => {
        const value = ctx.order.find((candidate) =>
          (ctx.labels[candidate] ?? candidate).toLowerCase().startsWith(
            event.value.toLowerCase(),
          )
        );
        return value === undefined ? {} : { value: [value] };
      } },
          ],
        },
      },
      open: {
        on: {
          "TRIGGER.CLICK": {
            target: "focused",
            assign: clearHighlighted,
          },
          "ITEM.CLICK": [
            {
              cond: (ctx) => { return ctx.closeOnSelect; },
              target: "focused",
              assign: [selectClicked, clearHighlighted],
            },
            { assign: selectClicked },
          ],
          CLOSE: [{ target: "idle", assign: clearHighlighted }],
          TOGGLE: [{ target: "idle", assign: clearHighlighted }],
          "CONTROLLED.CLOSE": [
            {
              cond: restoreFocus,
              target: "focused",
              assign: clearHighlighted,
            },
            { target: "idle", assign: clearHighlighted },
          ],
          "LAYER.ESCAPE": [
            { target: "focused", assign: clearHighlighted },
          ],
          "LAYER.INTERACT_OUTSIDE": [
            {
              cond: restoreFocus,
              target: "focused",
              assign: clearHighlighted,
            },
            { target: "idle", assign: clearHighlighted },
          ],
          "CONTENT.HOME": { assign: highlightFirst },
          "CONTENT.END": { assign: highlightLast },
          "CONTENT.ARROW_DOWN": { assign: (ctx) => {
        const at = inCollection(ctx, ctx.highlightedValue)
          ? ctx.order.indexOf(ctx.highlightedValue)
          : -1;
        if (at === -1) return { highlightedValue: ctx.order[0] ?? null };
        const next = ctx.order[at + 1];
        if (next === undefined) {
          return ctx.loopFocus ? { highlightedValue: ctx.order[0] ?? null } : {};
        }
        return { highlightedValue: next };
      } },
          "CONTENT.ARROW_UP": { assign: (ctx) => {
        const at = inCollection(ctx, ctx.highlightedValue)
          ? ctx.order.indexOf(ctx.highlightedValue)
          : -1;
        if (at === -1) {
          return { highlightedValue: ctx.order[ctx.order.length - 1] ?? null };
        }
        const previous = ctx.order[at - 1];
        if (previous === undefined) {
          return ctx.loopFocus
            ? { highlightedValue: ctx.order[ctx.order.length - 1] ?? null }
            : {};
        }
        return { highlightedValue: previous };
      } },
          "CONTENT.TYPEAHEAD": { assign: (ctx, event) => {
        const value = ctx.order.find((candidate) =>
          (ctx.labels[candidate] ?? candidate).toLowerCase().startsWith(
            event.value.toLowerCase(),
          )
        );
        return value === undefined ? {} : { highlightedValue: value };
      } },
          "ITEM.POINTER_MOVE": { assign: setHighlighted },
          "ITEM.POINTER_LEAVE": { assign: clearHighlighted },
        },
      },
    },});
}
