import { computed, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotAvatar,
  type AvatarConnectProps,
  type AvatarFsmApi,
  type AvatarIds,
} from "./avatar.connect.ts";
import { config, type AvatarContext, type AvatarEvent, type LoadStatus } from "./avatar.machine.ts";

export interface AvatarStatusChange {
  readonly status: LoadStatus;
}

/** The element's imperative surface, declared in the def's `commands`. */
export interface AvatarCommands {
  /** The view's own imperative loaded/error: a host watching a resource it
   * already loaded (an upload, an avatar it decoded itself). */
  setLoaded(): void;
  setError(): void;
}

/** JSON transport for the id overrides: the scope grammar has no object
 * type, and three optional ids are exactly what Zag's `ids` prop carries. */
function parseIds(raw: unknown, id: string): AvatarIds {
  const defaults: AvatarIds = {
    root: `avatar:${id}`,
    image: `avatar:${id}:image`,
    fallback: `avatar:${id}:fallback`,
  };
  if (typeof raw !== "string" || raw.length === 0) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (typeof parsed !== "object" || parsed === null) return defaults;
  const pick = (key: string): string => {
    const value = Reflect.get(parsed, key);
    return typeof value === "string" && value.length > 0 ? value : "";
  };
  return {
    root: pick("root") || defaults.root,
    image: pick("image") || defaults.image,
    fallback: pick("fallback") || defaults.fallback,
  };
}

const stringProp = (props: Record<string, unknown>, name: string): string => {
  const value = props[name];
  return typeof value === "string" ? value : "";
};

/** Zag reports the status only once it settled: loading is not a report. */
const reportable = (value: string): LoadStatus | null =>
  value === "loaded" || value === "error" ? value : null;

/**
 * The avatar bridge: scope values in, machine state out.
 *
 * Three jobs, as every bridge. Seed the first state — the avatar's chart
 * starts at `loading` whatever the host wrote, because a `defaultLoaded`
 * would be a lie about an image the browser has not fetched. Resolve the
 * part ids and read the behavioural props for the connect. Report the
 * settled status as `onStatusChange`.
 *
 * There is no controlled channel: the image's status is the browser's, not
 * the host's, so there is nothing to alternate. The single write channel a
 * host has is `setSrc`, which is a DOM write the connect owns.
 */
export function createAvatarFsmBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: AvatarFsmApi & AvatarCommands; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<AvatarContext, AvatarEvent>(config);
  const ids = parseIds(props()["ids"], id);

  let service: FsmService<AvatarContext, AvatarEvent> | undefined;

  const ensureService = (): FsmService<AvatarContext, AvatarEvent> => {
    service ??= owner.run(() => interpret(machine).start());
    return service;
  };

  let lastStatus = reportable(ensureService().state.value);

  /** Report what moved. The cursor advances before the callback, because
   * the fork's send is synchronous: a post-send check would already see
   * the new value and report the same status twice. */
  const notify = (): void => {
    const status = reportable(ensureService().state.value);
    if (status === null || status === lastStatus) return;
    lastStatus = status;
    const onStatusChange = props()["onStatusChange"];
    if (typeof onStatusChange === "function") {
      (onStatusChange as (change: AvatarStatusChange) => void)({ status });
    }
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state, so a rebuild would hand out fresh bags — and so
   * fresh load/error listeners — on every status move. */
  let avatarConnect: AvatarFsmApi | undefined;
  const ensureConnect = (): AvatarFsmApi => {
    avatarConnect ??= connectRobotAvatar(
      {
        send,
        get context() {
          return ensureService().state.context;
        },
        get state() {
          return ensureService().state;
        },
      },
      readConnectProps,
      ids,
    );
    return avatarConnect;
  };

  const send = (event: AvatarEvent): void => {
    const svc = ensureService();
    svc.send(event);
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The behavioural props, read per connect call rather than snapshotted:
   * the connect is long-lived, so a host write has to reach the bags it
   * holds. */
  const readConnectProps = (): AvatarConnectProps => {
    const p = props();
    return {
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      name: stringProp(p, "name"),
      src: stringProp(p, "src"),
      srcset: stringProp(p, "srcset"),
      sizes: stringProp(p, "sizes"),
      crossOrigin: stringProp(p, "crossOrigin"),
      referrerPolicy: stringProp(p, "referrerPolicy"),
      alt: stringProp(p, "alt"),
    };
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  // Imperative commands resolve INSIDE the trap: assigning onto a live-view
  // proxy is shadowed by its own get trap and the host would call undefined.
  const commands = {
    setLoaded: (): void => send({ type: "IMG_LOADED" }),
    setError: (): void => send({ type: "IMG_ERROR" }),
  };

  const api = new Proxy({} as AvatarFsmApi & AvatarCommands, {
    get: (_target, key) =>
      key in commands ? Reflect.get(commands, key) : Reflect.get(connected(), key),
    has: (_target, key) => key in commands || Reflect.has(connected(), key),
    ownKeys: () => [...new Set([...Reflect.ownKeys(connected()), ...Object.keys(commands)])],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) {
        return { configurable: true, enumerable: true, value: Reflect.get(commands, key) };
      }
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
