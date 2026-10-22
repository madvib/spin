/** Shared bridge machinery: scope values in, machine state out.
 *
 * Every component bridge re-implements this file. The per-component parts
 * are the prop parsing, the seed, the authored-channel alternation, and
 * the change notification; everything else — service lifecycle, tick
 * plumbing, the api proxy, disposal — is identical.
 *
 * Constraints the helper preserves:
 * - The fork's `config.context` is ONE object and the interpreter starts
 *   on it without copying: the config AND its context are cloned per
 *   bridge, or every instance on the page shares one context.
 * - The controlled-channel effect must not read the tick it writes (it
 *   re-runs every machine move and re-imposes the authored prop over the
 *   machine's transition). It reads live prop signals only.
 * - The api proxy resolves commands INSIDE the get trap: Object.assign
 *   onto a live-view proxy is shadowed by its own trap.
 * - The fork's send is synchronous: notify cursors advance only after
 *   the callbacks fire. */

import { computed, effect, machineTick, scope, signal, untrack, type Signal } from "@spin/runtime";
import { resolveTwins } from "../props.ts";
import {
  interpret,
  type EventMap,
  type EventName,
  type EventUnion,
  type Service,
  type Machine,
} from "@spin/runtime/fsm";

export interface BridgeService<C, E extends EventMap> {
  readonly context: C;
  readonly state: string;
  send(event: EventUnion<E>): void;
}

export interface BridgeShared<C extends object, E extends EventMap> {
  /**
   * The machine: a factory over the machine's own arguments. The
   * factory builds the machine with its context already seeded from them,
   * so the seed is the machine's business and the transport is the
   * framework's.
   */
  readonly machine?: (
    args: unknown,
    authored: (name: string) => boolean,
  ) => Machine<C, E>;
  /**
   * The props, mapped onto the machine's arguments. Absent, the props
   * ARE the arguments.
   */
  readonly args?: (props: Record<string, unknown>) => unknown;
  /** The start state. Undefined starts at the machine's own initial. */
  readonly startState?: string;
}

/** The machine's live state, field by field, as signals. */
export interface BridgeLive {
  /** The value of a context field, read through its signal. */
  field(name: string): unknown;
  /** The machine's state name. */
  state(): string;
  /** Keeps a field's signal in step with the context. */
  sync(name: string, value: unknown): void;
}

export interface BridgeHooks<
  C extends object,
  E extends EventMap,
  Api extends object,
  ConnectProps,
  Callbacks,
> {
  /** Seed the machine context from props before start. */
  seed(
    props: () => Record<string, unknown>,
    authored: (name: string) => boolean,
  ): Partial<C>;
  /** Post-start sends (seeded through the machine: validation runs through
   * the assigns). Once per service; the bridge transmits each (reflexes
   * run) and primes the cursors after (nothing reports). */
  establish?(
    svc: Service<C, E>,
    props: () => Record<string, unknown>,
    authored: (name: string) => boolean,
  ): readonly EventUnion<E>[];
  /** The machine's contract decides what a host write means: a field
   * with an event is REPORTED, a field without one is SILENT. The
   * bridge applies the contract; there is no per-component sync. */
  /** Report what moved. `defineBridge` threads the kind, the triggering
   * event (undefined from the sync effect) and the send's source
   * (`"reconcile"` for effect-driven sends, undefined for gestures).
   * Cursors live in the hooks closure. */
  notify(
    svc: Service<C, E>,
    callbacks: Callbacks,
    kind: "move" | "commit",
    event?: EventUnion<E>,
    before?: { readonly context: C; readonly state: string },
    parsed?: Record<string, unknown>,
    source?: string,
  ): void;
  /** Classify the send: commit sends fire `on: "commit"` events, moves fire
   * `on: "move"` (unset) events. Absent, every send notifies as a move. */
  kind?(event: EventUnion<E>): "move" | "commit";
  /** Observe every transmitted event type (sync writes included): a
   * controlled close reads the last one to tell a commit from a cancel. */
  noteSent?(type: EventName<E>): void;
  /** Derived-context reconcile inside the owned effect (collection order
   * re-homed over a changed item tree). Absent, the effect only alternates
   * controlled channels. */
  reconcile?(
    svc: Service<C, E>,
    state: string,
    parsed: Record<string, unknown>,
    authored: (name: string) => boolean,
    send: (event: EventUnion<E>) => void,
  ): boolean;
  /** Once, after the first connect build (cells exist in markup): entry
   * focus and other mount-time view reflexes. */
  mounted?(args: {
    readonly props: () => Record<string, unknown>;
  }): void;
  /** Post-send view reflexes (the panel's opening owes the field its focus).
   * View-side only: focus management, never state. */
  settled?(args: {
    readonly event: EventUnion<E>;
    readonly before: { readonly context: C; readonly state: string };
    readonly after: { readonly context: C; readonly state: string };
    readonly props: () => Record<string, unknown>;
    /** The full funnel: a settled reflex that kicks a DOM poll reports
     * its findings back through this, with reporting and ticks. */
    readonly send: (event: EventUnion<E>) => void;
  }): void;
  /** Merge parsed props into machine context (pre-send and in the owned
   * effect, so a host scalar write lands without waiting for a gesture).
   * Returns true when a field moved. Absent, sends go direct. */
  refresh?(
    svc: Service<C, E>,
    props: () => Record<string, unknown>,
    authored: (name: string) => boolean,
  ): boolean;
  readCallbacks(props: () => Record<string, unknown>): Callbacks;
  readConnectProps(props: () => Record<string, unknown>): ConnectProps;
  connect(service: BridgeService<C, E>, readProps: () => ConnectProps, id: string): Api;
}

export interface BridgeSpec<
  C extends object,
  E extends EventMap,
  Api extends object,
  ConnectProps,
  Callbacks,
> extends BridgeShared<C, E> {
  /** Fresh per-bridge hooks: notify cursors live in this closure, so two
   * elements on one page never share them. Receives the element id for
   * post-send view reflexes. */
  hooks(
    id: string,
    root: () => Element,
    live: BridgeLive,
  ): BridgeHooks<C, E, Api, ConnectProps, Callbacks>;
}

export function authoredProps(props: () => Record<string, unknown>): (name: string) => boolean {
  return (name) => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };
}

/**
 * The machine's contract, applied: for every field the host wrote, send
 * the field's event, or write the field silently.
 */
function applyContract<C extends object, E extends EventMap>(
  svc: Service<C, E>,
  fields: Readonly<Record<string, { readonly event?: EventUnion<E>["type"]; readonly parse?: (raw: unknown) => unknown }>>,
  props: () => Record<string, unknown>,
  authored: (name: string) => boolean,
  cursor: Map<string, unknown>,
  send: (event: EventUnion<E>) => void,
): { readonly moved: boolean; readonly events: readonly EventUnion<E>[] } {
  if (Object.keys(fields).length === 0) return { moved: false, events: [] };
  const parsed = props();
  const context = svc.state.context as unknown as Record<string, unknown>;
  const events: EventUnion<E>[] = [];
  let moved = false;
  for (const [field, contract] of Object.entries(fields)) {
    const raw = parsed[field];
    if (raw === undefined || raw === null) continue;
    if (!authored(field)) continue;
    if (Object.is(cursor.get(field), raw)) continue;
    cursor.set(field, raw);
    if (contract.event === undefined) {
      // A silent field: the host's write lands in it. The machine's own
      // move owns the field's logic, and the machine's own shaping
      // (`parse`) turns the raw prop into the field's value.
      const value = contract.parse === undefined ? raw : contract.parse(raw);
      if (context[field] !== value) {
        context[field] = value;
        moved = true;
      }
      continue;
    }
    // A reported field: the host's write is an event, and the prop's
    // name is the payload's key. The event's shape is the machine's own
    // business — the contract names the EVENT, and the machine reads the
    // payload it declared.
    const event = { type: contract.event, [field]: raw } as EventUnion<E>;
    events.push(event);
    moved = true;
    send(event);
  }
  return { moved, events };
}

export function pickCallback<T>(
  props: Record<string, unknown>,
  name: string,
): T | undefined {
  const value = props[name];
  return typeof value === "function" ? (value as T) : undefined;
}

export function textProp(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

export function defineBridge<
  C extends object,
  E extends EventMap,
  Api extends object,
  ConnectProps,
  Callbacks,
>(
  spec: BridgeSpec<C, E, Api, ConnectProps, Callbacks>,
  props: () => Record<string, unknown>,
  id: string,
  root: () => Element = () => {
    throw new Error("[spin] bridge needs a root element");
  },
): { readonly api: Api; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The last value each contracted field carried: the cursor that makes
  // a host write an event ONCE. Without it, the sync effect would re-send
  // the event on every pass, and the machine would answer its own move.
  const lastContract = new Map<string, unknown>();
  const authored = authoredProps(props);
  // The machine's context, mirrored into signals: one per field, plus
  // the state name. The bindings read the fields through the scope's
  // proxy, so a read inside a computed subscribes to that field and
  // nothing else. The machine's context is a plain object (the fork
  // replaces it on every move), so the mirror is what makes the reads
  // trackable.
  const contextSignals = new Map<string, Signal<unknown>>();
  const stateSignal = signal("");
  /** The live context, field by field, as signals. The mirror is the
   * single writer; everything else reads. A read of a signal inside a
   * computed subscribes to that field, and nothing else. */
  const live = {
    /**
     * A field's value, through its signal. A field the mirror has not
     * written yet (the machine grew one) starts tracking the machine's
     * own value, so a read is never undefined.
     */
    field: (name: string): unknown => {
      const existing = contextSignals.get(name);
      if (existing !== undefined) return existing();
      const value = (ensureService().state.context as unknown as Record<string, unknown>)[name];
      contextSignals.set(name, signal<unknown>(value));
      return value;
    },
    state: (): string => stateSignal(),
    /** Keeps a field's signal in step with the machine. The mirror
     * calls it; a read never does, so a read cannot loop. */
    sync: (name: string, value: unknown): void => {
      const existing = contextSignals.get(name);
      if (existing === undefined) {
        contextSignals.set(name, signal<unknown>(value));
        return;
      }
      if (existing() !== value) existing(value);
    },
    /** The machine's state, as a signal-backed read. */
    setState: (value: string): void => {
      if (stateSignal() !== value) stateSignal(value);
    },
  };
  /** The machine's whole context, mirrored into the signals. */
  const mirror = (context: unknown, state: string): void => {
    const rec = (context ?? {}) as Record<string, unknown>;
    for (const [field, value] of Object.entries(rec)) live.sync(field, value);
    live.setState(state);
  };
  const hooks = spec.hooks(id, root, live);
  // The machine: the component's factory.
  //
  // The factory receives the props with the twins resolved: the live
  // prop `value` wins, and `defaultValue` is its fallback. So the
  // machine's arguments are the live values, and it never sees the twin.
  //
  // It is built LAZILY, with the service: a host that writes a prop
  // before the machine's first use (a function the machine calls, say)
  // is heard by the machine that starts.
  let machine: Machine<C, E> | undefined;
  const machineOf = (): Machine<C, E> => {
    if (machine !== undefined) return machine;
    if (spec.machine === undefined) {
      throw new Error("[spin] the bridge has no machine");
    }
    // The twins resolve first: a host that wrote `defaultValue` wrote the
    // channel too, and the map sees the resolved props.
    const resolved = resolveTwins(props(), authored);
    machine = spec.machine(spec.args?.(resolved) ?? resolved, authored);
    return machine;
  };

  let service: Service<C, E> | undefined;

  const ensureService = (): Service<C, E> => {
    if (service) return service;
    service = owner.run(() => {
      const svc = interpret(machineOf()).start(spec.startState);
      // EVERY send goes through the mirror: the scope's `send` and the
      // commands both land here, and a send that skipped the mirror
      // would leave the signals stale — the readers would see the
      // machine's old state.
      const rawSend = svc.send.bind(svc);
      svc.send = (event: EventUnion<E>) => {
        rawSend(event);
        mirror(svc.state.context, svc.state.value);
        machineTick(machineTick() + 1);
      };
      if (spec.machine === undefined) {
        // The legacy path: the seed is the service's STARTING context,
        // not a mutation of it — a transition replaces the context
        // object, so subscribers see it. The seed lands AFTER the entry
        // actions: the seed writes the value and the entry clears the
        // highlight, so the seed wins.
        svc.setContext(hooks.seed?.(props, authored) as Partial<C>);
      }
      // Scalars first: seed sends run assigns that read them.
      hooks.refresh?.(svc, props, authored);
      // The machine's context is mirrored into the signals: the mirror
      // is the single writer, and the start is a write like any other.
      mirror(svc.state.context, svc.state.value);
      // The seed replaced the context, so the bags must re-read it: the
      // machine tick is the invalidation bus every binding watches.
      machineTick(machineTick() + 1);
      return svc;
    });
    // Establish events travel the transmit pipeline (view reflexes run,
    // ticks bump) but report nothing: the watch cursors prime after, so
    // the seed never reports a change.
    for (const event of hooks.establish?.(service, props, authored) ?? []) {
      transmit(event);
    }
    hooks.notify(service, {} as Callbacks, "move");
    return service;
  };

  // The full pipeline minus reporting: refresh, send, view reflexes, ticks.
  // Sync-effect writes route through this (not the raw service), so focus
  // and completion reflexes run for controlled writes too. Reporting stays
  // manual: the effect's trailing notify covers reconcile moves, and
  // watch-cursors suppress its echo of these sends.
  const transmit = (event: EventUnion<E>): {
    readonly svc: Service<C, E>;
    readonly before: { readonly context: C; readonly state: string };
  } => {
    const svc = ensureService();
    hooks.noteSent?.(event.type);
    hooks.refresh?.(svc, props, authored);
    // Shallow: assigns replace fields rather than mutating them, so the
    // pre-send values survive the transition (the tags log diff relies on it).
    const before = { context: { ...svc.state.context }, state: svc.state.value };
    svc.send(event);
    hooks.settled?.({
      event,
      before,
      after: { context: svc.state.context, state: svc.state.value },
      props,
      send: (report: EventUnion<E>): void => send(report),
    });
    // The send mirrored the context into the signals; the tick is the
    // invalidation bus every binding watches.
    tick(tick() + 1);
    machineTick(machineTick() + 1);
    return { svc, before };
  };

  const send = (event: EventUnion<E>): void => {
    const { svc, before } = transmit(event);
    hooks.notify(
      svc,
      hooks.readCallbacks(props),
      hooks.kind?.(event) ?? "move",
      event,
      before,
      hooks.readConnectProps(props) as Record<string, unknown>,
    );
  };

  /** The service surface the connect reads. Built once: the connect lives
   * as long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: BridgeService<C, E> = {
    send,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state.value;
    },
  };

  let api: Api | undefined;
  let mounted = false;
  const ensureConnect = (): Api => {
    if (api === undefined) {
      api = hooks.connect(serviceApi, () => hooks.readConnectProps(props), id);
      if (!mounted) {
        mounted = true;
        hooks.mounted?.({ props });
      }
    }
    return api;
  };

  owner.run(() =>
    effect(() => {
      // Subscribe to the prop signals and nothing else: the whole body
      // runs untracked, so machine ticks can never re-run it and re-impose
      // the authored prop over the machine's own transition.
      props();
      untrack(() => {
      const svc = ensureService();
      // The cursors stay on the pre-write values while the events send.
      // The cursors stay on the pre-write values while the events send.
      // Same trust point as synthesize's ctxOf: the core is untyped,
      // the def declared C. The snapshot is a past C.
      const beforeContext = {
        context: { ...(svc.state.context as unknown as C) },
        state: svc.state.value,
      };
      const readParsed = (): Record<string, unknown> =>
        hooks.readConnectProps(props) as Record<string, unknown>;
      const scalarMoved = hooks.refresh?.(svc, props, authored) ?? false;
      // The machine's contract decides what a host write means: a field
      // with an event is REPORTED (the host's write is an event, the
      // machine decides), a field without one is SILENT (the write lands
      // in the field and nothing reports).
      const syncResult = applyContract(
        svc,
        machineOf().fields,
        props,
        authored,
        lastContract,
        (event) => transmit(event),
      );
      // A silent field lands in the context without a move, so the
      // mirror writes it: the mirror is the single writer, and every
      // reader sees the machine's value.
      mirror(svc.state.context, svc.state.value);
      const parsed = readParsed();
      const reconciled: EventUnion<E>[] = [];
      const derivedMoved = hooks.reconcile?.(svc, svc.state.value, parsed, authored, (event) => {
        reconciled.push(event);
        transmit(event);
      }) ?? false;
      // The reconcile may WRITE the context in place (a derived field it
      // owns), so the mirror writes it again: the mirror is the single
      // writer, and every reader sees the machine's value.
      mirror(svc.state.context, svc.state.value);
      const moved = scalarMoved || syncResult.moved || derivedMoved;
      if (moved) tick(tick() + 1);
      // A silent merge (the refresh path) changes the context WITHOUT
      // sending, so nothing bumped the machine tick — the invalidation
      // bus every binding watches. The bags kept showing the old value.
      if (scalarMoved) machineTick(machineTick() + 1);
      // Each send reports with its own kind and event; a moved-but
      // eventless effect (reconcile assigns) reports once as a commit.
      // Reconcile sends carry their source: a host-driven queue edit is
      // not a gesture, and the report tells them apart.
      for (const event of syncResult.events) {
        hooks.notify(
          svc,
          hooks.readCallbacks(props),
          hooks.kind?.(event) ?? "move",
          event,
          beforeContext,
          readParsed(),
        );
      }
      // One report for the whole host edit, diffed against the effect's
      // start: per-send reports would each diff the same `before` and
      // repeat the queue. The last event rides along for the src read.
      if (reconciled.length > 0) {
        const last = reconciled[reconciled.length - 1];
        if (last !== undefined) {
          hooks.notify(
            svc,
            hooks.readCallbacks(props),
            hooks.kind?.(last) ?? "move",
            last,
            beforeContext,
            readParsed(),
            "reconcile",
          );
        }
      }
      if (syncResult.events.length === 0 && reconciled.length === 0 && derivedMoved) {
        hooks.notify(svc, hooks.readCallbacks(props), "commit", undefined, beforeContext, readParsed());
      }
      });
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const proxy = new Proxy({} as Api, {
    get: (_target, key) => Reflect.get(connected(), key as string),
    has: (_target, key) => Reflect.has(connected(), key as string),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key as string);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api: proxy,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}
