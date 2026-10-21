import {
  authoredProps,
  defineComponent,
  isRecord,
  machineTick,
  resolveTwins,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  carousel as carouselMachine,
  initial,
  pageCountFor,
  slidesOf,
  slidesPerMoveOf,
  slidesPerPageOf,
  type CarouselArgs,
  type CarouselContext,
  type CarouselDragStatus,
  type CarouselEvents,
  type CarouselSlide,
} from "./carousel.machine.ts";

export type { CarouselDragStatus, CarouselSlide };

/**
 * Carousel definition: the DOM contract as data. Everything that MOVES is
 * the browser: the item group is a native scroll container with scroll-snap,
 * so a drag, a fling and a settle are one motion the platform owns and no
 * transform is ever written.
 *
 * `index` is this machine's name for the page — the element's prop, its
 * command and its event all say `index`, because a carousel pages slides
 * and `page` is one word for two ideas.
 */

export interface CarouselItemProps {
  readonly index: number;
  readonly snapAlign?: "start" | "end" | "center";
}

export interface CarouselIndicatorProps {
  readonly index: number;
  readonly readOnly?: boolean;
}

/** A live value the markup's one-shot text channel cannot otherwise render. */
export interface CarouselReadout {
  value: string;
}

export interface CarouselIndexChange {
  readonly index: number;
  readonly pageCount: number;
}

export interface CarouselDragStatusChange {
  readonly status: CarouselDragStatus;
  readonly index: number;
}

export interface CarouselAutoplayStatusChange {
  readonly status: "playing" | "stopped";
  readonly index: number;
}

export interface CarouselApi {
  readonly index: number;
  readonly pageCount: number;
  readonly slidesInView: readonly number[];
  readonly isPlaying: boolean;
  readonly isDragging: boolean;
  readonly isSettling: boolean;
  readonly dragStatus: CarouselDragStatus;
  readonly canScrollNext: boolean;
  readonly canScrollPrev: boolean;
  getProgress(): number;
  getProgressText(): string;
  /**
   * The readout as a one-row list. The markup's text channel is a one-shot:
   * a `{...}` interpolation is captured at build and only re-run when its
   * row updates, so a value that must change on its own rides a row.
   */
  getProgressRows(): readonly CarouselReadout[];
  scrollToIndex(index: number): void;
  scrollTo(page: number): void;
  scrollNext(): void;
  scrollPrev(): void;
  play(): void;
  pause(): void;
  isInView(index: number): boolean;
  refresh(): void;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  setAutoplay(on: boolean): void;
  getRootProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getItemGroupProps(): Record<string, unknown>;
  getItemProps(props: CarouselItemProps): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getAutoplayTriggerProps(): Record<string, unknown>;
  getIndicatorGroupProps(): Record<string, unknown>;
  getIndicatorProps(props: CarouselIndicatorProps): Record<string, unknown>;
  getProgressTextProps(): Record<string, unknown>;
  getAutoplayProgressProps(): Record<string, unknown>;
  getAutoplayProgressFillProps(): Record<string, unknown>;
}

/** The in-view threshold is a percentage; the observer wants a 0..1
 * fraction. Normalizing here keeps the prop's authored unit. */
const intersectThreshold = (raw: unknown): number => {
  const percent = typeof raw === "number" && Number.isFinite(raw) ? raw : 60;
  return Math.min(1, Math.max(0, percent / 100));
};

const derive = (parsed: Record<string, unknown>): {
  readonly slidesPerPage: number;
  readonly perMove: number;
  readonly autoSize: boolean;
  readonly slideCount: number;
  readonly pageCount: number;
} => {
  const slidesPerPage = slidesPerPageOf(parsed["slidesPerPage"]);
  const perMove = slidesPerMoveOf(parsed["slidesPerMove"], slidesPerPage);
  const autoSize = parsed["autoSize"] === true;
  const slideCount = slidesOf(parsed["items"]).length;
  return {
    slidesPerPage,
    perMove,
    autoSize,
    slideCount,
    pageCount: pageCountFor(slideCount, perMove, slidesPerPage, autoSize),
  };
};

type Ctx = CarouselContext;

interface ScopeLike extends PartScope<unknown, CarouselContext> {}

interface SlotLike<R> extends SlotScope<R, CarouselContext> {}

const lastPageOf = (ctx: Ctx): number => Math.max(0, ctx.pageCount - 1);
const movesOf = (ctx: Ctx): number => Math.max(1, Math.trunc(ctx.perMove));

/**
 * State that must outlive one api build: the scroll container has
 * continuous history — which page it was last positioned on — and the live
 * readout needs a stable identity so the row that renders it can re-read
 * it. Keyed by the bridge's id function, which is stable per element.
 */
interface CarouselView {
  appliedKey: string;
  readonly readout: CarouselReadout;
}
type IdFn = (part: string, slot?: number) => string;

const viewByBridge = new WeakMap<IdFn, CarouselView>();
const viewOf = (id: (part: string, slot?: number) => string): CarouselView => {
  let view = viewByBridge.get(id);
  if (view === undefined) {
    view = { appliedKey: "", readout: { value: "" } };
    viewByBridge.set(id, view);
  }
  return view;
};

/** Whether the track holds a tabbable descendant: the track itself
 * leaves the tab order then. */
const hasTabbable = (scope: ScopeLike): boolean => {
  const host = scope.root();
  if (typeof host.querySelector !== "function") return false;
  const group = host.querySelector(`[id="${scope.id("itemGroup")}"]`);
  if (group === null || typeof group.querySelector !== "function") return false;
  return group.querySelector(TABBABLE) !== null;
};

const TABBABLE =
  "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])";

/**
 * Slides-per-page as presence attributes: a slide's width is `1/N` of the
 * track minus the gaps, and a runtime N can only be said in a class name by
 * enumerating it. Six is every real carousel; past that the element renders
 * full-width slides and says so.
 */
const MAX_SLIDES_PER_PAGE = 6;
const snapOf = (arg: unknown): string => {
  if (!isRecord(arg)) return "start";
  const snap: unknown = arg["snapAlign"];
  return snap === "start" || snap === "end" || snap === "center" ? snap : "start";
};

const isIdFn = (id: unknown): id is (part: string, slot?: number) => string =>
  typeof id === "function";

const fallbackId: (part: string, slot?: number) => string = () => "";

const countOf = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const perPageAttrs = (slidesPerPage: number): Record<string, unknown> => {
  const attrs: Record<string, unknown> = {};
  for (let n = 2; n <= MAX_SLIDES_PER_PAGE; n += 1) {
    if (slidesPerPage === n) attrs[`data-slides-${n}`] = "";
  }
  return attrs;
};

/**
 * In view is the current page first, the observer second. The page is what
 * the machine IS on, so its slides are in view the moment the index moves;
 * the observer still adds whatever a drag passes THROUGH.
 */
const slideInView = (scope: ScopeLike, index: number): boolean => {
  const ctx = scope.context;
  if (ctx.slidesInView.includes(index)) return true;
  const slides = slidesOf(scope.props["items"]);
  const start = ctx.index * movesOf(ctx);
  const perPage: unknown = scope.props["slidesPerPage"];
  const perMove = Math.max(1, Math.min(typeof perPage === "number" && perPage > 0 ? perPage : 1, slides.length - start || 1));
  return index >= start && index < start + perMove;
};

/**
 * Position the container on a page. The target is the first slide of that
 * page, MEASURED rather than computed from a formula, so padding, gaps and
 * fractional widths are already accounted for. `behavior` is explicit
 * because the class supplies `scroll-smooth` and the very first
 * positioning must not glide into place while the observer is still
 * reporting the page the element rendered at.
 */
const queryChild = (root: Element | null, selector: string): Element | null => {
  if (root === null || typeof root.querySelector !== "function") return null;
  return root.querySelector(selector);
};

const applyScroll = (
  id: (part: string, slot?: number) => string,
  root: () => Element,
  horizontal: boolean,
  page: number,
  perMove: number,
  behavior: ScrollBehavior,
): void => {
  // DOM reads stay inside the owned root, never the global document.
  const host = root();
  const group = host.querySelector(`[id="${id("itemGroup")}"]`);
  if (!(group instanceof HTMLElement)) return;
  const target = queryChild(group, `[data-index="${page * perMove}"]`);
  if (!(target instanceof HTMLElement)) return;
  const axis: "left" | "top" = horizontal ? "left" : "top";
  const from = group.getBoundingClientRect()[axis];
  const to = target.getBoundingClientRect()[axis];
  const at = axis === "left" ? group.scrollLeft : group.scrollTop;
  group.scrollTo({ [axis]: to - from + at, behavior });
};

const syncView = (
  id: (part: string, slot?: number) => string,
  root: () => Element,
  horizontal: boolean,
  index: number,
  pageCount: number,
  perMove: number,
): void => {
  const view = viewOf(id);
  const key = `${index}:${pageCount}`;
  if (key === view.appliedKey) return;
  const first = view.appliedKey === "";
  view.appliedKey = key;
  const request = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (fn: () => void): number => {
      fn();
      return 0;
    };
  request(() => applyScroll(id, root, horizontal, index, perMove, first ? "auto" : "smooth"));
};

/**
 * The page the track is actually showing, measured from the DOM: the slide
 * whose start edge sits closest to the container's start edge. The view owns
 * the measurement; the machine never walks the DOM.
 */
const settlePage = (scope: ScopeLike): number => {
  const ctx = scope.context;
  const horizontal = scope.props["orientation"] !== "vertical";
  // DOM reads stay inside the owned root, never the global document.
  const host = scope.root();
  if (typeof host.querySelectorAll !== "function") return ctx.index;
  const group = host.querySelector(`[id="${scope.id("itemGroup")}"]`);
  if (!(group instanceof HTMLElement)) return ctx.index;
  const axis: "left" | "top" = horizontal ? "left" : "top";
  const start = group.getBoundingClientRect()[axis];
  let best = ctx.index;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slide of group.querySelectorAll("[data-index]")) {
    if (!(slide instanceof HTMLElement)) continue;
    const at = Number.parseInt(slide.getAttribute("data-index") ?? "", 10);
    if (!Number.isFinite(at)) continue;
    const distance = Math.abs(slide.getBoundingClientRect()[axis] - start);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = Math.min(Math.max(0, Math.floor(at / movesOf(ctx))), lastPageOf(ctx));
    }
  }
  return best;
};

const onTrackKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  const horizontal = scope.props["orientation"] !== "vertical";
  const rtl = scope.props["dir"] === "rtl";
  const forward = horizontal
    ? event.key === (rtl ? "ArrowLeft" : "ArrowRight")
    : event.key === "ArrowDown";
  const back = horizontal
    ? event.key === (rtl ? "ArrowRight" : "ArrowLeft")
    : event.key === "ArrowUp";
  if (forward) scope.send({ type: "NEXT" });
  else if (back) scope.send({ type: "PREV" });
  else if (event.key === "Home") scope.send({ type: "GO_TO", index: 0 });
  else if (event.key === "End") scope.send({ type: "GO_TO", index: lastPageOf(scope.context) });
  else return;
  event.preventDefault();
};

const def: ComponentDef<CarouselContext, CarouselEvents> = {
  name: "carousel",
  machine: (props, authored) => carouselMachine(props as CarouselArgs, authored),
  start: (raw, _authored) => (raw["autoplay"] === true ? "autoplay" : "idle"),
  // The first positioning must not glide: mounted positions without motion,
  // and every later page move glides through settled.
  mounted: ({ props, id, root }) => {
    // The twins resolved the way the factory saw them, so the view lands
    // on the page the machine is on.
    const shaped = initial(
      resolveTwins(props, authoredProps(() => props)) as CarouselArgs,
      authoredProps(() => props),
    );
    syncView(
      id,
      root,
      props["orientation"] !== "vertical",
      shaped.index,
      shaped.pageCount,
      shaped.perMove,
    );
  },
  settled: ({ after, props, id, root }) => {
    const ctx = after.context;
    const d = derive(props);
    syncView(
      id,
      root,
      props["orientation"] !== "vertical",
      ctx.index,
      ctx.pageCount,
      d.perMove,
    );
  },
  reconcile: ({ context, parsed, send }) => {
    const ctx = context;
    const d = derive(parsed);
    ctx.slideParams = {
      perMove: d.perMove,
      slidesPerPage: d.slidesPerPage,
      autoSize: d.autoSize,
      slideCount: d.slideCount,
    };
    let moved = false;
    if (ctx.perMove !== d.perMove) {
      ctx.perMove = d.perMove;
      moved = true;
    }
    if (ctx.pageCount !== d.pageCount) {
      send({ type: "PAGES.SET", count: d.pageCount });
      moved = true;
    }
    // The controlled `index` is the machine's business: the contract
    // carries it, and the machine clamps it into the page count.
    return moved;
  },
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.props["dir"], scope.props["orientation"], scope.props["autoplayDelay"]].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        "data-scope": "carousel",
        "data-part": "root",
        role: "region",
        "aria-roledescription": "carousel",
        "data-orientation": scope.props["orientation"],
        "data-state": scope.state === "autoplay" ? "playing" : "idle",
        dir: scope.props["dir"],
        onPointerdown: (): void => scope.send({ type: "POINTER.DOWN" }),
        "use:autoplay": {
          interval: scope.props["autoplayDelay"],
          enabled: scope.state === "autoplay",
          onTick: (): void => scope.send({ type: "AUTOPLAY.TICK" }),
        },
      }),
    },
    control: {
      sig: (scope) => [`${scope.props["orientation"]}`].join(" "),
      attrs: (scope) => ({
        role: "group",
        "aria-label": "Carousel controls",
        "data-orientation": scope.props["orientation"],
      }),
    },
    itemGroup: {
      id: "item-group",
      sig: (scope) => {
        const ctx = scope.context;
        return [scope.state, ctx.dragStatus, scope.props["orientation"], scope.props["allowMouseDrag"], ctx.index, ctx.pageCount].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const horizontal = scope.props["orientation"] !== "vertical";
        const playing = scope.state === "autoplay";
        return {
          id: scope.id("itemGroup"),
        "data-scope": "carousel",
        "data-part": "item-group",
          "data-orientation": scope.props["orientation"],
          // The one place a state is a utility switch: with snap mandatory
          // the platform would fight the pointer, so the drag turns it off
          // and the class turns it back on. Nobody writes a style.
          ...(ctx.dragStatus === "dragging" ? { "data-dragging": "" } : {}),
          ...(scope.props["allowMouseDrag"] === true ? { "data-draggable": "" } : {}),
          "aria-live": playing ? "off" : "polite",
          tabindex: hasTabbable(scope) ? -1 : 0,
          onFocusin: (): void => scope.send({ type: "VIEWPORT.FOCUS" }),
          onFocusout: (): void => scope.send({ type: "VIEWPORT.BLUR" }),
          onKeydown: (event: KeyboardEvent): void => onTrackKeydown(scope, event),
          onScrollend: (): void => scope.send({ type: "SCROLL.SETTLE", index: settlePage(scope) }),
          ...(scope.props["allowMouseDrag"] === true && horizontal
            ? {
              "use:drag-scroll": {
                onDragStart: (): void => scope.send({ type: "DRAG.START" }),
                // A press that moved nothing produces no scroll and so no
                // `scrollend`: the velocity is zero, and the gesture is over.
                onDragEnd: (velocity: number): void => {
                  scope.send({ type: "DRAG.END" });
                  if (velocity === 0) {
                    scope.send({ type: "SCROLL.SETTLE", index: settlePage(scope) });
                  }
                },
              },
            }
            : {}),
          "use:resize-observer": {
            onResize: (): void => {
              const ctx = scope.context;
              if (ctx.dragStatus === "dragging") return;
              viewOf(scope.id).appliedKey = "";
              const d = derive(scope.props);
              syncView(
                scope.id,
                scope.root,
                scope.props["orientation"] !== "vertical",
                ctx.index,
                ctx.pageCount,
                d.perMove,
              );
            },
          },
        };
      },
    },
    prevTrigger: {
      id: "prev-trigger",
      sig: (scope) => {
        const ctx = scope.context;
        return [`${ctx.loop || ctx.index > 0}`, scope.props["orientation"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const can = ctx.loop || ctx.index > 0;
        return {
          id: scope.id("prevTrigger"),
        "data-scope": "carousel",
        "data-part": "prev-trigger",
          type: "button",
          "aria-label": "Previous slide",
          "aria-controls": scope.id("itemGroup"),
          "data-orientation": scope.props["orientation"],
          "data-disabled": can ? undefined : "",
          disabled: !can,
          onClick: (): void => scope.send({ type: "PREV" }),
        };
      },
    },
    nextTrigger: {
      id: "next-trigger",
      sig: (scope) => {
        const ctx = scope.context;
        return [`${ctx.loop || ctx.index < lastPageOf(ctx)}`, scope.props["orientation"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const can = ctx.loop || ctx.index < lastPageOf(ctx);
        return {
          id: scope.id("nextTrigger"),
        "data-scope": "carousel",
        "data-part": "next-trigger",
          type: "button",
          "aria-label": "Next slide",
          "aria-controls": scope.id("itemGroup"),
          "data-orientation": scope.props["orientation"],
          "data-disabled": can ? undefined : "",
          disabled: !can,
          onClick: (): void => scope.send({ type: "NEXT" }),
        };
      },
    },
    autoplayTrigger: {
      id: "autoplay-trigger",
      sig: (scope) => [scope.state, scope.props["orientation"]].join(" "),
      attrs: (scope) => {
        const playing = scope.state === "autoplay";
        return {
          id: scope.id("autoplayTrigger"),
        "data-scope": "carousel",
        "data-part": "autoplay-trigger",
          type: "button",
          "aria-label": playing ? "Stop slide rotation" : "Start slide rotation",
          "aria-pressed": playing,
          "data-orientation": scope.props["orientation"],
          "data-playing": playing ? "" : undefined,
          onClick: (): void => scope.send({ type: playing ? "AUTOPLAY.STOP" : "AUTOPLAY.START" }),
        };
      },
    },
    indicatorGroup: {
      id: "indicator-group",
      sig: (scope) => [`${scope.props["orientation"]}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("indicatorGroup"),
        "data-scope": "carousel",
        "data-part": "indicator-group",
        role: "group",
        "aria-label": "Slides",
        "data-orientation": scope.props["orientation"],
        onKeydown: (event: KeyboardEvent): void => onTrackKeydown(scope, event),
      }),
    },
    progressText: {
      id: "progress-text",
      sig: (scope) => [scope.state].join(" "),
      attrs: (scope) => ({
        id: scope.id("progressText"),
        "data-scope": "carousel",
        "data-part": "progress-text",
        "data-orientation": scope.props["orientation"],
        "data-state": scope.state === "autoplay" ? "playing" : "paused",
      }),
    },
    autoplayProgress: {
      id: "autoplay-progress",
      sig: (scope) => [scope.state, scope.props["orientation"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("autoplayProgress"),
        "data-scope": "carousel",
        "data-part": "autoplay-progress",
        "data-orientation": scope.props["orientation"],
        "data-state": scope.state === "autoplay" ? "playing" : "paused",
        "aria-hidden": true,
      }),
    },
    autoplayProgressFill: {
      id: "autoplay-progress-fill",
      sig: (scope) => [scope.state, scope.props["orientation"]].join(" "),
      attrs: (scope) => ({
        "data-orientation": scope.props["orientation"],
        "data-state": scope.state === "autoplay" ? "playing" : "paused",
      }),
    },
  },
  slots: {
    item: {
      indexes: (_context, props) => slidesOf(props["items"]),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const item = scope.slot;
        return [`${slideInView(scope, item.index)}`, scope.props["orientation"], scope.props["slidesPerPage"], scope.props["autoSize"]].join(" ");
      },
      attrs: (scope: SlotLike<{ readonly index: number }>, arg?: unknown) => {
        const item = scope.slot;
        const snap = snapOf(arg);
        const inView = slideInView(scope, item.index);
        return {
          id: scope.id("item", item.index),
        "data-scope": "carousel",
        "data-part": "item",
          role: "group",
          "data-index": item.index,
          "data-orientation": scope.props["orientation"],
          "data-inview": inView ? "" : undefined,
          "data-snap": snap,
          ...(scope.props["autoSize"] === true
            ? { "data-auto-size": "" }
            : { ...perPageAttrs(countOf(scope.props["slidesPerPage"]) ?? 1) }),
          "aria-roledescription": "slide",
          "aria-label": `${item.index + 1} of ${slidesOf(scope.props["items"]).length}`,
          "aria-hidden": !inView,
          "use:intersect": {
            threshold: intersectThreshold(scope.props["inViewThreshold"]),
            onVisibility: (visible: boolean): void => {
              scope.send({ type: "SLIDE.VIEW", index: item.index, inView: visible });
            },
          },
        };
      },
    },
    indicator: {
      indexes: (_context, props) => slidesOf(props["items"]).map((slide, index) => ({ ...slide, index })),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const item = scope.slot;
        return [`${item.index === scope.context.index}`, scope.props["orientation"]].join(" ");
      },
      attrs: (scope: SlotLike<{ readonly index: number; readonly label: string }>, arg?: unknown) => {
        const item = scope.slot;
        const readOnly = isRecord(arg) && arg["readOnly"] === true;
        const current = item.index === scope.context.index;
        return {
          id: scope.id("indicator", item.index),
        "data-scope": "carousel",
        "data-part": "indicator",
          type: "button",
          "data-index": item.index,
          "data-orientation": scope.props["orientation"],
          "data-current": current ? "" : undefined,
          "aria-current": current,
          "aria-label": `${item.index + 1} of ${slidesOf(scope.props["items"]).length} — ${item.label}`,
          "data-readonly": readOnly ? "" : undefined,
          onClick: (): void => {
            if (readOnly) return;
            scope.send({ type: "GO_TO", index: item.index });
          },
        };
      },
    },
  },
  commands: {
    next: { event: () => ({ type: "NEXT" }) },
    prev: { event: () => ({ type: "PREV" }) },
    goTo: { event: (args) => ({ type: "GO_TO", index: countOf(args[0]) ?? 0 }) },
    setAutoplay: { event: (args) => ({ type: args[0] === true ? "AUTOPLAY.START" : "AUTOPLAY.STOP" }) },
    scrollToIndex: {
      event: (args, context: CarouselContext) => ({
        type: "GO_TO",
        index: Math.floor((countOf(args[0]) ?? 0) / movesOf(context)),
      }),
    },
    scrollTo: { event: (args) => ({ type: "GO_TO", index: countOf(args[0]) ?? 0 }) },
    scrollNext: { event: () => ({ type: "NEXT" }) },
    scrollPrev: { event: () => ({ type: "PREV" }) },
    play: { event: () => ({ type: "AUTOPLAY.START" }) },
    pause: { event: () => ({ type: "AUTOPLAY.STOP" }) },
    refresh: {
      event: (_args, context: CarouselContext) => {
        const params = context.slideParams;
        return {
          type: "PAGES.SET",
          count: pageCountFor(params.slideCount, params.perMove, params.slidesPerPage, params.autoSize),
        };
      },
    },
  },
  readers: {
    index: { read: (context) => context.index },
    pageCount: { read: (context) => context.pageCount },
    slidesInView: { read: (context) => [...context.slidesInView] },
    isPlaying: { read: (_context, state) => state === "autoplay" },
    isDragging: { read: (context) => context.dragStatus === "dragging" },
    isSettling: { read: (context) => context.dragStatus === "settling" },
    dragStatus: { read: (context) => context.dragStatus },
    canScrollNext: {
      read: (context) => {
        const ctx = context;
        return ctx.loop || ctx.index < lastPageOf(ctx);
      },
    },
    canScrollPrev: {
      read: (context) => {
        const ctx = context;
        return ctx.loop || ctx.index > 0;
      },
    },
  },
  methods: {
    getProgress: {
      call: (context: CarouselContext) => (context.pageCount > 0 ? context.index / context.pageCount : 0),
    },
    getProgressText: {
      call: (context: CarouselContext) => `${context.index + 1} / ${context.pageCount}`,
    },
    getProgressRows: {
      call: (context: CarouselContext, _state, _args, _props, id) => {
        const ctx = context;
        // The row's update re-reads the holder, which is why the holder is
        // a stable object rewritten here rather than a captured string.
        const view = viewOf(isIdFn(id) ? id : fallbackId);
        view.readout.value = `${ctx.index + 1} / ${ctx.pageCount}`;
        machineTick();
        return [view.readout];
      },
    },
    isInView: {
      call: (context: CarouselContext, _state, args, props) => {
        const ctx = context;
        const index = countOf(args[0]);
        if (index === null) return false;
        if (ctx.slidesInView.includes(index)) return true;
        const slides = slidesOf(props["items"]);
        const start = ctx.index * movesOf(ctx);
        const perMove = Math.max(1, Math.min(countOf(props["slidesPerPage"]) ?? 1, slides.length - start || 1));
        return index >= start && index < start + perMove;
      },
    },
  },
  events: {
    "index-change": {
      prop: "onIndexChange",
      watch: (context) => [context.index, context.pageCount],
      detail: (watched: readonly unknown[]) => ({
        index: typeof watched[0] === "number" ? watched[0] : 0,
        pageCount: typeof watched[1] === "number" ? watched[1] : 0,
      }),
    },
    "drag-status-change": {
      prop: "onDragStatusChange",
      watch: (context) => [context.dragStatus, context.index],
      detail: (watched: readonly unknown[]) => {
        const status = watched[0];
        const index = watched[1];
        const known: CarouselDragStatus = status === "focus" || status === "dragging" || status === "settling" ? status : "idle";
        return { status: known, index: typeof index === "number" ? index : 0 };
      },
    },
    "autoplay-status-change": {
      prop: "onAutoplayStatusChange",
      watch: (_context, state) => [state === "autoplay"],
      detail: (watched, _event, _props, context: CarouselContext) => ({
        status: watched[0] === true ? "playing" : "stopped",
        index: context.index,
      }),
    },
  },
};

export const carousel = defineComponent<CarouselContext, CarouselEvents, CarouselApi>(def);
