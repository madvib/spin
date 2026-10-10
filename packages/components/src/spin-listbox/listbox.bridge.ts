import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotListbox,
  type ListboxFsmApi,
  type ListboxFsmConnectProps,
  type ListboxItem,
  type ListboxRow,
  type ListboxService,
  type ReadListboxProps,
} from "./listbox.connect.ts";
import { config, implementations, type ListboxContext, type ListboxEvent } from "./listbox.machine.ts";

export interface ListboxValueChange {
  readonly value: string[];
  readonly items: readonly ListboxRow[];
}

export interface ListboxHighlightChange {
  readonly highlightedValue: string | null;
  readonly highlightedIndex: number;
}

export interface ListboxSelect {
  readonly value: string;
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

/**
 * The listbox bridge: scope values in, machine state out.
 *
 * Four jobs: normalize the collection and keep the machine's `order` in step
 * with it, seed the first state from `default*`, alternate it from an
 * authored `value`/`highlightedValue`, and publish the connect api through
 * the live-view proxy.
 *
 * The controlled channel is the authored-prop predicate (`@@authored`) — a
 * coerced default is never a write, which is the `value` vs `defaultValue`
 * distinction Zag gets from its bindables and the scope grammar cannot make
 * on its own.
 */
export function createListboxFsmBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: ListboxFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<ListboxContext, ListboxEvent>(config, implementations);

  let service: FsmService<ListboxContext, ListboxEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  /**
   * The collection, memoized on the prop's identity. The connect keys its
   * block structure on this array, so a fresh parse per read would look like
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

  /** The scalars the assigns read, synced from scope. */
  const readContextProps = (): Pick<
    ListboxContext,
    "selectionMode" | "deselectable" | "selectOnHighlight"
  > => {
    const p = props();
    const mode = p["selectionMode"];
    return {
      selectionMode: mode === "multiple" || mode === "extended" ? mode : "single",
      deselectable: p["deselectable"] !== false,
      selectOnHighlight: p["selectOnHighlight"] === true,
    };
  };

  const readConnectProps: ReadListboxProps = (): ListboxFsmConnectProps => {
    const p = props();
    const columnCount = typeof p["columnCount"] === "number" ? Math.max(1, Math.trunc(p["columnCount"])) : 1;
    return {
      ...readContextProps(),
      orientation: p["orientation"] === "horizontal" ? "horizontal" : "vertical",
      columnCount,
      disabled: p["disabled"] === true,
      loopFocus: p["loopFocus"] === true,
      typeahead: p["typeahead"] !== false,
      highlightOnHover: p["highlightOnHover"] !== false,
      disallowSelectAll: p["disallowSelectAll"] === true,
      deselectable: p["deselectable"] !== false,
    };
  };

  const ensureService = (): FsmService<ListboxContext, ListboxEvent> => {
    if (service) return service;
    const p = props();
    const highlight = p["defaultHighlightedValue"];
    service = owner.run(() => {
      const svc = interpret(machine).start();
      Object.assign(svc.state.context, readContextProps(), {
        order: order(),
        value: parseKeys(p["defaultValue"]),
        highlightedValue:
          typeof highlight === "string" && highlight.length > 0 ? highlight : null,
      });
      return svc;
    });
    return service;
  };

  /**
   * Report what moved. The cursors advance only after the callbacks: the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  let lastValue = ensureService().state.context.value;
  let lastHighlighted = ensureService().state.context.highlightedValue;

  const notify = (): void => {
    const svc = ensureService();
    const after = svc.state.context;
    const callbacks = readCallbacks();
    if (!sameKeys(lastValue, after.value)) {
      lastValue = after.value;
      callbacks.onValueChange?.({
        value: [...after.value],
        items: after.value.map(rowByValue).filter((row) => row !== undefined),
      });
    }
    if (lastHighlighted !== after.highlightedValue) {
      lastHighlighted = after.highlightedValue;
      callbacks.onHighlightChange?.({
        highlightedValue: after.highlightedValue,
        highlightedIndex:
          after.highlightedValue === null
            ? -1
            : rows().findIndex((row) => row.value === after.highlightedValue),
      });
    }
  };

  /**
   * Zag's `invokeOnSelect`: one `select` per value the move ADDED, in the
   * order the machine holds them. The diff is against the value before the
   * send, so a controlled alternation never double-reports.
   */
  const reportSelects = (before: readonly string[]): void => {
    const onSelect = readCallbacks().onSelect;
    if (onSelect === undefined) return;
    for (const value of ensureService().state.context.value) {
      if (!before.includes(value)) onSelect({ value });
    }
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it
   * reads the live prop signals, so a host write — property or attribute —
   * moves the machine without waiting for a machine event.
   *
   * It writes no tick of its own: a tick read here would be a dependency, and
   * every later send would re-run this effect and re-impose the authored prop
   * over the machine's own move. The send inside a move reports itself through
   * `machineTick`, which is what wakes the bindings.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const next = readContextProps();
      if (svc.state.context.selectionMode !== next.selectionMode) {
        svc.state.context.selectionMode = next.selectionMode;
        moved = true;
      }
      if (svc.state.context.deselectable !== next.deselectable) {
        svc.state.context.deselectable = next.deselectable;
        moved = true;
      }
      if (svc.state.context.selectOnHighlight !== next.selectOnHighlight) {
        svc.state.context.selectOnHighlight = next.selectOnHighlight;
        moved = true;
      }
      if (!sameKeys(svc.state.context.order, order())) {
        svc.state.context.order = order();
        moved = true;
        // A vanished item cannot stay highlighted: Zag drops a highlight the
        // new collection no longer resolves.
        const highlight = svc.state.context.highlightedValue;
        if (highlight !== null && !svc.state.context.order.includes(highlight)) {
          svc.state.context.highlightedValue = null;
        }
      }
      if (authored("value")) {
        const outer = parseKeys(props()["value"]);
        if (!sameKeys(svc.state.context.value, outer)) {
          untrack(() => svc.send({ type: "VALUE.SET", value: outer }));
          moved = true;
        }
      }
      if (authored("highlightedValue")) {
        const outer = props()["highlightedValue"];
        const next = typeof outer === "string" && outer.length > 0 ? outer : null;
        if (svc.state.context.highlightedValue !== next) {
          untrack(() => svc.send({ type: "HIGHLIGHTED_VALUE.SET", value: next }));
          moved = true;
        }
      }
      if (moved) notify();
    }),
  );

  const send = (event: ListboxEvent): void => {
    const svc = ensureService();
    const before = [...svc.state.context.value];
    Object.assign(svc.state.context, readContextProps(), { order: order() });
    svc.send(event);
    reportSelects(before);
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches against. */
  const serviceApi: ListboxService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get focused() {
      return ensureService().state.value === "focused";
    },
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state, and its row handlers are cached against the rows
   * themselves. Rebuilding it per move is what made each read hand out a
   * fresh item tree, and the `for` directive replaced the row nodes on every
   * highlight change. */
  let listboxConnect: ListboxFsmApi | undefined;
  const ensureConnect = (): ListboxFsmApi => {
    listboxConnect ??= connectRobotListbox(serviceApi, readConnectProps, rows, id);
    return listboxConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as ListboxFsmApi, {
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
