import { dataAttr } from "./select.shared.ts";
import type { SelectContext, SelectEvent } from "./select.machine.ts";

/**
 * Select connect: the DOM contract for a closed trigger that opens a
 * listbox — the same selection semantics as the combobox without the input.
 *
 * Every reflex is a stdlib action carried in a bag: the content carries
 * `use:dismissable` (outside press and Escape) and `use:scroll-into-view`
 * (the highlighted row stays visible), the hidden select carries
 * `use:form-control` (fieldset disabled, form reset). The machine owns the
 * modes; the actions own the reflexes; the connect only wires which element
 * gets which behavior and hands each action its `send`.
 */

export interface SelectConnectProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly multiple: boolean;
  readonly closeOnSelect: boolean;
  readonly loopFocus: boolean;
  readonly name: string;
  readonly form: string;
  readonly dir: "ltr" | "rtl";
  readonly placement: string;
  readonly label: string;
  readonly placeholder: string;
  readonly clearTriggerLabel: string;
}

/** Zag's api methods, narrowed to the command surface the element exposes. */
export interface SelectCommands {
  /** Re-derive the selection against the collection (values are synced by
   * the bridge on every send, so this carries no payload). */
  syncSelectedItems(): void;
  selectValue(value: string): void;
  setValue(value: readonly string[]): void;
  clearValue(): void;
  setHighlightValue(value: string): void;
  clearHighlightValue(): void;
  /** The imperative open/close: the state getter is the `open` field. */
  setOpen(open: boolean): void;
  close(): void;
  toggle(): void;
  focus(): void;
}

export interface SelectApi extends SelectCommands {
  readonly open: boolean;
  readonly focused: boolean;
  readonly value: readonly string[];
  readonly valueAsString: string;
  readonly hasSelectedItems: boolean;
  readonly highlightedValue: string | null;
  readonly highlightedItem: SelectRow | null;
  readonly selectedItems: readonly SelectRow[];
  readonly multiple: boolean;
  readonly disabled: boolean;
  readonly empty: boolean;
  /** The collection, for the recipe's row iteration. */
  getRows(): readonly SelectRow[];
  /** The selected rows, for the trigger's value text. */
  getSelectedRows(): readonly SelectRow[];
  getItemState(row: SelectRow): SelectItemState;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getTriggerProps(): Record<string, unknown>;
  getTriggerIndicatorProps(): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getItemProps(row: SelectRow): Record<string, unknown>;
  getItemTextProps(row: SelectRow): Record<string, unknown>;
  getItemIndicatorProps(row: SelectRow): Record<string, unknown>;
  getHiddenSelectProps(): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface SelectService {
  readonly context: SelectContext;
  /** The machine's state: idle, focused, or open. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** One collection row as the bridge hands it over. */
export interface SelectRow {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectItemState {
  readonly selected: boolean;
  readonly highlighted: boolean;
  readonly disabled: boolean;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one trigger, one
 * content per element), so a single slot is the whole cache — a WeakMap
 * keyed by string is not a WeakMap at all. */
function memo(): (
  sig: string,
  build: () => Record<string, unknown>,
) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next, build) => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Rows are stable objects, so a per-row memo is keyed on the row itself. */
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

interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** The part-id namespace. */
const NAMESPACE = "select";

/** `readProps` on demand: the connect lives as long as the element does, so
 * a snapshot would freeze the first read's values inside cached handlers. */
export type ReadSelectProps = () => SelectConnectProps;

/** The `getRows` source: the collection the bridge keeps in sync. */
export type ReadRows = () => readonly SelectRow[];

/** Zag's `getEventKey`: the only thing `dir` changes is the arrow mapping. */
const resolveKey = (event: KeyboardEvent, dir: "ltr" | "rtl"): string => {
  if (dir !== "rtl") return event.key;
  if (event.key === "ArrowLeft") return "ArrowRight";
  if (event.key === "ArrowRight") return "ArrowLeft";
  return event.key;
};

const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing === true || event.keyCode === 229;

export function connectSelect(
  service: SelectService,
  readProps: ReadSelectProps,
  getRows: ReadRows,
  id: string,
  send: (event: SelectEvent) => void,
): SelectApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const triggerId = `${ownerId}:trigger`;
  const clearTriggerId = `${ownerId}:clear-trigger`;
  const valueTextId = `${ownerId}:value-text`;
  const positionerId = `${ownerId}:positioner`;
  const contentId = `${ownerId}:content`;
  const listId = `${ownerId}:list`;
  const hiddenSelectId = `${ownerId}:hidden`;
  const itemId = (value: string): string => `${ownerId}:item:${value}`;
  const itemTextId = (value: string): string => `${ownerId}:item-text:${value}`;

  const ctx = (): SelectContext => service.context;
  const open = (): boolean => service.state === "open";
  const focused = (): boolean => service.state !== "idle";
  const rows = (): readonly SelectRow[] => getRows();
  const rowOf = (value: string | null): SelectRow | null =>
    value === null ? null : rows().find((row) => row.value === value) ?? null;

  const label = (value: string): string => ctx().labels[value] ?? value;
  const valueAsString = (): string => ctx().value.map(label).join(", ");
  const hasSelectedItems = (): boolean => ctx().value.length > 0;
  const selectedItems = (): readonly SelectRow[] =>
    ctx().value.map((value) => rowOf(value)).filter((row): row is SelectRow =>
      row !== null
    );

  /** The item state both the row's attributes and the keydown handlers read. */
  const getItemState = (row: SelectRow): SelectItemState => ({
    selected: ctx().value.includes(row.value),
    highlighted: ctx().highlightedValue === row.value,
    disabled: row.disabled === true,
  });

  const stateAttrs = (): Record<string, unknown> => ({
    "data-state": open() ? "open" : "closed",
    "data-focused": focused() ? "" : undefined,
    "data-disabled": dataAttr(props().disabled),
    "data-readonly": dataAttr(props().readOnly),
    "data-invalid": dataAttr(props().invalid),
    "data-multiple": dataAttr(props().multiple),
    "data-placeholder": dataAttr(ctx().value.length === 0),
  });
  const props = readProps;

  // One memo per part: there is one root, one label, one control, and so on
  // per element instance, so the cache is a slot per part, built before the
  // bags that read them.
  const rootMemo = memo();
  const labelMemo = memo();
  const controlMemo = memo();
  const triggerMemo = memo();
  const indicatorMemo = memo();
  const clearMemo = memo();
  const valueTextMemo = memo();
  const positionerMemo = memo();
  const contentMemo = memo();
  const listMemo = memo();
  const hiddenMemo = memo();

  const rootBag = (): Record<string, unknown> =>
    rootMemo(`${open()}\u0000${focused()}\u0000${props().disabled}`, () => ({
      id: rootId,
      dir: props().dir,
      ...stateAttrs(),
    }));

  const labelBag = (): Record<string, unknown> =>
    labelMemo(`props().label`, () => ({
      id: labelId,
      dir: props().dir,
      for: triggerId,
      "data-state": open() ? "open" : "closed",
      "data-disabled": dataAttr(props().disabled),
    }));

  const controlBag = (): Record<string, unknown> =>
    controlMemo(`${open()}\u0000${props().disabled}`, () => ({
      id: controlId,
      dir: props().dir,
      "data-state": open() ? "open" : "closed",
      "data-disabled": dataAttr(props().disabled),
    }));

  const triggerBag = (): Record<string, unknown> =>
    triggerMemo(
      `${open()}\u0000${focused()}\u0000${hasSelectedItems()}`,
      () => ({
        id: triggerId,
        type: "button",
        dir: props().dir,
        role: "combobox",
        "aria-haspopup": "listbox",
        "aria-expanded": open(),
        "aria-controls": contentId,
        "aria-labelledby": `${labelId} ${valueTextId}`,
        "aria-required": props().required || undefined,
        "aria-invalid": props().invalid || undefined,
        disabled: props().disabled || props().readOnly,
        "data-state": open() ? "open" : "closed",
        "data-focused": focused() ? "" : undefined,
        "data-placeholder": dataAttr(ctx().value.length === 0),
        "data-controls": contentId,
        "data-ownedby": listId,
        onFocus: () => send({ type: "TRIGGER.FOCUS" }),
        onBlur: () => send({ type: "TRIGGER.BLUR" }),
        onClick: () => send({ type: "TRIGGER.CLICK" }),
        onKeyDown: (event: KeyboardEvent) => {
          if (isComposing(event) || event.defaultPrevented) return;
          const key = resolveKey(event, props().dir);
          switch (key) {
            case "ArrowDown":
              event.preventDefault();
              send({ type: "TRIGGER.ARROW_DOWN" });
              break;
            case "ArrowUp":
              event.preventDefault();
              send({ type: "TRIGGER.ARROW_UP" });
              break;
            case "ArrowLeft":
              if (open()) return;
              event.preventDefault();
              send({ type: "TRIGGER.ARROW_LEFT" });
              break;
            case "ArrowRight":
              if (open()) return;
              event.preventDefault();
              send({ type: "TRIGGER.ARROW_RIGHT" });
              break;
            case "Home":
              if (open()) return;
              event.preventDefault();
              send({ type: "TRIGGER.HOME" });
              break;
            case "End":
              if (open()) return;
              event.preventDefault();
              send({ type: "TRIGGER.END" });
              break;
            case "Enter":
              event.preventDefault();
              send({ type: "TRIGGER.ENTER" });
              break;
            default:
              if (key.length === 1 && /\S/.test(key)) {
                send({ type: "TRIGGER.TYPEAHEAD", value: key });
              }
          }
        },
      }),
    );

  const indicatorBag = (): Record<string, unknown> =>
    indicatorMemo(`${open()}`, () => ({
      "aria-hidden": true,
      "data-state": open() ? "open" : "closed",
      "data-disabled": dataAttr(props().disabled),
    }));

  const clearBag = (): Record<string, unknown> =>
    clearMemo(`${hasSelectedItems()}`, () => ({
      id: clearTriggerId,
      type: "button",
      tabIndex: -1,
      "aria-label": props().clearTriggerLabel,
      disabled: props().disabled,
      "data-state": hasSelectedItems() ? "visible" : "hidden",
      onClick: (event: MouseEvent) => {
        event.stopPropagation();
        send({ type: "CLEAR.CLICK" });
      },
    }));

  const valueTextBag = (): Record<string, unknown> =>
    valueTextMemo(`valueAsString()`, () => ({
      id: valueTextId,
      "data-placeholder": dataAttr(ctx().value.length === 0),
    }));

  /** The positioner is the falling layer: hidden while closed so nothing in
   * a closed panel is tabbable or announced. */
  const positionerBag = (): Record<string, unknown> =>
    positionerMemo(`${open()}`, () => ({
      id: positionerId,
      dir: props().dir,
      "data-state": open() ? "open" : "closed",
      hidden: !open(),
      "data-placement": props().placement,
    }));

  const contentBag = (): Record<string, unknown> =>
    contentMemo(
      `${open()}\u0000${props().disabled}\u0000${ctx().highlightedValue ?? ""}`,
      () => {
        // The activedescendant is the highlighted row's id, or nothing when the
        // highlight is empty: an id of `null` is not an id.
        const highlighted = ctx().highlightedValue;
        const activedescendant = highlighted === null
          ? undefined
          : itemId(highlighted);
        return {
          id: contentId,
          dir: props().dir,
          role: "listbox",
          "aria-labelledby": labelId,
          "aria-activedescendant": activedescendant,
          "data-activedescendant": activedescendant,
          "aria-multiselectable": props().multiple || undefined,
          "aria-required": props().required || undefined,
          "aria-readonly": props().readOnly || undefined,
          hidden: !open(),
          tabIndex: 0,
          "data-state": open() ? "open" : "closed",
          onKeyDown: (event: KeyboardEvent) => {
            if (isComposing(event) || event.defaultPrevented) return;
            const key = resolveKey(event, props().dir);
            switch (key) {
              case "ArrowDown":
                event.preventDefault();
                send({ type: "CONTENT.ARROW_DOWN" });
                break;
              case "ArrowUp":
                event.preventDefault();
                send({ type: "CONTENT.ARROW_UP" });
                break;
              case "Home":
                event.preventDefault();
                send({ type: "CONTENT.HOME" });
                break;
              case "End":
                event.preventDefault();
                send({ type: "CONTENT.END" });
                break;
              case "Enter":
                event.preventDefault();
                // The content's Enter picks the highlight, exactly as the
                // click does: the event carries the row so the click path
                // and the key path agree.
                {
                  const picked = ctx().highlightedValue;
                  if (picked !== null) {
                    send({ type: "ITEM.CLICK", value: picked });
                  }
                }
                break;
              default:
                if (key.length === 1 && /\S/.test(key)) {
                  send({ type: "CONTENT.TYPEAHEAD", value: key });
                }
            }
          },
          // The reflexes, as actions: the outside press and Escape dismiss, the
          // highlighted row stays scrolled into view. The trigger is this
          // component's own gesture, so a press on it toggles, not dismisses.
          "use:dismissable": {
            onOutside: (event: PointerEvent) => {
              const target = event.target;
              // The trigger is this component's own gesture, so a press on
              // it toggles rather than dismisses. The attribute spelling:
              // the id carries colons, which are not valid in an id
              // selector, and `closest` throws on an invalid one.
              if (
                target instanceof Element &&
                target.closest(`[id="${triggerId}"]`) !== null
              ) return;
              const focusable = target instanceof Element &&
                target.closest("button, [href], input, select, textarea") !==
                  null;
              send({
                type: "LAYER.INTERACT_OUTSIDE",
                restoreFocus: !(focusable || event.button === 2),
              });
            },
            onEscape: () => send({ type: "LAYER.ESCAPE" }),
          },
          // Opening hands the panel focus: the trigger's keys stop applying
          // once the panel is up, so the keyboard walk starts inside.
          "use:select-focus": { open: open() },
          "use:scroll-into-view": { activeId: () => ctx().highlightedValue },
        };
      },
    );

  const listBag = (): Record<string, unknown> =>
    listMemo(`${open()}\u0000${props().dir}`, () => ({
      id: listId,
      dir: props().dir,
      role: "group",
      "data-state": open() ? "open" : "closed",
    }));

  const itemBag = (row: SelectRow): Record<string, unknown> =>
    keyed(itemMemos, row, `${itemStateSigs.get(row) ?? ""}`, () => {
      const state = getItemState(row);
      return {
        id: itemId(row.value),
        role: "option",
        "aria-selected": state.selected,
        "data-state": state.highlighted ? "highlighted" : "idle",
        "data-selected": dataAttr(state.selected),
        "data-highlighted": dataAttr(state.highlighted),
        "data-disabled": dataAttr(state.disabled),
        "data-ownedby": listId,
        onPointerMove: () => {
          if (state.disabled) return;
          send({ type: "ITEM.POINTER_MOVE", value: row.value });
        },
        onPointerLeave: () => send({ type: "ITEM.POINTER_LEAVE" }),
        onClick: () => {
          if (state.disabled) return;
          send({ type: "ITEM.CLICK", value: row.value });
        },
      };
    });
  const itemMemos = new WeakMap<SelectRow, BagMemo>();
  const itemStateSigs = new WeakMap<SelectRow, string>();

  const itemTextBag = (row: SelectRow): Record<string, unknown> =>
    keyed(
      itemTextMemos,
      row,
      `${getItemState(row).selected}\u0000${getItemState(row).highlighted}`,
      () => ({
        id: itemTextId(row.value),
        "data-state": getItemState(row).highlighted ? "highlighted" : "idle",
        "data-selected": dataAttr(getItemState(row).selected),
      }),
    );
  const itemTextMemos = new WeakMap<SelectRow, BagMemo>();

  const itemIndicatorBag = (row: SelectRow): Record<string, unknown> =>
    keyed(itemIndicatorMemos, row, `${getItemState(row).selected}`, () => ({
      "aria-hidden": true,
      "data-state": getItemState(row).selected ? "checked" : "unchecked",
    }));
  const itemIndicatorMemos = new WeakMap<SelectRow, BagMemo>();

  /** The hidden native select is the form's value: a real control, so the
   * form posts this component's selection without a custom serialization. */
  const hiddenSelectBag = (): Record<string, unknown> =>
    hiddenMemo(
      `${ctx().value.join(",")}\u0000${
        rows().map((row) => row.value).join(",")
      }\u0000${props().multiple}`,
      () => ({
        id: hiddenSelectId,
        "aria-hidden": true,
        tabIndex: -1,
        name: props().name || undefined,
        form: props().form || undefined,
        disabled: props().disabled,
        required: props().required,
        multiple: props().multiple,
        "data-state": "hidden",
        // The options cannot be templated inside a `<select>` (the parser
        // drops it), so the action builds them from the collection, and the
        // form's reset reads them back through form-control. The entry is a
        // thunk because a plain object is evaluated once at attach and the
        // action would never see a later selection.
        "use:select-options": () => ({
          rows: rows(),
          value: [...ctx().value],
          multiple: props().multiple,
        }),
        "use:form-control": {
          onDisabledChange: () => {
            // The fieldset's disabled state is reported to the host through
            // the element; the machine's own `disabled` prop is unaffected.
          },
        },
      }),
    );
  // The item memo signature: the machine's context can change without the
  // row object moving, so the signature is recomputed per read.
  const signRows = (): void => {
    for (const row of rows()) {
      const state = getItemState(row);
      itemStateSigs.set(
        row,
        `${state.selected}\u0000${state.highlighted}\u0000${state.disabled}`,
      );
    }
  };
  signRows();

  return {
    get open(): boolean {
      return open();
    },
    get focused(): boolean {
      return focused();
    },
    get value(): readonly string[] {
      return [...ctx().value];
    },
    get valueAsString(): string {
      return valueAsString();
    },
    get hasSelectedItems(): boolean {
      return hasSelectedItems();
    },
    get highlightedValue(): string | null {
      return ctx().highlightedValue;
    },
    get highlightedItem(): SelectRow | null {
      return rowOf(ctx().highlightedValue);
    },
    get selectedItems(): readonly SelectRow[] {
      return selectedItems();
    },
    get multiple(): boolean {
      return props().multiple;
    },
    get disabled(): boolean {
      return props().disabled;
    },
    get empty(): boolean {
      return rows().length === 0;
    },
    getRows: () => rows(),
    getSelectedRows: () => selectedItems(),
    getItemState,
    getRootProps: () => rootBag(),
    getLabelProps: () => labelBag(),
    getControlProps: () => controlBag(),
    getTriggerProps: () => triggerBag(),
    getTriggerIndicatorProps: () => indicatorBag(),
    getClearTriggerProps: () => clearBag(),
    getValueTextProps: () => valueTextBag(),
    getPositionerProps: () => positionerBag(),
    getContentProps: () => contentBag(),
    getListProps: () => listBag(),
    getItemProps: (row: SelectRow) => {
      signRows();
      return itemBag(row);
    },
    getItemTextProps: (row: SelectRow) => itemTextBag(row),
    getItemIndicatorProps: (row: SelectRow) => itemIndicatorBag(row),
    getHiddenSelectProps: () => hiddenSelectBag(),
    syncSelectedItems: () => send({ type: "SELECTED_ITEMS.SYNC" }),
    selectValue: (value: string) => send({ type: "ITEM.SELECT", value }),
    setValue: (value: readonly string[]) => send({ type: "VALUE.SET", value }),
    clearValue: () => send({ type: "VALUE.CLEAR" }),
    setHighlightValue: (value: string) =>
      send({ type: "HIGHLIGHTED_VALUE.SET", value }),
    clearHighlightValue: () => send({ type: "HIGHLIGHTED_VALUE.CLEAR" }),
    setOpen: (next: boolean) =>
      send(next ? { type: "OPEN" } : { type: "CLOSE" }),
    close: () => send({ type: "CLOSE" }),
    toggle: () => send(open() ? { type: "CLOSE" } : { type: "OPEN" }),
    focus: () => {
      // The DOM focus is the view's job: the machine reports the mode the
      // host's focus() lands in.
      send({ type: "TRIGGER.FOCUS" });
    },
  };
}

/** The enabled rows, for the recipe's keyboard-only ordering. */
export const selectEnabled = (
  rows: readonly SelectRow[],
): readonly SelectRow[] => rows.filter((row) => row.disabled !== true);

/** The rows in keyboard order, skipping the disabled ones. */
export const selectNavigation = (
  rows: readonly SelectRow[],
): readonly SelectRow[] => selectEnabled(rows);
