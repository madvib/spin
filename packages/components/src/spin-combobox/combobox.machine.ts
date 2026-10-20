/**
 * Combobox machine: the four phases — closed and unfocused, closed and
 * focused, open with the user driving (`interacting`), open with the input
 * proposing (`suggesting`) — plus the selection, the input text, the
 * highlight and the inline completion.
 *
 * Zag ships `closed.{idle,focused}` and `open.{interacting,suggesting}`, with
 * an `open` parent whose handlers are shared by its two children. The fork
 * has no nesting and no parent, so:
 *
 * - Zag's ROOT tier (the events that work in every state) is the fork's root
 *   `on`, programmatic `OPEN`/`CLOSE` with it.
 * - Zag's `open` parent's handlers (`INPUT.ENTER`, `ITEM.CLICK`,
 *   `TRIGGER.CLICK`, `LAYER.INTERACT_OUTSIDE`) sit at the root too, and the
 *   two closed states shadow the ones Zag does not define there. The fork
 *   tries state handlers first and falls through to the root, so an
 *   unconditional state handler shadows a root one — which is the whole
 *   reason this needs no nesting.
 * - `VALUE.CLEAR` is state-dependent in Zag, but every variant is "clear the
 *   selection and the input, and land in `focused`", so it is one root
 *   handler; `focused` already is `focused`, so the target is a no-op there.
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

export interface ComboboxContext {
  /** The selected values, in the order they were added. */
  value: string[];
  /** What the user typed, or what a selection committed. */
  inputValue: string;
  highlightedValue: string | null;
  /**
   * The inline completion the input shows while a keypress-driven highlight
   * is live. Zag writes this straight into the input element rather than
   * into `inputValue`, so the machine's own text stays what the user typed
   * and `isCustomValue` keeps answering about that. Null when nothing is
   * completing, which is when the input shows `inputValue`.
   */
  autofill: string | null;
  /** The collection's values in order. Synced from scope by the bridge. */
  order: string[];
  /** The collection's labels by value. Synced from scope by the bridge. */
  labels: Record<string, string>;
  multiple: boolean;
  closeOnSelect: boolean;
  allowCustomValue: boolean;
  inputBehavior: "none" | "autocomplete" | "autohighlight";
  selectionBehavior: "replace" | "preserve" | "clear";
  openOnChange: boolean;
}

export type ComboboxEvent =
  | { type: "SELECTED_ITEMS.SYNC" }
  | { type: "HIGHLIGHTED_VALUE.SET"; value: string | null; keypress?: boolean }
  | { type: "HIGHLIGHTED_VALUE.CLEAR" }
  | { type: "ITEM.SELECT"; value: string }
  | { type: "ITEM.CLEAR"; value: string }
  | { type: "VALUE.SET"; value: readonly string[] }
  | { type: "VALUE.CLEAR" }
  | { type: "INPUT_VALUE.SET"; value: string }
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "INPUT.FOCUS" }
  | { type: "INPUT.BLUR" }
  | { type: "INPUT.CLICK" }
  | { type: "INPUT.CHANGE"; value: string }
  | { type: "INPUT.ESCAPE" }
  | { type: "INPUT.ENTER" }
  | { type: "INPUT.ARROW_DOWN"; value?: string; keypress?: boolean }
  | { type: "INPUT.ARROW_UP"; value?: string; keypress?: boolean }
  | { type: "INPUT.HOME"; value?: string; keypress?: boolean }
  | { type: "INPUT.END"; value?: string; keypress?: boolean }
  | { type: "TRIGGER.CLICK" }
  | { type: "ITEM.CLICK"; value: string }
  | { type: "ITEM.POINTER_MOVE"; value: string }
  | { type: "ITEM.POINTER_LEAVE" }
  | { type: "LAYER.ESCAPE" }
  | { type: "LAYER.INTERACT_OUTSIDE" }
  | { type: "CHILDREN_CHANGE" };

/** A transport-coerced row. */
export interface ComboboxRow {
  readonly value?: unknown;
  readonly label?: unknown;
}

/** Transport-coerced input. */
export interface ComboboxInitial {
  readonly items?: unknown;
  readonly value?: unknown;
  readonly defaultValue?: unknown;
  readonly inputValue?: unknown;
  readonly defaultInputValue?: unknown;
  readonly highlightedValue?: unknown;
  readonly defaultHighlightedValue?: unknown;
  readonly multiple?: unknown;
  readonly closeOnSelect?: unknown;
  readonly allowCustomValue?: unknown;
  readonly inputBehavior?: unknown;
  readonly selectionBehavior?: unknown;
  readonly openOnChange?: unknown;
}

const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw !== "string") return [];
  return raw.length > 0 ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
};
const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");
const nullableProp = (raw: unknown): string | null => (typeof raw === "string" && raw.length > 0 ? raw : null);

export function initial(raw: ComboboxInitial, authored: (name: string) => boolean): ComboboxContext {
  const multiple = raw.multiple === true;
  const selectionRaw = raw.selectionBehavior;
  const selectionBehavior = selectionRaw === "preserve" || selectionRaw === "clear" ? selectionRaw : multiple ? "clear" : "replace";
  const behaviorRaw = raw.inputBehavior;
  const inputBehavior = behaviorRaw === "autocomplete" || behaviorRaw === "autohighlight" ? behaviorRaw : "none";
  const rows = Array.isArray(raw.items) ? raw.items.filter((x): x is ComboboxRow => typeof x === "object" && x !== null) : [];
  const order = rows.map((r) => (typeof r.value === "string" ? r.value : "")).filter(Boolean);
  const labels = Object.fromEntries(rows.map((r) => [String(r.value), typeof r.label === "string" ? r.label : String(r.value)]));
  const value = parseKeys(authored("value") ? raw.value : raw.defaultValue);
  // The scope's `highlightedValue` default is "", so an unauthored
  // highlight looks present. The authored predicate is what says whether
  // the host chose it.
  const highlighted = authored("highlightedValue")
    ? nullableProp(raw.highlightedValue)
    : nullableProp(raw.defaultHighlightedValue);
  const closeOnSelect = raw.closeOnSelect === undefined ? !multiple : raw.closeOnSelect === true;
  const allowCustomValue = raw.allowCustomValue === true;
  const openOnChange = raw.openOnChange !== false;
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
  const seeded = raw.inputValue !== undefined ? textProp(raw.inputValue) : textProp(raw.defaultInputValue);
  const inputValue = seeded.trim().length > 0 || multiple ? seeded : (selectionBehavior === "clear" ? "" : valueAsString);
  return { ...seedCtx, inputValue };
}

export const config = {
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
  // Zag's root tier, plus the two commands that work from anywhere:
  // `OPEN`/`CLOSE` are the host's `setOpen`, and `VALUE.CLEAR` is the host's
  // `clearValue` — every one of Zag's state-specific variants of it is the
  // same sentence with a different landing pad, and every landing pad is
  // `focused`.
  on: {
    "SELECTED_ITEMS.SYNC": { actions: [{ assign: "syncSelectedItems" }] },
    "HIGHLIGHTED_VALUE.SET": { actions: [{ assign: "setHighlightedValue" }] },
    "HIGHLIGHTED_VALUE.CLEAR": { actions: [{ assign: "clearHighlightedValue" }] },
    "ITEM.SELECT": { actions: [{ assign: "selectItem" }] },
    "ITEM.CLEAR": { actions: [{ assign: "clearItem" }] },
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "INPUT_VALUE.SET": { actions: [{ assign: "setInputValue" }] },
    OPEN: { target: "interacting" },
    CLOSE: { target: "focused" },
    "VALUE.CLEAR": { target: "focused", actions: [{ assign: "clearInputValue" }, { assign: "clearValue" }] },
    // Zag's `open` parent. The two closed states shadow what they must not
    // inherit: an unconditional state handler is tried before the root's.
    // Zag's root INPUT.ESCAPE (guard: custom value the machine refuses):
    // it must land in every state — a typed query in `suggesting` reverts
    // the same way a typed query in `focused` does. The state's own
    // handlers shadow it only where they must (interacting escapes to
    // focused with no revert).
    "INPUT.ESCAPE": [
      {
        cond: "revertsToValue",
        actions: [{ assign: "revertInputValue" }],
      },
    ],
    "INPUT.ENTER": [
      {
        cond: "revertsToValue",
        target: "focused",
        actions: [{ assign: "revertInputValue" }],
      },
      {
        cond: "closeOnSelect",
        target: "focused",
        actions: [{ assign: "selectHighlightedItem" }],
      },
      { actions: [{ assign: "selectHighlightedItem" }] },
    ],
    "ITEM.CLICK": [
      {
        cond: "closeOnSelect",
        target: "focused",
        actions: [{ assign: "selectItem" }],
      },
      { actions: [{ assign: "selectItem" }] },
    ],
    "TRIGGER.CLICK": { target: "focused" },
    "LAYER.INTERACT_OUTSIDE": [
      {
        cond: "revertsOnOutside",
        target: "idle",
        actions: [{ assign: "revertInputValue" }],
      },
      { target: "idle" },
    ],
  },
  states: {
    // closed.idle. The entry clears the highlight, which is what makes a
    // reopen start from nothing.
    idle: {
      entry: [{ assign: "clearHighlightedValue" }],
      on: {
        "INPUT.FOCUS": { target: "focused" },
        "TRIGGER.CLICK": {
          target: "interacting",
          actions: [{ assign: "highlightFirstOrSelectedItem" }],
        },
        "INPUT.CLICK": {
          target: "interacting",
          actions: [{ assign: "highlightFirstOrSelectedItem" }],
        },
        // Zag's `open` parent owns Enter and item clicks; a closed, unfocused
        // combobox has no panel to act on.
        "INPUT.ENTER": { actions: [] },
        "ITEM.CLICK": { actions: [] },
      },
    },
    // closed.focused.
    focused: {
      entry: [{ assign: "clearHighlightedValue" }],
      on: {
        "INPUT.BLUR": { target: "idle" },
        "INPUT.CHANGE": [
          {
            cond: "openOnChange",
            target: "suggesting",
            actions: [
              { assign: "setInputValue" },
              { assign: "highlightFirstItemIfAuto" },
            ],
          },
          { actions: [{ assign: "setInputValue" }] },
        ],
        "INPUT.ESCAPE": [
          { cond: "revertsToValue", actions: [{ assign: "revertInputValue" }] },
        ],
        "INPUT.CLICK": {
          target: "interacting",
          actions: [{ assign: "highlightFirstOrSelectedItem" }],
        },
        "TRIGGER.CLICK": {
          target: "interacting",
          actions: [{ assign: "highlightFirstOrSelectedItem" }],
        },
        // With an inline completion the arrow opens the panel and leaves the
        // highlight alone; without one it opens and adopts the first (or the
        // first selected) value.
        "INPUT.ARROW_DOWN": [
          { cond: "inlineAutocomplete", target: "interacting" },
          {
            target: "interacting",
            actions: [{ assign: "highlightFirstOrSelectedItem" }],
          },
        ],
        "INPUT.ARROW_UP": [
          { cond: "inlineAutocomplete", target: "interacting" },
          {
            target: "interacting",
            actions: [{ assign: "highlightLastOrSelectedItem" }],
          },
        ],
        // Zag's closed.focused dismisses with no revert: the text the user
        // typed is theirs. This MUST shadow the root's reverting candidate —
        // state handlers are tried first, so without this the root reverts.
        "LAYER.INTERACT_OUTSIDE": { target: "idle" },
        "LAYER.ESCAPE": { target: "idle" },
        // The clear word keeps the highlight here: an internal transition
        // runs no entry action, which is Zag's closed.focused exactly.
        "VALUE.CLEAR": { actions: [{ assign: "clearInputValue" }, { assign: "clearValue" }] },
        "INPUT.ENTER": { actions: [] },
        "ITEM.CLICK": { actions: [] },
      },
    },
    // open.interacting — the user is driving with the keyboard or pointer.
    interacting: {
      on: {
        "CHILDREN_CHANGE": {
          actions: [{ assign: "dropRemovedHighlight" }],
        },
        "INPUT.HOME": { actions: [{ assign: "moveHighlight" }] },
        "INPUT.END": { actions: [{ assign: "moveHighlight" }] },
        // An inline completion walks to the ends and then gives the text
        // back, so the last item is not a dead end.
        "INPUT.ARROW_DOWN": [
          { cond: "completionAtEnd", actions: [{ assign: "clearHighlightedValue" }] },
          { actions: [{ assign: "moveHighlight" }] },
        ],
        "INPUT.ARROW_UP": [
          { cond: "completionAtStart", actions: [{ assign: "clearHighlightedValue" }] },
          { actions: [{ assign: "moveHighlight" }] },
        ],
        "INPUT.CHANGE": [
          {
            cond: "inlineAutocomplete",
            target: "suggesting",
            actions: [{ assign: "setInputValue" }],
          },
          {
            target: "suggesting",
            actions: [{ assign: "setInputValue" }, { assign: "clearHighlightedValue" }],
          },
        ],
        "ITEM.POINTER_MOVE": { actions: [{ assign: "setHighlightedValue" }] },
        "ITEM.POINTER_LEAVE": { actions: [{ assign: "clearHighlightedValue" }] },
        // Escape out of a suggestion: the completion is dropped and the
        // input's own binding shows `inputValue` again, which is what Zag's
        // DOM-writing `syncInputValue` achieves against an uncontrolled
        // field. With autoComplete the completion is kept in the text until
        // the panel closes, so only the highlight goes.
        "LAYER.ESCAPE": [
          { cond: "inlineAutocomplete", actions: [{ assign: "clearHighlightedValue" }] },
          { target: "focused" },
        ],
      },
    },
    // open.suggesting — the input is proposing, and the arrows hand control
    // back to the user.
    suggesting: {
      on: {
        "CHILDREN_CHANGE": [
          {
            cond: "autoHighlightAfterRemoval",
            actions: [{ assign: "clearHighlightedValue" }, { assign: "highlightFirstItem" }],
          },
          { cond: "highlightRemoved", actions: [{ assign: "clearHighlightedValue" }] },
          { cond: "autoHighlight", actions: [{ assign: "highlightFirstItem" }] },
        ],
        "INPUT.ARROW_DOWN": {
          target: "interacting",
          actions: [{ assign: "moveHighlight" }],
        },
        "INPUT.ARROW_UP": {
          target: "interacting",
          actions: [{ assign: "moveHighlight" }],
        },
        "INPUT.HOME": {
          target: "interacting",
          actions: [{ assign: "moveHighlight" }],
        },
        "INPUT.END": {
          target: "interacting",
          actions: [{ assign: "moveHighlight" }],
        },
        "INPUT.CHANGE": { actions: [{ assign: "setInputValue" }] },
        "ITEM.POINTER_MOVE": {
          target: "interacting",
          actions: [{ assign: "setHighlightedValue" }],
        },
        "ITEM.POINTER_LEAVE": { actions: [{ assign: "clearHighlightedValue" }] },
        "LAYER.ESCAPE": { target: "focused" },
      },
    },
  },
};

/** The four phases that mean "the panel is up", as the view and the bridge
 * read them. Two of the four are open, and which is the question every
 * `data-state` and open-change decision asks. */
const OPEN_PHASES: Record<string, true> = { interacting: true, suggesting: true };

export const isOpenPhase = (phase: string): boolean => OPEN_PHASES[phase] === true;

/** Zag's `computed.autoComplete` — the behaviour, without the mode filter. */
const completesInline = (ctx: ComboboxContext): boolean => ctx.inputBehavior === "autocomplete";

/** Zag's `guards.autoComplete` — the completion AND a single-mode selection,
 * which is the combination the arrow keys and the open transitions read. */
const inlineSingle = (ctx: ComboboxContext): boolean =>
  completesInline(ctx) && !ctx.multiple;

const labelOf = (ctx: ComboboxContext, value: string): string | undefined => ctx.labels[value];

/** Zag's `collection.stringifyMany`: the labels a set resolves to, joined,
 * with a value the collection cannot resolve contributing nothing. */
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

/** Zag's `match(selectionBehavior)`, applied to every value move: the input
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

/** Zag's `addOrRemove` in `multiple` mode, replacement otherwise. */
const pickValue = (ctx: ComboboxContext, value: string): string[] =>
  ctx.multiple ? toggle(ctx.value, value) : [value];

/** The value a pick lands on, in one place so the bridge's `onSelect`
 * reports the same array the machine just assigned. */
export const pickOutcome = pickValue;

/** Zag's `computed.isCustomValue`: the input holds text the selection does
 * not explain. Written as an input mutation rather than a watched computed,
 * so the guards read it straight off the context. */
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

export const implementations = {
  conds: {
    /** The inline completion AND a single-mode selection. */
    inlineAutocomplete: (ctx: ComboboxContext): boolean => inlineSingle(ctx),
    autoHighlight: (ctx: ComboboxContext): boolean => ctx.inputBehavior === "autohighlight",
    closeOnSelect: (ctx: ComboboxContext): boolean => ctx.closeOnSelect,

    openOnChange: (ctx: ComboboxContext): boolean => ctx.openOnChange,
    hasSelectedItems: (ctx: ComboboxContext): boolean => ctx.value.length > 0,
    /** Enter with text the collection does not explain, no custom value
     * allowed and nothing highlighted: the text goes back to the selection.
     * The outside press asks the same question without the highlight test. */
    revertsToValue: (ctx: ComboboxContext): boolean =>
      isCustomValue(ctx) && !ctx.allowCustomValue && ctx.highlightedValue === null,
    revertsOnOutside: (ctx: ComboboxContext): boolean =>
      isCustomValue(ctx) && !ctx.allowCustomValue,
    /** The removal an auto-highlight repairs. */
    autoHighlightAfterRemoval: (ctx: ComboboxContext): boolean =>
      ctx.inputBehavior === "autohighlight" &&
      ctx.highlightedValue !== null &&
      !ctx.order.includes(ctx.highlightedValue) &&
      ctx.order.length > 0,
    highlightRemoved: (ctx: ComboboxContext): boolean =>
      ctx.highlightedValue !== null && !ctx.order.includes(ctx.highlightedValue),
    /** The completion is sitting on the collection's last (or first) value,
     * so the next arrow in that direction has nowhere to go. */
    completionAtEnd: (ctx: ComboboxContext): boolean =>
      inlineSingle(ctx) && ctx.highlightedValue === at(ctx.order, -1),
    completionAtStart: (ctx: ComboboxContext): boolean =>
      inlineSingle(ctx) && ctx.highlightedValue === at(ctx.order, 0),
  },
  assigns: {
    /** Zag's `setHighlightedValue`: a null writes nothing. */
    setHighlightedValue: (ctx: ComboboxContext, e: ComboboxEvent): Partial<ComboboxContext> => {
      // ITEM.POINTER_MOVE carries the row's value directly (the pointer is
      // already there); HIGHLIGHTED_VALUE.SET carries it with a keypress
      // flag for inline completion. Both land here.
      if (e.type === "ITEM.POINTER_MOVE") {
        return { highlightedValue: e.value, autofill: completion(ctx, e.value, false) };
      }
      if (e.type !== "HIGHLIGHTED_VALUE.SET" || e.value === null) return {};
      return {
        highlightedValue: e.value,
        autofill: completion(ctx, e.value, e.keypress === true),
      };
    },
    clearHighlightedValue: (): Partial<ComboboxContext> => ({
      highlightedValue: null,
      autofill: null,
    }),
    /** The arrows' and Home/End's target, which the view resolved. A closed
     * panel sends the event without one — its own assign decides what the
     * opening highlight is. */
    moveHighlight: (ctx: ComboboxContext, e: ComboboxEvent): Partial<ComboboxContext> => {
      if (!isMove(e) || e.value === undefined) return {};
      return {
        highlightedValue: e.value,
        autofill: completion(ctx, e.value, e.keypress === true),
      };
    },
    highlightFirstItem: (ctx: ComboboxContext): Partial<ComboboxContext> =>
      ctx.order.length === 0 ? {} : { highlightedValue: at(ctx.order, 0), autofill: null },
    /** Zag's `highlightFirstItemIfNeeded`: a suggestion adopts its first row
     * only when the host asked for the auto highlight. */
    highlightFirstItemIfAuto: (ctx: ComboboxContext): Partial<ComboboxContext> =>
      ctx.inputBehavior !== "autohighlight" || ctx.order.length === 0
        ? {}
        : { highlightedValue: at(ctx.order, 0), autofill: null },
    highlightLastItem: (ctx: ComboboxContext): Partial<ComboboxContext> =>
      ctx.order.length === 0 ? {} : { highlightedValue: at(ctx.order, -1), autofill: null },
    highlightFirstOrSelectedItem: (ctx: ComboboxContext): Partial<ComboboxContext> => {
      const selected = ctx.order.filter((value) => ctx.value.includes(value));
      const value = selected.length > 0 ? at(selected, 0) : at(ctx.order, 0);
      if (value === null) return {};
      return { highlightedValue: value, autofill: null };
    },
    /** Zag's `highlightLastOrSelectedItem` names the last item but reads the
     * FIRST selected one when there is a selection — verbatim, quirk and all,
     * because the trigger's opening highlight is the anchor a user reads. */
    highlightLastOrSelectedItem: (ctx: ComboboxContext): Partial<ComboboxContext> => {
      const selected = ctx.order.filter((value) => ctx.value.includes(value));
      const value = selected.length > 0 ? at(selected, 0) : at(ctx.order, -1);
      if (value === null) return {};
      return { highlightedValue: value, autofill: null };
    },
    dropRemovedHighlight: (ctx: ComboboxContext): Partial<ComboboxContext> =>
      ctx.highlightedValue !== null && !ctx.order.includes(ctx.highlightedValue)
        ? { highlightedValue: null, autofill: null }
        : {},
    selectItem: (ctx: ComboboxContext, e: ComboboxEvent): Partial<ComboboxContext> => {
      if (e.type !== "ITEM.SELECT" && e.type !== "ITEM.CLICK") return {};
      return applySelection(ctx, pickValue(ctx, e.value));
    },
    selectHighlightedItem: (ctx: ComboboxContext, e: ComboboxEvent): Partial<ComboboxContext> => {
      if (e.type !== "INPUT.ENTER") return {};
      // A highlight the collection cannot resolve selects nothing.
      if (ctx.highlightedValue === null || !ctx.order.includes(ctx.highlightedValue)) return {};
      return applySelection(ctx, pickValue(ctx, ctx.highlightedValue));
    },
    clearItem: (ctx: ComboboxContext, e: ComboboxEvent): Partial<ComboboxContext> => {
      if (e.type !== "ITEM.CLEAR") return {};
      return applySelection(
        ctx,
        ctx.value.filter((value) => value !== e.value),
      );
    },
    setValue: (ctx: ComboboxContext, e: ComboboxEvent): Partial<ComboboxContext> =>
      e.type === "VALUE.SET" ? applySelection(ctx, e.value) : {},
    clearValue: (ctx: ComboboxContext): Partial<ComboboxContext> => applySelection(ctx, []),
    clearInputValue: (): Partial<ComboboxContext> => ({ inputValue: "", autofill: null }),
    setInputValue: (_ctx: ComboboxContext, e: ComboboxEvent): Partial<ComboboxContext> => {
      if (e.type !== "INPUT.CHANGE" && e.type !== "INPUT_VALUE.SET") return {};
      return { inputValue: e.value, autofill: null };
    },
    /** The watch on `value`: the input is recomputed from the selection. */
    syncSelectedItems: (ctx: ComboboxContext): Partial<ComboboxContext> => ({
      inputValue: inputValueFor(ctx, ctx.value),
      autofill: null,
    }),
    /** Escape with an inline completion, and an outside press with text the
     * collection does not explain, both put the authored value back. */
    revertInputValue: (ctx: ComboboxContext): Partial<ComboboxContext> => {
      if (ctx.selectionBehavior === "preserve") return {};
      if (ctx.selectionBehavior === "clear") return { inputValue: "", autofill: null };
      return {
        inputValue: ctx.value.length > 0 ? stringifyValues(ctx, ctx.value) : "",
        autofill: null,
      };
    },
  },
};