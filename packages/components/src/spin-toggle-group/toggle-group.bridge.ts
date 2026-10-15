import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type ToggleGroupContext,
  type ToggleGroupEvent,
  type ToggleGroupItem,
  type ToggleGroupValueChange,
} from "./toggle-group.machine.ts";
import {
  connectToggleGroup,
  type ToggleGroupApi,
  type ToggleGroupConnectProps,
  type ToggleGroupService,
} from "./toggle-group.connect.ts";

/**
 * The toggle-group bridge: scope values in, machine state out.
 *
 * Items arrive as JSON (the scope grammar has no object-array transport —
 * see the select precedent). Seed the value from `defaultValue`;
 * alternate the one authored channel (`value`) against a remembered
 * shadow so a machine toggle of its own is never undone by an unrelated
 * prop change. Report what moved through `value-change`. The callbacks
 * live on the props surface — the def maps them to CustomEvents.
 */

export interface ToggleGroupCallbacks {
  readonly onValueChange: ((details: ToggleGroupValueChange) => void) | undefined;
}

const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

/** Items travel the prop channel as JSON text: value plus label, with an
 * optional disabled flag. Anything else arriving is no items. */
function parseItems(raw: unknown): ToggleGroupItem[] {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return [];
  const items: ToggleGroupItem[] = [];
  for (const entry of list) {
    if (typeof entry === "object" && entry !== null) {
      const record = entry as Record<string, unknown>;
      const value = record["value"];
      if (typeof value !== "string" || value.length === 0) continue;
      const label = record["label"];
      items.push({
        value,
        label: typeof label === "string" && label.length > 0 ? label : value,
        ...(record["disabled"] === true ? { disabled: true as const } : {}),
      });
    } else if (typeof entry === "string" && entry.length > 0) {
      items.push({ value: entry, label: entry });
    }
  }
  return items;
}

/** Values travel the prop channel as JSON text (see the slider bridge:
 * the grammar coerces `= []` to `["[]"]`). */
function valuesProp(raw: unknown): string[] | null {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return null;
  return list.every((item) => typeof item === "string") ? [...(list as string[])] : null;
}

const sameValues = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export function createToggleGroupBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: ToggleGroupApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every group on the page would otherwise share one
  // selection.
  const machine = createMachine<ToggleGroupContext, ToggleGroupEvent>(
    { ...config, context: { ...config.context, value: [...config.context.value] } },
    implementations,
  );

  let service: Service<ToggleGroupContext, ToggleGroupEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): ToggleGroupCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: ToggleGroupValueChange) => void>("onValueChange"),
    };
  };

  const readConnectProps = (): ToggleGroupConnectProps => {
    const p = props();
    return {
      disabled: p["disabled"] === true,
      multiple: p["multiple"] === true,
      rovingFocus: p["rovingFocus"] !== false,
      loopFocus: p["loopFocus"] !== false,
      orientation: p["orientation"] === "vertical" ? "vertical" : "horizontal",
      deselectable: p["deselectable"] !== false,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      label: textProp(p["label"]),
    };
  };

  /** Items memoized on the prop's identity: the parse builds fresh
   * objects, and a fresh parse per read would churn the row memos. */
  let itemsSource: unknown;
  let itemsCache: ToggleGroupItem[] = [];
  const readItems = (): readonly ToggleGroupItem[] => {
    const raw = props()["items"];
    if (raw !== itemsSource) {
      itemsSource = raw;
      itemsCache = parseItems(raw);
    }
    return itemsCache;
  };

  const ensureService = (): Service<ToggleGroupContext, ToggleGroupEvent> => {
    if (service) return service;
    const p = props();
    const connect = readConnectProps();
    const seeded = valuesProp(authored("value") ? p["value"] : p["defaultValue"]) ?? [];
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, {
        value: seeded,
        multiple: connect.multiple,
        deselectable: connect.deselectable,
        rovingFocus: connect.rovingFocus,
        loopFocus: connect.loopFocus,
        orientation: connect.orientation,
        disabled: connect.disabled,
      });
      return svc;
    });
    return service;
  };

  /** What the value channel last imposed, seeded from the same place the
   * machine was, so a host that authors the seeded value writes nothing. */
  let lastValue: string[] = [...ensureService().state.context.value];

  let groupConnect: ToggleGroupApi | undefined;
  const ensureConnect = (): ToggleGroupApi => {
    groupConnect ??= connectToggleGroup(serviceApi, readConnectProps, readItems, id);
    return groupConnect;
  };

  /**
   * Report what moved. The cursor advances only after the callback: the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  const notify = (): void => {
    const after = ensureService().state.context;
    if (!sameValues(lastValue, after.value)) {
      lastValue = [...after.value];
      readCallbacks().onValueChange?.({ value: [...after.value] });
    }
  };

  const send = (event: ToggleGroupEvent): void => {
    const svc = ensureService();
    const next = svc.state.context;
    const connect = readConnectProps();
    if (next.multiple !== connect.multiple) next.multiple = connect.multiple;
    if (next.deselectable !== connect.deselectable) next.deselectable = connect.deselectable;
    if (next.rovingFocus !== connect.rovingFocus) next.rovingFocus = connect.rovingFocus;
    if (next.loopFocus !== connect.loopFocus) next.loopFocus = connect.loopFocus;
    if (next.orientation !== connect.orientation) next.orientation = connect.orientation;
    if (next.disabled !== connect.disabled) next.disabled = connect.disabled;
    svc.send(event);
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: ToggleGroupService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state.value;
    },
  };

  /**
   * Controlled alternation in one owned effect: it reads the live prop
   * signals, so a host write moves the machine without waiting for a
   * machine event.
   *
   * It writes no tick of its own: `svc.send` bumps the machine tick, which
   * is what wakes the bindings, and a tick read here would re-run the
   * effect on every later move and re-impose the authored props over it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      if (authored("value")) {
        const outer = valuesProp(props()["value"]);
        if (outer !== null && !sameValues(lastValue, outer)) {
          untrack(() => svc.send({ type: "VALUE.SET", value: outer }));
          moved = true;
        }
      }
      if (moved) notify();
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as ToggleGroupApi, {
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
