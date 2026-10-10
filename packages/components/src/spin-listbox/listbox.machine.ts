/**
 * Listbox machine: the selection, the highlight, and whether the content
 * holds DOM focus.
 *
 * Zag ships one state (`idle`) with every event on it. The fork's root tier
 * is exactly that — "this event works everywhere" — so the config is a root
 * `on` plus two states whose only difference is the focus transition:
 * `focused` is Zag's `context.focused`, promoted to a state because it is
 * the one thing the machine transitions on.
 *
 * Navigation is NOT here. Arrows, Home/End and typeahead compute their
 * target against the collection the view holds and send
 * `HIGHLIGHTED_VALUE.SET` or `NAVIGATE`; the machine never walks the rows.
 * The one order fact it does read is `order` — the collection's values in
 * sequence, synced from scope — because a shift-range selection is a
 * statement about positions, not about rows, and the view has already told
 * the machine which two values it is between.
 */

export interface ListboxContext {
  /** The selected values, in the order they were added. */
  value: string[];
  highlightedValue: string | null;
  /** The collection's values in order. Synced from scope by the bridge. */
  order: string[];
  selectionMode: "single" | "multiple" | "extended";
  deselectable: boolean;
  selectOnHighlight: boolean;
}

export type ListboxEvent =
  | { type: "HIGHLIGHTED_VALUE.SET"; value: string | null }
  | { type: "ITEM.SELECT"; value: string }
  | { type: "ITEM.CLEAR"; value: string }
  | { type: "VALUE.SET"; value: readonly string[] }
  | { type: "VALUE.CLEAR" }
  | { type: "ITEM.CLICK"; value: string; shiftKey?: boolean; metaKey?: boolean; anchorValue?: string | null }
  | { type: "ITEM.POINTER_MOVE"; value: string }
  | { type: "ITEM.POINTER_LEAVE" }
  | { type: "NAVIGATE"; value: string; shiftKey?: boolean; anchorValue?: string | null }
  | { type: "CONTENT.FOCUS" }
  | { type: "CONTENT.BLUR" };

export const config = {
  id: "listbox",
  initial: "idle",
  context: {
    value: [] as string[],
    highlightedValue: null as string | null,
    order: [] as string[],
    selectionMode: "single" as "single" | "multiple" | "extended",
    deselectable: true,
    selectOnHighlight: false,
  },
  // The root tier: selection and highlight events are valid whether or not
  // the content holds focus, which is Zag's single-state semantics.
  on: {
    "HIGHLIGHTED_VALUE.SET": { actions: [{ assign: "highlightValue" }] },
    "ITEM.SELECT": { actions: [{ assign: "selectItem" }] },
    "ITEM.CLEAR": { actions: [{ assign: "clearItem" }] },
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "VALUE.CLEAR": { actions: [{ assign: "clearValue" }] },
    "ITEM.CLICK": { actions: [{ assign: "highlightItem" }, { assign: "selectHighlightedItem" }] },
    "ITEM.POINTER_MOVE": { actions: [{ assign: "highlightItem" }] },
    "ITEM.POINTER_LEAVE": { actions: [{ assign: "clearHighlightedItem" }] },
    // Zag runs setHighlightedItem before selectWithKeyboard: the highlight
    // moves first, then selectOnHighlight replaces the selection.
    "NAVIGATE": { actions: [{ assign: "highlightItem" }, { assign: "selectWithKeyboard" }] },
  },
  states: {
    idle: {
      on: {
        // A focus with nothing chosen and nothing highlighted adopts the
        // first value; a focus with either keeps what it had.
        "CONTENT.FOCUS": [
          { target: "focused", cond: "hasSelectionOrHighlight" },
          { target: "focused", actions: [{ assign: "highlightFirst" }] },
        ],
      },
    },
    focused: {
      on: {
        // Zag's CONTENT.BLUR clears focus but never the highlight.
        "CONTENT.BLUR": { target: "idle" },
      },
    },
  },
};

/** `multiple` and `extended` both take modifier-key selection. */
const isMulti = (mode: ListboxContext["selectionMode"]): boolean =>
  mode === "multiple" || mode === "extended";

/** Inclusive value range in collection order — Zag's `getValueRange`. */
function valueRange(order: readonly string[], from: string, to: string): string[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a === -1 || b === -1) return [];
  return a <= b ? order.slice(a, b + 1) : order.slice(b, a + 1);
}

const toggle = (value: readonly string[], at: string): string[] =>
  value.includes(at) ? value.filter((v) => v !== at) : [...value, at];

/** Zag's `Selection.select`: single re-picks clear, multiple toggles, and
 * extended replaces unless a meta click forces the toggle. */
function selectValue(
  ctx: ListboxContext,
  value: string,
  forceToggle: boolean,
): string[] {
  if (ctx.selectionMode === "single") {
    return ctx.value.includes(value) && ctx.deselectable
      ? ctx.value.filter((v) => v !== value)
      : [value];
  }
  if (ctx.selectionMode === "multiple" || forceToggle) return toggle(ctx.value, value);
  return [value];
}

/** Zag's `Selection.extendSelection`. `canSelect` never refuses for these
 * modes — the collection's disabled items are already unselectable — so the
 * range adds unconditionally. */
function extendSelection(
  ctx: ListboxContext,
  anchorValue: string,
  targetValue: string,
): string[] {
  if (ctx.selectionMode === "single") return [targetValue];
  const next = new Set(ctx.value);
  const last = ctx.value.at(-1) ?? targetValue;
  for (const key of valueRange(ctx.order, anchorValue, last)) next.delete(key);
  for (const key of valueRange(ctx.order, targetValue, anchorValue)) next.add(key);
  return [...next];
}

export const implementations = {
  conds: {
    hasSelectionOrHighlight: (ctx: ListboxContext): boolean =>
      ctx.value.length > 0 || ctx.highlightedValue !== null,
  },
  assigns: {
    highlightValue: (ctx: ListboxContext, e: ListboxEvent): Partial<ListboxContext> =>
      e.type === "HIGHLIGHTED_VALUE.SET" && e.value !== ctx.highlightedValue
        ? { highlightedValue: e.value }
        : {},
    highlightItem: (ctx: ListboxContext, e: ListboxEvent): Partial<ListboxContext> =>
      e.type === "ITEM.POINTER_MOVE" || e.type === "NAVIGATE" || e.type === "ITEM.CLICK"
        ? e.value !== ctx.highlightedValue
          ? { highlightedValue: e.value }
          : {}
        : {},
    clearHighlightedItem: (): Partial<ListboxContext> => ({ highlightedValue: null }),
    highlightFirst: (ctx: ListboxContext): Partial<ListboxContext> =>
      ctx.order.length === 0 ? {} : { highlightedValue: ctx.order.at(0) ?? null },
    selectHighlightedItem: (ctx: ListboxContext, e: ListboxEvent): Partial<ListboxContext> => {
      if (e.type !== "ITEM.CLICK") return {};
      // A value the collection does not hold selects nothing.
      if (!ctx.order.includes(e.value)) return {};
      const anchor = e.anchorValue;
      if (e.shiftKey === true && isMulti(ctx.selectionMode) && typeof anchor === "string") {
        return { value: extendSelection(ctx, anchor, e.value) };
      }
      return { value: selectValue(ctx, e.value, e.metaKey === true) };
    },
    selectWithKeyboard: (ctx: ListboxContext, e: ListboxEvent): Partial<ListboxContext> => {
      if (e.type !== "NAVIGATE") return {};
      const anchor = e.anchorValue;
      if (e.shiftKey === true && isMulti(ctx.selectionMode) && typeof anchor === "string") {
        return { value: extendSelection(ctx, anchor, e.value) };
      }
      if (!ctx.selectOnHighlight) return {};
      if (!ctx.order.includes(e.value)) return {};
      return { value: [e.value] };
    },
    selectItem: (ctx: ListboxContext, e: ListboxEvent): Partial<ListboxContext> =>
      e.type === "ITEM.SELECT" ? { value: selectValue(ctx, e.value, false) } : {},
    clearItem: (ctx: ListboxContext, e: ListboxEvent): Partial<ListboxContext> =>
      e.type === "ITEM.CLEAR" ? { value: ctx.value.filter((v) => v !== e.value) } : {},
    // Zag assigns the array verbatim: selectAll in single mode selects every
    // item, and a host's bogus value is kept. The bridge reports what the
    // collection can resolve, and nothing more.
    setValue: (_ctx: ListboxContext, e: ListboxEvent): Partial<ListboxContext> =>
      e.type === "VALUE.SET" ? { value: [...e.value] } : {},
    clearValue: (): Partial<ListboxContext> => ({ value: [] }),
  },
};
