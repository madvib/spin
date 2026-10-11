import type { MachineDef } from "@spin/runtime";
import { computed, effect, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import { connectRobotDialog, type DialogApi, type DialogConnectProps } from "./dialog.connect.ts";

/**
 * Dialog on the forked FSM with reflexes as actions — the canonical proof.
 *
 * Zag's dialog spends most of its complexity on DOM reflexes: trapFocus,
 * trackDismissableElement, preventBodyScroll, aria-hidden on siblings, and a
 * `watch` that tracks the controlled `open` prop. That is the exact stratum
 * this architecture moves OUT of the machine:
 *
 * - The machine is `open`/`closed` and four events. States, not reflexes.
 * - `focus-trap` and `dismissable` are stdlib actions attached through the
 *   content bag (`use:` keys), with `send` passed as a param.
 * - `preventScroll` is a class toggle the action performs on the host — the
 *   styling engine stays the only thing that paints.
 * - Controlled `open` is a PLATFORM concern (see the authored-prop note in
 *   the tree-view port): the runtime knows whether a prop was written; the
 *   bridge seeds from `defaultOpen` and alternates only when authored.
 *
 * Programmatic control for hosts: `api.open()`, `api.close()`,
 * `api.toggle()` — the element also accepts a controlled `open` property
 * and emits `open-change` for host state.
 */

export interface DialogOpenChange {
  readonly open: boolean;
}

interface DialogContext {
  /** The last reason the dialog closed: escape, outside click, or api. */
  lastReason: "escape" | "outside" | "api" | "none";
}

type DialogEvent =
  | { type: "OPEN" }
  | { type: "CLOSE"; reason?: "escape" | "outside" | "api" };

const config = {
  id: "dialog",
  initial: "closed",
  context: { lastReason: "none" as "escape" | "outside" | "api" | "none" },
  states: {
    closed: {
      on: {
        OPEN: { target: "open", actions: [{ assign: "clearReason" }] },
      },
    },
    open: {
      on: {
        CLOSE: { target: "closed", actions: [{ assign: "setReason" }] },
      },
    },
  },
};

const implementations = {
  assigns: {
    clearReason: (): Partial<DialogContext> => ({ lastReason: "none" }),
    setReason: (_ctx: DialogContext, e: DialogEvent): Partial<DialogContext> => ({
      lastReason: e.type === "CLOSE" ? (e.reason ?? "api") : "none",
    }),
  },
};

/**
 * The api the bridge publishes: the connect surface plus the imperative
 * commands the proxy resolves from its own trap.
 */
export interface DialogBridgeApi extends DialogApi {
  show(): void;
  hide(reason?: "escape" | "outside" | "api"): void;
  toggle(): void;
}

export function createDialogBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: DialogBridgeApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<DialogContext, DialogEvent>(config, implementations);

  let service: Service<DialogContext, DialogEvent> | undefined;

  /**
   * `defaultOpen` seeds the first state; an AUTHORED `open` alternates it
   * immediately (BuildContext.authored distinguishes a host write from the
   * coerced default, so `open={false}` and "never set" are different).
   * Controlled and imperative compose: the host writes the property, the
   * imperative commands move the machine, `open-change` reports both.
   */
  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const ensureService = (): Service<DialogContext, DialogEvent> => {
    if (!service) {
      const initial = props()["defaultOpen"] === true
        ? "open"
        : authored("open") && props()["open"] === true
          ? "open"
          : "closed";
      service = owner.run(() => interpret(machine).start(initial));
    }
    return service;
  };

  /** A host write to `open` alternates without waiting for a machine event. */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const outer = props()["open"];
      if (!authored("open") || typeof outer !== "boolean") return;
      const isOpen = svc.state.value === "open";
      if (outer !== isOpen) {
        svc.send({ type: outer ? "OPEN" : "CLOSE", reason: "api" });
        tick(tick() + 1);
        machineTick(machineTick() + 1);
      }
    }),
  );

  const currentOpen = (): boolean => ensureService().state.value === "open";

  let lastOpen = ensureService().state.value === "open";
  const send = (event: DialogEvent): void => {
    const svc = ensureService();
    svc.send(event);
    const open = svc.state.value === "open";
    if (open !== lastOpen) {
      lastOpen = open;
      (props()["onOpenChange"] as ((d: DialogOpenChange) => void) | undefined)?.({ open });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  const connected = computed(() => {
    tick();
    const svc = ensureService();
    const adapted = { send: send as (e: { type: string } & Record<string, unknown>) => void, get context() {
      return svc.state.context;
    } };
    const p = props();
    const connectProps: DialogConnectProps = {
      modal: p["modal"] !== false,
      trapFocus: p["trapFocus"] !== false,
      preventScroll: p["preventScroll"] !== false,
      closeOnEscape: p["closeOnEscape"] !== false,
      closeOnInteractOutside: p["closeOnInteractOutside"] !== false,
      restoreFocus: p["restoreFocus"] !== false,
      role: p["role"] === "alertdialog" ? "alertdialog" : "dialog",
    };
    return connectRobotDialog(
      adapted,
      connectProps,
      root(),
      id,
      send as (event: { type: string } & Record<string, unknown>) => void,
      currentOpen(),
    );
  });

  // Imperative commands resolved INSIDE the trap: assigning onto the proxy
  // would be shadowed by its own get trap, and the host would call undefined.
  const commands = {
    show: (): void => send({ type: "OPEN" }),
    hide: (reason: "escape" | "outside" | "api" = "api"): void => send({ type: "CLOSE", reason }),
    toggle: (): void => send(currentOpen() ? { type: "CLOSE", reason: "api" } : { type: "OPEN" }),
    get open(): boolean {
      return currentOpen();
    },
  };

  const api = new Proxy({} as DialogApi, {
    get: (_target, key) =>
      key in commands
        ? (commands as Record<string | symbol, unknown>)[key]
        : Reflect.get(connected(), key),
    has: (_target, key) => key in commands || Reflect.has(connected(), key),
    ownKeys: () => [...new Set([...Reflect.ownKeys(connected()), ...Object.keys(commands)])],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) return { configurable: true, enumerable: true, value: (commands as Record<string | symbol, unknown>)[key] };
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api: api as DialogBridgeApi,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}

export const dialog: MachineDef = {
  createBridge: createDialogBridge,
  commands: ["show", "hide", "toggle"],
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: DialogOpenChange) => ({ open: change.open }),
    },
  },
};
