import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type AvatarContext,
  type AvatarEvent,
  type AvatarStatusChange,
} from "./avatar.machine.ts";
import {
  connectAvatar,
  type AvatarApi,
  type AvatarConnectProps,
  type AvatarService,
} from "./avatar.connect.ts";

/**
 * The avatar bridge: scope values in, machine state out.
 *
 * Seed the src from `defaultSrc`; alternate the one authored channel
 * (`src`) against a remembered shadow. A src change — authored or
 * observed on the node — returns the machine to loading; load and error
 * report through `status-change`. The callbacks live on the props surface
 * — the def maps them to CustomEvents.
 */

export interface AvatarCallbacks {
  readonly onStatusChange: ((details: AvatarStatusChange) => void) | undefined;
}

const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

export function createAvatarBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: AvatarApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every avatar on the page would otherwise share one
  // src.
  const machine = createMachine<AvatarContext, AvatarEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<AvatarContext, AvatarEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): AvatarCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onStatusChange: pick<(d: AvatarStatusChange) => void>("onStatusChange"),
    };
  };

  const readConnectProps = (): AvatarConnectProps => {
    const p = props();
    return {
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      label: textProp(p["label"]),
      fallbackLabel: textProp(p["fallback"]) || textProp(p["label"]) || "avatar",
    };
  };

  const ensureService = (): Service<AvatarContext, AvatarEvent> => {
    if (service) return service;
    const p = props();
    const seeded = textProp(authored("src") ? p["src"] : p["defaultSrc"]);
    service = owner.run(() => {
      const svc = interpret(machine).start("loading");
      Object.assign(svc.state.context, { src: seeded });
      return svc;
    });
    return service;
  };

  /** What the src channel last imposed, seeded from the same place the
   * machine was, so a host that authors the seeded value writes nothing. */
  let lastSrc: string = ensureService().state.context.src;
  let lastStatus: string = ensureService().state.value;

  let avatarConnect: AvatarApi | undefined;
  const ensureConnect = (): AvatarApi => {
    avatarConnect ??= connectAvatar(serviceApi, readConnectProps, id);
    return avatarConnect;
  };

  /**
   * Report what moved. The cursors advance only after the callbacks: the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  const notify = (): void => {
    const svc = ensureService();
    const after = svc.state.context;
    const status = svc.state.value;
    const callbacks = readCallbacks();
    if (lastSrc !== after.src) lastSrc = after.src;
    if (lastStatus !== status) {
      lastStatus = status;
      callbacks.onStatusChange?.({ status: status as AvatarStatusChange["status"] });
    }
  };

  const send = (event: AvatarEvent): void => {
    const svc = ensureService();
    svc.send(event);
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: AvatarService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state.value;
    },
  };

  /**
   * Controlled alternation in one owned effect: it reads the live prop
   * signals, so a host write moves the machine without waiting for a
   * machine event.
   *
   * It writes no tick of its own: `svc.send` bumps the machine tick, which
   * is what wakes the bindings, and a tick read here would re-run the
   * effect on every later move and re-impose the authored props over it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      if (authored("src")) {
        const outer = textProp(props()["src"]);
        if (lastSrc !== outer) {
          untrack(() => svc.send({ type: "SRC.CHANGE", src: outer }));
          moved = true;
        }
      }
      if (moved) notify();
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as AvatarApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
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
