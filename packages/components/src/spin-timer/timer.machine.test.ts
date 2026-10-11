import { assertEquals, assertThrows } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createTimerBridge } from "./timer.bridge.ts";
import type { TimerTickChange } from "./timer.bridge.ts";
import type { TimerApi, TimerUnit } from "./timer.connect.ts";
import type { Time, TimePart } from "./timer.machine.ts";

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

/** The root bag's clock param, as the stdlib autoplay action reads it. */
interface ClockParam {
  readonly interval: number;
  readonly enabled: boolean;
  readonly onTick: () => void;
}

const click = (): MouseEvent => ({ defaultPrevented: false }) as unknown as MouseEvent;

/** The clock param object the root bag carries. Bags hand back
 * `Record<string, unknown>`, so the shape is checked once here. */
function clockOf(bag: Record<string, unknown>): ClockParam {
  const entry: unknown = bag["use:autoplay"];
  if (typeof entry !== "object" || entry === null) throw new Error("no clock on the root bag");
  return entry as ClockParam;
}

/** The tick is measured against the wall clock, so a test owns a virtual one:
 * each `tick(elapsed)` advances it, and the bridge's epoch capture reads the
 * same value the tick does. */
const realNow = Date.now;

interface Harness {
  readonly api: TimerApi;
  readonly events: {
    readonly tick: TimerTickChange[];
    readonly complete: number;
  };
  /** The clock the stdlib autoplay action is attached with. */
  clock(): ClockParam;
  /** Fires the stdlib action's tick after `elapsed` milliseconds of clock. */
  tick(elapsed?: number): void;
  press(action: string): void;
  units(): readonly TimerUnit[];
  state(): string;
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  // A virtual clock for this harness's lifetime: the bridge captures its
  // epoch through it and the tick's span is read through it, so a tick is
  // exactly the span under test instead of the wall clock's.
  const clock = { at: realNow() };
  Date.now = () => clock.at;
  const events = {
    tick: [] as TimerTickChange[],
    complete: 0,
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onTick", (change: TimerTickChange) => events.tick.push(change));
  write("onComplete", () => {
    events.complete += 1;
  });
  const bridge = createTimerBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "timer",
  );
  return {
    api: bridge.api,
    events,
    clock: () => clockOf(bridge.api.getRootProps()),
    tick: (elapsed = 0) => {
      clock.at += elapsed;
      clockOf(bridge.api.getRootProps()).onTick();
    },
    press: (action) => {
      const bag = bridge.api.getActionTriggerProps({ action: action as "start" });
      handler<(event: MouseEvent) => void>(bag, "onClick")(click());
    },
    units: () => bridge.api.getUnits(),
    state: () => String(bridge.api.getRootProps()["data-state"]),
    write,
  };
}

const time = (api: TimerApi): Time => api.time;
const formatted = (api: TimerApi): Readonly<Record<TimePart, string>> => api.formattedTime;
const hidden = (api: TimerApi, action: string): boolean =>
  api.getActionTriggerProps({ action: action as "start" })["hidden"] === true;

// ---- the start state ------------------------------------------------------

Deno.test("Given a fresh timer / When nothing is authored / Then idle holds a zero count", () => {
  const h = mount();
  assertEquals(h.api.running, false, "the api reports not running");
  assertEquals(h.api.paused, false, "the api reports not paused");
  assertEquals(h.state(), "idle", "idle is the reachable start state");
  assertEquals(time(h.api), { days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }, "the count starts at zero");
  assertEquals(
    formatted(h.api),
    { days: "00", hours: "00", minutes: "00", seconds: "00", milliseconds: "000" },
    "every unit is padded to its width",
  );
  assertEquals(h.api.progressPercent, 0, "a targetless stopwatch has no progress to report");
  assertEquals(h.events.tick, [], "nothing has ticked");
  assertEquals(h.events.complete, 0, "nothing has completed");
});

Deno.test("Given a fresh timer / When the triggers are read / Then only the phase's answers are visible", () => {
  const h = mount();
  assertEquals(hidden(h.api, "start"), false, "a stopped clock offers start");
  assertEquals(hidden(h.api, "pause"), true, "and hides pause");
  assertEquals(hidden(h.api, "resume"), true, "and hides resume");
  assertEquals(hidden(h.api, "reset"), true, "and hides reset");
  assertEquals(hidden(h.api, "restart"), false, "restart is always offered");
});

Deno.test("Given startMs / When the timer mounts / Then the count is seeded from it", () => {
  const h = mount({ startMs: 90_000 });
  assertEquals(time(h.api).minutes, 1, "startMs seeds the count");
  assertEquals(time(h.api).seconds, 30, "and the seconds unit follows");
  assertEquals(h.events.tick, [], "seeding reports no tick");
});

Deno.test("Given autoStart / When the timer mounts / Then running is the reachable start state", () => {
  const h = mount({ autoStart: true });
  assertEquals(h.state(), "running", "autoStart seeds the running phase");
  assertEquals(h.api.running, true, "the api reports running");
  assertEquals(hidden(h.api, "start"), true, "so start is gone");
  assertEquals(hidden(h.api, "pause"), false, "and pause is offered");
});

Deno.test("Given a startMs past a day / When the timer mounts / Then the days unit renders", () => {
  const h = mount({ startMs: 90_061_000 });
  assertEquals(time(h.api), { days: 1, hours: 1, minutes: 1, seconds: 1, milliseconds: 0 }, "the units carry their own part of the count");
  assertEquals(
    h.units().map((unit) => unit.type),
    ["days", "hours", "minutes", "seconds"],
    "a run past a day grows the days row",
  );
  assertEquals(h.units().at(-1)?.last, true, "the last visible unit takes no separator");
  assertEquals(
    h.api.getSeparatorProps({ after: "days" })["hidden"],
    false,
    "the separator after a visible days unit shows",
  );
});

// ---- START / PAUSE / RESUME ----------------------------------------------

Deno.test("Given an idle timer / When start runs / Then the running phase is reachable and the clock arms", () => {
  const h = mount();
  assertEquals(h.clock().enabled, false, "a stopped clock's interval is disarmed");
  h.api.start();
  assertEquals(h.state(), "running", "start moves to running");
  assertEquals(hidden(h.api, "start"), true, "start is answered by hiding it");
  assertEquals(hidden(h.api, "pause"), false, "pause takes its place");
  assertEquals(hidden(h.api, "reset"), false, "and reset is offered");
  assertEquals(h.clock().enabled, true, "the clock is armed while running");
});

Deno.test("Given a running timer / When pause runs / Then the paused phase is reachable and the clock disarms", () => {
  const h = mount();
  h.api.start();
  h.api.pause();
  assertEquals(h.state(), "paused", "pause moves to paused");
  assertEquals(h.api.paused, true, "the api reports paused");
  assertEquals(h.clock().enabled, false, "the clock is disarmed while paused");
  assertEquals(hidden(h.api, "pause"), true, "pause is hidden once paused");
  assertEquals(hidden(h.api, "resume"), false, "resume takes its place");
  assertEquals(hidden(h.api, "reset"), false, "and reset stays offered");
});

Deno.test("Given a paused timer / When resume runs / Then the running phase is reachable again", () => {
  const h = mount({ startMs: 2_000 });
  h.api.start();
  h.tick();
  h.api.pause();
  h.api.resume();
  assertEquals(h.state(), "running", "resume returns to running");
  assertEquals(time(h.api).seconds, 3, "and the count keeps what the tick left");
});

// ---- RESET / RESTART ------------------------------------------------------

Deno.test("Given a running timer / When reset runs / Then the count goes home and it keeps running", () => {
  const h = mount({ startMs: 3_000 });
  h.api.start();
  h.tick();
  assertEquals(time(h.api).seconds, 4, "the tick counted up");
  h.api.reset();
  assertEquals(h.state(), "running", "a running clock stays running through a reset");
  assertEquals(time(h.api).seconds, 3, "the count is back at startMs");
});

Deno.test("Given a paused timer / When reset runs / Then the idle phase is reachable again", () => {
  const h = mount({ startMs: 3_000 });
  h.api.start();
  h.api.pause();
  h.api.reset();
  assertEquals(h.state(), "idle", "a paused clock resets to idle");
  assertEquals(time(h.api).seconds, 3, "with the count at startMs");
});

Deno.test("Given a paused timer / When restart runs / Then the count goes home and it runs", () => {
  const h = mount({ startMs: 3_000 });
  h.api.start();
  h.tick();
  h.api.pause();
  h.api.restart();
  assertEquals(h.state(), "running", "restart runs from any phase");
  assertEquals(time(h.api).seconds, 3, "and the count is back at startMs");
});

Deno.test("Given an idle timer / When restart runs / Then it starts running from the start", () => {
  const h = mount({ startMs: 500 });
  h.api.restart();
  assertEquals(h.state(), "running", "restart also starts a stopped clock");
  assertEquals(time(h.api).milliseconds, 500, "from startMs");
});

// ---- TICK ----------------------------------------------------------------

Deno.test("Given a running stopwatch / When a tick arrives / Then the count advances one interval", () => {
  const h = mount({ interval: 250 });
  h.api.start();
  h.tick();
  assertEquals(time(h.api).milliseconds, 250, "one interval is counted");
  assertEquals(h.events.tick, [
    { value: 250, time: { days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 250 }, formattedTime: { days: "00", hours: "00", minutes: "00", seconds: "00", milliseconds: "250" } },
  ], "tick reports the new count and its parts");
});

Deno.test("Given a running stopwatch / When a tick's delta spans two intervals / Then only whole intervals count", () => {
  const h = mount({ interval: 1_000 });
  h.api.start();
  h.tick(2_500);
  assertEquals(time(h.api).seconds, 2, "the part interval below a whole one is dropped");
});

Deno.test("Given a running stopwatch / When a tick's delta is under an interval / Then it still counts one", () => {
  const h = mount({ interval: 1_000 });
  h.api.start();
  h.tick(300);
  assertEquals(time(h.api).seconds, 1, "a tick is worth the interval that just ran");
});

Deno.test("Given a running countdown / When a tick arrives / Then the count comes down", () => {
  const h = mount({ countdown: true, startMs: 5_000, interval: 1_000 });
  h.api.start();
  h.tick();
  assertEquals(time(h.api).seconds, 4, "a countdown decrements");
  assertEquals(h.events.tick.at(-1)?.value, 4_000, "and reports the new count");
});

Deno.test("Given a countdown at the target / When a tick would pass it / Then the count holds at the target", () => {
  const h = mount({ countdown: true, startMs: 5_000, targetMs: 1_000, interval: 1_000 });
  h.api.start();
  h.tick(4_000);
  assertEquals(time(h.api).seconds, 1, "the count is clamped at targetMs, not past it");
  // The guard reads the count as it was BEFORE the tick's own write, which is
  // Zag's ordering: the tick that lands on the target is counted, and the
  // next one ends the run.
  assertEquals(h.state(), "running", "the landing tick is still counted");
  h.tick();
  assertEquals(h.state(), "idle", "the next tick ends the run");
  assertEquals(h.events.complete, 1, "and completes once");
});

Deno.test("Given a stopwatch under the target / When a tick would pass it / Then the count holds at the target", () => {
  const h = mount({ startMs: 0, targetMs: 5_000, interval: 1_000 });
  h.api.start();
  h.tick(5_000);
  assertEquals(time(h.api).seconds, 5, "the count is clamped at targetMs");
  assertEquals(h.state(), "running", "the landing tick is still counted");
  h.tick();
  assertEquals(h.state(), "idle", "and the run is over");
  assertEquals(h.events.complete, 1, "with complete firing once");
});

Deno.test("Given a targetless stopwatch / When many ticks arrive / Then it never completes", () => {
  const h = mount({ interval: 1_000 });
  h.api.start();
  for (let n = 0; n < 20; n += 1) h.tick(1_000);
  assertEquals(h.state(), "running", "a stopwatch without a target runs on");
  assertEquals(time(h.api).seconds, 20, "and the count follows the ticks");
  assertEquals(h.events.complete, 0, "with nothing completing");
});

Deno.test("Given a countdown to zero / When the last tick arrives / Then it completes exactly once", () => {
  const h = mount({ countdown: true, startMs: 2_000, interval: 1_000 });
  h.api.start();
  h.tick();
  assertEquals(time(h.api).seconds, 1, "the first tick leaves one");
  assertEquals(h.state(), "running", "and keeps running");
  assertEquals(h.events.complete, 0, "with nothing completing");
  h.tick();
  assertEquals(time(h.api).seconds, 0, "the count reaches zero");
  assertEquals(h.state(), "running", "the landing tick is still counted");
  h.tick();
  assertEquals(h.state(), "idle", "the run ends");
  assertEquals(h.events.complete, 1, "complete fires once");
  assertEquals(h.events.tick.at(-1)?.value, 0, "the last tick still reports");
  // A started-but-finished clock completes on its next tick, exactly as Zag's
  // guard does: the count is already at the target.
  h.api.start();
  h.tick();
  assertEquals(h.events.complete, 2, "starting again completes at once");
});

Deno.test("Given a paused timer / When ticks would arrive / Then the clock reports nothing", () => {
  const h = mount({ startMs: 2_000, interval: 1_000 });
  h.api.start();
  h.api.pause();
  const last = h.events.tick.length;
  h.tick();
  assertEquals(h.events.tick.length, last, "a paused clock is not ticked by the view");
  assertEquals(time(h.api).seconds, 2, "and the count holds");
});

// ---- progress -------------------------------------------------------------

Deno.test("Given a countdown past its middle / When progress is read / Then it reports the part remaining", () => {
  const h = mount({ countdown: true, startMs: 5_000, interval: 500 });
  h.api.start();
  assertEquals(h.api.progressPercent, 1, "a fresh countdown is full");
  h.tick(2_500);
  assertEquals(h.api.progressPercent, 0.5, "half the count is half the progress");
  h.tick(2_500);
  assertEquals(h.api.progressPercent, 0, "an empty countdown is empty");
});

Deno.test("Given a stopwatch with a target / When progress is read / Then it reports the part done", () => {
  const h = mount({ startMs: 0, targetMs: 8_000, interval: 1_000 });
  h.api.start();
  assertEquals(h.api.progressPercent, 0, "a fresh stopwatch is empty");
  h.tick(2_000);
  assertEquals(h.api.progressPercent, 0.25, "a quarter of the count is a quarter done");
  h.tick(10_000);
  assertEquals(h.api.progressPercent, 1, "and progress never runs past the target");
});

// ---- the dom contract -----------------------------------------------------

Deno.test("Given a running countdown / When the parts are read / Then the contract is on them", () => {
  const h = mount({ countdown: true, startMs: 90_061_500, interval: 1_000 });
  h.api.start();
  const root = h.api.getRootProps();
  assertEquals(root["id"], "timer:timer:root", "the root carries the namespaced id");
  assertEquals(root["data-state"], "running", "the root states the phase");

  const area = h.api.getAreaProps();
  assertEquals(area["id"], "timer:timer:area", "the area carries the namespaced id");
  assertEquals(area["role"], "timer", "the area is a timer");
  assertEquals(area["aria-atomic"], true, "and announces itself atomically");
  assertEquals(area["aria-label"], "1 days 01:01:01", "the area label is the count a screen reader hears");
  assertEquals(area["style"], { "--timer-progress": "100.000%" }, "a fresh countdown shows a full bar");

  const item = h.api.getItemProps({ type: "seconds" });
  assertEquals(item["id"], "timer:timer:item:seconds", "the item carries its part id");
  assertEquals(item["data-type"], "seconds", "and its part");
  assertEquals(item["style"], { "--value": 1 }, "the item's value is the raw unit, sent as data");
  assertEquals(item["hidden"], undefined, "a seconds unit is never hidden");

  const value = h.api.getItemValueProps({ type: "seconds" });
  assertEquals(value["id"], "timer:timer:item-value:seconds", "the value part carries its own id");
  assertEquals(value["data-type"], "seconds", "and the same part");

  const label = h.api.getItemLabelProps({ type: "seconds" });
  assertEquals(label["id"], "timer:timer:item-label:seconds", "the label part carries its own id");

  const separator = h.api.getSeparatorProps({ after: "minutes" });
  assertEquals(separator["aria-hidden"], true, "a separator is decorative");
  assertEquals(separator["data-after"], "minutes", "and names the unit it follows");
  assertEquals(separator["hidden"], false, "it shows between visible units");

  const trigger = h.api.getActionTriggerProps({ action: "pause" });
  assertEquals(trigger["id"], "timer:timer:action-trigger:pause", "the trigger carries its own id");
  assertEquals(trigger["type"], "button", "and is a button");
  assertEquals(trigger["data-action"], "pause", "naming the command it sends");
});

Deno.test("Given a stopwatch under a day / When the days unit is read / Then it is hidden with its separator", () => {
  const h = mount({ startMs: 61_000 });
  const days = h.api.getItemProps({ type: "days" });
  assertEquals(days["hidden"], true, "a run that has not reached a day hides the unit");
  assertEquals(days["style"], { "--value": 0 }, "and still carries its zero value");
  assertEquals(
    h.api.getSeparatorProps({ after: "days" })["hidden"],
    true,
    "the separator after it goes too, so no colon leads the display",
  );
  assertEquals(
    h.units().map((unit) => unit.label),
    ["hrs", "min", "sec"],
    "the recipe's captions are what the rows render",
  );
});

Deno.test("Given a timer / When an action trigger is pressed / Then it sends that command", () => {
  const h = mount();
  h.press("start");
  assertEquals(h.state(), "running", "start runs the clock");
  h.press("pause");
  assertEquals(h.state(), "paused", "pause stops it");
  h.press("resume");
  assertEquals(h.state(), "running", "resume restarts it");
});

Deno.test("Given a timer / When an unknown action is asked for / Then the connect refuses it", () => {
  const h = mount();
  assertThrows(
    () => h.api.getActionTriggerProps({ action: "explode" as "start" }),
    Error,
    "[timer] Invalid action: explode. Must be one of: start, pause, resume, reset, restart",
  );
});

// ---- the controlled channels ---------------------------------------------

Deno.test("Given an authored currentMs / When the host writes a new one / Then the machine takes it", () => {
  const h = mount({ currentMs: 0 });
  h.write("currentMs", 7_500);
  assertEquals(time(h.api).seconds, 7, "the authored count alternates the machine's");
  assertEquals(h.state(), "idle", "and the phase is untouched");
});

Deno.test("Given an authored startMs / When the host writes a new one / Then the run restarts", () => {
  const h = mount({ startMs: 1_000 });
  h.api.start();
  h.tick();
  assertEquals(time(h.api).seconds, 2, "the clock ran");
  h.write("startMs", 5_000);
  assertEquals(time(h.api).seconds, 5, "a new startMs restarts the count");
  assertEquals(h.state(), "running", "and the run restarts with it");
});

Deno.test("Given an authored interval / When the host writes a faster one / Then the clock and the step follow", () => {
  const h = mount({ interval: 1_000 });
  assertEquals(h.clock().interval, 1_000, "the clock runs at the authored interval");
  h.api.start();
  h.write("interval", 250);
  assertEquals(h.clock().interval, 250, "a new interval re-arms the clock");
  h.tick(250);
  assertEquals(time(h.api).milliseconds, 250, "the step follows the new interval");
});

Deno.test("Given a date string startMs / When the timer mounts / Then it parses to milliseconds", () => {
  const h = mount({ startMs: "2026-01-01T00:00:01Z" });
  assertEquals(time(h.api).seconds, 1, "a date string is a millisecond count");
});

// ---- validation -----------------------------------------------------------

Deno.test("Given an interval of zero / When the timer mounts / Then it refuses to build", () => {
  assertThrows(
    () => mount({ interval: 0 }),
    Error,
    "[timer] Invalid interval: 0. Must be a positive number.",
  );
});

Deno.test("Given a negative startMs / When the timer mounts / Then it refuses to build", () => {
  assertThrows(
    () => mount({ startMs: -1 }),
    Error,
    "[timer] Invalid startMs: -1. Must be a non-negative number.",
  );
});

Deno.test("Given a countdown that starts at its target / When the timer mounts / Then it refuses to build", () => {
  assertThrows(
    () => mount({ countdown: true, startMs: 1_000, targetMs: 1_000 }),
    Error,
    "[timer] Invalid countdown configuration: startMs (1000) must be greater than targetMs (1000).",
  );
});

Deno.test("Given a stopwatch that starts at its target / When the timer mounts / Then it refuses to build", () => {
  assertThrows(
    () => mount({ startMs: 5_000, targetMs: 5_000 }),
    Error,
    "[timer] Invalid stopwatch configuration: startMs (5000) must be less than targetMs (5000).",
  );
});

Deno.test("Given a countdown with no target / When the timer mounts / Then it refuses a zero start", () => {
  assertThrows(
    () => mount({ countdown: true, startMs: 0 }),
    Error,
    "[timer] Invalid countdown configuration: startMs (0) must be greater than 0 when no targetMs is provided.",
  );
});

Deno.test("Given a well-formed stopwatch / When the timer mounts / Then it builds", () => {
  const h = mount({ startMs: 0, targetMs: 10_000 });
  assertEquals(h.state(), "idle", "the valid configuration builds and waits");
});
