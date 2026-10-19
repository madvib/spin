import { assert, assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { ratingGroup } from "./rating-group.bindings.ts";
const createRatingGroupBridge = ratingGroup.createBridge;
import type { RatingGroupHoverChange } from "./rating-group.bindings.ts";
import type { RatingGroupApi } from "./rating-group.bindings.ts";
import type { RatingGroupValueChange } from "./rating-group.machine.ts";

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
 * handler reads. The item rect is faked on the event's own node, because
 * the halfway flag is measured against the current target.
 */
function itemNode(leftWidth = 40): Element {
  return {
    getBoundingClientRect: () => ({ left: 0, right: leftWidth, width: leftWidth, top: 0 }),
  } as unknown as Element;
}

const over = (index: number, clientX: number): PointerEvent =>
  ({
    pointerType: "mouse",
    clientX,
    currentTarget: itemNode(),
    preventDefault: (): void => {},
  }) as unknown as PointerEvent;

const groupOver = (): PointerEvent =>
  ({ pointerType: "mouse" }) as unknown as PointerEvent;

const click = (): MouseEvent =>
  ({ preventDefault: (): void => {} }) as unknown as MouseEvent;

function keydown(key: string): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
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
  readonly api: RatingGroupApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: RatingGroupValueChange[];
    readonly hoverChange: RatingGroupHoverChange[];
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
    valueChange: [] as RatingGroupValueChange[],
    hoverChange: [] as RatingGroupHoverChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onValueChange", (details: RatingGroupValueChange) => events.valueChange.push(details));
  write("onHoverChange", (details: RatingGroupHoverChange) => events.hoverChange.push(details));
  const bridge = createRatingGroupBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "stars",
  );
  const count = typeof overrides["count"] === "number" ? overrides["count"] : 5;
  for (let i = 1; i <= count; i++) {
    const el = document.createElement("div");
    el.id = `rating-group:stars:item:${i}`;
    el.getBoundingClientRect = (): DOMRect =>
      ({ left: 0, right: 40, width: 40, top: 0, bottom: 0, x: 0, y: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(el);
  }
  return { api: bridge.api, root, events, write };
}

function item(api: RatingGroupApi, index: number): Record<string, unknown> {
  return api.getItemProps({ index }) as Record<string, unknown>;
}

Deno.test("a click commits the clicked value", () => {
  const { api, events } = mount();
  assertEquals(api.value, -1);
  handler<() => void>(item(api, 3), "onClick")();
  assertEquals(api.value, 3);
  assertEquals(events.valueChange.length, 1);
  assertEquals(events.valueChange[0]?.value, 3);
});

Deno.test("hover previews without committing", () => {
  const { api, events } = mount();
  handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointermove")(groupOver());
  handler<(e: PointerEvent) => void>(item(api, 4), "onPointermove")(over(4, 30));
  assert(api.hovering);
  assertEquals(api.hoveredValue, 4);
  assertEquals(api.value, -1);
  assertEquals(events.hoverChange.length, 1);
  assertEquals(events.hoverChange[0]?.hoveredValue, 4);
});

Deno.test("a hovered click commits the preview, not the item", () => {
  const { api } = mount();
  handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointermove")(groupOver());
  handler<(e: PointerEvent) => void>(item(api, 4), "onPointermove")(over(4, 30));
  handler<() => void>(item(api, 2), "onClick")();
  assertEquals(api.value, 4);
});

Deno.test("arrows walk the value and Home/End jump", () => {
  const { api } = mount();
  handler<() => void>(item(api, 3), "onClick")();
  assertEquals(api.value, 3);
  // Arrows only drive a focused group: land in focus first.
  handler<() => void>(item(api, 3), "onFocus")();
  const right = handler<(e: KeyboardEvent) => void>(item(api, 3), "onKeydown");
  right(keydown("ArrowRight"));
  assertEquals(api.value, 4);
  const left = handler<(e: KeyboardEvent) => void>(item(api, 4), "onKeydown");
  left(keydown("ArrowLeft"));
  assertEquals(api.value, 3);
  handler<(e: KeyboardEvent) => void>(item(api, 3), "onKeydown")(keydown("Home"));
  assertEquals(api.value, 1);
  handler<(e: KeyboardEvent) => void>(item(api, 1), "onKeydown")(keydown("End"));
  assertEquals(api.value, 5);
});

Deno.test("Space fills an empty rating and refuses a set one", () => {
  const { api } = mount();
  const focus = handler<(e: MouseEvent) => void>(item(api, 1), "onFocus");
  focus(click());
  handler<(e: KeyboardEvent) => void>(item(api, 1), "onKeydown")(keydown(" "));
  assertEquals(api.value, 1);
  handler<(e: KeyboardEvent) => void>(item(api, 1), "onKeydown")(keydown(" "));
  assertEquals(api.value, 1);
});

Deno.test("half steps round to the halfway flag", () => {
  const { api } = mount({ allowHalf: true });
  handler<(e: PointerEvent) => void>(api.getControlProps(), "onPointermove")(groupOver());
  handler<(e: PointerEvent) => void>(item(api, 3), "onPointermove")(over(3, 10));
  assertEquals(api.hoveredValue, 2.5);
  handler<() => void>(item(api, 3), "onClick")();
  assertEquals(api.value, 2.5);
});

Deno.test("a disabled group refuses clicks and keys", () => {
  const { api, events } = mount({ disabled: true });
  handler<() => void>(item(api, 3), "onClick")();
  assertEquals(api.value, -1);
  handler<(e: KeyboardEvent) => void>(item(api, 3), "onKeydown")(keydown("ArrowRight"));
  assertEquals(api.value, -1);
  assertEquals(events.valueChange.length, 0);
});

Deno.test("authored value seeds the group and a host write moves it", () => {
  const { api, events, write } = mount({ value: 2 });
  assertEquals(api.value, 2);
  assertEquals(events.valueChange.length, 0);
  write("value", 4);
  assertEquals(api.value, 4);
  assertEquals(events.valueChange.length, 1);
});

Deno.test("clear empties the rating", () => {
  const { api, events } = mount();
  handler<() => void>(item(api, 3), "onClick")();
  assertEquals(api.value, 3);
  api.clearValue();
  assertEquals(api.value, -1);
  assertEquals(events.valueChange.length, 2);
});

void click;
