/**
 * Listbox connect: the DOM contract and the view-owned navigation.
 *
 * What the machine owns stays there: the highlight, the selection, the
 * focus. Everything that needs a node lives here — the content's keyboard
 * map (which computes its target against the visible rows and sends
 * NAVIGATE, the way the combobox's input map does), the collection the view
 * iterates, and the scroll reflex that reveals the highlighted row.
 *
 * The input Zag ships is absent: a listbox's typeahead reads off the
 * content's own keymap, so there is no field to control and no text the
 * machine must track. What remains of `INPUT.FOCUS` is the content's focus
 * owning the highlight's default, which CONTENT.FOCUS already carries.
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

export interface ListboxConnectProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  /** Zag's `composite`: the list is a panel rather than a field. */
  readonly composite: boolean;
  readonly loopFocus: boolean;
  readonly dir: "ltr" | "rtl";
  readonly orientation: "vertical" | "horizontal";
  readonly name: string;
  readonly form: string;
}

export interface ListboxCommands {
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
}

export interface ListboxApi extends ListboxCommands {
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

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace. */
const NAMESPACE = "listbox";

export interface ListboxService {
  readonly context: ListboxContext;
  /** The machine's phase, always `idle` — the gating lives in the guards. */
  readonly phase: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside the
 * handlers it caches. */
export type ReadListboxProps = () => ListboxConnectProps;

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

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

/** Zag's `isComposingEvent`: a composing keystroke is not a navigation. */
const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing === true || event.keyCode === 229;

/** A typeahead keystroke: a single printable character with no modifier. */
const isTypeahead = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

export function connectRobotListbox(
  service: ListboxService,
  readProps: ReadListboxProps,
  getRows: () => readonly ListboxRow[],
  id: string,
): ListboxApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const labelId = `${ownerId}:label`;
  const valueTextId = `${ownerId}:value-text`;
  const contentId = `${ownerId}:content`;
  const itemId = (value: string): string => `${ownerId}:item:${value}`;
  const groupId = (key: string): string => `${ownerId}:item-group:${key}`;
  const groupLabelId = (key: string): string => `${ownerId}:item-group-label:${key}`;
  const ctx = (): ListboxContext => service.context;
  const send: Send = (event): void => {
    service.send(event);
  };

  const focused = (): boolean => ctx().focused;

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
    const built: ListboxBlock[] = [];
    let label: string | null = null;
    let rows: ListboxRow[] = [];
    const flush = (): void => {
      if (rows.length === 0) return;
      built.push({ id: label ?? `group-${built.length}`, label, rows });
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

  const allRows = (): readonly ListboxBlock[] extends never ? never : readonly ListboxRow[] =>
    blocks().flatMap((block) => block.rows);

  const rowByValue = (value: string): ListboxRow | undefined =>
    allRows().find((row) => row.value === value);

  const valueAsString = (): string =>
    ctx()
      .value.map((value) => rowByValue(value)?.label)
      .filter((label): label is string => label !== undefined)
      .join(", ");

  // ---- navigation ---------------------------------------------------------

  /**
   * One step through the collection, mirroring Zag's `getNextValue`: the walk
   * starts at the highlighted row's position — so a highlight sitting on a
   * disabled row still moves — skips the disabled rows it passes, and returns
   * null when it runs off the end. With no reference point at all the RAW
   * first (or last) row is the answer, disabled or not, which is Zag's
   * `collection.firstValue`.
   */
  const step = (delta: 1 | -1): string | null => {
    const list = allRows();
    if (list.length === 0) return null;
    const current = ctx().highlightedValue;
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

  /** The collection's extremes, disabled or not. */
  const edge = (from: "first" | "last"): string | null => {
    const list = allRows();
    const row = from === "first" ? list[0] : list[list.length - 1];
    return row === undefined ? null : row.value;
  };

  /** The arrow's target: the walk, wrapping only when the host loops. */
  const nextWalked = (delta: 1 | -1): string | null => {
    const value = step(delta);
    if (value !== null) return value;
    if (!readProps().loopFocus) return null;
    return edge(delta > 0 ? "first" : "last");
  };

  const navigate = (
    value: string | null,
    event: KeyboardEvent,
  ): void => {
    if (value === null) return;
    event.preventDefault();
    send({
      type: "NAVIGATE",
      value,
      shiftKey: event.shiftKey,
      anchorValue: ctx().highlightedValue ?? undefined,
      metaKey: event.ctrlKey || event.metaKey,
    });
  };

  // ---- the keyboard map ---------------------------------------------------

  const onContentKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const props = readProps();
    if (props.disabled || props.readOnly) return;
    if (isComposing(event)) return;
    // Ctrl/Meta+A selects all in a multiple listbox; any other modifier is
    // the host's, not the machine's.
    if ((event.ctrlKey || event.metaKey) && event.key !== "a" && event.key !== "A") return;
    switch (event.key) {
      case "ArrowDown":
        navigate(nextWalked(1), event);
        return;
      case "ArrowUp":
        navigate(nextWalked(-1), event);
        return;
      case "ArrowLeft":
      case "ArrowRight": {
        if (props.orientation === "vertical") return;
        // In rtl the visual left is the next item, not the previous one.
        const forward = (event.key === "ArrowRight") !== (props.dir === "rtl");
        navigate(nextWalked(forward ? 1 : -1), event);
        return;
      }
      case "Home":
        navigate(edge("first"), event);
        return;
      case "End":
        navigate(edge("last"), event);
        return;
      case "Enter":
      case " ": {
        const highlighted = ctx().highlightedValue;
        if (highlighted === null) return;
        event.preventDefault();
        send({ type: "ITEM.CLICK", value: highlighted });
        return;
      }
      case "a":
      case "A": {
        if ((event.ctrlKey || event.metaKey) && ctx().multiple) {
          event.preventDefault();
          send({
            type: "VALUE.SET",
            value: allRows().filter((row) => !row.disabled).map((row) => row.value),
          });
        }
        return;
      }
      case "Escape": {
        if (ctx().value.length > 0 && !ctx().multiple) {
          event.preventDefault();
          send({ type: "VALUE.CLEAR" });
        }
        return;
      }
      default: {
        if (isTypeahead(event)) {
          event.preventDefault();
          send({ type: "CONTENT.TYPEAHEAD", key: event.key });
        }
        return;
      }
    }
  };

  // ---- the scroll reflex --------------------------------------------------

  /** Zag's `scrollToHighlightedItem`: the active descendant is revealed — the
   * browser's own scroll, never an offset of ours. */
  const reveal = {
    activeId: (): string => {
      const highlighted = ctx().highlightedValue;
      if (highlighted === null) return "";
      return itemId(highlighted);
    },
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const valueTextBag = cached();
  const contentBag = cached();
  const itemBags = new WeakMap<ListboxRow, BagMemo>();
  const itemTextBags = new WeakMap<ListboxRow, BagMemo>();
  const indicatorBags = new WeakMap<ListboxRow, BagMemo>();
  const groupBags = new WeakMap<ListboxBlock, BagMemo>();
  const groupLabelBags = new WeakMap<ListboxBlock, BagMemo>();

  /** Row handlers, built once per row: they read the behavioural props live,
   * so a cached closure is never a stale snapshot of one. */
  interface RowHandlers {
    readonly onPointerMove: (event: PointerEvent) => void;
    readonly onPointerLeave: () => void;
    readonly onClick: (event: MouseEvent) => void;
  }
  const rowHandlers = new WeakMap<ListboxRow, RowHandlers>();
  const handlersFor = (row: ListboxRow): RowHandlers => {
    const hit = rowHandlers.get(row);
    if (hit !== undefined) return hit;
    const made: RowHandlers = {
      onPointerMove: (event: PointerEvent) => {
        if (readProps().disabled) return;
        if (row.disabled || event.pointerType !== "mouse") return;
        if (ctx().highlightedValue === row.value) return;
        send({ type: "ITEM.POINTER_MOVE", value: row.value });
      },
      onPointerLeave: () => {
        if (readProps().disabled) return;
        if (row.disabled) return;
        send({ type: "ITEM.POINTER_LEAVE", value: row.value });
      },
      // Shift is selection, not the browser's: it extends the range from the
      // highlight, which is the anchor Zag reads. The rest of the modifiers
      // are the browser's — a new tab, a download, a context menu.
      onClick: (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        if (readProps().disabled) return;
        if (row.disabled) return;
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        ) {
          return;
        }
        send({
          type: "ITEM.CLICK",
          value: row.value,
          shiftKey: event.shiftKey,
          anchorValue: ctx().highlightedValue ?? undefined,
        });
      },
    };
    rowHandlers.set(row, made);
    return made;
  };

  /** Zag's `getItemState`: what one option is worth, in the host's terms. */
  const itemState = (row: ListboxRow): ListboxItemState => {
    const props = readProps();
    return {
      value: row.value,
      disabled: props.disabled || row.disabled,
      highlighted: ctx().highlightedValue === row.value,
      selected: ctx().value.includes(row.value),
    };
  };

  return {
    get focused(): boolean {
      return focused();
    },
    get highlightedValue(): string | null {
      return ctx().highlightedValue;
    },
    get highlightedItem(): ListboxRow | null {
      const highlighted = ctx().highlightedValue;
      return highlighted === null ? null : rowByValue(highlighted) ?? null;
    },
    get value(): readonly string[] {
      return [...ctx().value];
    },
    get valueAsString(): string {
      return valueAsString();
    },
    get hasSelectedItems(): boolean {
      return ctx().value.length > 0;
    },
    get selectedItems(): readonly ListboxRow[] {
      return ctx()
        .value.map(rowByValue)
        .filter((row): row is ListboxRow => row !== undefined);
    },
    get multiple(): boolean {
      return ctx().multiple;
    },
    get disabled(): boolean {
      return readProps().disabled;
    },
    get empty(): boolean {
      return allRows().length === 0;
    },
    syncSelectedItems: (): void => send({ type: "SELECTED_ITEMS.SYNC" }),
    setHighlightValue: (value: string): void => send({ type: "HIGHLIGHTED_VALUE.SET", value }),
    clearHighlightValue: (): void => send({ type: "HIGHLIGHTED_VALUE.CLEAR" }),
    selectValue: (value: string): void => send({ type: "ITEM.SELECT", value }),
    setValue: (value: readonly string[]): void => send({ type: "VALUE.SET", value: [...value] }),
    selectAll: (): void => {
      if (!ctx().multiple) return;
      send({
        type: "VALUE.SET",
        value: allRows().filter((row) => !row.disabled).map((row) => row.value),
      });
    },
    clearValue: (value?: string): void =>
      value === undefined
        ? send({ type: "VALUE.CLEAR" })
        : send({ type: "ITEM.CLEAR", value }),
    highlightFirst: (): void => {
      const value = edge("first");
      if (value !== null) send({ type: "HIGHLIGHTED_VALUE.SET", value });
    },
    highlightLast: (): void => {
      const value = edge("last");
      if (value !== null) send({ type: "HIGHLIGHTED_VALUE.SET", value });
    },
    highlightNext: (): void => {
      const value = step(1) ?? (readProps().loopFocus ? edge("first") : null);
      if (value !== null) send({ type: "HIGHLIGHTED_VALUE.SET", value });
    },
    highlightPrevious: (): void => {
      const value = step(-1) ?? (readProps().loopFocus ? edge("last") : null);
      if (value !== null) send({ type: "HIGHLIGHTED_VALUE.SET", value });
    },
    getBlocks: blocks,
    getRows: (block: ListboxBlock): readonly ListboxRow[] => block.rows,
    getItemState: itemState,
    getRootProps: () => {
      const props = readProps();
      return rootBag(
        [
          service.phase,
          props.disabled,
          props.dir,
          props.orientation,
          rootId,
        ].join("|"),
        () => ({
          id: rootId,
          dir: props.dir,
          "data-orientation": props.orientation,
          "data-disabled": dataAttr(props.disabled),
        }),
      );
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag([props.disabled, props.dir, labelId].join("|"), () => ({
        id: labelId,
        dir: props.dir,
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getValueTextProps: () =>
      valueTextBag([valueTextId, valueAsString()].join("|"), () => ({
        id: valueTextId,
        "data-empty": dataAttr(ctx().value.length === 0),
      })),
    getContentProps: () => {
      const props = readProps();
      const highlighted = ctx().highlightedValue;
      const active = highlighted === null ? undefined : itemId(highlighted);
      return contentBag(
        [
          service.phase,
          ctx().focused,
          highlighted ?? "",
          props.disabled,
          props.dir,
          props.orientation,
          ctx().multiple,
          contentId,
        ].join("|"),
        () => ({
          id: contentId,
          role: "listbox",
          tabindex: "0",
          dir: props.dir,
          "data-orientation": props.orientation,
          "data-activedescendant": active,
          "aria-activedescendant": active,
          "aria-multiselectable": ctx().multiple ? "true" : undefined,
          "aria-labelledby": labelId,
          "data-empty": dataAttr(allRows().length === 0),
          "data-disabled": dataAttr(props.disabled),
          "data-focused": dataAttr(ctx().focused),
          onFocus: () => send({ type: "CONTENT.FOCUS" }),
          onBlur: () => send({ type: "CONTENT.BLUR" }),
          onKeydown: onContentKeydown,
        }),
      );
    },
    getItemProps: (row: ListboxRow) => {
      const state = itemState(row);
      const handlers = handlersFor(row);
      return keyed(
        itemBags,
        row,
        [
          state.highlighted,
          state.selected,
          state.disabled,
          readProps().dir,
          readProps().orientation,
          itemId(row.value),
        ].join("|"),
        () => ({
          id: itemId(row.value),
          role: "option",
          dir: readProps().dir,
          "data-value": state.value,
          "aria-selected": state.selected ? "true" : "false",
          "data-selected": dataAttr(state.selected),
          "data-state": state.selected ? "checked" : "unchecked",
          "data-orientation": readProps().orientation,
          "data-highlighted": dataAttr(state.highlighted),
          "data-disabled": dataAttr(state.disabled),
          "aria-disabled": state.disabled ? "true" : undefined,
          onPointermove: handlers.onPointerMove,
          onPointerleave: handlers.onPointerLeave,
          onClick: handlers.onClick,
        }),
      );
    },
    getItemTextProps: (row: ListboxRow) => {
      const state = itemState(row);
      return keyed(
        itemTextBags,
        row,
        [state.selected, state.disabled, state.highlighted].join("|"),
        () => ({
          "data-state": state.selected ? "checked" : "unchecked",
          "data-disabled": dataAttr(state.disabled),
          "data-highlighted": dataAttr(state.highlighted),
        }),
      );
    },
    getItemIndicatorProps: (row: ListboxRow) => {
      const state = itemState(row);
      return keyed(indicatorBags, row, [state.selected].join("|"), () => ({
        "aria-hidden": "true",
        "data-state": state.selected ? "checked" : "unchecked",
        hidden: state.selected ? undefined : "",
      }));
    },
    getItemGroupProps: (block: ListboxBlock) => {
      const props = readProps();
      return keyed(
        groupBags,
        block,
        [block.id, props.disabled, props.orientation, allRows().length === 0].join("|"),
        () => ({
          id: groupId(block.id),
          role: "group",
          dir: props.dir,
          "aria-labelledby": groupLabelId(block.id),
          "data-disabled": dataAttr(props.disabled),
          "data-orientation": props.orientation,
          "data-empty": dataAttr(allRows().length === 0),
        }),
      );
    },
    getItemGroupLabelProps: (block: ListboxBlock) => {
      const props = readProps();
      return keyed(groupLabelBags, block, [block.id, props.dir].join("|"), () => ({
        id: groupLabelId(block.id),
        dir: props.dir,
        role: "presentation",
      }));
    },
    ...reveal,
  };
}
