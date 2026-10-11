import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type Measurement,
  type ScrollAreaContext,
  type ScrollAreaEvent,
} from "./scroll-area.machine.ts";
import { createScrollAreaFsmBridge } from "./scroll-area.bridge.ts";
import type { ScrollAreaFsmApi } from "./scroll-area.connect.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;
globalThis.Node = win.Node;

/**
 * A started service, as the bridge starts one: the fork's initial context is
 * the config's own object until a transition folds a copy, so a send makes the
 * service's state its own — which is exactly the hazard the bridge's spread
 * of `config.context` exists to close.
 */
function scrollArea(measurement?: Measurement): FsmService<ScrollAreaContext, ScrollAreaEvent> {
  const svc = interpret(createMachine<ScrollAreaContext, ScrollAreaEvent>(config, implementations));
  svc.start();
  if (measurement !== undefined) svc.send({ type: "THUMB.MEASURE", ...measurement });
  return svc;
}

const state = (svc: FsmService<ScrollAreaContext, ScrollAreaEvent>): string => svc.state.value;
const context = (svc: FsmService<ScrollAreaContext, ScrollAreaEvent>): ScrollAreaContext =>
  svc.state.context;

/** A hand-worked layout reading: a 200px-tall box with 1000px of content, a
 * 100px-wide one with 500px, both bars visible, scrolled to the top. */
const OVERFLOW_BOTH: Measurement = {
  thumbSize: { width: 20, height: 40 },
  cornerSize: { width: 8, height: 8 },
  hiddenState: { scrollbarYHidden: false, scrollbarXHidden: false, cornerHidden: false },
  atSides: { top: true, right: false, bottom: false, left: true },
};

/** The same viewport at the far end of both axes. */
const OVERFLOW_SCROLLED: Measurement = {
  thumbSize: { width: 20, height: 40 },
  cornerSize: { width: 8, height: 8 },
  hiddenState: { scrollbarYHidden: false, scrollbarXHidden: false, cornerHidden: false },
  atSides: { top: false, right: false, bottom: true, left: false },
};

/** Only the vertical axis overflows: no corner, no horizontal bar. */
const OVERFLOW_Y: Measurement = {
  thumbSize: { width: 20, height: 40 },
  cornerSize: { width: 0, height: 0 },
  hiddenState: { scrollbarYHidden: false, scrollbarXHidden: true, cornerHidden: true },
  atSides: { top: true, right: false, bottom: false, left: true },
};

Deno.test("Given an unmeasured scroll area / When it starts / Then idle holds no bars", () => {
  const svc = scrollArea();
  assertEquals(state(svc), "idle", "idle is the start state");
  assertEquals(context(svc).hiddenState.scrollbarYHidden, true, "neither bar is known to overflow");
  assertEquals(context(svc).hiddenState.scrollbarXHidden, true, "so no bar is painted yet");
  assertEquals(context(svc).hiddenState.cornerHidden, true, "and no corner");
  assertEquals(context(svc).atSides, { top: true, right: false, bottom: false, left: true }, "it rests on the top and the left");
});

Deno.test("Given a reading / When it is measured / Then the sizes, the bars and the sides are held", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  assertEquals(context(svc).thumbSize, { width: 20, height: 40 }, "the measured thumb box is held");
  assertEquals(context(svc).cornerSize, { width: 8, height: 8 }, "the measured corner box is held");
  assertEquals(context(svc).hiddenState.scrollbarYHidden, false, "the vertical bar overflows");
  assertEquals(context(svc).hiddenState.cornerHidden, false, "two bars mean a corner");
  assertEquals(context(svc).atSides.right, false, "the reading's sides are held verbatim");
});

Deno.test("Given a reading with one axis / When it is measured / Then the missing bar takes its corner", () => {
  const svc = scrollArea(OVERFLOW_Y);
  assertEquals(context(svc).hiddenState.scrollbarYHidden, false, "the vertical bar stays");
  assertEquals(context(svc).hiddenState.scrollbarXHidden, true, "the horizontal bar is gone");
  assertEquals(context(svc).hiddenState.cornerHidden, true, "and with one bar there is no corner");
  assertEquals(context(svc).cornerSize, { width: 0, height: 0 }, "so the corner has no size");
});

Deno.test("Given a measured scroll area / When the viewport scrolls / Then the moved axes are scrolling", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({
    type: "VIEWPORT.SCROLL",
    position: { x: 0, y: 120 },
    ...OVERFLOW_SCROLLED,
  });
  assertEquals(context(svc).scrollingY, true, "a moved vertical axis scrolls");
  assertEquals(context(svc).scrollingX, false, "an axis that did not move is left alone");
  assertEquals(context(svc).scrollPosition, { x: 0, y: 120 }, "the new position is the reference for the next reading");
  assertEquals(context(svc).atSides.bottom, true, "the reading also reports where it now rests");
});

Deno.test("Given a horizontal-only scroll / When it is reported / Then only that axis scrolls", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "VIEWPORT.SCROLL", position: { x: 40, y: 0 }, ...OVERFLOW_BOTH });
  assertEquals(context(svc).scrollingX, true, "the horizontal axis scrolls");
  assertEquals(context(svc).scrollingY, false, "the vertical axis is untouched");
});

Deno.test("Given a scrolling axis / When the dwell elapses / Then that axis settles", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "VIEWPORT.SCROLL", position: { x: 0, y: 120 }, ...OVERFLOW_SCROLLED });
  svc.send({ type: "SCROLL.SETTLE", orientation: "vertical" });
  assertEquals(context(svc).scrollingY, false, "the settled axis stops");
  assertEquals(context(svc).scrollingX, false, "the other axis was never scrolling");
});

Deno.test("Given an idle scroll area / When the pointer enters the root / Then it hovers", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "ROOT.POINTER_ENTER" });
  assertEquals(context(svc).hovering, true, "the bars are lit");
  svc.send({ type: "ROOT.POINTER_LEAVE" });
  assertEquals(context(svc).hovering, false, "and leave puts them out");
});

Deno.test("Given hovering / When the viewport scrolls / Then the hover survives", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "ROOT.POINTER_ENTER" });
  svc.send({ type: "VIEWPORT.SCROLL", position: { x: 0, y: 120 }, ...OVERFLOW_SCROLLED });
  assertEquals(context(svc).hovering, true, "a scroll does not clear the hover");
  assertEquals(context(svc).scrollingY, true, "and it marks the axis scrolling");
});

Deno.test("Given idle / When a bar is pressed / Then the machine drags", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "SCROLLBAR.POINTER_DOWN", orientation: "vertical" });
  assertEquals(state(svc), "dragging", "a press on the track starts the drag");
  assertEquals(context(svc).hovering, false, "the press itself is not a hover");
});

Deno.test("Given idle / When the thumb is pressed / Then the machine drags", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "THUMB.POINTER_DOWN", orientation: "horizontal", point: { x: 4, y: 4 } });
  assertEquals(state(svc), "dragging", "a press on the thumb starts the drag");
});

Deno.test("Given a drag / When the pointer moves / Then the dragged axis is scrolling", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "THUMB.POINTER_DOWN", orientation: "vertical", point: { x: 4, y: 4 } });
  svc.send({ type: "THUMB.POINTER_MOVE", orientation: "vertical", point: { x: 4, y: 40 } });
  assertEquals(context(svc).scrollingY, true, "the drag's own motion scrolls the axis");
  assertEquals(state(svc), "dragging", "and the drag continues");
});

Deno.test("Given a drag / When it moves again / Then the other axis is still settled", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "THUMB.POINTER_DOWN", orientation: "horizontal", point: { x: 4, y: 4 } });
  svc.send({ type: "THUMB.POINTER_MOVE", orientation: "horizontal", point: { x: 60, y: 4 } });
  assertEquals(context(svc).scrollingX, true, "a horizontal drag scrolls horizontally");
  assertEquals(context(svc).scrollingY, false, "and never vertically");
});

Deno.test("Given a drag that ends on the thumb / When it lifts / Then idle returns and the axis settles", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "THUMB.POINTER_DOWN", orientation: "vertical", point: { x: 4, y: 4 } });
  svc.send({ type: "THUMB.POINTER_MOVE", orientation: "vertical", point: { x: 4, y: 40 } });
  svc.send({ type: "THUMB.POINTER_UP", orientation: "vertical" });
  assertEquals(state(svc), "idle", "the lift ends the drag");
  assertEquals(context(svc).scrollingY, false, "and the axis stops scrolling with it");
});

Deno.test("Given a drag that ends on the track / When it lifts / Then idle returns and the dwell still runs", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "THUMB.POINTER_DOWN", orientation: "vertical", point: { x: 4, y: 4 } });
  svc.send({ type: "THUMB.POINTER_MOVE", orientation: "vertical", point: { x: 4, y: 40 } });
  svc.send({ type: "SCROLLBAR.POINTER_UP" });
  assertEquals(state(svc), "idle", "the track's own lift ends the drag");
  assertEquals(context(svc).scrollingY, true, "and the scalar stays for the dwell to clear");
  svc.send({ type: "SCROLL.SETTLE", orientation: "vertical" });
  assertEquals(context(svc).scrollingY, false, "the dwell clears it afterwards");
});

Deno.test("Given a drag / When the viewport scrolls underneath it / Then the drag still reads", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "THUMB.POINTER_DOWN", orientation: "vertical", point: { x: 4, y: 4 } });
  svc.send({ type: "VIEWPORT.SCROLL", position: { x: 0, y: 40 }, ...OVERFLOW_SCROLLED });
  assertEquals(state(svc), "dragging", "a scroll does not end the drag");
  assertEquals(context(svc).scrollingY, true, "and it marks the axis scrolling");
});

Deno.test("Given a settled scroll area / When a measurement arrives while dragging / Then the drag holds", () => {
  const svc = scrollArea(OVERFLOW_BOTH);
  svc.send({ type: "THUMB.POINTER_DOWN", orientation: "vertical", point: { x: 4, y: 4 } });
  svc.send({ type: "THUMB.MEASURE", ...OVERFLOW_Y });
  assertEquals(state(svc), "dragging", "a re-measure does not end the drag");
  assertEquals(context(svc).hiddenState.scrollbarXHidden, true, "and the new reading is held");
});

// ---- the element contract --------------------------------------------------
//
// The machine's state is derived from layout, which the view measures: the
// unit tests above hand it the readings. What follows is the element's DOM
// contract through the bridge, in an element with no layout to read — the same
// parts, ids and reflexes a browser finds, minus the boxes.

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

/** Props are signals, exactly as the element's prop store makes them. */
function mount(
  id: string,
  overrides: Readonly<Record<string, unknown>> = {},
): { api: ScrollAreaFsmApi; write(name: string, value: unknown): void } {
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  for (const [name, value] of Object.entries(overrides)) {
    const signal = ((): unknown => value) as WriteSignal;
    values[name] = signal;
  }
  return {
    api: createScrollAreaFsmBridge(
      () => {
        const record: Record<string, unknown> = {};
        for (const [name, source] of Object.entries(values)) record[name] = source();
        record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
        return record;
      },
      () => document.body,
      id,
    ).api,
    write: (name: string, value: unknown): void => {
      const source = values[name];
      if (source === undefined) return;
      (source as unknown as (value: unknown) => void)(value);
    },
  };
}

/** A handler read out of a bag's entry, which is data. */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/** A pointer event, as the gestures read one. */
const pointerEvent = (init: Readonly<Record<string, unknown>>): PointerEvent =>
  init as unknown as PointerEvent;

Deno.test("Given a fresh scroll area / When it renders / Then the six parts carry the contract", () => {
  const { api } = mount("area");
  assertEquals(api.getRootProps()["id"], "scroll-area:area", "the root is namespaced by the element's id");
  assertEquals(api.getRootProps()["role"], "presentation", "the root is presentational");
  assertEquals(api.getViewportProps()["id"], "scroll-area:area:viewport", "the viewport part is addressable");
  assertEquals(api.getViewportProps()["role"], "presentation", "and presentational");
  assertEquals(api.getViewportProps()["data-ownedby"], "scroll-area:area", "the parts name their owner");
  assertEquals(api.getContentProps()["id"], "scroll-area:area:content", "the content part is addressable");
  assertEquals(api.getScrollbarProps()["id"], "scroll-area:area:scrollbar-y", "the vertical bar is addressable");
  assertEquals(api.getThumbProps()["id"], "scroll-area:area:thumb-y", "and its thumb");
  assertEquals(
    api.getScrollbarProps({ orientation: "horizontal" })["id"],
    "scroll-area:area:scrollbar-x",
    "the horizontal bar is addressable",
  );
  assertEquals(api.getThumbProps({ orientation: "horizontal" })["id"], "scroll-area:area:thumb-x", "and its thumb");
  assertEquals(api.getCornerProps()["id"], "scroll-area:area:corner", "the corner is addressable");
  assertEquals(api.getScrollbarProps()["data-orientation"], "vertical", "the bar names its axis");
  assertEquals(api.getThumbProps({ orientation: "horizontal" })["data-orientation"], "horizontal", "and so does the thumb");
});

Deno.test("Given a scroll area with no layout / When it renders / Then neither bar is painted", () => {
  const { api } = mount("quiet");
  assertEquals(api.hasOverflowY, false, "nothing overflows");
  assertEquals(api.hasOverflowX, false, "on either axis");
  assertEquals(api.getScrollbarProps()["hidden"], true, "the vertical bar is not there");
  assertEquals(
    api.getScrollbarProps({ orientation: "horizontal" })["hidden"],
    true,
    "and neither is the horizontal one",
  );
  assertEquals(api.getViewportProps()["data-overflow-y"], undefined, "no overflow is reported");
  assertEquals(api.getViewportProps()["tabIndex"], undefined, "a box with nothing to scroll is no tab stop");
  assertEquals(api.getCornerProps()["data-state"], "hidden", "the corner is hidden");
});

Deno.test("Given the geometry channel / When it renders / Then the sizes travel as custom properties", () => {
  const { api } = mount("geometry");
  const root = api.getRootProps()["style"] as Record<string, string>;
  assertEquals(root["--scroll-area-thumb-width"], "0px", "the root carries the measured thumb width");
  assertEquals(root["--scroll-area-thumb-height"], "0px", "and its height");
  assertEquals(root["--scroll-area-corner-width"], "0px", "and the corner's width");
  const thumb = api.getThumbProps()["style"] as Record<string, string>;
  assertEquals(thumb["--scroll-area-thumb-y"], "0px", "the vertical thumb carries its own inset");
  const horizontal = api.getThumbProps({ orientation: "horizontal" })["style"] as Record<string, string>;
  assertEquals(horizontal["--scroll-area-thumb-x"], "0px", "the horizontal thumb carries its own inset");
  const viewport = api.getViewportProps()["style"] as Record<string, string>;
  assertEquals(viewport["--scroll-area-overflow-y-start"], "0px", "the viewport carries the overflow distances");
});

Deno.test("Given a fresh scroll area / When the pointer enters the root / Then the bars light up", () => {
  const { api } = mount("pointer");
  const root = document.createElement("div");
  document.body.appendChild(root);
  assertEquals(api.getScrollbarProps()["data-hover"], undefined, "the bar starts unlit");
  handler<() => void>(api.getRootProps(), "onPointerEnter")();
  assertEquals(api.getScrollbarProps()["data-hover"], "", "the bar reports the hover");
  assertEquals(api.getThumbProps()["data-hover"], "", "and so does the thumb");
  assertEquals(api.getCornerProps()["data-hover"], "", "and the corner");
  handler<(event: PointerEvent) => void>(api.getRootProps(), "onPointerLeave")(
    pointerEvent({ relatedTarget: null, currentTarget: root }),
  );
  assertEquals(api.getScrollbarProps()["data-hover"], undefined, "leaving puts them out");
});

Deno.test("Given a leave to a child / When it is reported / Then the bars stay lit", () => {
  const { api } = mount("inside");
  const root = document.createElement("div");
  const child = document.createElement("div");
  root.appendChild(child);
  document.body.appendChild(root);
  handler<() => void>(api.getRootProps(), "onPointerEnter")();
  handler<(event: PointerEvent) => void>(api.getRootProps(), "onPointerLeave")(
    pointerEvent({ relatedTarget: child, currentTarget: root }),
  );
  assertEquals(api.getScrollbarProps()["data-hover"], "", "moving into the root is not leaving it");
});

Deno.test("Given an idle scroll area / When the thumb is pressed / Then the bars report the drag", () => {
  const { api } = mount("drag");
  handler<(event: PointerEvent) => void>(api.getThumbProps(), "onPointerDown")(
    pointerEvent({ button: 0, clientX: 10, clientY: 20 }),
  );
  assertEquals(api.getScrollbarState().dragging, true, "the scrollbar state reports the drag");
  assertEquals(api.getScrollbarProps()["data-dragging"], "", "the bar carries the drag");
  assertEquals(api.getThumbProps()["data-dragging"], "", "and so does the thumb");
  handler<() => void>(api.getScrollbarProps(), "onPointerUp")();
  assertEquals(api.getScrollbarState().dragging, false, "the track's lift ends it");
  assertEquals(api.getScrollbarProps()["data-dragging"], undefined, "and the bar follows");
});

Deno.test("Given a released drag / When the document reports the lift / Then the dwell still owns the axis", () => {
  const { api } = mount("lift");
  handler<(event: PointerEvent) => void>(api.getThumbProps(), "onPointerDown")(
    pointerEvent({ button: 0, clientX: 10, clientY: 20 }),
  );
  const dwell = api.getScrollbarProps()["use:autoplay"] as Record<string, unknown>;
  assertEquals(dwell["interval"], 1000, "the bar's dwell is Zag's scroll timeout");
  assertEquals(dwell["enabled"], false, "an axis that never moved is not scrolling");
  const onTick = dwell["onTick"] as () => void;
  onTick();
  assertEquals(api.getScrollbarState().scrolling, false, "the settle reports what the machine already holds");
  assertEquals(api.getScrollbarState().dragging, true, "the machine is still dragging");
});

Deno.test("Given two scroll areas on a page / When one is pressed / Then the other is untouched", () => {
  const first = mount("first");
  const second = mount("second");
  handler<() => void>(first.api.getRootProps(), "onPointerEnter")();
  handler<(event: PointerEvent) => void>(first.api.getThumbProps(), "onPointerDown")(
    pointerEvent({ button: 0, clientX: 4, clientY: 4 }),
  );
  assertEquals(first.api.getScrollbarState().dragging, true, "the pressed one drags");
  assertEquals(second.api.getScrollbarState().dragging, false, "the other does not");
  assertEquals(second.api.getScrollbarProps()["data-hover"], undefined, "and the pointer never reached it");
  assertEquals(second.api.getRootProps()["id"], "scroll-area:second", "each keeps its own id scheme");
});

Deno.test("Given an authored direction / When it renders / Then the parts answer in that direction", () => {
  const { api } = mount("rtl", { dir: "rtl" });
  assertEquals(api.getRootProps()["dir"], "rtl", "the root is right-to-left");
  assertEquals(api.getViewportProps()["dir"], "rtl", "and so is the viewport");
  assertEquals(api.getScrollbarProps({ orientation: "horizontal" })["dir"], "rtl", "the horizontal bar is too");
});
