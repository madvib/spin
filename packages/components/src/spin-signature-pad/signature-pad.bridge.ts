/**
 * The signature-pad bridge: scope values in, machine state out.
 *
 * Two jobs. Seed the tuning from `default*`; alternate the one authored
 * channel (`paths`) against a remembered shadow so a machine stroke of its
 * own is never undone by an unrelated prop change. Report what moved
 * through `draw` (every stroke event) and `draw-end` (commit + clear). The
 * callbacks live on the props surface — the def maps them to CustomEvents.
 */

import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type SignaturePadContext,
  type SignaturePadDrawDetails,
  type SignaturePadEvent,
} from "./signature-pad.machine.ts";
import {
  connectRobotSignaturePad,
  type ReadSignaturePadProps,
  type SignaturePadApi,
  type SignaturePadConnectProps,
  type SignaturePadService,
} from "./signature-pad.connect.ts";

export interface SignaturePadCallbacks {
  readonly onDraw: ((details: SignaturePadDrawDetails) => void) | undefined;
  readonly onDrawEnd: ((details: SignaturePadDrawDetails) => void) | undefined;
}

const numProp = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

const boolProp = (raw: unknown): boolean => raw === true;

/** Paths travel the prop channel as JSON: the grammar types an array either
 * as `string[]` (whose default coercion produces `["[]"]` for `= []`) or as
 * a JSON string, so both spellings parse and anything else is no paths. */
const pathsProp = (raw: unknown): string[] | null => {
  if (Array.isArray(raw)) {
    return raw.every((item) => typeof item === "string") ? [...(raw as string[])] : null;
  }
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? [...(parsed as string[])]
      : null;
  } catch {
    return null;
  }
};

const samePaths = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((path, index) => path === b[index]);

export function createSignaturePadBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: SignaturePadApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every pad on the page would otherwise share one
  // stroke.
  const machine = createMachine<SignaturePadContext, SignaturePadEvent>({
    ...config,
    context: {
      ...config.context,
      paths: [...config.context.paths],
      currentPoints: [...config.context.currentPoints],
      tuning: { ...config.context.tuning },
    },
  }, implementations);

  let service: Service<SignaturePadContext, SignaturePadEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): SignaturePadCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onDraw: pick<(d: SignaturePadDrawDetails) => void>("onDraw"),
      onDrawEnd: pick<(d: SignaturePadDrawDetails) => void>("onDrawEnd"),
    };
  };

  const readTuning = (): Partial<SignaturePadContext["tuning"]> => {
    const p = props();
    const drawing = p["drawing"];
    if (typeof drawing !== "object" || drawing === null) return {};
    const d = drawing as Record<string, unknown>;
    const size = numProp(d["size"]);
    const thinning = numProp(d["thinning"]);
    const smoothing = numProp(d["smoothing"]);
    const streamline = numProp(d["streamline"]);
    const simulate = d["simulatePressure"];
    return {
      ...(size !== null ? { size } : {}),
      ...(typeof simulate === "boolean" ? { simulatePressure: simulate } : {}),
      ...(thinning !== null ? { thinning } : {}),
      ...(smoothing !== null ? { smoothing } : {}),
      ...(streamline !== null ? { streamline } : {}),
    };
  };

  const readConnectProps: ReadSignaturePadProps = (): SignaturePadConnectProps => {
    const p = props();
    const drawing = p["drawing"];
    let fill = "currentColor";
    if (typeof drawing === "object" && drawing !== null) {
      const raw = (drawing as Record<string, unknown>)["fill"];
      if (typeof raw === "string" && raw.length > 0) fill = raw;
    }
    return {
      disabled: boolProp(p["disabled"]),
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      fill,
    };
  };

  const ensureService = (): Service<SignaturePadContext, SignaturePadEvent> => {
    if (service) return service;
    const p = props();
    const seeded = authored("paths") ? pathsProp(p["paths"]) : pathsProp(p["defaultPaths"]);
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, {
        paths: seeded ?? [],
        disabled: boolProp(p["disabled"]),
        readOnly: boolProp(p["readOnly"]),
        tuning: { ...svc.state.context.tuning, ...readTuning() },
      });
      return svc;
    });
    return service;
  };

  /** What the paths channel last imposed, seeded from the same place the
   * machine was, so a host that authors the seeded value writes nothing. */
  let lastPaths: string[] = [...ensureService().state.context.paths];

  let padConnect: SignaturePadApi | undefined;
  const ensureConnect = (): SignaturePadApi => {
    padConnect ??= connectRobotSignaturePad(serviceApi, readConnectProps, id);
    return padConnect;
  };

  /** Report what moved. draw fires on every stroke event (down/move/up);
   * draw-end fires on commit (up) and clear. The cursors advance only after
   * the callbacks: the fork's send is synchronous, so a post-send check
   * would already see the new value. */
  const notify = (kind: "stroke" | "commit"): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (!samePaths(lastPaths, after.paths)) {
      lastPaths = [...after.paths];
    }
    const details: SignaturePadDrawDetails = {
      paths: [...after.paths],
      currentPath: after.currentPath,
    };
    callbacks.onDraw?.(details);
    if (kind === "commit") callbacks.onDrawEnd?.(details);
  };

  const send = (event: SignaturePadEvent): void => {
    const svc = ensureService();
    const next = svc.state.context;
    const disabled = boolProp(props()["disabled"]);
    if (next.disabled !== disabled) next.disabled = disabled;
    const readOnly = boolProp(props()["readOnly"]);
    if (next.readOnly !== readOnly) next.readOnly = readOnly;
    Object.assign(next.tuning, readTuning());
    if (
      event.type === "POINTER_DOWN" || event.type === "POINTER_MOVE" ||
      event.type === "POINTER_UP" || event.type === "CLEAR"
    ) {
      svc.send(event);
      notify(event.type === "POINTER_UP" || event.type === "CLEAR" ? "commit" : "stroke");
    } else {
      svc.send(event);
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: SignaturePadService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get phase() {
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
      if (authored("paths")) {
        const outer = pathsProp(props()["paths"]);
        if (outer !== null && !samePaths(lastPaths, outer)) {
          untrack(() => svc.send({ type: "SET_PATHS", paths: outer }));
          moved = true;
        }
      }
      if (moved) notify("commit");
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as SignaturePadApi, {
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
