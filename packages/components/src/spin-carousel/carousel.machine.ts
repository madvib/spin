/**
 * Carousel machine: the page index and the mode it is in, and nothing else.
 *
 * Every reflex is a stdlib action attached to the markup (`use:drag-scroll`,
 * `use:autoplay`, `use:intersect`, `use:resize-observer`), not machine
 * logic. Dragging is deliberately NOT a state: it is `dragStatus` in
 * context, moved by the action's reports, and the settle is completed by
 * the platform's own `scrollend` rather than by a timer the machine owns.
 */

import { defaultTwin, isRecord } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const next = (ctx: CarouselContext) : Partial<CarouselContext> => { return ({
      index: ctx.loop
        ? (ctx.index + 1) % cycle(ctx.pageCount)
        : Math.min(ctx.index + 1, lastPage(ctx.pageCount)),
    }); };



/** One slide: the record the host wrote. */
export interface CarouselSlide {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

/** The slide collection: the well-shaped entries only. */
export const slidesOf = (raw: unknown): readonly CarouselSlide[] => {
  if (!Array.isArray(raw)) return [];
  const slides: CarouselSlide[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const value: unknown = entry["value"];
    if (typeof value !== "string") continue;
    const label: unknown = entry["label"];
    const content: unknown = entry["content"];
    slides.push({
      value,
      label: typeof label === "string" ? label : "",
      content: typeof content === "string" ? content : "",
    });
  }
  return slides;
};

/** The event detail of `index-change`: the `onPageChange` payload. */
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
  /** The upstream calls it `page`; the element says `index`. */
  index: number;
  pageCount: number;
  slidesInView: number[];
  focused: boolean;
  dragStatus: CarouselDragStatus;
  loop: boolean;
  perMove: number;
  /** The slide params the page count derives from: commands never see props. */
  slideParams: {
    readonly perMove: number;
    readonly slidesPerPage: number;
    readonly autoSize: boolean;
    readonly slideCount: number;
  };
}

export interface CarouselEvents {
  "NEXT": {};
  "PREV": {};
  "GO_TO": { index: number };
  "PAGES.SET": { count: number };
  "SLIDE.VIEW": { index: number; inView: boolean };
  "DRAG.START": {};
  "DRAG.END": {};
  "SCROLL.SETTLE": { index: number };
  "POINTER.DOWN": {};
  "VIEWPORT.FOCUS": {};
  "VIEWPORT.BLUR": {};
  "AUTOPLAY.START": {};
  "AUTOPLAY.STOP": {};
  "AUTOPLAY.TICK": {};
}

export type CarouselEvent = EventUnion<CarouselEvents>;


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

const config: Omit<MachineSpec<CarouselContext, CarouselEvents>, "context"> = {
  id: "carousel",
  initial: "idle",
  // Root tier: the programmatic commands and the reflexes that answer in
  // every state. `AUTOPLAY.TICK` is the one event this does NOT carry —
  // an interval that fires while stopped is a bug, not a fallback.
  on: {
    "NEXT": { target: "idle", assign: next },
    "PREV": { target: "idle", assign: (ctx) => { return ({
      index: ctx.loop
        ? (ctx.index - 1 + cycle(ctx.pageCount)) % cycle(ctx.pageCount)
        : Math.max(0, ctx.index - 1),
    }); } },
    "GO_TO": { target: "idle", assign: (ctx, e) => {
      if (e.type !== "GO_TO") return {};
      if (typeof e.index !== "number" || !Number.isFinite(e.index)) return {};
      return { index: clampIndex(e.index, ctx.pageCount) };
    } },
    "PAGES.SET": { assign: (ctx, e) => {
      if (e.type !== "PAGES.SET") return {};
      const pageCount = Math.max(0, Math.trunc(e.count));
      return { pageCount, index: clampIndex(ctx.index, pageCount) };
    } },
    "SLIDE.VIEW": { assign: (ctx, e) => {
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
    } },
    "DRAG.START": { target: "idle", assign: () => { return ({ dragStatus: "dragging" }); } },
    "DRAG.END": { assign: () => { return ({ dragStatus: "settling" }); } },
    "SCROLL.SETTLE": { assign: (ctx, e) => { return e.type === "SCROLL.SETTLE"
        ? {
          index: clampIndex(e.index, ctx.pageCount),
          ...(ctx.dragStatus === "settling" ? { dragStatus: rest(ctx) } : {}),
        }
        : {}; } },
    // A press inside the carousel stops the rotation: every PAGE.* event
    // targets `idle`.
    "POINTER.DOWN": { target: "idle" },
    "VIEWPORT.FOCUS": {
      target: "idle",
      assign: (ctx) => { return ({
      focused: true,
      ...(midGesture(ctx.dragStatus) ? {} : { dragStatus: "focus" }),
    }); },
    },
    "VIEWPORT.BLUR": { assign: (ctx) => { return ({
      focused: false,
      ...(midGesture(ctx.dragStatus) ? {} : { dragStatus: "idle" }),
    }); } },
    "AUTOPLAY.START": { target: "autoplay" },
    "AUTOPLAY.STOP": { target: "idle" },
  },
  states: {
    idle: {},
    autoplay: {
      on: {
        "AUTOPLAY.TICK": { target: "autoplay", assign: next },
      },
    },
  },
};

/**
 * Pure transforms. `next` is shared by the trigger, the keyboard and the
 * autoplay tick: advancing a page is advancing a page.
 */
const implementations = {};

const asInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;

export const slidesPerPageOf = (raw: unknown): number => Math.max(1, asInt(raw, 1));

/** How many slides a page advances: the host's number, or one page of
 * slides. The prop is text ("auto", or a count), so it parses. */
export const slidesPerMoveOf = (raw: unknown, perPage: number): number => {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : perPage;
};

/**
 * The carousel's arguments: the values the host may set.
 */
export interface CarouselArgs {
  index?: number;
  loop?: boolean;
  items?: readonly unknown[];
  slidesPerPage?: number;
  slidesPerMove?: string;
  autoSize?: boolean;
  defaultLoop?: boolean;
}

/**
 * The machine's context: the page it is on, the pages there are, and
 * the mode it is in. The page count is the machine's own derivation: the
 * slides it holds, the step, and the page size.
 */
export function initial(args: CarouselArgs, authored: (name: string) => boolean): CarouselContext {
  // A twin counts as written: a host that wrote `defaultIndex` wrote the
  // channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const slidesPerPage = slidesPerPageOf(args.slidesPerPage);
  const perMove = slidesPerMoveOf(args.slidesPerMove, slidesPerPage);
  const autoSize = args.autoSize === true;
  const slideCount = slidesOf(args.items).length;
  const pageCount = pageCountFor(slideCount, perMove, slidesPerPage, autoSize);
  const last = Math.max(0, pageCount - 1);
  const at = written("index") ? asInt(args.index, 0) : 0;
  return {
    index: Math.min(Math.max(0, at), last),
    pageCount,
    slidesInView: [],
    focused: false,
    dragStatus: "idle",
    loop: written("loop") ? args.loop === true : false,
    perMove,
    slideParams: { perMove, slidesPerPage, autoSize, slideCount },
  };
}

/** The page snap points, read as slide indices. */
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

export function carousel(
  args: CarouselArgs = {},
  authored: (name: string) => boolean,
): Machine<CarouselContext, CarouselEvents> {
  return createMachine<CarouselContext, CarouselEvents>({
    ...config,
    context: initial(args, authored),
    fields: {
      index: { event: "GO_TO" },
      loop: {},
    },
  });
}
