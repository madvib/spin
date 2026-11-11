import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { signal } from "@spinjs/components/runtime";
import { steps } from "./steps.presentation.ts";
const createStepsBridge = steps.createBridge;
import type { StepsComplete } from "./steps.presentation.ts";
import type { StepsApi } from "./steps.presentation.ts";
import type { StepsInvalid, StepsStepChange } from "./steps.machine.ts";

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

const click = (): MouseEvent =>
  ({ defaultPrevented: false }) as unknown as MouseEvent;

interface Harness {
  readonly api: StepsApi;
  readonly root: Element;
  readonly events: {
    readonly stepChange: StepsStepChange[];
    readonly stepComplete: StepsComplete[];
    readonly stepInvalid: StepsInvalid[];
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
    stepChange: [] as StepsStepChange[],
    stepComplete: [] as StepsComplete[],
    stepInvalid: [] as StepsInvalid[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("count", 3);
  write(
    "onStepChange",
    (details: StepsStepChange) => events.stepChange.push(details),
  );
  write(
    "onStepComplete",
    (details: StepsComplete) => events.stepComplete.push(details),
  );
  write(
    "onStepInvalid",
    (details: StepsInvalid) => events.stepInvalid.push(details),
  );
  const bridge = createStepsBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "flow",
  );
  return { api: bridge.api, root, events, write };
}

test("next advances and prev retreats within the count", () => {
  const { api, events } = mount();
  deepStrictEqual(api.value, 0);
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.value, 1);
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.value, 2);
  handler<(e: MouseEvent) => void>(api.getPrevTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.value, 1);
  deepStrictEqual(events.stepChange.map((change) => change.step), [1, 2, 1]);
});

test("next clamps at the count and completes", () => {
  const { api, events } = mount();
  api.setStep(3);
  assert(api.completed);
  deepStrictEqual(events.stepComplete.length, 1);
  deepStrictEqual(events.stepComplete[0]?.step, 3);
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.value, 3);
});

test("a failing validator refuses forward motion and reports invalid", () => {
  const { api, events } = mount({ isStepValid: () => false });
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.value, 0);
  deepStrictEqual(events.stepChange.length, 0);
  deepStrictEqual(events.stepInvalid.length, 1);
  deepStrictEqual(events.stepInvalid[0], {
    step: 0,
    action: "next",
    targetStep: 1,
  });
});

test("backward motion is always legal, even when invalid", () => {
  const { api, events } = mount({ isStepValid: () => false });
  api.setStep(0);
  // Backward SET bypasses validation by definition (target <= current).
  handler<(e: MouseEvent) => void>(api.getPrevTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.value, 0);
  deepStrictEqual(events.stepInvalid.length, 0);
});

test("a skippable step bypasses validation", () => {
  const { api, events } = mount({
    isStepValid: () => false,
    isStepSkippable: (index: number) => index === 0,
  });
  handler<(e: MouseEvent) => void>(api.getNextTriggerProps(), "onClick")(
    click(),
  );
  deepStrictEqual(api.value, 1);
  deepStrictEqual(events.stepInvalid.length, 0);
});

test("linear mode refuses trigger jumps", () => {
  const { api, events } = mount({ linear: true });
  handler<(e: MouseEvent) => void>(api.getTriggerProps(2), "onClick")(click());
  deepStrictEqual(api.value, 0);
  deepStrictEqual(events.stepChange.length, 0);
});

test("non-linear trigger jumps to the step", () => {
  const { api, events } = mount();
  handler<(e: MouseEvent) => void>(api.getTriggerProps(2), "onClick")(click());
  deepStrictEqual(api.value, 2);
  deepStrictEqual(events.stepChange.length, 1);
});

test("authored step seeds the flow at mount", () => {
  const { api, events } = mount({ step: 1 });
  deepStrictEqual(api.value, 1);
  deepStrictEqual(events.stepChange.length, 0);
});

test("a host write post-mount moves nothing without an event", () => {
  const { api, events, write } = mount({ step: 1 });
  write("step", 2);
  deepStrictEqual(
    api.value,
    1,
    "post-mount writes are inert; selection travels by event",
  );
  deepStrictEqual(events.stepChange.length, 0);
  api.setStep(2);
  deepStrictEqual(api.value, 2, "the command sends the event that moves it");
  deepStrictEqual(events.stepChange.length, 1);
});

test("reset returns to zero", () => {
  const { api } = mount();
  api.setStep(2);
  deepStrictEqual(api.value, 2);
  api.resetStep();
  deepStrictEqual(api.value, 0);
  assert(!api.hasPrevStep);
  assert(api.hasNextStep);
});
