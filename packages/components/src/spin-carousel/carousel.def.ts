import {
  defineComponent,
  machineTick,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  pageCountFor,
  type CarouselContext,
  type CarouselDragStatus,
  type CarouselEvent,
} from "./carousel.machine.ts";

export type { CarouselDragStatus };

/**
 * Carousel definition: the DOM contract as data. The machine holds a page
 * index and a mode (idle/autoplay). Everything that MOVES is the browser:
 * the item group is a native scroll container with scroll-snap, so a drag,
 * a fling and a settle are one motion the platform owns and no transform
 * is ever written. This file maps props to channels, parts to attribute
 * bags, commands to sends, and index/drag/autoplay transitions to their
 * events, with `send` as the only outward path for the stdlib reflexes.
 *
 * `index` is this machine's name for the page — the element's prop, its
 * command and its event all say `index`, because a carousel pages slides
 * and `page` is one word for two ideas.
 */

export interface CarouselSlide {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

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
   * row updates, so a value that must change on its own rides a row. The
   * holder is stable and re-read by that row, so the text follows the page.
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

const asInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;

const slidesOf = (parsed: Record<string, unknown>): readonly CarouselSlide[] => {
  const raw = parsed["items"];
  return Array.isArray(raw) ? (raw as readonly CarouselSlide[]) : [];
};

/** Everything the machine derives from the slide props, in one place. */
const derive = (parsed: Record<string, unknown>): {
  readonly slidesPerPage: number;
  readonly perMove: number;
  readonly autoSize: boolean;
  readonly slideCount: number;
  readonly pageCount: number;
} => {
  const slidesPerPage = Math.max(1, asInt(parsed["slidesPerPage"], 1));
  const raw = typeof parsed["slidesPerMove"] === "string"
    ? Number.parseInt(parsed["slidesPerMove"], 10)
    : Number.NaN;
  const perMove = Number.isFinite(raw) && (raw as number) > 0 ? (raw as number) : slidesPerPage;
  const autoSize = parsed["autoSize"] === true;
  const slideCount = slidesOf(parsed).length;
  return {
    slidesPerPage,
    perMove,
    autoSize,
    slideCount,
    pageCount: pageCountFor(slideCount, perMove, slidesPerPage, autoSize),
  };
};

type Ctx = CarouselContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const lastPageOf = (ctx: Ctx): number => Math.max(0, ctx.pageCount - 1);
const movesOf = (ctx: Ctx): number => Math.max(1, Math.trunc(ctx.perMove));

/**
 * State that must outlive one api build: the scroll container has
 * continuous history — which page it was last positioned on — and the live
 * readout needs a stable identity so the row that renders it can re-read
 * it. Keyed by the bridge's id function, which is stable per element.
 */
interface CarouselView {
  /** `${page}:${pageCount}` of the last positioning; `""` until the first. */
  appliedKey: string;
  /** The "1 / 5" readout, rewritten on every build. */
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

/** Descendants that take the keyboard away from the track. */
const TABBABLE =
  "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])";

/**
 * Slides-per-page as presence attributes.
 *
 * A slide's width is `1/N` of the track minus the gaps, and the only way to
 * say a runtime N in a class name is to enumerate it. Six is every real
 * carousel; past that the element renders full-width slides and says so.
 */
const MAX_SLIDES_PER_PAGE = 6;
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
  const ctx = asCtx(scope.context);
  if (ctx.slidesInView.includes(index)) return true;
  const slides = slidesOf(scope.props);
  const start = ctx.index * movesOf(ctx);
  const perMove = Math.max(1, Math.min((scope.props["slidesPerPage"] as number) || 1, slides.length - start || 1));
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
const applyScroll = (
  id: (part: string, slot?: number) => string,
  horizontal: boolean,
  page: number,
  perMove: number,
  behavior: ScrollBehavior,
): void => {
  if (typeof document === "undefined" || typeof HTMLElement === "undefined") return;
  const el = document.getElementById(id("itemGroup"));
  if (!(el instanceof HTMLElement)) return;
  const target = el.querySelector<HTMLElement>(`[data-index="${page * perMove}"]`);
  if (target === null) return;
  const axis: "left" | "top" = horizontal ? "left" : "top";
  const from = el.getBoundingClientRect()[axis];
  const to = target.getBoundingClientRect()[axis];
  const at = axis === "left" ? el.scrollLeft : el.scrollTop;
  el.scrollTo({ [axis]: to - from + at, behavior });
};

/** Reposition when the page or the page count moved — and on nothing else. */
const syncView = (
  id: (part: string, slot?: number) => string,
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
  request(() => applyScroll(id, horizontal, index, perMove, first ? "auto" : "smooth"));
};

/**
 * The page the track is actually showing, measured from the DOM: the slide
 * whose start edge sits closest to the container's start edge. This is the
 * only thing that turns a scroll into a page — so the view owns the
 * measurement and the machine never walks the DOM.
 */
const settlePage = (scope: ScopeLike): number => {
  const ctx = asCtx(scope.context);
  if (typeof document === "undefined" || typeof HTMLElement === "undefined") return ctx.index;
  const horizontal = scope.props["orientation"] !== "vertical";
  const el = document.getElementById(scope.id("itemGroup"));
  if (!(el instanceof HTMLElement)) return ctx.index;
  const axis: "left" | "top" = horizontal ? "left" : "top";
  const start = el.getBoundingClientRect()[axis];
  let best = ctx.index;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slide of el.querySelectorAll<HTMLElement>("[data-index]")) {
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
  else if (event.key === "End") scope.send({ type: "GO_TO", index: lastPageOf(asCtx(scope.context)) });
  else return;
  event.preventDefault();
};

const def: ComponentDef<CarouselContext, CarouselEvent> = {
  name: "carousel",
  config,
  implementations,
  start: (props) => ((props["autoplay"] as boolean) === true ? "autoplay" : "idle"),
  seed: (props) => {
    const d = derive(props);
    const seeded = Math.max(0, asInt(props["defaultIndex"], 0));
    return {
      index: Math.min(seeded, Math.max(0, d.pageCount - 1)),
      pageCount: d.pageCount,
      perMove: d.perMove,
      loop: props["loop"] === true,
    };
  },
  // The first positioning must not glide: mounted positions without motion,
  // and every later page move glides through settled.
  mounted: ({ props, id }) => {
    const d = derive(props);
    const seeded = Math.max(0, asInt(props["defaultIndex"], 0));
    syncView(
      id,
      props["orientation"] !== "vertical",
      Math.min(seeded, Math.max(0, d.pageCount - 1)),
      d.pageCount,
      d.perMove,
    );
  },
  settled: ({ after, props, id }) => {
    const ctx = (after as { readonly context: Ctx }).context;
    const d = derive(props);
    syncView(
      id,
      props["orientation"] !== "vertical",
      ctx.index,
      ctx.pageCount,
      d.perMove,
    );
  },
  channels: {
    items: { parse: (raw) => (Array.isArray(raw) ? raw : []) },
    index: {
      controlled: true,
      parse: (raw) => (typeof raw === "number" ? raw : 0),
      event: (value: number) => ({ type: "GO_TO", index: value }),
      // The host's write lands clamped, exactly as the bridge assigned it.
      assign: true,
    },
    defaultIndex: { parse: (raw) => (typeof raw === "number" ? raw : 0) },
    loop: { parse: (raw) => raw === true },
    autoplay: { parse: (raw) => raw === true },
    autoplayDelay: { parse: (raw) => Math.max(1, asInt(raw, 4000)) },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    orientation: { parse: (raw) => (raw === "vertical" ? "vertical" : "horizontal") },
    slidesPerPage: { parse: (raw) => Math.max(1, asInt(raw, 1)) },
    slidesPerMove: { parse: (raw) => (typeof raw === "string" ? raw : "auto") },
    autoSize: { parse: (raw) => raw === true },
    snapType: { parse: (raw) => (raw === "proximity" ? "proximity" : "mandatory") },
    allowMouseDrag: { parse: (raw) => raw === true },
    inViewThreshold: { parse: (raw) => Math.min(1, Math.max(0, asInt(raw, 60) / 100)) },
  },
  scalars: ["loop"],
  reconcile: ({ context, parsed, send }) => {
    const ctx = asCtx(context);
    const d = derive(parsed);
    (ctx as unknown as { slideParams: unknown }).slideParams = {
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
    const outer = parsed["index"];
    // Controlled `index` alternates from an authored prop, clamped to the
    // derived page count — exactly as the bridge assigned it.
    const authored = (parsed["@@authored"] as ((name: string) => boolean) | undefined)?.("index") === true;
    if (authored && typeof outer === "number") {
      const wanted = Math.min(Math.max(0, Math.trunc(outer)), Math.max(0, d.pageCount - 1));
      if (ctx.index !== wanted) {
        ctx.index = wanted;
        moved = true;
      }
    }
    return moved;
  },
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.props["dir"], scope.props["orientation"], scope.props["autoplayDelay"]].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        role: "region",
        "aria-roledescription": "carousel",
        "data-orientation": scope.props["orientation"],
        "data-state": scope.state === "autoplay" ? "playing" : "idle",
        dir: scope.props["dir"],
        onPointerdown: (): void => scope.send({ type: "POINTER.DOWN" }),
        // The clock: the action owns the interval, the machine owns nothing.
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
        const ctx = asCtx(scope.context);
        return [scope.state, ctx.dragStatus, scope.props["orientation"], scope.props["allowMouseDrag"], ctx.index, ctx.pageCount].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const horizontal = scope.props["orientation"] !== "vertical";
        const playing = scope.state === "autoplay";
        return {
          id: scope.id("itemGroup"),
          "data-orientation": scope.props["orientation"],
          // The one place a state is a utility switch: with snap mandatory
          // the platform would fight the pointer, so the drag turns it off
          // and the class turns it back on. Nobody writes a style.
          ...(ctx.dragStatus === "dragging" ? { "data-dragging": "" } : {}),
          ...((scope.props["allowMouseDrag"] as boolean) === true ? { "data-draggable": "" } : {}),
          "aria-live": playing ? "off" : "polite",
          tabindex: typeof document === "undefined"
            ? 0
            : (document.getElementById(scope.id("itemGroup"))?.querySelector(TABBABLE) ? -1 : 0),
          onFocusin: (): void => scope.send({ type: "VIEWPORT.FOCUS" }),
          onFocusout: (): void => scope.send({ type: "VIEWPORT.BLUR" }),
          onKeydown: (event: KeyboardEvent): void => onTrackKeydown(scope, event),
          onScrollend: (): void => scope.send({ type: "SCROLL.SETTLE", index: settlePage(scope) }),
          // The gesture: pointer capture plus scroll offset, reported out.
          ...((scope.props["allowMouseDrag"] as boolean) === true && horizontal
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
          // Layout change is the track resize: re-measure, re-position.
          "use:resize-observer": {
            onResize: (): void => {
              const ctx = asCtx(scope.context);
              if (ctx.dragStatus === "dragging") return;
              viewOf(scope.id).appliedKey = "";
              const d = derive(scope.props);
              syncView(
                scope.id,
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
        const ctx = asCtx(scope.context);
        return [`${ctx.loop || ctx.index > 0}`, scope.props["orientation"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const can = ctx.loop || ctx.index > 0;
        return {
          id: scope.id("prevTrigger"),
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
        const ctx = asCtx(scope.context);
        return [`${ctx.loop || ctx.index < lastPageOf(ctx)}`, scope.props["orientation"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const can = ctx.loop || ctx.index < lastPageOf(ctx);
        return {
          id: scope.id("nextTrigger"),
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
        "data-orientation": scope.props["orientation"],
        "data-state": scope.state === "autoplay" ? "playing" : "paused",
      }),
    },
    autoplayProgress: {
      id: "autoplay-progress",
      sig: (scope) => [scope.state, scope.props["orientation"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("autoplayProgress"),
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
      indexes: (_context, props) => slidesOf(props),
      sig: (scope) => {
        const item = scope.slot as unknown as { readonly index: number };
        return [`${slideInView(scope, item.index)}`, scope.props["orientation"], scope.props["slidesPerPage"], scope.props["autoSize"]].join(" ");
      },
      attrs: (scope, arg) => {
        const item = scope.slot as unknown as { readonly index: number };
        const snap = (arg as { readonly snapAlign?: string } | undefined)?.snapAlign ?? "start";
        const inView = slideInView(scope, item.index);
        return {
          id: scope.id("item", item.index),
          role: "group",
          "data-index": item.index,
          "data-orientation": scope.props["orientation"],
          "data-inview": inView ? "" : undefined,
          "data-snap": snap,
          ...((scope.props["autoSize"] as boolean) === true
            ? { "data-auto-size": "" }
            : { ...perPageAttrs(scope.props["slidesPerPage"] as number) }),
          "aria-roledescription": "slide",
          "aria-label": `${item.index + 1} of ${slidesOf(scope.props).length}`,
          "aria-hidden": !inView,
          // One observer per slide: the slide says whether it is on
          // screen, and the machine decides what that means.
          "use:intersect": {
            threshold: scope.props["inViewThreshold"],
            onVisibility: (visible: boolean): void => {
              scope.send({ type: "SLIDE.VIEW", index: item.index, inView: visible });
            },
          },
        };
      },
    },
    indicator: {
      indexes: (_context, props) => slidesOf(props).map((slide, index) => ({ ...slide, index })),
      sig: (scope) => {
        const item = scope.slot as unknown as { readonly index: number };
        return [`${item.index === asCtx(scope.context).index}`, scope.props["orientation"]].join(" ");
      },
      attrs: (scope, arg) => {
        const item = scope.slot as unknown as { readonly index: number; readonly label: string };
        const readOnly = (arg as { readonly readOnly?: boolean } | undefined)?.readOnly === true;
        const current = item.index === asCtx(scope.context).index;
        return {
          id: scope.id("indicator", item.index),
          type: "button",
          "data-index": item.index,
          "data-orientation": scope.props["orientation"],
          "data-current": current ? "" : undefined,
          "aria-current": current,
          "aria-label": `${item.index + 1} of ${slidesOf(scope.props).length} — ${item.label}`,
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
    goTo: { event: (args) => ({ type: "GO_TO", index: args[0] as number }) },
    setAutoplay: { event: (args) => ({ type: (args[0] as boolean) ? "AUTOPLAY.START" : "AUTOPLAY.STOP" }) },
    scrollToIndex: {
      event: (args, context) => ({
        type: "GO_TO",
        index: Math.floor((args[0] as number) / movesOf(context as unknown as Ctx)),
      }),
    },
    scrollTo: { event: (args) => ({ type: "GO_TO", index: args[0] as number }) },
    scrollNext: { event: () => ({ type: "NEXT" }) },
    scrollPrev: { event: () => ({ type: "PREV" }) },
    play: { event: () => ({ type: "AUTOPLAY.START" }) },
    pause: { event: () => ({ type: "AUTOPLAY.STOP" }) },
    refresh: {
      event: (_args, context) => {
        const ctx = context as unknown as Ctx;
        const params = (ctx as unknown as { slideParams?: { readonly perMove: number; readonly slidesPerPage: number; readonly autoSize: boolean; readonly slideCount: number } }).slideParams;
        return {
          type: "PAGES.SET",
          count: params === undefined
            ? ctx.pageCount
            : pageCountFor(params.slideCount, params.perMove, params.slidesPerPage, params.autoSize),
        };
      },
    },
  },
  readers: {
    index: { read: (context) => asCtx(context).index },
    pageCount: { read: (context) => asCtx(context).pageCount },
    slidesInView: { read: (context) => [...asCtx(context).slidesInView] },
    isPlaying: { read: (_context, state) => state === "autoplay" },
    isDragging: { read: (context) => asCtx(context).dragStatus === "dragging" },
    isSettling: { read: (context) => asCtx(context).dragStatus === "settling" },
    dragStatus: { read: (context) => asCtx(context).dragStatus },
    canScrollNext: {
      read: (context) => {
        const ctx = asCtx(context);
        return ctx.loop || ctx.index < lastPageOf(ctx);
      },
    },
    canScrollPrev: {
      read: (context) => {
        const ctx = asCtx(context);
        return ctx.loop || ctx.index > 0;
      },
    },
  },
  methods: {
    getProgress: {
      call: (context) => {
        const ctx = context as unknown as Ctx;
        return ctx.pageCount > 0 ? ctx.index / ctx.pageCount : 0;
      },
    },
    getProgressText: {
      call: (context) => {
        const ctx = context as unknown as Ctx;
        return `${ctx.index + 1} / ${ctx.pageCount}`;
      },
    },
    getProgressRows: {
      call: (context, _state, _args, _props, id) => {
        const ctx = context as unknown as Ctx;
        // The row's update re-reads the holder, which is why the holder is
        // a stable object rewritten here rather than a string the row
        // captured.
        const view = viewOf(id);
        view.readout.value = `${ctx.index + 1} / ${ctx.pageCount}`;
        machineTick();
        return [view.readout];
      },
    },
    isInView: {
      call: (context, _state, args, props) => {
        const ctx = context as unknown as Ctx;
        const index = args[0] as number;
        if (ctx.slidesInView.includes(index)) return true;
        const slides = slidesOf(props);
        const start = ctx.index * movesOf(ctx);
        const perMove = Math.max(1, Math.min((props["slidesPerPage"] as number) || 1, slides.length - start || 1));
        return index >= start && index < start + perMove;
      },
    },
  },
  events: {
    "index-change": {
      prop: "onIndexChange",
      watch: (context) => [asCtx(context).index, asCtx(context).pageCount],
      detail: (watched) => ({ index: watched[0] as number, pageCount: watched[1] as number }),
    },
    "drag-status-change": {
      prop: "onDragStatusChange",
      watch: (context) => [asCtx(context).dragStatus, asCtx(context).index],
      detail: (watched) => ({ status: watched[0] as CarouselDragStatus, index: watched[1] as number }),
    },
    "autoplay-status-change": {
      prop: "onAutoplayStatusChange",
      watch: (_context, state) => [state === "autoplay"],
      detail: (watched, _event, _props, context) => ({
        status: (watched[0] as boolean) ? "playing" : "stopped",
        index: (context as unknown as Ctx | undefined)?.index ?? 0,
      }),
    },
  },
};

export const carousel = defineComponent<CarouselContext, CarouselEvent, CarouselApi>(def);
