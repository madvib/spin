import { createMachine, type Machine } from "@spinjs/components/fsm";
import type {
  CarouselArgs,
  CarouselContext,
  CarouselState,
} from "./carousel.state.ts";
import { initial } from "./carousel.state.ts";
import type { CarouselEvents } from "./carousel.events.ts";
import {
  advance,
  autoplayStart,
  autoplayStop,
  dragEnd,
  dragStart,
  goTo,
  pagesSet,
  partBlur,
  partFocus,
  previous,
  scrollSettle,
  slideView,
  viewportBlur,
  viewportFocus,
} from "./carousel.transitions.ts";

export function carousel(
  args: CarouselArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<CarouselContext, CarouselEvents, CarouselState> {
  return createMachine<CarouselContext, CarouselEvents, CarouselState>({
    id: "carousel",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      index: { event: "GO_TO" },
      loop: {},
      orientation: {},
      allowMouseDrag: {},
      autoplayDelay: {},
      dir: {},
      inViewThreshold: {},
      autoSize: {},
      slidesPerPage: {},
    },
    on: {
      "NEXT": { target: "idle", assign: advance },
      "PREV": { target: "idle", assign: previous },
      "GO_TO": { target: "idle", assign: goTo },
      "PAGES.SET": { assign: pagesSet },
      "SLIDE.VIEW": { assign: slideView },
      "DRAG.START": { target: "idle", assign: dragStart },
      "DRAG.END": { assign: dragEnd },
      "SCROLL.SETTLE": { assign: scrollSettle },
      "POINTER.DOWN": { target: "idle" },
      "VIEWPORT.FOCUS": { target: "idle", assign: viewportFocus },
      "VIEWPORT.BLUR": { assign: viewportBlur },
      "PART.FOCUS": { assign: partFocus },
      "PART.BLUR": { assign: partBlur },
      "AUTOPLAY.START": { target: "autoplay", assign: autoplayStart },
      "AUTOPLAY.STOP": { target: "idle", assign: autoplayStop },
    },
    states: {
      idle: {},
      autoplay: {
        on: {
          "AUTOPLAY.TICK": { target: "autoplay", assign: advance },
        },
      },
    },
  });
}

export type { CarouselArgs, CarouselContext } from "./carousel.state.ts";
export type { CarouselEvents } from "./carousel.events.ts";
