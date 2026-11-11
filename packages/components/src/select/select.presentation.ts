import {
  type ApiOf,
  ariaFlag,
  ariaHidden,
  ariaInvalid,
  ariaLabelledBy,
  ariaRequired,
  type ComponentDef,
  defineComponent,
  disclosureTrigger,
  listSurface,
  optionRow,
  type ViewFor,
  type SlotViewFor,
} from "@spinjs/components/runtime";
import { dataAttr } from "./select.shared.ts";
import { select as selectMachine } from "./select.machine.ts";
import {
  type SelectArgs,
  type SelectContext,
  selectLabel,
  type SelectRow,
  type SelectState,
} from "./select.state.ts";
export type { SelectRow } from "./select.state.ts";
import type { SelectEvents } from "./select.events.ts";

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

type ScopeLike = ViewFor<SelectContext, SelectEvents, SelectState>;
type SlotLike<R> = SlotViewFor<R, SelectContext, SelectEvents, SelectState>;

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
  object,
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

const itemStateOf = (
  scope: SlotLike<SelectRow>,
  row: SelectRow,
): SelectItemState => ({
  selected: scope.context.value.includes(row.value),
  highlighted: scope.context.highlightedValue === row.value,
  disabled: row.disabled === true,
});

const onTriggerKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (isComposing(event) || event.defaultPrevented) return;
  if (scope.context.disabled === true || scope.context.readOnly === true) {
    return;
  }
  const dir = scope.context.dir;
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
  if (scope.context.disabled === true || scope.context.readOnly === true) {
    return;
  }
  const dir = scope.context.dir;
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

export const def = {
  name: "select",
  machine: (args: SelectArgs, authored: (name: string) => boolean) =>
    selectMachine(args, authored),
  start: (props, authored) => {
    if (authored("open")) return props["open"] === true ? "open" : "idle";
    return props["defaultOpen"] === true ? "open" : "idle";
  },
  settled: ({ before, after, focus }: {
    readonly before: { readonly state: string };
    readonly after: { readonly state: string };
    readonly focus: (part: string, slot?: unknown) => void;
  }) => {
    if (before.state === "open" && after.state === "focused") focus("trigger");
  },
  reconcile: (
    { context, parsed, send }: {
      readonly context: SelectContext;
      readonly parsed: Record<string, unknown>;
      readonly send: (
        event: { type: string } & Record<string, unknown>,
      ) => void;
    },
  ) => {
    const ctx = context;
    const nextItems = rowsOf(parsed);
    const itemsChanged = nextItems.length !== ctx.items.length ||
      nextItems.some((row, index) => {
        const current = ctx.items[index];
        return current === undefined || current.value !== row.value ||
          current.label !== row.label ||
          (current.disabled ?? false) !== (row.disabled ?? false);
      });
    let moved = itemsChanged;
    if (itemsChanged) {
      (ctx as { items: readonly SelectRow[] }).items = nextItems;
    }
    const order = orderOf(parsed);
    const orderChanged = !sameKeys(ctx.order, order);
    if (orderChanged) {
      ctx.order = order;
      ctx.labels = labelsOf(parsed);
      send({ type: "SELECTED_ITEMS.SYNC" });
    }
    return moved || orderChanged;
  },

  parts: {
    root: {
      attrs: (scope) => {
        const open = scope.state === "open";
        return {
          dir: scope.context.dir,
          "data-state": open ? "open" : "closed",
          "data-focus": scope.attr(scope.state !== "idle"),
          "data-readonly": scope.attr(scope.context.readOnly),
          "data-invalid": scope.attr(scope.context.invalid === true),
          "data-multiple": scope.attr(scope.context.multiple),
          "data-disabled": dataAttr(scope.context.disabled === true),
          "data-placeholder": dataAttr(scope.context.value.length === 0),
        };
      },
    },
    label: {
      attrs: (scope) => ({
        dir: scope.context.dir,
        for: scope.id("trigger"),
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.context.disabled === true),
      }),
    },
    control: {
      attrs: (scope) => ({
        dir: scope.context.dir,
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.context.disabled === true),
      }),
    },
    trigger: {
      attrs: (scope) => {
        const ctx = scope.context;
        const open = scope.state === "open";
        return {
          type: "button",
          dir: scope.context.dir,
          role: "combobox",
          ...disclosureTrigger(scope, {
            expanded: open,
            hasPopup: "listbox",
            controls: { part: "content" },
          }),
          ...ariaLabelledBy(scope, {
            parts: [{ part: "label" }, { part: "valueText" }],
          }),
          ...ariaRequired(ariaFlag(scope.context.required)),
          ...ariaInvalid(ariaFlag(scope.context.invalid)),
          disabled: scope.context.disabled || scope.context.readOnly,
          "data-state": open ? "open" : "closed",
          "data-focus": scope.attr(scope.state === "focused"),
          "data-focused": scope.attr(scope.state !== "idle"),
          "aria-controls": scope.id("content"),
          "aria-owns": scope.id("list"),
          "data-placeholder": dataAttr(ctx.value.length === 0),
          onFocus: (): void => scope.send({ type: "TRIGGER.FOCUS" }),
          onBlur: (): void => scope.send({ type: "TRIGGER.BLUR" }),
          onClick: (): void => scope.send({ type: "TRIGGER.CLICK" }),
          onKeyDown: (event: KeyboardEvent): void =>
            onTriggerKeydown(scope, event),
        };
      },
    },
    triggerIndicator: {
      attrs: (scope) => ({
        ...ariaHidden(true),
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.context.disabled === true),
      }),
    },
    clearTrigger: {
      attrs: (scope) => {
        const has = scope.context.value.length > 0;
        return {
          type: "button",
          tabIndex: -1,
          "aria-label": scope.context.clearTriggerLabel,
          disabled: scope.context.disabled,
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
        "data-placeholder": dataAttr(scope.context.value.length === 0),
      }),
    },
    positioner: {
      attrs: (scope) => {
        const open = scope.state === "open";
        return {
          dir: scope.context.dir,
          "data-state": open ? "open" : "closed",
          hidden: !open,
          "data-placement": scope.context.placement,
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
          dir: scope.context.dir,
          role: "listbox",
          ...listSurface(scope, {
            labelledBy: { part: "label" },
            activeDescendant: ctx.highlightedValue === null
              ? undefined
              : { part: "item", slot: ctx.highlightedValue },
            multiSelectable: ariaFlag(scope.context.multiple),
            required: ariaFlag(scope.context.required),
            readOnly: ariaFlag(scope.context.readOnly),
          }),
          "data-activedescendant": activedescendant,
          hidden: !open,
          tabIndex: 0,
          "data-state": open ? "open" : "closed",
          onKeyDown: (event: KeyboardEvent): void =>
            onContentKeydown(scope, event),
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
                target.closest("button, [href], input, select, textarea") !==
                  null;
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
        dir: scope.context.dir,
        role: "group",
        "data-state": scope.state === "open" ? "open" : "closed",
      }),
    },
    hiddenSelect: {
      id: "hidden",
      attrs: (scope) => ({
        ...ariaHidden(true),
        tabIndex: -1,
        name: scope.context.name || undefined,
        form: scope.context.form || undefined,
        disabled: scope.context.disabled,
        required: scope.context.required,
        multiple: scope.context.multiple === true,
        "data-state": "hidden",
        // The options cannot be templated inside a `<select>` (the parser
        // drops it), so the action builds them from the collection.
        "use:select-options": {
          rows: scope.context.items,
          value: [...scope.context.value],
          multiple: scope.context.multiple === true,
        },
        "use:form-control": {
          onDisabledChange: (): void => {
            // The fieldset's disabled state is reported to the host
            // through the element; the machine's `disabled` prop is
            // unaffected.
          },
        },
      }),
    },
  },
  slots: {
    item: {
      id: "item",
      indexes: (context) => context.items,
      attrs: (scope: SlotLike<SelectRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.value),
          role: "option",
          ...optionRow({ selected: state.selected }),
          "data-state": state.highlighted ? "highlighted" : "idle",
          "data-selected": dataAttr(state.selected),
          "data-highlighted": dataAttr(state.highlighted),
          "data-disabled": dataAttr(state.disabled),
          "aria-owns": scope.id("list"),
          ...rowHandlers(scope, row),
        };
      },
    },
    itemText: {
      indexes: (context) => context.items,
      attrs: (scope: SlotLike<SelectRow>) => {
        const state = itemStateOf(scope, scope.slot);
        const row = scope.slot;
        return {
          id: scope.id("itemText", row.value),
          "data-state": state.highlighted ? "highlighted" : "idle",
          "data-selected": dataAttr(state.selected),
        };
      },
    },
    itemIndicator: {
      indexes: (context) => context.items,
      attrs: (scope: SlotLike<SelectRow>) => {
        const selected = itemStateOf(scope, scope.slot).selected;
        return {
          ...ariaHidden(true),
          "data-selected": scope.attr(selected),
        };
      },
    },
  },
  commands: {
    syncSelectedItems: { event: () => ({ type: "SELECTED_ITEMS.SYNC" }) },
    selectValue: {
      event: ([value]: [value: string]) => ({
        type: "ITEM.SELECT" as const,
        value,
      }),
    },
    setValue: {
      event: ([value]: [value: readonly string[]]) => ({
        type: "VALUE.SET" as const,
        value: [...value],
      }),
    },
    clearValue: { event: () => ({ type: "VALUE.CLEAR" }) },
    setHighlightValue: {
      event: ([value]: [value: string | null]) => ({
        type: "HIGHLIGHTED_VALUE.SET" as const,
        highlightedValue: value,
      }),
    },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE.CLEAR" }) },
    setOpen: {
      event: ([open]: [open: boolean]) => ({
        type: open ? "OPEN" as const : "CLOSE" as const,
      }),
    },
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
      read: (context) => {
        const highlighted = context.highlightedValue;
        if (highlighted === null) return null;
        return context.items.find((row) => row.value === highlighted) ?? null;
      },
    },
    selectedItems: {
      read: (context) => {
        const rows = context.items;
        return context.value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is SelectRow => row !== undefined);
      },
    },
    multiple: { read: (context) => context.multiple },
    disabled: { read: (context) => context.disabled },
    empty: { read: (context) => context.items.length === 0 },
  },
  methods: {
    getRows: {
      call: (
        context: SelectContext,
      ): readonly SelectRow[] => [...context.items],
    },
    getSelectedRows: {
      call: (context): readonly SelectRow[] => {
        return context.value
          .map((value) => context.items.find((row) => row.value === value))
          .filter((row): row is SelectRow => row !== undefined);
      },
    },
    getItemState: {
      call: (
        context: SelectContext,
        _state,
        [row]: [row: SelectRow],
      ): SelectItemState => {
        return {
          selected: context.value.includes(row.value),
          highlighted: context.highlightedValue === row.value,
          disabled: row.disabled === true,
        };
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...context.value],
      detail: (watched: readonly string[], _event, _props, context) => {
        const rows = context === undefined
          ? []
          : (context as unknown as SelectContext).items;
        return {
          value: [...watched],
          items: watched.map((item) => rows.find((row) => row.value === item))
            .filter((row) => row !== undefined),
        };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [context.highlightedValue],
      detail: (watched: readonly [string | null], _event, _props, context) => {
        const highlighted = watched[0];
        const items = context === undefined
          ? []
          : (context as unknown as SelectContext).items;
        return {
          highlightedValue: highlighted,
          highlightedItem: highlighted === null
            ? null
            : items.find((row) => row.value === highlighted) ?? null,
        };
      },
    },
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state === "open"],
      detail: (watched: readonly [boolean], event) => ({
        open: watched[0],
        reason: (event !== undefined ? OPEN_REASON[event.type] : undefined) ??
          "script",
      }),
    },
    select: {
      prop: "onSelect",
      watch: (context) => [...context.value],
      detail: (watched: readonly string[]) => ({
        value: [...watched],
        itemValue: "",
      }),
      // The value the pick landed on. A toggle-off reports as much as a
      // pick — the host asked about the move, not the direction — but a
      // guard the machine refused reports nothing.
      select: (event, before: SelectContext, after: SelectContext) => {
        if (event.type !== "ITEM.SELECT" && event.type !== "ITEM.CLICK") {
          return null;
        }
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
          if (highlighted === null || !beforeCtx.order.includes(highlighted)) {
            return null;
          }
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
} satisfies ComponentDef<
  SelectContext,
  SelectEvents,
  Record<string, unknown>,
  SelectArgs,
  SelectState
>;

export type SelectApi = ApiOf<typeof def>;
export const select = defineComponent<
  SelectContext,
  SelectEvents,
  SelectApi,
  SelectArgs,
  SelectState
>(def);
