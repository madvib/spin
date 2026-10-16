import {
  defineComponent,
  isComposing,
  textProp,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  type ListboxContext,
  type ListboxEvent,
} from "./listbox.machine.ts";

/**
 * Listbox definition: the DOM contract as data. The machine owns the
 * highlight, the selection and the focus in one idle phase; this file maps
 * props to channels, parts to attribute bags, commands to sends, and
 * value/highlight/select transitions to their events. Navigation (arrows,
 * Home, End, typeahead) computes its target against the rows the view
 * holds and sends it in — the machine never walks data. The collection
 * parses once per prop identity: row objects are stable, so the `for`
 * bindings never re-stamp.
 */

/** One collection entry as the host authored it: value first, label optional. */
export interface ListboxItem {
  readonly value: string;
  readonly label?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly group?: string | undefined;
}

export interface ListboxRow {
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly group: string;
  /** Position in collection order — what the group walk reads. */
  readonly index: number;
}

export interface ListboxBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly ListboxRow[];
}

/** Zag's `getItemState`, verbatim in shape: what one option is worth. */
export interface ListboxItemState {
  readonly value: string;
  readonly disabled: boolean;
  readonly highlighted: boolean;
  readonly selected: boolean;
}

export interface ListboxValueChange {
  readonly value: string[];
  readonly items: readonly ListboxRow[];
}

export interface ListboxHighlightChange {
  readonly highlightedValue: string | null;
  readonly highlightedItem: ListboxRow | null;
}

export interface ListboxSelect {
  readonly value: string[];
  readonly itemValue: string;
}

export interface ListboxApi {
  readonly focused: boolean;
  readonly highlightedValue: string | null;
  readonly highlightedItem: ListboxRow | null;
  readonly value: readonly string[];
  readonly valueAsString: string;
  readonly hasSelectedItems: boolean;
  readonly selectedItems: readonly ListboxRow[];
  readonly multiple: boolean;
  readonly disabled: boolean;
  readonly empty: boolean;
  syncSelectedItems(): void;
  setHighlightValue(value: string): void;
  clearHighlightValue(): void;
  selectValue(value: string): void;
  setValue(value: readonly string[]): void;
  selectAll(): void;
  clearValue(value?: string): void;
  highlightFirst(): void;
  highlightLast(): void;
  highlightNext(): void;
  highlightPrevious(): void;
  getBlocks(): readonly ListboxBlock[];
  getRows(block: ListboxBlock): readonly ListboxRow[];
  getItemState(row: ListboxRow): ListboxItemState;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getItemProps(row: ListboxRow): Record<string, unknown>;
  getItemTextProps(row: ListboxRow): Record<string, unknown>;
  getItemIndicatorProps(row: ListboxRow): Record<string, unknown>;
  getItemGroupProps(block: ListboxBlock): Record<string, unknown>;
  getItemGroupLabelProps(block: ListboxBlock): Record<string, unknown>;
}

/** Keys travel the prop channel comma-joined: the grammar types a set either
 * as `string[]` (whose default coercion produces `["[]"]` for `= []`) or as
 * JSON, neither of which survives a framework's string attribute. */
const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === "string");
  if (typeof raw !== "string") return [];
  // Bracketed-unquoted scope defaults (`[a, b]`) split like a bare list.
  const list = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  return list.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
};

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const toRow = (item: ListboxItem): ListboxRow | undefined => {
  if (typeof item.value !== "string" || item.value.length === 0) return undefined;
  return {
    value: item.value,
    label: typeof item.label === "string" && item.label.length > 0 ? item.label : item.value,
    disabled: item.disabled === true,
    group: typeof item.group === "string" ? item.group : "",
    index: 0,
  };
};

const toRows = (items: readonly ListboxItem[]): readonly ListboxRow[] => {
  const rows: ListboxRow[] = [];
  for (const item of items) {
    const row = toRow(item);
    if (row !== undefined) rows.push(row);
  }
  return rows.map((row, index) => ({ ...row, index }));
};

/** The scope grammar's object-array type carries the fields the host typed;
 * anything else arriving on the prop channel is treated as no items. */
const parseItems = (raw: unknown): readonly ListboxRow[] => {
  if (!Array.isArray(raw)) return [];
  return toRows(raw.filter((item): item is ListboxItem => typeof item === "object" && item !== null));
};

/** A non-empty text prop, or null — the shape `highlightedValue` travels in. */
const nullableProp = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

type Ctx = ListboxContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const rowsOf = (parsed: Record<string, unknown>): readonly ListboxRow[] =>
  parsed["items"] as readonly ListboxRow[];

const orderOf = (parsed: Record<string, unknown>): string[] =>
  rowsOf(parsed).map((row) => row.value);

const labelsOf = (parsed: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(rowsOf(parsed).map((row) => [row.value, row.label]));

/** Blocks memoized on the rows' identity: the `for` directive iterates this
 * array, and fresh wrappers per read would re-stamp the groups. */
const blocksCache = new WeakMap<readonly ListboxRow[], readonly ListboxBlock[]>();
const blocksOf = (rows: readonly ListboxRow[]): readonly ListboxBlock[] => {
  const hit = blocksCache.get(rows);
  if (hit !== undefined) return hit;
  const built: ListboxBlock[] = [];
  let label: string | null = null;
  let group: ListboxRow[] = [];
  const flush = (): void => {
    if (group.length === 0) return;
    built.push({ id: label ?? `group-${built.length}`, label, rows: group });
    label = null;
    group = [];
  };
  let previous: string | null = null;
  for (const row of rows) {
    if (row.group !== previous) {
      flush();
      label = row.group.length === 0 ? null : row.group;
      previous = row.group;
    }
    group.push(row);
  }
  flush();
  blocksCache.set(rows, built);
  return built;
};

/** Row handlers, built once per row per bridge: the scope reads live
 * through proxies, so a cached closure never goes stale. */
type RowHandlerSet = {
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onPointerLeave: () => void;
  readonly onClick: (event: MouseEvent) => void;
};
const rowHandlersByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  WeakMap<ListboxRow, RowHandlerSet>
>();
const rowHandlers = (scope: ScopeLike, row: ListboxRow): RowHandlerSet => {
  let byRow = rowHandlersByBridge.get(scope.send);
  if (byRow === undefined) {
    byRow = new WeakMap();
    rowHandlersByBridge.set(scope.send, byRow);
  }
  const hit = byRow.get(row);
  if (hit !== undefined) return hit;
  const made: RowHandlerSet = {
    onPointerMove: (event: PointerEvent): void => {
      if (scope.props["disabled"] === true) return;
      if (row.disabled || event.pointerType !== "mouse") return;
      if (asCtx(scope.context).highlightedValue === row.value) return;
      scope.send({ type: "ITEM.POINTER_MOVE", value: row.value });
    },
    onPointerLeave: (): void => {
      if (scope.props["disabled"] === true) return;
      if (row.disabled) return;
      scope.send({ type: "ITEM.POINTER_LEAVE" });
    },
    // Shift is selection, not the browser's: it extends the range from the
    // highlight, which is the anchor Zag reads. The rest of the modifiers
    // are the browser's — a new tab, a download, a context menu.
    onClick: (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      if (scope.props["disabled"] === true) return;
      if (row.disabled) return;
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
      scope.send({
        type: "ITEM.CLICK",
        value: row.value,
        shiftKey: event.shiftKey,
        anchorValue: asCtx(scope.context).highlightedValue ?? undefined,
      });
    },
  };
  byRow.set(row, made);
  return made;
};

const itemStateOf = (scope: ScopeLike, row: ListboxRow): ListboxItemState => ({
  value: row.value,
  disabled: scope.props["disabled"] === true || row.disabled,
  highlighted: asCtx(scope.context).highlightedValue === row.value,
  selected: asCtx(scope.context).value.includes(row.value),
});

/**
 * One step through the collection, mirroring Zag's `getNextValue`: the walk
 * starts at the highlighted row's position — so a highlight sitting on a
 * disabled row still moves — skips the disabled rows it passes, and returns
 * null when it runs off the end. With no reference point at all the RAW
 * first (or last) row is the answer, disabled or not, which is Zag's
 * `collection.firstValue`.
 */
const step = (scope: ScopeLike, delta: 1 | -1): string | null => {
  const list = rowsOf(scope.props);
  if (list.length === 0) return null;
  const current = asCtx(scope.context).highlightedValue;
  if (current === null) {
    const row = delta > 0 ? list[0] : list[list.length - 1];
    return row === undefined ? null : row.value;
  }
  const at = list.findIndex((row) => row.value === current);
  const start = at === -1 ? 0 : at;
  for (let index = start + delta; index >= 0 && index < list.length; index += delta) {
    const row = list[index];
    if (row !== undefined && !row.disabled) return row.value;
  }
  return null;
};

/** The walk a highlight command takes: from the highlight, skipping the
 * disabled values the collection names, wrapping only when the host loops.
 * Reconcile maintains the disabled set next to the order, so the command —
 * which reads context, not rows — walks what the view would walk. */
const highlightStep = (
  order: readonly string[],
  disabled: readonly string[],
  highlighted: string | null,
  delta: 1 | -1,
  loop: boolean,
): string | null => {
  if (order.length === 0) return null;
  const enabled = (value: string): boolean => !disabled.includes(value);
  if (highlighted === null) {
    const row = delta > 0 ? order[0] : order[order.length - 1];
    return row === undefined ? null : row;
  }
  const at = order.findIndex((value) => value === highlighted);
  const start = at === -1 ? 0 : at;
  for (let index = start + delta; index >= 0 && index < order.length; index += delta) {
    const value = order[index];
    if (value !== undefined && enabled(value)) return value;
  }
  if (!loop) return null;
  const end = delta > 0 ? order[0] : order[order.length - 1];
  return end === undefined ? null : end;
};


/** The collection's extremes, disabled or not. */
const edge = (scope: ScopeLike, from: "first" | "last"): string | null => {
  const list = rowsOf(scope.props);
  const row = from === "first" ? list[0] : list[list.length - 1];
  return row === undefined ? null : row.value;
};

/** The arrow's target: the walk, wrapping only when the host loops. */
const nextWalked = (scope: ScopeLike, delta: 1 | -1): string | null => {
  const value = step(scope, delta);
  if (value !== null) return value;
  if (scope.props["loopFocus"] === false) return null;
  return edge(scope, delta > 0 ? "first" : "last");
};

/** A typeahead keystroke: a single printable character with no modifier. */
const isTypeaheadKey = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

const navigate = (scope: ScopeLike, value: string | null, event: KeyboardEvent): void => {
  if (value === null) return;
  event.preventDefault();
  scope.send({
    type: "NAVIGATE",
    value,
    shiftKey: event.shiftKey,
    anchorValue: asCtx(scope.context).highlightedValue ?? undefined,
    metaKey: event.ctrlKey || event.metaKey,
  });
};

const onContentKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
  if (isComposing(event)) return;
  // Ctrl/Meta+A selects all in a multiple listbox; any other modifier is
  // the host's, not the machine's.
  if ((event.ctrlKey || event.metaKey) && event.key !== "a" && event.key !== "A") return;
  const ctx = asCtx(scope.context);
  switch (event.key) {
    case "ArrowDown":
      navigate(scope, nextWalked(scope, 1), event);
      return;
    case "ArrowUp":
      navigate(scope, nextWalked(scope, -1), event);
      return;
    case "ArrowLeft":
    case "ArrowRight": {
      if (scope.props["orientation"] !== "horizontal") return;
      // In rtl the visual left is the next item, not the previous one.
      const forward = (event.key === "ArrowRight") !== (scope.props["dir"] === "rtl");
      navigate(scope, nextWalked(scope, forward ? 1 : -1), event);
      return;
    }
    case "Home":
      navigate(scope, edge(scope, "first"), event);
      return;
    case "End":
      navigate(scope, edge(scope, "last"), event);
      return;
    case "Enter":
    case " ": {
      const highlighted = ctx.highlightedValue;
      if (highlighted === null) return;
      event.preventDefault();
      scope.send({ type: "ITEM.CLICK", value: highlighted });
      return;
    }
    case "a":
    case "A": {
      if ((event.ctrlKey || event.metaKey) && ctx.multiple) {
        event.preventDefault();
        scope.send({
          type: "VALUE.SET",
          value: rowsOf(scope.props).filter((row) => !row.disabled).map((row) => row.value),
        });
      }
      return;
    }
    case "Escape": {
      if (ctx.value.length > 0 && !ctx.multiple) {
        event.preventDefault();
        scope.send({ type: "VALUE.CLEAR" });
      }
      return;
    }
    default: {
      if (isTypeaheadKey(event)) {
        event.preventDefault();
        scope.send({ type: "CONTENT.TYPEAHEAD", key: event.key });
      }
      return;
    }
  }
};

const def: ComponentDef<ListboxContext, ListboxEvent> = {
  name: "listbox",
  config,
  implementations,
  seed: (props, authored) => {
    const multiple = props["multiple"] === true;
    const selection = props["selectionBehavior"];
    return {
      multiple,
      selectOnHighlight: props["selectOnHighlight"] === true,
      loopFocus: props["loopFocus"] !== false,
      selectionBehavior: selection === "preserve" || selection === "clear"
        ? selection
        : multiple
          ? "clear"
          : "replace",
      value: parseKeys(authored("value") ? props["value"] : props["defaultValue"]),
      highlightedValue: authored("highlightedValue")
        ? nullableProp(props["highlightedValue"])
        : nullableProp(props["defaultHighlightedValue"]),
      order: orderOf(props),
      labels: labelsOf(props),
    };
  },
  channels: {
    items: { parse: parseItems },
    value: {
      controlled: true,
      parse: parseKeys,
      event: (value: readonly string[]) => ({ type: "VALUE.SET", value: [...value] }),
      equal: (current, outer) =>
        Array.isArray(current) && Array.isArray(outer) && sameKeys(current as string[], outer as string[]),
    },
    defaultValue: { parse: parseKeys },
    highlightedValue: {
      controlled: true,
      parse: nullableProp,
      nullable: true,
      event: (value: string | null) =>
        value === null ? { type: "HIGHLIGHTED_VALUE.CLEAR" } : { type: "HIGHLIGHTED_VALUE.SET", value },
    },
    defaultHighlightedValue: { parse: nullableProp },
    multiple: { parse: (raw) => raw === true },
    selectOnHighlight: { parse: (raw) => raw === true },
    loopFocus: { parse: (raw) => raw !== false },
    selectionBehavior: { parse: textProp },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    composite: { parse: (raw) => raw !== false },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    orientation: { parse: (raw) => (raw === "horizontal" ? "horizontal" : "vertical") },
    name: { parse: textProp },
    form: { parse: textProp },
  },
  scalarsOf: (parsed) => {
    const multiple = parsed["multiple"] === true;
    const selection = parsed["selectionBehavior"];
    return {
      multiple,
      selectOnHighlight: parsed["selectOnHighlight"] === true,
      loopFocus: parsed["loopFocus"] !== false,
      selectionBehavior: selection === "preserve" || selection === "clear"
        ? selection
        : multiple
          ? "clear"
          : "replace",
    };
  },
  reconcile: ({ context, parsed, send }) => {
    const ctx = asCtx(context);
    const order = orderOf(parsed);
    (ctx as unknown as { disabledValues: readonly string[] }).disabledValues =
      rowsOf(parsed).filter((row) => row.disabled).map((row) => row.value);
    if (sameKeys(ctx.order, order)) return false;
    ctx.order = order;
    ctx.labels = labelsOf(parsed);
    send({ type: "SELECTED_ITEMS.SYNC" });
    return true;
  },
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["dir"], scope.props["orientation"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("root"),
        dir: scope.props["dir"],
        "data-orientation": scope.props["orientation"],
        "data-disabled": scope.attr(scope.props["disabled"] === true),
      }),
    },
    label: {
      sig: (scope) => [scope.props["disabled"], scope.props["dir"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-disabled": scope.attr(scope.props["disabled"] === true),
      }),
    },
    valueText: {
      id: "value-text",
      sig: (scope) => {
        const value = asCtx(scope.context).value;
        return [value.length, value.join(",")].join(" ");
      },
      attrs: (scope) => ({
        id: scope.id("valueText"),
        "data-empty": scope.attr(asCtx(scope.context).value.length === 0),
      }),
    },
    content: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [
          scope.state,
          ctx.focused,
          ctx.highlightedValue,
          scope.props["disabled"],
          scope.props["dir"],
          scope.props["orientation"],
          ctx.multiple,
          rowsOf(scope.props).length,
        ].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const highlighted = ctx.highlightedValue;
        const active = highlighted === null ? undefined : scope.id("item", highlighted);
        return {
          id: scope.id("content"),
          role: "listbox",
          tabindex: "0",
          dir: scope.props["dir"],
          "data-orientation": scope.props["orientation"],
          "data-activedescendant": active,
          "aria-activedescendant": active,
          "aria-multiselectable": ctx.multiple ? "true" : undefined,
          "aria-labelledby": scope.id("label"),
          "data-empty": scope.attr(rowsOf(scope.props).length === 0),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-focused": scope.attr(ctx.focused),
          onFocus: (): void => scope.send({ type: "CONTENT.FOCUS" }),
          onBlur: (): void => scope.send({ type: "CONTENT.BLUR" }),
          onKeydown: (event: KeyboardEvent): void => onContentKeydown(scope, event),
          // Zag's `scrollToHighlightedItem`: the active descendant is
          // revealed — the browser's own scroll, never an offset of ours.
          "use:scroll-into-view": {
            activeId: (): string => {
              const current = asCtx(scope.context).highlightedValue;
              if (current === null) return "";
              return scope.id("item", current);
            },
          },
        };
      },
    },
  },
  slots: {
    item: {
      id: "item",
      indexes: (_context, props) => rowsOf(props),
      sig: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as ListboxRow);
        return [state.highlighted, state.selected, state.disabled, scope.props["dir"], scope.props["orientation"]].join(" ");
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as ListboxRow;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.value),
          role: "option",
          dir: scope.props["dir"],
          "data-value": state.value,
          "aria-selected": state.selected ? "true" : "false",
          "data-selected": scope.attr(state.selected),
          "data-state": state.selected ? "checked" : "unchecked",
          "data-orientation": scope.props["orientation"],
          "data-highlighted": scope.attr(state.highlighted),
          "data-disabled": scope.attr(state.disabled),
          "aria-disabled": state.disabled ? "true" : undefined,
          onPointermove: rowHandlers(scope, row).onPointerMove,
          onPointerleave: rowHandlers(scope, row).onPointerLeave,
          onClick: rowHandlers(scope, row).onClick,
        };
      },
    },
    itemText: {
      indexes: (_context, props) => rowsOf(props),
      sig: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as ListboxRow);
        return [state.selected, state.disabled, state.highlighted].join(" ");
      },
      attrs: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as ListboxRow);
        return {
          "data-state": state.selected ? "checked" : "unchecked",
          "data-disabled": scope.attr(state.disabled),
          "data-highlighted": scope.attr(state.highlighted),
        };
      },
    },
    itemIndicator: {
      indexes: (_context, props) => rowsOf(props),
      sig: (scope) => `${itemStateOf(scope, scope.slot as unknown as ListboxRow).selected}`,
      attrs: (scope) => {
        const selected = itemStateOf(scope, scope.slot as unknown as ListboxRow).selected;
        return {
          "aria-hidden": "true",
          "data-state": selected ? "checked" : "unchecked",
          hidden: selected ? undefined : "",
        };
      },
    },
    itemGroup: {
      id: "item-group",
      indexes: (_context, props) => blocksOf(rowsOf(props)),
      sig: (scope) => `${(scope.slot as unknown as ListboxBlock).id}`,
      attrs: (scope) => {
        const block = scope.slot as unknown as ListboxBlock;
        return {
          id: scope.id("itemGroup", block.id),
          role: "group",
          dir: scope.props["dir"],
          "aria-labelledby": scope.id("itemGroupLabel", block.id),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.props["orientation"],
          "data-empty": scope.attr(rowsOf(scope.props).length === 0),
        };
      },
    },
    itemGroupLabel: {
      id: "item-group-label",
      indexes: (_context, props) => blocksOf(rowsOf(props)),
      sig: (scope) => `${(scope.slot as unknown as ListboxBlock).id}`,
      attrs: (scope) => {
        const block = scope.slot as unknown as ListboxBlock;
        return {
          id: scope.id("itemGroupLabel", block.id),
          dir: scope.props["dir"],
          role: "presentation",
        };
      },
    },
  },
  commands: {
    syncSelectedItems: { event: () => ({ type: "SELECTED_ITEMS.SYNC" }) },
    setHighlightValue: { event: (args) => ({ type: "HIGHLIGHTED_VALUE.SET", value: args[0] as string }) },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE.CLEAR" }) },
    selectValue: { event: (args) => ({ type: "ITEM.SELECT", value: args[0] as string }) },
    setValue: { event: (args) => ({ type: "VALUE.SET", value: [...(args[0] as readonly string[])] }) },
    selectAll: {
      event: (_args, context, _id) => {
        const ctx = context as unknown as Ctx;
        if (!ctx.multiple) return { type: "VALUE.SET", value: [...ctx.value] };
        const disabled = (ctx as unknown as { disabledValues?: readonly string[] }).disabledValues ?? [];
        return {
          type: "VALUE.SET",
          value: ctx.order.filter((value) => !disabled.includes(value)),
        };
      },
    },
    clearValue: {
      event: (args) => args[0] === undefined
        ? ({ type: "VALUE.CLEAR" })
        : ({ type: "ITEM.CLEAR", value: args[0] as string }),
    },
    highlightFirst: {
      event: (_args, context) => {
        const order = (context as unknown as Ctx).order;
        return { type: "HIGHLIGHTED_VALUE.SET", value: order[0] ?? null };
      },
    },
    highlightLast: {
      event: (_args, context) => {
        const order = (context as unknown as Ctx).order;
        return { type: "HIGHLIGHTED_VALUE.SET", value: order[order.length - 1] ?? null };
      },
    },
    highlightNext: {
      event: (_args, context) => {
        const ctx = context as unknown as Ctx;
        const disabled = (ctx as unknown as { disabledValues?: readonly string[] }).disabledValues ?? [];
        return {
          type: "HIGHLIGHTED_VALUE.SET",
          value: highlightStep(ctx.order, disabled, ctx.highlightedValue, 1, ctx.loopFocus),
        };
      },
    },
    highlightPrevious: {
      event: (_args, context) => {
        const ctx = context as unknown as Ctx;
        const disabled = (ctx as unknown as { disabledValues?: readonly string[] }).disabledValues ?? [];
        return {
          type: "HIGHLIGHTED_VALUE.SET",
          value: highlightStep(ctx.order, disabled, ctx.highlightedValue, -1, ctx.loopFocus),
        };
      },
    },
  },
  readers: {
    focused: { read: (context) => asCtx(context).focused },
    highlightedValue: { read: (context) => asCtx(context).highlightedValue },
    highlightedItem: {
      read: (context, _state, props) => {
        const highlighted = asCtx(context).highlightedValue;
        if (highlighted === null) return null;
        return rowsOf(props).find((row) => row.value === highlighted) ?? null;
      },
    },
    value: { read: (context) => [...asCtx(context).value] },
    valueAsString: {
      read: (context, _state, props) => {
        const rows = rowsOf(props);
        return asCtx(context).value
          .map((value) => rows.find((row) => row.value === value)?.label)
          .filter((label): label is string => label !== undefined)
          .join(", ");
      },
    },
    hasSelectedItems: { read: (context) => asCtx(context).value.length > 0 },
    selectedItems: {
      read: (context, _state, props) => {
        const rows = rowsOf(props);
        return asCtx(context).value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is ListboxRow => row !== undefined);
      },
    },
    multiple: { read: (context) => asCtx(context).multiple },
    disabled: { read: (_context, _state, props) => (props["disabled"] as boolean) === true },
    empty: { read: (_context, _state, props) => rowsOf(props).length === 0 },
  },
  methods: {
    getBlocks: {
      call: (_context, _state, _args, props) => blocksOf(rowsOf(props)),
    },
    getRows: {
      call: (_context, _state, args) => (args[0] as ListboxBlock).rows,
    },
    getItemState: {
      call: (context, _state, args, props) => {
        const row = args[0] as ListboxRow;
        return {
          value: row.value,
          disabled: (props["disabled"] as boolean) === true || row.disabled,
          highlighted: (context as unknown as Ctx).highlightedValue === row.value,
          selected: (context as unknown as Ctx).value.includes(row.value),
        };
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...asCtx(context).value],
      detail: (watched, _event, props) => {
        const rows = rowsOf(props as Record<string, unknown>);
        const value = watched as string[];
        return {
          value: [...value],
          items: value.map((item) => rows.find((row) => row.value === item)).filter((row) => row !== undefined),
        };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [asCtx(context).highlightedValue],
      detail: (watched, _event, props) => {
        const highlighted = watched[0] as string | null;
        return {
          highlightedValue: highlighted,
          highlightedItem: highlighted === null
            ? null
            : rowsOf(props as Record<string, unknown>).find((row) => row.value === highlighted) ?? null,
        };
      },
    },
    select: {
      prop: "onSelect",
      watch: (context) => [...asCtx(context).value],
      detail: (watched) => ({ value: [...watched] as string[], itemValue: "" }),
      // Zag's `invokeOnSelect`: the value the pick landed on. It fires for
      // a toggle-off as much as a pick — the host asked about the move,
      // not the direction — but a guard the machine refused reports nothing.
      select: (event, before, after) => {
        if (event.type !== "ITEM.CLICK" && event.type !== "ITEM.SELECT") return null;
        const beforeCtx = before as unknown as Ctx;
        const afterCtx = after as unknown as Ctx;
        if (sameKeys(beforeCtx.value, afterCtx.value)) return null;
        return { value: [...afterCtx.value], itemValue: (event as Record<string, string>)["value"] as string };
      },
    },
  },
};

export const listbox = defineComponent<ListboxContext, ListboxEvent, ListboxApi>(def);
