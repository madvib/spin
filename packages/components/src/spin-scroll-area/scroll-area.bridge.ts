import { computed, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotScrollArea,
  type ReadScrollAreaProps,
  type ScrollAreaFsmApi,
  type ScrollAreaFsmConnectProps,
  type ScrollAreaService,
} from "./scroll-area.connect.ts";
import { config, implementations, type ScrollAreaContext, type ScrollAreaEvent } from "./scroll-area.machine.ts";

/**
 * The scroll-area bridge: scope values in, machine state out.
 *
 * This is the port with no host-facing state to seed and nothing to alternate:
 * Zag's props are `ids` and `dir`, and neither is a bindable the machine
 * holds. So the bridge has three jobs — build one service per element from a
 * context that is NOT the config's, seed the hover the element mounts with, and
 * publish the connect api through the live-view proxy.
 *
 * The per-instance context is the whole point of the spread below: the fork's
 * `config.context` is one object and `interpret` starts on it without copying,
 * so two scroll areas on a page would share a single set of bars, a single
 * hover flag, and a single scroll position.
 */
export function createScrollAreaFsmBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: ScrollAreaFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<ScrollAreaContext, ScrollAreaEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: FsmService<ScrollAreaContext, ScrollAreaEvent> | undefined;

  const readConnectProps: ReadScrollAreaProps = (): ScrollAreaFsmConnectProps => ({
    dir: props()["dir"] === "rtl" ? "rtl" : "ltr",
  });

  const ensureService = (): FsmService<ScrollAreaContext, ScrollAreaEvent> => {
    if (service) return service;
    service = owner.run(() => {
      const svc = interpret(machine).start();
      // Zag's `checkHovering` entry action: a viewport that is already under
      // the pointer when the element mounts starts lit rather than waiting
      // for a move that will never come.
      const viewport = document.getElementById(`scroll-area:${id}:viewport`);
      if (viewport?.matches(":hover") === true) svc.state.context.hovering = true;
      return svc;
    });
    return service;
  };

  /**
   * Every event the view can send, funnelled through here: the fork's send is
   * synchronous and both ticks are bumped after it, which is what wakes the
   * bindings.
   */
  const send = (event: ScrollAreaEvent): void => {
    const svc = ensureService();
    svc.send(event);
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches against. */
  const serviceApi: ScrollAreaService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get dragging() {
      return ensureService().state.value === "dragging";
    },
  };

  // No owned effect alternates anything: `dir` is a connect prop the view
  // reads live, and nothing else in Zag's props is a machine bindable. The
  // service is created lazily inside the owner, so `dispose` releases it.
  let scrollAreaConnect: ScrollAreaFsmApi | undefined;
  const ensureConnect = (): ScrollAreaFsmApi => {
    scrollAreaConnect ??= connectRobotScrollArea(serviceApi, readConnectProps, id);
    return scrollAreaConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as ScrollAreaFsmApi, {
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
