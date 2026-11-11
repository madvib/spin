import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { signal } from "@spinjs/components/runtime";
import type { DragDelta, DragPress } from "@spinjs/components/actions";
import { signaturePad } from "./signature-pad.presentation.ts";
const createSignaturePadBridge = signaturePad.createBridge;
import type { SignaturePadApi } from "./signature-pad.presentation.ts";
import type { SignaturePadDrawDetails } from "./signature-pad.machine.ts";

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
 * linkedom ships no PointerEvent constructors, so the gesture the handlers
 * need is synthesized here — one place, with the minimal field set each
 * handler reads. The node a press lands on carries the control's box, and
 * the handler measures the control through the scope's own measurer.
 */
function controlNode(): Element {
  return {
    getBoundingClientRect: () => ({
      left: 10,
      top: 20,
      width: 400,
      height: 200,
    }),
  } as unknown as Element;
}

/** The control's box: the drag action reports the handle's box. */
const controlBox = (): DOMRect =>
  ({ left: 10, top: 20, width: 400, height: 200 }) as DOMRect;

/** The gesture's press: the point, the pointer, and what it landed on. */
const press = (x: number, y: number): DragPress => ({
  altKey: false,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  x,
  y,
  pointerId: 1,
  pressure: 0.5,
  target: controlNode(),
  rect: controlBox(),
  direction: "ltr",
});

/** The gesture's move: where the pointer is, and the delta from the press. */
const move = (
  x: number,
  y: number,
  fromX: number,
  fromY: number,
): DragDelta => ({
  ...press(x, y),
  dx: x - fromX,
  dy: y - fromY,
});

/**
 * The drag param the control's bag carries. The runtime arms the gesture
 * only while the param is enabled, so the press helper honors that.
 */
const dragParam = (bag: Record<string, unknown>): {
  enabled?: boolean;
  onStart?: (press: DragPress) => void;
  onMove?: (delta: DragDelta) => void;
  onEnd?: (end: { readonly cancelled: boolean }) => void;
} => (bag["use:drag"] ?? {}) as never;

/** A press on the control: the gesture arms only while it is enabled. */
const pressControl = (bag: Record<string, unknown>, at: DragPress): void => {
  const param = dragParam(bag);
  if (param.enabled === false) return;
  param.onStart?.(at);
};

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
  write(
    "onDraw",
    (details: SignaturePadDrawDetails) => events.draw.push(details),
  );
  write(
    "onDrawEnd",
    (details: SignaturePadDrawDetails) => events.drawEnd.push(details),
  );
  const realDocument = globalThis.document as Document;
  const bridge = createSignaturePadBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
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
  const control = api.getControlProps();
  pressControl(control, press(20, 30));
  dragParam(control).onMove?.(move(40, 50, 20, 30));
  dragParam(control).onMove?.(move(60, 70, 20, 30));
  dragParam(control).onEnd?.({ cancelled: false });
}

test("a press starts a stroke and the release commits one path", () => {
  const { api, events } = mount();
  assert(api.empty);
  stroke(api);
  assert(!api.empty);
  deepStrictEqual(api.paths.length, 1);
  // draw fired on down + two moves + up; draw-end only on the release.
  deepStrictEqual(events.draw.length, 4);
  deepStrictEqual(events.drawEnd.length, 1);
  deepStrictEqual(events.drawEnd[0]?.paths.length, 1);
});

test("getDataUrl exports the committed strokes as an SVG document", async () => {
  const { api } = mount();
  stroke(api);
  const url = await api.getDataUrl();
  assert(
    url.startsWith("data:image/svg+xml,"),
    "getDataUrl must return an SVG data URL",
  );
  const svg = decodeURIComponent(url.slice("data:image/svg+xml,".length));
  assert(
    svg.includes("<path") && svg.includes(api.paths[0] ?? "§"),
    "the exported SVG must carry the committed path data",
  );
});

test("getDataUrl on an empty pad exports an empty SVG document", async () => {
  const { api } = mount();
  const url = await api.getDataUrl();
  assert(
    url.startsWith("data:image/svg+xml,"),
    "an empty pad still exports a readable SVG document",
  );
  assert(
    !decodeURIComponent(url.slice("data:image/svg+xml,".length)).includes("<path"),
    "an empty pad exports no path elements",
  );
});

test("moves with no active stroke are refused", () => {
  const { api, events } = mount();
  dragParam(api.getControlProps()).onMove?.(move(40, 50, 20, 30));
  assert(api.empty);
  deepStrictEqual(events.draw.length, 0);
});

test("a disabled pad refuses the press", () => {
  const { api, events } = mount({ disabled: true });
  const control = api.getControlProps();
  deepStrictEqual(dragParam(control).enabled, false, "the gesture never arms");
  pressControl(control, press(20, 30));
  assert(api.empty);
  deepStrictEqual(events.draw.length, 0);
});

test("a read-only pad refuses the press", () => {
  const { api, events } = mount({ readOnly: true });
  const control = api.getControlProps();
  deepStrictEqual(dragParam(control).enabled, false, "the gesture never arms");
  pressControl(control, press(20, 30));
  assert(api.empty);
  deepStrictEqual(events.draw.length, 0);
});

test("clear empties the committed paths and reports draw-end", () => {
  const { api, events } = mount();
  stroke(api);
  deepStrictEqual(api.paths.length, 1);
  api.clear();
  assert(api.empty);
  deepStrictEqual(api.paths.length, 0);
  deepStrictEqual(events.drawEnd.length, 2);
  deepStrictEqual(events.drawEnd[1]?.paths.length, 0);
});

test("authored paths seed the pad and a host write replaces them", () => {
  const { api, events, write } = mount({ paths: ["M0,0 L10,10"] });
  assert(!api.empty);
  deepStrictEqual(api.paths, ["M0,0 L10,10"]);
  deepStrictEqual(events.drawEnd.length, 0);
  write("paths", ["M5,5 L6,6"]);
  deepStrictEqual(api.paths, ["M5,5 L6,6"]);
});

test("defaultPaths seed an uncontrolled pad", () => {
  const { api } = mount({ defaultPaths: ["M1,1 L2,2", "M3,3 L4,4"] });
  deepStrictEqual(api.paths, ["M1,1 L2,2", "M3,3 L4,4"]);
});

test("the in-progress stroke is visible while drawing", () => {
  const { api } = mount();
  const control = api.getControlProps();
  pressControl(control, press(20, 30));
  assert(api.drawing);
  deepStrictEqual(api.paths.length, 0);
  dragParam(control).onEnd?.({ cancelled: false });
  assert(!api.drawing);
  deepStrictEqual(api.paths.length, 1);
});

test("the clear trigger hides while the stroke is in progress and returns when it commits", () => {
  const { api } = mount();
  const control = api.getControlProps();
  pressControl(control, press(20, 30));
  deepStrictEqual(
    api.getClearTriggerProps("Clear signature")["data-hidden"],
    "",
    "mid-stroke the trigger stands down",
  );
  dragParam(control).onEnd?.({ cancelled: false });
  deepStrictEqual(
    api.getClearTriggerProps("Clear signature")["data-hidden"],
    undefined,
    "the committed stroke brings the trigger back",
  );
});

test("a press on the clear trigger never starts a stroke", () => {
  const { api, events } = mount();
  stroke(api);
  const count = events.draw.length;
  const clearProps = api.getClearTriggerProps("Clear signature");
  const click = handler<() => void>(clearProps, "onClick");
  // A trigger press bubbles to the control: simulate the guard by pressing
  // from a node nested in the trigger.
  const trigger = {
    closest: (selector: string): unknown =>
      selector === "[data-part=clear-trigger]" ? {} : null,
  };
  const nested = {
    ...press(390, 12),
    target: trigger,
  } as unknown as DragPress;
  pressControl(api.getControlProps(), nested);
  deepStrictEqual(events.draw.length, count);
  click();
  assert(api.empty);
});
