import { assertEquals } from "@std/assert";
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

Deno.test("Given a fresh toast region / When nothing is authored / Then stack is the reachable start state", () => {
  const h = mount([]);
  assertEquals(h.api.layout, "stack", "the region starts laid out");
  assertEquals(h.api.count, 0, "the queue is empty");
  assertEquals(h.api.placement, "bottom", "bottom centers by default");
  assertEquals(
    h.api.getGroupProps()["role"],
    "region",
    "the region is a live region",
  );
  assertEquals(
    h.api.getGroupProps()["aria-label"],
    "Notifications, bottom",
    "the label names the placement",
  );
  assertEquals(
    h.api.getGroupProps()["data-side"],
    "bottom",
    "the side is on the region",
  );
  assertEquals(
    h.api.getGroupProps()["data-align"],
    "center",
    "the alignment is on the region",
  );
  assertEquals(
    h.api.getGroupProps()["data-empty"],
    "",
    "an empty region says so",
  );
  assertEquals(h.api.getGroupProps()["style"], {
    gap: "16px",
    bottom: "1rem",
    left: "50%",
    right: "50%",
  }, "the region's own box rides the style channel");
});

Deno.test("Given toasts on the items prop / When the region mounts / Then the queue holds them newest first", () => {
  const h = mount(ITEMS);
  assertEquals(IDS(h), ["two", "one"], "the newest toast is the front row");
  assertEquals(h.row("one").title, "First", "the entry keeps the host's title");
  assertEquals(h.row("two").type, "success", "the entry keeps the host's type");
  assertEquals(
    h.row("one").remaining,
    5000,
    "an unset duration is the type default",
  );
  assertEquals(
    h.row("two").remaining,
    2000,
    "a success toast lasts two seconds",
  );
  assertEquals(
    h.row("one").priority,
    8,
    "an unset priority is the type default: an unactionable info toast",
  );
  assertEquals(
    h.row("two").priority,
    7,
    "a success toast queues behind an unset one",
  );
  assertEquals(h.statuses, [
    { id: "two", status: "visible", src: "" },
    { id: "one", status: "visible", src: "" },
  ], "each arrival reports once, in queue order");
});

Deno.test("Given a row / When the entry beat has not run / Then the row waits below its settled offset", () => {
  const h = mount(ITEMS);
  const bag = h.bag("one");
  // `data-state` is the visibility: the row is visible, it has simply not
  // been painted into place yet, which is what `data-mounted` says.
  assertEquals(bag["data-state"], "open", "the row is visible");
  assertEquals(
    bag["data-mounted"],
    undefined,
    "nothing has reported the frame",
  );
  assertEquals(bag["role"], "status", "a toast is a status");
  assertEquals(
    bag["aria-labelledby"],
    "toast:toast:toast:one:title",
    "the title names the toast",
  );
  assertEquals(
    bag["aria-describedby"],
    "toast:toast:toast:one:description",
    "the description describes it",
  );
  assertEquals(bag["style"], {
    transform: "translateY(-16px)",
    scale: "0.96",
    opacity: "0",
    zIndex: "1",
  }, "an unmounted row waits at its offset, clear and slightly small");
});

Deno.test("Given a row / When the entry beat reports / Then the row opens and animates in", () => {
  const h = mount(ITEMS);
  clockOf(h.bag("two")).ready();
  const bag = h.bag("two");
  assertEquals(bag["data-state"], "open", "the row is open");
  assertEquals(bag["data-mounted"], "", "the frame is reported");
  const style = bag["style"] as Record<string, string>;
  assertEquals(style["opacity"], "1", "the row is opaque");
  assertEquals(style["scale"], "1", "and full size");
  assertEquals(
    style["transform"],
    "translateY(0px)",
    "the front row sits at the origin",
  );
  assertEquals(
    h.statuses.at(-1),
    { id: "one", status: "visible", src: "" },
    "the arrival already reported",
  );
});

// ---- the two states ------------------------------------------------------

Deno.test("Given an authored overlap / When the region mounts / Then overlap is the reachable start", () => {
  const h = mount(ITEMS, { overlap: true });
  assertEquals(h.api.layout, "overlap", "the region collapses its toasts");
  assertEquals(h.api.overlapping, true, "the api reports the mode");
  const bag = h.bag("one");
  assertEquals(bag["data-stack"], undefined, "a collapsed row is not stacked");
  assertEquals(bag["data-overlap"], "", "a collapsed row says overlap");
});

Deno.test("Given an overlapping region / When the host writes overlap false / Then stack is reachable again", () => {
  const h = mount(ITEMS, { overlap: true });
  assertEquals(h.api.layout, "overlap", "it starts collapsed");
  h.write("overlap", false);
  assertEquals(h.api.layout, "stack", "the host's write returns to stack");
  assertEquals(h.bag("one")["data-stack"], "", "the rows stack again");
});

Deno.test("Given an overlapping region / When the pointer enters / Then the region expands and pauses", () => {
  const h = mount(ITEMS, { overlap: true });
  h.enterRegion();
  assertEquals(h.api.layout, "stack", "hovering expands the toasts");
  assertEquals(h.api.paused, true, "the region is paused");
  assertEquals(STATUS(h, "one"), "persist", "the clock is held");
  assertEquals(h.bag("one")["data-paused"], "", "the row reports the pause");
  const clock = clockOf(h.bag("one"));
  assertEquals(clock.paused, true, "the clock action is told to hold");
  assertEquals(
    clock.remaining,
    5000,
    "the remainder is untouched until the action reports it",
  );
});

Deno.test("Given a paused clock / When the action reports its remainder / Then the machine holds that number", () => {
  const h = mount(ITEMS);
  h.enterRegion();
  clockOf(h.bag("one")).pause(1800);
  assertEquals(
    clockOf(h.bag("one")).remaining,
    1800,
    "the remainder is the reported one",
  );
  clockOf(h.bag("one")).ready();
  assertEquals(
    h.statuses.some((change) =>
      change.id === "one" && change.status === "dismissing"
    ),
    false,
    "a pause is not a dismissal",
  );
});

Deno.test("Given a stacked paused region / When the pointer leaves / Then the toasts resume", () => {
  const h = mount(ITEMS);
  h.enterRegion();
  clockOf(h.bag("one")).pause(1800);
  assertEquals(STATUS(h, "one"), "persist", "the clock is held");
  h.leaveRegion();
  assertEquals(h.api.paused, false, "the region is live again");
  assertEquals(STATUS(h, "one"), "visible", "the clock resumes");
  const clock = clockOf(h.bag("one"));
  assertEquals(clock.paused, false, "the action is told to run");
  assertEquals(clock.remaining, 1800, "the clock resumes from the remainder");
});

Deno.test("Given an overlapping region / When the pointer leaves / Then the region collapses again", () => {
  const h = mount(ITEMS, { overlap: true });
  h.enterRegion();
  assertEquals(h.api.layout, "stack", "hover expanded the region");
  h.leaveRegion();
  assertEquals(h.api.layout, "overlap", "leaving collapses it again");
  assertEquals(STATUS(h, "one"), "visible", "and the clocks resume");
});

// ---- REGION.FOCUS / REGION.BLUR -----------------------------------------

Deno.test("Given a region / When it takes focus / Then the toasts pause and stay stacked", () => {
  const h = mount(ITEMS);
  h.focusRegion();
  assertEquals(h.api.paused, true, "focus pauses the region");
  assertEquals(STATUS(h, "one"), "persist", "the clock is held");
  assertEquals(h.api.layout, "stack", "focus does not move a stacked region");
});

Deno.test("Given a focused region with the pointer out / When it blurs / Then stack resumes the clocks", () => {
  const h = mount(ITEMS);
  h.focusRegion();
  h.blurRegion();
  assertEquals(h.api.paused, false, "the region is live again");
  assertEquals(STATUS(h, "one"), "visible", "the clocks resume");
});

Deno.test("Given a focused overlapping region with the pointer out / When it blurs / Then it collapses and resumes", () => {
  const h = mount(ITEMS, { overlap: true });
  h.focusRegion();
  assertEquals(h.api.layout, "stack", "focus expanded the region");
  assertEquals(h.api.paused, true, "and paused the clocks");
  h.blurRegion();
  assertEquals(
    h.api.layout,
    "overlap",
    "the blur returns the region to overlap",
  );
  assertEquals(h.api.paused, false, "and resumes the clocks");
});

Deno.test("Given a focused region with the pointer inside / When it blurs / Then the pause is kept", () => {
  const h = mount(ITEMS);
  h.enterRegion();
  h.focusRegion();
  h.blurRegion();
  assertEquals(
    STATUS(h, "one"),
    "persist",
    "the pointer still holds the clocks",
  );
});

// ---- the queue ------------------------------------------------------------

Deno.test("Given a full region / When a higher priority toast arrives / Then it waits and the next removal promotes it", () => {
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
  assertEquals(IDS(h), ["b", "a"], "the region holds max, newest first");
  assertEquals(h.api.count, 2, "the queue counts the visible rows only");
  h.api.remove("b");
  assertEquals(
    IDS(h),
    ["c", "a"],
    "the error toast is promoted ahead of the waiting info toast",
  );
});

Deno.test("Given an existing id / When a create arrives for it / Then the entry updates in place", () => {
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
  assertEquals(entry.title, "Replaced", "the title is replaced");
  assertEquals(entry.description, "New body", "the body is replaced");
  assertEquals(entry.type, "warning", "the type is replaced");
  assertEquals(entry.action, "Undo", "the action label is replaced");
  assertEquals(entry.remaining, 3000, "a new clock starts on the update");
  assertEquals(h.api.count, 2, "no second row appears");
});

Deno.test("Given a row / When a partial update arrives / Then only the authored fields move", () => {
  const h = mount(ITEMS);
  h.api.update("one", { title: "Retitled" });
  const entry = h.row("one");
  assertEquals(entry.title, "Retitled", "the title moved");
  assertEquals(entry.description, "The first toast", "the body is kept");
  assertEquals(entry.type, "info", "the type is kept");
  assertEquals(entry.remaining, 5000, "the clock is kept");
});

Deno.test("Given a queue entry waiting for room / When an update names it / Then the waiting entry changes", () => {
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
  assertEquals(
    h.row("b").title,
    "B kept",
    "the update reached the waiting entry",
  );
});

Deno.test("Given a queue / When the host drops an id / Then the row leaves without being remembered", () => {
  const h = mount(ITEMS);
  h.write("items", [ITEMS[0] as ToastItem]);
  assertEquals(IDS(h), ["one"], "the dropped row leaves the queue");
  assertEquals(
    h.statuses.at(-1),
    { id: "two", status: "unmounted", src: "" },
    "the departure reports",
  );
  // The host's list is the source: re-adding the id is a re-show.
  h.write("items", ITEMS);
  assertEquals(IDS(h), ["two", "one"], "the host's re-add brings the row back");
});

Deno.test("Given a toast the machine dismissed / When the host writes the same list / Then it stays gone", () => {
  const h = mount(ITEMS);
  h.api.dismiss("one", "user");
  clockOf(h.bag("one")).remove();
  assertEquals(IDS(h), ["two"], "the row left the queue");
  h.write("items", ITEMS);
  assertEquals(
    IDS(h),
    ["two"],
    "a host write of the same list does not revive it",
  );
});

// ---- the lifecycle --------------------------------------------------------

Deno.test("Given a visible row / When Escape is pressed / Then it dismisses from the keyboard", () => {
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
  assertEquals(event.prevented, true, "the default is prevented");
  assertEquals(STATUS(h, "one"), "dismissing", "the exit is playing");
  assertEquals(h.bag("one")["data-state"], "closed", "the row reports closed");
  assertEquals(h.statuses.at(-1), {
    id: "one",
    status: "dismissing",
    src: "keyboard",
  }, "the src is keyboard");
});

Deno.test("Given a visible row / When the close trigger is clicked / Then it dismisses from the user", () => {
  const h = mount(ITEMS);
  assertEquals(
    h.api.getCloseTriggerProps(h.row("one"))["aria-label"],
    "Dismiss notification",
    "the trigger is labelled",
  );
  h.clickClose("one");
  assertEquals(STATUS(h, "one"), "dismissing", "the exit is playing");
  assertEquals(h.statuses.at(-1), {
    id: "one",
    status: "dismissing",
    src: "user",
  }, "the src is user");
});

Deno.test("Given a row with an action / When the action trigger is clicked / Then the host hears it and the toast dismisses", () => {
  const h = mount([{
    id: "one",
    title: "Saved",
    description: "",
    type: "success",
    duration: 0,
    priority: 0,
    action: "Undo",
  }]);
  assertEquals(
    h.api.getActionTriggerProps(h.row("one"))["hidden"],
    false,
    "the trigger shows with a label",
  );
  h.clickAction("one");
  assertEquals(h.actions, ["one"], "the host's action hears the id");
  assertEquals(STATUS(h, "one"), "dismissing", "and the toast dismisses");
  assertEquals(h.statuses.at(-1), {
    id: "one",
    status: "dismissing",
    src: "user",
  }, "the src is user");
});

Deno.test("Given a row with no action / Then the action trigger stays hidden", () => {
  const h = mount(ITEMS);
  assertEquals(
    h.api.getActionTriggerProps(h.row("one"))["hidden"],
    true,
    "no label, no trigger",
  );
});

Deno.test("Given a dismissed row / When the remove delay elapses / Then the queue lets go", () => {
  const h = mount(ITEMS);
  const clock = clockOf(h.bag("one"));
  assertEquals(clock.dismissing, false, "a visible row arms no remove clock");
  h.api.dismiss("one", "user");
  const exiting = clockOf(h.bag("one"));
  assertEquals(
    exiting.dismissing,
    true,
    "the exiting row arms the remove clock",
  );
  assertEquals(exiting.removeDelay, 200, "the delay is the prop's");
  exiting.remove();
  assertEquals(IDS(h), ["two"], "the row left the queue");
  assertEquals(
    h.statuses.at(-1),
    { id: "one", status: "unmounted", src: "" },
    "the departure reports",
  );
});

Deno.test("Given a visible clock / When the duration elapses / Then the row dismisses from the timer", () => {
  const h = mount(ITEMS);
  const clock = clockOf(h.bag("one"));
  assertEquals(
    clock.remaining,
    5000,
    "the clock counts down the type duration",
  );
  clock.timeout();
  assertEquals(STATUS(h, "one"), "dismissing", "the exit is playing");
  assertEquals(
    h.statuses.at(-1),
    { id: "one", status: "dismissing", src: "" },
    "the timer carries no src",
  );
});

Deno.test("Given a loading row / Then no clock ever elapses", () => {
  const h = mount([{
    id: "one",
    title: "Working",
    description: "",
    type: "loading",
    duration: 0,
    priority: 0,
    action: "",
  }]);
  assertEquals(
    h.row("one").remaining,
    Infinity,
    "a loading toast has no limit",
  );
  const clock = clockOf(h.bag("one"));
  assertEquals(clock.remaining, Infinity, "the action is handed the limit");
});

Deno.test("Given a paused region / When the page goes idle / Then every clock holds, and an active page releases them", () => {
  const h = mount(ITEMS, { pauseOnPageIdle: true });
  const params = actionParams(h.api.getGroupProps(), "toast-region");
  assertEquals(
    params["pauseOnPageIdle"],
    true,
    "the region action watches the page",
  );
  const idle = params["onIdleChange"] as (idle: boolean) => void;
  idle(true);
  assertEquals(h.api.paused, true, "a hidden page pauses the region");
  assertEquals(STATUS(h, "one"), "persist", "the clock is held");
  idle(false);
  assertEquals(STATUS(h, "one"), "visible", "the clock resumes");
});

Deno.test("Given a region / When the hotkey is authored / Then the region action watches those keys", () => {
  const h = mount(ITEMS, { hotkey: "altKey,KeyT" });
  const params = actionParams(h.api.getGroupProps(), "toast-region");
  assertEquals(
    params["hotkey"],
    ["altKey", "KeyT"],
    "the keys are split for the action",
  );
});

// ---- commands -------------------------------------------------------------

Deno.test("Given a queue / When dismissAll is called / Then every row plays its exit", () => {
  const h = mount(ITEMS);
  h.api.dismissAll();
  assertEquals(STATUS(h, "one"), "dismissing", "the first row exits");
  assertEquals(STATUS(h, "two"), "dismissing", "the second row exits");
});

Deno.test("Given a queue / When pause and resume are called / Then the clocks hold and release", () => {
  const h = mount(ITEMS);
  h.api.pause("one");
  assertEquals(STATUS(h, "one"), "persist", "the clock is held");
  h.api.resume("one");
  assertEquals(STATUS(h, "one"), "visible", "the clock resumes");
});

Deno.test("Given a queue / When remove is called / Then the row leaves", () => {
  const h = mount(ITEMS);
  h.api.remove("one");
  assertEquals(IDS(h), ["two"], "the row is gone");
});

Deno.test("Given a closable false region / Then the close trigger is hidden", () => {
  const h = mount(ITEMS, { closable: false });
  assertEquals(
    h.api.getCloseTriggerProps(h.row("one"))["hidden"],
    true,
    "no close trigger",
  );
});

// ---- geometry -------------------------------------------------------------

Deno.test("Given stacked rows with measured heights / Then each row's offset is the rows in front of it", () => {
  const h = mount(ITEMS);
  clockOf(h.bag("two")).ready();
  clockOf(h.bag("one")).ready();
  const measured = actionParams(h.bag("one"), "toast-row");
  assertEquals(
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
  assertEquals(
    front["transform"],
    "translateY(0px)",
    "the front row sits at the origin",
  );
  assertEquals(
    behind["transform"],
    "translateY(-48px)",
    "the front row's 32px plus a 16px gap",
  );
  assertEquals(front["zIndex"], "2", "the front row is on top");
  assertEquals(behind["zIndex"], "1", "the row behind is beneath it");
  assertEquals(h.bag("two")["data-first"], "", "the front row marks itself");
  assertEquals(
    h.bag("one")["data-sibling"],
    "",
    "the row behind marks itself as a sibling",
  );
});

Deno.test("Given a top placement / Then the offsets grow the other way", () => {
  const h = mount(ITEMS, { placement: "top-end" });
  clockOf(h.bag("two")).ready();
  clockOf(h.bag("one")).ready();
  const measured = actionParams(h.bag("one"), "toast-row");
  (measured["onHeight"] as (height: number) => void)(40);
  (actionParams(h.bag("two"), "toast-row")["onHeight"] as (
    height: number,
  ) => void)(32);
  assertEquals(
    (h.bag("one")["style"] as Record<string, string>)["transform"],
    "translateY(48px)",
    "the row below sits under the front",
  );
  assertEquals(h.bag("one")["data-side"], "top", "the side is on the row");
  assertEquals(
    h.bag("one")["data-align"],
    "end",
    "the alignment is on the row",
  );
  assertEquals(h.api.placement, "top-end", "the api reports the placement");
});

Deno.test("Given an overlapping region with three rows / Then the front scales and the rest peek behind", () => {
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
  assertEquals(
    rows.map((entry) => entry.id),
    ["three", "two", "one"],
    "newest first",
  );
  const front = h.bag("three")["style"] as Record<string, string>;
  const second = h.bag("two")["style"] as Record<string, string>;
  const third = h.bag("one")["style"] as Record<string, string>;
  assertEquals(front["scale"], "1", "the front row is full size");
  assertEquals(
    front["transform"],
    "translateY(0px)",
    "the front row sits at the origin",
  );
  assertEquals(
    second["transform"],
    "translateY(-16px)",
    "the second row peeks by the gap",
  );
  assertEquals(second["scale"], "0.95", "and shrinks a step");
  assertEquals(
    third["transform"],
    "translateY(-32px)",
    "the third row peeks by two gaps",
  );
  assertEquals(third["scale"], "0.9", "and shrinks two steps");
});

Deno.test("Given an overlapping region emptied by dismissals / Then the region collapses back", () => {
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
  assertEquals(h.api.layout, "stack", "hover expanded the region");
  h.api.remove("two");
  assertEquals(
    h.api.layout,
    "overlap",
    "an emptied overlapping region collapses",
  );
});

// ---- instance independence ------------------------------------------------

Deno.test("Given two regions on one page / When one takes a toast / Then the other keeps its own queue", () => {
  const first = mount(ITEMS);
  const second = mount([]);
  assertEquals(
    IDS(first),
    ["two", "one"],
    "the first region holds the host's list",
  );
  assertEquals(IDS(second), [], "the second region is empty");
  second.api.create({
    id: "three",
    title: "Third",
    description: "",
    type: "info",
    duration: 0,
    priority: 0,
    action: "",
  });
  assertEquals(IDS(second), ["three"], "the second region holds its own toast");
  assertEquals(IDS(first), ["two", "one"], "the first region is untouched");
  second.enterRegion();
  assertEquals(
    STATUS(second, "three"),
    "persist",
    "the second region's clocks hold",
  );
  assertEquals(
    STATUS(first, "one"),
    "visible",
    "the first region's clocks run",
  );
  assertEquals(first.api.layout, "stack", "and its posture is its own");
});
