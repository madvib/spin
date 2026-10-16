import {
  defineComponent,
  textProp,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import { dataAttr } from "./select.shared.ts";
import {
  config,
  implementations,
  selectLabel,
  type SelectContext,
  type SelectEvent,
} from "./select.machine.ts";

/**
 * Select definition: the DOM contract as data. The machine owns idle /
 * focused / open, the selection, the highlight, and the inline completion;
 * this file maps props to channels, parts to attribute bags, commands to
 * sends, and value/highlight/open/select transitions to their events.
 * Navigation (arrows, Home, End, typeahead) sends events the machine walks
 * against its synced order — the machine walks data here, unlike the
 * combobox, because the closed trigger holds no rows of its own.
 * The collection parses once per prop identity: row objects are stable, so
 * the `for` bindings never re-stamp.
 */

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

export interface SelectValueChange {
  readonly value: string[];
  readonly items: readonly SelectRow[];
}

export interface SelectHighlightChange {
  readonly highlightedValue: string | null;
  readonly highlightedItem: SelectRow | null;
}

export interface SelectOpenChange {
  readonly open: boolean;
  readonly reason: string;
}

export interface SelectSelect {
  readonly value: string[];
  readonly itemValue: string;
}

export interface SelectApi {
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
  syncSelectedItems(): void;
  selectValue(value: string): void;
  setValue(value: readonly string[]): void;
  clearValue(): void;
  setHighlightValue(value: string): void;
  clearHighlightValue(): void;
  setOpen(open: boolean): void;
  close(): void;
  toggle(): void;
  focus(): void;
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

/** Keys travel the prop channel comma-joined: the grammar types a set
 * either as `string[]` (whose default coercion produces `["[]"]` for
 * `= []`) or as JSON, neither of which survives a framework's string
 * attribute. */
const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    // The lone `"[]"` is the grammar's `= []` coercion artifact, not a key.
    if (raw.length === 1 && raw[0] === "[]") return [];
    return raw.filter((value): value is string => typeof value === "string");
  }
  if (typeof raw !== "string") return [];
  // Bracketed-unquoted scope defaults (`[a, b]`) split like a bare list.
  const list = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  return list.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
};

/** The scope grammar's object-array type carries the fields the host
 * typed; anything else arriving on the prop channel is treated as no
 * items. */
const parseItems = (raw: unknown): readonly SelectRow[] => {
  if (!Array.isArray(raw)) return [];
  const rows: SelectRow[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const value: unknown = (item as Record<string, unknown>)["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    const label: unknown = (item as Record<string, unknown>)["label"];
    rows.push({
      value,
      label: typeof label === "string" && label.length > 0 ? label : value,
      disabled: (item as Record<string, unknown>)["disabled"] === true,
    });
  }
  return rows;
};

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** A non-empty text prop, or null — the shape `highlightedValue` travels in. */
const nullableProp = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

/** Why the panel opened or closed. The prop channel carries no `src`, so
 * the event that produced the move names the reason. */
const OPEN_REASON: Record<string, string> = {
  "TRIGGER.CLICK": "trigger-click",
  "TRIGGER.ENTER": "trigger-enter",
  "TRIGGER.ARROW_DOWN": "arrow-key",
  "TRIGGER.ARROW_UP": "arrow-key",
  OPEN: "script",
  CLOSE: "script",
  "ITEM.CLICK": "item-select",
  "LAYER.ESCAPE": "escape-key",
  "LAYER.INTERACT_OUTSIDE": "interact-outside",
};

type Ctx = SelectContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const rowsOf = (parsed: Record<string, unknown>): readonly SelectRow[] =>
  parsed["items"] as readonly SelectRow[];

const orderOf = (parsed: Record<string, unknown>): string[] =>
  rowsOf(parsed).map((row) => row.value);

const labelsOf = (parsed: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(rowsOf(parsed).map((row) => [row.value, row.label]));

/** Zag's `getEventKey`: the only thing `dir` changes is the arrow mapping. */
const resolveKey = (event: KeyboardEvent, dir: string): string => {
  if (dir !== "rtl") return event.key;
  if (event.key === "ArrowLeft") return "ArrowRight";
  if (event.key === "ArrowRight") return "ArrowLeft";
  return event.key;
};

const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing === true || event.keyCode === 229;

/** Row handlers, built once per row per bridge: the scope reads live
 * through proxies, so a cached closure never goes stale. */
type RowHandlerSet = {
  readonly onPointerMove: () => void;
  readonly onPointerLeave: () => void;
  readonly onClick: () => void;
};
const rowHandlersByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  WeakMap<SelectRow, RowHandlerSet>
>();
const rowHandlers = (scope: ScopeLike, row: SelectRow): RowHandlerSet => {
  let byRow = rowHandlersByBridge.get(scope.send);
  if (byRow === undefined) {
    byRow = new WeakMap();
    rowHandlersByBridge.set(scope.send, byRow);
  }
  const hit = byRow.get(row);
  if (hit !== undefined) return hit;
  const made: RowHandlerSet = {
    onPointerMove: (): void => {
      if (row.disabled === true) return;
      scope.send({ type: "ITEM.POINTER_MOVE", value: row.value });
    },
    onPointerLeave: (): void => {
      scope.send({ type: "ITEM.POINTER_LEAVE" });
    },
    onClick: (): void => {
      if (row.disabled === true) return;
      scope.send({ type: "ITEM.CLICK", value: row.value });
    },
  };
  byRow.set(row, made);
  return made;
};

const itemStateOf = (scope: ScopeLike, row: SelectRow): SelectItemState => ({
  selected: asCtx(scope.context).value.includes(row.value),
  highlighted: asCtx(scope.context).highlightedValue === row.value,
  disabled: row.disabled === true,
});

const onTriggerKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (isComposing(event) || event.defaultPrevented) return;
  if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
  const key = resolveKey(event, scope.props["dir"] as string);
  const open = scope.state === "open";
  switch (key) {
    case "ArrowDown":
      event.preventDefault();
      scope.send({ type: "TRIGGER.ARROW_DOWN" });
      break;
    case "ArrowUp":
      event.preventDefault();
      scope.send({ type: "TRIGGER.ARROW_UP" });
      break;
    case "ArrowLeft":
      if (open) return;
      event.preventDefault();
      scope.send({ type: "TRIGGER.ARROW_LEFT" });
      break;
    case "ArrowRight":
      if (open) return;
      event.preventDefault();
      scope.send({ type: "TRIGGER.ARROW_RIGHT" });
      break;
    case "Home":
      if (open) return;
      event.preventDefault();
      scope.send({ type: "TRIGGER.HOME" });
      break;
    case "End":
      if (open) return;
      event.preventDefault();
      scope.send({ type: "TRIGGER.END" });
      break;
    case "Enter":
      event.preventDefault();
      scope.send({ type: "TRIGGER.ENTER" });
      break;
    default:
      if (key.length === 1 && /\S/.test(key)) {
        scope.send({ type: "TRIGGER.TYPEAHEAD", value: key });
      }
  }
};

const onContentKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (isComposing(event) || event.defaultPrevented) return;
  if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
  const key = resolveKey(event, scope.props["dir"] as string);
  switch (key) {
    case "ArrowDown":
      event.preventDefault();
      scope.send({ type: "CONTENT.ARROW_DOWN" });
      break;
    case "ArrowUp":
      event.preventDefault();
      scope.send({ type: "CONTENT.ARROW_UP" });
      break;
    case "Home":
      event.preventDefault();
      scope.send({ type: "CONTENT.HOME" });
      break;
    case "End":
      event.preventDefault();
      scope.send({ type: "CONTENT.END" });
      break;
    case "Enter": {
      event.preventDefault();
      // The content's Enter picks the highlight, exactly as the click
      // does: the event carries the row so the click path and the key
      // path agree.
      const picked = asCtx(scope.context).highlightedValue;
      if (picked !== null) {
        scope.send({ type: "ITEM.CLICK", value: picked });
      }
      break;
    }
    default:
      if (key.length === 1 && /\S/.test(key)) {
        scope.send({ type: "CONTENT.TYPEAHEAD", value: key });
      }
  }
};

const def: ComponentDef<SelectContext, SelectEvent> = {
  name: "select",
  config,
  implementations,
  start: (props, authored) => {
    if (authored("open")) return (props["open"] as boolean) === true ? "open" : "idle";
    return (props["defaultOpen"] as boolean) === true ? "open" : "idle";
  },
  seed: (props, authored) => {
    const multiple = props["multiple"] === true;
    const selection = props["selectionBehavior"];
    return {
      multiple,
      closeOnSelect: authored("closeOnSelect")
        ? props["closeOnSelect"] === true
        : !multiple,
      loopFocus: props["loopFocus"] === true,
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
    open: {
      controlled: true,
      parse: (raw) => raw === true,
      event: (value: boolean) => ({ type: value ? "CONTROLLED.OPEN" : "CONTROLLED.CLOSE" }),
      current: (_context, state) => state === "open",
    },
    defaultOpen: { parse: (raw) => raw === true },
    multiple: { parse: (raw) => raw === true },
    closeOnSelect: { parse: (raw) => raw },
    loopFocus: { parse: (raw) => raw === true },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    name: { parse: textProp },
    form: { parse: textProp },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    placement: {
      parse: (raw) => {
        const placement = textProp(raw);
        return placement.length > 0 ? placement : "bottom-start";
      },
    },
    label: {
      parse: (raw) => {
        const label = textProp(raw);
        return label.length > 0 ? label : "Select";
      },
    },
    placeholder: {
      parse: (raw) => {
        const placeholder = textProp(raw);
        return placeholder.length > 0 ? placeholder : "Select an option";
      },
    },
    clearTriggerLabel: {
      parse: (raw) => {
        const label = textProp(raw);
        return label.length > 0 ? label : "Clear value";
      },
    },
  },
  scalarsOf: (parsed, authored) => {
    const multiple = parsed["multiple"] === true;
    return {
      multiple,
      // Zag's `closeOnSelect: !props.multiple` — a coerced default is not
      // a write, so an explicit `closeOnSelect` is the only thing that
      // overrides the mode's own answer.
      closeOnSelect: authored("closeOnSelect") ? parsed["closeOnSelect"] === true : !multiple,
      loopFocus: parsed["loopFocus"] === true,
    };
  },
  reconcile: ({ context, parsed, send }) => {
    const ctx = asCtx(context);
    const order = orderOf(parsed);
    if (sameKeys(ctx.order, order)) return false;
    ctx.order = order;
    ctx.labels = labelsOf(parsed);
    // Zag's `watch` on the collection: a stranded selection or highlight
    // is dropped by the machine's own sync event.
    send({ type: "SELECTED_ITEMS.SYNC" });
    return true;
  },
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.props["disabled"]].join(" "),
      attrs: (scope) => {
        const open = scope.state === "open";
        return {
          id: scope.id(""),
          dir: scope.props["dir"],
          "data-state": open ? "open" : "closed",
          "data-focused": scope.attr(scope.state !== "idle"),
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          "data-invalid": dataAttr(scope.props["invalid"] === true),
          "data-multiple": dataAttr(scope.props["multiple"] === true),
          "data-placeholder": dataAttr(asCtx(scope.context).value.length === 0),
        };
      },
    },
    label: {
      sig: (scope) => [scope.state, scope.props["disabled"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        for: scope.id("trigger"),
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    control: {
      sig: (scope) => [scope.state, scope.props["disabled"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("control"),
        dir: scope.props["dir"],
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    trigger: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [scope.state, ctx.value.length, scope.props["disabled"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const open = scope.state === "open";
        return {
          id: scope.id("trigger"),
          type: "button",
          dir: scope.props["dir"],
          role: "combobox",
          "aria-haspopup": "listbox",
          "aria-expanded": open,
          "aria-controls": scope.id("content"),
          "aria-labelledby": `${scope.id("label")} ${scope.id("valueText")}`,
          "aria-required": scope.props["required"] || undefined,
          "aria-invalid": scope.props["invalid"] || undefined,
          disabled: scope.props["disabled"] || scope.props["readOnly"],
          "data-state": open ? "open" : "closed",
          "data-focused": scope.attr(scope.state !== "idle"),
          "data-placeholder": dataAttr(ctx.value.length === 0),
          "data-controls": scope.id("content"),
          "data-ownedby": scope.id("list"),
          onFocus: (): void => scope.send({ type: "TRIGGER.FOCUS" }),
          onBlur: (): void => scope.send({ type: "TRIGGER.BLUR" }),
          onClick: (): void => scope.send({ type: "TRIGGER.CLICK" }),
          onKeyDown: (event: KeyboardEvent): void => onTriggerKeydown(scope, event),
        };
      },
    },
    triggerIndicator: {
      sig: (scope) => [scope.state, scope.props["disabled"]].join(" "),
      attrs: (scope) => ({
        "aria-hidden": true,
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    clearTrigger: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [`${ctx.value.length > 0}`, scope.props["clearTriggerLabel"], scope.props["disabled"]].join(" ");
      },
      attrs: (scope) => {
        const has = asCtx(scope.context).value.length > 0;
        return {
          id: scope.id("clearTrigger"),
          type: "button",
          tabIndex: -1,
          "aria-label": scope.props["clearTriggerLabel"],
          disabled: scope.props["disabled"],
          "data-state": has ? "visible" : "hidden",
          onClick: (event: MouseEvent): void => {
            event.stopPropagation();
            scope.send({ type: "CLEAR.CLICK" });
          },
        };
      },
    },
    valueText: {
      id: "value-text",
      sig: (scope) => [selectLabel(asCtx(scope.context))].join(" "),
      attrs: (scope) => ({
        id: scope.id("valueText"),
        "data-placeholder": dataAttr(asCtx(scope.context).value.length === 0),
      }),
    },
    positioner: {
      sig: (scope) => [scope.state, scope.props["placement"]].join(" "),
      attrs: (scope) => {
        const open = scope.state === "open";
        return {
          id: scope.id("positioner"),
          dir: scope.props["dir"],
          "data-state": open ? "open" : "closed",
          hidden: !open,
          "data-placement": scope.props["placement"],
        };
      },
    },
    content: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [scope.state, scope.props["disabled"], ctx.highlightedValue, rowsOf(scope.props).length].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const open = scope.state === "open";
        // The activedescendant is the highlighted row's id, or nothing
        // when the highlight is empty: an id of `null` is not an id.
        const activedescendant = ctx.highlightedValue === null
          ? undefined
          : scope.id("item", ctx.highlightedValue as unknown as number);
        return {
          id: scope.id("content"),
          dir: scope.props["dir"],
          role: "listbox",
          "aria-labelledby": scope.id("label"),
          "aria-activedescendant": activedescendant,
          "data-activedescendant": activedescendant,
          "aria-multiselectable": scope.props["multiple"] || undefined,
          "aria-required": scope.props["required"] || undefined,
          "aria-readonly": scope.props["readOnly"] || undefined,
          hidden: !open,
          tabIndex: 0,
          "data-state": open ? "open" : "closed",
          onKeyDown: (event: KeyboardEvent): void => onContentKeydown(scope, event),
          // The reflexes, as actions: the outside press and Escape
          // dismiss, the highlighted row stays scrolled into view. The
          // trigger is this component's own gesture, so a press on it
          // toggles, not dismisses.
          "use:dismissable": {
            onOutside: (event: PointerEvent): void => {
              const target = event.target;
              // The id carries colons, which are not valid in an id
              // selector, and `closest` throws on an invalid one.
              if (
                target instanceof Element &&
                target.closest(`[id="${scope.id("trigger")}"]`) !== null
              ) return;
              const focusable = target instanceof Element &&
                target.closest("button, [href], input, select, textarea") !== null;
              scope.send({
                type: "LAYER.INTERACT_OUTSIDE",
                restoreFocus: !(focusable || event.button === 2),
              });
            },
            onEscape: (): void => scope.send({ type: "LAYER.ESCAPE" }),
          },
          // Opening hands the panel focus: the trigger's keys stop
          // applying once the panel is up, so the keyboard walk starts
          // inside.
          "use:select-focus": { open },
          "use:scroll-into-view": {
            activeId: (): string => {
              const highlighted = asCtx(scope.context).highlightedValue;
              return highlighted === null ? "" : scope.id("item", highlighted);
            },
          },
        };
      },
    },
    list: {
      sig: (scope) => [scope.state, scope.props["dir"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("list"),
        dir: scope.props["dir"],
        role: "group",
        "data-state": scope.state === "open" ? "open" : "closed",
      }),
    },
    hiddenSelect: {
      id: "hidden",
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [ctx.value.join(","), rowsOf(scope.props).map((row) => row.value).join(","), scope.props["multiple"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        return {
          id: scope.id("hiddenSelect"),
          "aria-hidden": true,
          tabIndex: -1,
          name: scope.props["name"] || undefined,
          form: scope.props["form"] || undefined,
          disabled: scope.props["disabled"],
          required: scope.props["required"],
          multiple: scope.props["multiple"],
          "data-state": "hidden",
          // The options cannot be templated inside a `<select>` (the
          // parser drops it), so the action builds them from the
          // collection, and the form's reset reads them back through
          // form-control. The entry is a thunk because a plain object is
          // evaluated once at attach and the action would never see a
          // later selection.
          "use:select-options": () => ({
            rows: rowsOf(scope.props),
            value: [...ctx.value],
            multiple: scope.props["multiple"],
          }),
          "use:form-control": {
            onDisabledChange: (): void => {
              // The fieldset's disabled state is reported to the host
              // through the element; the machine's own `disabled` prop is
              // unaffected.
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
        const state = itemStateOf(scope, scope.slot as unknown as SelectRow);
        return [state.selected, state.highlighted, state.disabled].join(" ");
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as SelectRow;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.value),
          role: "option",
          "aria-selected": state.selected,
          "data-state": state.highlighted ? "highlighted" : "idle",
          "data-selected": dataAttr(state.selected),
          "data-highlighted": dataAttr(state.highlighted),
          "data-disabled": dataAttr(state.disabled),
          "data-ownedby": scope.id("list"),
          ...rowHandlers(scope, row),
        };
      },
    },
    itemText: {
      indexes: (_context, props) => rowsOf(props),
      sig: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as SelectRow);
        return [state.selected, state.highlighted].join(" ");
      },
      attrs: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as SelectRow);
        const row = scope.slot as unknown as SelectRow;
        return {
          id: scope.id("itemText", row.value),
          "data-state": state.highlighted ? "highlighted" : "idle",
          "data-selected": dataAttr(state.selected),
        };
      },
    },
    itemIndicator: {
      indexes: (_context, props) => rowsOf(props),
      sig: (scope) => `${itemStateOf(scope, scope.slot as unknown as SelectRow).selected}`,
      attrs: (scope) => {
        const selected = itemStateOf(scope, scope.slot as unknown as SelectRow).selected;
        return {
          "aria-hidden": true,
          "data-state": selected ? "checked" : "unchecked",
        };
      },
    },
  },
  commands: {
    syncSelectedItems: { event: () => ({ type: "SELECTED_ITEMS.SYNC" }) },
    selectValue: { event: (args) => ({ type: "ITEM.SELECT", value: args[0] as string }) },
    setValue: { event: (args) => ({ type: "VALUE.SET", value: [...(args[0] as readonly string[])] }) },
    clearValue: { event: () => ({ type: "VALUE.CLEAR" }) },
    setHighlightValue: { event: (args) => ({ type: "HIGHLIGHTED_VALUE.SET", value: args[0] as string }) },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE.CLEAR" }) },
    setOpen: { event: (args) => ({ type: (args[0] as boolean) ? "OPEN" : "CLOSE" }) },
    close: { event: () => ({ type: "CLOSE" }) },
    toggle: { event: () => ({ type: "TOGGLE" }) },
    focus: { event: () => ({ type: "TRIGGER.FOCUS" }) },
  },
  readers: {
    open: { read: (_context, state) => state === "open" },
    focused: { read: (_context, state) => state !== "idle" },
    value: { read: (context) => [...asCtx(context).value] },
    valueAsString: { read: (context) => selectLabel(asCtx(context)) },
    hasSelectedItems: { read: (context) => asCtx(context).value.length > 0 },
    highlightedValue: { read: (context) => asCtx(context).highlightedValue },
    highlightedItem: {
      read: (context, _state, props) => {
        const highlighted = asCtx(context).highlightedValue;
        if (highlighted === null) return null;
        return rowsOf(props).find((row) => row.value === highlighted) ?? null;
      },
    },
    selectedItems: {
      read: (context, _state, props) => {
        const rows = rowsOf(props);
        return asCtx(context).value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is SelectRow => row !== undefined);
      },
    },
    multiple: { read: (_context, _state, props) => (props["multiple"] as boolean) === true },
    disabled: { read: (_context, _state, props) => (props["disabled"] as boolean) === true },
    empty: { read: (_context, _state, props) => rowsOf(props).length === 0 },
  },
  methods: {
    getRows: {
      call: (_context, _state, _args, props) => rowsOf(props),
    },
    getSelectedRows: {
      call: (context, _state, _args, props) => {
        const rows = rowsOf(props);
        return asCtx(context).value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is SelectRow => row !== undefined);
      },
    },
    getItemState: {
      call: (context, _state, args, props) => {
        const row = args[0] as SelectRow;
        void props;
        return {
          selected: (context as unknown as Ctx).value.includes(row.value),
          highlighted: (context as unknown as Ctx).highlightedValue === row.value,
          disabled: row.disabled === true,
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
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state === "open"],
      detail: (watched, event) => ({
        open: watched[0] as boolean,
        reason: (event !== undefined ? OPEN_REASON[event.type] : undefined) ?? "script",
      }),
    },
    select: {
      prop: "onSelect",
      watch: (context) => [...asCtx(context).value],
      detail: (watched) => ({ value: [...watched] as string[], itemValue: "" }),
      // The value the pick landed on. A toggle-off reports as much as a
      // pick — the host asked about the move, not the direction — but a
      // guard the machine refused reports nothing.
      select: (event, before, after) => {
        if (event.type !== "ITEM.SELECT" && event.type !== "ITEM.CLICK") return null;
        const beforeCtx = before as unknown as Ctx;
        const afterCtx = after as unknown as Ctx;
        let outcome: readonly string[] | null = null;
        let itemValue: string;
        if (event.type === "ITEM.SELECT") {
          itemValue = (event as Record<string, string>)["value"] as string;
          outcome = beforeCtx.multiple
            ? beforeCtx.value.includes(itemValue)
              ? beforeCtx.value.filter((value) => value !== itemValue)
              : [...beforeCtx.value, itemValue]
            : [itemValue];
        } else {
          const highlighted = beforeCtx.highlightedValue;
          if (highlighted === null || !beforeCtx.order.includes(highlighted)) return null;
          itemValue = highlighted;
          outcome = beforeCtx.multiple
            ? beforeCtx.value.includes(highlighted)
              ? beforeCtx.value.filter((value) => value !== highlighted)
              : [...beforeCtx.value, highlighted]
            : [highlighted];
        }
        if (outcome === null || !sameKeys(outcome, afterCtx.value)) return null;
        return { value: [...outcome], itemValue };
      },
    },
  },
};

export const select = defineComponent<SelectContext, SelectEvent, SelectApi>(def);
