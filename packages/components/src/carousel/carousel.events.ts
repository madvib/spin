import type { EventUnion } from "@spinjs/runtime/fsm";

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
  "PART.FOCUS": { id: string };
  "PART.BLUR": { id: string };
  "AUTOPLAY.START": {};
  "AUTOPLAY.STOP": {};
  "AUTOPLAY.TICK": {};
}

export type CarouselEvent = EventUnion<CarouselEvents>;

export interface CarouselIndexChange {
  readonly index: number;
  readonly pageCount: number;
}

export interface CarouselSlideView {
  readonly index: number;
  readonly inView: boolean;
}

export interface CarouselDragStatusChange {
  readonly status: "idle" | "focus" | "dragging" | "settling";
  readonly index: number;
}

export interface CarouselAutoplayStatusChange {
  readonly status: "playing" | "stopped";
  readonly index: number;
}
