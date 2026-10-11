/**
 * Carousel connect: the DOM contract, plus the wiring that turns the
 * reflexes into actions.
 *
 * The machine holds a page index and a mode. Everything that MOVES is the
 * browser: the item group is a native scroll container with scroll-snap and
 * `scroll-smooth`, so a drag, a fling and a settle are one motion the
 * platform owns and no transform is ever written. This file's jobs:
 *
 * 1. **Prop bags.** Every part's attributes, semantics and handlers. Each
 *    carries the `use:` entries attaching the stdlib reflexes, with `send`
 *    as the only outward path: `use:drag-scroll`, `use:autoplay`,
 *    `use:intersect` per slide, `use:resize-observer`.
 * 2. **The scroll back to the page.** When the machine's index moves this
 *    positions the group on that page. It reads live state rather than a
 *    captured value, because a stdlib action holds only the param it was
 *    first given while the bags are rebuilt on every machine move.
 * 3. **Keyboard.** Arrows, Home and End on the track and on the indicator
 *    group compute nothing themselves — they send page events.
 */

import type {
  CarouselContext,
  CarouselDragStatus,
} from "./carousel.machine.ts";
import { pageCountFor } from "./carousel.machine.ts";

export interface CarouselSlide {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

export interface CarouselConnectProps {
  readonly dir: "ltr" | "rtl";
  readonly orientation: "horizontal" | "vertical";
  readonly slidesPerPage: number;
  readonly autoSize: boolean;
  readonly snapType: "proximity" | "mandatory";
  readonly allowMouseDrag: boolean;
  readonly inViewThreshold: number;
  readonly autoplayDelay: number;
  /** Read from the machine's state by the bridge, never authored as a prop. */
  readonly playing: boolean;
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

/** The service surface connect consumes: live context, send, nothing else. */
interface CarouselService {
  readonly context: CarouselContext;
  send(event: { type: string } & Record<string, unknown>): void;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/**
 * State that must outlive one api build.
 *
 * The api is rebuilt on every machine move, so a closure field belongs to a
 * build and is thrown away with it. The scroll container has continuous
 * history instead — which page it was last positioned on, and where the
 * current gesture started — and the live readout needs a stable identity so
 * the row that renders it can re-read it. The bridge owns both per element.
 */
export interface CarouselView {
  /** `${page}:${pageCount}` of the last positioning; `""` until the first. */
  appliedKey: string;
  /** The "1 / 5" readout, rewritten on every build. */
  readonly readout: CarouselReadout;
}

/** Descendants that take the keyboard away from the track. */
const TABBABLE =
  "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])";

/**
 * Slides-per-page as presence attributes.
 *
 * A slide's width is `1/N` of the track minus the gaps, and the only way to
 * say a runtime N in a class name is to enumerate it: Uno compiles static
 * text, and `w-[var(--n)]` is not in the vocabulary. Six is every real
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

export function connectRobotCarousel(
  service: CarouselService,
  props: CarouselConnectProps,
  slides: readonly CarouselSlide[],
  id: string,
  send: Send,
  view: CarouselView,
): CarouselApi {
  const ownerId = `carousel:${id}`;
  const itemGroupId = `${ownerId}:item-group`;
  const ctx = (): CarouselContext => service.context;
  const horizontal = props.orientation === "horizontal";
  const rtl = props.dir === "rtl";
  const lastPage = (): number => Math.max(0, ctx().pageCount - 1);
  const moves = (): number => Math.max(1, Math.trunc(ctx().perMove));
  const canNext = (): boolean => ctx().loop || ctx().index < lastPage();
  const canPrev = (): boolean => ctx().loop || ctx().index > 0;
  /**
   * In view is the current page first, the observer second. The runtime's
   * bags are rebuilt on every machine move, but the per-slide intersection
   * report is asynchronous — a page jump answers the indicator click now,
   * and a read taken in the same breath sees null until the observer settles.
   * The page is what the machine IS on, so its slides are in view the moment
   * the index moves; the observer still adds whatever a drag passes THROUGH.
   */
  const slideInView = (index: number): boolean => {
    if (ctx().slidesInView.includes(index)) return true;
    const start = ctx().index * moves();
    const per = Math.max(
      1,
      Math.min(props.slidesPerPage || 1, slides.length - start || 1),
    );
    return index >= start && index < start + per;
  };

  const group = (): HTMLElement | null => document.getElementById(itemGroupId);

  /**
   * Position the container on a page. The target is the first slide of that
   * page, MEASURED rather than computed from a formula, so padding, gaps
   * and fractional widths are already accounted for. `behavior` is explicit
   * because the class supplies `scroll-smooth` and the very first
   * positioning must not glide into place while the observer is still
   * reporting the page the element rendered at.
   */
  const applyScroll = (page: number, behavior: ScrollBehavior): void => {
    const el = group();
    if (!el) return;
    const target = el.querySelector<HTMLElement>(
      `[data-index="${page * moves()}"]`,
    );
    if (!target) return;
    const axis: "left" | "top" = horizontal ? "left" : "top";
    const from = el.getBoundingClientRect()[axis];
    const to = target.getBoundingClientRect()[axis];
    const at = axis === "left" ? el.scrollLeft : el.scrollTop;
    el.scrollTo({ [axis]: to - from + at, behavior });
  };

  /** Reposition when the page or the page count moved — and on nothing else. */
  const sync = (): void => {
    const key = `${ctx().index}:${ctx().pageCount}`;
    if (key === view.appliedKey) return;
    const first = view.appliedKey === "";
    view.appliedKey = key;
    requestAnimationFrame(() =>
      applyScroll(ctx().index, first ? "auto" : "smooth")
    );
  };
  sync();

  /**
   * The page the track is actually showing, measured from the DOM: the slide
   * whose start edge sits closest to the container's start edge. This is
   * Zag's `setClosestPage`, and it is the only thing that turns a scroll
   * into a page — so the view owns the measurement and the machine never
   * walks the DOM.
   */
  const settlePage = (): number => {
    const el = group();
    if (!el) return ctx().index;
    const axis: "left" | "top" = horizontal ? "left" : "top";
    const start = el.getBoundingClientRect()[axis];
    let best = ctx().index;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const slide of el.querySelectorAll<HTMLElement>("[data-index]")) {
      const at = Number.parseInt(slide.getAttribute("data-index") ?? "", 10);
      if (!Number.isFinite(at)) continue;
      const distance = Math.abs(slide.getBoundingClientRect()[axis] - start);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = Math.min(Math.max(0, Math.floor(at / moves())), lastPage());
      }
    }
    return best;
  };

  /**
   * The row's update re-reads the holder, which is why the holder is a
   * stable object rewritten here rather than a string the row captured: the
   * markup's `{...}` text is a one-shot, so a value that must change on its
   * own needs something the row can read again.
   */
  const readout = (): string => `${ctx().index + 1} / ${ctx().pageCount}`;
  view.readout.value = readout();

  const keydown = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey
    ) return;
    const forward = horizontal
      ? event.key === (rtl ? "ArrowLeft" : "ArrowRight")
      : event.key === "ArrowDown";
    const back = horizontal
      ? event.key === (rtl ? "ArrowRight" : "ArrowLeft")
      : event.key === "ArrowUp";
    if (forward) send({ type: "NEXT" });
    else if (back) send({ type: "PREV" });
    else if (event.key === "Home") send({ type: "GO_TO", index: 0 });
    else if (event.key === "End") send({ type: "GO_TO", index: lastPage() });
    else return;
    event.preventDefault();
  };

  const label = (index: number): string => `${index + 1} of ${slides.length}`;

  return {
    index: ctx().index,
    pageCount: ctx().pageCount,
    slidesInView: ctx().slidesInView,
    isPlaying: props.playing,
    isDragging: ctx().dragStatus === "dragging",
    isSettling: ctx().dragStatus === "settling",
    dragStatus: ctx().dragStatus,
    canScrollNext: canNext(),
    canScrollPrev: canPrev(),
    getProgress:
      () => (ctx().pageCount > 0 ? ctx().index / ctx().pageCount : 0),
    getProgressText: () => readout(),
    getProgressRows: () => [view.readout],
    scrollToIndex: (index: number) =>
      send({ type: "GO_TO", index: Math.floor(index / moves()) }),
    scrollTo: (page: number) => send({ type: "GO_TO", index: page }),
    scrollNext: () => send({ type: "NEXT" }),
    scrollPrev: () => send({ type: "PREV" }),
    play: () => send({ type: "AUTOPLAY.START" }),
    pause: () => send({ type: "AUTOPLAY.STOP" }),
    isInView: slideInView,
    refresh: () =>
      send({
        type: "PAGES.SET",
        count: pageCountFor(
          slides.length,
          moves(),
          props.slidesPerPage,
          props.autoSize,
        ),
      }),
    getRootProps: () => ({
      id: ownerId,
      role: "region",
      "aria-roledescription": "carousel",
      "data-orientation": props.orientation,
      "data-state": props.playing ? "playing" : "idle",
      dir: props.dir,
      onPointerdown: () => send({ type: "POINTER.DOWN" }),
      // The clock: the action owns the interval, the machine owns nothing.
      "use:autoplay": {
        interval: props.autoplayDelay,
        enabled: props.playing,
        onTick: () => send({ type: "AUTOPLAY.TICK" }),
      },
    }),
    getControlProps: () => ({
      role: "group",
      "aria-label": "Carousel controls",
      "data-orientation": props.orientation,
    }),
    getItemGroupProps: () => ({
      id: itemGroupId,
      "data-orientation": props.orientation,
      // The one place a state is a utility switch: with snap mandatory the
      // platform would fight the pointer, so the drag turns it off and the
      // class turns it back on. Nobody writes a style.
      ...(ctx().dragStatus === "dragging" ? { "data-dragging": "" } : {}),
      ...(props.allowMouseDrag ? { "data-draggable": "" } : {}),
      "aria-live": props.playing ? "off" : "polite",
      tabindex: group()?.querySelector(TABBABLE) ? -1 : 0,
      onFocusin: () => send({ type: "VIEWPORT.FOCUS" }),
      onFocusout: () => send({ type: "VIEWPORT.BLUR" }),
      onKeydown: keydown,
      onScrollend: () => send({ type: "SCROLL.SETTLE", index: settlePage() }),
      // The gesture: pointer capture plus scroll offset, reported out.
      ...(props.allowMouseDrag && horizontal
        ? {
          "use:drag-scroll": {
            onDragStart: () => send({ type: "DRAG.START" }),
            // A press that moved nothing produces no scroll and so no
            // `scrollend`: the velocity is zero, and the gesture is over.
            onDragEnd: (velocity: number) => {
              send({ type: "DRAG.END" });
              if (velocity === 0) {
                send({
                  type: "SCROLL.SETTLE",
                  index: settlePage(),
                });
              }
            },
          },
        }
        : {}),
      // Layout change is Zag's trackSlideResize: re-measure, re-position.
      "use:resize-observer": {
        onResize: () => {
          if (ctx().dragStatus === "dragging") return;
          view.appliedKey = "";
          sync();
        },
      },
    }),
    getItemProps: (item) => ({
      id: `${ownerId}:item:${item.index}`,
      role: "group",
      "data-index": item.index,
      "data-orientation": props.orientation,
      "data-inview": slideInView(item.index) ? "" : undefined,
      "data-snap": item.snapAlign ?? "start",
      ...(props.autoSize
        ? { "data-auto-size": "" }
        : { ...perPageAttrs(props.slidesPerPage) }),
      "aria-roledescription": "slide",
      "aria-label": label(item.index),
      "aria-hidden": !slideInView(item.index),
      // One observer per slide: the slide says whether it is on screen, and
      // the machine decides what that means.
      "use:intersect": {
        threshold: props.inViewThreshold,
        onVisibility: (visible: boolean) =>
          send({ type: "SLIDE.VIEW", index: item.index, inView: visible }),
      },
    }),
    getPrevTriggerProps: () => ({
      id: `${ownerId}:prev-trigger`,
      type: "button",
      "aria-label": "Previous slide",
      "aria-controls": itemGroupId,
      "data-orientation": props.orientation,
      "data-disabled": canPrev() ? undefined : "",
      disabled: !canPrev(),
      onClick: () => send({ type: "PREV" }),
    }),
    getNextTriggerProps: () => ({
      id: `${ownerId}:next-trigger`,
      type: "button",
      "aria-label": "Next slide",
      "aria-controls": itemGroupId,
      "data-orientation": props.orientation,
      "data-disabled": canNext() ? undefined : "",
      disabled: !canNext(),
      onClick: () => send({ type: "NEXT" }),
    }),
    getAutoplayTriggerProps: () => ({
      id: `${ownerId}:autoplay-trigger`,
      type: "button",
      "aria-label": props.playing
        ? "Stop slide rotation"
        : "Start slide rotation",
      "aria-pressed": props.playing,
      "data-orientation": props.orientation,
      "data-playing": props.playing ? "" : undefined,
      onClick: () =>
        send({ type: props.playing ? "AUTOPLAY.STOP" : "AUTOPLAY.START" }),
    }),
    getIndicatorGroupProps: () => ({
      id: `${ownerId}:indicator-group`,
      role: "group",
      "aria-label": "Slides",
      "data-orientation": props.orientation,
      onKeydown: keydown,
    }),
    getIndicatorProps: (indicator) => ({
      id: `${ownerId}:indicator:${indicator.index}`,
      type: "button",
      "data-index": indicator.index,
      "data-orientation": props.orientation,
      "data-current": indicator.index === ctx().index ? "" : undefined,
      "aria-current": indicator.index === ctx().index,
      "aria-label": `${label(indicator.index)} — ${
        slides[indicator.index]?.label ?? `slide ${indicator.index + 1}`
      }`,
      "data-readonly": indicator.readOnly ? "" : undefined,
      onClick: () => {
        if (indicator.readOnly === true) return;
        send({ type: "GO_TO", index: indicator.index });
      },
    }),
    getProgressTextProps: () => ({
      id: `${ownerId}:progress-text`,
      "data-orientation": props.orientation,
      "data-state": props.playing ? "playing" : "paused",
    }),
    /** The autoplay progress bar's own state, on itself: a `group-data-`
     * selector here has no group ancestor, which Uno compiles into a
     * dangling combinator and the build breaks. */
    getAutoplayProgressProps: () => ({
      id: `${ownerId}:autoplay-progress`,
      "data-orientation": props.orientation,
      "data-state": props.playing ? "playing" : "paused",
      "aria-hidden": true,
    }),
    getAutoplayProgressFillProps: () => ({
      "data-orientation": props.orientation,
      "data-state": props.playing ? "playing" : "paused",
    }),
  };
}
