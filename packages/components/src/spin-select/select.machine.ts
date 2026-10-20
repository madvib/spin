/**
 * Select machine: closed and unfocused (`idle`), closed and focused
 * (`focused`), open (`open`) — plus the selection, the highlight, and the
 * placement the content was last positioned at.
 *
 * Zag ships exactly these three states, with the value/highlight events on
 * the root tier. The fork has no nesting, so the root tier is the root `on`
 * and the closed states shadow only what Zag defines per-state.
 *
 * The controlled-open events (`CONTROLLED.OPEN` / `CONTROLLED.CLOSE`) carry
 * Zag's "was the open state authored" distinction: the bridge reports a host
 * write as one of these, and the machine moves only when the host owns the
 * state. A host that never writes `open` sends plain `OPEN`/`CLOSE` and the
 * machine owns it. Which of the two a close lands in (`focused` vs `idle`)
 * is the restoreFocus question, decided by who asked: a layer dismissal
 * after a non-focusable interaction lands in `idle`; everything else the
 * trigger focused, so it returns to `focused`.
 *
 * Navigation is NOT here. Arrows, Home and End compute their target against
 * the collection the view holds — the connect sends the resolved value or a
 * `CONTENT.*` event, exactly as the combobox and listbox ports do. The
 * machine reads `order` and `labels` (the element's derived sync over the
 * `items` prop) for the selection's string form and the "is the highlight
 * still in the collection" question.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface SelectContext {
  /** The selected values, in the order they were added. */
  value: string[];
  highlightedValue: string | null;
  /** The collection's values in order. The element keeps it in step with
   * the `items` prop — a derived sync, not a host write. */
  order: string[];
  /** The collection's labels by value. The element keeps it in step with
   * the `items` prop — a derived sync, not a host write. */
  labels: Record<string, string>;
  multiple: boolean;
  closeOnSelect: boolean;
  loopFocus: boolean;
}

export type SelectEvent =
  | { type: "SELECTED_ITEMS.SYNC" }
  | { type: "HIGHLIGHTED_VALUE.SET"; highlightedValue: string | null }
  | { type: "HIGHLIGHTED_VALUE.CLEAR" }
  | { type: "ITEM.SELECT"; value: string }
  | { type: "ITEM.CLEAR"; value: string }
  | { type: "VALUE.SET"; value: readonly string[] }
  | { type: "VALUE.CLEAR" }
  | { type: "CLEAR.CLICK" }
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "TOGGLE" }
  | { type: "CONTROLLED.OPEN" }
  | { type: "CONTROLLED.CLOSE"; restoreFocus?: boolean }
  | { type: "TRIGGER.CLICK" }
  | { type: "TRIGGER.FOCUS" }
  | { type: "TRIGGER.BLUR" }
  | { type: "TRIGGER.ENTER" }
  | { type: "TRIGGER.ARROW_UP" }
  | { type: "TRIGGER.ARROW_DOWN" }
  | { type: "TRIGGER.ARROW_LEFT" }
  | { type: "TRIGGER.ARROW_RIGHT" }
  | { type: "TRIGGER.HOME" }
  | { type: "TRIGGER.END" }
  | { type: "TRIGGER.TYPEAHEAD"; value: string }
  | { type: "ITEM.CLICK"; value: string }
  | { type: "ITEM.POINTER_MOVE"; value: string }
  | { type: "ITEM.POINTER_LEAVE" }
  | { type: "CONTENT.HOME" }
  | { type: "CONTENT.END" }
  | { type: "CONTENT.ARROW_UP" }
  | { type: "CONTENT.ARROW_DOWN" }
  | { type: "CONTENT.TYPEAHEAD"; value: string }
  | { type: "LAYER.ESCAPE" }
  | { type: "LAYER.INTERACT_OUTSIDE"; restoreFocus?: boolean };

/** The label the trigger shows for one value, or the joined many. */
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
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twins
 * (`defaultValue`, `defaultHighlightedValue`) are resolved by the
 * framework before the factory is called, so the machine only ever sees
 * the live values.
 */
export interface SelectArgs {
  /** The selected values, as the host wrote them. */
  value?: string | readonly string[];
  /** The highlighted value, as the host wrote it. */
  highlightedValue?: string;
  /** The collection, as the host wrote it. */
  items?: string | readonly SelectRow[];
  /** Whether the select takes many values. */
  multiple?: boolean;
  /**
   * Whether a pick closes the panel. The machine's own default is Zag's
   * (`!multiple`); a host that writes the prop owns it, and the machine's
   * contract carries that write.
   */
  closeOnSelect?: boolean;
  /** Whether the arrow walk loops. */
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

/** The collection's rows, off any transport: a row needs a value, and
 * the label falls back to the value. */
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
 * The close-on-select flag and the highlight are channels: the host's
 * write, or the machine's own default. The element's declared default is
 * not a write, so it never stands in for one. The seed twins
 * (`defaultHighlightedValue`) are the host's writes of the highlight — the
 * framework resolved them into the args — so they count as writes too.
 * The collection, the selection and the modes are the element's own data,
 * as they are.
 */
export function initial(args: SelectArgs, authored: (name: string) => boolean): SelectContext {
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention — a host that wrote
  // `defaultHighlightedValue` wrote the channel too — and the framework
  // has already resolved it into the argument.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  const rows = rowsOf(args.items);
  const multiple = args.multiple === true;
  // Zag's default: a multiple select keeps its panel open over each pick.
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

/** True when the value is still in the synced collection. */
const inCollection = (
  ctx: SelectContext,
  value: string | null,
): value is string => value !== null && ctx.order.includes(value);

/**
 * The select machine: state and nothing else. It is headless — it knows
 * its own arguments, and nothing about props, markup, or the DOM.
 */
export function select(
  args: SelectArgs = {},
  authored: (name: string) => boolean,
): Machine<SelectContext, SelectEvent> {
  return createMachine<SelectContext, SelectEvent>({
    id: "select",
    initial: "idle",
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
      highlightedValue: { event: "HIGHLIGHTED_VALUE.SET" },
      closeOnSelect: {},
    },
    context: initial(args, authored),
    // The root tier: the value and highlight events Zag fires from every
    // state, so a controlled write or a programmatic select lands the same
    // whatever the panel is doing.
    on: {
      "SELECTED_ITEMS.SYNC": { actions: [{ assign: "dropVanishedSelection" }] },
      "HIGHLIGHTED_VALUE.SET": { actions: [{ assign: "setHighlighted" }] },
      "HIGHLIGHTED_VALUE.CLEAR": { actions: [{ assign: "clearHighlighted" }] },
      "ITEM.SELECT": { actions: [{ assign: "selectValue" }] },
      "ITEM.CLEAR": { actions: [{ assign: "clearValue" }] },
      "VALUE.SET": { actions: [{ assign: "setValue" }] },
      "VALUE.CLEAR": { actions: [{ assign: "clearValue" }] },
      "CLEAR.CLICK": { actions: [{ assign: "clearSelectionAndHighlight" }] },
    },
    states: {
      idle: {
        on: {
          "TRIGGER.FOCUS": { target: "focused" },
          // The imperative toggle: OPEN's own transition, so the highlight
          // pre-places exactly as a gesture open does.
          TOGGLE: {
            target: "open",
            actions: [{ assign: "highlightFirstOrSelected" }],
          },
          "TRIGGER.CLICK": {
            target: "open",
            actions: [{ assign: "highlightFirstOrSelected" }],
          },
          OPEN: {
            target: "open",
            actions: [{ assign: "highlightFirstOrSelected" }],
          },
          "CONTROLLED.OPEN": {
            target: "open",
            actions: [{ assign: "highlightFirstOrSelected" }],
          },
        },
      },
      focused: {
        on: {
          "TRIGGER.BLUR": { target: "idle" },
          "TRIGGER.CLICK": {
            target: "open",
            actions: [{ assign: "highlightFirstOrSelected" }],
          },
          TOGGLE: {
            target: "open",
            actions: [{ assign: "highlightFirstOrSelected" }],
          },
          OPEN: {
            target: "open",
            actions: [{ assign: "highlightFirstOrSelected" }],
          },
          "CONTROLLED.OPEN": {
            target: "open",
            actions: [{ assign: "highlightFirstOrSelected" }],
          },
          // The trigger's own open gestures: Enter and the arrows open with the
          // highlight pre-placed (first for Enter/Down, last for Up), and the
          // closed-mode arrows only move the selection when they do NOT open.
          "TRIGGER.ARROW_DOWN": [
            { target: "open", actions: [{ assign: "highlightFirst" }] },
          ],
          "TRIGGER.ARROW_UP": [
            { target: "open", actions: [{ assign: "highlightLast" }] },
          ],
          "TRIGGER.ENTER": [
            { target: "open", actions: [{ assign: "highlightFirst" }] },
          ],
          // The closed-mode selection moves: single-select cycles the
          // selection itself while closed, which is Zag's trigger-level
          // behavior for the non-multiple case.
          "TRIGGER.ARROW_RIGHT": [
            { cond: "single", actions: [{ assign: "selectNextInOrder" }] },
          ],
          "TRIGGER.ARROW_LEFT": [
            { cond: "single", actions: [{ assign: "selectPreviousInOrder" }] },
          ],
          "TRIGGER.HOME": [
            { cond: "single", actions: [{ assign: "selectFirstInOrder" }] },
          ],
          "TRIGGER.END": [
            { cond: "single", actions: [{ assign: "selectLastInOrder" }] },
          ],
          "TRIGGER.TYPEAHEAD": [
            { cond: "single", actions: [{ assign: "selectMatchingInOrder" }] },
          ],
        },
      },
      open: {
        on: {
          "TRIGGER.CLICK": {
            target: "focused",
            actions: [{ assign: "clearHighlighted" }],
          },
          "ITEM.CLICK": [
            {
              cond: "closeOnSelect",
              target: "focused",
              actions: [{ assign: "selectClicked" }, {
                assign: "clearHighlighted",
              }],
            },
            { actions: [{ assign: "selectClicked" }] },
          ],
          CLOSE: [{ target: "idle", actions: [{ assign: "clearHighlighted" }] }],
          TOGGLE: [{ target: "idle", actions: [{ assign: "clearHighlighted" }] }],
          "CONTROLLED.CLOSE": [
            {
              cond: "restoreFocus",
              target: "focused",
              actions: [{ assign: "clearHighlighted" }],
            },
            { target: "idle", actions: [{ assign: "clearHighlighted" }] },
          ],
          "LAYER.ESCAPE": [
            { target: "focused", actions: [{ assign: "clearHighlighted" }] },
          ],
          "LAYER.INTERACT_OUTSIDE": [
            {
              cond: "restoreFocus",
              target: "focused",
              actions: [{ assign: "clearHighlighted" }],
            },
            { target: "idle", actions: [{ assign: "clearHighlighted" }] },
          ],
          "CONTENT.HOME": { actions: [{ assign: "highlightFirst" }] },
          "CONTENT.END": { actions: [{ assign: "highlightLast" }] },
          "CONTENT.ARROW_DOWN": { actions: [{ assign: "highlightNext" }] },
          "CONTENT.ARROW_UP": { actions: [{ assign: "highlightPrevious" }] },
          "CONTENT.TYPEAHEAD": { actions: [{ assign: "highlightMatching" }] },
          "ITEM.POINTER_MOVE": { actions: [{ assign: "setHighlighted" }] },
          "ITEM.POINTER_LEAVE": { actions: [{ assign: "clearHighlighted" }] },
        },
      },
    },
    conds: {
      single: (ctx: SelectContext): boolean => !ctx.multiple,
      closeOnSelect: (ctx: SelectContext): boolean => ctx.closeOnSelect,
      restoreFocus: (_ctx: SelectContext, event: SelectEvent): boolean => {
        if (
          event.type === "CONTROLLED.CLOSE" ||
          event.type === "LAYER.INTERACT_OUTSIDE"
        ) {
          return event.restoreFocus !== false;
        }
        return true;
      },
    },
    assigns: {
      setHighlighted: (
        ctx: SelectContext,
        event: SelectEvent,
      ): Partial<SelectContext> => {
        // The highlight arrives the way the host wrote it — a value, or
        // nothing at all; the field holds it as it comes.
        if (event.type === "HIGHLIGHTED_VALUE.SET") {
          return { highlightedValue: event.highlightedValue };
        }
        if (event.type === "ITEM.POINTER_MOVE") {
          return { highlightedValue: event.value };
        }
        return { highlightedValue: ctx.highlightedValue };
      },
      clearHighlighted: (): Partial<SelectContext> => ({
        highlightedValue: null,
      }),
      setValue: (
        _ctx: SelectContext,
        event: SelectEvent,
      ): Partial<SelectContext> =>
        event.type === "VALUE.SET" ? { value: [...event.value] } : {},
      clearValue: (): Partial<SelectContext> => ({ value: [] }),
      clearSelectionAndHighlight: (): Partial<SelectContext> => ({
        value: [],
        highlightedValue: null,
      }),
      // ITEM.SELECT adds (single) or toggles (multiple); the guard on the
      // event's type is what keeps the assign signature honest.
      selectValue: (
        ctx: SelectContext,
        event: SelectEvent,
      ): Partial<SelectContext> => {
        if (event.type !== "ITEM.SELECT") return {};
        if (ctx.multiple) {
          return {
            value: ctx.value.includes(event.value)
              ? ctx.value.filter((value) => value !== event.value)
              : [...ctx.value, event.value],
          };
        }
        return { value: [event.value] };
      },
      // The click carries the row it landed on: a click without a preceding
      // pointer-move must still select the row under the cursor, which is why
      // this is not the highlight.
      selectClicked: (
        ctx: SelectContext,
        event: SelectEvent,
      ): Partial<SelectContext> => {
        if (event.type !== "ITEM.CLICK") return {};
        if (ctx.multiple) {
          return {
            value: ctx.value.includes(event.value)
              ? ctx.value.filter((value) => value !== event.value)
              : [...ctx.value, event.value],
          };
        }
        return { value: [event.value] };
      },
      selectHighlighted: (ctx: SelectContext): Partial<SelectContext> => {
        if (!inCollection(ctx, ctx.highlightedValue)) return {};
        if (ctx.multiple) {
          return {
            value: ctx.value.includes(ctx.highlightedValue)
              ? ctx.value.filter((value) => value !== ctx.highlightedValue)
              : [...ctx.value, ctx.highlightedValue],
          };
        }
        return { value: [ctx.highlightedValue] };
      },
      highlightFirstOrSelected: (ctx: SelectContext): Partial<SelectContext> => {
        const selected = ctx.value.find((value) => ctx.order.includes(value));
        if (selected !== undefined) return { highlightedValue: selected };
        return { highlightedValue: ctx.order[0] ?? null };
      },
      highlightFirst: (ctx: SelectContext): Partial<SelectContext> => ({
        highlightedValue: ctx.order[0] ?? null,
      }),
      highlightLast: (ctx: SelectContext): Partial<SelectContext> => ({
        highlightedValue: ctx.order[ctx.order.length - 1] ?? null,
      }),
      highlightNext: (ctx: SelectContext): Partial<SelectContext> => {
        const at = inCollection(ctx, ctx.highlightedValue)
          ? ctx.order.indexOf(ctx.highlightedValue)
          : -1;
        if (at === -1) return { highlightedValue: ctx.order[0] ?? null };
        const next = ctx.order[at + 1];
        if (next === undefined) {
          return ctx.loopFocus ? { highlightedValue: ctx.order[0] ?? null } : {};
        }
        return { highlightedValue: next };
      },
      highlightPrevious: (ctx: SelectContext): Partial<SelectContext> => {
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
      },
      highlightMatching: (
        ctx: SelectContext,
        event: SelectEvent,
      ): Partial<SelectContext> => {
        if (event.type !== "CONTENT.TYPEAHEAD") return {};
        const value = ctx.order.find((candidate) =>
          (ctx.labels[candidate] ?? candidate).toLowerCase().startsWith(
            event.value.toLowerCase(),
          )
        );
        return value === undefined ? {} : { highlightedValue: value };
      },
      // The closed-mode selection moves: the trigger itself changes the
      // selection without opening.
      selectFirstInOrder: (ctx: SelectContext): Partial<SelectContext> => ({
        value: ctx.order.length === 0 ? ctx.value : [ctx.order[0]!],
      }),
      selectLastInOrder: (ctx: SelectContext): Partial<SelectContext> => ({
        value: ctx.order.length === 0
          ? ctx.value
          : [ctx.order[ctx.order.length - 1]!],
      }),
      selectNextInOrder: (ctx: SelectContext): Partial<SelectContext> => {
        const at = ctx.value.length === 0 ? -1 : ctx.order.indexOf(ctx.value[0]!);
        const next = ctx.order[at + 1];
        return next === undefined ? {} : { value: [next] };
      },
      selectPreviousInOrder: (ctx: SelectContext): Partial<SelectContext> => {
        const at = ctx.value.length === 0
          ? ctx.order.length
          : ctx.order.indexOf(ctx.value[0]!);
        const previous = ctx.order[at - 1];
        return previous === undefined ? {} : { value: [previous] };
      },
      selectMatchingInOrder: (
        ctx: SelectContext,
        event: SelectEvent,
      ): Partial<SelectContext> => {
        if (event.type !== "TRIGGER.TYPEAHEAD") return {};
        const value = ctx.order.find((candidate) =>
          (ctx.labels[candidate] ?? candidate).toLowerCase().startsWith(
            event.value.toLowerCase(),
          )
        );
        return value === undefined ? {} : { value: [value] };
      },
      // A collection change can strand the selection and the highlight.
      dropVanishedSelection: (ctx: SelectContext): Partial<SelectContext> => {
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
      },
    },
  });
}
