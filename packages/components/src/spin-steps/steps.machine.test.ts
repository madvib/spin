import { assertEquals, assertThrows } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createMachine, interpret } from "@spin/runtime/fsm";
import { createStepsFsmBridge } from "./steps.bridge.ts";
import type { StepsStepChange, StepsStepInvalid } from "./steps.bridge.ts";
import type { StepsFsmApi } from "./steps.connect.ts";
import { config, implementations, type StepsContext, type StepsEvent } from "./steps.machine.ts";

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
 * linkedom ships no MouseEvent constructor, so the click the handlers need is
 * synthesized here with the field set each handler reads.
 */
const click = (defaultPrevented = false): MouseEvent =>
  ({ defaultPrevented }) as MouseEvent;

interface Harness {
  readonly api: StepsFsmApi;
  readonly root: Element;
  readonly host: Record<string, unknown>;
  readonly changes: StepsStepChange[];
  readonly completed: number;
  readonly invalid: StepsStepInvalid[];
  clickTrigger(index: number): void;
  clickNext(): void;
  clickPrev(): void;
  clickReset(): void;
  write(name: string, value: unknown): void;
  step(): number;
  dispose(): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const host = root as unknown as Record<string, unknown>;
  const changes: StepsStepChange[] = [];
  let completed = 0;
  const invalid: StepsStepInvalid[] = [];
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onStepChange", (change: StepsStepChange) => changes.push(change));
  write("onStepComplete", () => {
    completed += 1;
  });
  write("onStepInvalid", (change: StepsStepInvalid) => invalid.push(change));
  const bridge = createStepsFsmBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "steps",
  );
  return {
    api: bridge.api,
    root,
    host,
    changes,
    get completed(): number {
      return completed;
    },
    invalid,
    clickTrigger: (index) => handler<(event: MouseEvent) => void>(bridge.api.getTriggerProps(index), "onClick")(click()),
    clickNext: () => handler<(event: MouseEvent) => void>(bridge.api.getNextTriggerProps(), "onClick")(click()),
    clickPrev: () => handler<(event: MouseEvent) => void>(bridge.api.getPrevTriggerProps(), "onClick")(click()),
    clickReset: () => handler<(event: MouseEvent) => void>(bridge.api.getResetTriggerProps(), "onClick")(click()),
    write,
    step: () => bridge.api.value,
    dispose: () => bridge.dispose(),
  };
}

const PHASE = (h: Harness, index: number): Record<string, unknown> => ({
  complete: h.api.getItemState(index).completed,
  current: h.api.getItemState(index).current,
  incomplete: h.api.getItemState(index).incomplete,
});

// ---- the state chart -----------------------------------------------------
//
// Zag's chart is one state with every event on it, so the fork's root tier is
// the whole config: `idle` is entered at the start and nothing leaves it.
// Every event is exercised below, from that state.

Deno.test("Given the steps machine / When the service starts / Then idle is the state and every event keeps it", () => {
  const machine = createMachine<StepsContext, StepsEvent>(config, implementations);
  const svc = interpret(machine).start();
  assertEquals(svc.state.value, "idle", "idle is the start state");
  const events: StepsEvent[] = [
    { type: "STEP.SET", value: 0 },
    { type: "STEP.NEXT" },
    { type: "STEP.PREV" },
    { type: "STEP.RESET" },
    { type: "STEP.SYNC", value: 0 },
  ];
  for (const event of events) {
    svc.send(event);
    assertEquals(svc.state.value, "idle", `${event.type} leaves the state put`);
  }
  svc.stop();
});

// ---- the seed -------------------------------------------------------------

Deno.test("Given defaultStep and count / When the stepper mounts / Then the seed is the start value", () => {
  const h = mount({ count: 4, defaultStep: 2 });
  assertEquals(h.step(), 2, "defaultStep seeds the step");
  assertEquals(h.api.count, 4, "count seeds the total");
  assertEquals(h.api.getItemState(2).current, true, "the seeded step is the current one");
  assertEquals(h.api.getItemState(1).completed, true, "the ones before it are complete");
  assertEquals(h.changes, [], "seeding reports nothing");
  assertEquals(h.completed, 0, "and completes nothing");
  h.dispose();
});

Deno.test("Given a defaultStep past count / When the stepper mounts / Then the seed is refused", () => {
  assertThrows(
    () => mount({ count: 3, defaultStep: 4 }),
    RangeError,
    "[spin/steps] step index 4 is out of bounds",
    "an out-of-range seed is a host bug, as in Zag's entry guard",
  );
  assertThrows(
    () => mount({ count: 3, defaultStep: -1 }),
    RangeError,
    "[spin/steps] step index -1 is out of bounds",
    "and a negative one is too",
  );
});

Deno.test("Given no count / When the stepper mounts / Then one step is the total", () => {
  const h = mount();
  assertEquals(h.api.count, 1, "Zag's default count is 1");
  assertEquals(h.api.getSteps(), [0], "and the single step renders");
  h.dispose();
});

Deno.test("Given two steppers on one page / When the second mounts / Then the first keeps its own state", () => {
  const first = mount({ count: 4, defaultStep: 2 });
  const second = mount({ count: 3, defaultStep: 1 });
  assertEquals(first.step(), 2, "the first stepper keeps its seeded step");
  assertEquals(first.api.count, 4, "and its own total");
  assertEquals(second.step(), 1, "the second keeps its own seed");
  assertEquals(second.api.count, 3, "and its own total");
  first.clickNext();
  assertEquals(first.step(), 3, "a move in the first lands there");
  assertEquals(second.step(), 1, "and never reaches the second");
  assertEquals(second.api.getTriggerProps(1)["data-state"], "open", "which still reports its own current step");
  first.dispose();
  second.dispose();
});

// ---- STEP.NEXT ------------------------------------------------------------

Deno.test("Given a stepper / When next runs / Then the step advances and reports", () => {
  const h = mount({ count: 3 });
  h.clickNext();
  assertEquals(h.step(), 1, "next moves one step");
  assertEquals(h.changes, [{ step: 1 }], "step-change reports the new value");
  assertEquals(h.completed, 0, "completion is not reported before the last step");
  h.clickNext();
  assertEquals(h.step(), 2, "next moves again");
  assertEquals(h.changes, [{ step: 1 }, { step: 2 }], "each move reports");
  assertEquals(h.completed, 0, "the last visible step is not the complete position");
  h.clickNext();
  assertEquals(h.step(), 3, "next moves to the position past the last step");
  assertEquals(h.completed, 1, "which Zag calls complete: step === count");
  h.dispose();
});

Deno.test("Given a stepper on its complete position / When next runs / Then it stays and reports nothing", () => {
  const h = mount({ count: 2, defaultStep: 2 });
  h.clickNext();
  assertEquals(h.step(), 2, "next clamps at count");
  assertEquals(h.changes, [], "a clamped move does not report");
  assertEquals(h.api.hasNextStep, false, "the api reports no next step");
  assertEquals(h.api.getNextTriggerProps()["disabled"], true, "and the next trigger is disabled");
  h.dispose();
});

// ---- STEP.PREV ------------------------------------------------------------

Deno.test("Given a stepper on its first step / When prev runs / Then it stays and reports nothing", () => {
  const h = mount({ count: 3 });
  h.clickPrev();
  assertEquals(h.step(), 0, "prev clamps at zero");
  assertEquals(h.changes, [], "a clamped move does not report");
  assertEquals(h.api.hasPrevStep, false, "the api reports no previous step");
  assertEquals(h.api.getPrevTriggerProps()["disabled"], true, "and the prev trigger is disabled");
  h.dispose();
});

Deno.test("Given a stepper mid-way / When prev runs / Then the step goes back and reports", () => {
  const h = mount({ count: 3, defaultStep: 2 });
  h.clickPrev();
  assertEquals(h.step(), 1, "prev moves one step back");
  assertEquals(h.changes, [{ step: 1 }], "step-change reports the move");
  assertEquals(h.api.hasPrevStep, true, "the api reports a previous step");
  h.dispose();
});

// ---- STEP.RESET -----------------------------------------------------------

Deno.test("Given a stepper part-way through / When reset runs / Then the first step is back", () => {
  const h = mount({ count: 4, defaultStep: 3 });
  h.clickReset();
  assertEquals(h.step(), 0, "reset returns to the first step");
  assertEquals(h.changes, [{ step: 0 }], "step-change reports the move");
  assertEquals(h.completed, 0, "and nothing completes");
  h.dispose();
});

Deno.test("Given a stepper on its first step / When reset runs / Then nothing moves", () => {
  const h = mount({ count: 3 });
  h.clickReset();
  assertEquals(h.step(), 0, "the step is already first");
  assertEquals(h.changes, [], "and nothing reports");
  h.dispose();
});

// ---- STEP.SET -------------------------------------------------------------

Deno.test("Given a valid stepper / When a step is set / Then the step lands and reports", () => {
  const h = mount({ count: 3 });
  h.api.setStep(3);
  assertEquals(h.step(), 3, "set lands the index");
  assertEquals(h.changes, [{ step: 3 }], "step-change reports the move");
  assertEquals(h.completed, 1, "landing on count reports the completion");
  assertEquals(h.api.isCompleted, true, "the api reports completion");
  h.dispose();
});

Deno.test("Given a stepper / When a step is set / Then the trigger click is the same move", () => {
  const h = mount({ count: 4 });
  h.clickTrigger(2);
  assertEquals(h.step(), 2, "the trigger click sends STEP.SET");
  assertEquals(h.changes, [{ step: 2 }], "step-change reports it");
  h.dispose();
});

Deno.test("Given a stepper whose current step is invalid / When an earlier step is set / Then the move is allowed", () => {
  const h = mount({ count: 4, defaultStep: 2 });
  h.host["isStepValid"] = (index: number): boolean => index !== 2;
  h.api.setStep(1);
  assertEquals(h.step(), 1, "a jump backward is never guarded");
  assertEquals(h.invalid, [], "and nothing is refused");
  h.dispose();
});

Deno.test("Given a stepper whose current step is invalid / When a later step is set / Then the move is refused", () => {
  const h = mount({ count: 4 });
  h.host["isStepValid"] = (index: number): boolean => index !== 0;
  h.api.setStep(2);
  assertEquals(h.step(), 0, "the step does not move");
  assertEquals(h.changes, [], "and no change reports");
  assertEquals(
    h.invalid,
    [{ step: 0, action: "set", targetStep: 2 }],
    "step-invalid reports the refusal with the target asked for",
  );
  h.api.setStep(3);
  assertEquals(h.invalid, [
    { step: 0, action: "set", targetStep: 2 },
    { step: 0, action: "set", targetStep: 3 },
  ], "each refused set reports again",
  );
  h.dispose();
});

Deno.test("Given a stepper whose current step is invalid / When next runs / Then the move is refused", () => {
  const h = mount({ count: 4 });
  h.host["isStepValid"] = (index: number): boolean => index !== 1;
  h.api.setStep(1);
  h.changes.length = 0;
  h.clickNext();
  assertEquals(h.step(), 1, "next does not leave an invalid step");
  assertEquals(h.changes, [], "and reports no change");
  assertEquals(
    h.invalid,
    [{ step: 1, action: "next", targetStep: undefined }],
    "step-invalid reports the refused next",
  );
  h.dispose();
});

Deno.test("Given a stepper whose current step is skippable / When a later step is set / Then the move is allowed", () => {
  const h = mount({ count: 4 });
  h.host["isStepValid"] = (): boolean => false;
  h.host["isStepSkippable"] = (index: number): boolean => index === 0;
  h.api.setStep(3);
  assertEquals(h.step(), 3, "a skippable step is bypassed by a set");
  assertEquals(h.invalid, [], "and nothing is refused");
  h.dispose();
});

Deno.test("Given a stepper whose current step is skippable / When next runs / Then the move is allowed", () => {
  const h = mount({ count: 4 });
  // Step 1 is the invalid one and the skippable one: leaving it is free, but
  // reaching it still asked step 0, which is valid.
  h.host["isStepValid"] = (index: number): boolean => index !== 1;
  h.host["isStepSkippable"] = (index: number): boolean => index === 1;
  h.api.setStep(1);
  h.invalid.length = 0;
  h.clickNext();
  assertEquals(h.step(), 2, "a skippable step is bypassed by next");
  assertEquals(h.invalid, [], "and nothing is refused");
  h.dispose();
});

Deno.test("Given a stepper / When a step past count is set / Then Zag keeps the index", () => {
  const h = mount({ count: 3 });
  h.api.setStep(5);
  assertEquals(h.step(), 5, "STEP.SET is verbatim, as in Zag");
  assertEquals(h.api.percent, (5 / 3) * 100, "and the percent follows the verbatim index");
  assertEquals(h.api.isCompleted, false, "completion is equality with count, not a clamp");
  h.dispose();
});

// ---- STEP.SYNC: the controlled channel ------------------------------------

Deno.test("Given an authored step / When the host writes it / Then the machine follows without echoing", () => {
  const h = mount({ count: 4, step: 0 });
  h.write("step", 2);
  assertEquals(h.step(), 2, "the authored prop lands");
  assertEquals(h.changes, [], "the host's own write is not echoed back");
  h.clickNext();
  assertEquals(h.step(), 3, "a machine move from the authored step advances");
  assertEquals(h.changes, [{ step: 3 }], "and reports the move");
  h.dispose();
});

Deno.test("Given an authored step / When the host writes an invalid-jump index / Then it still lands", () => {
  const h = mount({ count: 4, step: 0 });
  h.host["isStepValid"] = (): boolean => false;
  h.write("step", 3);
  assertEquals(h.step(), 3, "Zag's bindable read returns the prop verbatim, so the guard never runs");
  h.dispose();
});

Deno.test("Given an authored step / When the host writes a step equal to the machine's / Then nothing moves", () => {
  const h = mount({ count: 4, step: 1 });
  h.write("step", 1);
  assertEquals(h.step(), 1, "the step is what it was");
  assertEquals(h.changes, [], "and nothing reports");
  h.dispose();
});

Deno.test("Given a stepper / When the count changes / Then the machine's total follows", () => {
  const h = mount({ count: 2, defaultStep: 1 });
  h.write("count", 5);
  assertEquals(h.api.count, 5, "the count is synced from scope");
  assertEquals(h.api.getSteps(), [0, 1, 2, 3, 4], "and the steps follow");
  assertEquals(h.api.hasNextStep, true, "the machine can now go forward");
  h.clickNext();
  assertEquals(h.step(), 2, "next lands on the new step");
  h.dispose();
});

// ---- the api's computed values -------------------------------------------

Deno.test("Given a stepper / When a step is set / Then the derived values follow", () => {
  const h = mount({ count: 4, defaultStep: 1 });
  assertEquals(h.api.percent, 25, "the percent is step over count");
  assertEquals(h.api.hasNextStep, true, "there is a next step");
  assertEquals(h.api.hasPrevStep, true, "and a previous one");
  assertEquals(h.api.isCompleted, false, "the stepper is not complete");
  h.api.setStep(4);
  assertEquals(h.api.percent, 100, "the last step is a full percent");
  assertEquals(h.api.hasNextStep, false, "and there is no next step");
  assertEquals(h.api.isCompleted, true, "the stepper is complete");
  h.dispose();
});

Deno.test("Given a stepper / When the validity predicates are read / Then the host decides", () => {
  const h = mount({ count: 3 });
  assertEquals(h.api.isStepValid(0), true, "an absent predicate means valid");
  assertEquals(h.api.isStepSkippable(0), false, "an absent predicate means not skippable");
  h.host["isStepValid"] = (index: number): boolean => index > 0;
  h.host["isStepSkippable"] = (index: number): boolean => index === 2;
  assertEquals(h.api.isStepValid(0), false, "the host's validity wins, read live");
  assertEquals(h.api.isStepValid(1), true, "for the index asked about");
  assertEquals(h.api.isStepSkippable(2), true, "and its skippability");
  assertEquals(h.api.getItemState(2).skippable, true, "the item state reports the skippable step");
  // The guard reads the same live predicate: leaving an invalid step 0 to
  // reach step 1 is refused.
  h.api.setStep(1);
  assertEquals(h.step(), 0, "the guard sees the predicate the host just wrote");
  h.api.setStep(0);
  h.invalid.length = 0;
  h.host["isStepValid"] = (): boolean => true;
  h.api.setStep(1);
  assertEquals(h.step(), 1, "and a later write re-opens the move");
  h.dispose();
});

// ---- getItemState ---------------------------------------------------------

Deno.test("Given a stepper mid-way / When the item states are read / Then each phase is reported", () => {
  const h = mount({ count: 3, defaultStep: 1 });
  assertEquals(
    h.api.getSteps().map((index) => PHASE(h, index)),
    [
      { complete: true, current: false, incomplete: false },
      { complete: false, current: true, incomplete: false },
      { complete: false, current: false, incomplete: true },
    ],
    "every index reports its phase",
  );
  const first = h.api.getItemState(0);
  const last = h.api.getItemState(2);
  assertEquals(first.first, true, "the first index is the first");
  assertEquals(first.last, false, "and not the last");
  assertEquals(last.first, false, "the last index is not the first");
  assertEquals(last.last, true, "and is the last");
  assertEquals(first.isValid(), true, "the validity read is lazy and true by default");
  h.dispose();
});

// ---- the DOM contract -----------------------------------------------------

Deno.test("Given a stepper / When the list is read / Then the tabs are wired to their panels", () => {
  const h = mount({ count: 3 });
  const list = h.api.getListProps();
  assertEquals(list["id"], "steps:steps:list", "the list carries the namespaced id");
  assertEquals(list["role"], "tablist", "the list is a tablist");
  assertEquals(list["aria-orientation"], "horizontal", "and announces the orientation");
  assertEquals(
    list["aria-owns"],
    "steps:steps:trigger:0 steps:steps:trigger:1 steps:steps:trigger:2",
    "the list owns every trigger",
  );
  const trigger = h.api.getTriggerProps(0);
  assertEquals(trigger["id"], "steps:steps:trigger:0", "the trigger carries its id");
  assertEquals(trigger["role"], "tab", "and is a tab");
  assertEquals(trigger["aria-selected"], true, "the first step is selected");
  assertEquals(trigger["aria-controls"], "steps:steps:content:0", "and controls its panel");
  assertEquals(trigger["type"], "button", "the trigger is a button");
  const content = h.api.getContentProps(0);
  assertEquals(content["id"], "steps:steps:content:0", "the panel carries its id");
  assertEquals(content["role"], "tabpanel", "and is a tabpanel");
  assertEquals(content["aria-labelledby"], "steps:steps:trigger:0", "labelled by its trigger");
  assertEquals(content["hidden"], false, "the current panel is shown");
  assertEquals(h.api.getContentProps(1)["hidden"], true, "and the others are hidden");
  h.dispose();
});

Deno.test("Given a stepper / When the step moves / Then every part's state attribute follows", () => {
  const h = mount({ count: 3 });
  const before = h.api.getTriggerProps(1);
  assertEquals(before["data-state"], "closed", "a non-current trigger is closed");
  assertEquals(before["data-incomplete"], "", "and reports incomplete");
  assertEquals(before["data-complete"], undefined, "with no complete flag");
  h.api.setStep(1);
  const after = h.api.getTriggerProps(1);
  assertEquals(after["data-state"], "open", "the current trigger is open");
  assertEquals(after["data-current"], "", "and reports current");
  assertEquals(after["data-complete"], undefined, "the current step is not complete");
  assertEquals(h.api.getIndicatorProps(0)["data-complete"], "", "the earlier indicator is complete");
  assertEquals(h.api.getSeparatorProps(0)["data-complete"], "", "and so is its rail");
  assertEquals(h.api.getItemProps(1)["aria-current"], "step", "the current item announces itself");
  h.dispose();
});

Deno.test("Given a linear stepper / When the trigger is read / Then only the current step is a tab stop", () => {
  const h = mount({ count: 3, linear: true, defaultStep: 1 });
  assertEquals(h.api.linear, true, "the api reports linear");
  assertEquals(h.api.getTriggerProps(1)["tabIndex"], 0, "the current step is a tab stop");
  assertEquals(h.api.getTriggerProps(0)["tabIndex"], -1, "the others are not");
  h.dispose();
});

Deno.test("Given a non-linear stepper / When the trigger is read / Then every step is a tab stop", () => {
  const h = mount({ count: 3 });
  assertEquals(h.api.linear, false, "the api reports non-linear");
  for (const index of h.api.getSteps()) {
    assertEquals(h.api.getTriggerProps(index)["tabIndex"], 0, `step ${index} is a tab stop`);
  }
  h.dispose();
});

Deno.test("Given a linear stepper / When a trigger is clicked / Then the step does not move", () => {
  const h = mount({ count: 3, linear: true });
  h.clickTrigger(2);
  assertEquals(h.step(), 0, "a linear stepper's triggers are not a navigation surface");
  assertEquals(h.changes, [], "and nothing reports");
  h.dispose();
});

Deno.test("Given a trigger click already handled / When it arrives / Then the step does not move", () => {
  const h = mount({ count: 3 });
  handler<(event: MouseEvent) => void>(h.api.getTriggerProps(1), "onClick")(click(true));
  assertEquals(h.step(), 0, "a defaultPrevented click is not a navigation");
  h.dispose();
});

Deno.test("Given the control triggers / When they are read / Then they are disabled at the ends", () => {
  const h = mount({ count: 2 });
  assertEquals(h.api.getPrevTriggerProps()["disabled"], true, "prev is disabled on the first step");
  assertEquals(h.api.getNextTriggerProps()["disabled"], false, "and next is not");
  assertEquals(h.api.getResetTriggerProps()["id"], "steps:steps:reset-trigger", "the reset control carries its id");
  h.clickNext();
  assertEquals(h.step(), 1, "next lands on the last visible step");
  assertEquals(h.api.getPrevTriggerProps()["disabled"], false, "prev is enabled after a move");
  assertEquals(
    h.api.getNextTriggerProps()["disabled"],
    false,
    "next is still enabled: Zag's last visible step can still reach the complete position",
  );
  h.clickNext();
  assertEquals(h.step(), 2, "the complete position is reached");
  assertEquals(h.api.getNextTriggerProps()["disabled"], true, "and has no next");
  h.dispose();
});

Deno.test("Given a stepper / When the progress is read / Then the percent reaches aria and the var", () => {
  const h = mount({ count: 4, defaultStep: 1 });
  const progress = h.api.getProgressProps();
  assertEquals(progress["role"], "progressbar", "the progress part is a progressbar");
  assertEquals(progress["aria-valuenow"], 25, "the aria value is the percent");
  assertEquals(progress["aria-valuemin"], 0, "with a floor of zero");
  assertEquals(progress["aria-valuemax"], 100, "and a ceiling of one hundred");
  assertEquals(progress["aria-valuetext"], "25% complete", "and a text alternative");
  assertEquals(progress["data-complete"], undefined, "a partial progress is not complete");
  assertEquals(
    h.api.getRootProps()["style"],
    { "--steps-percent": "25%" },
    "the root carries the percent as a custom property",
  );
  h.api.setStep(4);
  assertEquals(h.api.getProgressProps()["aria-valuenow"], 100, "the last step is a full progress");
  assertEquals(h.api.getProgressProps()["data-complete"], "", "and reports complete");
  h.dispose();
});

Deno.test("Given a vertical stepper / When the parts are read / Then the orientation reaches every one", () => {
  const h = mount({ count: 2, orientation: "vertical" });
  assertEquals(h.api.orientation, "vertical", "the api reports the orientation");
  assertEquals(h.api.getRootProps()["data-orientation"], "vertical", "the root reports it");
  assertEquals(h.api.getListProps()["aria-orientation"], "vertical", "so does the list");
  assertEquals(h.api.getTriggerProps(0)["data-orientation"], "vertical", "and the trigger");
  assertEquals(h.api.getSeparatorProps(0)["data-orientation"], "vertical", "and the rail");
  h.dispose();
});

Deno.test("Given a stepper / When the captions are read / Then the host's labels land on the steps", () => {
  const h = mount({ count: 3, labels: ["Account", "Profile", "Done"] });
  assertEquals(h.api.getLabel(0), "Account", "the first caption is the host's");
  assertEquals(h.api.getLabel(2), "Done", "the last one too");
  assertEquals(h.api.getLabel(3), "", "an index past the list is empty");
  h.dispose();
});

Deno.test("Given no captions / When they are read / Then every step's caption is empty", () => {
  const h = mount({ count: 2 });
  assertEquals(h.api.getLabel(0), "", "an unset label is empty");
  h.dispose();
});

Deno.test("Given no captions / When the grammar coerced the absent default / Then it is not a caption", () => {
  const h = mount({ count: 2, labels: ["[]"] });
  assertEquals(h.api.getLabel(0), "", "the coercion artifact is not read as a caption");
  h.dispose();
});

// ---- the memoized bags ----------------------------------------------------

Deno.test("Given a stepper / When the same bag is read twice / Then it is the same object", () => {
  const h = mount({ count: 3, defaultStep: 1 });
  assertEquals(h.api.getTriggerProps(1), h.api.getTriggerProps(1), "the trigger bag is stable");
  assertEquals(h.api.getIndicatorProps(1), h.api.getIndicatorProps(1), "so is the indicator bag");
  assertEquals(h.api.getListProps(), h.api.getListProps(), "and the list bag");
  assertEquals(h.api.getSteps(), h.api.getSteps(), "and the step indices");
  h.dispose();
});

Deno.test("Given a stepper / When the step moves / Then the handlers keep their identity", () => {
  const h = mount({ count: 3 });
  const before = handler<(event: MouseEvent) => void>(h.api.getTriggerProps(1), "onClick");
  const nextBefore = handler<(event: MouseEvent) => void>(h.api.getNextTriggerProps(), "onClick");
  h.clickNext();
  const after = handler<(event: MouseEvent) => void>(h.api.getTriggerProps(1), "onClick");
  const nextAfter = handler<(event: MouseEvent) => void>(h.api.getNextTriggerProps(), "onClick");
  assertEquals(after, before, "the trigger's click handler is the same function across the move");
  assertEquals(nextAfter, nextBefore, "so is the next trigger's");
  h.dispose();
});

Deno.test("Given a stepper / When the step moves / Then the trigger bag is rebuilt for the new state", () => {
  const h = mount({ count: 3 });
  const before = h.api.getTriggerProps(1);
  h.api.setStep(1);
  const after = h.api.getTriggerProps(1);
  assertEquals(after === before, false, "the bag was rebuilt for the new phase");
  assertEquals(after["data-state"], "open", "and reports the current phase");
  h.dispose();
});
