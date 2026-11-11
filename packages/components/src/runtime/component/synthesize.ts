import {
  type EventMap,
  interpret,
  type Machine,
  type Service,
} from "../machine/fsm/machine.ts";
import { computed, effect, scope, untrack } from "../core/signal.ts";
import {
  type AnyEvent,
  type ApiOf,
  type ComponentDef,
  dataAttr,
} from "./define.ts";
import { focuser, ids, measurer } from "./ids.ts";
import { resolveTwins } from "../props.ts";
import type { MachineDef } from "../index.ts";
/**
 * The props the host actually wrote, as a predicate.
 * Controlled components live on the authored/written split: a host that
 * writes `value` owns it, and the element marks the write so the bridge can
 * tell a live prop from a coerced default.
 */
export function authoredProps(
  props: () => Record<string, unknown>,
): (name: string) => boolean {
  return (name) => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? predicate(name) : false;
  };
}

/** A callback prop, when the host wrote a function for it. */
export function pickCallback<T>(
  props: Record<string, unknown>,
  name: string,
): T | undefined {
  const value = props[name];
  return typeof value === "function" ? (value as T) : undefined;
}

/** A text prop, or empty when the host wrote anything else. */
export function textProp(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

function applyContract(
  svc: Service<object, EventMap, string>,
  fields: Readonly<
    Record<
      string,
      {
        readonly event?: string | undefined;
        readonly parse?: ((raw: unknown) => unknown) | undefined;
      }
    >
  >,
  props: () => Record<string, unknown>,
  authored: (name: string) => boolean,
  cursor: Map<string, unknown>,
  send: (event: { type: string } & Record<string, unknown>) => void,
): {
  readonly moved: boolean;
  readonly events: readonly ({ type: string } & Record<string, unknown>)[];
} {
  if (Object.keys(fields).length === 0) return { moved: false, events: [] };
  const parsed = props();
  const context = svc.state.context as unknown as Record<string, unknown>;
  const events: ({ type: string } & Record<string, unknown>)[] = [];
  let moved = false;
  for (const [field, contract] of Object.entries(fields)) {
    const raw = parsed[field];
    if (raw === undefined || raw === null) continue;
    if (!authored(field)) continue;
    if (Object.is(cursor.get(field), raw)) continue;
    cursor.set(field, raw);
    if (contract.event === undefined) {
      const value = contract.parse === undefined ? raw : contract.parse(raw);
      // Through `setContext`, not a direct write: the field signals fire
      // only on commit, and a direct write bypasses them — the prop lands
      // in the context but no reader (getBlocks, data-empty) re-runs.
      if (context[field] !== value) {
        svc.setContext({ [field]: value } as Partial<object>);
        moved = true;
      }
      continue;
    }
    const event = { type: contract.event, [field]: raw };
    events.push(event);
    moved = true;
    send(event);
  }
  return { moved, events };
}

const sameWatch = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export type DefinedComponent<Api extends object, A = unknown> =
  & ((args?: A) => Api)
  & Omit<MachineDef, "createBridge">
  & {
    readonly name: string;
    readonly fields: readonly string[];
    readonly createBridge: (
      props: () => Record<string, unknown>,
      root: () => Element,
      id: string,
    ) => { readonly api: Api; dispose(): void };
    readonly manifest: {
      readonly parts: readonly string[];
      readonly slots: readonly string[];
      readonly readers: readonly string[];
      readonly methods: readonly string[];
      readonly commands: readonly string[];
      readonly events: readonly string[];
    };
  };

export function defineComponent<
  const D extends ComponentDef<never, never, never, never, never, never, never>,
>(
  def: D,
): D extends ComponentDef<infer _C, infer _E, infer _P, infer A, infer _S, never, never>
  ? DefinedComponent<ApiOf<D>, A>
  : never;
export function defineComponent<
  C extends object,
  E extends EventMap,
  Api extends object,
  A = unknown,
  S extends string = string,
>(
  def: ComponentDef<C, E, Record<string, unknown>, A, S>,
): DefinedComponent<Api, A>;
export function defineComponent(
  def: ComponentDef<object, EventMap, Record<string, unknown>, unknown, string>,
): DefinedComponent<object, unknown> {
  const segments = new Map<string, string>();
  for (const [key, partDef] of Object.entries(def.parts)) {
    segments.set(key, partDef.id ?? key);
  }
  for (const [key, slotDef] of Object.entries(def.slots ?? {})) {
    segments.set(key, slotDef.id ?? key);
  }
  const createBridge = (
    props: () => Record<string, unknown>,
    root: () => Element = () => {
      throw new Error("[spin] bridge needs a root element");
    },
    id: string,
  ): { readonly api: object; dispose(): void } => {
    if (def.machine === undefined) {
      throw new Error(`[spin] ${def.name} has no machine`);
    }
    const owner = scope();
    const lastContract = new Map<string, unknown>();
    const lastWatched = new Map<string, readonly unknown[]>();
    const authored = authoredProps(props);
    const names = ids(def.name, id);
    const resolveId = (part: string, slot?: unknown): string =>
      names(segments.get(part) ?? part, slot);
    const focusPart = focuser(names);
    const measurePart = measurer(names);
    let machine: Machine<object, EventMap, string> | undefined;
    const machineOf = (): Machine<object, EventMap, string> => {
      if (machine !== undefined) return machine;
      const resolved = resolveTwins(props(), authored);
      const args = (def.args === undefined ? resolved : def.args(resolved)) as never;
      machine = (def.machine as NonNullable<typeof def.machine>)(args, authored);
      return machine;
    };

    const refresh = (svc: Service<object, EventMap, string>): boolean => {
      if (def.scalars === undefined && def.scalarsOf === undefined) {
        return false;
      }
      const parsed = props();
      const writable = svc.state.context as unknown as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (def.scalarsOf !== undefined) {
        const merge = def.scalarsOf(parsed, authored);
        for (const [key, value] of Object.entries(merge)) {
          if (writable[key] !== value) patch[key] = value;
        }
      } else {
        for (const name of def.scalars ?? []) {
          if (parsed[name] === null || parsed[name] === undefined) continue;
          if (writable[name] !== parsed[name]) patch[name] = parsed[name];
        }
      }
      if (Object.keys(patch).length === 0) return false;
      svc.setContext(patch as Partial<object>);
      return true;
    };

    const readCallbacks = (): Record<
      string,
      (...args: readonly unknown[]) => void
    > => {
      const raw = props();
      const out: Record<string, (...args: readonly unknown[]) => void> = {};
      for (const event of Object.values(def.events)) {
        const found = pickCallback<(...args: readonly unknown[]) => void>(
          raw,
          event.prop,
        );
        if (found !== undefined) out[event.prop] = found;
      }
      return out;
    };

    const notify = (
      svc: Service<object, EventMap, string>,
      callbacks: Record<string, (...args: readonly unknown[]) => void>,
      kind: "move" | "commit",
      event: { type: string } & Record<string, unknown> | undefined,
      beforeSnapshot: { context: object; state: string } | undefined,
      parsed: Record<string, unknown>,
      source?: string,
    ): void => {
      const context = svc.state.context;
      const state = svc.state.value;
      for (const [name, defEvent] of Object.entries(def.events)) {
        if (defEvent.on === "commit" && kind !== "commit") continue;
        const watched = defEvent.watch(context, state);
        const last = lastWatched.get(name);
        lastWatched.set(name, watched);
        if (defEvent.select !== undefined) {
          const before = beforeSnapshot?.context;
          if (event === undefined || before === undefined) continue;
          const beforeState = beforeSnapshot?.state ?? state;
          const payload = defEvent.select(event, before, context, {
            was: beforeState,
            is: state,
          }, source);
          if (payload !== null) {
            if (Array.isArray(payload)) {
              for (const report of payload) callbacks[defEvent.prop]?.(report);
            } else callbacks[defEvent.prop]?.(payload);
          }
          continue;
        }
        if (defEvent.on !== "commit" && last !== undefined && sameWatch(last, watched)) {
          continue;
        }
        callbacks[defEvent.prop]?.(defEvent.detail(watched, event, parsed, context));
      }
    };

    let service: Service<object, EventMap, string> | undefined;

    const transmit = (
      event: { type: string } & Record<string, unknown>,
    ): {
      readonly svc: Service<object, EventMap, string>;
      readonly before: { context: object; state: string };
    } => {
      const svc = ensureService();
      refresh(svc);
      const before = {
        context: { ...svc.state.context },
        state: svc.state.value,
      };
      svc.send(event as never);
      def.settled?.({
        event: event as AnyEvent,
        before,
        after: { context: svc.state.context, state: svc.state.value },
        props: props(),
        root,
        id: resolveId,
        focus: focusPart,
        measure: measurePart,
        send: (report: AnyEvent): void => send(report as never),
      });
      return { svc, before };
    };

    const send = (event: { type: string } & Record<string, unknown>): void => {
      const { svc, before } = transmit(event);
      notify(
        svc,
        readCallbacks(),
        def.commitEvents?.includes(event.type) === true ? "commit" : "move",
        event,
        before,
        props(),
      );
    };

    const ensureService = (): Service<object, EventMap, string> => {
      if (service !== undefined) return service;
      const startState = typeof def.start === "function"
        ? def.start(props(), authored)
        : def.start;
      service = owner.run(() => {
        const svc = interpret(machineOf()).start(startState);
        refresh(svc);
        return svc;
      });
      for (const event of def.establish?.(props(), authored) ?? []) {
        transmit(event as { type: string } & Record<string, unknown>);
      }
      notify(service, {}, "move", undefined, undefined, props());
      return service;
    };

    const dispatch = (event: { type: string } & Record<string, unknown>): void => {
      send(
        (def.dispatch !== undefined
          ? def.dispatch(event, props())
          : event) as { type: string } & Record<string, unknown>,
      );
    };

    let api: Record<string, unknown> | undefined;
    let mounted = false;

    const ensureConnect = (): Record<string, unknown> => {
      if (api !== undefined) return api;
      const svc = ensureService();
      const built: Record<string, unknown> = {};

      for (const [name, command] of Object.entries(def.commands)) {
        if (command.view !== undefined) {
          const view = command.view;
          built[name] = (...args: readonly unknown[]) =>
            view({
              args,
              id: resolveId,
              focus: focusPart,
              measure: measurePart,
              root,
            });
          continue;
        }
        const toEvent = command.event;
        built[name] = (...args: readonly unknown[]) =>
          dispatch(
            toEvent(args, svc.state.context, resolveId) as { type: string } & Record<
              string,
              unknown
            >,
          );
      }

      for (const [name, reader] of Object.entries(def.readers ?? {})) {
        Object.defineProperty(built, name, {
          get: () =>
            reader.read(svc.state.context, svc.state.value, props(), root),
          enumerable: true,
        });
      }

      if (def.readers?.["state"] === undefined) {
        Object.defineProperty(built, "state", {
          get: () => svc.state.value,
          enumerable: true,
        });
      }

      for (const [name, method] of Object.entries(def.methods ?? {})) {
        built[name] = (...args: readonly unknown[]) =>
          method.call(
            svc.state.context,
            svc.state.value,
            args,
            props(),
            resolveId,
          );
      }

      const liveProps = new Proxy({} as Record<string, unknown>, {
        get: (_target, key) => props()[key as string],
        has: (_target, key) => typeof key === "string" && key in props(),
      });

      const viewFor = (
        slot?: unknown,
      ): Record<string, unknown> => {
        const view: Record<string, unknown> = {
          props: liveProps,
          context: svc.state.context,
          root,
          id: resolveId,
          measure: measurePart,
          send: dispatch,
          attr: dataAttr,
          slot,
        };
        Object.defineProperty(view, "state", {
          get: () => svc.state.value,
          enumerable: true,
        });
        return view;
      };

      const baseView = viewFor(undefined);
      const zeroArgBags = new Map<string, () => Record<string, unknown>>();

      for (const [part, partDef] of Object.entries(def.parts)) {
        const method = `get${part[0]?.toUpperCase() ?? ""}${part.slice(1)}Props`;
        const segment = partDef.id ?? part;
        built[method] = (...callArgs: readonly unknown[]) => {
          const raw = callArgs[0];
          if (raw === undefined) {
            let cached = zeroArgBags.get(part);
            if (cached === undefined) {
              const run = computed(() => ({
                id: resolveId(part === "root" ? "" : part),
                "data-scope": def.name,
                "data-part": segment,
                ...(partDef.attrs === undefined
                  ? {}
                  : partDef.attrs(baseView as never, undefined)),
              }));
              cached = () => run();
              zeroArgBags.set(part, cached);
            }
            return cached();
          }
          const stamped = {
            id: resolveId(part === "root" ? "" : part),
            "data-scope": def.name,
            "data-part": segment,
          };
          if (partDef.attrs === undefined) return stamped;
          return {
            ...stamped,
            ...partDef.attrs(raw === undefined ? baseView as never : viewFor(raw) as never, raw as never),
          };
        };
      }

      for (const [slotName, slotDef] of Object.entries(def.slots ?? {})) {
        const cap = `${slotName[0]?.toUpperCase() ?? ""}${slotName.slice(1)}`;
        const segment = slotDef.id ?? slotName;
        built[`get${cap}Props`] = (slot: unknown, ...callArgs: readonly unknown[]) => {
          const attrs = slotDef.attrs(viewFor(slot) as never, callArgs[0] as never);
          if (slotDef.stamp === false) return attrs;
          return {
            "data-scope": def.name,
            "data-part": segment,
            ...attrs,
          };
        };
        const indexesMemo = computed(() =>
          slotDef.indexes(svc.state.context as never, props())
        );
        built[`get${cap}Indexes`] = () => indexesMemo();
      }

      api = built;
      if (!mounted) {
        mounted = true;
        def.mounted?.({
          props: props(),
          root,
          id: resolveId,
          focus: focusPart,
          measure: measurePart,
        });
      }
      return api;
    };

    owner.run(() =>
      effect(() => {
        props();
        untrack(() => {
          const svc = ensureService();
          const beforeContext = {
            context: { ...svc.state.context },
            state: svc.state.value,
          };
          refresh(svc);
          const syncResult = applyContract(
            svc,
            machineOf().fields,
            props,
            authored,
            lastContract,
            (event) => transmit(event as { type: string } & Record<string, unknown>),
          );
          const parsed = props();
          const reconciled: ({ type: string } & Record<string, unknown>)[] = [];
          const derivedMoved =
            def.reconcile?.({
              context: svc.state.context as never,
              state: svc.state.value as never,
              parsed,
              authored,
              send: (event) => {
                const typed = event as { type: string } & Record<string, unknown>;
                reconciled.push(typed);
                transmit(typed);
              },
            }) ?? false;

          const kindOf = (type: string): "move" | "commit" =>
            def.commitEvents?.includes(type) === true ? "commit" : "move";

          for (const event of syncResult.events) {
            notify(
              svc,
              readCallbacks(),
              kindOf(event.type as string),
              event as { type: string } & Record<string, unknown>,
              beforeContext,
              props(),
            );
          }
          if (reconciled.length > 0) {
            const last = reconciled[reconciled.length - 1];
            if (last !== undefined) {
              notify(
                svc,
                readCallbacks(),
                kindOf(last.type),
                last,
                beforeContext,
                props(),
                "reconcile",
              );
            }
          }
          if (
            syncResult.events.length === 0 && reconciled.length === 0 &&
            derivedMoved
          ) {
            notify(
              svc,
              readCallbacks(),
              "commit",
              undefined,
              beforeContext,
              props(),
            );
          }
        });
      })
    );

    const proxy = new Proxy({} as Record<string, unknown>, {
      get: (_target, key) => Reflect.get(ensureConnect(), key as string),
      has: (_target, key) => Reflect.has(ensureConnect(), key as string),
      ownKeys: () => Reflect.ownKeys(ensureConnect()),
      getOwnPropertyDescriptor: (_target, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(
          ensureConnect(),
          key as string,
        );
        if (descriptor === undefined) return undefined;
        return { ...descriptor, configurable: true };
      },
    });

    return {
      api: proxy as object,
      dispose: () => {
        service?.stop();
        owner.dispose();
      },
    };
  };

  const events: Record<string, { on: string; detail: (change: unknown) => unknown }> = {};
  for (const [name, event] of Object.entries(def.events)) {
    events[name] = {
      on: event.prop,
      detail: (change: unknown) => change,
    };
  }

  const fieldSet = new Set<string>(def.scalars ?? []);
  for (const event of Object.values(def.events)) fieldSet.add(event.prop);
  if (def.machine !== undefined) {
    try {
      const probed = (def.machine as (args: Record<string, unknown>, authored: (name: string) => boolean) => {
        fields: Record<string, unknown>;
        initialState: { context: Record<string, unknown> };
      })(def.args === undefined ? {} : (def.args({}) as Record<string, unknown>), () => false);
      for (const key of Object.keys(probed.fields)) fieldSet.add(key);
      for (const key of Object.keys(probed.initialState.context)) {
        fieldSet.add(key);
      }
    } catch {
      // A machine that needs live props to construct cannot be probed.
    }
  }

  const manifest = {
    parts: Object.keys(def.parts),
    slots: Object.keys(def.slots ?? {}),
    readers: [...Object.keys(def.readers ?? {}), "state"],
    methods: Object.keys(def.methods ?? {}),
    commands: Object.keys(def.commands ?? {}),
    events: Object.keys(def.events ?? {}),
  };

  const component = (_args?: unknown): never => {
    throw new Error(
      `[spin] ${def.name}() is a <script> binding compiled by spin-components; use ${def.name}.createBridge() for imperative bridges`,
    );
  };
  Object.defineProperty(component, "name", { value: def.name });

  return Object.assign(component, {
    fields: [...fieldSet],
    createBridge,
    commands: Object.keys(def.commands),
    events,
    manifest,
  // deno-lint-ignore no-explicit-any
  }) as any;
}
