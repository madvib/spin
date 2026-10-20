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

import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { resolveTwins } from "../props.ts";
import {
  createMachine,
  interpret,
  type Config,
  type Implementations,
  type Service,
  type Machine,
} from "@spin/runtime/fsm";

export interface BridgeService<C, E extends { type: string }> {
  readonly context: C;
  readonly state: string;
  send(event: E): void;
}

export interface BridgeShared<C extends object, E extends { type: string }> {
  /**
   * The machine: a factory over the element's props. The factory builds
   * the machine with its context already seeded from the arguments it
   * wants, so the seed is the machine's business and the transport is
   * the framework's.
   */
  readonly machine?: (props: Record<string, unknown>) => Machine<C, E>;
  /** The legacy shape: the config and the implementations apart. */
  readonly config?: Config<C, E>;
  readonly implementations?: Implementations<C, E>;
  /** The start state. Undefined starts at the machine's own initial. */
  readonly startState?: string;
}

export interface BridgeHooks<
  C extends object,
  E extends { type: string },
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
  ): readonly E[];
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
    event?: E,
    before?: { readonly context: C; readonly state: string },
    parsed?: Record<string, unknown>,
    source?: string,
  ): void;
  /** Classify the send: commit sends fire `on: "commit"` events, moves fire
   * `on: "move"` (unset) events. Absent, every send notifies as a move. */
  kind?(event: E): "move" | "commit";
  /** Observe every transmitted event type (sync writes included): a
   * controlled close reads the last one to tell a commit from a cancel. */
  noteSent?(type: string): void;
  /** Derived-context reconcile inside the owned effect (collection order
   * re-homed over a changed item tree). Absent, the effect only alternates
   * controlled channels. */
  reconcile?(
    svc: Service<C, E>,
    state: string,
    parsed: Record<string, unknown>,
    authored: (name: string) => boolean,
    send: (event: E) => void,
  ): boolean;
  /** Once, after the first connect build (cells exist in markup): entry
   * focus and other mount-time view reflexes. */
  mounted?(args: {
    readonly props: () => Record<string, unknown>;
  }): void;
  /** Post-send view reflexes (the panel's opening owes the field its focus).
   * View-side only: focus management, never state. */
  settled?(args: {
    readonly event: E;
    readonly before: { readonly context: C; readonly state: string };
    readonly after: { readonly context: C; readonly state: string };
    readonly props: () => Record<string, unknown>;
    /** The full funnel: a settled reflex that kicks a DOM poll reports
     * its findings back through this, with reporting and ticks. */
    readonly send: (event: E) => void;
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
  E extends { type: string },
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
function applyContract<C extends object, E extends { type: string }>(
  svc: Service<C, E>,
  fields: Readonly<Record<string, { readonly event?: E["type"] }>>,
  props: () => Record<string, unknown>,
  authored: (name: string) => boolean,
  send: (event: E) => void,
): { readonly moved: boolean; readonly events: readonly E[] } {
  if (Object.keys(fields).length === 0) return { moved: false, events: [] };
  const parsed = props();
  const context = svc.state.context as unknown as Record<string, unknown>;
  const events: E[] = [];
  let moved = false;
  for (const [field, contract] of Object.entries(fields)) {
    const raw = parsed[field];
    if (raw === undefined || raw === null) continue;
    if (!authored(field)) continue;
    if (contract.event === undefined) {
      // A silent field: the host's write lands in it. The machine's own
      // move owns the field's logic.
      if (context[field] !== raw) {
        context[field] = raw;
        moved = true;
      }
      continue;
    }
    // A reported field: the host's write is an event, and the prop's
    // name is the payload's key.
    const event = { type: contract.event, [field]: raw } as unknown as E;
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
  E extends { type: string },
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
  const authored = authoredProps(props);
  const hooks = spec.hooks(id, root);
  // The machine: the component's factory, or the legacy config plus
  // implementations. One object either way.
  //
  // The factory receives the props with the twins resolved: the live
  // prop `value` wins, and `defaultValue` is its fallback. So the
  // machine's arguments are the live values, and it never sees the twin.
  const machine = spec.machine !== undefined
    ? spec.machine(resolveTwins(props(), authored))
    : createMachine<C, E>({
      ...(spec.config ?? {}),
      context: { ...(spec.config?.context ?? {}) } as C,
      initial: spec.config?.initial ?? "idle",
      states: spec.config?.states ?? {},
      ...(spec.implementations?.assigns === undefined
        ? {}
        : { assigns: spec.implementations.assigns as never }),
      ...(spec.implementations?.conds === undefined
        ? {}
        : { conds: spec.implementations.conds as never }),
      ...(spec.implementations?.actions === undefined
        ? {}
        : { actions: spec.implementations.actions }),
    });

  let service: Service<C, E> | undefined;

  const ensureService = (): Service<C, E> => {
    if (service) return service;
    service = owner.run(() => {
      const svc = interpret(machine).start(spec.startState);
      if (spec.machine === undefined) {
        // The legacy path: the seed is the service's STARTING context,
        // not a mutation of it — a transition replaces the context
        // object, so subscribers see it. The seed lands AFTER the entry
        // actions: Zag seeds the value and the entry clears the
        // highlight, so the seed wins.
        svc.setContext(hooks.seed?.(props, authored) as Partial<C>);
      }
      // Scalars first: seed sends run assigns that read them.
      hooks.refresh?.(svc, props, authored);
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
  const transmit = (event: E): {
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
      send: (report: E): void => send(report),
    });
    tick(tick() + 1);
    machineTick(machineTick() + 1);
    return { svc, before };
  };

  const send = (event: E): void => {
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
      const syncResult = applyContract(svc, machine.fields, props, authored, (event) => transmit(event));
      const parsed = readParsed();
      const reconciled: E[] = [];
      const derivedMoved = hooks.reconcile?.(svc, svc.state.value, parsed, authored, (event) => {
        reconciled.push(event);
        transmit(event);
      }) ?? false;
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
