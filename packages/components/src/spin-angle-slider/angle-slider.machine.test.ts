import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { angleSlider } from "./angle-slider.def.ts";
const createAngleSliderBridge = angleSlider.createBridge;
import type { AngleSliderValueChangeEnd } from "./angle-slider.def.ts";
import type { AngleSliderApi } from "./angle-slider.def.ts";
import {
  constrainAngle,
  pointAngle,
  type AngleSliderValueChange,
} from "./angle-slider.machine.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
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
 * linkedom ships no PointerEvent constructors, so the events the handlers
 * need are synthesized here — one place, with the minimal field set each
 * handler reads. The control is a 200px dial starting at (10,10): center
 * (110,110), so clientX/clientY map to dial angles around it.
 */
function controlNode(): Element {
  return {
    getBoundingClientRect: () => ({ left: 10, right: 210, width: 200, top: 10, bottom: 210, height: 200 }),
  } as unknown as Element;
}

const press = (clientX: number, clientY: number): PointerEvent =>
  ({
    pointerType: "mouse",
    button: 0,
    pointerId: 1,
    clientX,
    clientY,
    currentTarget: {
      focus: (_options?: FocusOptions): void => {},
      setPointerCapture: (_id: number): void => {},
    },
    target: controlNode(),
    preventDefault: (): void => {},
    stopPropagation: (): void => {},
  }) as unknown as PointerEvent;

const drag = (clientX: number, clientY: number): PointerEvent =>
  ({
    pointerType: "mouse",
    pointerId: 1,
    clientX,
    clientY,
    currentTarget: controlNode(),
    preventDefault: (): void => {},
  }) as unknown as PointerEvent;

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
  write("onValueChange", (details: AngleSliderValueChange) => events.valueChange.push(details));
  write("onValueChangeEnd", (details: AngleSliderValueChangeEnd) => events.valueChangeEnd.push(details));
  // The control handler measures against the live control node; linkedom
  // cannot serve getElementById for this tree, so the dial rect is pinned
  // here under the id the connect reads.
  const realDocument = globalThis.document as Document;
  const holder = realDocument.createElement("div");
  holder.id = "angle-slider:dial:control";
  const rect = { left: 10, right: 210, width: 200, top: 10, bottom: 210, height: 200 };
  holder.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  realDocument.body.appendChild(holder);
  const bridge = createAngleSliderBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "dial",
  );
  return { api: bridge.api, root, events, write };
}

Deno.test("polar math: top is 0, right is 90, bottom is 180", () => {
  // Center (110,110): straight up, right, down.
  assertEquals(Math.round(pointAngle(110, 110, 110, 10)), 0);
  assertEquals(Math.round(pointAngle(110, 110, 210, 110)), 90);
  assertEquals(Math.round(pointAngle(110, 110, 110, 210)), 180);
});

Deno.test("a dial press jumps the value and the release commits", () => {
  const { api, events } = mount();
  assertEquals(api.value, 0);
  // Right of center: ~90 degrees.
  handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown")(press(210, 110));
  assertEquals(api.value, 90);
  assert(api.dragging);
  // Bottom of center: ~180.
  handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointermove")(drag(110, 210));
  assertEquals(api.value, 180);
  handler<() => void>(api.getControlProps(), "onPointerup")();
  assert(!api.dragging);
  assertEquals(events.valueChangeEnd.length, 1);
  assertEquals(events.valueChangeEnd[0]?.value, 180);
});

Deno.test("arrows step the focused thumb and Home/End jump", () => {
  const { api } = mount();
  handler<() => void>(api.getThumbProps(), "onFocus")();
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.value, 1);
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(keydown("End"));
  assertEquals(api.value, 359);
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(keydown("Home"));
  assertEquals(api.value, 0);
});

Deno.test("arrows refuse without focus", () => {
  const { api, events } = mount();
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.value, 0);
  assertEquals(events.valueChange.length, 0);
});

Deno.test("a disabled dial refuses presses and keys", () => {
  const { api, events } = mount({ disabled: true });
  handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown")(press(210, 110));
  assertEquals(api.value, 0);
  handler<(e: KeyboardEvent) => void>(api.getThumbProps(), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.value, 0);
  assertEquals(events.valueChange.length, 0);
});

Deno.test("setValue clamps to the dial", () => {
  const { api } = mount();
  api.setValue(400);
  assertEquals(api.value, 359);
  api.setValue(-10);
  assertEquals(api.value, 0);
});

Deno.test("authored value seeds the dial and a host write moves it", () => {
  const { api, events, write } = mount({ value: 45 });
  assertEquals(api.value, 45);
  assertEquals(events.valueChange.length, 0);
  write("value", 135);
  assertEquals(api.value, 135);
  assertEquals(events.valueChange.length, 1);
});

Deno.test("constrainAngle wraps the top of the dial", () => {
  assertEquals(constrainAngle(359, 1), 0);
  // Zag snaps UP to the grid, not nearest.
  assertEquals(constrainAngle(90.4, 1), 91);
});
