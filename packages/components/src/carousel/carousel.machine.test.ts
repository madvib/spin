import { assertEquals } from "@std/assert";
import {
  carousel as carouselMachine,
  type CarouselContext,
  type CarouselEvents,
} from "./carousel.machine.ts";
import { pageCountFor } from "./carousel.state.ts";
import { interpret, type Service } from "@spin/runtime/fsm";

/**
 * The carousel's machine, its assigns and its derived page count, through
 * the fork's public API.
 *
 * A service is built the way the bridge builds it: the factory, with the
 * arguments the host would set. The page count then arrives as the bridge
 * sends it — one `PAGES.SET` — and everything asserted after that is what
 * a host observes.
 */
function carousel(
  slideCount: number,
  loop = false,
): Service<CarouselContext, CarouselEvents> {
  const svc = interpret(carouselMachine({ loop }, () => true));
  svc.start("idle");
  svc.send({ type: "PAGES.SET", count: slideCount });
  return svc;
}

const contextOf = (
  svc: Service<CarouselContext, CarouselEvents>,
): CarouselContext => svc.state.context;

Deno.test("Given a five-slide carousel / When it starts / Then it is idle on page 0 of 5", () => {
  const svc = carousel(5);
  assertEquals(svc.state.value, "idle");
  assertEquals(contextOf(svc).index, 0);
  assertEquals(contextOf(svc).pageCount, 5);
  assertEquals(contextOf(svc).slidesInView, []);
  assertEquals(contextOf(svc).dragStatus, "idle");
});

Deno.test("Given the slide count / When it reaches a page for every step / Then the page count follows", () => {
  // Hand-worked from the page snap points: pages start every `perMove`
  // slides and stop before one would run past the end.
  assertEquals(pageCountFor(5, 1, 1, false), 5);
  assertEquals(pageCountFor(5, 2, 1, false), 3);
  assertEquals(pageCountFor(5, 2, 2, false), 2);
  assertEquals(pageCountFor(4, 2, 2, false), 2);
  assertEquals(pageCountFor(5, 3, 1, false), 2);
  assertEquals(pageCountFor(10, 5, 1, false), 2);
  assertEquals(pageCountFor(6, 3, 3, false), 2);
  assertEquals(pageCountFor(1, 1, 1, false), 1);
  assertEquals(pageCountFor(0, 1, 1, false), 0);
  // A step of zero is one, not a division by zero.
  assertEquals(pageCountFor(4, 0, 1, false), 4);
  // Variable-width slides are their own pages.
  assertEquals(pageCountFor(7, 1, 1, true), 7);
});

Deno.test("Given a carousel / When a slide reports in view / Then the slide is in view and the page holds", () => {
  const svc = carousel(5);
  svc.send({ type: "SLIDE.VIEW", index: 2, inView: true });
  assertEquals(contextOf(svc).index, 0);
  assertEquals(contextOf(svc).slidesInView, [2]);
  // A second report for the same slide is the fact restated.
  svc.send({ type: "SLIDE.VIEW", index: 2, inView: true });
  assertEquals(contextOf(svc).slidesInView, [2]);
});

Deno.test("Given a slide in view / When it reports out of view / Then it leaves and the page holds", () => {
  const svc = carousel(5);
  svc.send({ type: "SLIDE.VIEW", index: 3, inView: true });
  svc.send({ type: "SLIDE.VIEW", index: 3, inView: false });
  assertEquals(contextOf(svc).slidesInView, []);
  assertEquals(contextOf(svc).index, 0);
});

Deno.test("Given the platform's settle / Then the measured page is taken and clamped", () => {
  const svc = carousel(5);
  svc.send({ type: "SCROLL.SETTLE", index: 3 });
  assertEquals(contextOf(svc).index, 3);
  svc.send({ type: "SCROLL.SETTLE", index: 99 });
  assertEquals(contextOf(svc).index, 4);
  svc.send({ type: "SCROLL.SETTLE", index: -4 });
  assertEquals(contextOf(svc).index, 0);
});

Deno.test("Given a settled scroll / Then the drag status rests where focus is", () => {
  const focused = carousel(5);
  focused.send({ type: "VIEWPORT.FOCUS" });
  focused.send({ type: "DRAG.START" });
  focused.send({ type: "DRAG.END" });
  focused.send({ type: "SCROLL.SETTLE", index: 2 });
  assertEquals(contextOf(focused).dragStatus, "focus");
  assertEquals(contextOf(focused).index, 2);

  const unfocused = carousel(5);
  unfocused.send({ type: "DRAG.START" });
  unfocused.send({ type: "DRAG.END" });
  unfocused.send({ type: "SCROLL.SETTLE", index: 2 });
  assertEquals(contextOf(unfocused).dragStatus, "idle");
  assertEquals(contextOf(unfocused).index, 2);
});

Deno.test("Given a settling drag / When the next slide reports / Then the page follows the slide", () => {
  const svc = carousel(9);
  svc.state.context.perMove = 2;
  svc.send({ type: "DRAG.START" });
  svc.send({ type: "DRAG.END" });
  // No `scrollend` on this engine: the report of what is on screen is the
  // same fact, and only a gesture that ended may be paged by it.
  svc.send({ type: "SLIDE.VIEW", index: 5, inView: true });
  assertEquals(contextOf(svc).index, 2);
  assertEquals(contextOf(svc).dragStatus, "idle");
  assertEquals(contextOf(svc).slidesInView, [5]);
});

Deno.test("Given page 0 of 5 / When next fires three times / Then it walks to page 3", () => {
  const svc = carousel(5);
  svc.send({ type: "NEXT" });
  svc.send({ type: "NEXT" });
  svc.send({ type: "NEXT" });
  assertEquals(contextOf(svc).index, 3);
});

Deno.test("Given the last page / When next fires / Then it holds", () => {
  const svc = carousel(3);
  svc.send({ type: "GO_TO", index: 2 });
  svc.send({ type: "NEXT" });
  assertEquals(contextOf(svc).index, 2);
});

Deno.test("Given the first page / When prev fires / Then it holds", () => {
  const svc = carousel(4);
  svc.send({ type: "PREV" });
  assertEquals(contextOf(svc).index, 0);
});

Deno.test("Given a looping carousel / When next fires on the last page / Then it returns to the first", () => {
  const svc = carousel(3, true);
  svc.send({ type: "GO_TO", index: 2 });
  svc.send({ type: "NEXT" });
  assertEquals(contextOf(svc).index, 0);
});

Deno.test("Given a looping carousel / When prev fires on the first page / Then it jumps to the last", () => {
  const svc = carousel(3, true);
  svc.send({ type: "PREV" });
  assertEquals(contextOf(svc).index, 2);
});

Deno.test("Given any page / When goTo asks for one / Then it clamps into range", () => {
  const svc = carousel(5);
  svc.send({ type: "GO_TO", index: 3 });
  assertEquals(contextOf(svc).index, 3);
  svc.send({ type: "GO_TO", index: 99 });
  assertEquals(contextOf(svc).index, 4);
  svc.send({ type: "GO_TO", index: -7 });
  assertEquals(contextOf(svc).index, 0);
});

Deno.test("Given page 4 of 5 / When the slide count shrinks to 2 / Then the page clamps to 1", () => {
  const svc = carousel(5);
  svc.send({ type: "GO_TO", index: 4 });
  svc.send({ type: "PAGES.SET", count: 2 });
  assertEquals(contextOf(svc).index, 1);
  assertEquals(contextOf(svc).pageCount, 2);
});

Deno.test("Given an idle carousel / When autoplay starts / Then the machine autoplays", () => {
  const svc = carousel(5);
  svc.send({ type: "AUTOPLAY.START" });
  assertEquals(svc.state.value, "autoplay");
});

Deno.test("Given autoplay / When a tick arrives / Then the page advances and it stays autoplay", () => {
  const svc = carousel(5);
  svc.send({ type: "AUTOPLAY.START" });
  svc.send({ type: "AUTOPLAY.TICK" });
  svc.send({ type: "AUTOPLAY.TICK" });
  assertEquals(contextOf(svc).index, 2);
  assertEquals(svc.state.value, "autoplay");
});

Deno.test("Given autoplay on the last page / When a tick arrives / Then it holds and keeps playing", () => {
  const svc = carousel(3);
  svc.send({ type: "AUTOPLAY.START" });
  // A settled scroll is how a rotation reaches the last page: the platform
  // reports the page it measured, and nothing leaves the rotation.
  svc.send({ type: "SCROLL.SETTLE", index: 2 });
  assertEquals(contextOf(svc).index, 2);
  assertEquals(svc.state.value, "autoplay");
  svc.send({ type: "AUTOPLAY.TICK" });
  assertEquals(contextOf(svc).index, 2);
  assertEquals(svc.state.value, "autoplay");
});

Deno.test("Given autoplay / When a page is set / Then the rotation stops", () => {
  const svc = carousel(3);
  svc.send({ type: "AUTOPLAY.START" });
  svc.send({ type: "GO_TO", index: 1 });
  assertEquals(svc.state.value, "idle");
  assertEquals(contextOf(svc).index, 1);
});

Deno.test("Given an idle carousel / When a tick arrives / Then nothing moves", () => {
  const svc = carousel(5);
  svc.send({ type: "AUTOPLAY.TICK" });
  assertEquals(contextOf(svc).index, 0);
  assertEquals(svc.state.value, "idle");
});

Deno.test("Given autoplay / When the pointer presses / Then the rotation stops", () => {
  const svc = carousel(5);
  svc.send({ type: "AUTOPLAY.START" });
  svc.send({ type: "POINTER.DOWN" });
  assertEquals(svc.state.value, "idle");
});

Deno.test("Given a part takes the focus / Then the context names it", () => {
  const svc = carousel(5);
  svc.send({ type: "PART.FOCUS", id: "carousel-indicator-2" });
  assertEquals(contextOf(svc).focusedId, "carousel-indicator-2");
});

Deno.test("Given a part holds the focus / When it blurs / Then the focus is gone", () => {
  const svc = carousel(5);
  svc.send({ type: "PART.FOCUS", id: "carousel-indicator-2" });
  svc.send({ type: "PART.BLUR", id: "carousel-indicator-2" });
  assertEquals(contextOf(svc).focusedId, null);
});

Deno.test("Given a part holds the focus / When another part blurs / Then the focus stays", () => {
  const svc = carousel(5);
  svc.send({ type: "PART.FOCUS", id: "carousel-indicator-2" });
  svc.send({ type: "PART.BLUR", id: "carousel-prev-trigger" });
  assertEquals(contextOf(svc).focusedId, "carousel-indicator-2");
});

Deno.test("Given autoplay / When the viewport takes focus / Then the rotation stops", () => {
  const svc = carousel(5);
  svc.send({ type: "AUTOPLAY.START" });
  svc.send({ type: "VIEWPORT.FOCUS" });
  assertEquals(svc.state.value, "idle");
});

Deno.test("Given autoplay / When setAutoplay(false) is sent / Then the machine is idle", () => {
  const svc = carousel(5);
  svc.send({ type: "AUTOPLAY.START" });
  svc.send({ type: "AUTOPLAY.STOP" });
  assertEquals(svc.state.value, "idle");
});

Deno.test("Given the viewport focused / Then the drag status is focus", () => {
  const svc = carousel(5);
  svc.send({ type: "VIEWPORT.FOCUS" });
  assertEquals(contextOf(svc).focused, true);
  assertEquals(contextOf(svc).dragStatus, "focus");
});

Deno.test("Given the viewport focused / When it blurs / Then the drag status returns to idle", () => {
  const svc = carousel(5);
  svc.send({ type: "VIEWPORT.FOCUS" });
  svc.send({ type: "VIEWPORT.BLUR" });
  assertEquals(contextOf(svc).focused, false);
  assertEquals(contextOf(svc).dragStatus, "idle");
});

Deno.test("Given a drag / Then the drag status is dragging", () => {
  const svc = carousel(5);
  svc.send({ type: "DRAG.START" });
  assertEquals(contextOf(svc).dragStatus, "dragging");
  assertEquals(svc.state.value, "idle");
});

Deno.test("Given autoplay / When a drag starts / Then the rotation stops and the drag is dragging", () => {
  const svc = carousel(5);
  svc.send({ type: "AUTOPLAY.START" });
  svc.send({ type: "DRAG.START" });
  assertEquals(svc.state.value, "idle");
  assertEquals(contextOf(svc).dragStatus, "dragging");
});

Deno.test("Given a drag in progress / When the pointer lifts / Then the drag status is settling", () => {
  const svc = carousel(5);
  svc.send({ type: "DRAG.START" });
  svc.send({ type: "DRAG.END" });
  assertEquals(contextOf(svc).dragStatus, "settling");
});

Deno.test("Given a carousel at rest / When the scroll settles / Then nothing moves", () => {
  const svc = carousel(5);
  svc.send({ type: "DRAG.START" });
  svc.send({ type: "DRAG.END" });
  svc.send({ type: "SCROLL.SETTLE", index: 2 });
  const after = { ...contextOf(svc) };
  svc.send({ type: "SCROLL.SETTLE", index: 2 });
  assertEquals(contextOf(svc), after);
});

Deno.test("Given a drag / When the viewport blurs / Then the drag status is untouched", () => {
  const svc = carousel(5);
  svc.send({ type: "DRAG.START" });
  svc.send({ type: "VIEWPORT.FOCUS" });
  svc.send({ type: "VIEWPORT.BLUR" });
  assertEquals(contextOf(svc).dragStatus, "dragging");
  assertEquals(contextOf(svc).focused, false);
});
