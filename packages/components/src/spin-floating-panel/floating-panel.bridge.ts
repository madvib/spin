import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotFloatingPanel,
  type FloatingPanelApi,
  type FloatingPanelConnectProps,
} from "./floating-panel.connect.ts";
import {
  config,
  implementations,
  type FloatingPanelContext,
  type FloatingPanelEvent,
  type FloatingPanelSize,
  type FloatingPanelStage,
} from "./floating-panel.machine.ts";

export type { FloatingPanelSize, FloatingPanelStage };

/** An authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/** The JSON transport for a size: `{"w":360,"h":240}`. */
const parseSize = (raw: unknown): FloatingPanelSize | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const bag = parsed as Record<string, unknown>;
  const w = bag["w"];
  const h = bag["h"];
  if (typeof w !== "number" || typeof h !== "number") return null;
  return { w, h };
};

const readStage = (props: Record<string, unknown>): FloatingPanelStage | null => {
  const stage = props["stage"];
  return stage === "minimized" || stage === "maximized" || stage === "restored" ? stage : null;
};

/**
 * The floating-panel bridge: scope values in, machine state out.
 *
 * Five jobs. Seed the first state from the authored `defaultOpen`,
 * alternate the controlled `open` and `size`, sync the scalars the assigns
 * read, publish the connect api through the live-view proxy, and report
 * the four change channels (open, size, position, stage) from one funnel
 * — the fork's send is synchronous, so a "before" snapshot is the only
 * honest diff.
 *
 * A controlled `open` is a platform concern (select's pattern): the host
 * writes the property, and the machine answers with OPEN/CLOSE. Only a
 * VALUE CHANGE sends — a declared default never re-imposes.
 */
export function createFloatingPanelBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: FloatingPanelApi; dispose(): void } {
  void root;
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<FloatingPanelContext, FloatingPanelEvent>(config, implementations);

  let service: Service<FloatingPanelContext, FloatingPanelEvent> | undefined;

  const ensureService = (): Service<FloatingPanelContext, FloatingPanelEvent> => {
    if (service !== undefined) return service;
    const p = props();
    service = owner.run(() => {
      const svc = interpret(machine).start();
      // A send first: the fork's initial context is the config's object
      // until a transition folds a copy, and two panels on a page would
      // otherwise share one context until the first gesture.
      svc.send({ type: "DRAG.END" });
      svc.state.context.draggable = p["draggable"] !== false;
      svc.state.context.resizable = p["resizable"] !== false;
      svc.state.context.closeOnEscape = p["closeOnEscape"] !== false;
      const seeded = parseSize(p["defaultSize"]);
      if (seeded !== null) svc.send({ type: "SIZE.SET", size: seeded });
      if (p["defaultOpen"] === true) svc.send({ type: "OPEN" });
      return svc;
    });
    return service;
  };

  /** The behavioural props, read per connect call: the connect is
   * long-lived, so a snapshot would freeze the first read's values inside
   * the handlers it caches. */
  const readConnectProps = (): FloatingPanelConnectProps => {
    const p = props();
    const label = p["label"];
    return {
      label: typeof label === "string" ? label : "",
      disabled: p["disabled"] === true,
    };
  };

  function send(event: FloatingPanelEvent): void {
    const svc = ensureService();
    const beforeOpen = svc.state.value === "open";
    const beforeSize = `${svc.state.context.size.w}x${svc.state.context.size.h}`;
    const beforePos = `${svc.state.context.position.x},${svc.state.context.position.y}`;
    const beforeStage = svc.state.context.stage;
    svc.send(event);
    const after = svc.state.context;
    const isOpen = svc.state.value === "open";
    if (isOpen !== beforeOpen) {
      (props()["onOpenChange"] as ((d: { open: boolean }) => void) | undefined)?.({ open: isOpen });
    }
    const afterSize = `${after.size.w}x${after.size.h}`;
    if (afterSize !== beforeSize) {
      (props()["onSizeChange"] as ((d: { size: FloatingPanelSize }) => void) | undefined)?.({ size: after.size });
    }
    const afterPos = `${after.position.x},${after.position.y}`;
    if (afterPos !== beforePos) {
      (props()["onPositionChange"] as ((d: { position: { x: number; y: number } }) => void) | undefined)?.({
        position: after.position,
      });
    }
    if (after.stage !== beforeStage) {
      (props()["onStageChange"] as ((d: { stage: FloatingPanelStage }) => void) | undefined)?.({ stage: after.stage });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  ensureService();
  // Seeded from the service, not undefined: the declared default for
  // `open` reads as authored, and an undefined shadow would read the
  // first effect run as a host toggle to closed.
  let lastOpen = ensureService().state.value === "open";

  /** One connect per element, not one per machine move. */
  let panelConnect: FloatingPanelApi | undefined;
  const ensureConnect = (): FloatingPanelApi => {
    panelConnect ??= connectRobotFloatingPanel(
      {
        send,
        get context(): FloatingPanelContext {
          return ensureService().state.context;
        },
        get isOpen(): boolean {
          return ensureService().state.value === "open";
        },
        get state(): string {
          return ensureService().state.value;
        },
      },
      readConnectProps,
      id,
    );
    return panelConnect;
  };

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const p = props();
      svc.state.context.draggable = p["draggable"] !== false;
      svc.state.context.resizable = p["resizable"] !== false;
      svc.state.context.closeOnEscape = p["closeOnEscape"] !== false;
      if (authored(props, "open")) {
        const outer = p["open"] === true;
        if (lastOpen !== outer) {
          lastOpen = outer;
          untrack(() => send(outer ? { type: "OPEN" } : { type: "CLOSE" }));
        }
      }
      if (authored(props, "size")) {
        const outer = parseSize(p["size"]);
        const inner = svc.state.context.size;
        if (outer !== null && `${outer.w}x${outer.h}` !== `${inner.w}x${inner.h}`) {
          untrack(() => send({ type: "SIZE.SET", size: outer }));
        }
      }
      const stage = readStage(p);
      if (stage !== null && stage !== svc.state.context.stage) {
        untrack(() => send(
          stage === "minimized"
            ? { type: "MINIMIZE" }
            : stage === "maximized" ? { type: "MAXIMIZE" } : { type: "RESTORE" },
        ));
      }
    }),
  );

  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as FloatingPanelApi, {
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
