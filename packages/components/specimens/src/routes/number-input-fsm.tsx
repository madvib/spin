import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type {
  NumberInputFocusChange,
  NumberInputValueChange,
  NumberInputValueCommit,
  NumberInputValueInvalid,
} from "../../../src/spin-number-input/number-input.bridge.ts";

interface NumberInputCommands {
  setValue: (value: number | string) => void;
  clearValue: () => void;
  increment: () => void;
  decrement: () => void;
  setToMax: () => void;
  setToMin: () => void;
  focus: () => void;
}

/**
 * Number input on the forked FSM: the value, its range, and the two gestures —
 * the press-and-hold on the spin controls, and the drag on the scrubber.
 *
 * The claim under test: Zag's `before:spin` and `spinning` states exist only
 * to time the repeat, so here the dwell and the repeat rate are the control's
 * `use:autoplay` reflex while the machine keeps three states. A controlled
 * value keeps Zag's arithmetic (number | string).
 */
export default function NumberInputFsm() {
  const [value, setValue] = createSignal("12");
  const [committed, setCommitted] = createSignal("none");
  const [invalid, setInvalid] = createSignal("in range");
  const [focus, setFocus] = createSignal("blurred");
  const [disabled, setDisabled] = createSignal(false);

  const single = createSpin<
    {
      label: string;
      defaultValue: string;
      min: string;
      max: string;
      step: string;
      disabled: boolean;
    },
    NumberInputCommands
  >(
    "spin-number-input-fsm",
    () => ({
      label: "Quantity",
      defaultValue: "12",
      min: "0",
      max: "20",
      step: "1",
      disabled: disabled(),
    }),
    {
      "value-change": (event: CustomEvent<NumberInputValueChange>) => setValue(event.detail.value),
      "value-commit": (event: CustomEvent<NumberInputValueCommit>) => setCommitted(event.detail.value),
      "value-invalid": (event: CustomEvent<NumberInputValueInvalid>) => setInvalid(event.detail.reason),
      "focus-change": (event: CustomEvent<NumberInputFocusChange>) =>
        setFocus(event.detail.focused ? "focused" : "blurred"),
    },
  );

  const controlled = createSpin<
    {
      label: string;
      value: string;
      min: string;
      max: string;
      step: string;
      largeStep: string;
      smallStep: string;
    },
    NumberInputCommands
  >(
    "spin-number-input-fsm",
    () => ({ label: "Controlled", value: "40", min: "0", max: "100", step: "5", largeStep: "25", smallStep: "1" }),
    {
      "value-change": (event: CustomEvent<NumberInputValueChange>) => setValue(event.detail.value),
      "value-commit": (event: CustomEvent<NumberInputValueCommit>) => setCommitted(event.detail.value),
      "value-invalid": (event: CustomEvent<NumberInputValueInvalid>) => setInvalid(event.detail.reason),
      "focus-change": (event: CustomEvent<NumberInputFocusChange>) =>
        setFocus(event.detail.focused ? "focused" : "blurred"),
    },
  );

  const rtl = createSpin<
    {
      label: string;
      dir: string;
      defaultValue: string;
      min: string;
      max: string;
      step: string;
      allowMouseWheel: boolean;
    },
    NumberInputCommands
  >(
    "spin-number-input-fsm",
    () => ({
      label: "Amount",
      dir: "rtl",
      defaultValue: "1.5",
      min: "0",
      max: "5",
      step: "0.5",
      allowMouseWheel: true,
    }),
    {
      "value-change": (event: CustomEvent<NumberInputValueChange>) => setValue(event.detail.value),
      "focus-change": (event: CustomEvent<NumberInputFocusChange>) =>
        setFocus(event.detail.focused ? "focused" : "blurred"),
    },
  );

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Number input — forked FSM</h2>
      <p class="text-muted mb-4">
        Press and hold a spin control: one step, a 300ms dwell, then a repeat. Arrow keys step — Shift takes the
        large step, Alt the small one — Home and End take the bounds, Enter commits, the wheel steps when it is
        allowed, and a horizontal drag on the rail scrubs the value. Blurring clamps a typed value into range
        unless the host opts out of it.
      </p>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Uncontrolled, with bounds</h3>
          <spin-number-input-fsm id="quantity" ref={single.ref} />
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button class={button} onClick={() => setDisabled((value) => !value)}>
              {disabled() ? "Enable" : "Disable"}
            </button>
            <button class={button} onClick={() => single.commands().setToMin()}>el.setToMin()</button>
            <button class={button} onClick={() => single.commands().setToMax()}>el.setToMax()</button>
            <button class={button} onClick={() => single.commands().clearValue()}>el.clearValue()</button>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Controlled value</h3>
          <spin-number-input-fsm id="controlled" ref={controlled.ref} />
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button class={button} onClick={() => controlled.commands().increment()}>el.increment()</button>
            <button class={button} onClick={() => controlled.commands().decrement()}>el.decrement()</button>
            <button class={button} onClick={() => controlled.commands().setValue(75)}>el.setValue(75)</button>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">RTL, fractional step</h3>
          <spin-number-input-fsm id="rtl" ref={rtl.ref} />
        </div>
      </div>

      <div class="mt-6 grid gap-2 text-sm text-muted">
        <p>
          value: <span id="number-input-value" class="font-medium text-text">{value()}</span>
        </p>
        <p>
          committed: <span id="number-input-commit" class="font-medium text-text">{committed()}</span>
        </p>
        <p>
          invalid: <span id="number-input-invalid" class="font-medium text-text">{invalid()}</span>
        </p>
        <p>
          focus: <span id="number-input-focus" class="font-medium text-text">{focus()}</span>
        </p>
      </div>
    </section>
  );
}
