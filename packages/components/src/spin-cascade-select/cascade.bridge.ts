import { effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotCascade,
  itemsAlongPath,
  parseCollection,
  type CascadeFormatValue,
  type CascadeFsmApi,
  type CascadeFsmConnectProps,
  type CascadeNode,
  type CascadeOutsideDetails,
  type CascadeScrollDetails,
} from "./cascade.connect.ts";
import {
  config,
  implementations,
  type CascadeContext,
  type CascadeEvent,
} from "./cascade.machine.ts";

export interface CascadeOpenChange {
  readonly open: boolean;
  readonly value: readonly string[][];
}

export interface CascadeValueChange {
  readonly value: readonly string[][];
  readonly items: readonly (readonly CascadeNode[])[];
}

export interface CascadeHighlightChange {
  readonly highlightedValue: readonly string[];
  readonly highlightedItems: readonly CascadeNode[];
}

/** The element's imperative surface, declared in the def's `commands`. */
export interface CascadeCommands {
  focus(): void;
  setOpen(nextOpen: boolean): void;
  setHighlightValue(value: readonly string[]): void;
  clearHighlightValue(): void;
  setValue(value: readonly string[][]): void;
  selectValue(value: readonly string[]): void;
  clearValue(value?: readonly string[]): void;
}

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const samePaths = (a: readonly string[][], b: readonly string[][]): boolean =>
  a.length === b.length && a.every((path, i) => samePath(path, b[i] ?? []));

const isString = (segment: unknown): segment is string => typeof segment === "string";

/**
 * The value crosses the prop channel as JSON text: the grammar has no nested
 * array type, and a value path is `string[]`. Parsed and validated here rather
 * than trusted at every read — a malformed path drops its bad segments rather
 * than poisoning the machine.
 */
function parsePath(raw: unknown): readonly string[] {
  if (Array.isArray(raw)) return raw.filter(isString);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isString);
  } catch {
    return [];
  }
  return [];
}

/** A list of value paths: `[["Asia","India"],["Europe","France"]]`. */
function parsePaths(raw: unknown): readonly string[][] {
  if (Array.isArray(raw)) {
    return raw.flatMap((path) => (Array.isArray(path) ? [path.filter(isString)] : []));
  }
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsePaths(parsed);
  } catch {
    return [];
  }
  return [];
}

/**
 * The cascade-select bridge: scope values in, machine state out.
 *
 * Three jobs, and only three: seed the first state from `default*` props,
 * alternate it from the AUTHORED `open`/`value`/`highlightedValue` props, and
 * publish the connect api through the live-view proxy. The change callbacks
 * fire here too, guarded by a snapshot, so a no-op event means no event
 * anywhere. The scalars the guards read (`closeOnSelect`, `multiple`, ...)
 * sync in the same owned effect that drives the controlled channel.
 */
export function createCascadeFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: CascadeFsmApi & CascadeCommands; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<CascadeContext, CascadeEvent>(config, implementations);

  let service: FsmService<CascadeContext, CascadeEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  /** The tree, memoized on the JSON text the host wrote: the connect keys its
   *  level structure on this array's identity, and a fresh parse per read
   *  would look like a new tree and re-render every level. Only the text
   *  memoizes — a host that hands over a live array still parses fresh. */
  let collectionText: string | undefined;
  let collectionParsed: readonly CascadeNode[] = [];
  const collection = (): readonly CascadeNode[] => {
    const raw = props()["collection"];
    if (typeof raw !== "string") return parseCollection(raw);
    if (raw !== collectionText) {
      collectionText = raw;
      collectionParsed = parseCollection(raw);
    }
    return collectionParsed;
  };

  /** The nodes along a path — the chains Zag calls selectedItems / highlightedItems. */
  const chainOf = (path: readonly string[]): readonly CascadeNode[] =>
    itemsAlongPath(collection(), path);

  const readCallbacks = (): {
    onOpenChange: ((d: CascadeOpenChange) => void) | undefined;
    onValueChange: ((d: CascadeValueChange) => void) | undefined;
    onHighlightChange: ((d: CascadeHighlightChange) => void) | undefined;
  } => {
    const p = props();
    return {
      onOpenChange: p["onOpenChange"] as ((d: CascadeOpenChange) => void) | undefined,
      onValueChange: p["onValueChange"] as ((d: CascadeValueChange) => void) | undefined,
      onHighlightChange: p["onHighlightChange"] as ((d: CascadeHighlightChange) => void) | undefined,
    };
  };

  /**
   * The controlled channels. Read through the element's authored-prop predicate
   * rather than the prop store, because scope coercion materializes a default
   * for every declared prop: a coerced default is not a host write. Zag gets
   * this from its bindables' value/defaultValue split; `@@authored` is the same
   * distinction, which is why `value: "[]"` never masquerades as a host's
   * `[["Asia","India"]]`.
   */
  const controlledOpen = (): boolean | undefined => {
    const attribute = root().getAttribute("open");
    if (attribute !== null) return attribute === "true" || attribute === "";
    if (!authored("open")) return undefined;
    const outer: unknown = props()["open"];
    return typeof outer === "boolean" ? outer : undefined;
  };

  const controlledValue = (): readonly string[][] | undefined =>
    authored("value") ? parsePaths(props()["value"]) : undefined;

  const controlledHighlighted = (): readonly string[] | undefined =>
    authored("highlightedValue") ? parsePath(props()["highlightedValue"]) : undefined;

  /** The scalars the guards and the connect read, straight from scope. */
  const readScalars = (): Pick<
    CascadeContext,
    "closeOnSelect" | "allowParentSelection" | "multiple" | "loopFocus" | "highlightTrigger"
  > => {
    const p = props();
    const trigger = p["highlightTrigger"];
    return {
      closeOnSelect: p["closeOnSelect"] !== false,
      allowParentSelection: p["allowParentSelection"] === true,
      multiple: p["multiple"] === true,
      loopFocus: p["loopFocus"] === true,
      highlightTrigger: trigger === "hover" ? "hover" : "click",
    };
  };

  const readConnectProps = (): CascadeFsmConnectProps => {
    const p = props();
    const dir = p["dir"];
    const placement = p["placement"];
    const format = p["formatValue"];
    const scrollTo = p["scrollToIndexFn"];
    const onPointerDownOutside = p["onPointerDownOutside"];
    const onFocusOutside = p["onFocusOutside"];
    const onInteractOutside = p["onInteractOutside"];
    return {
      ...readScalars(),
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      dir: dir === "rtl" ? "rtl" : "ltr",
      placement: typeof placement === "string" && placement.length > 0 ? placement : "bottom-start",
      name: typeof p["name"] === "string" ? p["name"] : "",
      form: typeof p["form"] === "string" ? p["form"] : "",
      formatValue: typeof format === "function" ? (format as CascadeFormatValue) : undefined,
      scrollToIndexFn: typeof scrollTo === "function"
        ? (scrollTo as (details: CascadeScrollDetails) => void)
        : undefined,
      onPointerDownOutside: typeof onPointerDownOutside === "function"
        ? (onPointerDownOutside as (event: PointerEvent) => void)
        : undefined,
      onFocusOutside: typeof onFocusOutside === "function"
        ? (onFocusOutside as (event: FocusEvent) => void)
        : undefined,
      onInteractOutside: typeof onInteractOutside === "function"
        ? (onInteractOutside as (details: CascadeOutsideDetails) => void)
        : undefined,
    };
  };

  const ensureService = (): FsmService<CascadeContext, CascadeEvent> => {
    if (service) return service;
    service = owner.run(() => {
      const p = props();
      const svc = interpret(machine).start(p["defaultOpen"] === true ? "open" : "idle");
      Object.assign(svc.state.context, readScalars(), {
        value: parsePaths(p["defaultValue"]).map((path) => [...path]),
        highlightedValue: [...parsePath(p["defaultHighlightedValue"])],
      });
      return svc;
    });
    return service;
  };

  let lastOpen = ensureService().state.value === "open";
  let lastValue = ensureService().state.context.value;
  let lastHighlighted = ensureService().state.context.highlightedValue;

  /** Report what moved. Cursors advance only after the callbacks, and both the
   *  controlled channel and the machine sends funnel through here — the fork's
   *  send is synchronous, so a post-send check would already see the new value. */
  const notify = (): void => {
    const svc = ensureService();
    const isOpen = svc.state.value === "open";
    const after = svc.state.context;
    const callbacks = readCallbacks();
    if (isOpen !== lastOpen) {
      lastOpen = isOpen;
      callbacks.onOpenChange?.({ open: isOpen, value: after.value.map((path) => [...path]) });
    }
    if (!samePaths(lastValue, after.value)) {
      lastValue = after.value;
      callbacks.onValueChange?.({
        value: after.value.map((path) => [...path]),
        items: after.value.map((path) => chainOf(path)),
      });
    }
    if (!samePath(lastHighlighted, after.highlightedValue)) {
      lastHighlighted = after.highlightedValue;
      callbacks.onHighlightChange?.({
        highlightedValue: [...after.highlightedValue],
        highlightedItems: chainOf(after.highlightedValue),
      });
    }
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it reads
   * the live prop signals, so a host write — property or attribute — moves the
   * machine without waiting for a machine event.
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
      const scalars = readScalars();
      type ScalarKey = keyof typeof scalars;
      const syncScalar = <K extends ScalarKey>(key: K, value: CascadeContext[K]): void => {
        if (svc.state.context[key] !== value) {
          svc.state.context[key] = value;
          moved = true;
        }
      };
      for (const key of Object.keys(scalars) as ScalarKey[]) {
        syncScalar(key, scalars[key]);
      }
      const outerOpen = controlledOpen();
      if (outerOpen !== undefined) {
        const isOpen = svc.state.value === "open";
        if (outerOpen !== isOpen) {
          untrack(() => svc.send({ type: outerOpen ? "CONTROLLED_OPEN" : "CONTROLLED_CLOSE" }));
          moved = true;
        }
      }
      const outerValue = controlledValue();
      if (outerValue !== undefined && !samePaths(outerValue, svc.state.context.value)) {
        svc.state.context.value = outerValue.map((path) => [...path]);
        moved = true;
      }
      const outerHighlighted = controlledHighlighted();
      if (outerHighlighted !== undefined && !samePath(outerHighlighted, svc.state.context.highlightedValue)) {
        svc.state.context.highlightedValue = [...outerHighlighted];
        moved = true;
      }
      if (moved) notify();
    }),
  );

  const send = (event: CascadeEvent): void => {
    const svc = ensureService();
    Object.assign(svc.state.context, readScalars());
    const outerValue = controlledValue();
    if (outerValue !== undefined) svc.state.context.value = outerValue.map((path) => [...path]);
    const outerHighlighted = controlledHighlighted();
    if (outerHighlighted !== undefined) svc.state.context.highlightedValue = [...outerHighlighted];
    svc.send(event);
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   *  long as the bridge does, so this is the stable accessor it caches against. */
  const serviceApi = {
    get context(): CascadeContext {
      return ensureService().state.context;
    },
    get stateValue(): string {
      return ensureService().state.value;
    },
    get open(): boolean {
      return ensureService().state.value === "open";
    },
    send: send as (event: { type: string } & Record<string, unknown>) => void,
  };

  /** ONE connect per element, not one per tick: its bags are cached against
   *  machine state and its row handlers against the rows themselves. Rebuilding
   *  it per move hands every read a fresh item list, which re-inserts row
   *  cells and orphans whatever they hold. */
  let cascadeConnect: CascadeFsmApi | undefined;
  const ensureConnect = (): CascadeFsmApi => {
    cascadeConnect ??= connectRobotCascade(
      serviceApi,
      readConnectProps,
      collection,
      id,
      send as (event: { type: string } & Record<string, unknown>) => void,
      root,
    );
    return cascadeConnect;
  };

  /** Commands resolve INSIDE the trap: assigning onto a live-view proxy is
   *  shadowed by its own get trap and the host would call undefined. */
  const commands: CascadeCommands = {
    focus: () => ensureConnect().focus(),
    setOpen: (nextOpen: boolean) => ensureConnect().setOpen(nextOpen),
    setHighlightValue: (value: readonly string[]) => ensureConnect().setHighlightValue(value),
    clearHighlightValue: () => ensureConnect().clearHighlightValue(),
    setValue: (value: readonly string[][]) => ensureConnect().setValue(value),
    selectValue: (value: readonly string[]) => ensureConnect().selectValue(value),
    clearValue: (value?: readonly string[]) => ensureConnect().clearValue(value),
  };

  // The tick is read in the trap, so every api read — a bag, a list source, a
  // row prop — subscribes its reader to the machine's moves. A `computed`
  // wrapping the one long-lived connect does not do this: its value keeps its
  // identity across moves, so the reactive core never re-notifies, and a `for`
  // whose items come from the api never re-syncs. The level stack of this
  // component changes on every drill, so the read itself has to be tracked.
  const api = new Proxy({} as CascadeFsmApi & CascadeCommands, {
    get: (_target, key) => {
      tick();
      return key in commands ? Reflect.get(commands, key) : Reflect.get(ensureConnect(), key);
    },
    has: (_target, key) => key in commands || Reflect.has(ensureConnect(), key),
    ownKeys: () => [...new Set([...Reflect.ownKeys(ensureConnect()), ...Object.keys(commands)])],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) {
        return { configurable: true, enumerable: true, value: Reflect.get(commands, key) };
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(ensureConnect(), key);
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
