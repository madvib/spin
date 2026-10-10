import { assertEquals } from "@std/assert";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import { createSliderFsmBridge } from "./slider.bridge.ts";
import {
  config,
  implementations,
  normalizeValues,
  type SliderContext,
  type SliderEvent,
} from "./slider.machine.ts";

const machine = createMachine<SliderContext, SliderEvent>(config, implementations);

/**
 * A started service, seeded the way the bridge seeds it: through events, so
 * the context is the service's own (the fork's initial context is the
 * config's object until a transition folds a copy).
 */
const startSlider = (seed: Partial<SliderContext> = {}): FsmService<SliderContext, SliderEvent> => {
  const svc = interpret(machine).start();
  svc.send({ type: "SET_VALUE", value: seed.value ?? [50] });
  Object.assign(svc.state.context, seed);
  svc.send({ type: "SET_VALUE", value: seed.value ?? [50] });
  return svc;
};

const state = (svc: FsmService<SliderContext, SliderEvent>): string => svc.state.value;
const value = (svc: FsmService<SliderContext, SliderEvent>): number[] => svc.state.context.value;
const focusedIndex = (svc: FsmService<SliderContext, SliderEvent>): number =>
  svc.state.context.focusedIndex;

Deno.test("Given a fresh service / When started / Then it is idle with no focused thumb", () => {
  const svc = startSlider();
  assertEquals(state(svc), "idle");
  assertEquals(focusedIndex(svc), -1);
  assertEquals(value(svc), [50]);
});

Deno.test("Given a defaultValue outside the range / When seeded / Then it is snapped and clamped", () => {
  assertEquals(value(startSlider({ value: [150], max: 100 })), [100]);
  assertEquals(value(startSlider({ value: [-20] })), [0]);
  assertEquals(value(startSlider({ value: [73], step: 10 })), [70]);
  assertEquals(value(startSlider({ value: [76], step: 10 })), [80]);
  assertEquals(value(startSlider({ value: [30, 70], minStepsBetweenThumbs: 10 })), [30, 70]);
  // Crossed values clamp into their own ranges: [90, 40] with a gap of 10
  // becomes [30, 100].
  assertEquals(normalizeValues([90, 40], 0, 100, 1, 10), [30, 100]);
});

Deno.test("Given idle / When the thumb is focused / Then the state is focus and the index is set", () => {
  const svc = startSlider();
  svc.send({ type: "FOCUS", index: 0 });
  assertEquals(state(svc), "focus");
  assertEquals(focusedIndex(svc), 0);
});

Deno.test("Given focus / When the thumb blurs / Then the state returns to idle with no focused thumb", () => {
  const svc = startSlider();
  svc.send({ type: "FOCUS", index: 0 });
  svc.send({ type: "BLUR" });
  assertEquals(state(svc), "idle");
  assertEquals(focusedIndex(svc), -1);
  assertEquals(value(svc), [50]);
});

Deno.test("Given idle / When the control is pressed at a point / Then the closest thumb jumps to that value and drags", () => {
  const svc = startSlider();
  svc.send({ type: "POINTER_DOWN", value: 73 });
  assertEquals(state(svc), "dragging");
  assertEquals(value(svc), [73]);
  assertEquals(focusedIndex(svc), 0);
});

Deno.test("Given focus / When the control is pressed / Then the drag starts without leaving focus behind", () => {
  const svc = startSlider();
  svc.send({ type: "FOCUS", index: 0 });
  svc.send({ type: "POINTER_DOWN", value: 25 });
  assertEquals(state(svc), "dragging");
  assertEquals(value(svc), [25]);
  assertEquals(focusedIndex(svc), 0);
});

Deno.test("Given the thumb is pressed / When the drag starts / Then the focused index and drag start are captured", () => {
  const svc = startSlider();
  svc.send({ type: "THUMB_POINTER_DOWN", index: 0 });
  assertEquals(state(svc), "dragging");
  assertEquals(focusedIndex(svc), 0);
  // The value is untouched by a thumb press: the grab offset preserves it.
  assertEquals(value(svc), [50]);
});

Deno.test("Given a drag / When the pointer moves / Then the value follows and stays inside the range", () => {
  const svc = startSlider();
  svc.send({ type: "POINTER_DOWN", value: 40 });
  svc.send({ type: "POINTER_MOVE", value: 62 });
  assertEquals(value(svc), [62]);
  svc.send({ type: "POINTER_MOVE", value: 400 });
  assertEquals(value(svc), [100]);
  svc.send({ type: "POINTER_MOVE", value: -12 });
  assertEquals(value(svc), [0]);
});

Deno.test("Given a drag / When the pointer is released / Then the state settles in focus and the gesture is over", () => {
  const svc = startSlider();
  svc.send({ type: "POINTER_DOWN", value: 40 });
  svc.send({ type: "POINTER_UP" });
  assertEquals(state(svc), "focus");
  assertEquals(focusedIndex(svc), 0);
  // A move after release is not a drag move: the value holds.
  svc.send({ type: "POINTER_MOVE", value: 90 });
  assertEquals(value(svc), [40]);
});

Deno.test("Given a drag / When the gesture is cancelled / Then the machine returns to idle unfocused", () => {
  const svc = startSlider();
  svc.send({ type: "POINTER_DOWN", value: 40 });
  svc.send({ type: "POINTER_CANCEL" });
  assertEquals(state(svc), "idle");
  assertEquals(focusedIndex(svc), -1);
});

Deno.test("Given idle / When the host sets the value / Then it is snapped and clamped", () => {
  const svc = startSlider({ step: 5 });
  svc.send({ type: "SET_VALUE", value: [77] });
  assertEquals(value(svc), [75]);
  svc.send({ type: "SET_VALUE", value: [140] });
  assertEquals(value(svc), [100]);
});

Deno.test("Given the host sets one thumb / When the index is addressed / Then only that thumb moves inside its range", () => {
  const svc = startSlider({ value: [30, 70] });
  svc.send({ type: "SET_VALUE", index: 1, value: 45 });
  assertEquals(value(svc), [30, 45]);
  // Index 1 cannot cross thumb 0.
  svc.send({ type: "SET_VALUE", index: 1, value: 5 });
  assertEquals(value(svc), [30, 30]);
});

Deno.test("Given a drag / When the host writes the value / Then the write wins mid-gesture", () => {
  const svc = startSlider();
  svc.send({ type: "POINTER_DOWN", value: 40 });
  svc.send({ type: "SET_VALUE", value: [12] });
  assertEquals(value(svc), [12]);
  assertEquals(state(svc), "dragging");
});

Deno.test("Given focus / When increment and decrement are called / Then they step by the context step", () => {
  const svc = startSlider();
  svc.send({ type: "FOCUS", index: 0 });
  svc.send({ type: "INCREMENT" });
  assertEquals(value(svc), [51]);
  svc.send({ type: "DECREMENT" });
  svc.send({ type: "DECREMENT" });
  assertEquals(value(svc), [49]);
});

Deno.test("Given a drag / When increment is called / Then the root tier still reaches the machine", () => {
  const svc = startSlider();
  svc.send({ type: "POINTER_DOWN", value: 40 });
  svc.send({ type: "INCREMENT", index: 0 });
  assertEquals(value(svc), [41]);
  assertEquals(state(svc), "dragging");
});

Deno.test("Given focus / When the right arrow steps / Then the value moves by the event's step", () => {
  const svc = startSlider();
  svc.send({ type: "FOCUS", index: 0 });
  svc.send({ type: "ARROW_INC", index: 0, step: 1 });
  assertEquals(value(svc), [51]);
  // Shift and PageUp send the large step.
  svc.send({ type: "ARROW_INC", index: 0, step: 10 });
  assertEquals(value(svc), [61]);
  svc.send({ type: "ARROW_DEC", index: 0, step: 10 });
  assertEquals(value(svc), [51]);
});

Deno.test("Given focus at the top / When the arrow pushes past the max / Then the value clamps", () => {
  const svc = startSlider({ value: [100] });
  svc.send({ type: "FOCUS", index: 0 });
  svc.send({ type: "ARROW_INC", index: 0, step: 1 });
  assertEquals(value(svc), [100]);
  svc.send({ type: "ARROW_DEC", index: 0, step: 1 });
  assertEquals(value(svc), [99]);
});

Deno.test("Given focus at the bottom / When the arrow pushes past the min / Then the value clamps", () => {
  const svc = startSlider({ value: [0] });
  svc.send({ type: "FOCUS", index: 0 });
  svc.send({ type: "ARROW_DEC", index: 0, step: 1 });
  assertEquals(value(svc), [0]);
});

Deno.test("Given idle / When arrows arrive / Then they do not move the value: the keyboard is focus-scoped", () => {
  const svc = startSlider();
  svc.send({ type: "ARROW_INC", index: 0, step: 1 });
  assertEquals(value(svc), [50]);
  assertEquals(state(svc), "idle");
});

Deno.test("Given focus / When Home and End are pressed / Then the thumb goes to the range ends", () => {
  const svc = startSlider({ min: 10, max: 60, value: [35] });
  svc.send({ type: "FOCUS", index: 0 });
  svc.send({ type: "HOME" });
  assertEquals(value(svc), [10]);
  svc.send({ type: "END" });
  assertEquals(value(svc), [60]);
});

Deno.test("Given no focused thumb / When increment is called / Then the value does not move", () => {
  const svc = startSlider();
  svc.send({ type: "INCREMENT" });
  assertEquals(value(svc), [50]);
});

Deno.test("Given two values / When the control is pressed near the second thumb / Then that thumb is the closest one", () => {
  const svc = startSlider({ value: [30, 70] });
  svc.send({ type: "POINTER_DOWN", value: 80 });
  assertEquals(focusedIndex(svc), 1);
  assertEquals(value(svc), [30, 80]);
});

Deno.test("Given two values and collision none / When a drag passes its neighbour / Then it stops at the neighbour", () => {
  const svc = startSlider({ value: [30, 70] });
  svc.send({ type: "POINTER_DOWN", value: 20 });
  svc.send({ type: "POINTER_MOVE", value: 90 });
  assertEquals(value(svc), [70, 70]);
});

Deno.test("Given two values and collision push / When a drag passes its neighbour / Then it pushes", () => {
  const svc = startSlider({ value: [30, 70], thumbCollisionBehavior: "push" });
  svc.send({ type: "POINTER_DOWN", value: 20 });
  svc.send({ type: "POINTER_MOVE", value: 90 });
  assertEquals(value(svc), [90, 90]);
});

Deno.test("Given two values and collision swap / When a drag crosses its neighbour / Then the thumbs swap and focus follows", () => {
  const svc = startSlider({ value: [30, 70], thumbCollisionBehavior: "swap" });
  svc.send({ type: "POINTER_DOWN", value: 20 });
  svc.send({ type: "POINTER_MOVE", value: 80 });
  assertEquals(value(svc), [70, 80]);
  assertEquals(focusedIndex(svc), 1);
});

Deno.test("Given a gap between thumbs / When a drag moves inside it / Then the gap holds", () => {
  const svc = startSlider({ value: [30, 70], minStepsBetweenThumbs: 10, step: 1 });
  svc.send({ type: "POINTER_DOWN", value: 20 });
  svc.send({ type: "POINTER_MOVE", value: 75 });
  assertEquals(value(svc), [60, 70]);
});

Deno.test("Given the bridge / When a value change is committed / Then value-change-end fires once per commit", () => {
  const events: string[] = [];
  const props = (): Record<string, unknown> => ({
    label: "Volume",
    defaultValue: 50,
    min: 0,
    max: 100,
    step: 1,
    onValueChange: (details: { value: number[] }) => events.push(`change:${details.value[0]}`),
    onValueChangeEnd: (details: { value: number[] }) => events.push(`end:${details.value[0]}`),
    onFocusChange: (details: { focusedIndex: number }) => events.push(`focus:${details.focusedIndex}`),
  });
  const root = (): Element => ({ querySelector: () => null }) as unknown as Element;
  const bridge = createSliderFsmBridge(props, root, "unit");

  const thumb = bridge.api.getThumbProps({ index: 0 });
  const onFocus = thumb["onFocus"];
  const onKeyDown = thumb["onKeyDown"];
  if (typeof onFocus !== "function" || typeof onKeyDown !== "function") {
    throw new Error("the thumb bag carries its focus and key handlers");
  }
  onFocus({});
  onKeyDown({ key: "ArrowRight", defaultPrevented: false, preventDefault: () => {}, stopPropagation: () => {} });
  bridge.dispose();

  assertEquals(events, ["focus:0", "change:51", "end:51"]);
});
