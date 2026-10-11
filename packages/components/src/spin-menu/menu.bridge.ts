import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotMenu,
  type MenuEntry,
  type MenuFsmApi,
  type MenuFsmConnectProps,
  type MenuService,
  type ReadMenuProps,
} from "./menu.connect.ts";
import { config, implementations, type MenuContext, type MenuEvent } from "./menu.fsm-machine.ts";

export interface MenuOpenChange {
  readonly open: boolean;
}

export interface MenuSelect {
  readonly value: string;
}

export interface MenuHighlightChange {
  readonly highlightedValue: string | null;
}

/** The element's imperative surface, declared in the def's `commands` and typed
 * once here so hosts (and tests) call it without a cast. */
export interface MenuCommands {
  open(): void;
  close(): void;
  setHighlighted(value: string | null): void;
}

type MenuNavigate = (details: { value: string; node: Element; href: string }) => void;

/** JSON transport for the item tree (the grammar has no recursive type), so
 * the shape is validated here rather than trusted at every read. Malformed
 * entries drop out instead of poisoning the row list. */
function parseEntry(raw: unknown): MenuEntry | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const separator = Reflect.get(raw, "separator");
  if (separator === true) return { separator: true };
  const group = Reflect.get(raw, "group");
  const items = Reflect.get(raw, "items");
  if (typeof group === "string" && Array.isArray(items)) return { group, items: parseEntries(items) };
  const value = Reflect.get(raw, "value");
  const label = Reflect.get(raw, "label");
  if (typeof value !== "string" || typeof label !== "string") return undefined;
  const row: {
    value: string;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    checked?: boolean;
    children?: readonly MenuEntry[];
  } = { value, label };
  const shortcut = Reflect.get(raw, "shortcut");
  if (typeof shortcut === "string") row.shortcut = shortcut;
  const disabled = Reflect.get(raw, "disabled");
  if (typeof disabled === "boolean") row.disabled = disabled;
  const checked = Reflect.get(raw, "checked");
  if (typeof checked === "boolean") row.checked = checked;
  const children = Reflect.get(raw, "children");
  if (Array.isArray(children)) row.children = parseEntries(children);
  return row;
}

function parseEntries(list: readonly unknown[]): readonly MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const raw of list) {
    const entry = parseEntry(raw);
    if (entry !== undefined) out.push(entry);
  }
  return out;
}

function parseItems(raw: unknown): readonly MenuEntry[] {
  if (Array.isArray(raw)) return parseEntries(raw);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parseEntries(parsed);
  } catch {
    return [];
  }
  return [];
}

/**
 * The menu bridge: scope values in, machine state out.
 *
 * Three jobs: seed the first state from `defaultOpen`, alternate it from an
 * authored `open`, and publish the connect api through the live-view proxy.
 * The scalars the assigns and the connect read (`isSubmenu`, and the
 * behavioural props) sync through the same owned effect that drives the
 * controlled channel.
 */
export function createMenuFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: MenuFsmApi & MenuCommands; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<MenuContext, MenuEvent>(config, implementations);
  const typeahead = { keys: "", at: 0 };

  let service: FsmService<MenuContext, MenuEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const isSubmenu = (): boolean => props()["submenu"] === true;

  const readCallbacks = (): {
    onOpenChange: ((d: MenuOpenChange) => void) | undefined;
    onSelect: ((d: MenuSelect) => void) | undefined;
    onHighlightChange: ((d: MenuHighlightChange) => void) | undefined;
  } => {
    const p = props();
    return {
      onOpenChange: p["onOpenChange"] as ((d: MenuOpenChange) => void) | undefined,
      onSelect: p["onSelect"] as ((d: MenuSelect) => void) | undefined,
      onHighlightChange: p["onHighlightChange"] as ((d: MenuHighlightChange) => void) | undefined,
    };
  };

  /**
   * The controlled channel, read from the element's attribute. It is the
   * attribute rather than the prop store because the element's `open()`
   * command shares its name with the `open` prop: the generated command
   * binding writes the command into that prop's store slot, which would
   * otherwise masquerade as a host's value. A host's own `open` property
   * write still lands here as a boolean.
   */
  const controlledOpen = (): boolean | undefined => {
    const attribute = root().getAttribute("open");
    if (attribute !== null) return attribute === "true" || attribute === "";
    if (!authored("open")) return undefined;
    const outer: unknown = props()["open"];
    if (typeof outer === "boolean") return outer;
    return undefined;
  };

  const ensureService = (): FsmService<MenuContext, MenuEvent> => {
    if (service) return service;
    const p = props();
    service = owner.run(() => {
      const svc = interpret(machine).start(p["defaultOpen"] === true ? "open" : "closed");
      svc.state.context.isSubmenu = p["submenu"] === true;
      return svc;
    });
    return service;
  };

  let lastOpen = ensureService().state.value === "open";
  let lastHighlighted = ensureService().state.context.highlightedValue;

  /**
   * Report what moved. Cursors advance only after the callbacks, and both the
   * controlled channel and the machine sends funnel through here — the fork's
   * send is synchronous, so a post-send check would already see the new value.
   */
  const notify = (): void => {
    const svc = ensureService();
    const isOpen = svc.state.value === "open";
    const after = svc.state.context;
    const callbacks = readCallbacks();
    if (isOpen !== lastOpen) {
      lastOpen = isOpen;
      callbacks.onOpenChange?.({ open: isOpen });
    }
    if (after.highlightedValue !== lastHighlighted) {
      lastHighlighted = after.highlightedValue;
      callbacks.onHighlightChange?.({ highlightedValue: after.highlightedValue });
    }
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it reads
   * the live prop signals, so a host write — property or attribute — moves the
   * machine without waiting for a machine event, which is the same path a
   * parent menu takes to open a submenu instance.
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
      if (svc.state.context.isSubmenu !== isSubmenu()) {
        svc.state.context.isSubmenu = isSubmenu();
        moved = true;
      }
      const outer = controlledOpen();
      if (outer !== undefined) {
        const isOpen = svc.state.value === "open";
        if (outer !== isOpen) {
          // Untracked: the service's own send bumps machineTick, and reading
          // that inside this effect would subscribe it to every machine move
          // — each one would then re-impose the authored prop over the menu's
          // own events.
          untrack(() => svc.send({ type: outer ? "CONTROLLED_OPEN" : "CONTROLLED_CLOSE" }));
          moved = true;
        }
      }
      if (moved) notify();
    }),
  );

  const send = (event: MenuEvent): void => {
    const svc = ensureService();
    svc.state.context.isSubmenu = isSubmenu();
    svc.send(event);
    if (event.type === "ITEM_CLICK") readCallbacks().onSelect?.({ value: event.value });
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches against. */
  const serviceApi: MenuService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get open() {
      return ensureService().state.value === "open";
    },
  };

  /**
   * The item tree, memoized by the text the host wrote.
   *
   * The connect keys its block structure on this array's identity, and a
   * binding reads the api on every machine move: a fresh parse per read would
   * look like a new item tree and re-render every row. Only the JSON text
   * memoizes — a host that hands over a live array still parses fresh, so a
   * mutation in place is seen.
   */
  let itemsText: string | undefined;
  let itemsParsed: readonly MenuEntry[] = [];
  const getItems = (): readonly MenuEntry[] => {
    const raw = props()["items"];
    if (typeof raw !== "string") return parseItems(raw);
    if (raw !== itemsText) {
      itemsText = raw;
      itemsParsed = parseItems(raw);
    }
    return itemsParsed;
  };

  /** The behavioural props, read per connect call rather than snapshotted: the
   * connect is long-lived, so a host write has to reach the handlers it holds. */
  const readConnectProps: ReadMenuProps = (): MenuFsmConnectProps => {
    const p = props();
    const placement = p["placement"];
    const label = p["label"];
    const navigate = p["navigate"];
    return {
      closeOnSelect: p["closeOnSelect"] !== false,
      loopFocus: p["loopFocus"] === true,
      composite: p["composite"] !== false,
      typeahead: p["typeahead"] !== false,
      placement: typeof placement === "string" && placement.length > 0 ? placement : "bottom-start",
      isSubmenu: p["submenu"] === true,
      label: typeof label === "string" && label.length > 0 ? label : "Menu",
      navigate: typeof navigate === "function" ? (navigate as MenuNavigate) : undefined,
    };
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state, and its row handlers are cached against the rows
   * themselves. Rebuilding it per move is what made each read hand out a fresh
   * item tree, and the `for` directive replaced the row nodes on every
   * highlight change. */
  let menuConnect: MenuFsmApi | undefined;
  const ensureConnect = (): MenuFsmApi => {
    menuConnect ??= connectRobotMenu(
      serviceApi,
      readConnectProps,
      getItems,
      id,
      send as (event: { type: string } & Record<string, unknown>) => void,
      root,
      typeahead,
    );
    return menuConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  // Imperative commands resolve INSIDE the trap: assigning onto a live-view
  // proxy is shadowed by its own get trap and the host would call undefined.
  const commands = {
    open: (): void => send({ type: "OPEN" }),
    close: (): void => send({ type: "CLOSE" }),
    setHighlighted: (value: string | null): void => send({ type: "HIGHLIGHT", value }),
  };

  const api = new Proxy({} as MenuFsmApi & MenuCommands, {
    get: (_target, key) =>
      key in commands ? Reflect.get(commands, key) : Reflect.get(connected(), key),
    has: (_target, key) => key in commands || Reflect.has(connected(), key),
    ownKeys: () => [...new Set([...Reflect.ownKeys(connected()), ...Object.keys(commands)])],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) {
        return { configurable: true, enumerable: true, value: Reflect.get(commands, key) };
      }
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
