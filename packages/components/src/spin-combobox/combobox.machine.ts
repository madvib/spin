/**
 * Combobox machine: the four phases — closed and unfocused, closed and
 * focused, open with the user driving (`interacting`), open with the input
 * proposing (`suggesting`) — plus the selection, the input text, the
 * highlight and the inline completion.
 *
 * There is no nesting and no parent: the root tier and the open phase's
 * shared handlers both sit at the root, and the two closed states shadow the
 * ones the root does not define there. The fork tries state handlers first
 * and falls through to the root, so an unconditional state handler shadows a
 * root one — which is the whole reason this needs no nesting.
 *
 * `VALUE.CLEAR` has the same effect in every state — "clear the selection
 * and the input, and land in `focused`" — so it is one root handler.
 *
 * Navigation is NOT here. Arrows, Home and End compute their target against
 * the rows the view holds — including the disabled ones they must skip —
 * and send `INPUT.ARROW_DOWN` (and its siblings) carrying that value, exactly
 * as the listbox's `NAVIGATE` does. What the machine does read is `order` and
 * `labels`, the collection synced from scope by the bridge, because the
 * selection's string form, the "is the highlight still in the collection"
 * question and the auto-highlight of a fresh suggestion are statements about
 * positions, not about rows.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const setHighlightedValue = (ctx: ComboboxContext, e: ComboboxEvent) : Partial<ComboboxContext> => {
      // ITEM.POINTER_MOVE carries the row's value directly (the pointer is
      // already there); HIGHLIGHTED_VALUE.SET carries it with a keypress
      // flag for inline completion.
      if (e.type === "ITEM.POINTER_MOVE") {
        return { highlightedValue: e.value, autofill: completion(ctx, e.value, false) };
      }
      if (e.type !== "HIGHLIGHTED_VALUE.SET" || e.value === null) return {};
      return {
        highlightedValue: e.value,
        autofill: completion(ctx, e.value, e.keypress === true),
      };
    };

const clearHighlightedValue = () : Partial<ComboboxContext> => { return ({
      highlightedValue: null,
      autofill: null,
    }); };

const moveHighlight = (ctx: ComboboxContext, e: ComboboxEvent) : Partial<ComboboxContext> => {
      if (!isMove(e) || e.value === undefined) return {};
      return {
        highlightedValue: e.value,
        autofill: completion(ctx, e.value, e.keypress === true),
      };
    };

const highlightFirstItem = (ctx: ComboboxContext) : Partial<ComboboxContext> => { return ctx.order.length === 0 ? {} : { highlightedValue: at(ctx.order, 0), autofill: null }; };

const highlightFirstOrSelectedItem = (ctx: ComboboxContext) : Partial<ComboboxContext> => {
      const selected = ctx.order.filter((value) => ctx.value.includes(value));
      const value = selected.length > 0 ? at(selected, 0) : at(ctx.order, 0);
      if (value === null) return {};
      return { highlightedValue: value, autofill: null };
    };

const selectItem = (ctx: ComboboxContext, e: ComboboxEvent) : Partial<ComboboxContext> => {
      if (e.type !== "ITEM.SELECT" && e.type !== "ITEM.CLICK") return {};
      return applySelection(ctx, pickValue(ctx, e.value));
    };

const selectHighlightedItem = (ctx: ComboboxContext, e: ComboboxEvent) : Partial<ComboboxContext> => {
      if (e.type !== "INPUT.ENTER") return {};
      // A highlight the collection cannot resolve selects nothing.
      if (ctx.highlightedValue === null || !ctx.order.includes(ctx.highlightedValue)) return {};
      return applySelection(ctx, pickValue(ctx, ctx.highlightedValue));
    };

const clearValue = (ctx: ComboboxContext) : Partial<ComboboxContext> => { return applySelection(ctx, []); };

const clearInputValue = () : Partial<ComboboxContext> => { return ({ inputValue: "", autofill: null }); };

const setInputValue = (_ctx: ComboboxContext, e: ComboboxEvent) : Partial<ComboboxContext> => {
      if (e.type !== "INPUT.CHANGE" && e.type !== "INPUT_VALUE.SET") return {};
      return { inputValue: e.value, autofill: null };
    };

const revertInputValue = (ctx: ComboboxContext) : Partial<ComboboxContext> => {
      if (ctx.selectionBehavior === "preserve") return {};
      if (ctx.selectionBehavior === "clear") return { inputValue: "", autofill: null };
      return {
        inputValue: ctx.value.length > 0 ? stringifyValues(ctx, ctx.value) : "",
        autofill: null,
      };
    };

const inlineAutocomplete = (ctx: ComboboxContext) : boolean => { return inlineSingle(ctx); };

const closeOnSelect = (ctx: ComboboxContext) : boolean => { return ctx.closeOnSelect; };

const revertsToValue = (ctx: ComboboxContext) : boolean => { return isCustomValue(ctx) && !ctx.allowCustomValue && ctx.highlightedValue === null; };



export interface ComboboxContext {
  value: string[];
  inputValue: string;
  highlightedValue: string | null;
  /**
   * The inline completion the input shows while a keypress-driven highlight
   * is live. It is written straight into the input element rather than
   * into `inputValue`, so the machine's own text stays what the user typed
   * and `isCustomValue` keeps answering about that.
   */
  autofill: string | null;
  order: string[];
  labels: Record<string, string>;
  multiple: boolean;
  closeOnSelect: boolean;
  allowCustomValue: boolean;
  inputBehavior: "none" | "autocomplete" | "autohighlight";
  selectionBehavior: "replace" | "preserve" | "clear";
  openOnChange: boolean;
}

export interface ComboboxEvents {
  "SELECTED_ITEMS.SYNC": {};
  "HIGHLIGHTED_VALUE.SET": { value: string | null; keypress?: boolean };
  "HIGHLIGHTED_VALUE.CLEAR": {};
  "ITEM.SELECT": { value: string };
  "ITEM.CLEAR": { value: string };
  "VALUE.SET": { value: readonly string[] };
  "VALUE.CLEAR": {};
  "INPUT_VALUE.SET": { value: string };
  "OPEN": {};
  "CLOSE": {};
  "INPUT.FOCUS": {};
  "INPUT.BLUR": {};
  "INPUT.CLICK": {};
  "INPUT.CHANGE": { value: string };
  "INPUT.ESCAPE": {};
  "INPUT.ENTER": {};
  "INPUT.ARROW_DOWN": { value?: string; keypress?: boolean };
  "INPUT.ARROW_UP": { value?: string; keypress?: boolean };
  "INPUT.HOME": { value?: string; keypress?: boolean };
  "INPUT.END": { value?: string; keypress?: boolean };
  "TRIGGER.CLICK": {};
  "ITEM.CLICK": { value: string };
  "ITEM.POINTER_MOVE": { value: string };
  "ITEM.POINTER_LEAVE": {};
  "LAYER.ESCAPE": {};
  "LAYER.INTERACT_OUTSIDE": {};
  "CHILDREN_CHANGE": {};
}

export type ComboboxEvent = EventUnion<ComboboxEvents>;


export interface ComboboxRow {
  readonly value?: string;
  readonly label?: string;
}

/**
 * The combobox's arguments: the values the host may set.
 */
export interface ComboboxArgs {
  items?: readonly ComboboxRow[];
  value?: string;
  inputValue?: string;
  highlightedValue?: string;
  multiple?: boolean;
  closeOnSelect?: boolean;
  allowCustomValue?: boolean;
  inputBehavior?: string;
  selectionBehavior?: string;
  openOnChange?: boolean;
  defaultOpenOnChange?: boolean;
}

const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw !== "string") return [];
  return raw.length > 0 ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
};
const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");
const nullableProp = (raw: unknown): string | null => (typeof raw === "string" && raw.length > 0 ? raw : null);

/**
 * The machine's context. The collection, the selection and the highlight
 * are the machine's own — no host may write them.
 */
export function initial(args: ComboboxArgs, authored: (name: string) => boolean): ComboboxContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const multiple = written("multiple") ? args.multiple === true : false;
  const selectionRaw = args.selectionBehavior;
  const selectionBehavior = written("selectionBehavior")
    ? (selectionRaw === "preserve" || selectionRaw === "clear"
      ? selectionRaw
      : multiple
      ? "clear"
      : "replace")
    : (multiple ? "clear" : "replace");
  const behaviorRaw = args.inputBehavior;
  const inputBehavior = written("inputBehavior")
    ? (behaviorRaw === "autocomplete" || behaviorRaw === "autohighlight"
      ? behaviorRaw
      : "none")
    : "none";
  const rows = Array.isArray(args.items) ? args.items.filter((x): x is ComboboxRow => typeof x === "object" && x !== null) : [];
  const order = rows.map((r) => (typeof r.value === "string" ? r.value : "")).filter(Boolean);
  const labels = Object.fromEntries(rows.map((r) => [String(r.value), typeof r.label === "string" ? r.label : String(r.value)] as const));
  const value = parseKeys(args.value);
  // The scope's `highlightedValue` default is "", so an unauthored
  // highlight looks present.
  const highlighted = nullableProp(args.highlightedValue);
  // The default `closeOnSelect` is `!props.multiple` — a coerced default is
  // not a write, so an explicit `closeOnSelect` is the only thing that
  // overrides the mode's own answer.
  const closeOnSelect = written("closeOnSelect") ? args.closeOnSelect === true : !multiple;
  const allowCustomValue = written("allowCustomValue") ? args.allowCustomValue === true : false;
  const openOnChange = written("openOnChange") ? args.openOnChange !== false : true;
  const seedCtx: ComboboxContext = {
    value,
    inputValue: "",
    highlightedValue: highlighted,
    autofill: null,
    order,
    labels,
    multiple,
    closeOnSelect,
    allowCustomValue,
    inputBehavior,
    selectionBehavior,
    openOnChange,
  };
  const valueAsString = value.map((v) => labels[v] ?? v).join(", ");
  const seeded = textProp(args.inputValue);
  const inputValue = seeded.trim().length > 0 || multiple ? seeded : (selectionBehavior === "clear" ? "" : valueAsString);
  return { ...seedCtx, inputValue };
}

const config: MachineSpec<ComboboxContext, ComboboxEvents> = {
  id: "combobox",
  initial: "idle",
  context: {
    value: [] as string[],
    inputValue: "",
    highlightedValue: null as string | null,
    autofill: null as string | null,
    order: [] as string[],
    labels: {} as Record<string, string>,
    multiple: false,
    closeOnSelect: true,
    allowCustomValue: false,
    inputBehavior: "none" as "none" | "autocomplete" | "autohighlight",
    selectionBehavior: "replace" as "replace" | "preserve" | "clear",
    openOnChange: true,
  },
  on: {
    "SELECTED_ITEMS.SYNC": { assign: (ctx) => { return ({
      inputValue: inputValueFor(ctx, ctx.value),
      autofill: null,
    }); } },
    "HIGHLIGHTED_VALUE.SET": { assign: setHighlightedValue },
    "HIGHLIGHTED_VALUE.CLEAR": { assign: clearHighlightedValue },
    "ITEM.SELECT": { assign: selectItem },
    "ITEM.CLEAR": { assign: (ctx, e) => {
      if (e.type !== "ITEM.CLEAR") return {};
      return applySelection(
        ctx,
        ctx.value.filter((value) => value !== e.value),
      );
    } },
    "VALUE.SET": { assign: (ctx, e) => { return e.type === "VALUE.SET" ? applySelection(ctx, e.value) : {}; } },
    "INPUT_VALUE.SET": { assign: setInputValue },
    OPEN: { target: "interacting" },
    CLOSE: { target: "focused" },
    "VALUE.CLEAR": { target: "focused", assign: [clearInputValue, clearValue] },
    // The root INPUT.ESCAPE (guard: custom value the machine refuses) must
    // land in every state — a typed query in `suggesting` reverts the same
    // way a typed query in `focused` does — so the closed states shadow it
    // only where they must.
    "INPUT.ESCAPE": [
      {
        cond: revertsToValue,
        assign: revertInputValue,
      },
    ],
    "INPUT.ENTER": [
      {
        cond: revertsToValue,
        target: "focused",
        assign: revertInputValue,
      },
      {
        cond: closeOnSelect,
        target: "focused",
        assign: selectHighlightedItem,
      },
      { assign: selectHighlightedItem },
    ],
    "ITEM.CLICK": [
      {
        cond: closeOnSelect,
        target: "focused",
        assign: selectItem,
      },
      { assign: selectItem },
    ],
    "TRIGGER.CLICK": { target: "focused" },
    "LAYER.INTERACT_OUTSIDE": [
      {
        cond: (ctx) => { return isCustomValue(ctx) && !ctx.allowCustomValue; },
        target: "idle",
        assign: revertInputValue,
      },
      { target: "idle" },
    ],
  },
  states: {
    idle: {
      entry: [{ assign: clearHighlightedValue }],
      on: {
        "INPUT.FOCUS": { target: "focused" },
        "TRIGGER.CLICK": {
          target: "interacting",
          assign: highlightFirstOrSelectedItem,
        },
        "INPUT.CLICK": {
          target: "interacting",
          assign: highlightFirstOrSelectedItem,
        },
        // Enter and item clicks belong to the open phase; a closed combobox
        // has no panel to act on.
        "INPUT.ENTER": { },
        "ITEM.CLICK": { },
      },
    },
    focused: {
      entry: [{ assign: clearHighlightedValue }],
      on: {
        "INPUT.BLUR": { target: "idle" },
        "INPUT.CHANGE": [
          {
            cond: (ctx) => { return ctx.openOnChange; },
            target: "suggesting",
            assign: [setInputValue, (ctx) => { return ctx.inputBehavior !== "autohighlight" || ctx.order.length === 0
        ? {}
        : { highlightedValue: at(ctx.order, 0), autofill: null }; }],
          },
          { assign: setInputValue },
        ],
        "INPUT.ESCAPE": [
          { cond: revertsToValue, assign: revertInputValue },
        ],
        "INPUT.CLICK": {
          target: "interacting",
          assign: highlightFirstOrSelectedItem,
        },
        "TRIGGER.CLICK": {
          target: "interacting",
          assign: highlightFirstOrSelectedItem,
        },
        // With an inline completion the arrow opens the panel and leaves the
        // highlight alone; without one it opens and adopts the first (or the
        // first selected) value.
        "INPUT.ARROW_DOWN": [
          { cond: inlineAutocomplete, target: "interacting" },
          {
            target: "interacting",
            assign: highlightFirstOrSelectedItem,
          },
        ],
        "INPUT.ARROW_UP": [
          { cond: inlineAutocomplete, target: "interacting" },
          {
            target: "interacting",
            assign: (ctx) => {
      const selected = ctx.order.filter((value) => ctx.value.includes(value));
      const value = selected.length > 0 ? at(selected, 0) : at(ctx.order, -1);
      if (value === null) return {};
      return { highlightedValue: value, autofill: null };
    },
          },
        ],
        // The closed, focused phase dismisses with no revert: the text the
        // user typed is theirs. This MUST shadow the root's reverting
        // candidate — state handlers are tried first.
        "LAYER.INTERACT_OUTSIDE": { target: "idle" },
        "LAYER.ESCAPE": { target: "idle" },
        // The clear word keeps the highlight here: an internal transition
        // runs no entry action, so the highlight survives the clear.
        "VALUE.CLEAR": { assign: [clearInputValue, clearValue] },
        "INPUT.ENTER": { },
        "ITEM.CLICK": { },
      },
    },
    interacting: {
      on: {
        "CHILDREN_CHANGE": {
          assign: (ctx) => { return ctx.highlightedValue !== null && !ctx.order.includes(ctx.highlightedValue)
        ? { highlightedValue: null, autofill: null }
        : {}; },
        },
        "INPUT.HOME": { assign: moveHighlight },
        "INPUT.END": { assign: moveHighlight },
        // An inline completion walks to the ends and then gives the text
        // back, so the last item is not a dead end.
        "INPUT.ARROW_DOWN": [
          { cond: (ctx) => { return inlineSingle(ctx) && ctx.highlightedValue === at(ctx.order, -1); }, assign: clearHighlightedValue },
          { assign: moveHighlight },
        ],
        "INPUT.ARROW_UP": [
          { cond: (ctx) => { return inlineSingle(ctx) && ctx.highlightedValue === at(ctx.order, 0); }, assign: clearHighlightedValue },
          { assign: moveHighlight },
        ],
        "INPUT.CHANGE": [
          {
            cond: inlineAutocomplete,
            target: "suggesting",
            assign: setInputValue,
          },
          {
            target: "suggesting",
            assign: [setInputValue, clearHighlightedValue],
          },
        ],
        "ITEM.POINTER_MOVE": { assign: setHighlightedValue },
        "ITEM.POINTER_LEAVE": { assign: clearHighlightedValue },
        // Escape out of a suggestion: the completion is dropped and the
        // input's own binding shows `inputValue` again — against an
        // uncontrolled field that means writing the value back into the DOM.
        // With autoComplete the completion is kept until the panel closes,
        // so only the highlight goes.
        "LAYER.ESCAPE": [
          { cond: inlineAutocomplete, assign: clearHighlightedValue },
          { target: "focused" },
        ],
      },
    },
    suggesting: {
      on: {
        "CHILDREN_CHANGE": [
          {
            cond: (ctx) => { return ctx.inputBehavior === "autohighlight" &&
      ctx.highlightedValue !== null &&
      !ctx.order.includes(ctx.highlightedValue) &&
      ctx.order.length > 0; },
            assign: [clearHighlightedValue, highlightFirstItem],
          },
          { cond: (ctx) => { return ctx.highlightedValue !== null && !ctx.order.includes(ctx.highlightedValue); }, assign: clearHighlightedValue },
          { cond: (ctx) => { return ctx.inputBehavior === "autohighlight"; }, assign: highlightFirstItem },
        ],
        "INPUT.ARROW_DOWN": {
          target: "interacting",
          assign: moveHighlight,
        },
        "INPUT.ARROW_UP": {
          target: "interacting",
          assign: moveHighlight,
        },
        "INPUT.HOME": {
          target: "interacting",
          assign: moveHighlight,
        },
        "INPUT.END": {
          target: "interacting",
          assign: moveHighlight,
        },
        "INPUT.CHANGE": { assign: setInputValue },
        "ITEM.POINTER_MOVE": {
          target: "interacting",
          assign: setHighlightedValue,
        },
        "ITEM.POINTER_LEAVE": { assign: clearHighlightedValue },
        "LAYER.ESCAPE": { target: "focused" },
      },
    },
  },
};

/** The four phases that mean "the panel is up" — two of the four are open,
 * and which is the question every `data-state` and open-change decision
 * asks. */
const OPEN_PHASES: Record<string, true> = { interacting: true, suggesting: true };

export const isOpenPhase = (phase: string): boolean => OPEN_PHASES[phase] === true;

/** The autoComplete behaviour, without the mode filter. */
const completesInline = (ctx: ComboboxContext): boolean => ctx.inputBehavior === "autocomplete";

/** The completion AND a single-mode selection, which is the combination the
 * arrow keys and the open transitions read. */
const inlineSingle = (ctx: ComboboxContext): boolean =>
  completesInline(ctx) && !ctx.multiple;

const labelOf = (ctx: ComboboxContext, value: string): string | undefined => ctx.labels[value];

/** The labels a set resolves to, joined, with a value the collection cannot
 * resolve contributing nothing. */
export const stringifyValues = (
  ctx: ComboboxContext,
  values: readonly string[],
): string =>
  values
    .map((value) => labelOf(ctx, value))
    .filter((label): label is string => label !== undefined)
    .join(", ");

/** The text an inline completion writes over the input: the highlighted
 * item's label, or what the user already had when it has none. */
const completion = (ctx: ComboboxContext, value: string, keypress: boolean): string | null => {
  if (!keypress || !completesInline(ctx)) return null;
  return labelOf(ctx, value) ?? ctx.inputValue;
};

/** The `selectionBehavior` match, applied to every value move: the input
 * is recomputed from the selection, kept, or emptied. */
const inputValueFor = (ctx: ComboboxContext, next: readonly string[]): string => {
  if (ctx.selectionBehavior === "preserve") return ctx.inputValue;
  if (ctx.selectionBehavior === "clear") return "";
  return stringifyValues(ctx, next);
};

const applySelection = (
  ctx: ComboboxContext,
  next: readonly string[],
): Partial<ComboboxContext> => ({
  value: [...next],
  inputValue: inputValueFor(ctx, next),
  // A selection commits text, so nothing is completing any more.
  autofill: null,
});

const toggle = (value: readonly string[], at: string): string[] =>
  value.includes(at) ? value.filter((v) => v !== at) : [...value, at];

/** Add-or-remove in `multiple` mode, replacement otherwise. */
const pickValue = (ctx: ComboboxContext, value: string): string[] =>
  ctx.multiple ? toggle(ctx.value, value) : [value];

/** The value a pick lands on, in one place so the bridge's `onSelect`
 * reports the same array the machine just assigned. */
export const pickOutcome = pickValue;

/** The input holds text the selection does not explain. */
const isCustomValue = (ctx: ComboboxContext): boolean =>
  ctx.inputValue !== stringifyValues(ctx, ctx.value);

const at = (list: readonly string[], index: number): string | null => list.at(index) ?? null;

const isMove = (
  event: ComboboxEvent,
): event is Extract<ComboboxEvent, { type: "INPUT.ARROW_DOWN" | "INPUT.ARROW_UP" | "INPUT.HOME" | "INPUT.END" }> =>
  event.type === "INPUT.ARROW_DOWN" ||
  event.type === "INPUT.ARROW_UP" ||
  event.type === "INPUT.HOME" ||
  event.type === "INPUT.END";

const implementations = {};

export function combobox(
  args: ComboboxArgs = {},
  authored: (name: string) => boolean,
): Machine<ComboboxContext, ComboboxEvents> {
  return createMachine<ComboboxContext, ComboboxEvents>({
    ...config,
    context: initial(args, authored),
    /**
     * The selection, the field's text and the highlight are the machine's
     * own: no host may write them.
     */
    fields: {
      multiple: {},
      closeOnSelect: {},
      allowCustomValue: {},
      inputBehavior: {},
      selectionBehavior: {},
      openOnChange: {},
    },
  });
}
