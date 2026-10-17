/** Synthesize the bridge and the connect from a component definition.
 *
 * The output is the existing `MachineDef` seam — recipes, machine-defs,
 * and the plugin consume it unchanged. No hand-written `getXProps()`
 * exists for any component: parts declare attribute maps, commands
 * declare sends, events declare watches. */

import { dataAttr, keyed, memo, type BagMemo } from "./bags.ts";
import { focuser, ids } from "./ids.ts";
import { authoredProps, defineBridge, pickCallback, type BridgeHooks } from "./bridge.ts";
import type { ComponentDef, PartScope, SlotScope } from "./define.ts";
import type { MachineDef, MachineEventContract } from "../index.ts";

const parseProp = <C extends object, E extends { type: string }>(
  def: ComponentDef<C, E>,
  props: () => Record<string, unknown>,
  cache?: Map<string, { raw: unknown; parsed: unknown }>,
  host?: { readonly root: () => Element },
): Record<string, unknown> => {
  const raw = props();
  const out: Record<string, unknown> = {};
  for (const [name, channel] of Object.entries(def.channels)) {
    // Parsed props memoize on the raw prop's identity: a collection parse
    // builds row objects, and a fresh array per read would look like a new
    // item tree — re-rendering every row and orphaning in-flight gestures.
    // Host-root reads bypass the cache: the element property may mutate
    // without the scope prop moving.
    const input = raw[name];
    const rootRead = input === undefined && host !== undefined;
    if (cache !== undefined && !rootRead) {
      const hit = cache.get(name);
      if (hit !== undefined && hit.raw === input) {
        out[name] = hit.parsed;
        continue;
      }
      const parsed = channel.parse(input, host);
      cache.set(name, { raw: input, parsed });
      out[name] = parsed;
      continue;
    }
    out[name] = channel.parse(input, host);
  }
  return out;
};

export function defineComponent<
  C extends object,
  E extends { type: string },
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
    readonly channels: readonly string[];
  };
} {
  // Parsed props memoize on the raw prop's identity across bridges: the key
  // is the raw value itself, so two elements never share a parse unless they
  // hold the identical prop — in which case sharing is correct.
  const parsedCache = new Map<string, { raw: unknown; parsed: unknown }>();
  const hooks = (
    id: string,
    root: () => Element,
  ): BridgeHooks<C, E, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>> => {
    // The last event sent, which is what a controlled close reads to tell
    // a commit from a cancel — Zag's `previousEvent`. Per bridge, advanced
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
    const parse = (props: () => Record<string, unknown>): Record<string, unknown> =>
      parseProp(def, props, parsedCache, host);
    const focusPart = focuser(names);
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
      seed: (props, authored) => def.seed(parse(props), authored) as Partial<C>,
      establish: (_svc, props, authored) => {
        if (def.establish === undefined) return [];
        const parsed = parse(props);
        return def.establish(parsed, authored) as readonly E[];
      },
      sync: (svc, props, authored, send) => {
        let moved = false;
        const events: E[] = [];
        const parsed = parse(props);
        for (const [name, channel] of Object.entries(def.channels)) {
          if (channel.controlled !== true) continue;
          if (!authored(name)) continue;
          const outer = parsed[name];
          // A failed parse never alternates — unless the channel declares
          // null a value (a nullable clear), not a failure.
          if (outer === null && channel.nullable !== true) continue;
          if (outer === undefined) continue;
          const context = (svc.state.context as object) as Record<string, unknown>;
          const current = channel.current !== undefined
            ? channel.current(context, svc.state.value)
            : context[name];
          const same = channel.equal ?? ((a, b) => a === b);
          if (!same(current, outer)) {
            // Assign-mode writes (and explicit silent channels) apply
            // without reporting; the machine's own sends own the events.
            const silent = channel.assign === true || channel.silent === true;
            if (channel.assign === true) {
              ((svc.state.context as object) as Record<string, unknown>)[name] = outer;
            } else {
              const event = channel.event(
                outer as never,
                (svc.state.context as object) as Record<string, unknown>,
                lastEventType,
              ) as E;
              send(event);
              if (!silent) events.push(event);
            }
            moved = true;
          }
        }
        return { moved, events };
      },
      kind: (event) => (def.commitEvents?.includes(event.type) === true ? "commit" : "move"),
      refresh: (svc, props, authored) => {
        if (def.scalars === undefined && def.scalarsOf === undefined) return false;
        const parsed = parse(props);
        const context = (svc.state.context as object) as Record<string, unknown>;
        if (def.scalarsOf !== undefined) {
          const merge = def.scalarsOf(parsed, authored);
          let moved = false;
          for (const [key, value] of Object.entries(merge)) {
            if (context[key] !== value) {
              context[key] = value;
              moved = true;
            }
          }
          return moved;
        }
        // Nullish parses never merge: scalar channels default at parse,
        // so nullish means "prop absent, parse nullable" (largeStep before
        // its step-dependent default) — never a value the context holds.
        let moved = false;
        for (const name of def.scalars ?? []) {
          if (parsed[name] === null || parsed[name] === undefined) continue;
          if (context[name] !== parsed[name]) {
            context[name] = parsed[name];
            moved = true;
          }
        }
        return moved;
      },
      notify: (svc, callbacks, kind, event, beforeSnapshot, parsed, source) => {
        const context = (svc.state.context as object) as Record<string, unknown>;
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
            const before = (beforeSnapshot as { readonly context?: Record<string, unknown> } | undefined)?.context;
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
      readConnectProps: (props) => parse(props),
      reconcile: (svc, state, parsed, authored, send) => {
        if (def.reconcile === undefined) return false;
        return def.reconcile({
          context: (svc.state.context as object) as Record<string, unknown>,
          state,
          parsed,
          authored,
          send: send as (event: { type: string } & Record<string, unknown>) => void,
        });
      },
      mounted: ({ props: readRaw }) => {
        if (def.mounted === undefined) return;
        def.mounted({ props: parse(readRaw), root, id: resolveId, focus: focusPart });
      },
      settled: ({ event, before, after, props: readRaw, send }) => {
        if (def.settled === undefined) return;
        def.settled({
          event: event as { readonly type: string } & Record<string, unknown>,
          before: (before as object) as Record<string, unknown>,
          after: (after as object) as Record<string, unknown>,
          props: parse(readRaw),
          root,
          id: resolveId,
          focus: focusPart,
          send: (report: { readonly type: string } & Record<string, unknown>): void => {
            send(report as E);
          },
        });
      },
      connect: (service, readProps, id) => {
        const focusHere = focuser(ids(def.name, id));
        const dispatch = (event: { type: string } & Record<string, unknown>): void => {
          service.send((def.dispatch !== undefined ? def.dispatch(event, readProps()) : event) as E);
        };
        const api: Record<string, unknown> = {};
        for (const [name, command] of Object.entries(def.commands)) {
          if (command.view !== undefined) {
            const view = command.view;
            api[name] = (...args: readonly unknown[]) => view({ args, id: resolveId, focus: focusHere });
            continue;
          }
          const send = command.event;
          api[name] = (...args: readonly unknown[]) => dispatch(
            send(args, (service.context as object) as Record<string, unknown>, resolveId) as unknown as { type: string } & Record<string, unknown>,
          );
        }
        for (const [name, reader] of Object.entries(def.readers ?? {})) {
          Object.defineProperty(api, name, {
            get: () => reader.read(
              (service.context as object) as Record<string, unknown>,
              service.state,
              readProps(),
              root,
            ),
            enumerable: true,
          });
        }
        for (const [name, method] of Object.entries(def.methods ?? {})) {
          api[name] = (...args: readonly unknown[]) => method.call(
            (service.context as object) as Record<string, unknown>,
            service.state,
            args,
            readProps(),
            resolveId,
          );
        }
        function liveScope(extra: { readonly slot: unknown }): SlotScope;
        function liveScope(): PartScope;
        function liveScope(extra?: { readonly slot: unknown }): PartScope | SlotScope {
          // Live views, not snapshots: a closure cached by row (or by part)
          // keeps reading through these, so it never goes stale — while the
          // bag memo still bounds rebuilds by signature. Proxies cost a
          // lookup per read; bags build rarely, handlers fire rarely.
          const props = new Proxy({} as Record<string, unknown>, {
            get: (_target, key: string) => readProps()[key],
            has: (_target, key: string) => key in readProps(),
          });
          const context = new Proxy({} as Record<string, unknown>, {
            get: (_target, key: string) =>
              ((service.context as object) as Record<string, unknown>)[key],
            has: (_target, key: string) =>
              key in ((service.context as object) as Record<string, unknown>),
          });
          const scope: Record<string, unknown> = {
            props,
            context,
            root,
            id: resolveId,
            send: dispatch,
            attr: dataAttr,
            ...extra,
          };
          Object.defineProperty(scope, "state", {
            get: () => service.state,
            enumerable: true,
          });
          return scope as unknown as PartScope | SlotScope;
        }
        for (const [part, partDef] of Object.entries(def.parts)) {
          const method = `get${part[0]?.toUpperCase() ?? ""}${part.slice(1)}Props`;
          api[method] = (...callArgs: readonly unknown[]) => {
            const scope = liveScope();
            return bagFor(part)(partDef.sig(scope, callArgs[0]), () => partDef.attrs(scope, callArgs[0]));
          };
        }
        for (const [slotName, slotDef] of Object.entries(def.slots ?? {})) {
          const cap = `${slotName[0]?.toUpperCase() ?? ""}${slotName.slice(1)}`;
          const slotMemos = new WeakMap<object, BagMemo>();
          api[`get${cap}Props`] = (slot: object, ...callArgs: readonly unknown[]) => {
            const scope = liveScope({ slot });
            return keyed(slotMemos, slot, slotDef.sig(scope, callArgs[0]), () => slotDef.attrs(scope, callArgs[0]));
          };
          // Stable identities: a fresh identity per read re-stamps rows.
          // Rows/blocks memoize on the collection's identity upstream, so
          // this caches per source array, not per length.
          let source: readonly unknown[] | undefined;
          let cached: readonly unknown[] = [];
          api[`get${cap}Indexes`] = () => {
            const context = (service.context as object) as Record<string, unknown>;
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
    const startState = typeof def.start === "function"
      ? def.start(parseProp(def, props, parsedCache, { root }), authoredProps(props))
      : def.start;
    const bridged = defineBridge(
      {
        config: def.config,
        implementations: def.implementations,
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
    readers: Object.keys(def.readers ?? {}),
    methods: Object.keys(def.methods ?? {}),
    channels: Object.keys(def.channels),
  };
  return {
    createBridge,
    commands: Object.keys(def.commands),
    events,
    manifest,
  };
}
