/**
 * Scroll-area connect: the DOM contract, the layout readings and the drag.
 *
 * This is the port whose state is a function of layout, so the connect does
 * the measuring and reports it: every reading the view can make — the boxes,
 * which bars overflow, which sides the viewport rests on — travels to the
 * machine as an event payload, and the machine decides what it means. Nothing
 * in `scroll-area.machine.ts` touches the DOM.
 *
 * The geometry channel carries the continuous values the markup consumes:
 * the thumb and corner sizes on the root (they are the same for both bars, so
 * one var each feeds the utilities that need them) and the scroll offsets on
 * the viewport. The thumb's own position is an inset var on the thumb, which
 * is data — the utility class beside it decides what that inset means.
 *
 * The drag is document-scoped for the gesture and released on pointer-up,
 * exactly as the slider's is: a pointer that leaves the thumb keeps dragging.
 * The two dwell timers Zag keeps are the `autoplay` action's interval on each
 * bar — the action owns the clock, the machine owns the flags it reports
 * back.
 */

import type {
  HiddenState,
  Measurement,
  Orientation,
  Point,
  ScrollAreaContext,
  ScrollSides,
  Size,
} from "./scroll-area.machine.ts";

export interface ScrollAreaFsmConnectProps {
  readonly dir: "ltr" | "rtl";
}

export interface ScrollbarState {
  readonly hovering: boolean;
  readonly dragging: boolean;
  readonly scrolling: boolean;
  readonly hidden: boolean;
}

export type ScrollEdge = "top" | "right" | "bottom" | "left";

export interface ScrollToDetails {
  readonly top?: number | undefined;
  readonly left?: number | undefined;
  readonly behavior?: ScrollBehavior | undefined;
}

export interface ScrollToEdgeDetails {
  readonly edge: ScrollEdge;
  readonly behavior?: ScrollBehavior | undefined;
}

export interface ScrollAreaFsmApi {
  readonly isAtTop: boolean;
  readonly isAtBottom: boolean;
  readonly isAtLeft: boolean;
  readonly isAtRight: boolean;
  readonly hasOverflowX: boolean;
  readonly hasOverflowY: boolean;
  getScrollProgress(): Point;
  scrollToEdge(details: ScrollToEdgeDetails): void;
  scrollTo(details: ScrollToDetails): void;
  getScrollbarState(props?: { orientation?: Orientation }): ScrollbarState;
  getRootProps(): Record<string, unknown>;
  getViewportProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getScrollbarProps(props?: { orientation?: Orientation }): Record<string, unknown>;
  getThumbProps(props?: { orientation?: Orientation }): Record<string, unknown>;
  getCornerProps(): Record<string, unknown>;
}

export interface ScrollAreaService {
  readonly context: ScrollAreaContext;
  /** The machine's phase — `dragging` while a press drags either bar. */
  readonly dragging: boolean;
  send(event: { type: string } & Record<string, unknown>): void;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** Read behavioural props live: the connect outlives any one read of them. */
export type ReadScrollAreaProps = () => ScrollAreaFsmConnectProps;

/** A layout number: an element with no box reports nothing, which is zero. */
const box = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Zag's `MIN_THUMB_SIZE`: a thumb is never shorter than a comfortable grab. */
const MIN_THUMB_SIZE = 20;
/** Zag's `SCROLL_TIMEOUT`: how long an axis counts as scrolling after it stops. */
const SCROLL_TIMEOUT = 1000;

/** Zag's `dataAttr`: present when the condition holds, absent otherwise. */
const dataAttr = (value: boolean): string | undefined => (value ? "" : undefined);

const NAMESPACE = "scroll-area";

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/**
 * One part's memo: the bag it last built and the field signature it was built
 * against. A binding re-reads the bag on every machine move, so a fresh bag
 * per read would detach and re-attach every listener each move.
 */
export interface BagMemoizer {
  (sig: string, build: () => Record<string, unknown>): Record<string, unknown>;
}

/** `cached()` for a single part: one memo, one bag. */
function cached(): BagMemoizer {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Zag's `getScrollSides`, verbatim: which edges the viewport rests on. */
function scrollSides(viewport: HTMLElement, dir: "ltr" | "rtl"): ScrollSides {
  const scrollTop = box(viewport.scrollTop);
  const scrollLeft = box(viewport.scrollLeft);
  const threshold = 1;
  const hasVerticalScroll = box(viewport.scrollHeight) - box(viewport.clientHeight) > threshold;
  const hasHorizontalScroll = box(viewport.scrollWidth) - box(viewport.clientWidth) > threshold;
  const maxScrollLeft = box(viewport.scrollWidth) - box(viewport.clientWidth);
  const maxScrollTop = box(viewport.scrollHeight) - box(viewport.clientHeight);
  let atLeft = false;
  let atRight = false;
  let atTop = false;
  let atBottom = false;
  if (hasHorizontalScroll) {
    if (dir === "rtl") {
      if (scrollLeft <= 0) {
        atLeft = Math.abs(scrollLeft) >= maxScrollLeft - threshold;
        atRight = Math.abs(scrollLeft) <= threshold;
      } else {
        atLeft = scrollLeft <= threshold;
        atRight = scrollLeft >= maxScrollLeft - threshold;
      }
    } else {
      atLeft = scrollLeft <= threshold;
      atRight = scrollLeft >= maxScrollLeft - threshold;
    }
  }
  if (hasVerticalScroll) {
    atTop = scrollTop <= threshold;
    atBottom = scrollTop >= maxScrollTop - threshold;
  }
  return { top: atTop, right: atRight, bottom: atBottom, left: atLeft };
}

export function connectRobotScrollArea(
  service: ScrollAreaService,
  readProps: ReadScrollAreaProps,
  id: string,
): ScrollAreaFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const viewportId = `${ownerId}:viewport`;
  const contentId = `${ownerId}:content`;
  const cornerId = `${ownerId}:corner`;
  const scrollbarId = (orientation: Orientation): string =>
    `${ownerId}:scrollbar-${orientation === "vertical" ? "y" : "x"}`;
  const thumbId = (orientation: Orientation): string =>
    `${ownerId}:thumb-${orientation === "vertical" ? "y" : "x"}`;

  const ctx = (): ScrollAreaContext => service.context;
  const dir = (): "ltr" | "rtl" => readProps().dir;
  /** The live reading of the bars and the sides — never a captured snapshot. */
  const hidden = (): HiddenState => ctx().hiddenState;
  const sides = (): ScrollSides => ctx().atSides;
  const send: Send = (event): void => {
    service.send(event);
  };
  const byId = (partId: string): HTMLElement | null => document.getElementById(partId);
  const viewportEl = (): HTMLElement | null => byId(viewportId);
  const barEl = (orientation: Orientation): HTMLElement | null => byId(scrollbarId(orientation));

  const overflowAttrs = (): Record<string, unknown> => ({
    "data-overflow-x": dataAttr(!hidden().scrollbarXHidden),
    "data-overflow-y": dataAttr(!hidden().scrollbarYHidden),
  });

  // ------------------------------------------------------------- measurement

  /**
   * One full reading of the viewport. Zag's guard is kept verbatim: an
   * element with no content or no box reports nothing rather than measuring a
   * division by zero.
   */
  const measure = (): Measurement | null => {
    const viewport = viewportEl();
    if (viewport === null) return null;
    const scrollHeight = box(viewport.scrollHeight);
    const scrollWidth = box(viewport.scrollWidth);
    if (scrollHeight === 0 || scrollWidth === 0) return null;
    const viewportHeight = box(viewport.clientHeight);
    const viewportWidth = box(viewport.clientWidth);
    const scrollbarYHidden = viewportHeight >= scrollHeight;
    const scrollbarXHidden = viewportWidth >= scrollWidth;
    const hiddenState: HiddenState = {
      scrollbarYHidden,
      scrollbarXHidden,
      cornerHidden: scrollbarYHidden || scrollbarXHidden,
    };
    const barY = barEl("vertical");
    const barX = barEl("horizontal");
    // Structure is this component's own: no utility adds padding inside a
    // track, so the bar's own length is the thumb's travel plus its size.
    const idealHeight = scrollbarYHidden ? 0 : viewportHeight;
    const idealWidth = scrollbarXHidden ? 0 : viewportWidth;
    const trackHeight = barY === null ? idealHeight : Math.min(box(barY.offsetHeight), idealHeight);
    const trackWidth = barX === null ? idealWidth : Math.min(box(barX.offsetWidth), idealWidth);
    const thumbSize: Size = {
      width: Math.max(MIN_THUMB_SIZE, trackWidth * (viewportWidth / scrollWidth)),
      height: Math.max(MIN_THUMB_SIZE, trackHeight * (viewportHeight / scrollHeight)),
    };
    const cornerSize: Size = hiddenState.cornerHidden
      ? { width: 0, height: 0 }
      : { width: box(barY?.offsetWidth), height: box(barX?.offsetHeight) };
    return {
      thumbSize,
      cornerSize,
      hiddenState,
      atSides: scrollSides(viewport, dir()),
    };
  };

  /** A resize or the viewport appearing re-measures and reports. */
  const remeasure = (): void => {
    const reading = measure();
    if (reading === null) return;
    send({ type: "THUMB.MEASURE", ...reading });
  };

  /** The scroll reading: the same measurement plus where the viewport sits. */
  const reportScroll = (): void => {
    const viewport = viewportEl();
    if (viewport === null) return;
    const reading = measure();
    if (reading === null) return;
    send({
      type: "VIEWPORT.SCROLL",
      position: { x: box(viewport.scrollLeft), y: box(viewport.scrollTop) },
      ...reading,
    });
  };

  // ---------------------------------------------------------------- geometry

  /** How far each axis can still scroll, in pixels. */
  const scrollable = (): { readonly x: number; readonly y: number } => {
    const viewport = viewportEl();
    if (viewport === null) return { x: 0, y: 0 };
    return {
      x: Math.max(0, box(viewport.scrollWidth) - box(viewport.clientWidth)),
      y: Math.max(0, box(viewport.scrollHeight) - box(viewport.clientHeight)),
    };
  };

  /** A thumb's travel: the track's length minus the thumb's own. */
  const thumbTravel = (orientation: Orientation): number => {
    const bar = barEl(orientation);
    if (bar === null) return 0;
    const thumbLength = orientation === "vertical" ? ctx().thumbSize.height : ctx().thumbSize.width;
    const trackLength = orientation === "vertical" ? box(bar.offsetHeight) : box(bar.offsetWidth);
    return Math.max(0, trackLength - thumbLength);
  };

  /**
   * The thumb's inset, from the bar's inline start. The horizontal bar is laid
   * out with logical insets, so an RTL offset is measured from the right edge;
   * the var itself is a physical left inset, which is the utility beside it.
   */
  const thumbOffset = (orientation: Orientation): number => {
    const viewport = viewportEl();
    if (viewport === null) return 0;
    const max = thumbTravel(orientation);
    if (max === 0) return 0;
    const range = scrollable();
    const span = orientation === "vertical" ? range.y : range.x;
    if (span <= 0) return 0;
    const fromStart = orientation === "vertical"
      ? clamp(box(viewport.scrollTop), 0, span)
      : dir() === "rtl"
        ? Math.min(Math.abs(box(viewport.scrollLeft)), span)
        : clamp(box(viewport.scrollLeft), 0, span);
    const at = (fromStart / span) * max;
    // RTL: the bar starts at the right edge, so the physical left inset is
    // the remainder of the track.
    return orientation === "horizontal" && dir() === "rtl" ? Math.max(0, max - at) : Math.min(at, max);
  };

  /** The distance from one end of an axis to the scroll position. */
  const overflowFrom = (
    span: number,
    scrolled: number,
    barHidden: boolean,
    edge: "start" | "end",
  ): string => {
    if (barHidden) return "0px";
    const at = clamp(scrolled, 0, span);
    return edge === "start" ? `${at}px` : `${Math.max(0, span - at)}px`;
  };

  /**
   * The distances to each overflow edge — the theme-facing geometry Zag
   * publishes on the viewport. A bar that does not overflow reports both
   * edges as zero.
   */
  const overflowVars = (): Record<string, string> => {
    const viewport = viewportEl();
    const bars = hidden();
    const zero = { x: 0, y: 0 };
    const range = viewport === null ? zero : scrollable();
    const left = viewport === null ? 0 : box(viewport.scrollLeft);
    const top = viewport === null ? 0 : box(viewport.scrollTop);
    return {
      "--scroll-area-overflow-x-start": overflowFrom(range.x, left, bars.scrollbarXHidden, "start"),
      "--scroll-area-overflow-x-end": overflowFrom(range.x, left, bars.scrollbarXHidden, "end"),
      "--scroll-area-overflow-y-start": overflowFrom(range.y, top, bars.scrollbarYHidden, "start"),
      "--scroll-area-overflow-y-end": overflowFrom(range.y, top, bars.scrollbarYHidden, "end"),
    };
  };

  // ----------------------------------------------------------- scroll commands

  /** Zag's `scrollTo`: the platform's smooth scroll, or an instant jump. */
  const scrollTo = (details: ScrollToDetails): void => {
    const viewport = viewportEl();
    if (viewport === null) return;
    // `exactOptionalPropertyTypes` refuses an explicitly-undefined member on
    // the platform's own options: an unset coordinate is left out entirely.
    const options: ScrollToOptions = {};
    if (details.top !== undefined) options.top = details.top;
    if (details.left !== undefined) options.left = details.left;
    if (details.behavior === "smooth") {
      viewport.scrollTo({ ...options, behavior: "smooth" });
      return;
    }
    viewport.scrollTo(options);
  };

  /** Zag's `scrollToEdge`: an edge's offset on the axis it names. */
  const scrollToEdge = (details: ScrollToEdgeDetails): void => {
    const viewport = viewportEl();
    if (viewport === null) return;
    const range = scrollable();
    const rtl = dir() === "rtl";
    const scrolled = { x: box(viewport.scrollLeft), y: box(viewport.scrollTop) };
    /** In RTL the viewport's origin is at the right, as Zag handles it. */
    const horizontal = (edge: "left" | "right"): number => {
      if (!rtl) return edge === "left" ? 0 : range.x;
      const negative = scrolled.x <= 0;
      if (edge === "left") return negative ? -range.x : 0;
      return negative ? 0 : range.x;
    };
    const target = details.edge === "top"
      ? { x: scrolled.x, y: 0 }
      : details.edge === "bottom"
        ? { x: scrolled.x, y: range.y }
        : { x: horizontal(details.edge), y: scrolled.y };
    scrollTo({ top: target.y, left: target.x, behavior: details.behavior });
  };

  // -------------------------------------------------------------- the gesture

  /** The press that began a drag: where it landed and what it moved. */
  interface Gesture {
    readonly orientation: Orientation;
    readonly point: Point;
    readonly scroll: Point;
  }

  let gesture: Gesture | null = null;
  let detachGesture: (() => void) | undefined;

  const endGesture = (): void => {
    detachGesture?.();
    detachGesture = undefined;
    gesture = null;
  };

  /** Zag's `startDragging`: capture the press, then listen on the document. */
  const beginGesture = (orientation: Orientation, point: Point): void => {
    const viewport = viewportEl();
    if (viewport === null) return;
    endGesture();
    gesture = {
      orientation,
      point,
      scroll: { x: box(viewport.scrollLeft), y: box(viewport.scrollTop) },
    };
    const onMove = (event: PointerEvent): void => {
      if (gesture === null) return;
      const next = { x: event.clientX, y: event.clientY };
      applyDragScroll(next);
      send({ type: "THUMB.POINTER_MOVE", orientation, point: next });
    };
    const onUp = (): void => {
      const active = gesture;
      endGesture();
      if (active === null) return;
      send({ type: "THUMB.POINTER_UP", orientation: active.orientation });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    detachGesture = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  };

  /**
   * Zag's `setDraggingScroll`: the press's delta, scaled by how far the thumb
   * travels across the whole scrollable range. The event reports the move; the
   * view is what turns a point into a scroll offset.
   */
  const applyDragScroll = (point: Point): void => {
    const active = gesture;
    const viewport = viewportEl();
    if (active === null || viewport === null) return;
    const vertical = active.orientation === "vertical";
    const max = thumbTravel(active.orientation);
    const range = scrollable();
    const span = vertical ? range.y : range.x;
    if (max <= 0 || span <= 0) return;
    const delta = vertical ? point.y - active.point.y : point.x - active.point.x;
    const at = (vertical ? active.scroll.y : active.scroll.x) + (delta / max) * span;
    const scrolled = clamp(at, 0, span);
    if (vertical) {
      viewport.scrollTop = scrolled;
      return;
    }
    viewport.scrollLeft = dir() === "rtl" ? -scrolled : scrolled;
  };

  /** Zag's `scrollToPointer`: a track press jumps the thumb under the pointer. */
  const scrollToPointer = (orientation: Orientation, point: Point): void => {
    const viewport = viewportEl();
    const bar = barEl(orientation);
    if (viewport === null || bar === null) return;
    const vertical = orientation === "vertical";
    const max = thumbTravel(orientation);
    const range = scrollable();
    const span = vertical ? range.y : range.x;
    if (max <= 0 || span <= 0) return;
    const rect = bar.getBoundingClientRect();
    const thumbLength = vertical ? ctx().thumbSize.height : ctx().thumbSize.width;
    const along = vertical
      ? point.y - rect.top - thumbLength / 2
      : point.x - rect.left - thumbLength / 2;
    const at = clamp(along / max, 0, 1) * span;
    if (vertical) {
      viewport.scrollTop = at;
      return;
    }
    viewport.scrollLeft = dir() === "rtl" ? -(span - at) : at;
  };

  /** Zag's `trackWheelEvent`: a wheel over a bar scrolls it, not the page. */
  const wheelOverBar = (orientation: Orientation, event: WheelEvent): void => {
    const viewport = viewportEl();
    if (viewport === null || event.ctrlKey) return;
    const vertical = orientation === "vertical";
    const range = scrollable();
    const span = vertical ? range.y : range.x;
    const scrolled = vertical ? box(viewport.scrollTop) : box(viewport.scrollLeft);
    const delta = vertical ? event.deltaY : event.deltaX;
    const atStart = scrolled <= 0 && delta < 0;
    const atEnd = scrolled >= span && delta > 0;
    if (span <= 0 || delta === 0 || atStart || atEnd) return;
    event.preventDefault();
    if (vertical) {
      viewport.scrollTop = scrolled + delta;
      return;
    }
    viewport.scrollLeft = scrolled + delta;
  };

  // ------------------------------------------------------------ part handlers

  /** One bar's press: a track jump, the drag, and the wheel that scrolls it. */
  const barPress = (orientation: Orientation) => (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const current = event.currentTarget;
    // A press on the thumb is the thumb's own gesture, not a track jump.
    if (!(current instanceof Element) || current !== event.target) return;
    const point = { x: event.clientX, y: event.clientY };
    scrollToPointer(orientation, point);
    send({ type: "SCROLLBAR.POINTER_DOWN", orientation });
    beginGesture(orientation, point);
    event.stopPropagation();
  };

  /** One bar's handlers, built once: they read the behavioural props live. */
  const barHandlers: Record<Orientation, Record<string, unknown>> = {
    vertical: {
      onPointerUp: (): void => send({ type: "SCROLLBAR.POINTER_UP", orientation: "vertical" }),
      onPointerDown: barPress("vertical"),
      onWheel: (event: WheelEvent): void => wheelOverBar("vertical", event),
    },
    horizontal: {
      onPointerUp: (): void => send({ type: "SCROLLBAR.POINTER_UP", orientation: "horizontal" }),
      onPointerDown: barPress("horizontal"),
      onWheel: (event: WheelEvent): void => wheelOverBar("horizontal", event),
    },
  };

  const thumbHandlers: Record<Orientation, Record<string, unknown>> = {
    vertical: {
      onPointerDown: (event: PointerEvent): void => {
        if (event.button !== 0) return;
        const point = { x: event.clientX, y: event.clientY };
        send({ type: "THUMB.POINTER_DOWN", orientation: "vertical", point });
        beginGesture("vertical", point);
      },
    },
    horizontal: {
      onPointerDown: (event: PointerEvent): void => {
        if (event.button !== 0) return;
        const point = { x: event.clientX, y: event.clientY };
        send({ type: "THUMB.POINTER_DOWN", orientation: "horizontal", point });
        beginGesture("horizontal", point);
      },
    },
  };

  /** A bar's dwell: the action owns the clock, the machine owns the flag. */
  const barDwell = (orientation: Orientation): Record<string, unknown> => ({
    interval: SCROLL_TIMEOUT,
    enabled: orientation === "vertical" ? ctx().scrollingY : ctx().scrollingX,
    onTick: (): void => send({ type: "SCROLL.SETTLE", orientation }),
  });

  // --------------------------------------------------------------- part bags

  const rootBag = cached();
  const viewportBag = cached();
  const contentBag = cached();
  const cornerBag = cached();
  const barBagByAxis: Record<Orientation, BagMemoizer> = {
    vertical: cached(),
    horizontal: cached(),
  };
  const thumbBagByAxis: Record<Orientation, BagMemoizer> = {
    vertical: cached(),
    horizontal: cached(),
  };

  return {
    get isAtTop(): boolean {
      return sides().top;
    },
    get isAtBottom(): boolean {
      return sides().bottom;
    },
    get isAtLeft(): boolean {
      return sides().left;
    },
    get isAtRight(): boolean {
      return sides().right;
    },
    get hasOverflowX(): boolean {
      return !hidden().scrollbarXHidden;
    },
    get hasOverflowY(): boolean {
      return !hidden().scrollbarYHidden;
    },
    getScrollProgress: (): Point => {
      const viewport = viewportEl();
      const range = scrollable();
      if (viewport === null) return { x: 0, y: 0 };
      // A range that cannot scroll reports a settled axis, as Zag's does.
      return {
        x: range.x > 0 ? clamp(box(viewport.scrollLeft) / range.x, 0, 1) : 0,
        y: range.y > 0 ? clamp(box(viewport.scrollTop) / range.y, 0, 1) : 0,
      };
    },
    scrollToEdge,
    scrollTo,
    getScrollbarState: (props?: { orientation?: Orientation }): ScrollbarState => {
      const orientation = props?.orientation ?? "vertical";
      const vertical = orientation === "vertical";
      return {
        hovering: ctx().hovering,
        dragging: service.dragging,
        scrolling: vertical ? ctx().scrollingY : ctx().scrollingX,
        hidden: vertical ? hidden().scrollbarYHidden : hidden().scrollbarXHidden,
      };
    },
    getRootProps: () => {
      const thumb = ctx().thumbSize;
      const corner = ctx().cornerSize;
      return rootBag(
        [
          thumb.width,
          thumb.height,
          corner.width,
          corner.height,
          dir(),
          hidden().scrollbarXHidden,
          hidden().scrollbarYHidden,
        ].join("\u0000"),
        () => ({
          id: rootId,
          role: "presentation",
          dir: dir(),
          ...overflowAttrs(),
          // The geometry channel: the sizes both bars and the corner read.
          style: {
            "--scroll-area-thumb-width": `${thumb.width}px`,
            "--scroll-area-thumb-height": `${thumb.height}px`,
            "--scroll-area-corner-width": `${corner.width}px`,
            "--scroll-area-corner-height": `${corner.height}px`,
          },
          onPointerEnter: (): void => send({ type: "ROOT.POINTER_ENTER" }),
          // Zag reports the hover on a move too: the bars stay lit while the
          // pointer wanders inside the root.
          onPointerMove: (): void => send({ type: "ROOT.POINTER_ENTER" }),
          onPointerLeave: (event: PointerEvent): void => {
            const current = event.currentTarget;
            // Zag's `contains` guard: a move into the root is not a leave, and
            // a leave to nothing at all still is one.
            if (!(current instanceof Element)) return;
            if (current.contains(event.relatedTarget as Node | null)) return;
            send({ type: "ROOT.POINTER_LEAVE" });
          },
        }),
      );
    },
    getViewportProps: () => {
      const bars = hidden();
      const at = sides();
      return viewportBag(
        [
          dir(),
          bars.scrollbarXHidden,
          bars.scrollbarYHidden,
          at.top,
          at.right,
          at.bottom,
          at.left,
          Object.values(overflowVars()).join("\u0000"),
        ].join("\u0000"),
        () => ({
          id: viewportId,
          role: "presentation",
          "data-ownedby": rootId,
          dir: dir(),
          "data-at-top": dataAttr(at.top),
          "data-at-bottom": dataAttr(at.bottom),
          "data-at-left": dataAttr(at.left),
          "data-at-right": dataAttr(at.right),
          ...overflowAttrs(),
          // A box with nothing to scroll is nothing to tab into, and the key
          // is omitted rather than written undefined: the spread would
          // coerce an undefined property to zero.
          ...(bars.scrollbarXHidden && bars.scrollbarYHidden ? {} : { tabIndex: 0 }),
          style: overflowVars(),
          onScroll: (): void => reportScroll(),
          // A box change or the viewport appearing re-measures: both are
          // Zag's `trackContentResize` and `trackViewportVisibility`.
          "use:resize-observer": { onResize: (): void => remeasure() },
          "use:intersect": {
            threshold: 0,
            onVisibility: (visible: boolean): void => {
              if (visible) remeasure();
            },
          },
        }),
      );
    },
    getContentProps: () =>
      contentBag(
        [dir(), hidden().scrollbarXHidden, hidden().scrollbarYHidden].join("\u0000"),
        () => ({
          id: contentId,
          role: "presentation",
          "data-ownedby": rootId,
          dir: dir(),
          ...overflowAttrs(),
          // The content's own box is what grows: it re-measures on its own.
          "use:resize-observer": { onResize: (): void => remeasure() },
        }),
      ),
    getScrollbarProps: (props?: { orientation?: Orientation }): Record<string, unknown> => {
      const orientation = props?.orientation ?? "vertical";
      const vertical = orientation === "vertical";
      const barHidden = vertical ? hidden().scrollbarYHidden : hidden().scrollbarXHidden;
      const scrolling = vertical ? ctx().scrollingY : ctx().scrollingX;
      return barBagByAxis[orientation](
        [
          dir(),
          ctx().hovering,
          service.dragging,
          scrolling,
          barHidden,
          hidden().scrollbarXHidden,
          hidden().scrollbarYHidden,
        ].join("\u0000"),
        () => ({
          id: scrollbarId(orientation),
          "data-ownedby": rootId,
          "data-orientation": orientation,
          dir: dir(),
          "data-hover": dataAttr(ctx().hovering),
          "data-dragging": dataAttr(service.dragging),
          "data-scrolling": dataAttr(scrolling),
          ...overflowAttrs(),
          // A bar whose axis cannot scroll is not there: `hidden` is the
          // platform's own absent attribute, so no utility has to carry it.
          hidden: barHidden,
          // The bar's own dwell: the action owns the clock, the machine owns
          // the flag it reports back.
          "use:autoplay": barDwell(orientation),
          ...barHandlers[orientation],
        }),
      );
    },
    getThumbProps: (props?: { orientation?: Orientation }): Record<string, unknown> => {
      const orientation = props?.orientation ?? "vertical";
      const vertical = orientation === "vertical";
      const offset = thumbOffset(orientation);
      return thumbBagByAxis[orientation](
        [
          dir(),
          ctx().hovering,
          service.dragging,
          offset,
          vertical ? ctx().thumbSize.height : ctx().thumbSize.width,
        ].join("\u0000"),
        () => ({
          id: thumbId(orientation),
          "data-ownedby": rootId,
          "data-orientation": orientation,
          dir: dir(),
          "data-hover": dataAttr(ctx().hovering),
          "data-dragging": dataAttr(service.dragging),
          style: vertical
            ? { "--scroll-area-thumb-y": `${offset}px` }
            : { "--scroll-area-thumb-x": `${offset}px` },
          ...thumbHandlers[orientation],
        }),
      );
    },
    getCornerProps: () =>
      cornerBag(
        [
          dir(),
          ctx().hovering,
          service.dragging,
          hidden().cornerHidden,
          hidden().scrollbarXHidden,
          hidden().scrollbarYHidden,
          ctx().cornerSize.width,
          ctx().cornerSize.height,
        ].join("\u0000"),
        () => ({
          id: cornerId,
          "data-ownedby": rootId,
          dir: dir(),
          "data-hover": dataAttr(ctx().hovering),
          "data-state": hidden().cornerHidden ? "hidden" : "visible",
          ...overflowAttrs(),
        }),
      ),
  };
}
