/** Synthesize the bridge and the connect from a component definition.
 *
 * The output is the existing `MachineDef` seam — recipes, machine-defs,
 * and the plugin consume it unchanged. No hand-written `getXProps()`
 * exists for any component: parts declare attribute maps, commands
 * declare sends, events declare watches. */

import { dataAttr, memo } from "./bags.ts";
import { ids } from "./ids.ts";
import { defineBridge, pickCallback, type BridgeHooks, type BridgeService } from "./bridge.ts";
import type { ComponentDef } from "./define.ts";
import type { MachineDef, MachineEventContract } from "../index.ts";

const parseProp = <C extends object, E extends { type: string }>(
  def: ComponentDef<C, E>,
  props: () => Record<string, unknown>,
): Record<string, unknown> => {
  const raw = props();
  const out: Record<string, unknown> = {};
  for (const [name, channel] of Object.entries(def.channels)) {
    out[name] = channel.parse(raw[name]);
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
} {
  const hooks = (): BridgeHooks<C, E, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>> => {
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
      seed: (props) => def.seed(parseProp(def, props)) as Partial<C>,
      sync: (svc, props, authored, send) => {
        let moved = false;
        const parsed = parseProp(def, props);
        for (const [name, channel] of Object.entries(def.channels)) {
          if (channel.controlled !== true) continue;
          if (!authored(name)) continue;
          const outer = parsed[name];
          const current = ((svc.state.context as object) as Record<string, unknown>)[name];
          if (current !== outer) {
            send(channel.event(outer as never) as E);
            moved = true;
          }
        }
        return moved;
      },
      notify: (svc, callbacks) => {
        const context = (svc.state.context as object) as Record<string, unknown>;
        const state = svc.state.value;
        const props = callbacks as Record<string, (...args: readonly unknown[]) => void>;
        for (const [name, event] of Object.entries(def.events)) {
          const watched = event.watch(context, state);
          const last = lastWatched.get(name);
          if (last !== undefined && sameWatch(last, watched)) continue;
          lastWatched.set(name, watched);
          props[event.prop]?.(event.detail(watched));
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
      readConnectProps: (props) => parseProp(def, props),
      connect: (service, readProps, id) => {
        const names = ids(def.name, id);
        const api: Record<string, unknown> = {};
        for (const [name, command] of Object.entries(def.commands)) {
          api[name] = (...args: readonly unknown[]) => service.send(command.event(args) as E);
        }
        for (const [name, reader] of Object.entries(def.readers ?? {})) {
          Object.defineProperty(api, name, {
            get: () => reader.read(
              (service.context as object) as Record<string, unknown>,
              service.state,
            ),
            enumerable: true,
          });
        }
        for (const [part, partDef] of Object.entries(def.parts)) {
          const method = `get${part[0]?.toUpperCase() ?? ""}${part.slice(1)}Props`;
          api[method] = () => {
            const scope = {
              props: readProps(),
              context: (service.context as object) as Record<string, unknown>,
              state: service.state,
              id: names,
              send: service.send as (event: { type: string } & Record<string, unknown>) => void,
              attr: dataAttr,
            };
            return bagFor(part)(partDef.sig(scope), () => partDef.attrs(scope));
          };
        }
        return api;
      },
    };
  };

  const createBridge = (
    props: () => Record<string, unknown>,
    _root: () => Element,
    id: string,
  ): { readonly api: Api; dispose(): void } => {
    const bridged = defineBridge(
      {
        config: def.config,
        implementations: def.implementations,
        startState: def.startState,
        hooks,
      },
      props,
      id,
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

  return {
    createBridge,
    commands: Object.keys(def.commands),
    events,
  };
}
