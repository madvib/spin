import {
  defineComponent,
  textProp,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import { dataAttr } from "./select.shared.ts";
import {
  select as selectMachine,
  selectLabel,
  type SelectArgs,
  type SelectContext,
  type SelectEvent,
  type SelectRow,
} from "./select.machine.ts";

/** Select definition: the DOM contract as data. */

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
  getRows(): readonly SelectRow[];
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

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Why the panel opened or closed: the prop channel carries no `src`, so
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
type ScopeLike = PartScope<unknown, SelectContext>;

interface SlotLike<R> extends SlotScope<R, SelectContext> {}

const rowsOf = (parsed: Record<string, unknown>): readonly SelectRow[] => {
  const raw = parsed["items"];
  const arr = Array.isArray(raw) ? raw : [];
  const rows: SelectRow[] = [];
  for (const entry of arr) {
    if (typeof entry !== "object" || entry === null) continue;
    const record: Record<string, unknown> = entry;
    const value = record["value"];
    if (typeof value !== "string" || value.length === 0) continue;
    rows.push({
      value,
      label: typeof record["label"] === "string" ? record["label"] : value,
      disabled: record["disabled"] === true,
    });
  }
  return rows;
};

const orderOf = (parsed: Record<string, unknown>): string[] =>
  rowsOf(parsed).map((row) => row.value);

const labelsOf = (parsed: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(rowsOf(parsed).map((row) => [row.value, row.label]));

/** The only thing `dir` changes is the arrow mapping. */
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

const itemStateOf = (scope: SlotLike<SelectRow>, row: SelectRow): SelectItemState => ({
  selected: scope.context.value.includes(row.value),
  highlighted: scope.context.highlightedValue === row.value,
  disabled: row.disabled === true,
});

const onTriggerKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (isComposing(event) || event.defaultPrevented) return;
  if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
  const dir = scope.props["dir"];
  const key = resolveKey(event, typeof dir === "string" ? dir : "ltr");
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
  const dir = scope.props["dir"];
  const key = resolveKey(event, typeof dir === "string" ? dir : "ltr");
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
      // does: the event carries the row.
      const picked = scope.context.highlightedValue;
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
  machine: (props, authored) => selectMachine(props as SelectArgs, authored),
  start: (props, authored) => {
    if (authored("open")) return props["open"] === true ? "open" : "idle";
    return props["defaultOpen"] === true ? "open" : "idle";
  },
  reconcile: ({ context, parsed, send }) => {
    const ctx = context;
    const order = orderOf(parsed);
    const orderChanged = !sameKeys(ctx.order, order);
    if (orderChanged) {
      ctx.order = order;
      ctx.labels = labelsOf(parsed);
      send({ type: "SELECTED_ITEMS.SYNC" });
    }
    return orderChanged;
  },

  parts: {
    root: {
      attrs: (scope) => {
        const open = scope.state === "open";
        return {
          id: scope.id(""),
          dir: scope.props["dir"],
          "data-scope": "select",
          "data-part": "root",
          "data-state": open ? "open" : "closed",
          "data-focused": scope.attr(scope.state !== "idle"),
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          "data-invalid": dataAttr(scope.props["invalid"] === true),
          "data-multiple": dataAttr(scope.props["multiple"] === true),
          "data-placeholder": dataAttr(scope.context.value.length === 0),
        };
      },
    },
    label: {
      attrs: (scope) => ({
        id: scope.id("label"),
          "data-scope": "select",
          "data-part": "label",
        dir: scope.props["dir"],
        for: scope.id("trigger"),
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    control: {
      attrs: (scope) => ({
        id: scope.id("control"),
          "data-scope": "select",
          "data-part": "control",
        dir: scope.props["dir"],
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    trigger: {
      attrs: (scope) => {
        const ctx = scope.context;
        const open = scope.state === "open";
        return {
          id: scope.id("trigger"),
          "data-scope": "select",
          "data-part": "trigger",
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
      attrs: (scope) => ({
        "aria-hidden": true,
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    clearTrigger: {
      attrs: (scope) => {
        const has = scope.context.value.length > 0;
        return {
          id: scope.id("clearTrigger"),
          "data-scope": "select",
          "data-part": "clear-trigger",
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
      attrs: (scope) => ({
        id: scope.id("valueText"),
          "data-scope": "select",
          "data-part": "value-text",
        "data-placeholder": dataAttr(scope.context.value.length === 0),
      }),
    },
    positioner: {
      attrs: (scope) => {
        const open = scope.state === "open";
        return {
          id: scope.id("positioner"),
          "data-scope": "select",
          "data-part": "positioner",
          dir: scope.props["dir"],
          "data-state": open ? "open" : "closed",
          hidden: !open,
          "data-placement": scope.props["placement"],
        };
      },
    },
    content: {
      attrs: (scope) => {
        const ctx = scope.context;
        const open = scope.state === "open";
        // The activedescendant is the highlighted row's id, or nothing when
        // the highlight is empty.
        const activedescendant = ctx.highlightedValue === null
          ? undefined
          : scope.id("item", ctx.highlightedValue);
        return {
          id: scope.id("content"),
          "data-scope": "select",
          "data-part": "content",
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
          // dismiss, the highlighted row stays scrolled into view. A press
          // on the trigger is this component's own gesture, so it toggles,
          // not dismisses.
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
              const highlighted = scope.context.highlightedValue;
              return highlighted === null ? "" : scope.id("item", highlighted);
            },
          },
        };
      },
    },
    list: {
      attrs: (scope) => ({
        id: scope.id("list"),
          "data-scope": "select",
          "data-part": "list",
        dir: scope.props["dir"],
        role: "group",
        "data-state": scope.state === "open" ? "open" : "closed",
      }),
    },
    hiddenSelect: {
      id: "hidden",
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id("hiddenSelect"),
          "data-scope": "select",
          "data-part": "hidden-select",
          "aria-hidden": true,
          tabIndex: -1,
          name: scope.props["name"] || undefined,
          form: scope.props["form"] || undefined,
          disabled: scope.props["disabled"],
          required: scope.props["required"],
          multiple: scope.props["multiple"] === true,
          "data-state": "hidden",
          // The options cannot be templated inside a `<select>` (the parser
          // drops it), so the action builds them from the collection. The
          // entry is a thunk because a plain object is evaluated once at
          // attach and the action would never see a later selection.
          "use:select-options": () => ({
            rows: rowsOf(scope.props),
            value: [...ctx.value],
            multiple: scope.props["multiple"] === true,
          }),
          "use:form-control": {
            onDisabledChange: (): void => {
              // The fieldset's disabled state is reported to the host
              // through the element; the machine's `disabled` prop is
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
      attrs: (scope: SlotLike<SelectRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.value),
          "data-scope": "select",
          "data-part": "item",
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
      attrs: (scope: SlotLike<SelectRow>) => {
        const state = itemStateOf(scope, scope.slot);
        const row = scope.slot;
        return {
          id: scope.id("itemText", row.value),
          "data-scope": "select",
          "data-part": "item-text",
          "data-state": state.highlighted ? "highlighted" : "idle",
          "data-selected": dataAttr(state.selected),
        };
      },
    },
    itemIndicator: {
      indexes: (_context, props) => rowsOf(props),
      attrs: (scope: SlotLike<SelectRow>) => {
        const selected = itemStateOf(scope, scope.slot).selected;
        return {
          "aria-hidden": true,
          "data-state": selected ? "checked" : "unchecked",
        };
      },
    },
  },
  commands: {
    syncSelectedItems: { event: () => ({ type: "SELECTED_ITEMS.SYNC" }) },
    selectValue: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "ITEM.SELECT", value: typeof v === "string" ? v : "" }; } },
    setValue: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "VALUE.SET", value: Array.isArray(v) && v.every((x): x is string => typeof x === "string") ? [...v] : [] }; } },
    clearValue: { event: () => ({ type: "VALUE.CLEAR" }) },
    setHighlightValue: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "HIGHLIGHTED_VALUE.SET", highlightedValue: typeof v === "string" ? v : null }; } },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE.CLEAR" }) },
    setOpen: { event: (args: readonly unknown[]) => ({ type: args[0] === true ? "OPEN" : "CLOSE" }) },
    close: { event: () => ({ type: "CLOSE" }) },
    toggle: { event: () => ({ type: "TOGGLE" }) },
    focus: { event: () => ({ type: "TRIGGER.FOCUS" }) },
  },
  readers: {
    open: { read: (_context, state) => state === "open" },
    focused: { read: (_context, state) => state !== "idle" },
    value: { read: (context) => [...context.value] },
    valueAsString: { read: (context) => selectLabel(context) },
    hasSelectedItems: { read: (context) => context.value.length > 0 },
    highlightedValue: { read: (context) => context.highlightedValue },
    highlightedItem: {
      read: (context, _state, props) => {
        const highlighted = context.highlightedValue;
        if (highlighted === null) return null;
        return rowsOf(props).find((row) => row.value === highlighted) ?? null;
      },
    },
    selectedItems: {
      read: (context, _state, props) => {
        const rows = rowsOf(props);
        return context.value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is SelectRow => row !== undefined);
      },
    },
    multiple: { read: (_context, _state, props) => props["multiple"] === true },
    disabled: { read: (_context, _state, props) => props["disabled"] === true },
    empty: { read: (_context, _state, props) => rowsOf(props).length === 0 },
  },
  methods: {
    getRows: {
      call: (_context, _state, _args, props) => rowsOf(props),
    },
    getSelectedRows: {
      call: (context, _state, _args, props) => {
        const rows = rowsOf(props);
        return context.value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is SelectRow => row !== undefined);
      },
    },
    getItemState: {
      call: (context: SelectContext, _state, args) => {
        const row = args[0];
        if (typeof row !== "object" || row === null || !("value" in row) || typeof row.value !== "string") return { selected: false, highlighted: false, disabled: true };
        return {
          selected: context.value.includes(row.value),
          highlighted: context.highlightedValue === row.value,
          disabled: "disabled" in row && typeof row.disabled === "boolean" ? row.disabled : false,
        };
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...context.value],
      detail: (watched: readonly string[], _event, props) => {
        const rows = props === undefined ? [] : rowsOf(props);
        return {
          value: [...watched],
          items: watched.map((item) => rows.find((row) => row.value === item)).filter((row) => row !== undefined),
        };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [context.highlightedValue],
      detail: (watched: readonly [string | null], _event, props) => {
        const highlighted = watched[0];
        return {
          highlightedValue: highlighted,
          highlightedItem: highlighted === null
            ? null
            : rowsOf(props ?? {}).find((row) => row.value === highlighted) ?? null,
        };
      },
    },
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state === "open"],
      detail: (watched: readonly [boolean], event) => ({
        open: watched[0],
        reason: (event !== undefined ? OPEN_REASON[event.type] : undefined) ?? "script",
      }),
    },
    select: {
      prop: "onSelect",
      watch: (context) => [...context.value],
      detail: (watched: readonly string[]) => ({ value: [...watched], itemValue: "" }),
      // The value the pick landed on. A toggle-off reports as much as a
      // pick — the host asked about the move, not the direction — but a
      // guard the machine refused reports nothing.
      select: (event, before: SelectContext, after: SelectContext) => {
        if (event.type !== "ITEM.SELECT" && event.type !== "ITEM.CLICK") return null;
        const beforeCtx = before;
        const afterCtx = after;
        let outcome: readonly string[] | null = null;
        let itemValue: string;
        if (event.type === "ITEM.SELECT") {
          const v = event["value"];
          if (typeof v !== "string") return null;
          itemValue = v;
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
export type { SelectRow } from "./select.machine.ts";
