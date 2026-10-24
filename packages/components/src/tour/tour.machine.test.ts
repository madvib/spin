import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { tour } from "./tour.presentation.ts";
const createTourBridge = tour.createBridge;
import type { TourApi } from "./tour.presentation.ts";
import { tour as tourMachine } from "./tour.machine.ts";
import type { TourStepRecord } from "./tour.state.ts";

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

type WriteSignal = { (): unknown; (value: unknown): void };

const STEPS: readonly TourStepRecord[] = [
  { id: "one", target: "#one", title: "First", description: "The first stop." },
  {
    id: "two",
    target: "#two",
    title: "Second",
    description: "The second stop.",
  },
];

interface Harness {
  readonly api: TourApi;
  readonly steps: number[];
  readonly dismisses: string[];
  /** Completed-count reads live; the counter is a closure cell. */
  readonly completed: () => number;
  readonly props: Record<string, WriteSignal>;
  dispose(): void;
}

function harness(initial: Record<string, unknown> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const steps: number[] = [];
  const dismisses: string[] = [];
  let completes = 0;
  const store = new Map<string, WriteSignal>();
  const props = (): Record<string, unknown> => {
    const bag: Record<string, unknown> = {};
    for (const [name, cell] of store) bag[name] = cell();
    bag["@@authored"] = (name: string): boolean => store.has(name);
    bag["steps"] = JSON.stringify(STEPS);
    bag["onStepChange"] = (d: { step: number }): void => {
      steps.push(d.step);
    };
    bag["onDismiss"] = (d: { reason: string }): void => {
      dismisses.push(d.reason);
    };
    bag["onComplete"] = (): void => {
      completes += 1;
    };
    return bag;
  };
  for (const [name, value] of Object.entries(initial)) {
    store.set(name, signal(value) as unknown as WriteSignal);
  }
  const bridge = createTourBridge(props, () => root, "test");
  return {
    api: bridge.api,
    steps,
    dismisses,
    completed: () => completes,
    props: Object.fromEntries(store) as Record<string, WriteSignal>,
    dispose: () => bridge.dispose(),
  };
}

test("Given an inactive tour / When it starts / Then the first step resolves", () => {
  const h = harness();
  deepStrictEqual(h.api.running, false);
  h.api.start();
  deepStrictEqual(h.api.running, true, "the tour runs");
  deepStrictEqual(h.api.state, "resolving", "and begins by resolving its target");
  deepStrictEqual(h.steps, [0], "one step-change to the first step");
  h.dispose();
});

test("Given a resolving step / When the target never appears / Then the tour ends not-found", () => {
  const h = harness();
  h.api.start();
  h.api.notifyTargetNotFound();
  deepStrictEqual(h.dismisses, ["not-found"], "the missing target reports");
  deepStrictEqual(h.api.running, false, "and the tour ends");
  h.dispose();
});

test("Given an active step / When the next fires / Then the new step re-resolves", () => {
  const h = harness();
  h.api.start();
  h.api.notifyTargetResolved();
  deepStrictEqual(h.api.state, "scrolling", "the resolved target scrolls");
  h.api.notifyScrollEnd();
  deepStrictEqual(h.api.state, "active", "and then the step is active");
  h.api.next();
  deepStrictEqual(h.api.step, 1, "next advances");
  deepStrictEqual(h.api.state, "resolving", "the new step re-resolves");
  deepStrictEqual(h.steps, [0, 1], "each move reports");
  h.dispose();
});

test("Given the first active step / When prev fires / Then nothing moves", () => {
  const h = harness();
  h.api.start();
  h.api.notifyTargetResolved();
  h.api.notifyScrollEnd();
  h.api.prev();
  deepStrictEqual(h.api.step, 0, "the first step holds");
  h.dispose();
});

test("Given the last step / When dismiss fires / Then it completes", () => {
  const h = harness();
  h.api.start();
  h.api.setStep(1);
  h.api.notifyTargetResolved();
  h.api.notifyScrollEnd();
  h.api.dismiss();
  deepStrictEqual(h.dismisses, ["complete"], "the last dismiss completes");
  deepStrictEqual(h.completed(), 1, "and the complete channel fires");
  deepStrictEqual(h.api.running, false, "and the tour ends");
  h.dispose();
});

test("Given a running tour / When skip fires / Then it ends as a skip", () => {
  const h = harness();
  h.api.start();
  h.api.skip();
  deepStrictEqual(h.dismisses, ["skip"], "the skip reason reports");
  h.dispose();
});

test("Given the bags / When read / Then the overlay hides while inactive", () => {
  const h = harness();
  deepStrictEqual(
    h.api.getRootProps()["data-state"],
    "closed",
    "the overlay is closed",
  );
  deepStrictEqual(
    h.api.getContentProps()["hidden"],
    true,
    "and the dialog hidden",
  );
  deepStrictEqual(
    h.api.getProgressTextProps()["text"],
    "0 of 2",
    "the progress counts from the start",
  );
  h.api.start();
  deepStrictEqual(
    h.api.getContentProps()["hidden"],
    false,
    "a running tour shows",
  );
  deepStrictEqual(
    h.api.getPrevTriggerProps()["hidden"],
    true,
    "the first step hides prev",
  );
  h.dispose();
});

test("Given an authored step / When it changes / Then the machine alternates", () => {
  const h = harness({ step: 1 });
  const cell = h.props["step"];
  if (cell === undefined) throw new Error("no step cell");
  cell(0);
  deepStrictEqual(h.api.step, 0, "the host's write alternates the step");
  h.dispose();
});

test("Given a resolving step / When the view reports the target's box / Then the machine holds the spotlight", () => {
  const machine = tourMachine({ steps: JSON.stringify(STEPS) }, () => true);
  const resolving = machine.transition(machine.initialState, { type: "START" });
  const measured = machine.transition(resolving, {
    type: "SPOTLIGHT.SET",
    x: 10,
    y: 20,
    w: 30,
    h: 40,
  });
  deepStrictEqual(measured.value, "resolving", "the step keeps resolving");
  deepStrictEqual(
    measured.context.spotlight,
    { x: 10, y: 20, w: 30, h: 40 },
    "the machine holds the target's box",
  );
});
