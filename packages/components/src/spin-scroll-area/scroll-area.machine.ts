/**
 * Scroll-area machine: the scrollbars' visibility, the fade dwell, the
 * hover/press state, and the drag.
 *
 * Zag ships two states. `idle` and `dragging` both survive, and every other
 * fact the connect reads — thumb and corner size, which bars are hidden,
 * which sides the viewport rests on, whether the pointer is over the root,
 * whether an axis is scrolling — is context the VIEW measures and reports as
 * an event payload, because all of it is a statement about layout and the
 * machine never touches the DOM. This is the port whose state is derived
 * from layout rather than authored by a host, so the machine's job is to hold
 * those readings and decide what a new one means (a moved axis is scrolling,
 * an axis that no longer overflows has no bar).
 *
 * What is NOT here: the measurement (the connect reads the boxes), the timers
 * (a dwell is an action on the view), the drag gesture (document-scoped
 * listeners in the connect), and the wheel.
 */

export type Orientation = "vertical" | "horizontal";

export type ScrollSides = {
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
};

export type Size = {
  readonly width: number;
  readonly height: number;
};

export type HiddenState = {
  readonly scrollbarYHidden: boolean;
  readonly scrollbarXHidden: boolean;
  readonly cornerHidden: boolean;
};

/** One layout reading: the sizes, the hidden bars, and the sides. */
export type Measurement = {
  readonly thumbSize: Size;
  readonly cornerSize: Size;
  readonly hiddenState: HiddenState;
  readonly atSides: ScrollSides;
};

export type Point = {
  readonly x: number;
  readonly y: number;
};

export interface ScrollAreaContext {
  /** The measured thumb box — the geometry channel publishes it. */
  thumbSize: Size;
  cornerSize: Size;
  hiddenState: HiddenState;
  atSides: ScrollSides;
  hovering: boolean;
  scrollingX: boolean;
  scrollingY: boolean;
  /** The last measured viewport scroll: what the next reading moves from. */
  scrollPosition: Point;
}

export type ScrollAreaEvent =
  /** A resize or the viewport becoming visible re-measures. */
  | ({ type: "THUMB.MEASURE" } & Measurement)
  /** A scroll reports the new reading plus where the viewport now sits. */
  | ({ type: "VIEWPORT.SCROLL"; position: Point } & Measurement)
  | { type: "ROOT.POINTER_ENTER" }
  | { type: "ROOT.POINTER_LEAVE" }
  | { type: "SCROLLBAR.POINTER_DOWN"; orientation: Orientation }
  | { type: "THUMB.POINTER_DOWN"; orientation: Orientation; point: Point }
  | { type: "THUMB.POINTER_MOVE"; orientation: Orientation; point: Point }
  | { type: "SCROLLBAR.POINTER_UP" }
  | { type: "THUMB.POINTER_UP"; orientation: Orientation }
  /** The view's dwell elapsed for one axis. */
  | { type: "SCROLL.SETTLE"; orientation: Orientation };

/** A bar with nothing to scroll is not there at all. */
const NO_BARS: HiddenState = {
  scrollbarYHidden: true,
  scrollbarXHidden: true,
  cornerHidden: true,
};

export const config = {
  id: "scroll-area",
  initial: "idle",
  context: {
    thumbSize: { width: 0, height: 0 },
    cornerSize: { width: 0, height: 0 },
    // Unmeasured is hidden: nothing is known to overflow yet, so no bar is
    // painted before the first measurement lands.
    hiddenState: NO_BARS,
    atSides: { top: true, right: false, bottom: false, left: true },
    hovering: false,
    scrollingX: false,
    scrollingY: false,
    scrollPosition: { x: 0, y: 0 },
  },
  // The root tier: a measurement, a scroll, and the pointer over the root
  // are all valid while dragging, which is Zag's single-state semantics for
  // everything but the drag's own entry and exit.
  on: {
    "THUMB.MEASURE": { actions: [{ assign: "measure" }] },
    "VIEWPORT.SCROLL": { actions: [{ assign: "measure" }, { assign: "setScrolling" }] },
    "ROOT.POINTER_ENTER": { actions: [{ assign: "setHovering" }] },
    "ROOT.POINTER_LEAVE": { actions: [{ assign: "clearHovering" }] },
    "SCROLL.SETTLE": { actions: [{ assign: "clearScrolling" }] },
  },
  states: {
    idle: {
      on: {
        "SCROLLBAR.POINTER_DOWN": { target: "dragging" },
        "THUMB.POINTER_DOWN": { target: "dragging" },
      },
    },
    dragging: {
      on: {
        // A drag moves the viewport, so the axis it drags is scrolling.
        "THUMB.POINTER_MOVE": { actions: [{ assign: "markScrolling" }] },
        "SCROLLBAR.POINTER_UP": { target: "idle" },
        "THUMB.POINTER_UP": { target: "idle", actions: [{ assign: "clearScrolling" }] },
      },
    },
  },
};

/** The events that carry a layout reading. */
const measured = (event: ScrollAreaEvent): Measurement | null =>
  event.type === "THUMB.MEASURE" || event.type === "VIEWPORT.SCROLL" ? event : null;

/** Axis-wise flags for the events that name one. */
const axisOf = (event: ScrollAreaEvent): Orientation | null =>
  event.type === "THUMB.POINTER_MOVE" || event.type === "THUMB.POINTER_UP" || event.type === "SCROLL.SETTLE"
    ? event.orientation
    : null;

export const implementations = {
  assigns: {
    measure: (_ctx: ScrollAreaContext, event: ScrollAreaEvent): Partial<ScrollAreaContext> => {
      const next = measured(event);
      if (next === null) return {};
      return {
        thumbSize: next.thumbSize,
        cornerSize: next.cornerSize,
        hiddenState: next.hiddenState,
        atSides: next.atSides,
      };
    },
    /**
     * Zag's `setScrolling`: an axis that moved starts scrolling, and the
     * previous position becomes the new reference. An axis that did NOT move
     * is left alone — only the dwell clears it.
     */
    setScrolling: (ctx: ScrollAreaContext, event: ScrollAreaEvent): Partial<ScrollAreaContext> => {
      if (event.type !== "VIEWPORT.SCROLL") return {};
      const position = event.position;
      return {
        scrollPosition: { x: position.x, y: position.y },
        ...(position.x !== ctx.scrollPosition.x ? { scrollingX: true } : {}),
        ...(position.y !== ctx.scrollPosition.y ? { scrollingY: true } : {}),
      };
    },
    /** A drag's own motion, reported without a position to compare. */
    markScrolling: (_ctx: ScrollAreaContext, event: ScrollAreaEvent): Partial<ScrollAreaContext> => {
      const axis = axisOf(event);
      if (event.type !== "THUMB.POINTER_MOVE" || axis === null) return {};
      return axis === "vertical" ? { scrollingY: true } : { scrollingX: true };
    },
    /** The dwell elapsed, or the drag ended: the axis stops scrolling. */
    clearScrolling: (_ctx: ScrollAreaContext, event: ScrollAreaEvent): Partial<ScrollAreaContext> => {
      const axis = axisOf(event);
      if (axis === null) return {};
      return axis === "vertical" ? { scrollingY: false } : { scrollingX: false };
    },
    setHovering: (): Partial<ScrollAreaContext> => ({ hovering: true }),
    clearHovering: (): Partial<ScrollAreaContext> => ({ hovering: false }),
  },
};
