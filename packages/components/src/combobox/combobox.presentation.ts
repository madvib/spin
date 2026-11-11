import {
  type ApiOf,
  ariaControls,
  ariaHidden,
  ariaInvalid,
  ariaLabelledBy,
  ariaState,
  comboboxInput,
  type ComponentDef,
  defineComponent,
  disclosureTrigger,
  isComposing,
  listSurface,
  optionRow,
  type ViewFor,
  type SlotViewFor,
} from "@spinjs/components/runtime";
import {
  combobox as comboboxMachine,
  isOpenPhase,
} from "./combobox.machine.ts";
import {
  type ComboboxArgs,
  type ComboboxContext,
  type ComboboxRow,
  type ComboboxState,
  pickOutcome,
} from "./combobox.state.ts";
import type { ComboboxEvents } from "./combobox.events.ts";
/**
 * Combobox definition: the DOM contract as data. The collection parses
 * once per prop identity: row objects are stable, so the `for` bindings
 * never re-stamp.
 */

export interface ComboboxItem {
  readonly value: string;
  readonly label?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly group?: string | undefined;
  readonly meta?: Readonly<Record<string, string>> | undefined;
}

export interface ComboboxBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly ComboboxRow[];
}

export type { ComboboxArgs, ComboboxRow } from "./combobox.state.ts";

/** Zag's `getItemState`, verbatim in shape: what one option is worth. */
export interface ComboboxItemState {
  readonly value: string;
  readonly disabled: boolean;
  readonly highlighted: boolean;
  readonly selected: boolean;
}

export interface ComboboxValueChange {
  readonly value: string[];
  readonly items: readonly ComboboxRow[];
}

export interface ComboboxHighlightChange {
  readonly highlightedValue: string | null;
  readonly highlightedItem: ComboboxRow | null;
}

export interface ComboboxInputValueChange {
  readonly inputValue: string;
  readonly reason: string;
}

export interface ComboboxOpenChange {
  readonly open: boolean;
  readonly reason: string;
  readonly value: string[];
}

export interface ComboboxSelect {
  readonly value: string[];
  readonly itemValue: string;
}

const toRow = (item: ComboboxItem): ComboboxRow | undefined => {
  if (typeof item.value !== "string" || item.value.length === 0) {
    return undefined;
  }
  const meta =
    typeof item.meta === "object" && item.meta !== null && !Array.isArray(item.meta)
      ? { ...item.meta }
      : undefined;
  return {
    value: item.value,
    label: typeof item.label === "string" && item.label.length > 0
      ? item.label
      : item.value,
    disabled: item.disabled === true,
    group: typeof item.group === "string" ? item.group : "",
    index: 0,
    meta,
  };
};

const toRows = (items: readonly ComboboxItem[]): readonly ComboboxRow[] => {
  const rows: ComboboxRow[] = [];
  for (const item of items) {
    const row = toRow(item);
    if (row !== undefined) rows.push(row);
  }
  return rows.map((row, index) => ({ ...row, index }));
};

const parseItems = (raw: unknown): readonly ComboboxRow[] => {
  if (!Array.isArray(raw)) return [];
  return toRows(
    raw.filter((item): item is ComboboxItem =>
      typeof item === "object" && item !== null
    ),
  );
};

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Why the input's text moved: the prop channel carries no `src`, so ours
 * names the event that produced the move. */
const INPUT_REASON: Record<string, string> = {
  "INPUT.CHANGE": "input-change",
  "INPUT_VALUE.SET": "script",
  "VALUE.SET": "value-set",
  "VALUE.CLEAR": "clear-trigger",
  "ITEM.SELECT": "item-select",
  "ITEM.CLEAR": "item-clear",
  "ITEM.CLICK": "item-select",
  "INPUT.ENTER": "item-select",
  "SELECTED_ITEMS.SYNC": "sync",
  "INPUT.ESCAPE": "escape-key",
  "LAYER.INTERACT_OUTSIDE": "interact-outside",
};

/** Why the panel opened or closed: the reasons Zag names, and `script` for
 * everything the host asked for. */
const OPEN_REASON: Record<string, string> = {
  "TRIGGER.CLICK": "trigger-click",
  "INPUT.CLICK": "input-click",
  "INPUT.CHANGE": "input-change",
  "INPUT.ARROW_DOWN": "arrow-key",
  "INPUT.ARROW_UP": "arrow-key",
  "INPUT.ENTER": "item-select",
  "ITEM.CLICK": "item-select",
  "LAYER.ESCAPE": "escape-key",
  "LAYER.INTERACT_OUTSIDE": "interact-outside",
  "VALUE.CLEAR": "clear-trigger",
};

type ScopeLike = ViewFor<ComboboxContext, ComboboxEvents, ComboboxState>;
type SlotLike<R> = SlotViewFor<
  R,
  ComboboxContext,
  ComboboxEvents,
  ComboboxState
>;

const rowsCache = new WeakMap<
  readonly ComboboxItem[],
  readonly ComboboxRow[]
>();
const rowsOf = (parsed: Record<string, unknown>): readonly ComboboxRow[] => {
  const raw: unknown = parsed["items"];
  if (!Array.isArray(raw)) return [];
  const hit = rowsCache.get(raw);
  if (hit !== undefined) return hit;
  const built = toRows(raw);
  rowsCache.set(raw, built);
  return built;
};

/** Blocks memoized on the rows' identity: the `for` directive iterates this
 * array, and fresh wrappers per read would re-stamp the groups. */
const blocksCache = new WeakMap<
  readonly ComboboxRow[],
  readonly ComboboxBlock[]
>();
const blocksOf = (rows: readonly ComboboxRow[]): readonly ComboboxBlock[] => {
  const hit = blocksCache.get(rows);
  if (hit !== undefined) return hit;
  const built: ComboboxBlock[] = [];
  let label: string | null = null;
  let group: ComboboxRow[] = [];
  const flush = (): void => {
    if (group.length === 0) return;
    built.push({ id: label ?? `group-${built.length}`, label, rows: group });
    label = null;
    group = [];
  };
  let previous: string | undefined;
  for (const row of rows) {
    if ((row.group ?? "") !== (previous ?? "")) {
      flush();
      label = row.group === undefined || row.group.length === 0
        ? null
        : row.group;
      previous = row.group;
    }
    group.push(row);
  }
  flush();
  blocksCache.set(rows, built);
  return built;
};

/** Zag's `getEventKey`: the only thing `dir` changes is which way the
 * horizontal arrows point. */
const resolveKey = (event: KeyboardEvent, dir: string): string => {
  if (dir !== "rtl") return event.key;
  if (event.key === "ArrowLeft") return "ArrowRight";
  if (event.key === "ArrowRight") return "ArrowLeft";
  return event.key;
};

/**
 * One step through the collection, mirroring Zag's `getNextValue`: the walk
 * starts at the highlighted row's position — so a highlight sitting on a
 * disabled row still moves — skips the disabled rows it passes, and returns
 * null when it runs off the end. With no reference point at all the RAW
 * first (or last) row is the answer, disabled or not.
 */
const step = (scope: ScopeLike, delta: 1 | -1): string | null => {
  const list = scope.context.items;
  if (list.length === 0) return null;
  const current = scope.context.highlightedValue;
  if (current === null) {
    const row = delta > 0 ? list[0] : list[list.length - 1];
    return row === undefined ? null : row.value;
  }
  const at = list.findIndex((row) => row.value === current);
  const start = at === -1 ? 0 : at;
  for (
    let index = start + delta;
    index >= 0 && index < list.length;
    index += delta
  ) {
    const row = list[index];
    if (row !== undefined && !row.disabled) return row.value;
  }
  return null;
};

/** The collection's extremes, disabled or not. */
const edge = (scope: ScopeLike, from: "first" | "last"): string | null => {
  const list = scope.context.items;
  const row = from === "first" ? list[0] : list[list.length - 1];
  return row === undefined ? null : row.value;
};

/** The arrow's target: the walk, wrapping only when the host loops. */
const walked = (scope: ScopeLike, delta: 1 | -1): Record<string, string> => {
  const value = step(scope, delta);
  if (value !== null) return { value };
  if (scope.context.loopFocus !== true) return {};
  const wrapped = edge(scope, delta > 0 ? "first" : "last");
  return wrapped === null ? {} : { value: wrapped };
};

const inputKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (scope.context.disabled === true || scope.context.readOnly === true) {
    return;
  }
  // A composing keystroke and any modifier are the host's, not the
  // machine's: Zag routes the whole key map behind this guard.
  if (event.ctrlKey || event.shiftKey || isComposing(event)) return;
  const ctx = scope.context;
  const isOpen = isOpenPhase(scope.state);
  const valueAsString = ctx.value
    .map((value) => ctx.labels[value])
    .filter((label) => label !== undefined)
    .join(", ");
  const dir = event.target instanceof Element
    ? event.target.ownerDocument?.defaultView?.getComputedStyle(event.target)
      .direction
    : "ltr";
  switch (resolveKey(event, typeof dir === "string" ? dir : "ltr")) {
    case "ArrowDown": {
      if (scope.context.openOnKeyPress === false && !isOpen) return;
      event.preventDefault();
      if (event.altKey) {
        scope.send({ type: "OPEN" });
        return;
      }
      scope.send({
        type: "INPUT.ARROW_DOWN",
        keypress: true,
        ...(isOpen ? walked(scope, 1) : {}),
      });
      return;
    }
    case "ArrowUp": {
      if (scope.context.openOnKeyPress === false && !isOpen) return;
      event.preventDefault();
      if (event.altKey) {
        scope.send({ type: "CLOSE" });
        return;
      }
      scope.send({
        type: "INPUT.ARROW_UP",
        keypress: true,
        ...(isOpen ? walked(scope, -1) : {}),
      });
      return;
    }
    case "Home": {
      const value = edge(scope, "first");
      scope.send({
        type: "INPUT.HOME",
        keypress: true,
        ...(isOpen && value !== null ? { value } : {}),
      });
      if (isOpen) event.preventDefault();
      return;
    }
    case "End": {
      const value = edge(scope, "last");
      scope.send({
        type: "INPUT.END",
        keypress: true,
        ...(isOpen && value !== null ? { value } : {}),
      });
      if (isOpen) event.preventDefault();
      return;
    }
    case "Escape": {
      // Zag sends INPUT.ESCAPE from the input's own keymap (not from the
      // dismissable layer): the focused state must revert typed text to
      // the selection, and the dismissable path only closes.
      scope.send({ type: "INPUT.ESCAPE" });
      event.preventDefault();
      return;
    }
    case "Enter": {
      // Zag reads the prevention from the pre-send snapshot: the send may
      // select and close, so a post-send read would see no panel.
      const wasOpen = isOpen;
      const highlighted = ctx.highlightedValue !== null;
      const rejected = ctx.inputValue !== valueAsString &&
        !ctx.allowCustomValue;
      scope.send({ type: "INPUT.ENTER" });
      // The field must not submit its form when the machine consumed the
      // key: a live highlight, or text the collection refuses, is both.
      if (
        wasOpen && scope.context.alwaysSubmitOnEnter !== true &&
        (highlighted || rejected)
      ) {
        event.preventDefault();
      }
      return;
    }
    default:
      return;
  }
};

/** Row handlers, built once per row per bridge: the scope reads live through
 * proxies, so a cached closure never goes stale. Keyed by the bridge's own
 * send fn first, so two bridges sharing one collection identity never share
 * handlers. */
type RowHandlerSet = {
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onPointerLeave: () => void;
  readonly onClick: (event: MouseEvent) => void;
};
const rowHandlersByBridge = new WeakMap<
  object,
  WeakMap<ComboboxRow, RowHandlerSet>
>();
const rowHandlers = (
  scope: ScopeLike,
  row: ComboboxRow,
): RowHandlerSet => {
  let byRow = rowHandlersByBridge.get(scope.send);
  if (byRow === undefined) {
    byRow = new WeakMap();
    rowHandlersByBridge.set(scope.send, byRow);
  }
  const hit = byRow.get(row);
  if (hit !== undefined) return hit;
  const made: RowHandlerSet = {
    onPointerMove: (event: PointerEvent): void => {
      if (scope.context.disabled === true) return;
      if (row.disabled || event.pointerType !== "mouse") return;
      if (scope.context.highlightedValue === row.value) return;
      scope.send({ type: "ITEM.POINTER_MOVE", value: row.value });
    },
    onPointerLeave: (): void => {
      if (scope.context.disabled === true) return;
      if (row.disabled) return;
      scope.send({ type: "ITEM.POINTER_LEAVE" });
    },
    // A modified click is the browser's — a new tab, a download, a context
    // menu — and never a selection.
    onClick: (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      if (scope.context.disabled === true) return;
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
      scope.send({ type: "ITEM.CLICK", value: row.value });
    },
  };
  byRow.set(row, made);
  return made;
};

const itemStateOf = (
  scope: ScopeLike,
  row: ComboboxRow,
): ComboboxItemState => ({
  value: row.value,
  disabled: scope.context.disabled || row.disabled === true,
  highlighted: scope.context.highlightedValue === row.value,
  selected: scope.context.value.includes(row.value),
});

/** The component's public state: the names the markup may key on. */
export const def = {
  name: "combobox",
  machine: (props, authored) =>
    comboboxMachine(props as ComboboxArgs, authored),
  start: (
    props,
  ) => (props["open"] === true || props["defaultOpen"] === true
    ? "suggesting"
    : "idle"),
  // The idle phase's entry clears the highlight, so the host's seeded
  // highlight is established AFTER the start, where the machine's own entry
  // cannot clear it again.
  establish: (raw, authored) => {
    const highlight: unknown = authored("highlightedValue")
      ? raw["highlightedValue"]
      : raw["defaultHighlightedValue"];
    if (typeof highlight !== "string" || highlight.length === 0) return [];
    return [{ type: "HIGHLIGHTED_VALUE.SET", value: highlight }];
  },
  reconcile: ({ context, state, parsed, authored, send }) => {
    const ctx = context;
    const rows = parseItems(parsed["items"]);
    const order = rows.map((row) => row.value);
    const orderChanged = !sameKeys(ctx.order, order);
    ctx.items = rows;
    if (orderChanged) {
      ctx.order = order;
      ctx.labels = Object.fromEntries(
        rows.map((row) => [row.value, row.label]),
      );
      // Zag's `watch` on the collection: an open panel re-homes itself
      // over a collection that changed under it.
      if (isOpenPhase(state)) {
        send({ type: "CHILDREN_CHANGE" });
      }
    }
    // The host owns the panel when it authored `open`: the machine follows
    // the prop, and the machine's own move is what reports it. The panel's
    // visibility is the machine's STATE, not a context field.
    if (authored("open")) {
      const open = parsed["open"] === true;
      if (open !== isOpenPhase(state)) {
        send({ type: open ? "OPEN" : "CLOSE" });
        return true;
      }
    }
    return orderChanged;
  },
  settled: ({ event, before, after, focus }) => {
    const wasOpen = isOpenPhase(before.state);
    const isOpenNow = isOpenPhase(after.state);
    // Zag's `open.entry` and `setFinalFocus`: the panel's opening owes the
    // field its focus, and a close the host asked for gives it back.
    if (wasOpen !== isOpenNow && (isOpenNow || event.type === "CLOSE")) {
      focus("input");
    }
  },
  parts: {
    root: {
      attrs: (scope: ScopeLike) => {
        const open = isOpenPhase(scope.state);
        return {
          dir: scope.context.dir,
          "data-phase": scope.state,
          "data-state": open ? "open" : "closed",
          "data-disabled": scope.attr(scope.context.disabled === true),
          "data-readonly": scope.attr(scope.context.readOnly === true),
          "use:dismissable": {
            onEscape: (): void => {
              if (!isOpenPhase(scope.state)) return;
              scope.send({ type: "LAYER.ESCAPE" });
            },
            onOutside: (): void => {
              if (!isOpenPhase(scope.state)) return;
              scope.send({ type: "LAYER.INTERACT_OUTSIDE" });
            },
          },
        };
      },
    },
    label: {
      attrs: (scope: ScopeLike) => ({
        htmlFor: scope.id("input"),
        "data-state": isOpenPhase(scope.state) ? "open" : "closed",
        "data-disabled": scope.attr(scope.context.disabled === true),
        "data-invalid": scope.attr(scope.context.invalid === true),
        "data-required": scope.attr(scope.context.required === true),
        onClick: (): void => {
          // The label's click is the input's: native focus follows the
          // label activation.
        },
      }),
    },
    control: {
      attrs: (scope: ScopeLike) => ({
        "data-state": isOpenPhase(scope.state) ? "open" : "closed",
        "data-disabled": scope.attr(scope.context.disabled === true),
      }),
    },
    positioner: {
      attrs: (scope: ScopeLike) => {
        const _placementRaw = scope.context.placement;
        const placement =
          typeof _placementRaw === "string" && _placementRaw.length > 0
            ? _placementRaw
            : "bottom";
        return {
          hidden: !isOpenPhase(scope.state),
          "data-state": isOpenPhase(scope.state) ? "open" : "closed",
          // Zag measures a floating placement and reports it; the recipe
          // anchors the panel with utilities, so the authored placement and
          // the side it implies are what the theme keys on.
          "data-placement": placement,
          "data-side": placement.split("-")[0] ?? placement,
        };
      },
    },
    input: {
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const display = ctx.autofill ?? ctx.inputValue;
        return {
          dir: scope.context.dir,
          type: "text",
          role: "combobox",
          name: scope.context.name,
          form: scope.context.form,
          disabled: scope.context.disabled,
          readOnly: scope.context.readOnly,
          required: scope.context.required,
          placeholder: scope.context.placeholder,
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "none",
          spellCheck: false,
          // The field is controlled: the bag binds the machine's text, and
          // an inline completion rides on top of it.
          value: display,
          ...ariaInvalid(ariaState(scope.context.invalid)),
          ...comboboxInput(scope, {
            autocomplete: ctx.inputBehavior === "autocomplete"
              ? "both"
              : "list",
            controls: { part: "content" },
            expanded: isOpenPhase(scope.state),
            activeDescendant: ctx.highlightedValue === null
              ? undefined
              : { part: "item", slot: ctx.highlightedValue },
          }),
          "data-state": isOpenPhase(scope.state) ? "open" : "closed",
          "data-disabled": scope.attr(scope.context.disabled === true),
          onFocus: (): void => {
            if (scope.context.disabled === true) return;
            scope.send({ type: "INPUT.FOCUS" });
          },
          onBlur: (): void => {
            if (scope.context.disabled === true) return;
            scope.send({ type: "INPUT.BLUR" });
          },
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (scope.context.openOnClick === false) return;
            if (
              scope.context.disabled === true || scope.context.readOnly === true
            ) return;
            scope.send({ type: "INPUT.CLICK" });
          },
          onInput: (
            event: { readonly currentTarget: { readonly value: string } },
          ): void => {
            scope.send({
              type: "INPUT.CHANGE",
              value: event.currentTarget.value,
            });
          },
          onKeydown: (event: KeyboardEvent): void => {
            inputKeydown(scope, event);
          },
        };
      },
    },
    trigger: {
      attrs: (scope, arg) => {
        const focusable = typeof arg === "object" && arg !== null &&
          "focusable" in arg && arg.focusable === true;
        const open = isOpenPhase(scope.state);
        return {
          id: scope.id("trigger"),
          type: "button",
          ...disclosureTrigger(scope, {
            expanded: open,
            hasPopup: scope.context.composite !== false ? "listbox" : "dialog",
            controls: open ? { part: "content" } : undefined,
          }),
          "aria-label": scope.context.triggerLabel,
          disabled: scope.context.disabled,
          tabIndex: focusable ? undefined : -1,
          "data-state": open ? "open" : "closed",
          "data-focusable": scope.attr(focusable),
          "data-disabled": scope.attr(scope.context.disabled === true),
          onFocus: (): void => {
            if (!focusable) return;
            scope.send({ type: "INPUT.FOCUS" });
          },
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (
              scope.context.disabled === true || scope.context.readOnly === true
            ) return;
            if (event.button !== 0) return;
            scope.send({ type: "TRIGGER.CLICK" });
          },
          // A press must not move focus to the button: the field keeps it,
          // which is what keeps the caret where the user left it.
          onPointerDown: (event: PointerEvent): void => {
            if (
              scope.context.disabled === true || scope.context.readOnly === true
            ) return;
            if (event.pointerType === "touch") return;
            if (event.button !== 0) return;
            event.preventDefault();
          },
          // The non-composite shape has no input driving the panel, so the
          // trigger owns the arrows.
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            if (scope.context.composite !== false) return;
            if (
              scope.context.disabled === true || scope.context.readOnly === true
            ) return;
            const key = resolveKey(
              event,
              event.target instanceof Element &&
                event.target.ownerDocument?.defaultView?.getComputedStyle(
                    event.target,
                  ).direction === "rtl"
                ? "rtl"
                : "ltr",
            );
            if (key !== "ArrowDown" && key !== "ArrowUp") return;
            event.preventDefault();
            scope.send({
              type: key === "ArrowDown" ? "INPUT.ARROW_DOWN" : "INPUT.ARROW_UP",
            });
          },
        };
      },
    },
    triggerIndicator: {
      attrs: (scope: ScopeLike) => ({
        ...ariaHidden(true),
        "data-state": isOpenPhase(scope.state) ? "open" : "closed",
      }),
    },
    clearTrigger: {
      attrs: (scope: ScopeLike) => ({
        id: scope.id("clearTrigger"),
        type: "button",
        "aria-label": scope.context.clearTriggerLabel,
        ...ariaControls(scope, { part: "input" }),
        disabled: scope.context.disabled,
        tabIndex: -1,
        "data-state": isOpenPhase(scope.state) ? "open" : "closed",
        "data-disabled": scope.attr(scope.context.disabled === true),
        hidden: scope.context.value.length === 0,
        onPointerDown: (event: PointerEvent): void => {
          if (event.button !== 0) return;
          event.preventDefault();
        },
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          if (
            scope.context.disabled === true || scope.context.readOnly === true
          ) return;
          scope.send({ type: "VALUE.CLEAR" });
        },
      }),
    },
    content: {
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const _placementRaw = scope.context.placement;
        const placement =
          typeof _placementRaw === "string" && _placementRaw.length > 0
            ? _placementRaw
            : "bottom";
        const rows = scope.context.items;
        return {
          dir: scope.context.dir,
          role: scope.context.composite !== false ? "listbox" : "dialog",
          tabIndex: -1,
          ...listSurface(scope, {
            labelledBy: { part: "label" },
            multiSelectable: scope.context.composite !== false && ctx.multiple
              ? true
              : undefined,
          }),
          "data-state": isOpenPhase(scope.state) ? "open" : "closed",
          "data-placement": placement,
          "data-side": placement.split("-")[0] ?? placement,
          "data-empty": scope.attr(rows.length === 0),
          "data-disabled": scope.attr(scope.context.disabled === true),
          // A press inside the panel must not take focus out of the field.
          onPointerDown: (event: PointerEvent): void => {
            if (event.button !== 0) return;
            event.preventDefault();
          },
          // The active descendant is revealed by the browser's own scroll.
          "use:scroll-into-view": {
            activeId: (): string => {
              const highlighted = scope.context.highlightedValue;
              if (!isOpenPhase(scope.state) || highlighted === null) return "";
              return scope.id("item", highlighted);
            },
          },
        };
      },
    },
    list: {
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const composite = scope.context.composite !== false;
        return {
          role: composite ? undefined : "listbox",
          ...listSurface(scope, {
            labelledBy: { part: "label" },
            multiSelectable: composite
              ? undefined
              : ctx.multiple
              ? true
              : undefined,
          }),
          "data-empty": scope.attr(scope.context.items.length === 0),
        };
      },
    },
  },
  slots: {
    item: {
      id: "item",
      indexes: (context) => context.items,
      attrs: (scope: SlotLike<ComboboxRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.value),
          role: "option",
          tabIndex: -1,
          "data-value": row.value,
          ...optionRow({
            selected: state.selected,
            disabled: state.disabled ? true : undefined,
          }),
          "data-highlighted": scope.attr(state.highlighted),
          "data-selected": scope.attr(state.selected),
          "data-disabled": scope.attr(state.disabled),
          ...rowHandlers(scope, row),
        };
      },
    },
    itemText: {
      indexes: (context) => context.items,
      attrs: (scope: SlotLike<ComboboxRow>) => {
        const state = itemStateOf(scope, scope.slot);
        return {
          "data-selected": scope.attr(state.selected),
          "data-highlighted": scope.attr(state.highlighted),
          "data-disabled": scope.attr(state.disabled),
        };
      },
    },
    itemIndicator: {
      indexes: (context) => context.items,
      attrs: (scope: SlotLike<ComboboxRow>) => {
        const selected = itemStateOf(scope, scope.slot).selected;
        return {
          ...ariaHidden(true),
          "data-selected": scope.attr(selected),
          hidden: !selected,
        };
      },
    },
    itemGroup: {
      id: "item-group",
      indexes: (context) => blocksOf(context.items),
      attrs: (scope: SlotLike<ComboboxBlock>) => {
        const block = scope.slot;
        return {
          id: scope.id("itemGroup", block.id),
          role: "group",
          ...ariaLabelledBy(scope, { part: "itemGroupLabel", slot: block.id }),
          "data-empty": scope.attr(scope.context.items.length === 0),
        };
      },
    },
    itemGroupLabel: {
      id: "item-group-label",
      indexes: (context) => blocksOf(context.items),
      attrs: (scope: SlotLike<ComboboxBlock>) => {
        const block = scope.slot;
        return {
          id: scope.id("itemGroupLabel", block.id),
          role: "presentation",
          hidden: block.label === null,
        };
      },
    },
  },
  commands: {
    syncSelectedItems: { event: () => ({ type: "SELECTED_ITEMS.SYNC" }) },
    setHighlightValue: {
      event: (args: readonly unknown[]) => {
        const v = args[0];
        return {
          type: "HIGHLIGHTED_VALUE.SET",
          value: typeof v === "string" ? v : null,
        };
      },
    },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE.CLEAR" }) },
    selectValue: {
      event: (args: readonly unknown[]) => {
        const v = args[0];
        return { type: "ITEM.SELECT", value: typeof v === "string" ? v : "" };
      },
    },
    setValue: {
      event: (args: readonly unknown[]) => {
        const v = args[0];
        return {
          type: "VALUE.SET",
          value: Array.isArray(v) &&
              v.every((x): x is string => typeof x === "string")
            ? [...v]
            : [],
        };
      },
    },
    setInputValue: {
      event: (args: readonly unknown[]) => {
        const v = args[0];
        return {
          type: "INPUT_VALUE.SET",
          value: typeof v === "string" ? v : "",
        };
      },
    },
    clearValue: {
      event: (args) =>
        args[0] === undefined ? ({ type: "VALUE.CLEAR" }) : (() => {
          const v = args[0];
          return { type: "ITEM.CLEAR", value: typeof v === "string" ? v : "" };
        })(),
    },
    focus: { view: ({ focus }) => focus("input") },
    setOpen: {
      event: ([open]: [open: boolean]) => ({
        type: open ? "OPEN" as const : "CLOSE" as const,
      }),
    },
  },
  readers: {
    open: { read: (_context, state) => isOpenPhase(state) },
    focused: { read: (_context, state) => state !== "idle" },
    inputValue: {
      read: (context) => {
        const ctx = context;
        return ctx.autofill ?? ctx.inputValue;
      },
    },
    highlightedValue: { read: (context) => context.highlightedValue },
    highlightedItem: {
      read: (context) => {
        const ctx = context;
        if (ctx.highlightedValue === null) return null;
        return ctx.items.find((row) => row.value === ctx.highlightedValue) ??
          null;
      },
    },
    value: { read: (context) => [...context.value] },
    valueAsString: {
      read: (context) => {
        const ctx = context;
        return ctx.value.map((value) => ctx.labels[value]).filter((label) =>
          label !== undefined
        ).join(", ");
      },
    },
    hasSelectedItems: { read: (context) => context.value.length > 0 },
    selectedItems: {
      read: (context) => {
        const ctx = context;
        const rows = ctx.items;
        return ctx.value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is ComboboxRow => row !== undefined);
      },
    },
    multiple: { read: (context) => context.multiple },
    invalid: { read: (context) => context.invalid },
    disabled: { read: (context) => context.disabled },
    empty: { read: (context) => context.items.length === 0 },
  },
  methods: {
    getBlocks: {
      call: (context) => blocksOf(context.items),
    },
    getRows: {
      call: (_context, _state, args) => {
        const block = args[0];
        if (
          typeof block !== "object" || block === null || !("rows" in block) ||
          !Array.isArray(block.rows)
        ) return [];
        return block.rows.filter((row): row is ComboboxRow =>
          typeof row === "object" && row !== null
        );
      },
    },
    getItemState: {
      call: (
        context: ComboboxContext,
        _state,
        [row]: [row: ComboboxRow],
      ): ComboboxItemState => {
        return {
          value: row.value,
          disabled: context.disabled || row.disabled === true,
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
      detail: (watched: readonly string[], _event, props) => {
        const rows = props === undefined ? [] : rowsOf(props);
        const value = watched;
        return {
          value: [...value],
          items: value.map((item) => rows.find((row) => row.value === item))
            .filter((row) => row !== undefined),
        };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [context.highlightedValue],
      detail: (watched: readonly [string | null], _event, props) => {
        const highlighted = watched[0];
        const rows = props === undefined ? [] : rowsOf(props);
        return {
          highlightedValue: highlighted,
          highlightedItem: highlighted === null
            ? null
            : rows.find((row) => row.value === highlighted) ?? null,
        };
      },
    },
    "input-value-change": {
      prop: "onInputValueChange",
      watch: (context) => [context.inputValue],
      detail: (watched: readonly [string], event) => ({
        inputValue: watched[0],
        reason: (event !== undefined ? INPUT_REASON[event.type] : undefined) ??
          "script",
      }),
    },
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [isOpenPhase(state)],
      detail: (watched: readonly [boolean], event, _props, context) => ({
        open: watched[0],
        reason: (event !== undefined ? OPEN_REASON[event.type] : undefined) ??
          "script",
        value: [
          ...(context !== undefined && Array.isArray(context.value)
            ? context.value
            : []),
        ],
      }),
    },
    select: {
      prop: "onSelect",
      watch: (context) => [...context.value],
      detail: (watched: readonly string[]) => ({
        value: [...watched],
        itemValue: "",
      }),
      select: (event, before: ComboboxContext, after: ComboboxContext) => {
        const beforeCtx = before;
        const afterCtx = after;
        let outcome: string[] | null = null;
        let itemValue = "";
        if (event.type === "ITEM.SELECT" || event.type === "ITEM.CLICK") {
          const ev = event["value"];
          if (typeof ev !== "string") return null;
          outcome = pickOutcome(beforeCtx, ev);
          itemValue = ev;
        } else if (event.type === "INPUT.ENTER") {
          const highlighted = beforeCtx.highlightedValue;
          if (highlighted === null || !beforeCtx.order.includes(highlighted)) {
            return null;
          }
          outcome = pickOutcome(beforeCtx, highlighted);
          itemValue = highlighted;
        }
        // A guard the machine refused reports nothing.
        if (outcome === null || !sameKeys(outcome, afterCtx.value)) return null;
        return { value: [...outcome], itemValue };
      },
    },
  },
} satisfies ComponentDef<
  ComboboxContext,
  ComboboxEvents,
  Record<string, unknown>,
  ComboboxArgs,
  ComboboxState
>;

export type ComboboxApi = ApiOf<typeof def>;
export const combobox = defineComponent<
  ComboboxContext,
  ComboboxEvents,
  ComboboxApi,
  ComboboxArgs,
  ComboboxState
>(def);
