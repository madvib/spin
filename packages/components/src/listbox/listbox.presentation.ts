import {
  ariaHidden,
  ariaLabelledBy,
  defineComponent,
  isComposing,
  listSurface,
  optionRow,
  type ApiOf,
  type ComponentDef,
  type ScopeFor,
  type SlotScopeFor,
} from "@spin/runtime";
import { listbox as listboxMachine } from "./listbox.machine.ts";
import type { ListboxArgs, ListboxArgsItem, ListboxContext } from "./listbox.state.ts";
import type { ListboxEvents } from "./listbox.events.ts";

export type { ListboxArgs };

/** Listbox definition: the DOM contract as data. Navigation computes its
 * target against the rows the view holds and sends it in. */

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
  readonly index: number;
}

export interface ListboxBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly ListboxRow[];
}

/** Zag's `getItemState`, verbatim in shape. */
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

type ScopeLike = ScopeFor<ListboxContext, ListboxEvents, "idle">;
type SlotLike<R> = SlotScopeFor<R, ListboxContext, ListboxEvents, "idle">;

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

const parseItems = (raw: unknown): readonly ListboxRow[] => {
  if (!Array.isArray(raw)) return [];
  return toRows(raw.filter((item): item is ListboxItem => typeof item === "object" && item !== null));
};

/** Rows memoized on the items' identity: the slot bag memo keys on the
 * row object, so a fresh copy per read would strand the cache and
 * re-attach every row handler on every tick. */
const rowsByItems = new WeakMap<readonly ListboxArgsItem[], readonly ListboxRow[]>();

const rowsOf = (context: ListboxContext): readonly ListboxRow[] => {
  const hit = rowsByItems.get(context.items);
  if (hit !== undefined) return hit;
  const built = parseItems(context.items);
  rowsByItems.set(context.items, built);
  return built;
};

const orderOf = (context: ListboxContext): string[] =>
  rowsOf(context).map((row) => row.value);

const labelsOf = (context: ListboxContext): Record<string, string> =>
  Object.fromEntries(rowsOf(context).map((row) => [row.value, row.label]));

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
const rowHandlersByBridge = new WeakMap<object, WeakMap<ListboxRow, RowHandlerSet>>;
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
      if (scope.context.disabled) return;
      if (row.disabled || event.pointerType !== "mouse") return;
      if (scope.context.highlightedValue === row.value) return;
      scope.send({ type: "ITEM.POINTER_MOVE", value: row.value });
    },
    onPointerLeave: (): void => {
      if (scope.context.disabled) return;
      if (row.disabled) return;
      scope.send({ type: "ITEM.POINTER_LEAVE" });
    },
    // Shift is selection, not the browser's: it extends the range from the
    // highlight, which is the anchor Zag reads. The other modifiers are
    // the browser's — a new tab, a download, a context menu.
    onClick: (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      if (scope.context.disabled) return;
      if (row.disabled) return;
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
      const anchor = scope.context.highlightedValue;
      scope.send({
        type: "ITEM.CLICK",
        value: row.value,
        ...(event.shiftKey ? { shiftKey: true as const } : {}),
        ...(anchor === null ? {} : { anchorValue: anchor }),
      });
    },
  };
  byRow.set(row, made);
  return made;
};

const itemStateOf = (scope: ScopeLike, row: ListboxRow): ListboxItemState => ({
  value: row.value,
  disabled: scope.context.disabled || row.disabled,
  highlighted: scope.context.highlightedValue === row.value,
  selected: scope.context.value.includes(row.value),
});

const step = (scope: ScopeLike, delta: 1 | -1): string | null => {
  const list = rowsOf(scope.context);
  if (list.length === 0) return null;
  const current = scope.context.highlightedValue;
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
  const list = rowsOf(scope.context);
  const row = from === "first" ? list[0] : list[list.length - 1];
  return row === undefined ? null : row.value;
};

const nextWalked = (scope: ScopeLike, delta: 1 | -1): string | null => {
  const value = step(scope, delta);
  if (value !== null) return value;
  if (!scope.context.loopFocus) return null;
  return edge(scope, delta > 0 ? "first" : "last");
};

const isTypeaheadKey = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

const navigate = (scope: ScopeLike, value: string | null, event: KeyboardEvent): void => {
  if (value === null) return;
  event.preventDefault();
  const anchor = scope.context.highlightedValue;
  scope.send({
    type: "NAVIGATE",
    value,
    ...(event.shiftKey ? { shiftKey: true as const } : {}),
    ...(anchor === null ? {} : { anchorValue: anchor }),
    ...((event.ctrlKey || event.metaKey) ? { metaKey: true as const } : {}),
  });
};

const rtlOf = (event: KeyboardEvent): boolean =>
  event.target instanceof Element &&
  event.target.ownerDocument?.defaultView?.getComputedStyle(event.target).direction === "rtl";

const onContentKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (scope.context.disabled || scope.context.readOnly) return;
  if (isComposing(event)) return;
  // Ctrl/Meta+A selects all in a multiple listbox; any other modifier is
  // the host's, not the machine's.
  if ((event.ctrlKey || event.metaKey) && event.key !== "a" && event.key !== "A") return;
  const ctx = scope.context;
  switch (event.key) {
    case "ArrowDown":
      navigate(scope, nextWalked(scope, 1), event);
      return;
    case "ArrowUp":
      navigate(scope, nextWalked(scope, -1), event);
      return;
    case "ArrowLeft":
    case "ArrowRight": {
      if (scope.context.orientation !== "horizontal") return;
      // In rtl the visual left is the next item, not the previous one.
      const forward = (event.key === "ArrowRight") !== rtlOf(event);
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
          value: rowsOf(scope.context).filter((row) => !row.disabled).map((row) => row.value),
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

export const def = {
  name: "listbox",
  machine: (args: ListboxArgs, authored) => listboxMachine(args, authored),
  start: "idle",
  reconcile: ({ context, parsed, send }) => {
    const ctx = context;
    const order = orderOf(ctx);
    void parsed;
    ctx.disabledValues = rowsOf(ctx).filter((row) => row.disabled).map((row) => row.value);
    ctx.order = order;
    ctx.labels = labelsOf(ctx);
    send({ type: "SELECTED_ITEMS.SYNC" });
    return true;
  },
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        "data-orientation": scope.context.orientation,
      }),
    },
    label: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
      }),
    },
    valueText: {
      id: "value-text",
    },
    content: {
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const highlighted = ctx.highlightedValue;
        const active = highlighted === null ? undefined : scope.id("item", highlighted);
        return {
          role: "listbox",
          tabindex: "0",
          dir: scope.context.dir,
          ...listSurface(scope, {
            activeDescendant: active === undefined ? undefined : { id: active },
            multiSelectable: ctx.multiple ? "true" : undefined,
            labelledBy: { part: "label" },
          }),
          "data-activedescendant": active,
          "data-orientation": scope.context.orientation,
          onFocus: (): void => scope.send({ type: "CONTENT.FOCUS" }),
          onBlur: (): void => scope.send({ type: "CONTENT.BLUR" }),
          onKeydown: (event: KeyboardEvent): void => onContentKeydown(scope, event),
          // Zag's `scrollToHighlightedItem`: the active descendant is
          // revealed — the browser's own scroll, never an offset of ours.
          "use:scroll-into-view": {
            activeId: (): string => {
              const current = scope.context.highlightedValue;
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
      indexes: (context: ListboxContext) => rowsOf(context),
      attrs: (scope: SlotLike<ListboxRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.value),
          role: "option",
          dir: scope.context.dir,
          "data-value": state.value,
          "data-highlighted": state.highlighted ? "" : undefined,
          ...optionRow({
            selected: state.selected ? "true" : "false",
            disabled: state.disabled ? "true" : undefined,
          }),
          onPointermove: rowHandlers(scope, row).onPointerMove,
          onPointerleave: rowHandlers(scope, row).onPointerLeave,
          onClick: rowHandlers(scope, row).onClick,
        };
      },
    },
    itemText: {
      indexes: (context: ListboxContext) => rowsOf(context),
      attrs: (scope: SlotLike<ListboxRow>) => {
        const state = itemStateOf(scope, scope.slot);
        void state;
        return {};
      },
    },
    itemIndicator: {
      indexes: (context: ListboxContext) => rowsOf(context),
      attrs: (scope: SlotLike<ListboxRow>) => {
        const selected = itemStateOf(scope, scope.slot).selected;
        return {
          ...ariaHidden("true"),
          hidden: selected ? undefined : "",
        };
      },
    },
    itemGroup: {
      id: "item-group",
      indexes: (context: ListboxContext) => blocksOf(rowsOf(context)),
      attrs: (scope: SlotLike<ListboxBlock>) => {
        const block = scope.slot;
        return {
          id: scope.id("itemGroup", block.id),
          role: "group",
          dir: scope.context.dir,
          "data-orientation": scope.context.orientation,
          ...ariaLabelledBy(scope, { part: "itemGroupLabel", slot: block.id }),
        };
      },
    },
    itemGroupLabel: {
      id: "item-group-label",
      indexes: (context: ListboxContext) => blocksOf(rowsOf(context)),
      attrs: (scope: SlotLike<ListboxBlock>) => {
        return {
          id: scope.id("itemGroupLabel", scope.slot.id),
          dir: scope.context.dir,
          role: "presentation",
        };
      },
    },
  },
  commands: {
    syncSelectedItems: { event: () => ({ type: "SELECTED_ITEMS.SYNC" }) },
    setHighlightValue: { event: ([value]: [value: string]) => ({ type: "HIGHLIGHTED_VALUE.SET", value }) },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE.CLEAR" }) },
    selectValue: { event: ([value]: [value: string]) => ({ type: "ITEM.SELECT", value }) },
    setValue: { event: ([value]: [value: readonly string[]]) => ({ type: "VALUE.SET", value: [...value] }) },
    selectAll: {
      event: (_args: readonly unknown[], context) => {
        if (!context.multiple) return { type: "VALUE.SET", value: [...context.value] };
        return {
          type: "VALUE.SET",
          value: context.order.filter((value) => !context.disabledValues.includes(value)),
        };
      },
    },
    clearValue: {
      event: ([value]: [value?: string]) =>
        value === undefined
          ? { type: "VALUE.CLEAR" }
          : { type: "ITEM.CLEAR", value },
    },
    highlightFirst: {
      event: (_args: readonly unknown[], context) => ({ type: "HIGHLIGHTED_VALUE.SET", value: context.order[0] ?? null }),
    },
    highlightLast: {
      event: (_args: readonly unknown[], context) => ({
        type: "HIGHLIGHTED_VALUE.SET",
        value: context.order[context.order.length - 1] ?? null,
      }),
    },
    highlightNext: {
      event: (_args: readonly unknown[], context) => ({
        type: "HIGHLIGHTED_VALUE.SET",
        value: highlightStep(context.order, context.disabledValues, context.highlightedValue, 1, context.loopFocus),
      }),
    },
    highlightPrevious: {
      event: (_args: readonly unknown[], context) => ({
        type: "HIGHLIGHTED_VALUE.SET",
        value: highlightStep(context.order, context.disabledValues, context.highlightedValue, -1, context.loopFocus),
      }),
    },
  },
  readers: {
    focused: { read: (context) => context.focused },
    highlightedValue: { read: (context) => context.highlightedValue },
    highlightedItem: {
      read: (context) => {
        const highlighted = context.highlightedValue;
        if (highlighted === null) return null;
        return rowsOf(context).find((row) => row.value === highlighted) ?? null;
      },
    },
    value: { read: (context) => [...context.value] },
    valueAsString: {
      read: (context) => {
        const rows = rowsOf(context);
        return context.value
          .map((value) => rows.find((row) => row.value === value)?.label)
          .filter((label): label is string => label !== undefined)
          .join(", ");
      },
    },
    hasSelectedItems: { read: (context) => context.value.length > 0 },
    selectedItems: {
      read: (context) => {
        const rows = rowsOf(context);
        return context.value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is ListboxRow => row !== undefined);
      },
    },
    multiple: { read: (context) => context.multiple },
    disabled: { read: (context) => context.disabled },
    empty: { read: (context) => rowsOf(context).length === 0 },
    orientation: { read: (context: ListboxContext) => context.orientation },
  },
  methods: {
    getBlocks: {
      call: (context) => blocksOf(rowsOf(context)),
    },
    getRows: {
      call: (_context, _state, [block]: [block: ListboxBlock]) => block.rows.filter((row) => typeof row === "object" && row !== null),
    },
    getItemState: {
      call: (context: ListboxContext, _state, [row]: [row: ListboxRow]) => {
        if (typeof row !== "object" || row === null) return { value: "", disabled: true, highlighted: false, selected: false };
        return {
          value: row.value,
          disabled: context.disabled || row.disabled,
          highlighted: context.highlightedValue === row.value,
          selected: context.value.includes(row.value),
        };
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...context.value],
      detail: (watched: readonly unknown[], _event, _props, context) => {
        const ctx = context as unknown as ListboxContext;
        const rows = rowsOf(ctx);
        const value = (watched as readonly string[]).filter((v) => typeof v === "string");
        return {
          value: [...value],
          items: value.map((item) => rows.find((row) => row.value === item)).filter((row) => row !== undefined),
        };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [context.highlightedValue],
      detail: (watched: readonly unknown[], _event, _props, context) => {
        const ctx = context as unknown as ListboxContext;
        const highlighted = watched[0];
        return {
          highlightedValue: highlighted,
          highlightedItem: typeof highlighted !== "string"
            ? null
            : rowsOf(ctx).find((row) => row.value === highlighted) ?? null,
        };
      },
    },
    select: {
      prop: "onSelect",
      watch: (context) => [...context.value],
      detail: (watched: readonly unknown[]) => ({ value: [...(watched as readonly string[])], itemValue: "" }),
      // Zag's `invokeOnSelect`: the value the pick landed on. It fires for
      // a toggle-off as much as a pick — the host asked about the move,
      // not the direction — but a guard the machine refused reports nothing.
      select: (event, before: ListboxContext, after: ListboxContext) => {
        if (event.type !== "ITEM.CLICK" && event.type !== "ITEM.SELECT") return null;
        if (sameKeys(before.value, after.value)) return null;
        const v = (event as Record<string, unknown>)["value"];
        return { value: [...after.value], itemValue: typeof v === "string" ? v : "" };
      },
    },
  },
} satisfies ComponentDef<ListboxContext, ListboxEvents, Record<string, unknown>, ListboxArgs, "idle">;

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export type ListboxApi = ApiOf<typeof def>;
export const listbox = defineComponent<ListboxContext, ListboxEvents, ListboxApi, ListboxArgs, "idle">(def);
