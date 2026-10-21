import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type {
  NumberInputFocusChange,
  NumberInputValueChange,
  NumberInputValueCommit,
  NumberInputValueInvalid,
} from "../../../src/spin-number-input/number-input.bridge.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-number-input.html";
/** The element as a host writes it: seeds are plain property writes. */
interface NumberInputElement extends HTMLElement {
  defaultValue?: string;
}

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
 * The claim under test: the `before:spin` and `spinning` states exist only
 * to time the repeat, so here the dwell and the repeat rate are the control's
 * `use:autoplay` reflex while the machine keeps three states. A controlled
 * value keeps the upstream arithmetic (number | string).
 */
export default function NumberInputFsm() {
  const [value, setValue] = createSignal("12");
  const [committed, setCommitted] = createSignal("none");
  const [invalid, setInvalid] = createSignal("in range");
  const [focus, setFocus] = createSignal("blurred");
  const [disabled, setDisabled] = createSignal(false);

  const [singleEl, setSingle] = createSignal<HTMLElement>();
  const single = createSpinComponent<NumberInputCommands>(singleEl);
  createEffect(() => {
    const ctl = single();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Quantity",
      min: "0",
      max: "20",
      step: "1",
      disabled: disabled(),
    }, {
      "value-change": (event: CustomEvent<NumberInputValueChange>) =>
        setValue(event.detail.value),
      "value-commit": (event: CustomEvent<NumberInputValueCommit>) =>
        setCommitted(event.detail.value),
      "value-invalid": (event: CustomEvent<NumberInputValueInvalid>) =>
        setInvalid(event.detail.reason),
      "focus-change": (event: CustomEvent<NumberInputFocusChange>) =>
        setFocus(event.detail.focused ? "focused" : "blurred"),
    });
  });
;

  const [controlledEl, setControlled] = createSignal<HTMLElement>();
  const controlled = createSpinComponent<NumberInputCommands>(controlledEl);
  createEffect(() => {
    const ctl = controlled();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Controlled",
      value: "40",
      min: "0",
      max: "100",
      step: "5",
      largeStep: "25",
      smallStep: "1",
    }, {
      "value-change": (event: CustomEvent<NumberInputValueChange>) =>
        setValue(event.detail.value),
      "value-commit": (event: CustomEvent<NumberInputValueCommit>) =>
        setCommitted(event.detail.value),
      "value-invalid": (event: CustomEvent<NumberInputValueInvalid>) =>
        setInvalid(event.detail.reason),
      "focus-change": (event: CustomEvent<NumberInputFocusChange>) =>
        setFocus(event.detail.focused ? "focused" : "blurred"),
    });
  });
;

  const [rtlEl, setRtl] = createSignal<HTMLElement>();
  const rtl = createSpinComponent<NumberInputCommands>(rtlEl);
  createEffect(() => {
    const ctl = rtl();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Amount",
      dir: "rtl",
      min: "0",
      max: "5",
      step: "0.5",
      allowMouseWheel: true,
    }, {
      "value-change": (event: CustomEvent<NumberInputValueChange>) =>
        setValue(event.detail.value),
      "focus-change": (event: CustomEvent<NumberInputFocusChange>) =>
        setFocus(event.detail.focused ? "focused" : "blurred"),
    });
  });
;

  return (
    <DemoGrid>
      <DemoCard
        title="Uncontrolled, with bounds"
        width="sm"
        note="The readouts are the host's own and shared: every instance on this page writes the same signals."
      >
        <spin-number-input
          id="quantity"
          ref={(node: HTMLElement) => {
            setSingle(node);
            // Seeds are read during build: they land before connect.
            const host = node as NumberInputElement;
            host.defaultValue = "12";
          }}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => setDisabled((value) => !value)}
          >
            {disabled() ? "Enable" : "Disable"}
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.setToMin()}
          >
            el.setToMin()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.setToMax()}
          >
            el.setToMax()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => single()?.commands.clearValue()}
          >
            el.clearValue()
          </button>
        </DemoControls>
        <DemoReadout>
          <div>
            value: <span id="number-input-value">{value()}</span>
          </div>
          <div>
            committed: <span id="number-input-commit">{committed()}</span>
          </div>
          <div>
            invalid: <span id="number-input-invalid">{invalid()}</span>
          </div>
          <div>
            focus: <span id="number-input-focus">{focus()}</span>
          </div>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Controlled value"
        width="sm"
        note="Step 5, large 25, small 1: the plain step, Shift's step and Alt's step."
      >
        <spin-number-input id="controlled" ref={setControlled} />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => controlled()?.commands.increment()}
          >
            el.increment()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => controlled()?.commands.decrement()}
          >
            el.decrement()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => controlled()?.commands.setValue(75)}
          >
            el.setValue(75)
          </button>
        </DemoControls>
      </DemoCard>

      <DemoCard
        title="RTL, fractional step"
        width="sm"
        note="Direction rtl, step 0.5, and the wheel is allowed."
      >
        <spin-number-input
          id="rtl"
          ref={(node: HTMLElement) => {
            setRtl(node);
            (node as NumberInputElement).defaultValue = "1.5";
          }}
        />
      </DemoCard>
    </DemoGrid>
  );
}
