import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createSplitterBridge, parsePanels } from "./splitter.bridge.ts";
import type { SplitterApi } from "./splitter.connect.ts";
import type { SplitterResizeDetails } from "./splitter.machine.ts";

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

const PANELS = '[{"id":"a"},{"id":"b"}]';

/**
 * linkedom ships no PointerEvent constructors, so the events the handlers
 * need are synthesized here — one place, with the minimal field set each
 * handler reads. The root rect is faked on the event's own node: a 400px
 * group starting at x=10, so clientX maps linearly to 0..100%.
 */
function rootNode(): Element {
  return {
    getBoundingClientRect: () => ({ left: 10, right: 410, width: 400, top: 0, bottom: 200, height: 200 }),
  } as unknown as Element;
}

const press = (clientX: number): PointerEvent =>
  ({
    pointerType: "mouse",
    button: 0,
    pointerId: 1,
    clientX,
    clientY: 100,
    currentTarget: {
      focus: (_options?: FocusOptions): void => {},
      setPointerCapture: (_id: number): void => {},
    },
    target: rootNode(),
    preventDefault: (): void => {},
    stopPropagation: (): void => {},
  }) as unknown as PointerEvent;

const drag = (clientX: number): PointerEvent =>
  ({
    pointerType: "mouse",
    pointerId: 1,
    clientX,
    clientY: 100,
    currentTarget: rootNode(),
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
  readonly api: SplitterApi;
  readonly root: Element;
  readonly events: {
    readonly resize: SplitterResizeDetails[];
    readonly resizeEnd: SplitterResizeDetails[];
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
    resize: [] as SplitterResizeDetails[],
    resizeEnd: [] as SplitterResizeDetails[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  if (!authoredKeys.has("panels")) {
    write("panels", PANELS);
    authoredKeys.add("panels");
  }
  write("onResize", (details: SplitterResizeDetails) => events.resize.push(details));
  write("onResizeEnd", (details: SplitterResizeDetails) => events.resizeEnd.push(details));
  // The handle measures against the live root node; linkedom cannot serve
  // getElementById for this tree, so the root rect is pinned here under the
  // id the connect reads.
  const realDocument = globalThis.document as Document;
  const holder = realDocument.createElement("div");
  holder.id = "splitter:group";
  const rect = { left: 10, right: 410, width: 400, top: 0, bottom: 200, height: 200 };
  holder.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  realDocument.body.appendChild(holder);
  const bridge = createSplitterBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "group",
  );
  return { api: bridge.api, root, events, write };
}

function handle(api: SplitterApi): Record<string, unknown> {
  return api.getHandleProps({ beforeId: "a", afterId: "b" }) as Record<string, unknown>;
}

Deno.test("panels parse from JSON and split the group evenly", () => {
  assertEquals(parsePanels(PANELS).map((panel) => panel.id), ["a", "b"]);
  assertEquals(parsePanels("[]"), []);
  assertEquals(parsePanels("nope"), []);
  const { api } = mount();
  assertEquals(api.getSizes(), [50, 50]);
});

Deno.test("a handle drag redistributes the percents", () => {
  const { api, events } = mount();
  handler<(e: PointerEvent) => void>(handle(api), "onPointerdown")(press(210));
  // x=210 on a 10..410 group: grab at 50%.
  assert(api.dragging);
  handler<(e: PointerEvent) => void>(handle(api), "onPointermove")(drag(250));
  // +10% moves a->b: [60, 40]. The grab itself moves nothing, so the move
  // is the only resize.
  assertEquals(api.getSizes(), [60, 40]);
  assertEquals(events.resize.length, 1);
  handler<(e: PointerEvent) => void>(handle(api), "onPointerup")(
    { ...drag(250), currentTarget: rootNode() } as unknown as PointerEvent,
  );
  assert(!api.dragging);
  assertEquals(events.resizeEnd.length, 1);
  assertEquals(events.resizeEnd[0]?.size, [60, 40]);
});

Deno.test("arrows resize the focused handle", () => {
  const { api } = mount();
  handler<() => void>(handle(api), "onFocus")();
  handler<(e: KeyboardEvent) => void>(handle(api), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.getSizes(), [51, 49]);
  handler<(e: KeyboardEvent) => void>(handle(api), "onKeydown")(keydown("ArrowLeft"));
  assertEquals(api.getSizes(), [50, 50]);
});

Deno.test("arrows refuse without a focused handle", () => {
  const { api, events } = mount();
  handler<(e: KeyboardEvent) => void>(handle(api), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.getSizes(), [50, 50]);
  assertEquals(events.resize.length, 0);
});

Deno.test("Enter collapses and re-expands a collapsible panel", () => {
  const { api } = mount({
    panels: '[{"id":"a","collapsible":true,"minSize":10},{"id":"b"}]',
  });
  handler<() => void>(handle(api), "onFocus")();
  handler<(e: KeyboardEvent) => void>(handle(api), "onKeydown")(keydown("Enter"));
  assert(api.isPanelCollapsed("a"));
  assertEquals(api.getPanelSize("a"), 0);
  handler<(e: KeyboardEvent) => void>(handle(api), "onKeydown")(keydown("Enter"));
  assert(!api.isPanelCollapsed("a"));
});

Deno.test("collapsePanel and expandPanel commands work", () => {
  const { api } = mount({
    panels: '[{"id":"a","collapsible":true,"minSize":10},{"id":"b"}]',
  });
  api.collapsePanel("a");
  assert(api.isPanelCollapsed("a"));
  api.expandPanel("a");
  assert(!api.isPanelCollapsed("a"));
  // Expand restores the pre-collapse snapshot, not the minimum.
  assertEquals(api.getPanelSize("a"), 50);
});

Deno.test("authored size seeds the layout and a host write moves it", () => {
  const { api, events, write } = mount({ size: "[30, 70]" });
  assertEquals(api.getSizes(), [30, 70]);
  assertEquals(events.resize.length, 0);
  write("size", "[40, 60]");
  assertEquals(api.getSizes(), [40, 60]);
  assertEquals(events.resize.length, 1);
});

Deno.test("minSize clamps a drag", () => {
  const { api } = mount({
    panels: '[{"id":"a","minSize":40},{"id":"b"}]',
  });
  handler<(e: PointerEvent) => void>(handle(api), "onPointerdown")(press(210));
  handler<(e: PointerEvent) => void>(handle(api), "onPointermove")(drag(10));
  // a cannot shrink below 40.
  assertEquals(api.getSizes(), [40, 60]);
});
