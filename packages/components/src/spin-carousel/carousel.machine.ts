/**
 * Carousel machine: the page index and the mode it is in, and nothing else.
 *
 * Zag's carousel spends ten track/watch effects on slide mutation, slide
 * intersections, resize, keyboard scroll, pointer move, scroll-end timers
 * and the autoplay interval. Every one of those is a REFLEX, and every
 * reflex here is a stdlib action attached through the connect's bag:
 * `use:drag-scroll` owns the pointer and reports DRAG.START / DRAG.END,
 * `use:autoplay` owns the clock and reports AUTOPLAY.TICK, `use:intersect`
 * owns the observer and reports SLIDE.VIEW, `use:resize-observer` reports
 * layout change. What survives in this file is a flat chart with exactly
 * two states — `idle` and `autoplay` — plus pure assigns.
 *
 * Dragging is deliberately NOT a state. It is `dragStatus` in context,
 * moved by the action's reports, and the settle is completed by the
 * platform's own `scrollend` (or by the next intersection report) rather
 * than by a 200ms timer the machine would own.
 */

/** The event detail of `index-change`: Zag's `onPageChange`, faithful. */
export interface CarouselIndexChange {
  readonly index: number;
  readonly pageCount: number;
}

/** The observable state of a slide, from the intersection action. */
export interface CarouselSlideView {
  readonly index: number;
  readonly inView: boolean;
}

export type CarouselDragStatus = "idle" | "focus" | "dragging" | "settling";

export interface CarouselDragStatusChange {
  readonly status: CarouselDragStatus;
  readonly index: number;
}

export interface CarouselAutoplayStatusChange {
  readonly status: "playing" | "stopped";
  readonly index: number;
}

export interface CarouselContext {
  /** The page on screen. Zag calls it `page`; the element says `index`. */
  index: number;
  /** How many pages there are, derived from the slide props by the bridge. */
  pageCount: number;
  /** Slide indices currently intersecting, reported by `use:intersect`. */
  slidesInView: number[];
  /** Whether focus is inside the carousel, for the rest value of dragStatus. */
  focused: boolean;
  /** Drag modality. Not a state: it is moved by the action's reports. */
  dragStatus: CarouselDragStatus;
  /** Props the assigns read, synced from scope by the bridge. */
  loop: boolean;
  /** Slides advanced per page, so a slide index maps to its page. */
  perMove: number;
}

export type CarouselEvent =
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "GO_TO"; index: number }
  | { type: "PAGES.SET"; count: number }
  | { type: "SLIDE.VIEW"; index: number; inView: boolean }
  | { type: "DRAG.START" }
  | { type: "DRAG.END" }
  /**
   * The platform's own settle notification, carrying the page the view
   * MEASURED. The view owns the measurement because the machine must never
   * walk the DOM; the intersection report is the engine-independent
   * fallback, which is why it may only move the page mid-gesture.
   */
  | { type: "SCROLL.SETTLE"; index: number }
  | { type: "POINTER.DOWN" }
  | { type: "VIEWPORT.FOCUS" }
  | { type: "VIEWPORT.BLUR" }
  | { type: "AUTOPLAY.START" }
  | { type: "AUTOPLAY.STOP" }
  | { type: "AUTOPLAY.TICK" };

const lastPage = (pageCount: number): number => Math.max(0, pageCount - 1);
const cycle = (pageCount: number): number => Math.max(1, pageCount);
const clampIndex = (index: number, pageCount: number): number => {
  const last = lastPage(pageCount);
  return index < 0 ? 0 : index > last ? last : Math.trunc(index);
};
const movesPer = (ctx: CarouselContext): number =>
  Math.max(1, Math.trunc(ctx.perMove));
const pageOf = (ctx: CarouselContext, slide: number): number =>
  clampIndex(Math.floor(slide / movesPer(ctx)), ctx.pageCount);
const rest = (ctx: CarouselContext): CarouselDragStatus =>
  ctx.focused ? "focus" : "idle";
const midGesture = (status: CarouselDragStatus): boolean =>
  status === "dragging" || status === "settling";

export const config = {
  id: "carousel",
  initial: "idle",
  context: {
    index: 0,
    pageCount: 0,
    slidesInView: [] as number[],
    focused: false,
    dragStatus: "idle" as CarouselDragStatus,
    loop: false,
    perMove: 1,
  },
  // Root tier: the programmatic commands and the reflexes that answer in
  // every state. `AUTOPLAY.TICK` is the one event this does NOT carry —
  // an interval that fires while stopped is a bug, not a fallback.
  on: {
    "NEXT": { target: "idle", actions: [{ assign: "next" }] },
    "PREV": { target: "idle", actions: [{ assign: "prev" }] },
    "GO_TO": { target: "idle", actions: [{ assign: "goTo" }] },
    "PAGES.SET": { actions: [{ assign: "setPageCount" }] },
    "SLIDE.VIEW": { actions: [{ assign: "slideView" }] },
    "DRAG.START": { target: "idle", actions: [{ assign: "dragStart" }] },
    "DRAG.END": { actions: [{ assign: "dragEnd" }] },
    "SCROLL.SETTLE": { actions: [{ assign: "settle" }] },
    // A press inside the carousel stops the rotation, as Zag's own trigger
    // events do: every PAGE.* event there targets `idle`.
    "POINTER.DOWN": { target: "idle" },
    "VIEWPORT.FOCUS": {
      target: "idle",
      actions: [{ assign: "viewportFocus" }],
    },
    "VIEWPORT.BLUR": { actions: [{ assign: "viewportBlur" }] },
    "AUTOPLAY.START": { target: "autoplay" },
    "AUTOPLAY.STOP": { target: "idle" },
  },
  states: {
    idle: {},
    autoplay: {
      on: {
        "AUTOPLAY.TICK": { target: "autoplay", actions: [{ assign: "next" }] },
      },
    },
  },
};

/**
 * Pure transforms. `next` is shared by the trigger, the keyboard and the
 * autoplay tick because advancing a page is advancing a page — an assign
 * that has to know WHICH event fired it is a transition that was not split
 * far enough.
 */
export const implementations = {
  assigns: {
    next: (ctx: CarouselContext): Partial<CarouselContext> => ({
      index: ctx.loop
        ? (ctx.index + 1) % cycle(ctx.pageCount)
        : Math.min(ctx.index + 1, lastPage(ctx.pageCount)),
    }),
    prev: (ctx: CarouselContext): Partial<CarouselContext> => ({
      index: ctx.loop
        ? (ctx.index - 1 + cycle(ctx.pageCount)) % cycle(ctx.pageCount)
        : Math.max(0, ctx.index - 1),
    }),
    goTo: (ctx: CarouselContext, e: CarouselEvent): Partial<CarouselContext> =>
      e.type === "GO_TO" ? { index: clampIndex(e.index, ctx.pageCount) } : {},
    setPageCount: (
      ctx: CarouselContext,
      e: CarouselEvent,
    ): Partial<CarouselContext> => {
      if (e.type !== "PAGES.SET") return {};
      const pageCount = Math.max(0, Math.trunc(e.count));
      return { pageCount, index: clampIndex(ctx.index, pageCount) };
    },
    slideView: (
      ctx: CarouselContext,
      e: CarouselEvent,
    ): Partial<CarouselContext> => {
      if (e.type !== "SLIDE.VIEW") return {};
      const inView = e.inView === true;
      const slides = inView
        ? ctx.slidesInView.includes(e.index)
          ? ctx.slidesInView
          : [...ctx.slidesInView, e.index].sort((a, b) => a - b)
        : ctx.slidesInView.filter((slide) => slide !== e.index);
      // Only a gesture that has ended may be paged by what is on screen. A
      // report during a programmatic scroll describes a slide the carousel
      // is passing THROUGH, and paging to it would aim the scroll back at
      // the waypoint — the two loops each other.
      if (!inView || ctx.dragStatus !== "settling") {
        return { slidesInView: slides };
      }
      return {
        slidesInView: slides,
        index: pageOf(ctx, e.index),
        dragStatus: rest(ctx),
      };
    },
    dragStart: (): Partial<CarouselContext> => ({ dragStatus: "dragging" }),
    dragEnd: (): Partial<CarouselContext> => ({ dragStatus: "settling" }),
    // The platform says the scroll stopped, and names the page it measured.
    settle: (
      ctx: CarouselContext,
      e: CarouselEvent,
    ): Partial<CarouselContext> =>
      e.type === "SCROLL.SETTLE"
        ? {
          index: clampIndex(e.index, ctx.pageCount),
          ...(ctx.dragStatus === "settling" ? { dragStatus: rest(ctx) } : {}),
        }
        : {},
    viewportFocus: (ctx: CarouselContext): Partial<CarouselContext> => ({
      focused: true,
      ...(midGesture(ctx.dragStatus) ? {} : { dragStatus: "focus" }),
    }),
    viewportBlur: (ctx: CarouselContext): Partial<CarouselContext> => ({
      focused: false,
      ...(midGesture(ctx.dragStatus) ? {} : { dragStatus: "idle" }),
    }),
  },
};

/** Zag's page snap points, read as slide indices: what the machine derives. */
export function pageCountFor(
  slideCount: number,
  perMove: number,
  slidesPerPage: number,
  autoSize: boolean,
): number {
  const total = Math.max(0, Math.trunc(slideCount));
  if (autoSize) return total;
  const step = Math.max(1, Math.trunc(perMove));
  const per = Math.max(1, Math.trunc(slidesPerPage));
  let count = 0;
  for (let i = 0; i < total; i += step) {
    if (i + per > total) break;
    count += 1;
  }
  return count;
}
