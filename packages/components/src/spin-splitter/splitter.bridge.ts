import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  defaultSizes,
  implementations,
  validateSizes,
  type SplitterContext,
  type SplitterEvent,
  type SplitterPanel,
  type SplitterResizeDetails,
} from "./splitter.machine.ts";
import {
  connectSplitter,
  type SplitterApi,
  type SplitterConnectProps,
  type SplitterService,
} from "./splitter.connect.ts";

/**
 * The splitter bridge: scope values in, machine state out.
 *
 * Panels arrive as JSON (the scope grammar has no object-array transport
 * for panel data — see the recipe). The bridge normalizes percent sizes
 * from `size`/`defaultSize`, alternates the authored `size` channel
 * against a remembered shadow, and reports resizes through `resize` (every
 * move) and `resize-end` (release + keyboard). The callbacks live on the
 * props surface — the def maps them to CustomEvents.
 */

export interface SplitterCallbacks {
  readonly onResize: ((details: SplitterResizeDetails) => void) | undefined;
  readonly onResizeEnd: ((details: SplitterResizeDetails) => void) | undefined;
}

const textProp = (raw: unknown): string => (typeof raw === "string" ? raw : "");

/** Panels travel the prop channel as JSON text: id plus optional numeric
 * constraints. Anything else arriving is no panels. */
export function parsePanels(raw: unknown): SplitterPanel[] {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return [];
  const panels: SplitterPanel[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = record["id"];
    if (typeof id !== "string" || id.length === 0) continue;
    const num = (name: string): number | undefined => {
      const value = record[name];
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    };
    const bool = (name: string): boolean | undefined => {
      const value = record[name];
      return typeof value === "boolean" ? value : undefined;
    };
    panels.push({
      id,
      ...(num("minSize") !== undefined ? { minSize: num("minSize") } : {}),
      ...(num("maxSize") !== undefined ? { maxSize: num("maxSize") } : {}),
      ...(bool("collapsible") !== undefined ? { collapsible: bool("collapsible") } : {}),
      ...(num("collapsedSize") !== undefined ? { collapsedSize: num("collapsedSize") } : {}),
    });
  }
  return panels;
}

/** Percent sizes travel the prop channel as JSON text (see valuesProp in
 * the slider bridge: the grammar coerces `= []` to `["[]"]`). */
function sizesProp(raw: unknown): number[] | null {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return null;
  return list.every((item) => typeof item === "number" && Number.isFinite(item))
    ? [...(list as number[])]
    : null;
}

const sameSizes = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const samePanels = (a: readonly SplitterPanel[], b: readonly SplitterPanel[]): boolean =>
  a.length === b.length &&
  a.every((panel, index) =>
    panel.id === b[index]?.id &&
    panel.minSize === b[index]?.minSize &&
    panel.maxSize === b[index]?.maxSize &&
    panel.collapsible === b[index]?.collapsible &&
    panel.collapsedSize === b[index]?.collapsedSize
  );

export function createSplitterBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: SplitterApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every splitter on the page would otherwise share one
  // layout.
  const machine = createMachine<SplitterContext, SplitterEvent>(
    { ...config, context: { ...config.context, panels: [], size: [], beforeCollapse: {} } },
    implementations,
  );

  let service: Service<SplitterContext, SplitterEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): SplitterCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onResize: pick<(d: SplitterResizeDetails) => void>("onResize"),
      onResizeEnd: pick<(d: SplitterResizeDetails) => void>("onResizeEnd"),
    };
  };

  const readConnectProps = (): SplitterConnectProps => {
    const p = props();
    const label = textProp(p["label"]);
    void label;
    return {
      disabled: p["disabled"] === true,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      orientation: p["orientation"] === "vertical" ? "vertical" : "horizontal",
      keyboardResizeBy: 1,
      label: "",
    };
  };

  /** Panels memoized on the prop's identity: the parse builds fresh
   * objects, and a fresh parse per read would look like a new panel tree. */
  let panelsSource: unknown;
  let panelsCache: SplitterPanel[] = [];
  const panels = (): SplitterPanel[] => {
    const raw = authored("panels") ? props()["panels"] : props()["defaultPanels"];
    if (raw !== panelsSource) {
      panelsSource = raw;
      panelsCache = parsePanels(raw);
    }
    return panelsCache;
  };

  const seedSizes = (panels: SplitterPanel[]): number[] => {
    const p = props();
    const spec = sizesProp(authored("size") ? p["size"] : p["defaultSize"]) ?? [];
    try {
      return validateSizes(panels, defaultSizes(panels.length, spec));
    } catch {
      return defaultSizes(panels.length, spec);
    }
  };

  const ensureService = (): Service<SplitterContext, SplitterEvent> => {
    if (service) return service;
    const p = props();
    const list = panels();
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, {
        panels: [...list],
        size: seedSizes(list),
        orientation: p["orientation"] === "vertical" ? "vertical" : "horizontal",
        disabled: p["disabled"] === true,
      });
      return svc;
    });
    return service;
  };

  /** What the size channel last imposed, seeded from the same place the
   * machine was, so a host that authors the seeded value writes nothing. */
  let lastSize: number[] = [...ensureService().state.context.size];

  let splitterConnect: SplitterApi | undefined;
  const ensureConnect = (): SplitterApi => {
    splitterConnect ??= connectSplitter(serviceApi, readConnectProps, id);
    return splitterConnect;
  };

  /**
   * Report what moved. Resize fires on every size event; resize-end fires
   * on release and keyboard commits. The cursor advances only after the
   * callbacks: the fork's send is synchronous, so a post-send check would
   * already see the new value.
   */
  const notify = (kind: "move" | "commit"): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (!sameSizes(lastSize, after.size)) {
      lastSize = [...after.size];
      callbacks.onResize?.({ size: [...after.size], handleId: after.drag?.handleId ?? null });
      if (kind === "commit") {
        callbacks.onResizeEnd?.({ size: [...after.size], handleId: after.drag?.handleId ?? null });
      }
    } else if (kind === "commit" && after.size.length > 0) {
      callbacks.onResizeEnd?.({ size: [...after.size], handleId: after.drag?.handleId ?? null });
    }
  };

  const COMMIT = new Set([
    "POINTER_UP",
    "KEYBOARD_MOVE",
    "ENTER",
    "SET_SIZE",
    "COLLAPSE_PANEL",
    "EXPAND_PANEL",
    "RESIZE_PANEL",
  ]);

  const send = (event: SplitterEvent): void => {
    const svc = ensureService();
    const next = svc.state.context;
    // Panels and scalars re-read on every send so an assign never reads a
    // stale one. A changed panel tree reseeds the sizes it still fits.
    const list = panels();
    if (!samePanels(next.panels, list)) {
      next.panels = [...list];
      try {
        next.size = validateSizes(next.panels, defaultSizes(next.panels.length, next.size));
      } catch {
        next.size = defaultSizes(next.panels.length, []);
      }
    }
    const disabled = props()["disabled"] === true;
    if (next.disabled !== disabled) next.disabled = disabled;
    const orientation = props()["orientation"] === "vertical" ? "vertical" : "horizontal";
    if (next.orientation !== orientation) next.orientation = orientation;
    svc.send(event);
    notify(COMMIT.has(event.type) ? "commit" : "move");
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: SplitterService = {
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
      if (authored("size")) {
        const outer = sizesProp(props()["size"]);
        if (outer !== null && !sameSizes(lastSize, outer)) {
          try {
            const safe = validateSizes(svc.state.context.panels, outer);
            if (!sameSizes(lastSize, safe)) {
              untrack(() => svc.send({ type: "SET_SIZE", size: safe }));
              moved = true;
            }
          } catch {
            // An ill-fitting host write is refused, never half-applied.
          }
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

  const api = new Proxy({} as SplitterApi, {
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

