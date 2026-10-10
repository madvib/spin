import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createRatingFsmBridge } from "./rating.bridge.ts";
import type { RatingCommands } from "./rating.bridge.ts";
import type { RatingFsmApi, RatingItem } from "./rating.connect.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as {
  document: Document;
  CustomEvent: typeof CustomEvent;
  HTMLElement: typeof HTMLElement;
  Element: typeof Element;
};
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

/** Read a callback out of a bag's `use:name` entry, which is data. */
function callback<H>(bag: Record<string, unknown>, action: string, name: string): H {
  const params: unknown = bag[action];
  if (typeof params !== "object" || params === null) throw new Error(`no action param at ${action}`);
  return handler<H>(params as Record<string, unknown>, name);
}

/**
 * One element per star, in the document with a measurable box: the part ids
 * the machine focuses by, and the box the halfway split measures against
 * (linkedom has no layout, so the rect is stubbed to a 20px star).
 */
const starElements = new Map<number, HTMLElement>();
function itemEl(index: number): HTMLElement {
  const hit = starElements.get(index);
  if (hit !== undefined) return hit;
  const made = document.createElement("div");
  made.id = `rating:stars:item:${index}`;
  made.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 20, height: 20, x: 0, y: 0, right: 20, bottom: 20 }) as DOMRect;
  document.body.appendChild(made);
  starElements.set(index, made);
  return made;
}

/**
 * linkedom ships no PointerEvent/KeyboardEvent/MouseEvent constructors, so the
 * events the handlers need are synthesized here — one place, with the minimal
 * field set each handler reads.
 */
const key = (name: string): KeyboardEvent => ({ key: name, defaultPrevented: false, preventDefault: () => {} }) as unknown as KeyboardEvent;
const pointer = (over: number, options: Readonly<{ clientX?: number; pointerType?: string }> = {}): PointerEvent =>
  ({
    pointerType: options.pointerType ?? "mouse",
    clientX: options.clientX ?? 0,
    button: 0,
    currentTarget: itemEl(over),
    preventDefault: () => {},
  }) as unknown as PointerEvent;

interface Harness {
  readonly api: RatingFsmApi & RatingCommands;
  readonly root: Element;
  readonly values: readonly number[];
  readonly hovers: readonly number[];
  /** A real element for one item, in the document with a measurable box. */
  el(index: number): HTMLElement;
  item(index: number): RatingItem;
  state(): unknown;
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const values: number[] = [];
  const hovers: number[] = [];
  const store: Record<string, WriteSignal> = {};
  const write = (name: string, value: unknown): void => {
    const source = store[name];
    if (source === undefined) store[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onValueChange", (change: { value: number }) => values.push(change.value));
  write("onHoverChange", (change: { hoveredValue: number }) => hovers.push(change.hoveredValue));
  const bridge = createRatingFsmBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(store)) record[name] = source();
      return record;
    },
    () => root,
    "stars",
  );
  return {
    api: bridge.api,
    root,
    values,
    hovers,
    el: (index) => itemEl(index),
    item: (index) => {
      const found = bridge.api.getItems().find((item) => item.index === index);
      if (found === undefined) throw new Error(`no item ${index}`);
      return found;
    },
    state: () => bridge.api.getControlProps()["data-state"],
    write,
  };
}

/** The control's own pointermove, on a group element with no items in it. */
const groupMove = (h: Harness): void => {
  const control = document.createElement("div");
  h.root.appendChild(control);
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerMove")({
    pointerType: "mouse",
    currentTarget: control,
  } as unknown as PointerEvent);
};

Deno.test("Given a fresh rating group / When nothing is authored / Then idle is the reachable start state", () => {
  const h = mount();
  assertEquals(h.state(), "idle", "idle is the initial state");
  assertEquals(h.api.value, -1, "nothing is selected");
  assertEquals(h.api.hoveredValue, -1, "nothing is previewed");
  assertEquals(h.api.hovering, false, "the api reports no hover");
  assertEquals(h.api.count, 5, "five stars by default");
  assertEquals(h.api.getItems().map((item) => item.index), [1, 2, 3, 4, 5], "one item per star");
  assertEquals(h.api.getItemState(h.item(1)).checked, true, "an empty group checks its first radio");
  assertEquals(h.api.getItemState(h.item(3)).checked, false, "the rest are unchecked");
});

Deno.test("Given a defaultValue / When the group mounts / Then the value is seeded from it", () => {
  const h = mount({ defaultValue: "3" });
  assertEquals(h.api.value, 3, "the seeded value is the default");
  assertEquals(h.api.getItemState(h.item(3)).checked, true, "the third star is checked");
  assertEquals(h.api.getItemState(h.item(1)).checked, false, "the first is not");
  assertEquals(h.values, [], "seeding reports no change");
});

Deno.test("Given allowHalf and a half default / When the group mounts / Then the half value survives", () => {
  const h = mount({ defaultValue: "2.5", allowHalf: true });
  assertEquals(h.api.value, 2.5, "halves are legal when allowHalf is on");
  assertEquals(h.api.getItemState(h.item(2)).half, false, "the second star is whole");
  assertEquals(h.api.getItemState(h.item(3)).half, true, "the third star is half");
});

Deno.test("Given a half default without allowHalf / When the group mounts / Then the value stays as authored", () => {
  const h = mount({ defaultValue: "2.5" });
  assertEquals(h.api.value, 2.5, "the seed is taken verbatim, as Zag's is");
});

Deno.test("Given an idle group / When the pointer enters the control / Then the hover state is reachable", () => {
  const h = mount();
  groupMove(h);
  assertEquals(h.state(), "hover", "the group takes the hover state");
});

Deno.test("Given a hovering group with no focus / When the pointer leaves / Then idle is reachable again", () => {
  const h = mount();
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerLeave")({
    pointerType: "mouse",
  } as unknown as PointerEvent);
  assertEquals(h.state(), "idle", "a plain leave returns to idle");
  assertEquals(h.hovers, [], "nothing was previewed");
});

Deno.test("Given an idle group / When an item takes focus / Then the focus state is reachable", () => {
  const h = mount();
  handler<() => void>(h.api.getItemProps(h.item(2)), "onFocus")();
  assertEquals(h.state(), "focus", "focusing an item takes the focus state");
});

Deno.test("Given a focused group / When the item blurs / Then it returns to idle", () => {
  const h = mount();
  handler<() => void>(h.api.getItemProps(h.item(2)), "onFocus")();
  handler<() => void>(h.api.getItemProps(h.item(2)), "onBlur")();
  assertEquals(h.state(), "idle", "the blur leaves the focus state");
});

Deno.test("Given a focused group / When the pointer enters the control / Then the focus state holds, as Zag's has no crossing", () => {
  const h = mount();
  handler<() => void>(h.api.getItemProps(h.item(2)), "onFocus")();
  groupMove(h);
  assertEquals(h.state(), "focus", "Zag's focus state handles no GROUP_POINTER_OVER");
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(4)), "onPointerMove")(pointer(4));
  assertEquals(h.api.hoveredValue, 4, "the preview still works while focus holds");
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerLeave")({
    pointerType: "mouse",
  } as unknown as PointerEvent);
  assertEquals(h.state(), "focus", "a leave clears the preview, not the focus");
  assertEquals(h.api.hoveredValue, -1, "the preview is cleared");
});

Deno.test("Given a hovering group that holds focus / When the pointer leaves / Then the focus state survives the hover", () => {
  const h = mount();
  groupMove(h);
  handler<() => void>(h.api.getItemProps(h.item(2)), "onFocus")();
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerLeave")({
    pointerType: "mouse",
  } as unknown as PointerEvent);
  assertEquals(h.state(), "focus", "the leave of the pointer is not a leave of the rating");
});

Deno.test("Given a hovering group that gains focus / When the pointer leaves / Then the focus state is reachable from hover", () => {
  const h = mount();
  groupMove(h);
  handler<() => void>(h.api.getItemProps(h.item(2)), "onFocus")();
  assertEquals(h.state(), "hover", "Zag keeps hovering while the pointer is over the group");
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerLeave")({
    pointerType: "mouse",
  } as unknown as PointerEvent);
  assertEquals(h.state(), "focus", "focus recorded during hover decides where the leave lands");
});

Deno.test("Given a hovering group / When the item blurs / Then it stays hovering and reports the lost focus", () => {
  const h = mount();
  groupMove(h);
  handler<() => void>(h.api.getItemProps(h.item(2)), "onFocus")();
  handler<() => void>(h.api.getItemProps(h.item(2)), "onBlur")();
  assertEquals(h.state(), "hover", "a blur mid-hover does not end the hover");
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerLeave")({
    pointerType: "mouse",
  } as unknown as PointerEvent);
  assertEquals(h.state(), "idle", "with focus gone, the leave lands on idle");
});

Deno.test("Given a hovering group / When the pointer leaves / Then the preview is cleared and reported", () => {
  const h = mount();
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(4)), "onPointerMove")(pointer(4));
  assertEquals(h.api.hoveredValue, 4, "the pointer previews the fourth star");
  assertEquals(h.api.hovering, true, "the api reports the hover");
  assertEquals(h.hovers, [4], "hover-change reports the preview");
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerLeave")({
    pointerType: "mouse",
  } as unknown as PointerEvent);
  assertEquals(h.api.hoveredValue, -1, "the leave clears the preview");
  assertEquals(h.api.hovering, false, "the api reports no hover");
  assertEquals(h.hovers, [4, -1], "hover-change reports the clear");
});

Deno.test("Given an idle group / When a pointer moves over an item / Then the idle state records no preview", () => {
  const h = mount();
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(4)), "onPointerMove")(pointer(4));
  assertEquals(h.state(), "idle", "Zag's idle handles no POINTER_OVER, and neither does this");
  assertEquals(h.api.hoveredValue, -1, "no preview is taken before the group is hovering");
});

Deno.test("Given an idle group / When a touch pointer moves over the control / Then the group stays idle", () => {
  const h = mount();
  const control = document.createElement("div");
  h.root.appendChild(control);
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerMove")({
    pointerType: "touch",
    currentTarget: control,
  } as unknown as PointerEvent);
  assertEquals(h.state(), "idle", "touch never previews");
});

Deno.test("Given a pointer over the left half of a star / When allowHalf is on / Then the preview is a half", () => {
  const h = mount({ allowHalf: true });
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(3)), "onPointerMove")(pointer(3, { clientX: 9 }));
  assertEquals(h.api.hoveredValue, 2.5, "the left half of the third star previews two and a half");
  assertEquals(h.api.getItemState(h.item(3)).half, true, "the third star paints half");
  assertEquals((h.api.getItemProps(h.item(3))["style"] as Record<string, string>)["--rating-fill"], "50%", "the fill geometry carries the half");
});

Deno.test("Given a pointer over the right half of a star / When allowHalf is on / Then the preview is whole", () => {
  const h = mount({ allowHalf: true });
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(3)), "onPointerMove")(pointer(3, { clientX: 15 }));
  assertEquals(h.api.hoveredValue, 3, "the right half previews three whole");
});

Deno.test("Given a pointer over the left half of a star / When allowHalf is off / Then the preview is whole", () => {
  const h = mount();
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(3)), "onPointerMove")(pointer(3, { clientX: 2 }));
  assertEquals(h.api.hoveredValue, 3, "without halves the whole star is previewed");
  assertEquals(h.api.getItemState(h.item(3)).half, false, "no star paints half");
});

Deno.test("Given an rtl group / When the pointer is over the right half of a star / Then the split flips", () => {
  const h = mount({ allowHalf: true, dir: "rtl" });
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(3)), "onPointerMove")(pointer(3, { clientX: 15 }));
  assertEquals(h.api.hoveredValue, 2.5, "the right half is the near half in rtl");
});

Deno.test("Given an idle group / When a star is clicked / Then the value commits and the radio takes focus", () => {
  const h = mount();
  const focused: string[] = [];
  h.el(3).focus = () => focused.push("rating:stars:item:3");
  handler<() => void>(h.api.getItemProps(h.item(3)), "onClick")();
  assertEquals(h.api.value, 3, "the click commits the third star");
  assertEquals(h.values, [3], "value-change reports the commit");
  assertEquals(focused, ["rating:stars:item:3"], "Zag's focusActiveRadio puts focus on the new radio");
});

Deno.test("Given a hovering group with a half preview / When a star is clicked / Then the preview wins", () => {
  const h = mount({ allowHalf: true });
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(3)), "onPointerMove")(pointer(3, { clientX: 5 }));
  handler<() => void>(h.api.getItemProps(h.item(3)), "onClick")();
  assertEquals(h.api.value, 2.5, "the hovered half is what the click commits");
  assertEquals(h.values, [2.5], "value-change reports the half");
});

Deno.test("Given a left press on a star / When the pointer goes down / Then the native focus jump is prevented", () => {
  const h = mount();
  let prevented = false;
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(2)), "onPointerDown")({
    button: 0,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as PointerEvent);
  assertEquals(prevented, true, "the radio group owns which item is active");
  let rightPrevented = false;
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(2)), "onPointerDown")({
    button: 2,
    preventDefault: () => {
      rightPrevented = true;
    },
  } as unknown as PointerEvent);
  assertEquals(rightPrevented, false, "a non-left press is not the group's gesture");
});

Deno.test("Given a focused group / When ArrowRight arrives / Then the value steps by one star", () => {
  const h = mount({ defaultValue: "2" });
  handler<() => void>(h.api.getItemProps(h.item(2)), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(2)), "onKeyDown")(key("ArrowRight"));
  assertEquals(h.api.value, 3, "ArrowRight steps up");
  assertEquals(h.state(), "focus", "the keyboard stays in the focus state");
  handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(2)), "onKeyDown")(key("ArrowLeft"));
  assertEquals(h.api.value, 2, "ArrowLeft steps back down");
  assertEquals(h.values, [3, 2], "both steps report");
});

Deno.test("Given a focused group with allowHalf / When the arrows arrive / Then the value steps by a half", () => {
  const h = mount({ allowHalf: true, defaultValue: "2" });
  handler<() => void>(h.api.getItemProps(h.item(2)), "onFocus")();
  const onKeyDown = handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(2)), "onKeyDown");
  onKeyDown(key("ArrowRight"));
  assertEquals(h.api.value, 2.5, "the half grid steps by a half");
  onKeyDown(key("ArrowRight"));
  assertEquals(h.api.value, 3, "the next half step lands on the whole star");
  onKeyDown(key("ArrowLeft"));
  assertEquals(h.api.value, 2.5, "ArrowLeft walks back over the half");
});

Deno.test("Given a focused empty group / When ArrowRight arrives / Then the first star is the landing", () => {
  const h = mount();
  handler<() => void>(h.api.getItemProps(h.item(1)), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(1)), "onKeyDown")(key("ArrowRight"));
  assertEquals(h.api.value, 1, "an empty group steps onto the first star");
});

Deno.test("Given a focused group / When the arrows run past the ends / Then the value clamps", () => {
  const h = mount({ defaultValue: "5" });
  handler<() => void>(h.api.getItemProps(h.item(5)), "onFocus")();
  const onKeyDown = handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(5)), "onKeyDown");
  onKeyDown(key("ArrowRight"));
  assertEquals(h.api.value, 5, "the count is the ceiling");
  onKeyDown(key("End"));
  assertEquals(h.api.value, 5, "End lands on the last star");
  onKeyDown(key("Home"));
  assertEquals(h.api.value, 1, "Home lands on the first star");
  onKeyDown(key("ArrowLeft"));
  assertEquals(h.api.value, 0, "stepping down from one star empties it");
});

Deno.test("Given a focused group / When Up and Down arrive / Then they follow the left and right arrows", () => {
  const h = mount({ defaultValue: "3" });
  handler<() => void>(h.api.getItemProps(h.item(3)), "onFocus")();
  const onKeyDown = handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(3)), "onKeyDown");
  onKeyDown(key("Down"));
  assertEquals(h.api.value, 4, "Down steps up, as Zag maps it");
  onKeyDown(key("Up"));
  assertEquals(h.api.value, 3, "Up steps back down");
});

Deno.test("Given an rtl group / When ArrowLeft arrives / Then the direction flips", () => {
  const h = mount({ dir: "rtl", defaultValue: "3" });
  handler<() => void>(h.api.getItemProps(h.item(3)), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(3)), "onKeyDown")(key("ArrowLeft"));
  assertEquals(h.api.value, 4, "ArrowLeft in rtl steps up");
});

Deno.test("Given a focused group with a value / When Space arrives / Then nothing changes", () => {
  const h = mount({ defaultValue: "3" });
  handler<() => void>(h.api.getItemProps(h.item(3)), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(3)), "onKeyDown")(key(" "));
  assertEquals(h.api.value, 3, "Space commits, it does not clear");
  assertEquals(h.values, [], "no change is reported");
});

Deno.test("Given a focused empty group / When Space arrives / Then the focused star commits", () => {
  const h = mount();
  handler<() => void>(h.api.getItemProps(h.item(4)), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(4)), "onKeyDown")(key(" "));
  assertEquals(h.api.value, 4, "the guard lets an empty group be set from the keyboard");
});

Deno.test("Given a focused group / When a printable key arrives / Then it is not the group's", () => {
  const h = mount({ defaultValue: "3" });
  handler<() => void>(h.api.getItemProps(h.item(3)), "onFocus")();
  let prevented = false;
  handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(3)), "onKeyDown")({
    key: "x",
    defaultPrevented: false,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as KeyboardEvent);
  assertEquals(prevented, false, "an unmapped key is left alone");
});

Deno.test("Given a disabled group / When a star is clicked and keyed / Then nothing moves", () => {
  const h = mount({ disabled: true });
  handler<() => void>(h.api.getItemProps(h.item(3)), "onClick")();
  assertEquals(h.api.value, -1, "a click is ignored");
  handler<() => void>(h.api.getItemProps(h.item(1)), "onFocus")();
  assertEquals(h.state(), "idle", "focus is ignored too");
  const control = document.createElement("div");
  h.root.appendChild(control);
  handler<(event: PointerEvent) => void>(h.api.getControlProps(), "onPointerMove")({
    pointerType: "mouse",
    currentTarget: control,
  } as unknown as PointerEvent);
  assertEquals(h.state(), "idle", "and so is the pointer");
  assertEquals(h.values, [], "nothing is reported");
});

Deno.test("Given a read-only group / When a star is clicked and keyed / Then nothing moves", () => {
  const h = mount({ defaultValue: "3", readOnly: true });
  handler<() => void>(h.api.getItemProps(h.item(4)), "onClick")();
  handler<(event: KeyboardEvent) => void>(h.api.getItemProps(h.item(3)), "onKeyDown")(key("ArrowRight"));
  assertEquals(h.api.value, 3, "a read-only group keeps its value");
  assertEquals(h.values, [], "nothing is reported");
});

Deno.test("Given a group / When the setValue command runs / Then the value moves from any state", () => {
  const h = mount();
  h.api.setValue(4);
  assertEquals(h.api.value, 4, "the command writes the value");
  assertEquals(h.values, [4], "value-change reports it");
  h.api.setValue(4);
  assertEquals(h.values, [4], "a write of the same value reports nothing");
  h.api.clearValue();
  assertEquals(h.api.value, -1, "the clear command empties the group");
  assertEquals(h.api.getItemState(h.item(1)).checked, true, "an emptied group checks its first radio again");
  assertEquals(h.values, [4, -1], "the clear reports");
});

Deno.test("Given a command run while the pointer previews / Then the preview wins, as Zag's assign reads it", () => {
  const h = mount({ allowHalf: true });
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(4)), "onPointerMove")(pointer(4, { clientX: 5 }));
  h.api.setValue(1);
  assertEquals(h.api.value, 3.5, "the hovered half is what the event commits");
});

Deno.test("Given an authored value prop / When the host writes it / Then the machine follows without an event", () => {
  const outer = signal<unknown>(2);
  const root = document.createElement("div");
  document.body.appendChild(root);
  const seen: number[] = [];
  const bridge = createRatingFsmBridge(
    () => ({
      count: 5,
      "@@authored": (name: string) => name === "value",
      value: outer(),
      onValueChange: (change: { value: number }) => seen.push(change.value),
    }),
    () => root,
    "stars",
  );
  assertEquals(bridge.api.value, 2, "the authored write is the starting value");
  outer(4);
  assertEquals(bridge.api.value, 4, "a later write moves the machine");
  assertEquals(bridge.api.getItemState(bridge.api.getItems()[3]!).checked, true, "the fourth star is checked");
  assertEquals(seen, [4], "value-change reports the move");
});

Deno.test("Given an un-authored value prop / When the host writes it / Then the machine ignores it", () => {
  const outer = signal<unknown>(4);
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bridge = createRatingFsmBridge(
    () => ({ count: 5, value: outer() }),
    () => root,
    "stars",
  );
  assertEquals(bridge.api.value, -1, "a coerced default is not a host write");
  outer(1);
  assertEquals(bridge.api.value, -1, "writing it changes nothing");
});

Deno.test("Given allowHalf turning off / When the value is a half / Then it folds onto the whole grid", () => {
  const allowHalf = signal<unknown>(true);
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bridge = createRatingFsmBridge(
    () => ({ count: 5, allowHalf: allowHalf(), defaultValue: 2.5 }),
    () => root,
    "stars",
  );
  assertEquals(bridge.api.value, 2.5, "halves start legal");
  allowHalf(false);
  assertEquals(bridge.api.value, 3, "Zag's watch rounds the value when halves turn off");
  allowHalf(true);
  assertEquals(bridge.api.value, 3, "turning them back on does not restore the half");
});

Deno.test("Given a count prop / When it moves / Then the items and the ceiling follow", () => {
  const count = signal<unknown>(3);
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bridge = createRatingFsmBridge(
    () => ({ count: count() }),
    () => root,
    "stars",
  );
  assertEquals(bridge.api.count, 3, "the api reports the prop's count");
  assertEquals(bridge.api.getItems().length, 3, "three items render");
  bridge.api.setValue(3);
  count(6);
  assertEquals(bridge.api.getItems().length, 6, "the item list follows the prop");
  handler<() => void>(bridge.api.getItemProps(bridge.api.getItems()[0]!), "onFocus")();
  handler<(event: KeyboardEvent) => void>(bridge.api.getItemProps(bridge.api.getItems()[0]!), "onKeyDown")(
    key("End"),
  );
  assertEquals(bridge.api.value, 6, "End reaches the new ceiling");
});

Deno.test("Given a count below one / When the group mounts / Then one star is the floor", () => {
  const h = mount({ count: 0 });
  assertEquals(h.api.getItems().length, 1, "a group always has at least one star");
});

Deno.test("Given a group's items / When the props are read / Then the radiogroup semantics are on them", () => {
  const h = mount({ defaultValue: "3", allowHalf: true });
  const bag = h.api.getItemProps(h.item(3));
  assertEquals(bag["id"], "rating:stars:item:3", "the part id is namespaced by the element id");
  assertEquals(bag["role"], "radio", "each star is a radio");
  assertEquals(bag["aria-roledescription"], "rating", "and announces itself as a rating");
  assertEquals(bag["aria-label"], "3 stars", "the default translation names the star");
  assertEquals(bag["aria-checked"], true, "the third star is checked");
  assertEquals(bag["aria-posinset"], 3, "its position in the set");
  assertEquals(bag["aria-setsize"], 5, "the set size is the count");
  assertEquals(bag["aria-disabled"], false, "an enabled star is not disabled");
  assertEquals(bag["data-checked"], "", "the checked state is on the element");
  assertEquals(bag["data-highlighted"], "", "so is the highlighted state");
  assertEquals(bag["tabIndex"], 0, "the checked star is the tab stop");
  assertEquals(h.api.getItemProps(h.item(1))["tabIndex"], -1, "the others are reachable only by arrow");
});

Deno.test("Given a group's items / When nothing is selected / Then the first star is the tab stop", () => {
  const h = mount();
  assertEquals(h.api.getItemProps(h.item(1))["tabIndex"], 0, "an empty group starts on the first radio");
  assertEquals(h.api.getItemProps(h.item(2))["tabIndex"], -1, "the rest sit out of the tab order");
});

Deno.test("Given a read-only group / When the item props are read / Then only the checked star is in the tab order", () => {
  const h = mount({ defaultValue: "2", readOnly: true });
  assertEquals(h.api.getItemProps(h.item(2))["tabIndex"], 0, "the checked star is focusable");
  assertEquals(h.api.getItemProps(h.item(4))["tabIndex"], undefined, "the others are not");
  assertEquals(h.api.getItemProps(h.item(4))["data-readonly"], "", "the read-only state is on the element");
});

Deno.test("Given a disabled group / When the item props are read / Then no star is in the tab order", () => {
  const h = mount({ defaultValue: "2", disabled: true });
  for (const index of [1, 2, 3]) {
    assertEquals(h.api.getItemProps(h.item(index))["tabIndex"], undefined, `star ${index} leaves the tab order`);
    assertEquals(h.api.getItemProps(h.item(index))["data-disabled"], "", `star ${index} reports disabled`);
    assertEquals(h.api.getItemProps(h.item(index))["aria-disabled"], true, `star ${index} announces it`);
  }
});

Deno.test("Given a preview over the third star / When the item props are read / Then the earlier stars paint full", () => {
  const h = mount();
  groupMove(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.item(3)), "onPointerMove")(pointer(3));
  const fills = [1, 2, 3, 4, 5].map((index) =>
    (h.api.getItemProps(h.item(index))["style"] as Record<string, string>)["--rating-fill"]
  );
  assertEquals(fills, ["100%", "100%", "100%", "0%", "0%"], "the preview fills what the pointer covers");
  assertEquals(h.api.getItemProps(h.item(4))["data-highlighted"], undefined, "the stars past the pointer are not highlighted");
});

Deno.test("Given a value of two and a half / When the item props are read / Then the third star paints half", () => {
  const h = mount({ allowHalf: true, defaultValue: "2.5" });
  const fill = (index: number): string =>
    (h.api.getItemProps(h.item(index))["style"] as Record<string, string>)["--rating-fill"] ?? "";
  assertEquals([fill(1), fill(2), fill(3), fill(4)], ["100%", "100%", "50%", "0%"], "the half sits on the third star");
  assertEquals(h.api.getItemProps(h.item(3))["data-half"], "", "and it reports the half state");
  assertEquals(h.api.getItemProps(h.item(2))["data-half"], undefined, "the whole stars do not");
});

Deno.test("Given the label part / When its props are read / Then it names the control and focuses the radio", () => {
  const h = mount({ defaultValue: "3" });
  const bag = h.api.getLabelProps();
  assertEquals(bag["id"], "rating:stars:label", "the label part id is namespaced");
  assertEquals(bag["for"], "rating:stars:input", "the label points at the hidden input");
  const focused: string[] = [];
  h.el(3).focus = () => focused.push("rating:stars:item:3");
  let prevented = false;
  handler<(event: MouseEvent) => void>(bag, "onClick")({
    defaultPrevented: false,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as MouseEvent);
  assertEquals(prevented, true, "the label's own label-click is prevented in favour of focusing the radio");
  assertEquals(focused, ["rating:stars:item:3"], "the click focuses the radio for the value");
});

Deno.test("Given the control part / When its props are read / Then it is a labelled radiogroup", () => {
  const h = mount({ readOnly: true });
  const bag = h.api.getControlProps();
  assertEquals(bag["role"], "radiogroup", "the group is a radiogroup");
  assertEquals(bag["aria-orientation"], "horizontal", "laid out horizontally");
  assertEquals(bag["aria-labelledby"], "rating:stars:label", "named by the label part");
  assertEquals(bag["aria-readonly"], true, "and announces read-only");
  assertEquals(bag["data-readonly"], "", "with the state on the element");
  assertEquals(bag["dir"], "ltr", "the direction is on the control");
});

Deno.test("Given the root part / When its props are read / Then it carries the form-control reflex", () => {
  const h = mount();
  const bag = h.api.getRootProps();
  assertEquals(bag["id"], "rating:stars", "the root part id is the namespaced element id");
  assertEquals(bag["dir"], "ltr", "the direction is on the root");
  const params = bag["use:form-control"];
  assertEquals(typeof params === "object" && params !== null, true, "the form-control action rides the bag");
});

Deno.test("Given the hidden input / When its props are read / Then the form sees the value and the flags", () => {
  const h = mount({ defaultValue: "3", name: "quality", form: "survey", required: true });
  const bag = h.api.getHiddenInputProps();
  assertEquals(bag["id"], "rating:stars:input", "the input part id is namespaced");
  assertEquals(bag["type"], "text", "the value rides a text input");
  assertEquals(bag["hidden"], true, "hidden from view");
  assertEquals(bag["name"], "quality", "named for the form");
  assertEquals(bag["form"], "survey", "associated with the host's form");
  assertEquals(bag["required"], true, "required, as the prop says");
  assertEquals(bag["value"], 3, "the DOM value is the rating");
  assertEquals(bag["defaultValue"], 3, "and so is the seeded attribute");
});

Deno.test("Given a disabled ancestor fieldset / When the action reports it / Then the group goes inert", () => {
  const h = mount({ defaultValue: "2" });
  callback<(disabled: boolean) => void>(h.api.getRootProps(), "use:form-control", "onDisabledChange")(true);
  assertEquals(h.api.getItemProps(h.item(3))["aria-disabled"], true, "the stars announce disabled");
  assertEquals(h.api.getItemProps(h.item(3))["tabIndex"], undefined, "and leave the tab order");
  handler<() => void>(h.api.getItemProps(h.item(3)), "onClick")();
  assertEquals(h.api.value, 2, "a click while the fieldset is disabled is ignored");
  callback<(disabled: boolean) => void>(h.api.getRootProps(), "use:form-control", "onDisabledChange")(false);
  assertEquals(h.api.getItemProps(h.item(3))["aria-disabled"], false, "re-enabling the fieldset re-enables the group");
});

Deno.test("Given a form reset / When the action reports it / Then the value returns to the seeded default", () => {
  const h = mount({ defaultValue: "2" });
  h.api.setValue(5);
  callback<() => void>(h.api.getRootProps(), "use:form-control", "onFormReset")();
  assertEquals(h.api.value, 2, "the reset restores the seed");
  assertEquals(h.values, [5, 2], "the reset reports as a change");
});

Deno.test("Given a translations prop / When the item props are read / Then the host's label is used", () => {
  const h = mount({ translations: { ratingValueText: (index: number) => `${index} of 5 stars` } });
  assertEquals(h.api.getItemProps(h.item(4))["aria-label"], "4 of 5 stars", "the host's translation names the star");
});

Deno.test("Given a translations prop that is not a function / When the item props are read / Then the default stands", () => {
  const h = mount({ translations: { ratingValueText: "nope" } });
  assertEquals(h.api.getItemProps(h.item(2))["aria-label"], "2 stars", "the default translation stands");
});

Deno.test("Given a group / When the bags are read twice / Then the same objects come back", () => {
  const h = mount({ defaultValue: "3" });
  assertEquals(h.api.getRootProps(), h.api.getRootProps(), "the root bag is stable");
  assertEquals(h.api.getControlProps(), h.api.getControlProps(), "so is the control's");
  assertEquals(h.api.getLabelProps(), h.api.getLabelProps(), "and the label's");
  assertEquals(h.api.getItemProps(h.item(3)), h.api.getItemProps(h.item(3)), "and the item's");
  assertEquals(h.api.getItems(), h.api.getItems(), "and the item list");
});

Deno.test("Given a group / When the value moves / Then the bags that read it are rebuilt and the rest are not", () => {
  const h = mount({ defaultValue: "3" });
  const before = h.api.getItemProps(h.item(4));
  const label = h.api.getLabelProps();
  h.api.setValue(4);
  assertEquals(h.api.getItemProps(h.item(4)) === before, false, "the item that changed is rebuilt");
  assertEquals(h.api.getLabelProps() === label, true, "the label reads no value, so it is untouched");
});

Deno.test("Given a group / When the value moves / Then the item handlers keep their identity", () => {
  const h = mount();
  const onClick = handler<() => void>(h.api.getItemProps(h.item(3)), "onClick");
  h.api.setValue(3);
  assertEquals(handler<() => void>(h.api.getItemProps(h.item(3)), "onClick") === onClick, true, "a cached bag hands back the same handler");
});

Deno.test("Given one group's items / When each item's pointer handler runs / Then it previews its own star", () => {
  const h = mount({ allowHalf: true });
  groupMove(h);
  const handlers = h.api.getItems().map((item) => handler<(event: PointerEvent) => void>(h.api.getItemProps(item), "onPointerMove"));
  handlers[2]!(pointer(3, { clientX: 4 }));
  assertEquals(h.api.hoveredValue, 2.5, "the third item's handler previews the third star");
  handlers[3]!(pointer(4, { clientX: 18 }));
  assertEquals(h.api.hoveredValue, 4, "the fourth item's handler previews the fourth star");
});
