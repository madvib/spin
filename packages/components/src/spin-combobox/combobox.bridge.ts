import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  isOpenPhase,
  pickOutcome,
  stringifyValues,
  type ComboboxContext,
  type ComboboxEvent,
} from "./combobox.machine.ts";
import {
  connectRobotCombobox,
  type ComboboxFsmApi,
  type ComboboxFsmConnectProps,
  type ComboboxItem,
  type ComboboxRow,
  type ComboboxService,
  type ReadComboboxProps,
} from "./combobox.connect.ts";

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

export interface ComboboxCallbacks {
  readonly onValueChange: ((details: ComboboxValueChange) => void) | undefined;
  readonly onHighlightChange: ((details: ComboboxHighlightChange) => void) | undefined;
  readonly onInputValueChange: ((details: ComboboxInputValueChange) => void) | undefined;
  readonly onOpenChange: ((details: ComboboxOpenChange) => void) | undefined;
  readonly onSelect: ((details: ComboboxSelect) => void) | undefined;
}

/** Keys travel the prop channel comma-joined: the grammar types a set either
 * as `string[]` (whose default coercion produces `["[]"]` for `= []`) or as
 * JSON, neither of which survives a framework's string attribute. */
const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === "string");
  if (typeof raw !== "string") return [];
  return raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
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

/** A text prop, or the empty string when the host wrote nothing usable. */
const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

/** A non-empty text prop, or null — the shape `highlightedValue` travels in. */
const nullableProp = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

/**
 * The combobox bridge: scope values in, machine state out.
 *
 * Five jobs. Normalize the collection and keep the machine's `order` and
 * `labels` in step with it; seed the first state from `default*`; alternate
 * the four authored channels (`value`, `inputValue`, `highlightedValue`,
 * `open`); report what moved; and publish the connect api through the
 * live-view proxy.
 *
 * The controlled channel is the authored-prop predicate (`@@authored`) — a
 * coerced default is never a write, which is the `value` vs `defaultValue`
 * distinction Zag gets from its bindables and the scope grammar cannot make
 * on its own. Each channel remembers what it last imposed rather than
 * comparing against the context, so a machine move of its own is never
 * undone by an unrelated prop change.
 */
export function createComboboxFsmBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: ComboboxFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every combobox on the page would otherwise share a
  // single selection.
  const machine = createMachine<ComboboxContext, ComboboxEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: FsmService<ComboboxContext, ComboboxEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  /**
   * The collection, memoized on the prop's identity. The connect keys its
   * group structure on this array, so a fresh parse per read would look like
   * a new item tree and re-render every row.
   */
  let itemsSource: unknown;
  let itemsRows: readonly ComboboxRow[] = [];
  const rows = (): readonly ComboboxRow[] => {
    const raw = props()["items"];
    if (raw !== itemsSource) {
      itemsSource = raw;
      itemsRows = parseItems(raw);
    }
    return itemsRows;
  };

  const order = (): string[] => rows().map((row) => row.value);

  const labels = (): Record<string, string> =>
    Object.fromEntries(rows().map((row) => [row.value, row.label]));

  const rowByValue = (value: string): ComboboxRow | undefined =>
    rows().find((row) => row.value === value);

  const readCallbacks = (): ComboboxCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: ComboboxValueChange) => void>("onValueChange"),
      onHighlightChange: pick<(d: ComboboxHighlightChange) => void>("onHighlightChange"),
      onInputValueChange: pick<(d: ComboboxInputValueChange) => void>("onInputValueChange"),
      onOpenChange: pick<(d: ComboboxOpenChange) => void>("onOpenChange"),
      onSelect: pick<(d: ComboboxSelect) => void>("onSelect"),
    };
  };

  /** The scalars the assigns and the conds read, synced from scope. */
  const readContextProps = (): Pick<
    ComboboxContext,
    "multiple" | "closeOnSelect" | "allowCustomValue" | "inputBehavior" | "selectionBehavior" | "openOnChange"
  > => {
    const p = props();
    const behavior = p["inputBehavior"];
    const selection = p["selectionBehavior"];
    const multiple = p["multiple"] === true;
    return {
      multiple,
      // Zag's `closeOnSelect: !props.multiple` — a coerced default is not a
      // write, so an explicit `closeOnSelect` is the only thing that
      // overrides the mode's own answer.
      closeOnSelect: authored("closeOnSelect") ? p["closeOnSelect"] === true : !multiple,
      allowCustomValue: p["allowCustomValue"] === true,
      inputBehavior: behavior === "autocomplete" || behavior === "autohighlight" ? behavior : "none",
      selectionBehavior:
        selection === "preserve" || selection === "clear"
          ? selection
          : multiple
            ? "clear"
            : "replace",
      openOnChange: p["openOnChange"] !== false,
    };
  };

  const readConnectProps: ReadComboboxProps = (): ComboboxFsmConnectProps => {
    const p = props();
    const label = (name: string, fallback: string): string => {
      const value = textProp(p[name]);
      return value.length > 0 ? value : fallback;
    };
    const placement = textProp(p["placement"]);
    return {
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      composite: p["composite"] !== false,
      loopFocus: p["loopFocus"] === true,
      openOnClick: p["openOnClick"] !== false,
      openOnKeyPress: p["openOnKeyPress"] !== false,
      alwaysSubmitOnEnter: p["alwaysSubmitOnEnter"] === true,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      placement: placement.length > 0 ? placement : "bottom",
      name: textProp(p["name"]),
      form: textProp(p["form"]),
      placeholder: textProp(p["placeholder"]),
      triggerLabel: label("triggerLabel", "Toggle suggestions"),
      clearTriggerLabel: label("clearTriggerLabel", "Clear value"),
    };
  };

  const ensureService = (): FsmService<ComboboxContext, ComboboxEvent> => {
    if (service) return service;
    const p = props();
    const scalars = readContextProps();
    // Zag's bindable seeds: the authored prop wins over the default, and the
    // collection's own order is what the selection's string is built from.
    const value = parseKeys(authored("value") ? p["value"] : p["defaultValue"]);
    const highlighted = authored("highlightedValue")
      ? nullableProp(p["highlightedValue"])
      : nullableProp(p["defaultHighlightedValue"]);
    service = owner.run(() => {
      const svc = interpret(machine).start(
        p["open"] === true || p["defaultOpen"] === true ? "suggesting" : "idle",
      );
      Object.assign(svc.state.context, scalars, {
        value,
        order: order(),
        labels: labels(),
        highlightedValue: highlighted,
      });
      // The seed reads the collection, so it is computed after the order and
      // the labels are in place — an argument list would evaluate it first.
      svc.state.context.inputValue = seedInputValue(
        textProp(p["inputValue"]),
        textProp(p["defaultInputValue"]),
        scalars.selectionBehavior,
        scalars.multiple,
        stringifyValues(svc.state.context, value),
      );
      return svc;
    });
    return service;
  };

  /** What each controlled channel last imposed, seeded from the same place
   * the machine was, so a host that authors the seeded value writes nothing. */
  const initial = ensureService().state.context;
  let lastValue = [...initial.value];
  let lastInput = initial.inputValue;
  let lastHighlighted = initial.highlightedValue;
  let lastOpen = isOpenPhase(ensureService().state.value);

  /** The view's focus, captured when the connect is built: the bridge is what
   * decides the panel opening owes the field its focus. */
  let focusInput = (): void => {};
  let comboboxConnect: ComboboxFsmApi | undefined;
  const ensureConnect = (): ComboboxFsmApi => {
    comboboxConnect ??= connectRobotCombobox(serviceApi, readConnectProps, rows, id);
    focusInput = comboboxConnect.focus;
    return comboboxConnect;
  };

  /**
   * Report what moved. The cursors advance only after the callbacks: the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  const notify = (reason: string): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (!sameKeys(lastValue, after.value)) {
      lastValue = [...after.value];
      callbacks.onValueChange?.({
        value: [...after.value],
        items: after.value.map(rowByValue).filter((row) => row !== undefined),
      });
    }
    if (lastInput !== after.inputValue) {
      lastInput = after.inputValue;
      callbacks.onInputValueChange?.({ inputValue: after.inputValue, reason });
    }
    if (lastHighlighted !== after.highlightedValue) {
      lastHighlighted = after.highlightedValue;
      callbacks.onHighlightChange?.({
        highlightedValue: after.highlightedValue,
        highlightedItem:
          after.highlightedValue === null ? null : rowByValue(after.highlightedValue) ?? null,
      });
    }
  };

  /** Zag's `invokeOnOpen`/`invokeOnClose`: the panel's open-ness, once per
   * change, with the reason the gesture gives it. */
  const notifyOpen = (reason: string): void => {
    const openNow = isOpenPhase(ensureService().state.value);
    if (openNow === lastOpen) return;
    lastOpen = openNow;
    readCallbacks().onOpenChange?.({
      open: openNow,
      reason,
      value: [...ensureService().state.context.value],
    });
  };

  /**
   * Zag's `invokeOnSelect`: the value the pick landed on and the item it was
   * named by. It fires for a toggle-off as much as a pick, because the host
   * asked about the move, not the direction.
   */
  const reportSelect = (event: ComboboxEvent, before: ComboboxContext): void => {
    const onSelect = readCallbacks().onSelect;
    if (onSelect === undefined) return;
    let outcome: string[] | null = null;
    let itemValue = "";
    if (event.type === "ITEM.SELECT" || event.type === "ITEM.CLICK") {
      outcome = pickOutcome(before, event.value);
      itemValue = event.value;
    } else if (event.type === "INPUT.ENTER") {
      const highlighted = before.highlightedValue;
      if (highlighted === null || !before.order.includes(highlighted)) return;
      outcome = pickOutcome(before, highlighted);
      itemValue = highlighted;
    }
    // A guard the machine refused reports nothing.
    if (outcome === null || !sameKeys(outcome, ensureService().state.context.value)) return;
    onSelect({ value: [...outcome], itemValue });
  };

  const send = (event: ComboboxEvent): void => {
    const svc = ensureService();
    const before: ComboboxContext = { ...svc.state.context };
    const wasOpen = isOpenPhase(svc.state.value);
    // The scalars are re-read on every send so an assign or a cond never
    // reads a stale one.
    Object.assign(svc.state.context, readContextProps(), {
      order: order(),
      labels: labels(),
    });
    svc.send(event);
    reportSelect(event, before);
    notify(INPUT_REASON[event.type] ?? "script");
    notifyOpen(OPEN_REASON[event.type] ?? "script");
    // Zag's `open.entry` and `setFinalFocus`: the panel's opening owes the
    // field its focus, and a close the host asked for gives it back.
    const isOpenNow = isOpenPhase(svc.state.value);
    if (wasOpen !== isOpenNow && (isOpenNow || event.type === "CLOSE")) focusInput();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: ComboboxService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get phase() {
      return ensureService().state.value;
    },
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it
   * reads the live prop signals, so a host write — property or attribute —
   * moves the machine without waiting for a machine event.
   *
   * It writes no tick of its own: `svc.send` bumps the machine tick, which is
   * what wakes the bindings, and a tick read here would re-run the effect on
   * every later move and re-impose the authored props over it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const next = readContextProps();
      if (svc.state.context.multiple !== next.multiple) {
        svc.state.context.multiple = next.multiple;
        moved = true;
      }
      if (svc.state.context.closeOnSelect !== next.closeOnSelect) {
        svc.state.context.closeOnSelect = next.closeOnSelect;
        moved = true;
      }
      if (svc.state.context.allowCustomValue !== next.allowCustomValue) {
        svc.state.context.allowCustomValue = next.allowCustomValue;
        moved = true;
      }
      if (svc.state.context.inputBehavior !== next.inputBehavior) {
        svc.state.context.inputBehavior = next.inputBehavior;
        moved = true;
      }
      if (svc.state.context.selectionBehavior !== next.selectionBehavior) {
        svc.state.context.selectionBehavior = next.selectionBehavior;
        moved = true;
      }
      if (svc.state.context.openOnChange !== next.openOnChange) {
        svc.state.context.openOnChange = next.openOnChange;
        moved = true;
      }
      if (!sameKeys(svc.state.context.order, order())) {
        svc.state.context.order = order();
        svc.state.context.labels = labels();
        moved = true;
        // Zag's `watch` on the collection: an open panel re-homes itself over
        // a collection that changed under it.
        if (isOpenPhase(svc.state.value)) untrack(() => svc.send({ type: "CHILDREN_CHANGE" }));
      }
      // The cursors stay on the pre-write values while the events send: the
      // trailing notify is what reports the move and advances them, the way
      // the bridge's own send does. Pre-advancing would silence the report.
      if (authored("value")) {
        const outer = parseKeys(props()["value"]);
        if (!sameKeys(lastValue, outer)) {
          untrack(() => svc.send({ type: "VALUE.SET", value: outer }));
          moved = true;
        }
      }
      if (authored("inputValue")) {
        const outer = textProp(props()["inputValue"]);
        if (lastInput !== outer) {
          untrack(() => svc.send({ type: "INPUT_VALUE.SET", value: outer }));
          moved = true;
        }
      }
      if (authored("highlightedValue")) {
        const outer = nullableProp(props()["highlightedValue"]);
        if (lastHighlighted !== outer) {
          untrack(() =>
            svc.send(
              outer === null
                ? { type: "HIGHLIGHTED_VALUE.CLEAR" }
                : { type: "HIGHLIGHTED_VALUE.SET", value: outer },
            ),
          );
          moved = true;
        }
      }
      if (authored("open")) {
        const outer = props()["open"] === true;
        if (lastOpen !== outer) {
          untrack(() => svc.send({ type: outer ? "OPEN" : "CLOSE" }));
          moved = true;
          if (outer) ensureConnect().focus();
        }
      }
      if (moved) {
        notify("script");
        notifyOpen("script");
      }
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as ComboboxFsmApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}
