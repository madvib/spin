/**
 * Combobox connect: the DOM contract, the view-owned navigation, and the
 * reflexes the parts carry.
 *
 * What the machine owns stays there: the four phases, the selection, the
 * input text and the highlight. Everything that needs a node lives here —
 * the keyboard map (which computes its target against the visible rows and
 * sends an event, exactly as the listbox's does), the collection the view
 * iterates, the dismissal and scroll reflexes, and the focus the panel
 * opening owes the input.
 *
 * Two of Zag's behaviours are the view's here for structural reasons. The
 * input is CONTROLLED — the bag binds `value` — so the machine's
 * `inputValue` is the field's text rather than a seed, and the DOM-writing
 * `syncInputValue` has nothing left to do. And the inline completion is a
 * context field rather than a DOM write, because the field would otherwise
 * hold text the machine does not know about.
 */

import { isOpenPhase, type ComboboxContext } from "./combobox.machine.ts";

/** One collection entry as the host authored it: value first, label optional. */
export interface ComboboxItem {
  readonly value: string;
  readonly label?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly group?: string | undefined;
}

export interface ComboboxRow {
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly group: string;
  /** Position in collection order — what the group walk reads. */
  readonly index: number;
}

export interface ComboboxBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly ComboboxRow[];
}

/** Zag's `getItemState`, verbatim in shape: what one option is worth. */
export interface ComboboxItemState {
  readonly value: string;
  readonly disabled: boolean;
  readonly highlighted: boolean;
  readonly selected: boolean;
}

export interface ComboboxTriggerProps {
  readonly focusable?: boolean;
}

export interface ComboboxFsmConnectProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  /** Zag's `composite`: the panel is a listbox rather than a dialog. */
  readonly composite: boolean;
  readonly loopFocus: boolean;
  readonly openOnClick: boolean;
  readonly openOnKeyPress: boolean;
  readonly alwaysSubmitOnEnter: boolean;
  readonly dir: "ltr" | "rtl";
  readonly placement: string;
  readonly name: string;
  readonly form: string;
  readonly placeholder: string;
  readonly triggerLabel: string;
  readonly clearTriggerLabel: string;
}

/** Zag's api methods minus the two the port has no floating layer for. */
export interface ComboboxCommands {
  syncSelectedItems(): void;
  setHighlightValue(value: string): void;
  clearHighlightValue(): void;
  selectValue(value: string): void;
  setValue(value: readonly string[]): void;
  setInputValue(value: string): void;
  clearValue(value?: string): void;
  focus(): void;
  setOpen(open: boolean): void;
}

export interface ComboboxFsmApi extends ComboboxCommands {
  readonly open: boolean;
  readonly focused: boolean;
  readonly inputValue: string;
  readonly highlightedValue: string | null;
  readonly highlightedItem: ComboboxRow | null;
  readonly value: readonly string[];
  readonly valueAsString: string;
  readonly hasSelectedItems: boolean;
  readonly selectedItems: readonly ComboboxRow[];
  readonly multiple: boolean;
  readonly disabled: boolean;
  readonly empty: boolean;
  getBlocks(): readonly ComboboxBlock[];
  getRows(block: ComboboxBlock): readonly ComboboxRow[];
  getItemState(row: ComboboxRow): ComboboxItemState;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getInputProps(): Record<string, unknown>;
  getTriggerProps(props?: ComboboxTriggerProps): Record<string, unknown>;
  getTriggerIndicatorProps(): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getItemProps(row: ComboboxRow): Record<string, unknown>;
  getItemTextProps(row: ComboboxRow): Record<string, unknown>;
  getItemIndicatorProps(row: ComboboxRow): Record<string, unknown>;
  getItemGroupProps(block: ComboboxBlock): Record<string, unknown>;
  getItemGroupLabelProps(block: ComboboxBlock): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The input's change event, narrowed to the one field the machine reads. */
interface InputChangeEvent {
  readonly currentTarget: { readonly value: string };
}

/** The part-id namespace. */
const NAMESPACE = "combobox";

export interface ComboboxService {
  readonly context: ComboboxContext;
  /** The machine's phase, one of the four state names. */
  readonly phase: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside the
 * handlers it caches. */
export type ReadComboboxProps = () => ComboboxFsmConnectProps;

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

/** Zag's `getEventKey`: the only thing `dir` changes is which way the
 * horizontal arrows point. */
const resolveKey = (event: KeyboardEvent, dir: "ltr" | "rtl"): string => {
  if (dir !== "rtl") return event.key;
  if (event.key === "ArrowLeft") return "ArrowRight";
  if (event.key === "ArrowRight") return "ArrowLeft";
  return event.key;
};

export function connectRobotCombobox(
  service: ComboboxService,
  readProps: ReadComboboxProps,
  getRows: () => readonly ComboboxRow[],
  id: string,
): ComboboxFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const inputId = `${ownerId}:input`;
  const contentId = `${ownerId}:content`;
  const positionerId = `${ownerId}:positioner`;
  const triggerId = `${ownerId}:trigger`;
  const clearTriggerId = `${ownerId}:clear-trigger`;
  const itemId = (value: string): string => `${ownerId}:item:${value}`;
  const groupId = (key: string): string => `${ownerId}:item-group:${key}`;
  const groupLabelId = (key: string): string => `${ownerId}:item-group-label:${key}`;
  const ctx = (): ComboboxContext => service.context;
  const send: Send = (event): void => {
    service.send(event);
  };

  const open = (): boolean => isOpenPhase(service.phase);
  const focused = (): boolean => service.phase !== "idle";

  /** The text the field shows: the inline completion while one is live, the
   * machine's own text otherwise. */
  const inputDisplay = (): string => ctx().autofill ?? ctx().inputValue;

  // ---- rows ---------------------------------------------------------------

  /** Memoized on the collection's identity: the `for` directive iterates this
   * array, and a fresh row object per read would replace the nodes, detach
   * every gesture in flight, and orphan the handlers those nodes hold. */
  let blockSource: readonly ComboboxRow[] | undefined;
  let blocksCache: readonly ComboboxBlock[] | undefined;
  const blocks = (): readonly ComboboxBlock[] => {
    const source = getRows();
    if (blocksCache !== undefined && source === blockSource) return blocksCache;
    blockSource = source;
    const built: ComboboxBlock[] = [];
    let label: string | null = null;
    let rows: ComboboxRow[] = [];
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

  const allRows = (): readonly ComboboxRow[] => blocks().flatMap((block) => block.rows);

  const rowByValue = (value: string): ComboboxRow | undefined =>
    allRows().find((row) => row.value === value);

  const valueAsString = (): string =>
    ctx()
      .value.map((value) => rowByValue(value)?.label)
      .filter((label): label is string => label !== undefined)
      .join(", ");

  // ---- navigation ---------------------------------------------------------

  const focus = (): void => {
    document.getElementById(inputId)?.focus();
  };

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
  const walked = (delta: 1 | -1): Record<string, string> => {
    const value = step(delta);
    if (value !== null) return { value };
    if (!readProps().loopFocus) return {};
    const wrapped = edge(delta > 0 ? "first" : "last");
    return wrapped === null ? {} : { value: wrapped };
  };

  // ---- the keyboard map ---------------------------------------------------

  const onInputKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const props = readProps();
    if (props.disabled || props.readOnly) return;
    // A composing keystroke and any modifier are the host's, not the
    // machine's: Zag routes the whole key map behind this guard.
    if (event.ctrlKey || event.shiftKey || isComposing(event)) return;
    const isOpen = open();
    switch (resolveKey(event, props.dir)) {
      case "ArrowDown": {
        if (!props.openOnKeyPress && !isOpen) return;
        event.preventDefault();
        if (event.altKey) {
          send({ type: "OPEN" });
          return;
        }
        send({ type: "INPUT.ARROW_DOWN", keypress: true, ...(isOpen ? walked(1) : {}) });
        return;
      }
      case "ArrowUp": {
        if (!props.openOnKeyPress && !isOpen) return;
        event.preventDefault();
        if (event.altKey) {
          send({ type: "CLOSE" });
          return;
        }
        send({ type: "INPUT.ARROW_UP", keypress: true, ...(isOpen ? walked(-1) : {}) });
        return;
      }
      case "Home": {
        const value = edge("first");
        send({ type: "INPUT.HOME", keypress: true, ...(isOpen && value !== null ? { value } : {}) });
        if (isOpen) event.preventDefault();
        return;
      }
      case "End": {
        const value = edge("last");
        send({ type: "INPUT.END", keypress: true, ...(isOpen && value !== null ? { value } : {}) });
        if (isOpen) event.preventDefault();
        return;
      }
      case "Escape": {
        // Zag sends INPUT.ESCAPE from the input's own keymap (not from the
        // dismissable layer): the focused state must revert typed text to
        // the selection, and the dismissable path only closes.
        send({ type: "INPUT.ESCAPE" });
        event.preventDefault();
        return;
      }
      case "Enter": {
        // Zag reads the prevention from the pre-send snapshot: the send may
        // select and close, so a post-send read would see no panel.
        const wasOpen = isOpen;
        const highlighted = ctx().highlightedValue !== null;
        const rejected = ctx().inputValue !== valueAsString() && !ctx().allowCustomValue;
        send({ type: "INPUT.ENTER" });
        // The field must not submit its form when the machine consumed the
        // key: a live highlight, or text the collection refuses, is both.
        if (wasOpen && !props.alwaysSubmitOnEnter && (highlighted || rejected)) {
          event.preventDefault();
        }
        return;
      }
      default:
        return;
    }
  };

  // ---- the reflexes -------------------------------------------------------

  /** The panel's dismissal, attached to the ROOT part: the root wraps the
   * input, the trigger and the clear trigger, so a press on any of them is
   * inside it and only a press elsewhere on the page dismisses — which is
   * Zag's `trackDismissableElement` with its exclude list. */
  const dismiss = {
    onEscape: (): void => {
      if (!open()) return;
      send({ type: "LAYER.ESCAPE" });
    },
    onOutside: (): void => {
      if (!open()) return;
      send({ type: "LAYER.INTERACT_OUTSIDE" });
    },
  };

  /** Zag's `scrollToHighlightedItem`: the active descendant is revealed, and
   * the lists go home when it goes away — the browser's own scroll, never an
   * offset of ours. */
  const reveal = {
    activeId: (): string => {
      const highlighted = ctx().highlightedValue;
      if (!open() || highlighted === null) return "";
      return itemId(highlighted);
    },
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const positionerBag = cached();
  const inputBag = cached();
  const triggerBag = cached();
  const triggerIndicatorBag = cached();
  const clearTriggerBag = cached();
  const contentBag = cached();
  const listBag = cached();
  const itemBags = new WeakMap<ComboboxRow, BagMemo>();
  const itemTextBags = new WeakMap<ComboboxRow, BagMemo>();
  const indicatorBags = new WeakMap<ComboboxRow, BagMemo>();
  const groupBags = new WeakMap<ComboboxBlock, BagMemo>();
  const groupLabelBags = new WeakMap<ComboboxBlock, BagMemo>();

  /** Row handlers, built once per row: they read the behavioural props live,
   * so a cached closure is never a stale snapshot of one. */
  interface RowHandlers {
    readonly onPointerMove: (event: PointerEvent) => void;
    readonly onPointerLeave: () => void;
    readonly onClick: (event: MouseEvent) => void;
  }
  const rowHandlers = new WeakMap<ComboboxRow, RowHandlers>();
  const handlersFor = (row: ComboboxRow): RowHandlers => {
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
      // A modified click is the browser's — a new tab, a download, a context
      // menu — and never a selection. Zag asks the same three questions of
      // the event; on a plain row their union is this guard.
      onClick: (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        if (readProps().disabled) return;
        if (row.disabled) return;
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        send({ type: "ITEM.CLICK", value: row.value });
      },
    };
    rowHandlers.set(row, made);
    return made;
  };

  const stateAttrs = (): Record<string, unknown> => ({
    "data-state": open() ? "open" : "closed",
    "data-phase": service.phase,
  });

  /** Zag's `getItemState`: what one option is worth, in the host's terms. */
  const itemState = (row: ComboboxRow): ComboboxItemState => {
    const props = readProps();
    return {
      value: row.value,
      disabled: props.disabled || row.disabled,
      highlighted: ctx().highlightedValue === row.value,
      selected: ctx().value.includes(row.value),
    };
  };

  return {
    get open(): boolean {
      return open();
    },
    get focused(): boolean {
      return focused();
    },
    get inputValue(): string {
      return inputDisplay();
    },
    get highlightedValue(): string | null {
      return ctx().highlightedValue;
    },
    get highlightedItem(): ComboboxRow | null {
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
    get selectedItems(): readonly ComboboxRow[] {
      return ctx()
        .value.map(rowByValue)
        .filter((row): row is ComboboxRow => row !== undefined);
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
    setInputValue: (value: string): void => send({ type: "INPUT_VALUE.SET", value }),
    clearValue: (value?: string): void =>
      value === undefined
        ? send({ type: "VALUE.CLEAR" })
        : send({ type: "ITEM.CLEAR", value }),
    focus: (): void => focus(),
    setOpen: (next: boolean): void => {
      // The host's word applies to the panel's state: asking for what is
      // already true is not a move, so it re-enters nothing.
      if (next === open()) return;
      send({ type: next ? "OPEN" : "CLOSE" });
    },
    getBlocks: blocks,
    getRows: (block: ComboboxBlock): readonly ComboboxRow[] => block.rows,
    getItemState: itemState,
    getRootProps: () => {
      const props = readProps();
      return rootBag(
        [
          service.phase,
          props.disabled,
          props.readOnly,
          props.invalid,
          props.required,
          props.dir,
          props.composite,
        ].join("\u0000"),
        () => ({
          id: rootId,
          dir: props.dir,
          "data-state": open() ? "open" : "closed",
          "data-phase": service.phase,
          "data-disabled": dataAttr(props.disabled),
          "data-readonly": dataAttr(props.readOnly),
          "data-invalid": dataAttr(props.invalid),
          "data-required": dataAttr(props.required),
          // The layer: a press outside the whole widget dismisses, and
          // Escape while it is up does too.
          "use:dismissable": dismiss,
        }),
      );
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag(
        [
          service.phase,
          props.disabled,
          props.readOnly,
          props.invalid,
          props.required,
          props.dir,
          props.composite,
        ].join("\u0000"),
        () => ({
          id: labelId,
          dir: props.dir,
          htmlFor: inputId,
          "data-state": open() ? "open" : "closed",
          "data-disabled": dataAttr(props.disabled),
          "data-readonly": dataAttr(props.readOnly),
          "data-invalid": dataAttr(props.invalid),
          "data-required": dataAttr(props.required),
          "data-focused": dataAttr(focused()),
          onClick: (): void => {
            // The label's click is the input's: the control keeps its own
            // behaviour only when the host asked for the dialog shape.
            if (props.composite) return;
            focus();
          },
        }),
      );
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(
        [service.phase, props.disabled, props.invalid].join("\u0000"),
        () => ({
          id: controlId,
          "data-state": open() ? "open" : "closed",
          "data-focused": dataAttr(focused()),
          "data-disabled": dataAttr(props.disabled),
          "data-invalid": dataAttr(props.invalid),
        }),
      );
    },
    getPositionerProps: () => {
      const props = readProps();
      const side = props.placement.split("-")[0] ?? props.placement;
      return positionerBag(
        [service.phase, props.placement].join("\u0000"),
        () => ({
          id: positionerId,
          ...stateAttrs(),
          // Zag measures a floating placement and reports it; the recipe
          // anchors the panel with utilities, so the authored placement and
          // the side it implies are the state the theme keys on.
          "data-placement": props.placement,
          "data-side": side,
        }),
      );
    },
    getInputProps: () => {
      const props = readProps();
      return inputBag(
        [
          service.phase,
          props.dir,
          props.disabled,
          props.readOnly,
          props.invalid,
          props.required,
          props.name,
          props.form,
          props.placeholder,
          ctx().highlightedValue,
          inputDisplay(),
          ctx().inputValue,
          valueAsString(),
        ].join("\u0000"),
        () => ({
          id: inputId,
          dir: props.dir,
          type: "text",
          role: "combobox",
          name: props.name,
          form: props.form,
          disabled: props.disabled,
          readOnly: props.readOnly,
          required: props.required,
          placeholder: props.placeholder,
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "none",
          spellCheck: false,
          // The field is controlled: the bag binds the machine's text, and
          // an inline completion rides on top of it while one is live.
          value: inputDisplay(),
          "aria-invalid": props.invalid,
          "aria-autocomplete": ctx().inputBehavior === "autocomplete" ? "both" : "list",
          "aria-controls": contentId,
          "aria-expanded": open(),
          "aria-activedescendant":
            ctx().highlightedValue === null
              ? undefined
              : itemId(ctx().highlightedValue as string),
          "data-state": open() ? "open" : "closed",
          "data-disabled": dataAttr(props.disabled),
          "data-invalid": dataAttr(props.invalid),
          "data-readonly": dataAttr(props.readOnly),
          onFocus: (): void => {
            if (props.disabled) return;
            send({ type: "INPUT.FOCUS" });
          },
          onBlur: (): void => {
            if (props.disabled) return;
            send({ type: "INPUT.BLUR" });
          },
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (!props.openOnClick) return;
            if (props.disabled || props.readOnly) return;
            send({ type: "INPUT.CLICK" });
          },
          onInput: (event: InputChangeEvent): void => {
            send({ type: "INPUT.CHANGE", value: event.currentTarget.value });
          },
          onKeydown: onInputKeydown,
        }),
      );
    },
    getTriggerProps: (trigger: ComboboxTriggerProps = {}) => {
      const props = readProps();
      const focusable = trigger.focusable === true;
      return triggerBag(
        [
          service.phase,
          props.disabled,
          props.invalid,
          props.readOnly,
          props.dir,
          props.composite,
          props.triggerLabel,
          focusable,
        ].join("\u0000"),
        () => ({
          id: triggerId,
          dir: props.dir,
          type: "button",
          "aria-haspopup": props.composite ? "listbox" : "dialog",
          "aria-label": props.triggerLabel,
          "aria-expanded": open(),
          "aria-controls": open() ? contentId : undefined,
          disabled: props.disabled,
          tabIndex: focusable ? undefined : -1,
          "data-state": open() ? "open" : "closed",
          "data-focusable": dataAttr(focusable),
          "data-disabled": dataAttr(props.disabled),
          "data-invalid": dataAttr(props.invalid),
          "data-readonly": dataAttr(props.readOnly),
          onFocus: (): void => {
            if (!focusable) return;
            send({ type: "INPUT.FOCUS" });
          },
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (props.disabled || props.readOnly) return;
            if (event.button !== 0) return;
            send({ type: "TRIGGER.CLICK" });
          },
          // A press must not move focus to the button: the field keeps it,
          // which is what keeps the caret where the user left it.
          onPointerDown: (event: PointerEvent): void => {
            if (props.disabled || props.readOnly) return;
            if (event.pointerType === "touch") return;
            if (event.button !== 0) return;
            event.preventDefault();
            focus();
          },
          // The non-composite shape has no input driving the panel, so the
          // trigger owns the arrows.
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            if (props.composite) return;
            if (props.disabled || props.readOnly) return;
            const key = resolveKey(event, props.dir);
            if (key !== "ArrowDown" && key !== "ArrowUp") return;
            event.preventDefault();
            send({ type: key === "ArrowDown" ? "INPUT.ARROW_DOWN" : "INPUT.ARROW_UP" });
          },
        }),
      );
    },
    /** Zag's anatomy has no indicator; the menu port made the same addition
     * for the disclosure polish, so the recipe's chevron rotates with the
     * panel. */
    getTriggerIndicatorProps: () => {
      const props = readProps();
      return triggerIndicatorBag(`indicator\u0000${service.phase}\u0000${props.dir}`, () => ({
        "aria-hidden": true,
        dir: props.dir,
        "data-state": open() ? "open" : "closed",
      }));
    },
    getClearTriggerProps: () => {
      const props = readProps();
      return clearTriggerBag(
        [
          service.phase,
          props.disabled,
          props.invalid,
          ctx().value.length,
          props.clearTriggerLabel,
        ].join("\u0000"),
        () => ({
          id: clearTriggerId,
          type: "button",
          "aria-label": props.clearTriggerLabel,
          "aria-controls": inputId,
          disabled: props.disabled,
          tabIndex: -1,
          "data-state": open() ? "open" : "closed",
          "data-invalid": dataAttr(props.invalid),
          "data-disabled": dataAttr(props.disabled),
          hidden: ctx().value.length === 0,
          onPointerDown: (event: PointerEvent): void => {
            if (event.button !== 0) return;
            event.preventDefault();
          },
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (props.disabled || props.readOnly) return;
            send({ type: "VALUE.CLEAR" });
          },
        }),
      );
    },
    getContentProps: () => {
      const props = readProps();
      const highlighted = ctx().highlightedValue;
      return contentBag(
        [
          service.phase,
          props.disabled,
          props.dir,
          props.composite,
          ctx().multiple,
          props.placement,
          allRows().length,
          highlighted,
        ].join("\u0000"),
        () => ({
          id: contentId,
          dir: props.dir,
          role: props.composite ? "listbox" : "dialog",
          tabIndex: -1,
          "aria-labelledby": labelId,
          "aria-multiselectable": props.composite && ctx().multiple ? true : undefined,
          "data-state": open() ? "open" : "closed",
          "data-placement": props.placement,
          "data-side": props.placement.split("-")[0] ?? props.placement,
          "data-empty": dataAttr(allRows().length === 0),
          "data-disabled": dataAttr(props.disabled),
          // A press inside the panel must not take focus out of the field.
          onPointerDown: (event: PointerEvent): void => {
            if (event.button !== 0) return;
            event.preventDefault();
          },
          // The active descendant is revealed by the browser's own scroll,
          // and the lists go home when it goes away.
          "use:scroll-into-view": reveal,
        }),
      );
    },
    getListProps: () => {
      const props = readProps();
      return listBag(
        [
          service.phase,
          props.dir,
          props.composite,
          ctx().multiple,
          allRows().length,
        ].join("\u0000"),
        () => ({
          dir: props.dir,
          role: props.composite ? undefined : "listbox",
          "aria-labelledby": labelId,
          "aria-multiselectable": props.composite ? undefined : ctx().multiple ? true : undefined,
          "data-empty": dataAttr(allRows().length === 0),
        }),
      );
    },
    getItemProps: (row: ComboboxRow) => {
      const state = itemState(row);
      return keyed(
        itemBags,
        row,
        `${state.highlighted}\u0000${state.selected}\u0000${state.disabled}`,
        () => ({
          id: itemId(row.value),
          role: "option",
          tabIndex: -1,
          "data-value": row.value,
          "data-state": state.selected ? "checked" : "unchecked",
          "aria-selected": state.selected,
          "aria-disabled": state.disabled ? true : undefined,
          "data-highlighted": dataAttr(state.highlighted),
          "data-disabled": dataAttr(state.disabled),
          ...handlersFor(row),
        }),
      );
    },
    getItemTextProps: (row: ComboboxRow) => {
      const state = itemState(row);
      return keyed(
        itemTextBags,
        row,
        `${state.highlighted}\u0000${state.selected}\u0000${state.disabled}`,
        () => ({
          "data-state": state.selected ? "checked" : "unchecked",
          "data-highlighted": dataAttr(state.highlighted),
          "data-disabled": dataAttr(state.disabled),
        }),
      );
    },
    getItemIndicatorProps: (row: ComboboxRow) => {
      const state = itemState(row);
      return keyed(indicatorBags, row, `${state.selected}`, () => ({
        "aria-hidden": true,
        "data-state": state.selected ? "checked" : "unchecked",
        hidden: !state.selected,
      }));
    },
    getItemGroupProps: (block: ComboboxBlock) => {
      const props = readProps();
      return keyed(
        groupBags,
        block,
        `${service.phase}\u0000${props.dir}\u0000${allRows().length}`,
        () => ({
          id: groupId(block.id),
          dir: props.dir,
          role: "group",
          "aria-labelledby": groupLabelId(block.id),
          "data-empty": dataAttr(allRows().length === 0),
        }),
      );
    },
    getItemGroupLabelProps: (block: ComboboxBlock) =>
      keyed(groupLabelBags, block, `${block.label}`, () => ({
        id: groupLabelId(block.id),
        role: "presentation",
        hidden: block.label === null,
      })),
  };
}
