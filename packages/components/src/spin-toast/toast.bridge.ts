/**
 * The toast bridge: scope values in, machine state out.
 *
 * Where Zag's queue lives: a store the host creates and the group machine
 * subscribes to. A store is app data — it does not travel with the machine,
 * so the queue here is machine context and the host's `items` prop is the
 * write channel, exactly as the legacy element wrote it. The imperative
 * commands (`create`/`update`/`dismiss`/`remove`/`pause`/`resume`) are the
 * gesture and controller paths, not a second queue.
 *
 * The one resurrection rule, inherited from the legacy element: a toast the
 * machine took out on its own — the clock ran out, the user dismissed it —
 * is remembered, so a later host write of the same list does not bring it
 * back. A host that means to re-show a toast gives it a new id.
 *
 * The status callback is Zag's per-toast `onStatusChange`, reported by
 * diffing each toast's status across a send rather than by an entry action:
 * the fork runs assigns, not actions, so there is nowhere to put a
 * side effect that still knows the event that caused it.
 */

import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotToast,
  type ReadToastProps,
  type ToastApi,
  type ToastConnectProps,
  type ToastItem,
  type ToastService,
} from "./toast.connect.ts";
import {
  config,
  implementations,
  type ToastContext,
  type ToastEntry,
  type ToastEvent,
  type ToastStatus,
  type ToastType,
} from "./toast.machine.ts";

export interface ToastStatusChange {
  readonly id: string;
  /** Zag's statuses: `visible`, `dismissing`, `unmounted`. */
  readonly status: ToastStatus | "unmounted";
  /** What caused it: `user`, `keyboard`, `timer`, or "" for a host write. */
  readonly src: string;
}

export interface ToastCallbacks {
  readonly onStatusChange: ((details: ToastStatusChange) => void) | undefined;
}

/** The types the machine knows, in the order a host spells them. */
const TYPES: readonly string[] = ["info", "success", "warning", "error", "loading"];

const asType = (raw: unknown): ToastType => {
  if (typeof raw === "string" && TYPES.includes(raw)) return raw as ToastType;
  return "info";
};

const asText = (raw: unknown): string => (typeof raw === "string" ? raw : "");

const asCount = (raw: unknown, fallback: number): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : fallback;

/** The object-array grammar hands back `unknown`; a record is what the fields
 * are read out of. */
const asRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw);

/** The queue entry the prop channel carries, or none when a field is wrong. */
const toEntry = (raw: unknown): ToastItem | undefined => {
  if (!asRecord(raw)) return undefined;
  const id = asText(raw["id"]);
  if (id.length === 0) return undefined;
  return {
    id,
    title: asText(raw["title"]),
    description: asText(raw["description"]),
    type: asType(raw["type"]),
    duration: asCount(raw["duration"], 0),
    priority: asCount(raw["priority"], 0),
    action: asText(raw["action"]),
  };
};

const sameEntry = (a: ToastItem, b: ToastEntry): boolean =>
  a.id === b.id &&
  a.title === b.title &&
  a.description === b.description &&
  a.type === b.type &&
  a.action === b.action &&
  a.priority === b.priority &&
  // A duration the host did not author keeps the clock it already has.
  (a.duration <= 0 || a.duration === b.remaining);

export type { ToastItem };

/**
 * The toast bridge: scope values in, machine state out.
 */
export function createToastBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: ToastApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // A mutable context shared by every instance on the page is silent in a
  // unit test and loud in a browser: the fork folds assigns onto the config's
  // own object, so each bridge builds its machine from a copy.
  const machine = createMachine<ToastContext, ToastEvent>({
    ...config,
    context: { ...config.context },
  }, implementations);

  let service: Service<ToastContext, ToastEvent> | undefined;

  /** Tolls the machine removed on its own; a host write never revives them. */
  const machineRemoved = new Set<string>();

  const readCallbacks = (): ToastCallbacks => {
    const p = props();
    const value = p["onStatusChange"];
    return {
      onStatusChange: typeof value === "function"
        ? (value as (details: ToastStatusChange) => void)
        : undefined,
    };
  };

  /** The scalars the assigns and the collapse cond read. */
  const readContextProps = (): Pick<ToastContext, "overlap" | "max" | "removeDelay"> => {
    const p = props();
    return {
      overlap: p["overlap"] === true,
      max: Math.max(1, asCount(p["max"], 24)),
      removeDelay: Math.max(0, asCount(p["removeDelay"], 200)),
    };
  };

  const readConnectProps: ReadToastProps = (): ToastConnectProps => {
    const p = props();
    return {
      ...readContextProps(),
      placement: typeof p["placement"] === "string" && p["placement"].length > 0 ? p["placement"] : "bottom",
      gap: Math.max(0, asCount(p["gap"], 16)),
      offsets: typeof p["offsets"] === "string" && p["offsets"].length > 0 ? p["offsets"] : "1rem",
      hotkey: typeof p["hotkey"] === "string" ? p["hotkey"] : "",
      pauseOnPageIdle: p["pauseOnPageIdle"] !== false,
      label: typeof p["label"] === "string" && p["label"].length > 0 ? p["label"] : "Notifications",
      closable: p["closable"] !== false,
    };
  };

  const ensureService = (): Service<ToastContext, ToastEvent> => {
    if (service) return service;
    service = owner.run(() => interpret(machine).start());
    return service;
  };

  /**
   * Report what moved. Each toast's status is diffed across the send, so one
   * transition reports once: `visible` on the way in, `dismissing` when the
   * exit starts, `unmounted` when the queue lets go.
   *
   * A removal the machine made on its own — the clock ran out, the user
   * dismissed it — is remembered, so a later host write of the same list
   * cannot revive the toast. A removal the host asked for is not: the host's
   * list is the source, and a re-add is a re-show.
   */
  const notify = (before: readonly ToastEntry[], src: string, remembered: boolean): void => {
    const after = ensureService().state.context.toasts;
    const report = readCallbacks().onStatusChange;
    if (report === undefined) return;
    for (const entry of before) {
      const now = after.find((candidate) => candidate.id === entry.id);

      if (now === undefined) {
        if (remembered) machineRemoved.add(entry.id);
        report({ id: entry.id, status: "unmounted", src });
      } else if (now.status !== entry.status) {
        report({ id: entry.id, status: now.status, src });
      }
    }
    for (const entry of after) {
      if (before.some((candidate) => candidate.id === entry.id)) continue;
      report({ id: entry.id, status: "visible", src });
    }
  };

  const send = (event: ToastEvent): void => {
    const svc = ensureService();
    const before = [...svc.state.context.toasts];
    svc.send(event);
    notify(before, event.type === "TOAST.DISMISS" ? event.src : "", true);
    untrack(() => {
      tick(tick() + 1);
      machineTick(machineTick() + 1);
    });
  };

  const parseItems = (raw: unknown): readonly ToastItem[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map(toEntry).filter((item): item is ToastItem => item !== undefined);
  };

  /**
   * The host's list is the queue's source, so the diff is one-way: ids the
   * host added are created, ids the host dropped are removed, and a changed
   * field is an update. Every send inside is untracked and the effect reads
   * no tick of its own, so a host write never re-imposes the list over a
   * machine move and a machine move never re-runs the diff.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      const next = readContextProps();
      if (svc.state.context.overlap !== next.overlap) {
        svc.state.context.overlap = next.overlap;
        moved = true;
      }
      if (svc.state.context.max !== next.max) {
        svc.state.context.max = next.max;
        moved = true;
      }
      if (svc.state.context.removeDelay !== next.removeDelay) {
        svc.state.context.removeDelay = next.removeDelay;
        moved = true;
      }
      // The authored overlap prop is the group's initial posture: the fork's
      // `initial` is static, so the region enters overlap (or returns to
      // stack) as the prop says, exactly as Zag's `initialState({ prop })`.
      if (next.overlap && svc.state.value !== "overlap") {
        untrack(() => svc.send({ type: "REGION.OVERLAP" }));
        moved = true;
      }
      if (!next.overlap && svc.state.value === "overlap") {
        untrack(() => svc.send({ type: "REGION.STACK" }));
        moved = true;
      }
      const incoming = parseItems(props()["items"]);
      const before = [...svc.state.context.toasts, ...svc.state.context.queued];
      const created: ToastEvent[] = [];
      for (const item of incoming) {
        const current = before.find((entry) => entry.id === item.id);
        if (current === undefined) {
          if (machineRemoved.has(item.id)) continue;
          created.push({
            type: "TOAST.CREATE",
            id: item.id,
            title: item.title,
            description: item.description,
            toastType: asType(item.type),
            duration: item.duration,
            priority: item.priority,
            action: item.action,
          });
          moved = true;
        } else if (!sameEntry(item, current)) {
          created.push({
            type: "TOAST.UPDATE",
            id: item.id,
            title: item.title,
            description: item.description,
            toastType: asType(item.type),
            duration: item.duration,
            priority: item.priority,
            action: item.action,
          });
          moved = true;
        }
      }
      for (const entry of before) {
        if (incoming.some((item) => item.id === entry.id)) continue;
        created.push({ type: "TOAST.REMOVE", id: entry.id });
        moved = true;
      }
      for (const event of created) untrack(() => svc.send(event));
      if (created.length > 0) notify(before, "", false);
      if (moved) {
        // Untracked: the tick is read to write it, and a tracked read here
        // would subscribe this effect to every machine move — each one would
        // then re-impose the host's list over what the machine just did.
        untrack(() => {
          tick(tick() + 1);
          machineTick(machineTick() + 1);
        });
      }
    }),
  );

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does. */
  const serviceApi: ToastService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state.value;
    },
  };

  let toastConnect: ToastApi | undefined;
  const ensureConnect = (): ToastApi => {
    toastConnect ??= connectRobotToast(serviceApi, readConnectProps, id, _root);
    return toastConnect;
  };

  /** The api is read on every machine move, so this depends on the tick. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as ToastApi, {
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
      machineRemoved.clear();
    },
  };
}
