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
  isOpenPhase,
  pickOutcome,
  stringifyValues,
  type ComboboxContext,
  type ComboboxEvent,
} from "./combobox.machine.ts";

/**
 * Combobox definition: the DOM contract as data. The machine owns the four
 * phases, the selection, the input text, the highlight, and the inline
 * completion; this file maps props to channels, parts to attribute bags,
 * commands to sends, and value/highlight/input/open/select transitions to
 * their events. Navigation (arrows, Home, End) computes its target against
 * the rows the view holds and sends it in — the machine never walks data.
 * The collection parses once per prop identity: row objects are stable, so
 * the `for` bindings never re-stamp.
 */

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

export interface ComboboxApi {
  syncSelectedItems(): void;
  setHighlightValue(value: string): void;
  clearHighlightValue(): void;
  selectValue(value: string): void;
  setValue(value: readonly string[]): void;
  setInputValue(value: string): void;
  clearValue(value?: string): void;
  focus(): void;
  setOpen(open: boolean): void;
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
  getTriggerProps(trigger?: { readonly focusable?: boolean }): Record<string, unknown>;
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

const toRow = (item: ComboboxItem): ComboboxRow | undefined => {
  if (typeof item.value !== "string" || item.value.length === 0) return undefined;
  return {
    value: item.value,
    label: typeof item.label === "string" && item.label.length > 0 ? item.label : item.value,
    disabled: item.disabled === true,
    group: typeof item.group === "string" ? item.group : "",
    index: 0,
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

/** The scope grammar's object-array type carries the fields the host typed;
 * anything else arriving on the prop channel is treated as no items. */
const parseItems = (raw: unknown): readonly ComboboxRow[] => {
  if (!Array.isArray(raw)) return [];
  return toRows(raw.filter((item): item is ComboboxItem => typeof item === "object" && item !== null));
};

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** A non-empty text prop, or null — the shape `highlightedValue` travels in. */
const nullableProp = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

/** Why the input's text moved. Zag reports the event's `src`; ours names the
 * event that produced the move, because the prop channel carries no `src`. */
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

/** Why the panel opened or closed: the four user-facing reasons Zag names,
 * and `script` for everything the host asked for. */
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

/**
 * Zag's `context({bindable})` for `inputValue`: the field starts as the
 * authored text, and a single-mode field with no authored text starts as the
 * selection's string — replaced for `replace`, kept in full for `preserve`,
 * emptied for `clear`.
 */
function seedInputValue(
  authoredText: string,
  fallbackText: string,
  behavior: string,
  multiple: boolean,
  valueAsString: string,
): string {
  const seeded = authoredText.length > 0 ? authoredText : fallbackText;
  if (seeded.trim().length > 0 || multiple) return seeded;
  if (behavior === "clear") return "";
  // `preserve` with an empty field falls through to the selection's text, so
  // both behaviours that keep a value in the field start the same way.
  return valueAsString;
}

type Ctx = ComboboxContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const rowsOf = (parsed: Record<string, unknown>): readonly ComboboxRow[] =>
  parsed["items"] as readonly ComboboxRow[];

const orderOf = (parsed: Record<string, unknown>): string[] =>
  rowsOf(parsed).map((row) => row.value);

const labelsOf = (parsed: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(rowsOf(parsed).map((row) => [row.value, row.label]));

/** Blocks memoized on the rows' identity: the `for` directive iterates this
 * array, and fresh wrappers per read would re-stamp the groups. Keyed by the
 * rows array itself, so sharing across bridges is correct — identical rows
 * build identical blocks. */
const blocksCache = new WeakMap<readonly ComboboxRow[], readonly ComboboxBlock[]>();
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

/** The collection's extremes, disabled or not. */
const edge = (scope: ScopeLike, from: "first" | "last"): string | null => {
  const list = rowsOf(scope.props);
  const row = from === "first" ? list[0] : list[list.length - 1];
  return row === undefined ? null : row.value;
};

/** The arrow's target: the walk, wrapping only when the host loops. */
const walked = (scope: ScopeLike, delta: 1 | -1): Record<string, string> => {
  const value = step(scope, delta);
  if (value !== null) return { value };
  if (scope.props["loopFocus"] !== true) return {};
  const wrapped = edge(scope, delta > 0 ? "first" : "last");
  return wrapped === null ? {} : { value: wrapped };
};

const inputKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  const props = scope.props;
  if (props["disabled"] === true || props["readOnly"] === true) return;
  // A composing keystroke and any modifier are the host's, not the
  // machine's: Zag routes the whole key map behind this guard.
  if (event.ctrlKey || event.shiftKey || isComposing(event)) return;
  const ctx = asCtx(scope.context);
  const isOpen = isOpenPhase(scope.state);
  const valueAsString = ctx.value
    .map((value) => ctx.labels[value])
    .filter((label) => label !== undefined)
    .join(", ");
  switch (resolveKey(event, props["dir"] as string)) {
    case "ArrowDown": {
      if (props["openOnKeyPress"] !== true && !isOpen) return;
      event.preventDefault();
      if (event.altKey) {
        scope.send({ type: "OPEN" });
        return;
      }
      scope.send({ type: "INPUT.ARROW_DOWN", keypress: true, ...(isOpen ? walked(scope, 1) : {}) });
      return;
    }
    case "ArrowUp": {
      if (props["openOnKeyPress"] !== true && !isOpen) return;
      event.preventDefault();
      if (event.altKey) {
        scope.send({ type: "CLOSE" });
        return;
      }
      scope.send({ type: "INPUT.ARROW_UP", keypress: true, ...(isOpen ? walked(scope, -1) : {}) });
      return;
    }
    case "Home": {
      const value = edge(scope, "first");
      scope.send({ type: "INPUT.HOME", keypress: true, ...(isOpen && value !== null ? { value } : {}) });
      if (isOpen) event.preventDefault();
      return;
    }
    case "End": {
      const value = edge(scope, "last");
      scope.send({ type: "INPUT.END", keypress: true, ...(isOpen && value !== null ? { value } : {}) });
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
      const rejected = ctx.inputValue !== valueAsString && !ctx.allowCustomValue;
      scope.send({ type: "INPUT.ENTER" });
      // The field must not submit its form when the machine consumed the
      // key: a live highlight, or text the collection refuses, is both.
      if (wasOpen && props["alwaysSubmitOnEnter"] !== true && (highlighted || rejected)) {
        event.preventDefault();
      }
      return;
    }
    default:
      return;
  }
};

/** Row handlers, built once per row per bridge: the scope reads live
 * through proxies, so a cached closure never goes stale — while bindSpread's
 * listener-identity diffing skips re-attaching what did not change. Keyed by
 * the bridge's own send fn first, so two bridges sharing one collection
 * identity never share handlers. */
type RowHandlerSet = {
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onPointerLeave: () => void;
  readonly onClick: (event: MouseEvent) => void;
};
const rowHandlersByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
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
      if (scope.props["disabled"] === true) return;
      if (row.disabled || event.pointerType !== "mouse") return;
      if (asCtx(scope.context).highlightedValue === row.value) return;
      scope.send({ type: "ITEM.POINTER_MOVE", value: row.value });
    },
    onPointerLeave: (): void => {
      if (scope.props["disabled"] === true) return;
      if (row.disabled) return;
      scope.send({ type: "ITEM.POINTER_LEAVE", value: row.value });
    },
    // A modified click is the browser's — a new tab, a download, a context
    // menu — and never a selection. Zag asks the same three questions of
    // the event; on a plain row their union is this guard.
    onClick: (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      if (scope.props["disabled"] === true) return;
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

const itemStateOf = (scope: ScopeLike, row: ComboboxRow): ComboboxItemState => ({
  value: row.value,
  disabled: scope.props["disabled"] === true || row.disabled,
  highlighted: asCtx(scope.context).highlightedValue === row.value,
  selected: asCtx(scope.context).value.includes(row.value),
});

const def: ComponentDef<ComboboxContext, ComboboxEvent> = {
  name: "combobox",
  config,
  implementations,
  start: (props) => (props["open"] === true || props["defaultOpen"] === true ? "suggesting" : "idle"),
  seed: (props, authored) => {
    const multiple = props["multiple"] === true;
    const selection = props["selectionBehavior"];
    const selectionBehavior = selection === "preserve" || selection === "clear"
      ? selection
      : multiple
        ? "clear"
        : "replace";
    const behavior = props["inputBehavior"];
    const value = parseKeys(authored("value") ? props["value"] : props["defaultValue"]);
    const highlighted = authored("highlightedValue")
      ? nullableProp(props["highlightedValue"])
      : nullableProp(props["defaultHighlightedValue"]);
    const order = orderOf(props);
    const labels = labelsOf(props);
    const seedCtx: Ctx = {
      value,
      order,
      labels,
      highlightedValue: highlighted,
      multiple,
      closeOnSelect: authored("closeOnSelect") ? props["closeOnSelect"] === true : !multiple,
      allowCustomValue: props["allowCustomValue"] === true,
      inputBehavior: behavior === "autocomplete" || behavior === "autohighlight" ? behavior : "none",
      selectionBehavior,
      openOnChange: props["openOnChange"] !== false,
    } as Ctx;
    return {
      ...seedCtx,
      inputValue: seedInputValue(
        textProp(props["inputValue"] as string),
        textProp(props["defaultInputValue"] as string),
        selectionBehavior as string,
        multiple,
        stringifyValues(seedCtx, value),
      ),
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
    inputValue: {
      controlled: true,
      parse: textProp,
      event: (value: string) => ({ type: "INPUT_VALUE.SET", value }),
    },
    defaultInputValue: { parse: textProp },
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
      event: (value: boolean) => ({ type: value ? "OPEN" : "CLOSE" }),
      current: (_context, state) => isOpenPhase(state),
    },
    defaultOpen: { parse: (raw) => raw === true },
    multiple: { parse: (raw) => raw === true },
    closeOnSelect: { parse: (raw) => raw },
    allowCustomValue: { parse: (raw) => raw === true },
    inputBehavior: { parse: textProp },
    selectionBehavior: { parse: textProp },
    openOnChange: { parse: (raw) => raw !== false },
    composite: { parse: (raw) => raw !== false },
    loopFocus: { parse: (raw) => raw === true },
    openOnClick: { parse: (raw) => raw !== false },
    openOnKeyPress: { parse: (raw) => raw !== false },
    alwaysSubmitOnEnter: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    placement: {
      parse: (raw) => {
        const placement = textProp(raw);
        return placement.length > 0 ? placement : "bottom";
      },
    },
    name: { parse: textProp },
    form: { parse: textProp },
    placeholder: { parse: textProp },
    triggerLabel: {
      parse: (raw) => {
        const label = textProp(raw);
        return label.length > 0 ? label : "Toggle suggestions";
      },
    },
    clearTriggerLabel: {
      parse: (raw) => {
        const label = textProp(raw);
        return label.length > 0 ? label : "Clear value";
      },
    },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
  },
  scalarsOf: (parsed, authored) => {
    const multiple = parsed["multiple"] === true;
    return {
      multiple,
      // Zag's `closeOnSelect: !props.multiple` — a coerced default is not a
      // write, so an explicit `closeOnSelect` is the only thing that
      // overrides the mode's own answer.
      closeOnSelect: authored("closeOnSelect") ? parsed["closeOnSelect"] === true : !multiple,
      allowCustomValue: parsed["allowCustomValue"] === true,
      inputBehavior: parsed["inputBehavior"],
      selectionBehavior: parsed["selectionBehavior"],
      openOnChange: parsed["openOnChange"],
    };
  },
  reconcile: ({ context, state, parsed, send }) => {
    const ctx = asCtx(context);
    const order = orderOf(parsed);
    if (sameKeys(ctx.order, order)) return false;
    ctx.order = order;
    ctx.labels = labelsOf(parsed);
    // Zag's `watch` on the collection: an open panel re-homes itself over
    // a collection that changed under it.
    if (isOpenPhase(state)) {
      send({ type: "CHILDREN_CHANGE" });
    }
    return true;
  },
  settled: ({ event, before, after, focus }) => {
    const wasOpen = isOpenPhase((before as { readonly state: string }).state);
    const isOpenNow = isOpenPhase((after as { readonly state: string }).state);
    // Zag's `open.entry` and `setFinalFocus`: the panel's opening owes the
    // field its focus, and a close the host asked for gives it back.
    if (wasOpen !== isOpenNow && (isOpenNow || event.type === "CLOSE")) focus("input");
  },
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], scope.props["required"], scope.props["dir"], scope.props["composite"]].join("\u0000"),
      attrs: (scope) => {
        const open = isOpenPhase(scope.state);
        return {
          id: scope.id("root"),
          dir: scope.props["dir"],
          "data-scope": "combobox",
          "data-part": "root",
          "data-state": open ? "open" : "closed",
          "data-phase": scope.state,
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-required": scope.attr(scope.props["required"] === true),
          // The layer: a press outside the whole widget dismisses, and
          // Escape while it is up does too.
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
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], scope.props["required"], scope.props["dir"], scope.props["composite"]].join("\u0000"),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        htmlFor: scope.id("input"),
        "data-state": isOpenPhase(scope.state) ? "open" : "closed",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-readonly": scope.attr(scope.props["readOnly"] === true),
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-required": scope.attr(scope.props["required"] === true),
        "data-focused": scope.attr(scope.state !== "idle"),
        onClick: (): void => {
          // The label's click is the input's: the control keeps its own
          // behaviour only when the host asked for the dialog shape.
          if (scope.props["composite"] !== false) return;
          if (typeof document === "undefined") return;
          document.getElementById(scope.id("input"))?.focus();
        },
      }),
    },
    control: {
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["invalid"]].join("\u0000"),
      attrs: (scope) => ({
        id: scope.id("control"),
          "data-scope": "combobox",
          "data-part": "control",
        "data-state": isOpenPhase(scope.state) ? "open" : "closed",
        "data-focused": scope.attr(scope.state !== "idle"),
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-invalid": scope.attr(scope.props["invalid"] === true),
      }),
    },
    positioner: {
      sig: (scope) => [scope.state, scope.props["placement"]].join("\u0000"),
      attrs: (scope) => {
        const placement = scope.props["placement"] as string;
        return {
          id: scope.id("positioner"),
          "data-scope": "combobox",
          "data-part": "positioner",
          "data-state": isOpenPhase(scope.state) ? "open" : "closed",
          "data-phase": scope.state,
          // Zag measures a floating placement and reports it; the recipe
          // anchors the panel with utilities, so the authored placement and
          // the side it implies are the state the theme keys on.
          "data-placement": placement,
          "data-side": placement.split("-")[0] ?? placement,
        };
      },
    },
    input: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [scope.state, scope.props["dir"], scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], scope.props["required"], scope.props["name"], scope.props["form"], scope.props["placeholder"], ctx.highlightedValue, ctx.autofill ?? ctx.inputValue, ctx.inputValue].join("\u0000");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const display = ctx.autofill ?? ctx.inputValue;
        return {
          id: scope.id("input"),
          dir: scope.props["dir"],
          "data-scope": "combobox",
          "data-part": "input",
          type: "text",
          role: "combobox",
          name: scope.props["name"],
          form: scope.props["form"],
          disabled: scope.props["disabled"],
          readOnly: scope.props["readOnly"],
          required: scope.props["required"],
          placeholder: scope.props["placeholder"],
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "none",
          spellCheck: false,
          // The field is controlled: the bag binds the machine's text, and
          // an inline completion rides on top of it while one is live.
          value: display,
          "aria-invalid": scope.props["invalid"],
          "aria-autocomplete": ctx.inputBehavior === "autocomplete" ? "both" : "list",
          "aria-controls": scope.id("content"),
          "aria-expanded": isOpenPhase(scope.state),
          "aria-activedescendant": ctx.highlightedValue === null
            ? undefined
            : scope.id("item", ctx.highlightedValue as unknown as number),
          "data-state": isOpenPhase(scope.state) ? "open" : "closed",
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
          onFocus: (): void => {
            if (scope.props["disabled"] === true) return;
            scope.send({ type: "INPUT.FOCUS" });
          },
          onBlur: (): void => {
            if (scope.props["disabled"] === true) return;
            scope.send({ type: "INPUT.BLUR" });
          },
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (scope.props["openOnClick"] === false) return;
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "INPUT.CLICK" });
          },
          onInput: (event: { readonly currentTarget: { readonly value: string } }): void => {
            scope.send({ type: "INPUT.CHANGE", value: event.currentTarget.value });
          },
          onKeydown: (event: KeyboardEvent): void => {
            inputKeydown(scope, event);
          },
        };
      },
    },
    trigger: {
      sig: (scope, arg) => [scope.state, scope.props["disabled"], scope.props["invalid"], scope.props["readOnly"], scope.props["dir"], scope.props["composite"], scope.props["triggerLabel"], (arg as { readonly focusable?: boolean } | undefined)?.focusable === true].join("\u0000"),
      attrs: (scope, arg) => {
        const focusable = (arg as { readonly focusable?: boolean } | undefined)?.focusable === true;
        const open = isOpenPhase(scope.state);
        return {
          id: scope.id("trigger"),
          "data-scope": "combobox",
          "data-part": "trigger",
          dir: scope.props["dir"],
          type: "button",
          "aria-haspopup": scope.props["composite"] !== false ? "listbox" : "dialog",
          "aria-label": scope.props["triggerLabel"],
          "aria-expanded": open,
          "aria-controls": open ? scope.id("content") : undefined,
          disabled: scope.props["disabled"],
          tabIndex: focusable ? undefined : -1,
          "data-state": open ? "open" : "closed",
          "data-focusable": scope.attr(focusable),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
          onFocus: (): void => {
            if (!focusable) return;
            scope.send({ type: "INPUT.FOCUS" });
          },
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            if (event.button !== 0) return;
            scope.send({ type: "TRIGGER.CLICK" });
          },
          // A press must not move focus to the button: the field keeps it,
          // which is what keeps the caret where the user left it.
          onPointerDown: (event: PointerEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            if (event.pointerType === "touch") return;
            if (event.button !== 0) return;
            event.preventDefault();
            if (typeof document === "undefined") return;
            document.getElementById(scope.id("input"))?.focus();
          },
          // The non-composite shape has no input driving the panel, so the
          // trigger owns the arrows.
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            if (scope.props["composite"] !== false) return;
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            const key = resolveKey(event, scope.props["dir"] as string);
            if (key !== "ArrowDown" && key !== "ArrowUp") return;
            event.preventDefault();
            scope.send({ type: key === "ArrowDown" ? "INPUT.ARROW_DOWN" : "INPUT.ARROW_UP" });
          },
        };
      },
    },
    triggerIndicator: {
      sig: (scope) => ["indicator", scope.state, scope.props["dir"]].join("\u0000"),
      attrs: (scope) => ({
        "aria-hidden": true,
        dir: scope.props["dir"],
        "data-state": isOpenPhase(scope.state) ? "open" : "closed",
      }),
    },
    clearTrigger: {
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["invalid"], asCtx(scope.context).value.length, scope.props["clearTriggerLabel"]].join("\u0000"),
      attrs: (scope) => ({
        id: scope.id("clearTrigger"),
          "data-scope": "combobox",
          "data-part": "clear-trigger",
        type: "button",
        "aria-label": scope.props["clearTriggerLabel"],
        "aria-controls": scope.id("input"),
        disabled: scope.props["disabled"],
        tabIndex: -1,
        "data-state": isOpenPhase(scope.state) ? "open" : "closed",
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        hidden: asCtx(scope.context).value.length === 0,
        onPointerDown: (event: PointerEvent): void => {
          if (event.button !== 0) return;
          event.preventDefault();
        },
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
          scope.send({ type: "VALUE.CLEAR" });
        },
      }),
    },
    content: {
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["dir"], scope.props["composite"], asCtx(scope.context).multiple, scope.props["placement"], (scope.props["items"] as readonly ComboboxRow[]).length, asCtx(scope.context).highlightedValue].join("\u0000"),
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const placement = scope.props["placement"] as string;
        const rows = scope.props["items"] as readonly ComboboxRow[];
        return {
          id: scope.id("content"),
          dir: scope.props["dir"],
          "data-scope": "combobox",
          "data-part": "content",
          role: scope.props["composite"] !== false ? "listbox" : "dialog",
          tabIndex: -1,
          "aria-labelledby": scope.id("label"),
          "aria-multiselectable": scope.props["composite"] !== false && ctx.multiple ? true : undefined,
          "data-state": isOpenPhase(scope.state) ? "open" : "closed",
          "data-placement": placement,
          "data-side": placement.split("-")[0] ?? placement,
          "data-empty": scope.attr(rows.length === 0),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          // A press inside the panel must not take focus out of the field.
          onPointerDown: (event: PointerEvent): void => {
            if (event.button !== 0) return;
            event.preventDefault();
          },
          // The active descendant is revealed by the browser's own scroll,
          // and the lists go home when it goes away.
          "use:scroll-into-view": {
            activeId: (): string => {
              const highlighted = asCtx(scope.context).highlightedValue;
              if (!isOpenPhase(scope.state) || highlighted === null) return "";
              return scope.id("item", highlighted);
            },
          },
        };
      },
    },
    list: {
      sig: (scope) => [scope.state, scope.props["dir"], scope.props["composite"], asCtx(scope.context).multiple, (scope.props["items"] as readonly ComboboxRow[]).length].join("\u0000"),
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const composite = scope.props["composite"] !== false;
        return {
          dir: scope.props["dir"],
          "data-scope": "combobox",
          "data-part": "list",
          role: composite ? undefined : "listbox",
          "aria-labelledby": scope.id("label"),
          "aria-multiselectable": composite ? undefined : ctx.multiple ? true : undefined,
          "data-empty": scope.attr((scope.props["items"] as readonly ComboboxRow[]).length === 0),
        };
      },
    },
  },
  slots: {
    item: {
      id: "item",
      indexes: (_context, props) => rowsOf(props),
      sig: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as ComboboxRow);
        return `${state.highlighted}\u0000${state.selected}\u0000${state.disabled}`;
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as ComboboxRow;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.value),
          "data-scope": "combobox",
          "data-part": "item",
          role: "option",
          tabIndex: -1,
          "data-value": row.value,
          "data-state": state.selected ? "checked" : "unchecked",
          "aria-selected": state.selected,
          "aria-disabled": state.disabled ? true : undefined,
          "data-highlighted": scope.attr(state.highlighted),
          "data-disabled": scope.attr(state.disabled),
          ...rowHandlers(scope, row),
        };
      },
    },
    itemText: {
      indexes: (_context, props) => rowsOf(props),
      sig: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as ComboboxRow);
        return `${state.highlighted}\u0000${state.selected}\u0000${state.disabled}`;
      },
      attrs: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as ComboboxRow);
        return {
          "data-state": state.selected ? "checked" : "unchecked",
          "data-highlighted": scope.attr(state.highlighted),
          "data-disabled": scope.attr(state.disabled),
        };
      },
    },
    itemIndicator: {
      indexes: (_context, props) => rowsOf(props),
      sig: (scope) => `${itemStateOf(scope, scope.slot as unknown as ComboboxRow).selected}`,
      attrs: (scope) => {
        const selected = itemStateOf(scope, scope.slot as unknown as ComboboxRow).selected;
        return {
          "aria-hidden": true,
          "data-state": selected ? "checked" : "unchecked",
          hidden: !selected,
        };
      },
    },
    itemGroup: {
      id: "item-group",
      indexes: (_context, props) => blocksOf(rowsOf(props)),
      sig: (scope) => [scope.state, scope.props["dir"], rowsOf(scope.props).length].join("\u0000"),
      attrs: (scope) => {
        const block = scope.slot as unknown as ComboboxBlock;
        return {
          id: scope.id("itemGroup", block.id),
          dir: scope.props["dir"],
          role: "group",
          "aria-labelledby": scope.id("itemGroupLabel", block.id),
          "data-empty": scope.attr(rowsOf(scope.props).length === 0),
        };
      },
    },
    itemGroupLabel: {
      id: "item-group-label",
      indexes: (_context, props) => blocksOf(rowsOf(props)),
      sig: (scope) => `${(scope.slot as unknown as ComboboxBlock).label}`,
      attrs: (scope) => {
        const block = scope.slot as unknown as ComboboxBlock;
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
    setHighlightValue: { event: (args) => ({ type: "HIGHLIGHTED_VALUE.SET", value: args[0] as string }) },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE.CLEAR" }) },
    selectValue: { event: (args) => ({ type: "ITEM.SELECT", value: args[0] as string }) },
    setValue: { event: (args) => ({ type: "VALUE.SET", value: [...(args[0] as readonly string[])] }) },
    setInputValue: { event: (args) => ({ type: "INPUT_VALUE.SET", value: args[0] as string }) },
    clearValue: {
      event: (args) => args[0] === undefined
        ? ({ type: "VALUE.CLEAR" })
        : ({ type: "ITEM.CLEAR", value: args[0] as string }),
    },
    focus: { view: ({ focus }) => focus("input") },
    setOpen: { event: (args) => ({ type: (args[0] as boolean) ? "OPEN" : "CLOSE" }) },
  },
  readers: {
    open: { read: (_context, state) => isOpenPhase(state) },
    focused: { read: (_context, state) => state !== "idle" },
    inputValue: {
      read: (context) => {
        const ctx = asCtx(context);
        return ctx.autofill ?? ctx.inputValue;
      },
    },
    highlightedValue: { read: (context) => asCtx(context).highlightedValue },
    highlightedItem: {
      read: (context, _state, props) => {
        const ctx = asCtx(context);
        if (ctx.highlightedValue === null) return null;
        return rowsOf(props).find((row) => row.value === ctx.highlightedValue) ?? null;
      },
    },
    value: { read: (context) => [...asCtx(context).value] },
    valueAsString: {
      read: (context) => {
        const ctx = asCtx(context);
        return ctx.value.map((value) => ctx.labels[value]).filter((label) => label !== undefined).join(", ");
      },
    },
    hasSelectedItems: { read: (context) => asCtx(context).value.length > 0 },
    selectedItems: {
      read: (context, _state, props) => {
        const ctx = asCtx(context);
        const rows = rowsOf(props);
        return ctx.value
          .map((value) => rows.find((row) => row.value === value))
          .filter((row): row is ComboboxRow => row !== undefined);
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
      call: (_context, _state, args) => (args[0] as ComboboxBlock).rows,
    },
    getItemState: {
      call: (context, _state, args, props) => {
        const ctx = asCtx(context);
        const row = args[0] as ComboboxRow;
        return {
          value: row.value,
          disabled: (props["disabled"] as boolean) === true || row.disabled,
          highlighted: ctx.highlightedValue === row.value,
          selected: ctx.value.includes(row.value),
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
    "input-value-change": {
      prop: "onInputValueChange",
      watch: (context) => [asCtx(context).inputValue],
      detail: (watched, event) => ({
        inputValue: watched[0] as string,
        reason: (event !== undefined ? INPUT_REASON[event.type] : undefined) ?? "script",
      }),
    },
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [isOpenPhase(state)],
      detail: (watched, event, _props, context) => ({
        open: watched[0] as boolean,
        reason: (event !== undefined ? OPEN_REASON[event.type] : undefined) ?? "script",
        value: [...((context as Record<string, unknown> | undefined)?.["value"] as string[] ?? [])],
      }),
    },
    select: {
      prop: "onSelect",
      watch: (context) => [...asCtx(context).value],
      detail: (watched) => ({ value: [...watched] as string[], itemValue: "" }),
      select: (event, before, after) => {
        const beforeCtx = before as unknown as Ctx;
        const afterCtx = after as unknown as Ctx;
        let outcome: string[] | null = null;
        let itemValue = "";
        if (event.type === "ITEM.SELECT" || event.type === "ITEM.CLICK") {
          outcome = pickOutcome(beforeCtx, (event as Record<string, string>)["value"] as string);
          itemValue = (event as Record<string, string>)["value"] as string;
        } else if (event.type === "INPUT.ENTER") {
          const highlighted = beforeCtx.highlightedValue;
          if (highlighted === null || !beforeCtx.order.includes(highlighted)) return null;
          outcome = pickOutcome(beforeCtx, highlighted);
          itemValue = highlighted;
        }
        // A guard the machine refused reports nothing.
        if (outcome === null || !sameKeys(outcome, afterCtx.value)) return null;
        return { value: [...outcome], itemValue };
      },
    },
  },
};

export const combobox = defineComponent<ComboboxContext, ComboboxEvent, ComboboxApi>(def);
