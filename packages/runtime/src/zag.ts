/**
 * The Zag bridge: a machine, a scope, and a view of the machine's API that is
 * live instead of a photograph.
 *
 * The photograph is the whole problem. `connect(service, normalize)` reads the
 * machine's context once and closes over what it read, so `api.expandedValue`
 * is the value that was current when `connect` ran — forever. Every Zag
 * framework binding gets away with it because their renderers re-run the
 * enclosing computation on every state change and rebuild the template. We have
 * no template and no vdom, so the liveness has to be ours.
 *
 * Note what this module therefore is: `@zag-js/core` ships no runner. Its
 * `createMachine` is a no-op that indexes a config, and a `Service` is a type,
 * never a value. The interpreter — bindables, refs, transitions, exit/entry
 * effect bookkeeping, `track` — exists only inside the framework adapters, and
 * those are built on a framework's reactivity. So this file *is* the runner,
 * reimplemented over alien-signals, and then the live view on top of it. The
 * 0.8 kB in PLAN §3 is the connector, not the interpreter.
 *
 * Two rules make the API live, and they are the only rules:
 *
 * 1. `connect` runs inside a `computed`. The computed tracks whatever the
 *    machine reads while connecting, so it re-runs `connect` once per state
 *    change and caches the result between changes. A read is a property access
 *    on the cached object: no allocation, no re-entry into `connect`.
 * 2. `machine.api` is a `Proxy` over that computed rather than the computed's
 *    current value, so liveness survives destructuring the bridge. Hold on to
 *    `api` and it keeps up; capturing a field is what does not survive, and
 *    that is the failure mode this file exists to prevent.
 *
 * One thing no proxy can fix, and a component author has to know: a *function*
 * read off the api closes over the snapshot that produced it. `api.setValue`
 * taken before a transition still sends — it goes through the service, not a
 * snapshot — but `api.getItemState` taken before one reports the state as it
 * was. So read fields and call functions *through* `api` at the point of use,
 * never destructure one off it. The alternative, re-running `connect` per read,
 * allocates the whole API object on every property access to buy a guarantee
 * nobody needs.
 *
 * Everything the machine runs — `track` effects, computed values, entry and
 * exit effects, the machine's own teardown — is registered with the machine's
 * scope, which is nested inside the caller's. Disposing the caller's scope
 * reaches all of it, which is what makes `disconnectedCallback` safe.
 */

import {
  createReplaceTracker,
  createScope,
  findTransition,
  getExitEnterStates,
  hasTag,
  matchesState,
  resolveStateValue,
  INIT_STATE,
  MachineStatus,
} from "@zag-js/core";
import type {
  ActionsOrFn,
  Bindable,
  BindableContext,
  BindableParams,
  BindableRefs,
  ChooseFn,
  ComputedFn,
  EffectsOrFn,
  EventObject,
  Machine,
  MachineSchema,
  Params,
  PropFn,
  Service,
  Transition,
  ValueOrFn,
} from "@zag-js/core";
import { callAll, compact, ensure, isEqual, isFunction, isString, toArray, warn } from "@zag-js/utils";
import { batch, computed, effect, scope as createOwnerScope, signal, type OwnerScope } from "./signal.ts";

/** Props as a plain record, or as a getter so an element can drive them. */
export type Props = Record<string, unknown> | (() => Record<string, unknown>);

/**
 * What a component's `connect` does with the props zag hands it.
 *
 * Zag's bindings get this from their framework package. The default answers
 * for every key a component reaches for — `element`, `style`, `button`,
 * `label` — which is the same trick zag's own `createNormalizer` plays, and for
 * a DOM target passthrough is the correct answer.
 */
export type Normalize = Record<string, (props: Record<string, unknown>) => Record<string, unknown>>;

const passthrough = (props: Record<string, unknown>): Record<string, unknown> => props;

/** The default normalizer: every key returns the props it was handed. */
export const domNormalize: Normalize = new Proxy({} as Normalize, {
  get: () => passthrough,
});

/**
 * The schema the interpreter runs against.
 *
 * Zag's own `MachineSchema` leaves `action`, `guard`, `effect`, `state` and
 * `tag` as `string | undefined`, which makes `implementations.actions[key]`
 * untypeable — and the interpreter indexes exactly those maps, by name, on
 * every transition. So it works against this concrete shape and casts back
 * once, at the boundary in {@link createMachine}. Nothing else is unchecked.
 */
interface RuntimeSchema extends MachineSchema {
  props: Record<string, unknown>;
  context: Record<string, unknown>;
  refs: Record<string, unknown>;
  computed: Record<string, unknown>;
  state: string;
  tag: string;
  guard: string;
  action: string;
  effect: string;
  event: EventObject;
}

/** Zag's `track`: re-run `fn` when any of `deps` moves. */
type Track = (deps: Array<() => unknown>, fn: VoidFunction) => void;

/** Zag's scope resolves parts out of a root node; a component passes its element. */
type GetRootNode = () => ShadowRoot | Document | Element;

export interface MachineOptions<T extends MachineSchema, TApi extends object> {
  /**
   * The component's own `connect`. Its result is what `api` exposes.
   *
   * The normalizer parameter is typed `never` on purpose: each Zag component
   * declares its own `NormalizeProps<PropTypes>`, so there is one normalizer
   * type per component and none of them is ours to name. `never` accepts any of
   * them, and is cast once, at the single call site below.
   */
  connect: (service: Service<T>, normalize: never) => TApi;
  /** Props for the machine. A getter makes them live. */
  props?: Props;
  /** Overrides {@link domNormalize}, for a component that needs a real one. */
  normalize?: Normalize;
  /** Owns the machine. Defaults to a fresh scope the caller then disposes. */
  scope?: OwnerScope;
  /** Seed for the ids zag generates for the machine's parts. */
  id?: string;
  /** Explicit ids, overriding `id`. */
  ids?: Record<string, unknown>;
  /** Where zag looks up the machine's parts. Defaults to `document`. */
  getRootNode?: GetRootNode;
}

export interface MachineBridge<T extends MachineSchema, TApi extends object> {
  /** A live view of `connect`'s result. See the file header. */
  readonly api: TApi;
  /** The zag service, for the rare consumer that wants the raw thing. */
  readonly service: Service<T>;
  /** The machine's state, as a signal read. */
  readonly state: () => T["state"];
  readonly send: Service<T>["send"];
  readonly prop: PropFn<T>;
  readonly context: BindableContext<T>;
  readonly computed: ComputedFn<T>;
  /** The machine's own scope, nested inside the caller's. */
  readonly scope: OwnerScope;
  /** Tears down everything the machine created. Idempotent. */
  dispose(): void;
}

/** A function, or the value it produces. Zag reads both shapes. */
type Accessor = () => unknown;

function isAccessor(value: unknown): value is Accessor {
  return typeof value === "function";
}

function readProps(props: Props | undefined): Record<string, unknown> {
  if (props === undefined) return {};
  return (isAccessor(props) ? props() : props) as Record<string, unknown>;
}

/**
 * A bindable over one alien signal.
 *
 * `params` is a getter, not a value, because a controlled prop can change
 * mid-flight: `get` re-reads it on every access, so a machine under a
 * controlled `value` follows its owner without being told anything.
 */
function createBindable<TValue>(
  params: () => BindableParams<TValue>,
  register: (dispose: VoidFunction) => void,
): Bindable<TValue> {
  const first = params();
  const initial = (first.value ?? first.defaultValue) as TValue;
  const inner = signal<TValue>(initial);
  const ref = { current: initial };

  function controlled(): boolean {
    return params().value !== undefined;
  }

  function get(): TValue {
    const value = controlled() ? params().value : inner();
    return (isFunction(value) ? value() : value) as TValue;
  }

  function set(value: ValueOrFn<TValue>): void {
    const previous = get();
    const next = isFunction(value) ? value(previous) : value;
    if (!controlled()) inner(next);
    const equal = params().isEqual ?? Object.is;
    if (!equal(next, previous)) params().onChange?.(next, previous);
    ref.current = next;
  }

  return {
    initial,
    ref,
    get,
    set,
    invoke(next, previous) {
      params().onChange?.(next, previous);
    },
    hash(value) {
      return params().hash?.(value) ?? String(value);
    },
  };
}

/**
 * Runs the machine: the contract `useMachine` implements in every Zag
 * framework package, with alien-signals in place of the framework.
 */
function startMachine(
  machine: Machine<RuntimeSchema>,
  props: Props,
  owner: OwnerScope,
  id: string | undefined,
  ids: Record<string, unknown> | undefined,
  getRootNode: GetRootNode | undefined,
): Service<RuntimeSchema> {
  // Zag falls back to `document` when a machine is given no root; an element
  // passes itself, which is the whole reason this is an option.
  const zagScope = createScope({
    id,
    ids,
    getRootNode: () => getRootNode?.() ?? document,
  });
  const debug = (...args: unknown[]): void => {
    if (machine.debug) console.log(...args);
  };

  // Zag resolves props through a memo so a prop that changes is re-read. Here
  // the memo is a computed, so the same holds, and a `connect` that reads a
  // prop subscribes to it.
  const resolvedProps = computed<Record<string, unknown>>(() => {
    const latest = readProps(props);
    return machine.props?.({ props: compact(latest), scope: zagScope }) ?? latest;
  });
  const prop: PropFn<RuntimeSchema> = (key) => resolvedProps()[key];

  const register = (dispose: VoidFunction): void => owner.own(dispose);

  const bindable = Object.assign(
    <TValue,>(params: () => BindableParams<TValue>) => createBindable(params, register),
    {
      cleanup: (fn: VoidFunction) => register(fn),
      ref: <TValue,>(defaultValue: TValue) => {
        let value = defaultValue;
        return {
          get: () => value,
          set: (next: TValue) => {
            value = next;
          },
        };
      },
    },
  );

  const contextValues = machine.context?.({
    prop,
    bindable,
    scope: zagScope,
    flush: batch,
    getContext: () => ctx,
    getComputed: () => machineComputed,
    getRefs: () => refs,
    getEvent: () => getEvent(),
  }) ?? {};

  const ctx: BindableContext<RuntimeSchema> = {
    get: (key) => contextValues[key].get(),
    set: (key, value) => contextValues[key].set(value),
    initial: (key) => contextValues[key].initial,
    hash: (key) => contextValues[key].hash(contextValues[key].get()),
  };

  const refsMap = machine.refs?.({ prop, context: ctx }) ?? {};
  const refs: BindableRefs<RuntimeSchema> = {
    get: (key) => refsMap[key],
    set: (key, value) => {
      refsMap[key] = value;
    },
  };

  const machineComputed: ComputedFn<RuntimeSchema> = (key) => {
    ensure(machine.computed, () => "[spin] No computed object found on machine");
    return machine.computed[key]({
      context: ctx,
      event: eventRef.current,
      prop,
      refs,
      scope: zagScope,
      computed: machineComputed,
    });
  };

  const effects = new Map<string, VoidFunction>();
  const transitionRef: { current: Transition<RuntimeSchema> | undefined } = { current: undefined };
  const previousEventRef: { current: EventObject } = { current: { type: "" } };
  const eventRef: { current: EventObject } = { current: { type: "" } };

  const getEvent = () => ({
    ...eventRef.current,
    current: () => eventRef.current,
    previous: () => previousEventRef.current,
  });

  const getState = () => ({
    ...state,
    matches: (...values: string[]) => values.some((value) => matchesState(state.get(), value)),
    hasTag: (tag: string) => hasTag(machine, state.get(), tag),
  });

  function getParams(): Params<RuntimeSchema> {
    return {
      state: getState(),
      context: ctx,
      event: getEvent(),
      prop,
      send,
      action,
      guard,
      track,
      refs,
      computed: machineComputed,
      flush: batch,
      scope: zagScope,
      choose,
    };
  }

  function action(keys: ActionsOrFn<RuntimeSchema> | undefined): void {
    const names = isFunction(keys) ? keys(getParams()) : keys;
    if (!names) return;
    for (const name of names) {
      const fn = machine.implementations?.actions?.[name];
      if (!fn) warn(`[spin] No implementation found for action "${JSON.stringify(name)}"`);
      fn?.(getParams());
    }
  }

  function guard(key: string | ((params: Params<RuntimeSchema>) => boolean)): boolean | undefined {
    if (isFunction(key)) return key(getParams());
    const fn = machine.implementations?.guards?.[key];
    if (!fn) warn(`[spin] No implementation found for guard "${JSON.stringify(key)}"`);
    return fn?.(getParams());
  }

  function runEffects(keys: EffectsOrFn<RuntimeSchema> | undefined): VoidFunction | undefined {
    const names = isFunction(keys) ? keys(getParams()) : keys;
    if (!names) return undefined;
    const cleanups: VoidFunction[] = [];
    for (const name of names) {
      const fn = machine.implementations?.effects?.[name];
      if (!fn) warn(`[spin] No implementation found for effect "${JSON.stringify(name)}"`);
      const cleanup = fn?.(getParams());
      if (cleanup) cleanups.push(cleanup);
    }
    return cleanups.length === 0 ? undefined : () => cleanups.forEach((fn) => fn?.());
  }


  // `track` re-runs `fn` when any dependency moves. It has to be a real effect,
  // owned by the machine's scope: a machine that tracks a DOM ref and is never
  // disposed is the exact leak a custom element must not create.
  const track: Track = (deps, fn) => {
    let previous: unknown[] = [];
    let first = true;
    owner.run(() => {
      effect(() => {
        const latest = deps.map((dep) => dep());
        if (first) {
          first = false;
          previous = latest;
          return;
        }
        if (latest.some((value, index) => !isEqual(value, previous[index]))) {
          previous = latest;
          fn();
        }
      });
    });
  };


  // Zag's `ChooseFn` is a single transition, an array, or nothing; it returns
  // the first whose guard passes. Written here rather than imported so the
  // narrowing on `guard` is ours, not the schema's.
  const choose: ChooseFn<RuntimeSchema> = (transitions) =>
    toArray(transitions).find((transition) => {
      if (!transition?.guard) return true;
      if (isString(transition.guard)) return Boolean(guard(transition.guard));
      return transition.guard(getParams());
    }) as Transition<RuntimeSchema> | undefined;

  const initialState = resolveStateValue(machine, machine.initialState({ prop }));

  const state = createBindable<string>(
    () => ({
      defaultValue: initialState,
      onChange(nextState, previousState) {
        const { exiting, entering } = getExitEnterStates(
          machine,
          previousState,
          nextState,
          transitionRef.current?.reenter,
        );
        exiting.forEach((item) => {
          effects.get(item.path)?.();
          effects.delete(item.path);
        });
        exiting.forEach((item) => action(item.state?.exit));
        action(transitionRef.current?.actions);
        entering.forEach((item) => {
          const cleanup = runEffects(item.state?.effects);
          if (!cleanup) return;
          const existing = effects.get(item.path);
          effects.set(item.path, existing ? callAll(existing, cleanup) : cleanup);
        });
        if (previousState === INIT_STATE) {
          action(machine.entry);
          const cleanup = runEffects(machine.effects);
          if (cleanup) {
            const existing = effects.get(INIT_STATE);
            effects.set(INIT_STATE, existing ? callAll(existing, cleanup) : cleanup);
          }
        }
        entering.forEach((item) => action(item.state?.entry));
      },
    }),
    register,
  );

  let status = MachineStatus.NotStarted;

  register(() => {
    if (status !== MachineStatus.Started) return;
    debug("disposing...");
    status = MachineStatus.Stopped;
    effects.forEach((fn) => fn?.());
    effects.clear();
    transitionRef.current = undefined;
    action(machine.exit);
  });

  const replaceTracker = createReplaceTracker();

  const send: Service<RuntimeSchema>["send"] = (event) => {
    const key = event.replaces;
    const token = key ? replaceTracker.claim(key) : undefined;
    // Deferred, as every Zag adapter defers: an action is allowed to `send`
    // again, and a synchronous transition would recurse into itself. A machine
    // whose scope is gone swallows the event rather than reaching into DOM it
    // no longer owns.
    queueMicrotask(() => {
      if (key && token && replaceTracker.isReplaced(key, token)) return;
      if (status !== MachineStatus.Started) return;
      batch(() => {
        previousEventRef.current = eventRef.current;
        eventRef.current = event;
        const current = state.get();
        const { transitions, source } = findTransition(machine, current, event.type);
        const transition = choose(transitions);
        if (!transition) return;
        transitionRef.current = transition;
        const target = resolveStateValue(machine, transition.target ?? current, source);
        debug("transition", event.type, transition.target || current, `(${transition.actions})`);
        if (target !== current) {
          state.set(target);
        } else if (transition.reenter) {
          state.invoke(current, current);
        } else {
          action(transition.actions);
        }
      });
    });
  };

  machine.watch?.(getParams());

  status = MachineStatus.Started;
  debug("initializing...");
  state.invoke(initialState, INIT_STATE);

  return {
    state: getState(),
    send,
    context: ctx,
    prop,
    scope: zagScope,
    computed: machineComputed,
    refs,
    event: getEvent(),
    getStatus: () => status,
  };
}

/**
 * A live view over a value that changes.
 *
 * The proxy is what makes `const { api } = machine` safe: the object handed out
 * never changes, so a consumer cannot pin a stale field by holding on to it.
 * Every access is a version check on the computed plus one property read — the
 * whole API object is allocated only when the machine moves, never per read.
 */
function liveView<TValue extends object>(read: () => TValue): TValue {
  return new Proxy({} as TValue, {
    get: (_target, key) => Reflect.get(read(), key),
    has: (_target, key) => Reflect.has(read(), key),
    ownKeys: () => Reflect.ownKeys(read()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(read(), key);
      // An empty target cannot back a non-configurable key; the proxy invariant
      // demands it, and nothing here is ever non-configurable.
      return descriptor && { ...descriptor, configurable: true };
    },
  });
}

/**
 * Runs a Zag machine inside a scope and hands back a live view of its API.
 *
 * ```ts
 * const machine = createMachine(accordionMachine, { connect: accordionConnect });
 * machine.api.setValue(["overview"]);
 * machine.api.value; // ["overview"], re-read — never the value connect saw
 * ```
 */
export function createMachine<T extends MachineSchema, TApi extends object>(
  machineDef: Machine<T>,
  options: MachineOptions<T, TApi>,
): MachineBridge<T, TApi> {
  const owner = options.scope ?? createOwnerScope();
  // Nested: disposing the caller's scope reaches the machine, and `dispose`
  // stops the machine without touching the caller's other work. `run` links the
  // inner scope's effects to the outer group but not the teardowns it `own`s, so
  // that half of the cascade is wired explicitly.
  const machineScope = owner.run(() => {
    const nested = createOwnerScope();
    owner.own(() => nested.dispose());
    return nested;
  });
  const runtime = machineDef as unknown as Machine<RuntimeSchema>;
  const service = machineScope.run(() =>
    startMachine(
      runtime,
      options.props ?? {},
      machineScope,
      options.id,
      options.ids,
      options.getRootNode,
    ),
  ) as unknown as Service<T>;

  const normalize = options.normalize ?? domNormalize;
  // The one cast in this file that is not about Zag's schema widening: each
  // component declares its own normalizer type and `connect` takes it as
  // `never`. What we hand it is a passthrough unless the component overrode it.
  const connect = options.connect as (service: Service<T>, normalize: Normalize) => TApi;
  const connected = computed(() => connect(service, normalize));

  return {
    api: liveView(() => connected()),
    service,
    state: () => service.state.get(),
    send: service.send,
    prop: service.prop,
    context: service.context,
    computed: service.computed,
    scope: machineScope,
    dispose: () => machineScope.dispose(),
  };
}