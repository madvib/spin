import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { toast } from "./toast.presentation.ts";
const createToastBridge = toast.createBridge;
import type { ToastStatusChange } from "./toast.presentation.ts";
import type { ToastApi, ToastItem } from "./toast.presentation.ts";
import type { ToastEntry } from "./toast.machine.ts";

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
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one
 * is checked here and typed once.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/**
 * The `use:name` entry a bag carries is data, which is what makes a reflex
 * testable without a browser: the params are read back and their callbacks
 * invoked exactly as the action would.
 */
function actionParams(
  bag: Record<string, unknown>,
  action: string,
): Record<string, unknown> {
  const entry: unknown = bag[`use:${action}`];
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`no action param at use:${action}`);
  }
  return entry as Record<string, unknown>;
}

/** The dismissal-clock params on a row, read as the action reads them. */
interface Clock {
  readonly remaining: number;
  readonly paused: boolean;
  readonly dismissing: boolean;
  readonly removeDelay: number;
  readonly timeout: () => void;
  readonly remove: () => void;
  readonly pause: (remaining: number) => void;
  readonly ready: () => void;
}

function clockOf(bag: Record<string, unknown>): Clock {
  const params = actionParams(bag, "toast-timer");
  return {
    remaining: params["remaining"] as number,
    paused: params["paused"] as boolean,
    dismissing: params["dismissing"] as boolean,
    removeDelay: params["removeDelay"] as number,
    timeout: params["onTimeout"] as () => void,
    remove: params["onRemove"] as () => void,
    pause: params["onPause"] as (remaining: number) => void,
    ready: params["onReady"] as () => void,
  };
}

const ITEMS: ToastItem[] = [
  {
    id: "one",
    title: "First",
    description: "The first toast",
    type: "info",
    duration: 0,
    priority: 0,
    action: "",
  },
  {
    id: "two",
    title: "Second",
    description: "The second toast",
    type: "success",
    duration: 0,
    priority: 0,
    action: "",
  },
];

interface Harness {
  readonly api: ToastApi;
  readonly root: Element;
  readonly statuses: ToastStatusChange[];
  readonly actions: string[];
  row(id: string): ToastEntry;
  bag(id: string): Record<string, unknown>;
  pressEscape(id: string): void;
  clickClose(id: string): void;
  clickAction(id: string): void;
  enterRegion(): void;
  leaveRegion(): void;
  focusRegion(): void;
  blurRegion(): void;
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them. */
function mount(
  items: ToastItem[],
  overrides: Readonly<Record<string, unknown>> = {},
): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const statuses: ToastStatusChange[] = [];
  const actions: string[] = [];
  root.addEventListener("toast-action", (event) => {
    const detail = (event as CustomEvent<{ id: string }>).detail;
    actions.push(detail.id);
  });
  const values: Record<string, WriteSignal> = {};
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  write("items", items);
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onStatusChange", (change: ToastStatusChange) => statuses.push(change));
  const bridge = createToastBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = () => true;
      return record;
    },
    () => root,
    "toast",
  );
  const find = (id: string): ToastEntry => {
    const found = bridge.api.getToasts().find((entry) => entry.id === id);
    if (found === undefined) throw new Error(`no toast ${id}`);
    return found;
  };
  return {
    api: bridge.api,
    root,
    statuses,
    actions,
    row: find,
    bag: (id) => bridge.api.getToastProps(find(id)),
    pressEscape: (id) =>
      handler<(event: KeyboardEvent) => void>(
        bridge.api.getToastProps(find(id)),
        "onKeydown",
      )({
        key: "Escape",
        defaultPrevented: false,
        preventDefault: () => {},
      } as unknown as KeyboardEvent),
    clickClose: (id) =>
      handler<(event: MouseEvent) => void>(
        bridge.api.getCloseTriggerProps(find(id)),
        "onClick",
      )({
        defaultPrevented: false,
      } as unknown as MouseEvent),
    clickAction: (id) =>
      handler<(event: MouseEvent) => void>(
        bridge.api.getActionTriggerProps(find(id)),
        "onClick",
      )({
        defaultPrevented: false,
      } as unknown as MouseEvent),
    enterRegion: () =>
      handler<() => void>(bridge.api.getGroupProps(), "onMouseEnter")(),
    leaveRegion: () =>
      handler<() => void>(bridge.api.getGroupProps(), "onMouseLeave")(),
    focusRegion: () =>
      handler<(event: FocusEvent) => void>(
        bridge.api.getGroupProps(),
        "onFocus",
      )({
        relatedTarget: null,
      } as unknown as FocusEvent),
    blurRegion: () =>
      handler<(event: FocusEvent) => void>(
        bridge.api.getGroupProps(),
        "onBlur",
      )({
        relatedTarget: null,
      } as unknown as FocusEvent),
    write,
  };
}

const IDS = (h: Harness): readonly string[] =>
  h.api.getToasts().map((entry) => entry.id);

const STATUS = (h: Harness, id: string): string => h.row(id).status;

// ---- the start state -----------------------------------------------------

test("Given a fresh toast region / When nothing is authored / Then stack is the reachable start state", () => {
  const h = mount([]);
  deepStrictEqual(h.api.layout, "stack", "the region starts laid out");
  deepStrictEqual(h.api.count, 0, "the queue is empty");
  deepStrictEqual(h.api.placement, "bottom", "bottom centers by default");
  deepStrictEqual(
    h.api.getGroupProps()["role"],
    "region",
    "the region is a live region",
  );
  deepStrictEqual(
    h.api.getGroupProps()["aria-label"],
    "Notifications, bottom",
    "the label names the placement",
  );
  deepStrictEqual(
    h.api.getGroupProps()["data-side"],
    "bottom",
    "the side is on the region",
  );
  deepStrictEqual(
    h.api.getGroupProps()["data-align"],
    "center",
    "the alignment is on the region",
  );
  deepStrictEqual(
    h.api.getGroupProps()["data-empty"],
    "",
    "an empty region says so",
  );
  deepStrictEqual(h.api.getGroupProps()["style"], {
    gap: "16px",
    bottom: "1rem",
    left: "50%",
    right: "50%",
  }, "the region's own box rides the style channel");
});

test("Given toasts on the items prop / When the region mounts / Then the queue holds them newest first", () => {
  const h = mount(ITEMS);
  deepStrictEqual(IDS(h), ["two", "one"], "the newest toast is the front row");
  deepStrictEqual(h.row("one").title, "First", "the entry keeps the host's title");
  deepStrictEqual(h.row("two").type, "success", "the entry keeps the host's type");
  deepStrictEqual(
    h.row("one").remaining,
    5000,
    "an unset duration is the type default",
  );
  deepStrictEqual(
    h.row("two").remaining,
    2000,
    "a success toast lasts two seconds",
  );
  deepStrictEqual(
    h.row("one").priority,
    8,
    "an unset priority is the type default: an unactionable info toast",
  );
  deepStrictEqual(
    h.row("two").priority,
    7,
    "a success toast queues behind an unset one",
  );
  deepStrictEqual(h.statuses, [
    { id: "two", status: "visible", src: "" },
    { id: "one", status: "visible", src: "" },
  ], "each arrival reports once, in queue order");
});

test("Given a row / When the entry beat has not run / Then the row waits below its settled offset", () => {
  const h = mount(ITEMS);
  const bag = h.bag("one");
  // `data-state` is the visibility: the row is visible, it has simply not
  // been painted into place yet, which is what `data-mounted` says.
  deepStrictEqual(bag["data-state"], "open", "the row is visible");
  deepStrictEqual(
    bag["data-mounted"],
    undefined,
    "nothing has reported the frame",
  );
  deepStrictEqual(bag["role"], "status", "a toast is a status");
  deepStrictEqual(
    bag["aria-labelledby"],
    "toast:toast:toast:one:title",
    "the title names the toast",
  );
  deepStrictEqual(
    bag["aria-describedby"],
    "toast:toast:toast:one:description",
    "the description describes it",
  );
  deepStrictEqual(bag["style"], {
    transform: "translateY(-16px)",
    scale: "0.96",
    opacity: "0",
    zIndex: "1",
  }, "an unmounted row waits at its offset, clear and slightly small");
});

test("Given a row / When the entry beat reports / Then the row opens and animates in", () => {
  const h = mount(ITEMS);
  clockOf(h.bag("two")).ready();
  const bag = h.bag("two");
  deepStrictEqual(bag["data-state"], "open", "the row is open");
  deepStrictEqual(bag["data-mounted"], "", "the frame is reported");
  const style = bag["style"] as Record<string, string>;
  deepStrictEqual(style["opacity"], "1", "the row is opaque");
  deepStrictEqual(style["scale"], "1", "and full size");
  deepStrictEqual(
    style["transform"],
    "translateY(0px)",
    "the front row sits at the origin",
  );
  deepStrictEqual(
    h.statuses.at(-1),
    { id: "one", status: "visible", src: "" },
    "the arrival already reported",
  );
});

// ---- the two states ------------------------------------------------------

test("Given an authored overlap / When the region mounts / Then overlap is the reachable start", () => {
  const h = mount(ITEMS, { overlap: true });
  deepStrictEqual(h.api.layout, "overlap", "the region collapses its toasts");
  deepStrictEqual(h.api.overlapping, true, "the api reports the mode");
  const bag = h.bag("one");
  deepStrictEqual(bag["data-stack"], undefined, "a collapsed row is not stacked");
  deepStrictEqual(bag["data-overlap"], "", "a collapsed row says overlap");
});

test("Given an overlapping region / When the host writes overlap false / Then stack is reachable again", () => {
  const h = mount(ITEMS, { overlap: true });
  deepStrictEqual(h.api.layout, "overlap", "it starts collapsed");
  h.write("overlap", false);
  deepStrictEqual(h.api.layout, "stack", "the host's write returns to stack");
  deepStrictEqual(h.bag("one")["data-stack"], "", "the rows stack again");
});

test("Given an overlapping region / When the pointer enters / Then the region expands and pauses", () => {
  const h = mount(ITEMS, { overlap: true });
  h.enterRegion();
  deepStrictEqual(h.api.layout, "stack", "hovering expands the toasts");
  deepStrictEqual(h.api.paused, true, "the region is paused");
  deepStrictEqual(STATUS(h, "one"), "persist", "the clock is held");
  deepStrictEqual(h.bag("one")["data-paused"], "", "the row reports the pause");
  const clock = clockOf(h.bag("one"));
  deepStrictEqual(clock.paused, true, "the clock action is told to hold");
  deepStrictEqual(
    clock.remaining,
    5000,
    "the remainder is untouched until the action reports it",
  );
});

test("Given a paused clock / When the action reports its remainder / Then the machine holds that number", () => {
  const h = mount(ITEMS);
  h.enterRegion();
  clockOf(h.bag("one")).pause(1800);
  deepStrictEqual(
    clockOf(h.bag("one")).remaining,
    1800,
    "the remainder is the reported one",
  );
  clockOf(h.bag("one")).ready();
  deepStrictEqual(
    h.statuses.some((change) =>
      change.id === "one" && change.status === "dismissing"
    ),
    false,
    "a pause is not a dismissal",
  );
});

test("Given a stacked paused region / When the pointer leaves / Then the toasts resume", () => {
  const h = mount(ITEMS);
  h.enterRegion();
  clockOf(h.bag("one")).pause(1800);
  deepStrictEqual(STATUS(h, "one"), "persist", "the clock is held");
  h.leaveRegion();
  deepStrictEqual(h.api.paused, false, "the region is live again");
  deepStrictEqual(STATUS(h, "one"), "visible", "the clock resumes");
  const clock = clockOf(h.bag("one"));
  deepStrictEqual(clock.paused, false, "the action is told to run");
  deepStrictEqual(clock.remaining, 1800, "the clock resumes from the remainder");
});

test("Given an overlapping region / When the pointer leaves / Then the region collapses again", () => {
  const h = mount(ITEMS, { overlap: true });
  h.enterRegion();
  deepStrictEqual(h.api.layout, "stack", "hover expanded the region");
  h.leaveRegion();
  deepStrictEqual(h.api.layout, "overlap", "leaving collapses it again");
  deepStrictEqual(STATUS(h, "one"), "visible", "and the clocks resume");
});

// ---- REGION.FOCUS / REGION.BLUR -----------------------------------------

test("Given a region / When it takes focus / Then the toasts pause and stay stacked", () => {
  const h = mount(ITEMS);
  h.focusRegion();
  deepStrictEqual(h.api.paused, true, "focus pauses the region");
  deepStrictEqual(STATUS(h, "one"), "persist", "the clock is held");
  deepStrictEqual(h.api.layout, "stack", "focus does not move a stacked region");
});

test("Given a focused region with the pointer out / When it blurs / Then stack resumes the clocks", () => {
  const h = mount(ITEMS);
  h.focusRegion();
  h.blurRegion();
  deepStrictEqual(h.api.paused, false, "the region is live again");
  deepStrictEqual(STATUS(h, "one"), "visible", "the clocks resume");
});

test("Given a focused overlapping region with the pointer out / When it blurs / Then it collapses and resumes", () => {
  const h = mount(ITEMS, { overlap: true });
  h.focusRegion();
  deepStrictEqual(h.api.layout, "stack", "focus expanded the region");
  deepStrictEqual(h.api.paused, true, "and paused the clocks");
  h.blurRegion();
  deepStrictEqual(
    h.api.layout,
    "overlap",
    "the blur returns the region to overlap",
  );
  deepStrictEqual(h.api.paused, false, "and resumes the clocks");
});

test("Given a focused region with the pointer inside / When it blurs / Then the pause is kept", () => {
  const h = mount(ITEMS);
  h.enterRegion();
  h.focusRegion();
  h.blurRegion();
  deepStrictEqual(
    STATUS(h, "one"),
    "persist",
    "the pointer still holds the clocks",
  );
});

// ---- the queue ------------------------------------------------------------

test("Given a full region / When a higher priority toast arrives / Then it waits and the next removal promotes it", () => {
  const h = mount([], { max: 2 });
  h.api.create({
    id: "a",
    title: "A",
    description: "",
    type: "info",
    duration: 0,
    priority: 0,
    action: "",
  });
  h.api.create({
    id: "b",
    title: "B",
    description: "",
    type: "info",
    duration: 0,
    priority: 0,
    action: "",
  });
  h.api.create({
    id: "c",
    title: "C",
    description: "",
    type: "error",
    duration: 0,
    priority: 0,
    action: "",
  });
  deepStrictEqual(IDS(h), ["b", "a"], "the region holds max, newest first");
  deepStrictEqual(h.api.count, 2, "the queue counts the visible rows only");
  h.api.remove("b");
  deepStrictEqual(
    IDS(h),
    ["c", "a"],
    "the error toast is promoted ahead of the waiting info toast",
  );
});

test("Given an existing id / When a create arrives for it / Then the entry updates in place", () => {
  const h = mount(ITEMS);
  h.api.create({
    id: "one",
    title: "Replaced",
    description: "New body",
    type: "warning",
    duration: 3000,
    priority: 0,
    action: "Undo",
  });
  const entry = h.row("one");
  deepStrictEqual(entry.title, "Replaced", "the title is replaced");
  deepStrictEqual(entry.description, "New body", "the body is replaced");
  deepStrictEqual(entry.type, "warning", "the type is replaced");
  deepStrictEqual(entry.action, "Undo", "the action label is replaced");
  deepStrictEqual(entry.remaining, 3000, "a new clock starts on the update");
  deepStrictEqual(h.api.count, 2, "no second row appears");
});

test("Given a row / When a partial update arrives / Then only the authored fields move", () => {
  const h = mount(ITEMS);
  h.api.update("one", { title: "Retitled" });
  const entry = h.row("one");
  deepStrictEqual(entry.title, "Retitled", "the title moved");
  deepStrictEqual(entry.description, "The first toast", "the body is kept");
  deepStrictEqual(entry.type, "info", "the type is kept");
  deepStrictEqual(entry.remaining, 5000, "the clock is kept");
});

test("Given a queue entry waiting for room / When an update names it / Then the waiting entry changes", () => {
  const h = mount([], { max: 1 });
  h.api.create({
    id: "a",
    title: "A",
    description: "",
    type: "info",
    duration: 0,
    priority: 0,
    action: "",
  });
  h.api.create({
    id: "b",
    title: "B",
    description: "",
    type: "info",
    duration: 0,
    priority: 0,
    action: "",
  });
  h.api.update("b", { title: "B kept" });
  h.api.remove("a");
  deepStrictEqual(
    h.row("b").title,
    "B kept",
    "the update reached the waiting entry",
  );
});

test("Given a queue / When the host drops an id / Then the row leaves without being remembered", () => {
  const h = mount(ITEMS);
  h.write("items", [ITEMS[0] as ToastItem]);
  deepStrictEqual(IDS(h), ["one"], "the dropped row leaves the queue");
  deepStrictEqual(
    h.statuses.at(-1),
    { id: "two", status: "unmounted", src: "" },
    "the departure reports",
  );
  // The host's list is the source: re-adding the id is a re-show.
  h.write("items", ITEMS);
  deepStrictEqual(IDS(h), ["two", "one"], "the host's re-add brings the row back");
});

test("Given a toast the machine dismissed / When the host writes the same list / Then it stays gone", () => {
  const h = mount(ITEMS);
  h.api.dismiss("one", "user");
  clockOf(h.bag("one")).remove();
  deepStrictEqual(IDS(h), ["two"], "the row left the queue");
  h.write("items", ITEMS);
  deepStrictEqual(
    IDS(h),
    ["two"],
    "a host write of the same list does not revive it",
  );
});

// ---- the lifecycle --------------------------------------------------------

test("Given a visible row / When Escape is pressed / Then it dismisses from the keyboard", () => {
  const h = mount(ITEMS);
  const event = {
    key: "Escape",
    defaultPrevented: false,
    prevented: false,
    preventDefault(): void {
      this.prevented = true;
    },
  };
  handler<(event: unknown) => void>(h.bag("one"), "onKeydown")(event);
  deepStrictEqual(event.prevented, true, "the default is prevented");
  deepStrictEqual(STATUS(h, "one"), "dismissing", "the exit is playing");
  deepStrictEqual(h.bag("one")["data-state"], "closed", "the row reports closed");
  deepStrictEqual(h.statuses.at(-1), {
    id: "one",
    status: "dismissing",
    src: "keyboard",
  }, "the src is keyboard");
});

test("Given a visible row / When the close trigger is clicked / Then it dismisses from the user", () => {
  const h = mount(ITEMS);
  deepStrictEqual(
    h.api.getCloseTriggerProps(h.row("one"))["aria-label"],
    "Dismiss notification",
    "the trigger is labelled",
  );
  h.clickClose("one");
  deepStrictEqual(STATUS(h, "one"), "dismissing", "the exit is playing");
  deepStrictEqual(h.statuses.at(-1), {
    id: "one",
    status: "dismissing",
    src: "user",
  }, "the src is user");
});

test("Given a row with an action / When the action trigger is clicked / Then the host hears it and the toast dismisses", () => {
  const h = mount([{
    id: "one",
    title: "Saved",
    description: "",
    type: "success",
    duration: 0,
    priority: 0,
    action: "Undo",
  }]);
  deepStrictEqual(
    h.api.getActionTriggerProps(h.row("one"))["hidden"],
    false,
    "the trigger shows with a label",
  );
  h.clickAction("one");
  deepStrictEqual(h.actions, ["one"], "the host's action hears the id");
  deepStrictEqual(STATUS(h, "one"), "dismissing", "and the toast dismisses");
  deepStrictEqual(h.statuses.at(-1), {
    id: "one",
    status: "dismissing",
    src: "user",
  }, "the src is user");
});

test("Given a row with no action / Then the action trigger stays hidden", () => {
  const h = mount(ITEMS);
  deepStrictEqual(
    h.api.getActionTriggerProps(h.row("one"))["hidden"],
    true,
    "no label, no trigger",
  );
});

test("Given a dismissed row / When the remove delay elapses / Then the queue lets go", () => {
  const h = mount(ITEMS);
  const clock = clockOf(h.bag("one"));
  deepStrictEqual(clock.dismissing, false, "a visible row arms no remove clock");
  h.api.dismiss("one", "user");
  const exiting = clockOf(h.bag("one"));
  deepStrictEqual(
    exiting.dismissing,
    true,
    "the exiting row arms the remove clock",
  );
  deepStrictEqual(exiting.removeDelay, 200, "the delay is the prop's");
  exiting.remove();
  deepStrictEqual(IDS(h), ["two"], "the row left the queue");
  deepStrictEqual(
    h.statuses.at(-1),
    { id: "one", status: "unmounted", src: "" },
    "the departure reports",
  );
});

test("Given a visible clock / When the duration elapses / Then the row dismisses from the timer", () => {
  const h = mount(ITEMS);
  const clock = clockOf(h.bag("one"));
  deepStrictEqual(
    clock.remaining,
    5000,
    "the clock counts down the type duration",
  );
  clock.timeout();
  deepStrictEqual(STATUS(h, "one"), "dismissing", "the exit is playing");
  deepStrictEqual(
    h.statuses.at(-1),
    { id: "one", status: "dismissing", src: "" },
    "the timer carries no src",
  );
});

test("Given a loading row / Then no clock ever elapses", () => {
  const h = mount([{
    id: "one",
    title: "Working",
    description: "",
    type: "loading",
    duration: 0,
    priority: 0,
    action: "",
  }]);
  deepStrictEqual(
    h.row("one").remaining,
    Infinity,
    "a loading toast has no limit",
  );
  const clock = clockOf(h.bag("one"));
  deepStrictEqual(clock.remaining, Infinity, "the action is handed the limit");
});

test("Given a paused region / When the page goes idle / Then every clock holds, and an active page releases them", () => {
  const h = mount(ITEMS, { pauseOnPageIdle: true });
  const params = actionParams(h.api.getGroupProps(), "toast-region");
  deepStrictEqual(
    params["pauseOnPageIdle"],
    true,
    "the region action watches the page",
  );
  const idle = params["onIdleChange"] as (idle: boolean) => void;
  idle(true);
  deepStrictEqual(h.api.paused, true, "a hidden page pauses the region");
  deepStrictEqual(STATUS(h, "one"), "persist", "the clock is held");
  idle(false);
  deepStrictEqual(STATUS(h, "one"), "visible", "the clock resumes");
});

test("Given a region / When the hotkey is authored / Then the region action watches those keys", () => {
  const h = mount(ITEMS, { hotkey: "altKey,KeyT" });
  const params = actionParams(h.api.getGroupProps(), "toast-region");
  deepStrictEqual(
    params["hotkey"],
    ["altKey", "KeyT"],
    "the keys are split for the action",
  );
});

// ---- commands -------------------------------------------------------------

test("Given a queue / When dismissAll is called / Then every row plays its exit", () => {
  const h = mount(ITEMS);
  h.api.dismissAll();
  deepStrictEqual(STATUS(h, "one"), "dismissing", "the first row exits");
  deepStrictEqual(STATUS(h, "two"), "dismissing", "the second row exits");
});

test("Given a queue / When pause and resume are called / Then the clocks hold and release", () => {
  const h = mount(ITEMS);
  h.api.pause("one");
  deepStrictEqual(STATUS(h, "one"), "persist", "the clock is held");
  h.api.resume("one");
  deepStrictEqual(STATUS(h, "one"), "visible", "the clock resumes");
});

test("Given a queue / When remove is called / Then the row leaves", () => {
  const h = mount(ITEMS);
  h.api.remove("one");
  deepStrictEqual(IDS(h), ["two"], "the row is gone");
});

test("Given a closable false region / Then the close trigger is hidden", () => {
  const h = mount(ITEMS, { closable: false });
  deepStrictEqual(
    h.api.getCloseTriggerProps(h.row("one"))["hidden"],
    true,
    "no close trigger",
  );
});

// ---- geometry -------------------------------------------------------------

test("Given stacked rows with measured heights / Then each row's offset is the rows in front of it", () => {
  const h = mount(ITEMS);
  clockOf(h.bag("two")).ready();
  clockOf(h.bag("one")).ready();
  const measured = actionParams(h.bag("one"), "toast-row");
  deepStrictEqual(
    typeof measured["onHeight"],
    "function",
    "the row reports its height",
  );
  (measured["onHeight"] as (height: number) => void)(40);
  (actionParams(h.bag("two"), "toast-row")["onHeight"] as (
    height: number,
  ) => void)(32);
  const front = h.bag("two")["style"] as Record<string, string>;
  const behind = h.bag("one")["style"] as Record<string, string>;
  deepStrictEqual(
    front["transform"],
    "translateY(0px)",
    "the front row sits at the origin",
  );
  deepStrictEqual(
    behind["transform"],
    "translateY(-48px)",
    "the front row's 32px plus a 16px gap",
  );
  deepStrictEqual(front["zIndex"], "2", "the front row is on top");
  deepStrictEqual(behind["zIndex"], "1", "the row behind is beneath it");
  deepStrictEqual(h.bag("two")["data-first"], "", "the front row marks itself");
  deepStrictEqual(
    h.bag("one")["data-sibling"],
    "",
    "the row behind marks itself as a sibling",
  );
});

test("Given a top placement / Then the offsets grow the other way", () => {
  const h = mount(ITEMS, { placement: "top-end" });
  clockOf(h.bag("two")).ready();
  clockOf(h.bag("one")).ready();
  const measured = actionParams(h.bag("one"), "toast-row");
  (measured["onHeight"] as (height: number) => void)(40);
  (actionParams(h.bag("two"), "toast-row")["onHeight"] as (
    height: number,
  ) => void)(32);
  deepStrictEqual(
    (h.bag("one")["style"] as Record<string, string>)["transform"],
    "translateY(48px)",
    "the row below sits under the front",
  );
  deepStrictEqual(h.bag("one")["data-side"], "top", "the side is on the row");
  deepStrictEqual(
    h.bag("one")["data-align"],
    "end",
    "the alignment is on the row",
  );
  deepStrictEqual(h.api.placement, "top-end", "the api reports the placement");
});

test("Given an overlapping region with three rows / Then the front scales and the rest peek behind", () => {
  const h = mount(
    [
      {
        id: "one",
        title: "One",
        description: "",
        type: "info",
        duration: 0,
        priority: 0,
        action: "",
      },
      {
        id: "two",
        title: "Two",
        description: "",
        type: "info",
        duration: 0,
        priority: 0,
        action: "",
      },
      {
        id: "three",
        title: "Three",
        description: "",
        type: "info",
        duration: 0,
        priority: 0,
        action: "",
      },
    ],
    { overlap: true },
  );
  for (const id of ["one", "two", "three"]) clockOf(h.bag(id)).ready();
  const rows = h.api.getToasts();
  deepStrictEqual(
    rows.map((entry) => entry.id),
    ["three", "two", "one"],
    "newest first",
  );
  const front = h.bag("three")["style"] as Record<string, string>;
  const second = h.bag("two")["style"] as Record<string, string>;
  const third = h.bag("one")["style"] as Record<string, string>;
  deepStrictEqual(front["scale"], "1", "the front row is full size");
  deepStrictEqual(
    front["transform"],
    "translateY(0px)",
    "the front row sits at the origin",
  );
  deepStrictEqual(
    second["transform"],
    "translateY(-16px)",
    "the second row peeks by the gap",
  );
  deepStrictEqual(second["scale"], "0.95", "and shrinks a step");
  deepStrictEqual(
    third["transform"],
    "translateY(-32px)",
    "the third row peeks by two gaps",
  );
  deepStrictEqual(third["scale"], "0.9", "and shrinks two steps");
});

test("Given an overlapping region emptied by dismissals / Then the region collapses back", () => {
  const h = mount(
    [
      {
        id: "one",
        title: "One",
        description: "",
        type: "info",
        duration: 0,
        priority: 0,
        action: "",
      },
      {
        id: "two",
        title: "Two",
        description: "",
        type: "info",
        duration: 0,
        priority: 0,
        action: "",
      },
    ],
    { overlap: true },
  );
  h.enterRegion();
  deepStrictEqual(h.api.layout, "stack", "hover expanded the region");
  h.api.remove("two");
  deepStrictEqual(
    h.api.layout,
    "overlap",
    "an emptied overlapping region collapses",
  );
});

// ---- instance independence ------------------------------------------------

test("Given two regions on one page / When one takes a toast / Then the other keeps its own queue", () => {
  const first = mount(ITEMS);
  const second = mount([]);
  deepStrictEqual(
    IDS(first),
    ["two", "one"],
    "the first region holds the host's list",
  );
  deepStrictEqual(IDS(second), [], "the second region is empty");
  second.api.create({
    id: "three",
    title: "Third",
    description: "",
    type: "info",
    duration: 0,
    priority: 0,
    action: "",
  });
  deepStrictEqual(IDS(second), ["three"], "the second region holds its own toast");
  deepStrictEqual(IDS(first), ["two", "one"], "the first region is untouched");
  second.enterRegion();
  deepStrictEqual(
    STATUS(second, "three"),
    "persist",
    "the second region's clocks hold",
  );
  deepStrictEqual(
    STATUS(first, "one"),
    "visible",
    "the first region's clocks run",
  );
  deepStrictEqual(first.api.layout, "stack", "and its posture is its own");
});
