import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  stringifyValues,
  type ListboxContext,
  type ListboxEvent,
} from "./listbox.machine.ts";
import {
  connectRobotListbox,
  type ListboxApi,
  type ListboxConnectProps,
  type ListboxItem,
  type ListboxRow,
  type ListboxService,
  type ReadListboxProps,
} from "./listbox.connect.ts";

export interface ListboxValueChange {
  readonly value: string[];
  readonly items: readonly ListboxRow[];
}

export interface ListboxHighlightChange {
  readonly highlightedValue: string | null;
  readonly highlightedItem: ListboxRow | null;
}

export interface ListboxSelect {
  readonly value: string[];
  readonly itemValue: string;
}

export interface ListboxCallbacks {
  readonly onValueChange: ((details: ListboxValueChange) => void) | undefined;
  readonly onHighlightChange: ((details: ListboxHighlightChange) => void) | undefined;
  readonly onSelect: ((details: ListboxSelect) => void) | undefined;
}

/** Keys travel the prop channel comma-joined: the grammar types a set either
 * as `string[]` (whose default coercion produces `["[]"]` for `= []`) or as
 * JSON, neither of which survives a framework's string attribute. */
const parseKeys = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === "string");
  if (typeof raw !== "string") return [];
  return raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
};

const toRow = (item: ListboxItem): ListboxRow | undefined => {
  if (typeof item.value !== "string" || item.value.length === 0) return undefined;
  return {
    value: item.value,
    label: typeof item.label === "string" && item.label.length > 0 ? item.label : item.value,
    disabled: item.disabled === true,
    group: typeof item.group === "string" ? item.group : "",
    index: 0,
  };
};

const toRows = (items: readonly ListboxItem[]): readonly ListboxRow[] => {
  const rows: ListboxRow[] = [];
  for (const item of items) {
    const row = toRow(item);
    if (row !== undefined) rows.push(row);
  }
  return rows.map((row, index) => ({ ...row, index }));
};

/** The scope grammar's object-array type carries the fields the host typed;
 * anything else arriving on the prop channel is treated as no items. */
const parseItems = (raw: unknown): readonly ListboxRow[] => {
  if (!Array.isArray(raw)) return [];
  return toRows(raw.filter((item): item is ListboxItem => typeof item === "object" && item !== null));
};

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

const nullableProp = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

/**
 * The listbox bridge: scope values in, machine state out.
 *
 * Four jobs. Normalize the collection and keep the machine's `order` and
 * `labels` in step with it; seed the first state from `default*`; alternate
 * the two authored channels (`value`, `highlightedValue`); report what
 * moved; and publish the connect api through the live-view proxy.
 *
 * The controlled channel is the authored-prop predicate (`@@authored`) — a
 * coerced default is never a write, which is the `value` vs `defaultValue`
 * distinction Zag gets from its bindables and the scope grammar cannot make
 * on its own. Each channel remembers what it last imposed rather than
 * comparing against the context, so a machine move of its own is never
 * undone by an unrelated prop change.
 */
export function createListboxBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: ListboxApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every listbox on the page would otherwise share a
  // single selection.
  const machine = createMachine<ListboxContext, ListboxEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<ListboxContext, ListboxEvent> | undefined;

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
  let itemsRows: readonly ListboxRow[] = [];
  const rows = (): readonly ListboxRow[] => {
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

  const rowByValue = (value: string): ListboxRow | undefined =>
    rows().find((row) => row.value === value);

  const readCallbacks = (): ListboxCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: ListboxValueChange) => void>("onValueChange"),
      onHighlightChange: pick<(d: ListboxHighlightChange) => void>("onHighlightChange"),
      onSelect: pick<(d: ListboxSelect) => void>("onSelect"),
    };
  };

  /** The scalars the assigns and the conds read, synced from scope. */
  const readContextProps = (): Pick<
    ListboxContext,
    "multiple" | "selectOnHighlight" | "loopFocus" | "selectionBehavior"
  > => {
    const p = props();
    const selection = p["selectionBehavior"];
    const multiple = p["multiple"] === true;
    return {
      multiple,
      selectOnHighlight: p["selectOnHighlight"] === true,
      loopFocus: p["loopFocus"] !== false,
      selectionBehavior:
        selection === "preserve" || selection === "clear"
          ? selection
          : multiple
            ? "clear"
            : "replace",
    };
  };

  const readConnectProps: ReadListboxProps = (): ListboxConnectProps => {
    const p = props();
    return {
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      composite: p["composite"] !== false,
      loopFocus: p["loopFocus"] !== false,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      orientation: p["orientation"] === "horizontal" ? "horizontal" : "vertical",
      name: textProp(p["name"]),
      form: textProp(p["form"]),
    };
  };

  const ensureService = (): Service<ListboxContext, ListboxEvent> => {
    if (service) return service;
    const p = props();
    const scalars = readContextProps();
    const value = parseKeys(authored("value") ? p["value"] : p["defaultValue"]);
    const highlighted = authored("highlightedValue")
      ? nullableProp(p["highlightedValue"])
      : nullableProp(p["defaultHighlightedValue"]);
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
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

  let listboxConnect: ListboxApi | undefined;
  const ensureConnect = (): ListboxApi => {
    listboxConnect ??= connectRobotListbox(serviceApi, readConnectProps, rows, id);
    return listboxConnect;
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
        highlightedItem:
          after.highlightedValue === null ? null : rowByValue(after.highlightedValue) ?? null,
      });
    }
    void reason;
  };

  /**
   * Zag's `invokeOnSelect`: the value the pick landed on and the item it was
   * named by. It fires for a toggle-off as much as a pick, because the host
   * asked about the move, not the direction.
   */
  const reportSelect = (event: ListboxEvent, before: ListboxContext): void => {
    const onSelect = readCallbacks().onSelect;
    if (onSelect === undefined) return;
    if (event.type !== "ITEM.CLICK" && event.type !== "ITEM.SELECT") return;
    const after = ensureService().state.context.value;
    if (sameKeys(before.value, after)) return;
    onSelect({ value: [...after], itemValue: event.value });
  };

  const send = (event: ListboxEvent): void => {
    const svc = ensureService();
    const before: ListboxContext = { ...svc.state.context };
    // The scalars are re-read on every send so an assign or a cond never
    // reads a stale one.
    Object.assign(svc.state.context, readContextProps(), {
      order: order(),
      labels: labels(),
    });
    svc.send(event);
    reportSelect(event, before);
    notify("script");
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: ListboxService = {
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
      if (svc.state.context.selectOnHighlight !== next.selectOnHighlight) {
        svc.state.context.selectOnHighlight = next.selectOnHighlight;
        moved = true;
      }
      if (svc.state.context.loopFocus !== next.loopFocus) {
        svc.state.context.loopFocus = next.loopFocus;
        moved = true;
      }
      if (svc.state.context.selectionBehavior !== next.selectionBehavior) {
        svc.state.context.selectionBehavior = next.selectionBehavior;
        moved = true;
      }
      if (!sameKeys(svc.state.context.order, order())) {
        svc.state.context.order = order();
        svc.state.context.labels = labels();
        moved = true;
        untrack(() => svc.send({ type: "SELECTED_ITEMS.SYNC" }));
      }
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
            ),
          );
          moved = true;
        }
      }
      if (moved) notify("script");
    }),
  );

  void stringifyValues;

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as ListboxApi, {
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
