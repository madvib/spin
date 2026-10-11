import type { MachineDef } from "@spin/runtime";
import { computed, effect, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  type CarouselApi,
  type CarouselConnectProps,
  type CarouselSlide,
  type CarouselView,
  connectRobotCarousel,
} from "./carousel.connect.ts";
import {
  type CarouselAutoplayStatusChange,
  type CarouselContext,
  type CarouselDragStatusChange,
  type CarouselEvent,
  type CarouselIndexChange,
  config,
  implementations,
  pageCountFor,
} from "./carousel.machine.ts";

const asInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;

const slidesOf = (props: Record<string, unknown>): readonly CarouselSlide[] => {
  const raw = props["items"];
  return Array.isArray(raw) ? (raw as readonly CarouselSlide[]) : [];
};

/** Everything the machine derives from the slide props, in one place. */
interface Derived {
  readonly slidesPerPage: number;
  readonly perMove: number;
  readonly autoSize: boolean;
  readonly slideCount: number;
  readonly pageCount: number;
}

function derive(props: Record<string, unknown>): Derived {
  const slidesPerPage = Math.max(1, asInt(props["slidesPerPage"], 1));
  const raw = typeof props["slidesPerMove"] === "string"
    ? Number.parseInt(props["slidesPerMove"], 10)
    : Number.NaN;
  const perMove = Number.isFinite(raw) && raw > 0 ? raw : slidesPerPage;
  const autoSize = props["autoSize"] === true;
  const slideCount = slidesOf(props).length;
  return {
    slidesPerPage,
    perMove,
    autoSize,
    slideCount,
    pageCount: pageCountFor(slideCount, perMove, slidesPerPage, autoSize),
  };
}

/**
 * The carousel bridge: scope values in, machine state out.
 *
 * Three jobs, and only three. Seed from `defaultIndex` / `autoplay`; sync
 * the scalars the assigns read plus the page count derived from the slide
 * props; publish the connect api through the live-view proxy. Controlled
 * `index` alternates from an authored prop, exactly as tree-view's
 * controlled sets do, and the change events fire from `send`.
 */
export function createCarouselBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: CarouselApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<CarouselContext, CarouselEvent>(
    config,
    implementations,
  );
  const view: CarouselView = { appliedKey: "", readout: { value: "" } };

  let service: Service<CarouselContext, CarouselEvent> | undefined;

  const readCallbacks = () => {
    const p = props();
    return {
      onIndexChange: p["onIndexChange"] as
        | ((d: CarouselIndexChange) => void)
        | undefined,
      onDragStatusChange: p["onDragStatusChange"] as
        | ((d: CarouselDragStatusChange) => void)
        | undefined,
      onAutoplayStatusChange: p["onAutoplayStatusChange"] as
        | ((d: CarouselAutoplayStatusChange) => void)
        | undefined,
    };
  };

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function"
      ? (predicate as (n: string) => boolean)(name)
      : false;
  };

  const ensureService = (): Service<CarouselContext, CarouselEvent> => {
    if (!service) {
      const p = props();
      const d = derive(p);
      const seeded = Math.max(0, asInt(p["defaultIndex"], 0));
      service = owner.run(() => {
        const svc = interpret(machine).start(
          p["autoplay"] === true ? "autoplay" : "idle",
        );
        Object.assign(svc.state.context, {
          index: Math.min(seeded, Math.max(0, d.pageCount - 1)),
          pageCount: d.pageCount,
          perMove: d.perMove,
          loop: p["loop"] === true,
        });
        return svc;
      });
    }
    return service;
  };

  const connectProps = (): CarouselConnectProps => {
    const svc = ensureService();
    const p = props();
    const d = derive(p);
    return {
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      orientation: p["orientation"] === "vertical" ? "vertical" : "horizontal",
      slidesPerPage: d.slidesPerPage,
      autoSize: d.autoSize,
      snapType: p["snapType"] === "proximity" ? "proximity" : "mandatory",
      allowMouseDrag: p["allowMouseDrag"] === true,
      inViewThreshold: Math.min(
        1,
        Math.max(0, asInt(p["inViewThreshold"], 60) / 100),
      ),
      autoplayDelay: Math.max(1, asInt(p["autoplayDelay"], 4000)),
      playing: svc.state.value === "autoplay",
    };
  };

  function send(event: CarouselEvent): void {
    const svc = ensureService();
    const before = {
      index: svc.state.context.index,
      dragStatus: svc.state.context.dragStatus,
      playing: svc.state.value === "autoplay",
    };
    svc.send(event);
    const after = svc.state.context;
    const playing = svc.state.value === "autoplay";
    const cb = readCallbacks();
    if (after.index !== before.index) {
      cb.onIndexChange?.({ index: after.index, pageCount: after.pageCount });
    }
    if (after.dragStatus !== before.dragStatus) {
      cb.onDragStatusChange?.({ status: after.dragStatus, index: after.index });
    }
    if (playing !== before.playing) {
      cb.onAutoplayStatusChange?.({
        status: playing ? "playing" : "stopped",
        index: after.index,
      });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  let apiKey = "";

  /**
   * One owned effect for every inbound prop: the scalars the assigns read,
   * the derived page count, the authored index, and a rebuild of the api
   * when a connect-only prop moved. Writes and derived changes both go
   * through `send` or straight into context, so a host write is
   * indistinguishable from a gesture once it lands.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const p = props();
      const d = derive(p);
      const context = svc.state.context;
      let moved = false;

      if (context.loop !== (p["loop"] === true)) {
        context.loop = p["loop"] === true;
        moved = true;
      }
      if (context.perMove !== d.perMove) {
        context.perMove = d.perMove;
        moved = true;
      }
      if (context.pageCount !== d.pageCount) {
        send({ type: "PAGES.SET", count: d.pageCount });
        moved = true;
      }

      const outer = p["index"];
      if (authored("index") && typeof outer === "number") {
        const wanted = Math.min(
          Math.max(0, Math.trunc(outer)),
          Math.max(0, d.pageCount - 1),
        );
        if (context.index !== wanted) {
          context.index = wanted;
          moved = true;
        }
      }

      const slides = p["items"];
      const nextKey = [
        p["dir"],
        p["orientation"],
        d.slidesPerPage,
        d.autoSize,
        p["snapType"],
        p["allowMouseDrag"],
        p["inViewThreshold"],
        p["autoplayDelay"],
        Array.isArray(slides) ? slides.length : 0,
        Array.isArray(slides) ? slides : null,
      ].join("|");
      if (nextKey !== apiKey) apiKey = nextKey;

      if (moved) {
        tick(tick() + 1);
        machineTick(machineTick() + 1);
      }
    })
  );

  const connected = computed(() => {
    tick();
    const svc = ensureService();
    const adapted = {
      send: send as (event: { type: string } & Record<string, unknown>) => void,
      get context(): CarouselContext {
        return svc.state.context;
      },
    };
    return connectRobotCarousel(
      adapted,
      connectProps(),
      slidesOf(props()),
      id,
      send as (event: { type: string } & Record<string, unknown>) => void,
      view,
    );
  });

  // Commands resolve INSIDE the trap: an Object.assign onto a live-view
  // proxy is shadowed by the proxy's own get trap, and the host would call
  // undefined.
  const commands = {
    next: (): void => send({ type: "NEXT" }),
    prev: (): void => send({ type: "PREV" }),
    goTo: (index: number): void => send({ type: "GO_TO", index }),
    setAutoplay: (on: boolean): void =>
      send({ type: on ? "AUTOPLAY.START" : "AUTOPLAY.STOP" }),
  };

  const api = new Proxy({} as CarouselApi, {
    get: (_target, key) =>
      key in commands
        ? (commands as Record<string | symbol, unknown>)[key]
        : Reflect.get(connected(), key),
    has: (_target, key) => key in commands || Reflect.has(connected(), key),
    ownKeys: () => [
      ...new Set([...Reflect.ownKeys(connected()), ...Object.keys(commands)]),
    ],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) {
        return {
          configurable: true,
          enumerable: true,
          value: (commands as Record<string | symbol, unknown>)[key],
        };
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

export const carousel: MachineDef = {
  createBridge: createCarouselBridge,
  commands: ["next", "prev", "goTo", "setAutoplay"],
  events: {
    "index-change": {
      on: "onIndexChange",
      detail: (change: CarouselIndexChange) => ({
        index: change.index,
        pageCount: change.pageCount,
      }),
    },
    "drag-status-change": {
      on: "onDragStatusChange",
      detail: (change: CarouselDragStatusChange) => ({
        status: change.status,
        index: change.index,
      }),
    },
    "autoplay-status-change": {
      on: "onAutoplayStatusChange",
      detail: (change: CarouselAutoplayStatusChange) => ({
        status: change.status,
        index: change.index,
      }),
    },
  },
};
