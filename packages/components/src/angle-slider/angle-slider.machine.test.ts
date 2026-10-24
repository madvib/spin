import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import type { DragDelta, DragPress } from "@spin/runtime/actions";
import { angleSlider } from "./angle-slider.presentation.ts";
const createAngleSliderBridge = angleSlider.createBridge;
import type { AngleSliderValueChangeEnd } from "./angle-slider.presentation.ts";
import type { AngleSliderApi } from "./angle-slider.presentation.ts";
import {
  type AngleSliderValueChange,
  constrainAngle,
  pointAngle,
} from "./angle-slider.machine.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one is
 * checked here and typed once, instead of an unchecked cast at every call site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/**
 * The control is a 200px dial starting at (10,10): center (110,110), so
 * clientX/clientY map to dial angles around it. The stub is what a press
 * lands on — the dial itself, not the thumb.
 */
function controlNode(): Element {
  return {
    getBoundingClientRect: () => ({
      left: 10,
      right: 210,
      width: 200,
      top: 10,
      bottom: 210,
      height: 200,
    }),
  } as unknown as Element;
}

/** The gesture's press: the point, the pointer, and what it landed on. */
const press = (clientX: number, clientY: number): DragPress => ({
  altKey: false,
  shiftKey: false,
  x: clientX,
  y: clientY,
  pointerId: 1,
  pressure: 0.5,
  target: controlNode(),
  rect: null,
  direction: "ltr",
});

/** The gesture's move: where the pointer is, and the delta from the press. */
const move = (
  clientX: number,
  clientY: number,
  fromX: number,
  fromY: number,
): DragDelta => ({
  ...press(clientX, clientY),
  dx: clientX - fromX,
  dy: clientY - fromY,
});

/**
 * The drag param the control's bag carries. The runtime arms the gesture
 * only while the param is enabled, so the press helper honors that.
 */
const dragParam = (bag: Record<string, unknown>): {
  enabled?: boolean;
  onStart?: (p: DragPress) => void;
  onMove?: (d: DragDelta) => void;
  onEnd?: (e: { readonly cancelled: boolean }) => void;
} => (bag["use:drag"] ?? {}) as never;

/** A press on the control: the gesture arms only while it is enabled. */
const pressControl = (bag: Record<string, unknown>, at: DragPress): void => {
  const param = dragParam(bag);
  if (param.enabled === false) return;
  param.onStart?.(at);
};

function keydown(key: string, shift = false): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: shift,
    isComposing: false,
    keyCode: 0,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

interface Harness {
  readonly api: AngleSliderApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: AngleSliderValueChange[];
    readonly valueChangeEnd: AngleSliderValueChangeEnd[];
  };
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    valueChange: [] as AngleSliderValueChange[],
    valueChangeEnd: [] as AngleSliderValueChangeEnd[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write(
    "onValueChange",
    (details: AngleSliderValueChange) => events.valueChange.push(details),
  );
  write(
    "onValueChangeEnd",
    (details: AngleSliderValueChangeEnd) => events.valueChangeEnd.push(details),
  );
  // The control handler measures against the live control node; linkedom
  // cannot serve getElementById for this tree, so the dial rect is pinned
  // here under the id the connect reads.
  const realDocument = globalThis.document as Document;
  const holder = realDocument.createElement("div");
  holder.id = "angle-slider:dial:control";
  const rect = {
    left: 10,
    right: 210,
    width: 200,
    top: 10,
    bottom: 210,
    height: 200,
  };
  holder.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  realDocument.body.appendChild(holder);
  const bridge = createAngleSliderBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "dial",
  );
  return { api: bridge.api, root, events, write };
}

test("polar math: top is 0, right is 90, bottom is 180", () => {
  // Center (110,110): straight up, right, down.
  deepStrictEqual(Math.round(pointAngle(110, 110, 110, 10)), 0);
  deepStrictEqual(Math.round(pointAngle(110, 110, 210, 110)), 90);
  deepStrictEqual(Math.round(pointAngle(110, 110, 110, 210)), 180);
});

test("a dial press jumps the value and the release commits", () => {
  const { api, events } = mount();
  deepStrictEqual(api.value, 0);
  // Right of center: ~90 degrees.
  pressControl(api.getControlProps(), press(210, 110));
  deepStrictEqual(api.value, 90);
  assert(api.dragging);
  // Bottom of center: ~180.
  dragParam(api.getControlProps()).onMove?.(move(110, 210, 210, 110));
  deepStrictEqual(api.value, 180);
  dragParam(api.getControlProps()).onEnd?.({ cancelled: false });
  assert(!api.dragging);
  deepStrictEqual(events.valueChangeEnd.length, 1);
  deepStrictEqual(events.valueChangeEnd[0]?.value, 180);
});

test("arrows step the focused thumb and Home/End jump", () => {
  const { api } = mount();
  handler<() => void>(api.getThumbProps(), "onFocus")();
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(
    keydown("ArrowRight"),
  );
  deepStrictEqual(api.value, 1);
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(
    keydown("End"),
  );
  deepStrictEqual(api.value, 359);
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(
    keydown("Home"),
  );
  deepStrictEqual(api.value, 0);
});

test("arrows refuse without focus", () => {
  const { api, events } = mount();
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(
    keydown("ArrowRight"),
  );
  deepStrictEqual(api.value, 0);
  deepStrictEqual(events.valueChange.length, 0);
});

test("a disabled dial refuses presses and keys", () => {
  const { api, events } = mount({ disabled: true });
  deepStrictEqual(dragParam(api.getControlProps()).enabled, false);
  pressControl(api.getControlProps(), press(210, 110));
  deepStrictEqual(api.value, 0);
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(
    keydown("ArrowRight"),
  );
  deepStrictEqual(api.value, 0);
  deepStrictEqual(events.valueChange.length, 0);
});

test("setValue clamps to the dial", () => {
  const { api } = mount();
  api.setValue(400);
  deepStrictEqual(api.value, 359);
  api.setValue(-10);
  deepStrictEqual(api.value, 0);
});

test("authored value seeds the dial and a host write moves it", () => {
  const { api, events, write } = mount({ value: 45 });
  deepStrictEqual(api.value, 45);
  deepStrictEqual(events.valueChange.length, 0);
  write("value", 135);
  deepStrictEqual(api.value, 135);
  deepStrictEqual(events.valueChange.length, 1);
});

test("constrainAngle wraps the top of the dial", () => {
  deepStrictEqual(constrainAngle(359, 1), 0);
  // The snap goes UP to the grid, not to the nearest.
  deepStrictEqual(constrainAngle(90.4, 1), 91);
});
