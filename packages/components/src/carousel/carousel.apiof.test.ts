import { assertEquals } from "@std/assert";
import type { CarouselApi } from "./carousel.presentation.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
Deno.test("CarouselApi promises the component's surface", () => {
  const keys: (keyof CarouselApi)[] = [
    "state",
    "slides",
    "index",
    "pageCount",
    "slidesInView",
    "isPlaying",
    "isDragging",
    "isSettling",
    "dragStatus",
    "canScrollNext",
    "canScrollPrev",
    "getProgress",
    "getProgressText",
    "getProgressRows",
    "isInView",
    "refresh",
    "scrollToIndex",
    "scrollTo",
    "scrollNext",
    "scrollPrev",
    "play",
    "pause",
    "next",
    "prev",
    "goTo",
    "setAutoplay",
    "getRootProps",
    "getControlProps",
    "getItemGroupProps",
    "getItemProps",
    "getPrevTriggerProps",
    "getNextTriggerProps",
    "getAutoplayTriggerProps",
    "getIndicatorGroupProps",
    "getIndicatorProps",
    "getProgressTextProps",
    "getAutoplayProgressProps",
    "getAutoplayProgressFillProps",
    "getItemIndexes",
    "getIndicatorIndexes",
  ];
  assertEquals(keys.length, 40);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const stateTyped: AssertExact<CarouselApi["state"], "idle" | "autoplay"> = true;
  const goToTyped: AssertExact<CarouselApi["goTo"], (index: number) => void> = true;
  const isInViewTyped: AssertExact<CarouselApi["isInView"], (index: number) => boolean> = true;
  assertEquals(
    [
      stateTyped,
      goToTyped,
      isInViewTyped,
    ].every(Boolean),
    true,
  );
});
