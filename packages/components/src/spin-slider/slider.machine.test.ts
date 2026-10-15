import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createSliderBridge } from "./slider.bridge.ts";
import type { SliderApi } from "./slider.connect.ts";
import type {
  SliderFocusChange,
  SliderValueChange,
  SliderValueChangeEnd,
} from "./slider.machine.ts";

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
 * handler reads. The track rect is faked on the event's own node: a 400px
 * track starting at x=10, so clientX maps linearly to 0..100.
 */
function trackNode(): Element {
  return {
    getBoundingClientRect: () => ({ left: 10, right: 410, width: 400, top: 0, bottom: 20, height: 20 }),
  } as unknown as Element;
}

const press = (clientX: number): PointerEvent =>
  ({
    pointerType: "mouse",
    button: 0,
    pointerId: 1,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    clientX,
    clientY: 10,
    currentTarget: trackNode(),
    target: trackNode(),
    preventDefault: (): void => {},
    stopPropagation: (): void => {},
  }) as unknown as PointerEvent;

const drag = (clientX: number): PointerEvent =>
  ({
    pointerType: "mouse",
    pointerId: 1,
    clientX,
    clientY: 10,
    currentTarget: trackNode(),
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
  made["stopPropagation"] = (): void => {};
  return made as unknown as KeyboardEvent;
}

interface Harness {
  readonly api: SliderApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: SliderValueChange[];
    readonly valueChangeEnd: SliderValueChangeEnd[];
    readonly focusChange: SliderFocusChange[];
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
    valueChange: [] as SliderValueChange[],
    valueChangeEnd: [] as SliderValueChangeEnd[],
    focusChange: [] as SliderFocusChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onValueChange", (details: SliderValueChange) => events.valueChange.push(details));
  write("onValueChangeEnd", (details: SliderValueChangeEnd) => events.valueChangeEnd.push(details));
  write("onFocusChange", (details: SliderFocusChange) => events.focusChange.push(details));
  // The control handler measures against the live track node; linkedom
  // cannot serve getElementById for this tree, so the track rect is pinned
  // here under the id the connect reads.
  const realDocument = globalThis.document as Document;
  const holder = realDocument.createElement("div");
  holder.id = "slider:volume:track";
  const rect = { left: 10, right: 410, width: 400, top: 0, bottom: 20, height: 20 };
  holder.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  realDocument.body.appendChild(holder);
  const bridge = createSliderBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "volume",
  );
  return { api: bridge.api, root, events, write };
}

function thumb(api: SliderApi, index: number): Record<string, unknown> {
  return api.getThumbProps({ index }) as Record<string, unknown>;
}

Deno.test("a track press jumps the thumb and the release commits", () => {
  const { api, events } = mount();
  assertEquals(api.value, [0]);
  handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown")(press(210));
  // x=210 on a 10..410 track: 50% -> 50.
  assertEquals(api.value, [50]);
  assert(api.dragging);
  handler<(e: PointerEvent) => void>(thumb(api, 0), "onPointermove")(drag(310));
  assertEquals(api.value, [75]);
  handler<() => void>(thumb(api, 0), "onPointerup")();
  assert(!api.dragging);
  assert(api.focused);
  assertEquals(events.valueChangeEnd.length, 1);
  assertEquals(events.valueChangeEnd[0]?.value, [75]);
});

Deno.test("arrows step the focused thumb and Home/End jump", () => {
  const { api } = mount();
  handler<() => void>(thumb(api, 0), "onFocus")();
  handler<(e: KeyboardEvent) => void>(thumb(api, 0), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.value, [1]);
  handler<(e: KeyboardEvent) => void>(thumb(api, 0), "onKeydown")(keydown("End"));
  assertEquals(api.value, [100]);
  handler<(e: KeyboardEvent) => void>(thumb(api, 0), "onKeydown")(keydown("Home"));
  assertEquals(api.value, [0]);
});

Deno.test("arrows refuse without focus", () => {
  const { api, events } = mount();
  handler<(e: KeyboardEvent) => void>(thumb(api, 0), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.value, [0]);
  assertEquals(events.valueChange.length, 0);
});

Deno.test("a disabled slider refuses presses and keys", () => {
  const { api, events } = mount({ disabled: true });
  handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown")(press(210));
  assertEquals(api.value, [0]);
  handler<(e: KeyboardEvent) => void>(thumb(api, 0), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.value, [0]);
  assertEquals(events.valueChange.length, 0);
});

Deno.test("setValue constrains to the step grid", () => {
  const { api } = mount();
  api.setValue([33.7]);
  // Step 1: snaps to 34.
  assertEquals(api.value, [34]);
});

Deno.test("range thumbs keep their order and collide by clamping", () => {
  const { api } = mount({ defaultValue: "[20, 80]" });
  assertEquals(api.value, [20, 80]);
  // "none" still clamps to the neighbor's window: thumb 0 cannot pass 80.
  api.setThumbValue(0, 90);
  assertEquals(api.value, [80, 80]);
  api.setThumbValue(1, 10);
  assertEquals(api.value, [80, 80]);
});

Deno.test("authored value seeds the slider and a host write moves it", () => {
  const { api, events, write } = mount({ value: [30] });
  assertEquals(api.value, [30]);
  assertEquals(events.valueChange.length, 0);
  write("value", [60]);
  assertEquals(api.value, [60]);
  assertEquals(events.valueChange.length, 1);
});

Deno.test("increment and decrement commands step the thumb", () => {
  const { api } = mount({ defaultValue: "[10]" });
  api.increment(0);
  assertEquals(api.value, [11]);
  api.decrement(0);
  api.decrement(0);
  assertEquals(api.value, [9]);
});

Deno.test("thumb percents feed the geometry channel", () => {
  const { api } = mount({ defaultValue: "[25]" });
  assertEquals(api.getThumbPercent(0), 25);
  const bag = thumb(api, 0);
  const style = bag["style"] as Record<string, unknown>;
  assertEquals(style["--slider-thumb"], "25%");
});
