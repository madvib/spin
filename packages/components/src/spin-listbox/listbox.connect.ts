/**
 * Listbox connect: the DOM contract plus the view-owned navigation.
 *
 * What the machine owns stays there: the selection, the highlight, and
 * whether the content holds focus. Everything else lives here — the keyboard
 * map (arrows in both axes, Home/End, Enter, Space, ctrl+a, Escape, the
 * typeahead buffer), the collection the view iterates, and the reflexes the
 * parts carry.
 *
 * The view owns navigation, so every target is computed here against the
 * visible rows and sent as an event: the machine never walks the rows. What
 * that buys is the fork's flat config covering both layouts — a grid's
 * column arithmetic is the same `NAVIGATE` with a different target.
 *
 * Two conventions, both Zag's: part ids are `listbox:<element id>:<part>`,
 * and `aria-activedescendant` is the highlighted item's id. A nested level's
 * element id is the parent's part id for it, which is already namespaced, so
 * it is used verbatim rather than prefixed twice.
 */

import type { ListboxContext } from "./listbox.machine.ts";

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
  /** Position in collection order — the grid's row/column arithmetic. */
  readonly index: number;
}

export interface ListboxBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly ListboxRow[];
}

export interface ListboxFsmConnectProps {
  readonly selectionMode: "single" | "multiple" | "extended";
  readonly orientation: "horizontal" | "vertical";
  readonly columnCount: number;
  readonly disabled: boolean;
  readonly loopFocus: boolean;
  readonly typeahead: boolean;
  readonly highlightOnHover: boolean;
  readonly disallowSelectAll: boolean;
  readonly deselectable: boolean;
}

/** The element's imperative surface — Zag's api methods, declared here so
 * hosts (and tests) call them without a cast. Every one is a send: the machine
 * holds the state, and the view decides which value the host's words resolve
 * to before it sends anything. */
export interface ListboxCommands {
  selectValue(value: string): void;
  setValue(value: readonly string[]): void;
  selectAll(): void;
  clearValue(value?: string): void;
  highlightValue(value: string): void;
  clearHighlightedValue(): void;
  highlightFirst(): void;
  highlightLast(): void;
  highlightNext(): void;
  highlightPrevious(): void;
  focus(): void;
}

export interface ListboxFsmApi extends ListboxCommands {
  readonly disabled: boolean;
  readonly hasSelectedItems: boolean;
  readonly empty: boolean;
  readonly value: readonly string[];
  readonly valueAsString: string;
  readonly highlightedValue: string | null;
  readonly focused: boolean;
  readonly layout: "list" | "grid";
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getItemProps(row: ListboxRow): Record<string, unknown>;
  getItemTextProps(row: ListboxRow): Record<string, unknown>;
  getItemIndicatorProps(row: ListboxRow): Record<string, unknown>;
  getItemGroupProps(block: ListboxBlock): Record<string, unknown>;
  getItemGroupLabelProps(block: ListboxBlock): Record<string, unknown>;
  getEmptyStateProps(): Record<string, unknown>;
  getBlocks(): readonly ListboxBlock[];
  getRows(block: ListboxBlock): readonly ListboxRow[];
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace. */
const NAMESPACE = "listbox";

export interface ListboxService {
  readonly context: ListboxContext;
  readonly focused: boolean;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside the
 * handlers it caches. Read live, and a host write reaches a gesture armed
 * before it. */
export type ReadListboxProps = () => ListboxFsmConnectProps;

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A binding re-reads the bag on every machine move, so a fresh bag per read
 * would detach and re-attach every listener each move. Only one of the
 * fields the signature enumerates moving rebuilds it. */
function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** `cached` per owner: rows and blocks are stable objects, so the memo dies
 * with the item tree it came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise, which is what `hidden`-style utilities key on. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/**
 * A grid's column count is an N in a class name, which Uno compiles from
 * source text — the same problem the carousel has with slides-per-page, and
 * the same answer: presence attributes the static utilities key on.
 */
const MAX_COLUMNS = 6;

const columnAttrs = (count: number): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (let n = 2; n <= MAX_COLUMNS; n += 1) {
    if (n === count) attrs[`data-columns-${n}`] = "";
  }
  return attrs;
};

export function connectRobotListbox(
  service: ListboxService,
  readProps: ReadListboxProps,
  getRows: () => readonly ListboxRow[],
  id: string,
): ListboxFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const contentId = `${ownerId}:content`;
  const labelId = `${ownerId}:label`;
  const itemId = (value: string): string => `${ownerId}:item:${value}`;
  const groupId = (id: string): string => `${ownerId}:item-group:${id}`;
  const groupLabelId = (id: string): string => `${ownerId}:item-group-label:${id}`;
  const ctx = (): ListboxContext => service.context;
  /** Every event the view sends, funnelled through the service the bridge
   * hands it — the bridge's wrapper is what fires the change callbacks. */
  const send: Send = (event): void => {
    service.send(event);
  };

  // ---- rows ---------------------------------------------------------------

  /** Memoized on the collection's identity: the `for` directive iterates this
   * array, and a fresh row object per read would replace the nodes, detach
   * every gesture in flight, and orphan the handlers those nodes hold. */
  let blockSource: readonly ListboxRow[] | undefined;
  let blocksCache: readonly ListboxBlock[] | undefined;
  const blocks = (): readonly ListboxBlock[] => {
    const source = getRows();
    if (blocksCache !== undefined && source === blockSource) return blocksCache;
    blockSource = source;
    // A grid is laid out as one group of rows: the column arithmetic is the
    // row order, so grouping would cut a grid row in half.
    if (readProps().columnCount > 1) {
      blocksCache = source.length === 0 ? [] : [{ id: "grid", label: null, rows: source }];
      return blocksCache;
    }
    const built: ListboxBlock[] = [];
    let label: string | null = null;
    let rows: ListboxRow[] = [];
    const flush = (): void => {
      if (rows.length === 0) return;
      built.push({
        id: label ?? `group-${built.length}`,
        label,
        rows,
      });
      label = null;
      rows = [];
    };
    let previous: string | null = null;
    for (const row of source) {
      if (row.group !== previous) {
        flush();
        label = row.group.length === 0 ? null : row.group;
        previous = row.group;
      }
      rows.push(row);
    }
    flush();
    blocksCache = built;
    return blocksCache;
  };

  const allRows = (): readonly ListboxRow[] => blocks().flatMap((block) => block.rows);

  /** The ENABLED rows in order — what navigation considers. */
  const navigable = (): readonly ListboxRow[] => allRows().filter((row) => !row.disabled);

  const rowByValue = (value: string): ListboxRow | undefined =>
    allRows().find((row) => row.value === value);

  const valueAsString = (): string =>
    ctx()
      .value.map((value) => rowByValue(value)?.label)
      .filter((label): label is string => label !== undefined)
      .join(", ");

  // ---- navigation ---------------------------------------------------------

  const focus = (): void => {
    document.getElementById(contentId)?.focus();
  };

  const highlight = (value: string | null): void => send({ type: "HIGHLIGHTED_VALUE.SET", value });

  const navigate = (value: string, shiftKey: boolean, anchorValue: string | null): void =>
    send({ type: "NAVIGATE", value, shiftKey, anchorValue });

  /**
   * One step through the collection. `getNextValue` walks from the
   * highlighted value's position and skips DISABLED rows, so a highlight
   * sitting on a disabled item still moves in the direction asked for; with
   * no reference point the first enabled row is where navigation starts.
   */
  const step = (delta: number): string | null => {
    const list = allRows();
    const enabled = navigable();
    if (enabled.length === 0) return null;
    const current = ctx().highlightedValue;
    const at = current === null ? -1 : list.findIndex((row) => row.value === current);
    if (at === -1) {
      return delta > 0 ? enabled[0]?.value ?? null : enabled[enabled.length - 1]?.value ?? null;
    }
    if (readProps().loopFocus) {
      const from = enabled.findIndex((row) => row.value === current);
      const start = from === -1 ? 0 : from;
      return enabled[(start + delta + enabled.length) % enabled.length]?.value ?? null;
    }
    for (let index = at + delta; index >= 0 && index < list.length; index += delta) {
      const row = list[index];
      if (row !== undefined && !row.disabled) return row.value;
    }
    return null;
  };

  /** The collection's extremes, disabled or not — Zag's firstValue/lastValue. */
  const edge = (from: "first" | "last"): string | null => {
    const list = allRows();
    const row = from === "first" ? list[0] : list[list.length - 1];
    return row === undefined ? null : row.value;
  };

  /**
   * The vertical axis. A grid keeps the column and moves a row — the last
   * enabled column stands in for a cell a short final row does not have; a
   * list walks the previous/next enabled value. Both fall back to the
   * opposite edge when the host loops, or when nothing is highlighted yet.
   */
  const vertical = (delta: 1 | -1): string | null => {
    const props = readProps();
    const current = ctx().highlightedValue;
    const moved = props.columnCount > 1 && current !== null ? gridColumn(delta, current) : step(delta);
    if (moved !== null) return moved;
    if (props.loopFocus || current === null) return delta > 0 ? edge("first") : edge("last");
    return null;
  };

  /**
   * The horizontal axis. A vertical LIST ignores it — Left/Right are grid
   * keys there, or horizontal-axis keys — while a grid and a horizontal list
   * both walk the enabled values in order.
   */
  const horizontal = (delta: 1 | -1): string | null => {
    const props = readProps();
    const current = ctx().highlightedValue;
    if (props.columnCount === 1 && props.orientation === "vertical") return null;
    const next = step(delta);
    if (next !== null) return next;
    if (props.loopFocus) return delta > 0 ? edge("first") : edge("last");
    return null;
  };

  function gridColumn(delta: 1 | -1, current: string): string | null {
    const props = readProps();
    const list = allRows();
    const from = rowByValue(current);
    if (from === undefined) return null;
    const column = from.index % props.columnCount;
    const rowCount = Math.ceil(list.length / props.columnCount);
    if (rowCount === 0) return null;
    let at = Math.floor(from.index / props.columnCount);
    for (let walked = 0; walked < rowCount; walked += 1) {
      at += delta;
      if (at < 0 || at >= rowCount) {
        if (!props.loopFocus) return null;
        at = (at + rowCount) % rowCount;
      }
      const cell = list[at * props.columnCount + column];
      if (cell === undefined) {
        // Past the row's last cell: that row's last enabled column stands in.
        const rowEnd = Math.min((at + 1) * props.columnCount, list.length) - 1;
        let columnIndex = rowEnd;
        while (columnIndex >= at * props.columnCount) {
          const enabled = list[columnIndex];
          if (enabled !== undefined && !enabled.disabled) return enabled.value;
          columnIndex -= 1;
        }
        continue;
      }
      if (!cell.disabled) return cell.value;
    }
    return delta > 0 ? edge("last") : edge("first");
  }

  /**
   * Typeahead: the buffer accumulates for 500ms, a run of one repeated
   * character counts once, and the search starts AFTER the current highlight
   * and wraps — so a key pressed on an item whose label starts with it moves
   * to the NEXT such label rather than sitting still.
   */
  const typeahead = { keys: "", at: 0 };

  const typeaheadMatch = (key: string): void => {
    const now = Date.now();
    typeahead.keys = now - typeahead.at < 500 ? typeahead.keys + key : key;
    typeahead.at = now;
    const needle = typeahead.keys.toLowerCase();
    const repeated = needle.length > 1 && [...needle].every((char) => char === needle[0]);
    const query = repeated ? needle.charAt(0) : needle;
    const list = navigable();
    const current = ctx().highlightedValue;
    const at = current === null ? -1 : list.findIndex((row) => row.value === current);
    for (let index = 1; index <= list.length; index += 1) {
      const row = list[(at + index) % list.length];
      if (row === undefined) continue;
      if (row.label.toLowerCase().startsWith(query)) {
        highlight(row.value);
        return;
      }
    }
  };

  const isPrintable = (event: KeyboardEvent): boolean =>
    event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

  const onContentKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const props = readProps();
    if (props.disabled) return;
    const shiftKey = event.shiftKey;
    const anchor = ctx().highlightedValue;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown": {
        const value = vertical(event.key === "ArrowDown" ? 1 : -1);
        if (value === null) return;
        event.preventDefault();
        navigate(value, shiftKey, anchor);
        break;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        const value = horizontal(event.key === "ArrowRight" ? 1 : -1);
        if (value === null) return;
        event.preventDefault();
        navigate(value, shiftKey, anchor);
        break;
      }
      case "Home":
      case "End": {
        const value = edge(event.key === "Home" ? "first" : "last");
        if (value === null) return;
        event.preventDefault();
        navigate(value, shiftKey, anchor);
        break;
      }
      case "Enter":
      case " ": {
        // A space with a live typeahead buffer keeps searching; otherwise it
        // activates, exactly as Enter does.
        if (event.key === " " && props.typeahead && typeahead.keys.length > 0) {
          event.preventDefault();
          typeaheadMatch(event.key);
          break;
        }
        if (anchor === null) return;
        event.preventDefault();
        send({
          type: "ITEM.CLICK",
          value: anchor,
          shiftKey,
          metaKey: event.metaKey,
          anchorValue: anchor,
        });
        break;
      }
      case "Escape": {
        if (!props.deselectable || ctx().value.length === 0) break;
        event.preventDefault();
        send({ type: "VALUE.CLEAR" });
        break;
      }
      default: {
        // ctrl/meta a is select-all and never a search: Zag's key map takes
        // the modifier keys ahead of its typeahead fallback, and an
        // `isPrintable` guard would otherwise swallow it.
        if (event.ctrlKey || event.metaKey) {
          if (event.key !== "a") return;
          if (props.selectionMode === "single" || props.disallowSelectAll) return;
          event.preventDefault();
          send({ type: "VALUE.SET", value: navigable().map((row) => row.value) });
          return;
        }
        if (!props.typeahead || !isPrintable(event)) return;
        event.preventDefault();
        typeaheadMatch(event.key);
        break;
      }
    }
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const valueTextBag = cached();
  const contentBag = cached();
  const emptyBag = cached();
  const groupBags = new WeakMap<ListboxBlock, BagMemo>();
  const groupLabelBags = new WeakMap<ListboxBlock, BagMemo>();
  const itemBags = new WeakMap<ListboxRow, BagMemo>();
  const itemTextBags = new WeakMap<ListboxRow, BagMemo>();
  const indicatorBags = new WeakMap<ListboxRow, BagMemo>();

  /** Row handlers, built once per row: they read the behavioural props live,
   * so a cached closure is never a stale snapshot of one. */
  interface RowHandlers {
    readonly onPointerMove: (event: PointerEvent) => void;
    readonly onPointerLeave: () => void;
    readonly onMouseDown: (event: MouseEvent) => void;
    readonly onClick: (event: MouseEvent) => void;
  }
  const rowHandlers = new WeakMap<ListboxRow, RowHandlers>();
  const handlersFor = (row: ListboxRow): RowHandlers => {
    const hit = rowHandlers.get(row);
    if (hit !== undefined) return hit;
    const made: RowHandlers = {
      onPointerMove: (event: PointerEvent) => {
        const props = readProps();
        if (!props.highlightOnHover) return;
        if (row.disabled || event.pointerType !== "mouse") return;
        if (ctx().highlightedValue === row.value) return;
        send({ type: "ITEM.POINTER_MOVE", value: row.value });
      },
      onPointerLeave: () => send({ type: "ITEM.POINTER_LEAVE" }),
      onMouseDown: (event: MouseEvent) => {
        // A press must not move focus out of the content: the roving
        // highlight would be gone before ITEM.CLICK runs.
        event.preventDefault();
        focus();
      },
      onClick: (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        if (readProps().disabled) return;
        if (row.disabled) return;
        send({
          type: "ITEM.CLICK",
          value: row.value,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey || event.ctrlKey,
          anchorValue: ctx().highlightedValue,
        });
      },
    };
    rowHandlers.set(row, made);
    return made;
  };

  return {
    get disabled(): boolean {
      return readProps().disabled;
    },
    get hasSelectedItems(): boolean {
      return ctx().value.length > 0;
    },
    get empty(): boolean {
      return allRows().length === 0;
    },
    get value(): readonly string[] {
      return [...ctx().value];
    },
    get valueAsString(): string {
      return valueAsString();
    },
    get highlightedValue(): string | null {
      return ctx().highlightedValue;
    },
    get focused(): boolean {
      return service.focused;
    },
    get layout(): "list" | "grid" {
      return readProps().columnCount > 1 ? "grid" : "list";
    },
    selectValue: (value: string): void => send({ type: "ITEM.SELECT", value }),
    setValue: (value: readonly string[]): void => send({ type: "VALUE.SET", value: [...value] }),
    selectAll: (): void => send({ type: "VALUE.SET", value: navigable().map((row) => row.value) }),
    clearValue: (value?: string): void =>
      value === undefined ? send({ type: "VALUE.CLEAR" }) : send({ type: "ITEM.CLEAR", value }),
    highlightValue: (value: string): void => send({ type: "HIGHLIGHTED_VALUE.SET", value }),
    clearHighlightedValue: (): void => send({ type: "HIGHLIGHTED_VALUE.SET", value: null }),
    highlightFirst: (): void => {
      const value = edge("first");
      if (value !== null) highlight(value);
    },
    highlightLast: (): void => {
      const value = edge("last");
      if (value !== null) highlight(value);
    },
    highlightNext: (): void => {
      const value = step(1);
      if (value !== null) highlight(value);
    },
    highlightPrevious: (): void => {
      const value = step(-1);
      if (value !== null) highlight(value);
    },
    focus: (): void => focus(),
    getRootProps: () => {
      const props = readProps();
      return rootBag(`${props.orientation}\u0000${props.disabled}`, () => ({
        id: ownerId,
        "data-orientation": props.orientation,
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag(`${props.disabled}`, () => ({
        id: labelId,
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getValueTextProps: () => {
      const props = readProps();
      return valueTextBag(`${props.disabled}\u0000${valueAsString()}`, () => ({
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getContentProps: () => {
      const props = readProps();
      const highlightedValue = ctx().highlightedValue;
      return contentBag(
        [
          props.disabled,
          props.orientation,
          props.selectionMode,
          props.columnCount,
          props.loopFocus,
          allRows().length,
          highlightedValue,
          service.focused,
        ].join("\u0000"),
        () => ({
          id: contentId,
          role: "listbox",
          tabindex: 0,
          "aria-multiselectable": props.selectionMode === "single" ? undefined : true,
          // The highlight rides the active-descendant: a listbox is one tab
          // stop whose focus moves between options, never into them.
          "aria-activedescendant": highlightedValue === null ? undefined : itemId(highlightedValue),
          "aria-labelledby": labelId,
          "data-activedescendant": highlightedValue === null ? undefined : itemId(highlightedValue),
          "data-orientation": props.orientation,
          "data-disabled": dataAttr(props.disabled),
          "data-layout": props.columnCount > 1 ? "grid" : "list",
          "data-empty": dataAttr(allRows().length === 0),
          onFocus: () => send({ type: "CONTENT.FOCUS" }),
          onBlur: () => send({ type: "CONTENT.BLUR" }),
          onKeydown: onContentKeydown,
        }),
      );
    },
    getItemProps: (row: ListboxRow) => {
      const props = readProps();
      const highlighted = ctx().highlightedValue === row.value;
      const selected = ctx().value.includes(row.value);
      return keyed(
        itemBags,
        row,
        `${highlighted}\u0000${selected}\u0000${service.focused}\u0000${props.orientation}`,
        () => ({
          id: itemId(row.value),
          role: "option",
          "data-value": row.value,
          "aria-selected": selected,
          "data-selected": dataAttr(selected),
          "data-state": selected ? "checked" : "unchecked",
          "data-orientation": props.orientation,
          "data-highlighted": dataAttr(highlighted),
          "aria-disabled": row.disabled ? true : undefined,
          "data-disabled": dataAttr(row.disabled),
          "data-focused": dataAttr(highlighted && service.focused),
          ...handlersFor(row),
        }),
      );
    },
    getItemTextProps: (row: ListboxRow) => {
      const props = readProps();
      const selected = ctx().value.includes(row.value);
      const highlighted = ctx().highlightedValue === row.value;
      return keyed(itemTextBags, row, `${selected}\u0000${highlighted}\u0000${props.disabled}`, () => ({
        "data-state": selected ? "checked" : "unchecked",
        "data-highlighted": dataAttr(highlighted),
        "data-disabled": dataAttr(row.disabled || props.disabled),
      }));
    },
    getItemIndicatorProps: (row: ListboxRow) => {
      const selected = ctx().value.includes(row.value);
      return keyed(indicatorBags, row, `${selected}`, () => ({
        "aria-hidden": true,
        "data-state": selected ? "checked" : "unchecked",
        hidden: !selected,
      }));
    },
    getBlocks: blocks,
    getRows: (block: ListboxBlock): readonly ListboxRow[] => block.rows,
    getItemGroupProps: (block: ListboxBlock) => {
      const props = readProps();
      return keyed(
        groupBags,
        block,
        `${props.disabled}\u0000${props.orientation}\u0000${props.columnCount}`,
        () => ({
          id: groupId(block.id),
          role: "group",
          "aria-labelledby": groupLabelId(block.id),
          "data-orientation": props.orientation,
          "data-layout": props.columnCount > 1 ? "grid" : "list",
          "data-disabled": dataAttr(props.disabled),
          ...columnAttrs(props.columnCount),
        }),
      );
    },
    getItemGroupLabelProps: (block: ListboxBlock) =>
      keyed(groupLabelBags, block, `${block.label}`, () => ({
        id: groupLabelId(block.id),
        role: "presentation",
        hidden: block.label === null,
      })),
    /** The notice an empty collection shows. Hidden while there are rows, so
     * the markup needs no conditional of its own. */
    getEmptyStateProps: () => {
      const props = readProps();
      const count = allRows().length;
      return emptyBag(`${props.disabled}\u0000${count}`, () => ({
        id: `${ownerId}:empty`,
        "aria-hidden": true,
        "data-empty": dataAttr(count === 0),
        hidden: count > 0,
      }));
    },
  };
}
