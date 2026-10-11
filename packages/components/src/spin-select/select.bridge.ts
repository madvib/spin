import {
  computed,
  effect,
  machineTick,
  scope,
  signal,
  untrack,
} from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type SelectContext,
  type SelectEvent,
} from "./select.machine.ts";
import {
  connectSelect,
  type ReadSelectProps,
  type SelectApi,
  type SelectConnectProps,
  type SelectRow,
  type SelectService,
} from "./select.connect.ts";

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

export interface SelectCallbacks {
  readonly onValueChange: ((details: SelectValueChange) => void) | undefined;
  readonly onHighlightChange:
    | ((details: SelectHighlightChange) => void)
    | undefined;
  readonly onOpenChange: ((details: SelectOpenChange) => void) | undefined;
  readonly onSelect: ((details: SelectSelect) => void) | undefined;
}

/** Keys travel the prop channel comma-joined: the grammar types a set either
 * as `string[]` (whose default coercion produces `["[]"]` for `= []`) or as
 * JSON, neither of which survives a framework's string attribute. */
const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string");
  }
  if (typeof raw !== "string") return [];
  return raw.split(",").map((part) => part.trim()).filter((part) =>
    part.length > 0
  );
};

/** The scope grammar's object-array type carries the fields the host typed;
 * anything else arriving on the prop channel is treated as no items. */
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

/** A text prop, or the empty string when the host wrote nothing usable. */
const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

/** A non-empty text prop, or null — the shape `highlightedValue` travels in. */
const nullableProp = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

/** Why the panel opened or closed. Zag names the gestures; ours names the
 * event that produced the move, because the prop channel carries no `src`. */
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

/**
 * The select bridge: scope values in, machine state out.
 *
 * Five jobs. Normalize the collection and keep the machine's `order` and
 * `labels` in step with it; seed the first state from `default*`; alternate
 * the three authored channels (`value`, `highlightedValue`, `open`); report
 * what moved; and publish the connect api through the live-view proxy.
 *
 * The controlled channel is the authored-prop predicate (`@@authored`) — a
 * coerced default is never a write, which is the `value` vs `defaultValue`
 * distinction Zag gets from its bindables and the scope grammar cannot make
 * on its own. Each channel remembers what it last imposed rather than
 * comparing against the context, so a machine move of its own is never
 * undone by an unrelated prop change.
 */
export function createSelectBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: SelectApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every select on the page would otherwise share a
  // single selection.
  const machine = createMachine<SelectContext, SelectEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<SelectContext, SelectEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function"
      ? (predicate as (n: string) => boolean)(name)
      : false;
  };

  /**
   * The collection, memoized on the prop's identity. The connect keys its
   * row memos on this array, so a fresh parse per read would look like a new
   * item tree and re-render every row.
   */
  let itemsSource: unknown;
  let itemsRows: readonly SelectRow[] = [];
  const rows = (): readonly SelectRow[] => {
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

  const rowByValue = (value: string): SelectRow | undefined =>
    rows().find((row) => row.value === value);

  const readCallbacks = (): SelectCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: SelectValueChange) => void>("onValueChange"),
      onHighlightChange: pick<(d: SelectHighlightChange) => void>(
        "onHighlightChange",
      ),
      onOpenChange: pick<(d: SelectOpenChange) => void>("onOpenChange"),
      onSelect: pick<(d: SelectSelect) => void>("onSelect"),
    };
  };

  /** The scalars the assigns and the conds read, synced from scope. */
  const readContextProps = (): Pick<
    SelectContext,
    "multiple" | "closeOnSelect" | "loopFocus"
  > => {
    const p = props();
    const multiple = p["multiple"] === true;
    return {
      multiple,
      // Zag's `closeOnSelect: !props.multiple` — a coerced default is not a
      // write, so an explicit `closeOnSelect` is the only thing that
      // overrides the mode's own answer.
      closeOnSelect: authored("closeOnSelect")
        ? p["closeOnSelect"] === true
        : !multiple,
      loopFocus: p["loopFocus"] === true,
    };
  };

  const readConnectProps: ReadSelectProps = (): SelectConnectProps => {
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
      multiple: p["multiple"] === true,
      closeOnSelect: authored("closeOnSelect")
        ? p["closeOnSelect"] === true
        : p["multiple"] !== true,
      loopFocus: p["loopFocus"] === true,
      name: textProp(p["name"]),
      form: textProp(p["form"]),
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      placement: placement.length > 0 ? placement : "bottom-start",
      label: label("label", "Select"),
      placeholder: label("placeholder", "Select an option"),
      clearTriggerLabel: label("clearTriggerLabel", "Clear value"),
    };
  };

  const ensureService = (): Service<SelectContext, SelectEvent> => {
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
        p["open"] === true || p["defaultOpen"] === true ? "open" : "idle",
      );
      Object.assign(svc.state.context, scalars, {
        value,
        order: order(),
        labels: labels(),
        highlightedValue: highlighted,
      });
      return svc;
    });
    return service;
  };

  /** What each controlled channel last imposed, seeded from the same place
   * the machine was, so a host that authors the seeded value writes nothing. */
  const initial = ensureService().state.context;
  let lastValue = [...initial.value];
  let lastHighlighted = initial.highlightedValue;
  let lastOpen = ensureService().state.value === "open";

  let selectConnect: SelectApi | undefined;
  const ensureConnect = (): SelectApi => {
    selectConnect ??= connectSelect(
      serviceApi,
      readConnectProps,
      rows,
      id,
      send,
    );
    return selectConnect;
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
    if (lastHighlighted !== after.highlightedValue) {
      lastHighlighted = after.highlightedValue;
      callbacks.onHighlightChange?.({
        highlightedValue: after.highlightedValue,
        highlightedItem: after.highlightedValue === null
          ? null
          : rowByValue(after.highlightedValue) ?? null,
      });
    }
    void reason;
  };

  /** Zag's `invokeOnOpen`/`invokeOnClose`: the panel's open-ness, once per
   * change, with the reason the gesture gives it. */
  const notifyOpen = (reason: string): void => {
    const openNow = ensureService().state.value === "open";
    if (openNow === lastOpen) return;
    lastOpen = openNow;
    readCallbacks().onOpenChange?.({ open: openNow, reason });
  };

  /** Zag's `invokeOnSelect`: the value the pick landed on and the item it
   * was named by. A toggle-off reports as much as a pick, because the host
   * asked about the move, not the direction. */
  const reportSelect = (event: SelectEvent, before: SelectContext): void => {
    const onSelect = readCallbacks().onSelect;
    if (onSelect === undefined) return;
    let outcome: readonly string[] | null = null;
    let itemValue = "";
    if (event.type === "ITEM.SELECT") {
      itemValue = event.value;
      outcome = before.multiple
        ? before.value.includes(event.value)
          ? before.value.filter((value) => value !== event.value)
          : [...before.value, event.value]
        : [event.value];
    } else if (event.type === "ITEM.CLICK") {
      const highlighted = before.highlightedValue;
      if (highlighted === null || !before.order.includes(highlighted)) return;
      itemValue = highlighted;
      outcome = before.multiple
        ? before.value.includes(highlighted)
          ? before.value.filter((value) => value !== highlighted)
          : [...before.value, highlighted]
        : [highlighted];
    }
    // A guard the machine refused reports nothing.
    if (
      outcome === null ||
      !sameKeys(outcome, ensureService().state.context.value)
    ) return;
    onSelect({ value: [...outcome], itemValue });
  };

  const send = (event: SelectEvent): void => {
    const svc = ensureService();
    const before: SelectContext = { ...svc.state.context };
    // The scalars are re-read on every send so an assign or a cond never
    // reads a stale one.
    Object.assign(svc.state.context, readContextProps(), {
      order: order(),
      labels: labels(),
    });
    svc.send(event);
    reportSelect(event, before);
    notify("script");
    notifyOpen(OPEN_REASON[event.type] ?? "script");
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: SelectService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
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
      if (svc.state.context.loopFocus !== next.loopFocus) {
        svc.state.context.loopFocus = next.loopFocus;
        moved = true;
      }
      if (!sameKeys(svc.state.context.order, order())) {
        svc.state.context.order = order();
        svc.state.context.labels = labels();
        moved = true;
        // Zag's `watch` on the collection: a stranded selection or highlight
        // is dropped by the machine's own sync event.
        untrack(() => svc.send({ type: "SELECTED_ITEMS.SYNC" }));
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
      if (authored("highlightedValue")) {
        const outer = nullableProp(props()["highlightedValue"]);
        if (lastHighlighted !== outer) {
          untrack(() =>
            svc.send(
              outer === null
                ? { type: "HIGHLIGHTED_VALUE.CLEAR" }
                : { type: "HIGHLIGHTED_VALUE.SET", value: outer },
            )
          );
          moved = true;
        }
      }
      // A controlled `open` is a PLATFORM concern: the host writes the
      // property, and the machine answers with the CONTROLLED pair, which is
      // how it distinguishes a host write from its own gesture.
      if (authored("open")) {
        const outer = props()["open"] === true;
        if (lastOpen !== outer) {
          untrack(() =>
            svc.send(
              outer
                ? { type: "CONTROLLED.OPEN" }
                : { type: "CONTROLLED.CLOSE" },
            )
          );
          moved = true;
        }
      }
      if (moved) {
        notify("script");
        notifyOpen("script");
      }
    })
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as SelectApi, {
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
