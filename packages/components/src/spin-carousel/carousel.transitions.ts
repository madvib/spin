import type { AssignFor } from "@spin/runtime/fsm";
import type { CarouselEvents } from "./carousel.events.ts";
import type { CarouselContext } from "./carousel.state.ts";
import {
  clampIndex,
  cycleCount,
  lastPageOf,
  midGesture,
  pageOf,
  restStatus,
} from "./carousel.state.ts";

type CarouselAssign<K extends keyof CarouselEvents = keyof CarouselEvents> = AssignFor<
  CarouselContext,
  CarouselEvents,
  K
>;

const next = (ctx: CarouselContext): Partial<CarouselContext> => ({
  index: ctx.loop
    ? (ctx.index + 1) % cycleCount(ctx.pageCount)
    : Math.min(ctx.index + 1, lastPageOf(ctx.pageCount)),
});

export const advance: CarouselAssign<"NEXT" | "AUTOPLAY.TICK"> = (ctx) => next(ctx);

export const previous: CarouselAssign<"PREV"> = (ctx) => ({
  index: ctx.loop
    ? (ctx.index - 1 + cycleCount(ctx.pageCount)) % cycleCount(ctx.pageCount)
    : Math.max(0, ctx.index - 1),
});

export const goTo: CarouselAssign<"GO_TO"> = (ctx, e) => {
  if (e.type !== "GO_TO") return {};
  if (typeof e.index !== "number" || !Number.isFinite(e.index)) return {};
  return { index: clampIndex(e.index, ctx.pageCount) };
};

export const pagesSet: CarouselAssign<"PAGES.SET"> = (ctx, e) => {
  if (e.type !== "PAGES.SET") return {};
  const pageCount = Math.max(0, Math.trunc(e.count));
  return { pageCount, index: clampIndex(ctx.index, pageCount) };
};

export const slideView: CarouselAssign<"SLIDE.VIEW"> = (ctx, e) => {
  if (e.type !== "SLIDE.VIEW") return {};
  const inView = e.inView === true;
  const slides = inView
    ? ctx.slidesInView.includes(e.index)
      ? ctx.slidesInView
      : [...ctx.slidesInView, e.index].sort((a, b) => a - b)
    : ctx.slidesInView.filter((slide) => slide !== e.index);
  if (!inView || ctx.dragStatus !== "settling") {
    return { slidesInView: slides };
  }
  return {
    slidesInView: slides,
    index: pageOf(ctx, e.index),
    dragStatus: restStatus(ctx),
  };
};

export const dragStart: CarouselAssign<"DRAG.START"> = () => ({ dragStatus: "dragging" });

export const dragEnd: CarouselAssign<"DRAG.END"> = () => ({ dragStatus: "settling" });

export const scrollSettle: CarouselAssign<"SCROLL.SETTLE"> = (ctx, e) => {
  if (e.type !== "SCROLL.SETTLE") return {};
  return {
    index: clampIndex(e.index, ctx.pageCount),
    ...(ctx.dragStatus === "settling" ? { dragStatus: restStatus(ctx) } : {}),
  };
};

export const viewportFocus: CarouselAssign<"VIEWPORT.FOCUS"> = (ctx) => ({
  focused: true,
  ...(midGesture(ctx.dragStatus) ? {} : { dragStatus: "focus" }),
});

export const viewportBlur: CarouselAssign<"VIEWPORT.BLUR"> = (ctx) => ({
  focused: false,
  ...(midGesture(ctx.dragStatus) ? {} : { dragStatus: "idle" }),
});

export const partFocus: CarouselAssign<"PART.FOCUS"> = (_ctx, e) => ({
  focusedId: e.id,
});

export const partBlur: CarouselAssign<"PART.BLUR"> = (ctx, e) =>
  ctx.focusedId === e.id ? { focusedId: null } : {};

export const autoplayStart: CarouselAssign<"AUTOPLAY.START"> = () => ({});

export const autoplayStop: CarouselAssign<"AUTOPLAY.STOP"> = () => ({});
