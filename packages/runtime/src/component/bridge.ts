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
import {
  createMachine,
  interpret,
  type Config,
  type Implementations,
  type Service,
} from "@spin/runtime/fsm";

export interface BridgeService<C, E extends { type: string }> {
  readonly context: C;
  readonly state: string;
  send(event: E): void;
}

export interface BridgeShared<C extends object, E extends { type: string }> {
  readonly config: Config<C, E>;
  readonly implementations: Implementations<C, E>;
  readonly startState: string;
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
  /** Alternate authored channels against the machine. Return true when a send moved state. */
  sync(
    svc: Service<C, E>,
    props: () => Record<string, unknown>,
    authored: (name: string) => boolean,
    send: (event: E) => void,
  ): boolean;
  /** Report what moved. `defineBridge` threads the kind and the triggering
   * event (undefined from the sync effect). Cursors live in the hooks closure. */
  notify(
    svc: Service<C, E>,
    callbacks: Callbacks,
    kind: "move" | "commit",
    event?: E,
    before?: C,
    parsed?: Record<string, unknown>,
  ): void;
  /** Classify the send: commit sends fire `on: "commit"` events, moves fire
   * `on: "move"` (unset) events. Absent, every send notifies as a move. */
  kind?(event: E): "move" | "commit";
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
  /** Post-send view reflexes (the panel's opening owes the field its focus).
   * View-side only: focus management, never state. */
  settled?(args: {
    readonly event: E;
    readonly before: { readonly context: C; readonly state: string };
    readonly after: { readonly context: C; readonly state: string };
  }): void;
  /** Merge parsed props into machine context before a send. Absent, sends go direct. */
  refresh?(
    svc: Service<C, E>,
    props: () => Record<string, unknown>,
    authored: (name: string) => boolean,
  ): void;
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
  hooks(id: string): BridgeHooks<C, E, Api, ConnectProps, Callbacks>;
}

export function authoredProps(props: () => Record<string, unknown>): (name: string) => boolean {
  return (name) => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };
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
): { readonly api: Api; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const authored = authoredProps(props);
  const hooks = spec.hooks(id);
  const machine = createMachine<C, E>(
    { ...spec.config, context: { ...(spec.config.context ?? {}) } as C },
    spec.implementations,
  );

  let service: Service<C, E> | undefined;

  const ensureService = (): Service<C, E> => {
    if (service) return service;
    service = owner.run(() => {
      const svc = interpret(machine).start(spec.startState);
      Object.assign(svc.state.context, hooks.seed(props, authored));
      // Prime the watch cursors: the first notify must report a MOVE, not
      // the seed. The sink swallows the callbacks; the cursors still advance.
      hooks.notify(svc, {} as Callbacks, "move");
      return svc;
    });
    return service;
  };

  const send = (event: E): void => {
    const svc = ensureService();
    hooks.refresh?.(svc, props, authored);
    const before = { context: svc.state.context, state: svc.state.value };
    svc.send(event);
    hooks.settled?.({
      event,
      before,
      after: { context: svc.state.context, state: svc.state.value },
    });
    hooks.notify(
      svc,
      hooks.readCallbacks(props),
      hooks.kind?.(event) ?? "move",
      event,
      before.context,
      hooks.readConnectProps(props) as Record<string, unknown>,
    );
    tick(tick() + 1);
    machineTick(machineTick() + 1);
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
  const ensureConnect = (): Api => {
    api ??= hooks.connect(serviceApi, () => hooks.readConnectProps(props), id);
    return api;
  };

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      // The cursors stay on the pre-write values while the events send.
      const beforeContext = { ...svc.state.context };
      const moved = untrack(() => {
        const channelMoved = hooks.sync(svc, props, authored, (event) => svc.send(event));
        const parsed = hooks.readConnectProps(props) as Record<string, unknown>;
        const derivedMoved = hooks.reconcile?.(svc, svc.state.value, parsed, authored, (event) => svc.send(event)) ?? false;
        return channelMoved || derivedMoved;
      });
      if (moved) hooks.notify(svc, hooks.readCallbacks(props), "commit", undefined, beforeContext, hooks.readConnectProps(props) as Record<string, unknown>);
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
