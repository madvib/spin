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
  seed(props: () => Record<string, unknown>, authored: (name: string) => boolean): Partial<C>;
  /** Alternate authored channels against the machine. Return true when a send moved state. */
  sync(
    svc: Service<C, E>,
    props: () => Record<string, unknown>,
    authored: (name: string) => boolean,
    send: (event: E) => void,
  ): boolean;
  /** Report what moved since the last notify. Cursors live in the hooks closure. */
  notify(svc: Service<C, E>, callbacks: Callbacks): void;
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
   * elements on one page never share them. */
  hooks(): BridgeHooks<C, E, Api, ConnectProps, Callbacks>;
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
  const hooks = spec.hooks();
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
      return svc;
    });
    return service;
  };

  const send = (event: E): void => {
    const svc = ensureService();
    svc.send(event);
    hooks.notify(svc, hooks.readCallbacks(props));
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
      const moved = untrack(() => hooks.sync(svc, props, authored, (event) => svc.send(event)));
      if (moved) hooks.notify(svc, hooks.readCallbacks(props));
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
