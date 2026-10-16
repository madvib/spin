import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { signaturePad } from "./signature-pad.def.ts";
const createSignaturePadBridge = signaturePad.createBridge;
import type { SignaturePadApi } from "./signature-pad.def.ts";
import type { SignaturePadDrawDetails } from "./signature-pad.machine.ts";

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
 * handler reads. The control rect is faked on the event's own node, because
 * the handler reads `document.getElementById`, which linkedom cannot serve:
 * the test mounts the control id holder directly.
 */
function controlNode(): Element {
  return {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 200 }),
    setPointerCapture: (_id: number): void => {},
  } as unknown as Element;
}

const press = (x: number, y: number): PointerEvent =>
  ({
    pointerType: "mouse",
    button: 0,
    pointerId: 1,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    clientX: x,
    clientY: y,
    pressure: 0.5,
    currentTarget: controlNode(),
    target: controlNode(),
    preventDefault: (): void => {},
    stopPropagation: (): void => {},
  }) as unknown as PointerEvent;

const drag = (x: number, y: number): PointerEvent =>
  ({
    pointerType: "mouse",
    pointerId: 1,
    clientX: x,
    clientY: y,
    pressure: 0.5,
    currentTarget: controlNode(),
    preventDefault: (): void => {},
  }) as unknown as PointerEvent;

interface Harness {
  readonly api: SignaturePadApi;
  readonly root: Element;
  readonly events: {
    readonly draw: SignaturePadDrawDetails[];
    readonly drawEnd: SignaturePadDrawDetails[];
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
    draw: [] as SignaturePadDrawDetails[],
    drawEnd: [] as SignaturePadDrawDetails[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onDraw", (details: SignaturePadDrawDetails) => events.draw.push(details));
  write("onDrawEnd", (details: SignaturePadDrawDetails) => events.drawEnd.push(details));
  const realDocument = globalThis.document as Document;
  const bridge = createSignaturePadBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "pad",
  );
  // The control handler measures against the live node; linkedom cannot
  // serve getElementById for this tree, so the control rect is pinned here.
  const holder = realDocument.createElement("div");
  holder.id = "signature-pad:pad:control";
  const rect = { left: 10, top: 20, width: 400, height: 200 };
  holder.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  realDocument.body.appendChild(holder);
  return { api: bridge.api, root, events, write };
}

function stroke(api: SignaturePadApi): void {
  const down = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown");
  const moveHandler = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointermove");
  const up = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerup");
  down(press(20, 30));
  moveHandler(drag(40, 50));
  moveHandler(drag(60, 70));
  up(drag(60, 70));
}

Deno.test("a press starts a stroke and the release commits one path", () => {
  const { api, events } = mount();
  assert(api.empty);
  stroke(api);
  assert(!api.empty);
  assertEquals(api.paths.length, 1);
  // draw fired on down + two moves + up; draw-end only on the release.
  assertEquals(events.draw.length, 4);
  assertEquals(events.drawEnd.length, 1);
  assertEquals(events.drawEnd[0]?.paths.length, 1);
});

Deno.test("moves with no active stroke are refused", () => {
  const { api, events } = mount();
  const moveHandler = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointermove");
  moveHandler(drag(40, 50));
  assert(api.empty);
  assertEquals(events.draw.length, 0);
});

Deno.test("a disabled pad refuses the press", () => {
  const { api, events } = mount({ disabled: true });
  const down = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown");
  down(press(20, 30));
  assert(api.empty);
  assertEquals(events.draw.length, 0);
});

Deno.test("a read-only pad refuses the press", () => {
  const { api, events } = mount({ readOnly: true });
  const down = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown");
  down(press(20, 30));
  assert(api.empty);
  assertEquals(events.draw.length, 0);
});

Deno.test("clear empties the committed paths and reports draw-end", () => {
  const { api, events } = mount();
  stroke(api);
  assertEquals(api.paths.length, 1);
  api.clear();
  assert(api.empty);
  assertEquals(api.paths.length, 0);
  assertEquals(events.drawEnd.length, 2);
  assertEquals(events.drawEnd[1]?.paths.length, 0);
});

Deno.test("authored paths seed the pad and a host write replaces them", () => {
  const { api, events, write } = mount({ paths: ["M0,0 L10,10"] });
  assert(!api.empty);
  assertEquals(api.paths, ["M0,0 L10,10"]);
  assertEquals(events.drawEnd.length, 0);
  write("paths", ["M5,5 L6,6"]);
  assertEquals(api.paths, ["M5,5 L6,6"]);
});

Deno.test("defaultPaths seed an uncontrolled pad", () => {
  const { api } = mount({ defaultPaths: ["M1,1 L2,2", "M3,3 L4,4"] });
  assertEquals(api.paths, ["M1,1 L2,2", "M3,3 L4,4"]);
});

Deno.test("the in-progress stroke is visible while drawing", () => {
  const { api } = mount();
  const down = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown");
  down(press(20, 30));
  assert(api.drawing);
  assertEquals(api.paths.length, 0);
  const up = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerup");
  up(drag(20, 30));
  assert(!api.drawing);
  assertEquals(api.paths.length, 1);
});

Deno.test("a press on the clear trigger never starts a stroke", () => {
  const { api, events } = mount();
  stroke(api);
  const count = events.draw.length;
  const clearProps = api.getClearTriggerProps("Clear signature");
  const click = handler<() => void>(clearProps, "onClick");
  // A trigger press bubbles to the control: simulate the guard by pressing
  // from a node nested in the trigger.
  const trigger = {
    closest: (selector: string): unknown => selector === "[data-part=clear-trigger]" ? {} : null,
  };
  const down = handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointerdown");
  const nested = {
    ...press(390, 12),
    target: trigger,
  } as unknown as PointerEvent;
  down(nested);
  assertEquals(events.draw.length, count);
  click();
  assert(api.empty);
});
