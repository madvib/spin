/** Synthesize the bridge and the connect from a component definition.
 *
 * The output is the existing `MachineDef` seam — recipes, machine-defs,
 * and the plugin consume it unchanged. No hand-written `getXProps()`
 * exists for any component: parts declare attribute maps, commands
 * declare sends, events declare watches.
 *
 * The seam is being replaced: the machine becomes a headless factory, the
 * scope becomes a restricted `<script>`, and the transport moves into the
 * framework. Specified in `.agents/specs/`.
 */

import {
  dataAttr,
  keyed,
  memo,
  slotFieldKey,
  valueKey,
  WHOLE,
  type BagMemo,
  type BagReads,
  type ReadKind,
  type ReadRecorder,
} from "./bags.ts";
import { focuser, ids, measurer } from "./ids.ts";
import { authoredProps, defineBridge, pickCallback, type BridgeHooks, type BridgeLive } from "./bridge.ts";
import type { ComponentDef, PartScope, SlotDef, SlotScope } from "./define.ts";
import type { EventMap, EventUnion, Machine } from "@spin/runtime/fsm";
import type { MachineDef, MachineEventContract } from "../index.ts";


export function defineComponent<
  C extends object,
  E extends EventMap,
  Api extends object = Record<string, unknown>,
>(def: ComponentDef<C, E>): Omit<MachineDef, "createBridge"> & {
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
  };
} {
  // Parsed props memoize on the raw prop's identity across bridges: the key
  // is the raw value itself, so two elements never share a parse unless they
  // hold the identical prop — in which case sharing is correct.
  const hooks = (
    id: string,
    root: () => Element,
    machineLive: BridgeLive,
  ): BridgeHooks<C, E, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>> => {
    // The last event sent, which is what a controlled close reads to tell
    // a commit from a cancel — the `previousEvent` value. Per bridge, advanced
    // on every transmitted send (sync writes included).
    let lastEventType = "";
    const noteSent = (type: string): void => {
      lastEventType = type;
    };
    const names = ids(def.name, id);
    const segments = new Map<string, string>();
    for (const [key, partDef] of Object.entries(def.parts)) {
      segments.set(key, partDef.id ?? key);
    }
    for (const [key, slotDef] of Object.entries(def.slots ?? {})) {
      segments.set(key, slotDef.id ?? key);
    }
    const resolveId = (part: string, slot?: unknown): string =>
      names(segments.get(part) ?? part, slot);
    const host = { root };
    // The single trust point: the machine core is untyped, the def
    // declared C. Every context read below flows through here instead
    // of scattering double-casts at each call site.
    // The machine core is untyped at the seam; the def declared C.
    // BridgeService carries context directly, the core nests it under
    // state — both shapes resolve here instead of scattering casts.
    // The single trust point: machine-core and hook snapshots are
    // untyped at the seam; the def declared C. One assertion here
    // instead of casts scattered at every call site.
    const ctxOf = (
      svc:
        | { readonly state: { readonly context: unknown } }
        | { readonly context: unknown },
    ): C => {
      // A bridge service carries BOTH `context` and `state` — and its
      // `state` is the state NAME, a string. Testing "state" in svc
      // picked the wrong branch and every reader got an undefined
      // context. The shape of `state` decides, not its presence.
      const rec = svc as { readonly state?: unknown; readonly context?: unknown };
      const context = typeof rec.state === "object" && rec.state !== null
        ? (rec.state as { readonly context: unknown }).context
        : rec.context;
      return context as C;
    };
    const focusPart = focuser(names);
    const measurePart = measurer(names);
    // What the LAST bag build read: the context fields, the props, the
    // state and the slot's fields. The proxies record every read, so the
    // key that decides the next rebuild is derived from the reads rather
    // than written by hand.
    //
    // The recorders stack: a read belongs to the build that is running,
    // and a build can run inside another one (a read that syncs a
    // context field writes a signal, which re-runs an effect, which
    // builds another bag).
    const recorders: ReadRecorder[] = [];
    const record = (kind: ReadKind, key: string): void => {
      recorders[recorders.length - 1]?.(kind, key);
    };
    const bagMemos = new Map<string, ReturnType<typeof memo>>();
    const bagFor = (part: string): ReturnType<typeof memo> => {
      let found = bagMemos.get(part);
      if (found === undefined) {
        found = memo();
        bagMemos.set(part, found);
      }
      return found;
    };
    const lastWatched = new Map<string, readonly unknown[]>();
    const sameWatch = (a: readonly unknown[], b: readonly unknown[]): boolean =>
      a.length === b.length && a.every((value, index) => value === b[index]);

    return {
      noteSent,
      seed: (props, authored) => {
        // The legacy seed: a component that has not moved to a machine
        // factory still seeds its context from the props. A machine
        // factory builds its own context, so it needs none of this.
        return (def.seed?.(props(), authored) ?? {}) as Partial<C>;
      },

      establish: (_svc, props, authored) => {
        if (def.establish === undefined) return [];
        return def.establish(props(), authored) as readonly EventUnion<E>[];
      },
      kind: (event) => (def.commitEvents?.includes(event.type) === true ? "commit" : "move"),
      refresh: (svc, props, authored) => {
        if (def.scalars === undefined && def.scalarsOf === undefined) return false;
        const parsed = props();
        const context = ctxOf(svc);
        if (def.scalarsOf !== undefined) {
          const merge = def.scalarsOf(parsed, authored);
          let moved = false;
          // Dynamic merge application: computed string keys cannot be
          // checked against C. The merge values are already typed at
          // their scalarsOf construction site; this loop only assigns.
          const writable = context as unknown as Record<string, unknown>;
          for (const [key, value] of Object.entries(merge)) {
            if (writable[key] !== value) {
              writable[key] = value;
              moved = true;
            }
          }
          return moved;
        }
        // Nullish parses never merge: scalar channels default at parse,
        // so nullish means "prop absent, parse nullable" (largeStep before
        // its step-dependent default) — never a value the context holds.
        // Dynamic scalar application, same rationale as the merge loop:
        // names are strings, values already typed at their construction.
        const writable = context as unknown as Record<string, unknown>;
        let moved = false;
        for (const name of def.scalars ?? []) {
          if (parsed[name] === null || parsed[name] === undefined) continue;
          if (writable[name] !== parsed[name]) {
            writable[name] = parsed[name];
            moved = true;
          }
        }
        return moved;
      },
      notify: (svc, callbacks, kind, event, beforeSnapshot, parsed, source) => {
        const context = ctxOf(svc);
        const state = svc.state.value;
        const fns = callbacks as Record<string, (...args: readonly unknown[]) => void>;
        for (const [name, defEvent] of Object.entries(def.events)) {
          // Commit gestures fire `on: "commit"` events every time (a
          // keyboard commit at a bound still ends the gesture); moves fire
          // only what changed.
          if (defEvent.on === "commit" && kind !== "commit") continue;
          const watched = defEvent.watch(context, state);
          const last = lastWatched.get(name);
          lastWatched.set(name, watched);
          if (defEvent.select !== undefined) {
            // Event-gated reports (invokeOnSelect): the send's outcome
            // against the pre-send context; a refused guard reports nothing.
            const before = (beforeSnapshot as { readonly context?: C } | undefined)?.context;
            if (event === undefined || before === undefined) continue;
            const beforeState = (beforeSnapshot as { readonly state?: string } | undefined)?.state ?? state;
            const payload = defEvent.select(
              event as { readonly type: string } & Record<string, unknown>,
              before,
              context,
              { was: beforeState, is: state },
              source,
            );
            if (payload !== null) {
              // A queue diff reports each move: one payload per toast.
              if (Array.isArray(payload)) {
                for (const report of payload) fns[defEvent.prop]?.(report);
              } else fns[defEvent.prop]?.(payload);
            }
            continue;
          }
          if (defEvent.on !== "commit" && last !== undefined && sameWatch(last, watched)) continue;
          fns[defEvent.prop]?.(defEvent.detail(watched, event, parsed, context));
        }
      },
      readCallbacks: (props) => {
        const raw = props();
        const out: Record<string, (...args: readonly unknown[]) => void> = {};
        for (const event of Object.values(def.events)) {
          const found = pickCallback<(...args: readonly unknown[]) => void>(raw, event.prop);
          if (found !== undefined) out[event.prop] = found;
        }
        return out;
      },
      readConnectProps: (props) => props(),
      reconcile: (svc, state, parsed, authored, send) => {
        if (def.reconcile === undefined) return false;
        return def.reconcile({
          context: ctxOf(svc),
          state,
          parsed,
          authored,
          send: send as (event: { type: string } & Record<string, unknown>) => void,
        });
      },
      mounted: ({ props: readRaw }) => {
        if (def.mounted === undefined) return;
        def.mounted({ props: readRaw(), root, id: resolveId, focus: focusPart, measure: measurePart });
      },
      settled: ({ event, before, after, props: readRaw, send }) => {
        if (def.settled === undefined) return;
        def.settled({
          event: event as { readonly type: string } & Record<string, unknown>,
          before,
          after,
          props: readRaw(),
          root,
          id: resolveId,
          focus: focusPart,
          measure: measurePart,
          send: (report: { readonly type: string } & Record<string, unknown>): void => {
            send(report as EventUnion<E>);
          },
        });
      },
      connect: (service, readProps, id) => {
        const focusHere = focuser(ids(def.name, id));
        const measureHere = measurer(ids(def.name, id));
        const dispatch = (event: { type: string } & Record<string, unknown>): void => {
          service.send(
            (def.dispatch !== undefined ? def.dispatch(event, readProps()) : event) as EventUnion<E>,
          );
        };
        const api: Record<string, unknown> = {};
        for (const [name, command] of Object.entries(def.commands)) {
          if (command.view !== undefined) {
            const view = command.view;
            api[name] = (...args: readonly unknown[]) =>
              view({ args, id: resolveId, focus: focusHere, measure: measureHere, root });
            continue;
          }
          const send = command.event;
          api[name] = (...args: readonly unknown[]) => dispatch(
            send(args, ctxOf(service), resolveId) as unknown as { type: string } & Record<string, unknown>,
          );
        }
        // The api's readers read the SIGNALS, like the scope's context
        // does: a read in the markup's expression (a bound class, say)
        // subscribes to the field it read, and the class re-applies when
        // the field moves.
        const liveContext = new Proxy({} as C, {
          get: (_target, key: string) => machineLive.field(key),
          has: (_target, key: string) => machineLive.field(key) !== undefined,
        });
        for (const [name, reader] of Object.entries(def.readers ?? {})) {
          Object.defineProperty(api, name, {
            get: () => reader.read(
              liveContext,
              machineLive.state(),
              readProps(),
              root,
            ),
            enumerable: true,
          });
        }
        // The machine's state, live: a read of it subscribes, so the
        // markup can bind a class to it. A component that declares its
        // own `state` reader keeps it — the framework's is the default.
        if (def.readers?.["state"] === undefined) {
          Object.defineProperty(api, "state", {
            get: () => machineLive.state(),
            enumerable: true,
          });
        }
        for (const [name, method] of Object.entries(def.methods ?? {})) {
          api[name] = (...args: readonly unknown[]) => method.call(
            ctxOf(service),
            service.state,
            args,
            readProps(),
            resolveId,
          );
        }
        /** The slot, as the scope hands it over: a recording proxy, so a
         * field read inside the build is a dependency the key can see.
         * A coercion (the slot as a string) and an iteration (the slot
         * spread apart) take the slot whole, and the key counts every
         * field then.
         *
         * One proxy per raw slot: a component keys its own caches by the
         * slot (a row's handlers live in a WeakMap), and a fresh proxy per
         * read would miss every time. */
        const slotProxies = new WeakMap<object, object>();
        const slotProxy = (raw: object): object => {
          const found = slotProxies.get(raw);
          if (found !== undefined) return found;
          const made = new Proxy(raw, {
            get: (target, key) => {
              record(
                "slot",
                typeof key === "symbol" || key === "toString" || key === "valueOf" ? WHOLE : key,
              );
              return Reflect.get(target, key);
            },
            has: (target, key) => {
              record("slot", typeof key === "symbol" ? WHOLE : key);
              return Reflect.has(target, key);
            },
            ownKeys: (target) => {
              record("slot", WHOLE);
              return Reflect.ownKeys(target);
            },
          });
          slotProxies.set(raw, made);
          return made;
        };
        /** The recipe's argument, as the build sees it. A primitive has
         * no field to name, so the whole value is the dependency. */
        const argument = (rec: ReadRecorder, raw: unknown): unknown => {
          if (raw === undefined) return undefined;
          if (typeof raw !== "object" || raw === null) {
            rec("slot", WHOLE);
            return raw;
          }
          return slotProxy(raw);
        };
        /** The key a bag's reads make: the values of the fields it read.
         * A primitive compares by its value, an object by its identity:
         * a replaced array is a changed field even when its length is
         * the same. */
        const readsKey = (reads: BagReads, slot: unknown): string => {
          const ctx = ctxOf(service) as unknown as Record<string, unknown>;
          const props = readProps();
          const parts: string[] = [];
          for (const field of reads.context) parts.push(`c:${field}=${valueKey(ctx[field])}`);
          for (const prop of reads.props) parts.push(`p:${prop}=${valueKey(props[prop])}`);
          if (reads.state) parts.push(`s=${valueKey(service.state)}`);
          for (const field of reads.slot) {
            parts.push(`l:${field}=${slotFieldKey(slot, field)}`);
          }
          return parts.join("\u0000");
        };
        function liveScope(extra: { readonly slot: unknown }): SlotScope<unknown, C>;
        function liveScope(): PartScope<unknown, C>;
        function liveScope(extra?: { readonly slot: unknown }): PartScope<unknown, C> | SlotScope<unknown, C> {
          // Live views, not snapshots: a closure cached by row (or by part)
          // keeps reading through these, so it never goes stale — while the
          // bag memo still bounds rebuilds by signature. Proxies cost a
          // lookup per read; bags build rarely, handlers fire rarely.
          const props = new Proxy({} as Record<string, unknown>, {
            get: (_target, key: string) => {
              record("props", key);
              return readProps()[key];
            },
            has: (_target, key: string) => key in readProps(),
          });
          // Dynamic bag reads: the attrs key arbitrary context fields
          // by string at render time. Untypeable by construction; the
          // values are typed at their binding-declared seams instead.
          // The lookup runs per read (not once at scope creation): a
          // handler cached across transmits must see post-send state.
          const live = (): Record<string, unknown> =>
            ctxOf(service) as unknown as Record<string, unknown>;
          // The context's fields are SIGNALS: reading one here, inside a
          // computed, subscribes to that field and to nothing else. The
          // mirror is the single writer, so a read never writes.
          const context = new Proxy({} as Record<string, unknown>, {
            get: (_target, key: string) => {
              record("context", key);
              const value = live()[key];
              machineLive.sync(key, value);
              return value;
            },
            has: (_target, key: string) => key in live(),
          });
          const raw = extra?.slot;
          const scope: Record<string, unknown> = {
            props,
            context,
            root,
            id: resolveId,
            measure: measurePart,
            send: dispatch,
            attr: dataAttr,
            slot: typeof raw === "object" && raw !== null ? slotProxy(raw) : raw,
          };
          Object.defineProperty(scope, "state", {
            get: () => {
              record("state", "");
              return service.state;
            },
            enumerable: true,
          });
          return scope as unknown as PartScope<unknown, C> | SlotScope<unknown, C>;
        }
        for (const [part, partDef] of Object.entries(def.parts)) {
          const method = `get${part[0]?.toUpperCase() ?? ""}${part.slice(1)}Props`;
          api[method] = (...callArgs: readonly unknown[]) => {
            const raw = callArgs[0];
            const scope = liveScope({ slot: raw });
            // The key comes from the reads: a part that forgot to name a
            // field it depends on can no longer go stale.
            const bag = bagFor(part);
            return bag(
              (reads) => readsKey(reads, raw),
              (rec) => {
                recorders.push(rec);
                try {
                  return partDef.attrs(scope, argument(rec, raw));
                } finally {
                  recorders.pop();
                }
              },
            );
          };
        }
        for (const [slotName, slotDef] of Object.entries(def.slots ?? {}) as [string, SlotDef<unknown, C>][]) {
          const cap = `${slotName[0]?.toUpperCase() ?? ""}${slotName.slice(1)}`;
          const slotMemos = new WeakMap<object, BagMemo>();
          api[`get${cap}Props`] = (slot: object, ...callArgs: readonly unknown[]) => {
            const scope = liveScope({ slot });
            return keyed(
              slotMemos,
              slot,
              (reads) => readsKey(reads, slot),
              (rec) => {
                recorders.push(rec);
                try {
                  return slotDef.attrs(scope, argument(rec, callArgs[0]));
                } finally {
                  recorders.pop();
                }
              },
            );
          };
          // Stable identities: a fresh identity per read re-stamps rows.
          // Rows/blocks memoize on the collection's identity upstream, so
          // this caches per source array, not per length.
          let source: readonly unknown[] | undefined;
          let cached: readonly unknown[] = [];
          api[`get${cap}Indexes`] = () => {
            const context = ctxOf(service);
            const next = slotDef.indexes(context, readProps());
            if (next !== source) {
              source = next;
              cached = next;
            }
            return cached;
          };
        }
        return api;
      },
    };
  };

  const createBridge = (
    props: () => Record<string, unknown>,
    root: () => Element,
    id: string,
  ): { readonly api: Api; dispose(): void } => {
    if (def.machine === undefined) {
      throw new Error(`[spin] ${def.name} has no machine`);
    }
    const startState = typeof def.start === "function"
      ? def.start(props(), authoredProps(props))
      : def.start;
    const bridged = defineBridge(
      {
        machine: def.machine,
        ...(startState === undefined ? {} : { startState }),
        hooks,
      },
      props,
      id,
      root,
    );
    return bridged as unknown as { readonly api: Api; dispose(): void };
  };

  // The bridge callback already receives the payload `def.events[name].detail`
  // built (notify maps watch -> payload). The element calls this contract
  // mapper with that payload to build the CustomEvent detail, so it passes
  // through what notify reported.
  const events: Record<string, MachineEventContract<Record<string, unknown>>> = {};
  for (const [name, event] of Object.entries(def.events)) {
    // deno-lint-ignore no-explicit-any
    events[name] = { on: event.prop, detail: (change: any) => change };
  }

  // Machine authorship surface: recipe-check imports defs and validates
  // example expressions against this — a misspelled reader is a compile
  // error, not a silent empty render.
  const manifest = {
    parts: Object.keys(def.parts),
    slots: Object.keys(def.slots ?? {}),
    // `state` is the framework's own reader: the machine's mode, live. A
    // component that declares its own keeps it, and the name is the same.
    readers: [...Object.keys(def.readers ?? {}), "state"],
    methods: Object.keys(def.methods ?? {}),
  };
  return {
    createBridge,
    commands: Object.keys(def.commands),
    events,
    manifest,
  };
}
