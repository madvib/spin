import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type { PinInputValueChange, PinInputValueInvalid } from "../../../src/spin-pin-input/pin-input.bridge.ts";

interface PinInputCommands {
  focus: () => void;
  setValue: (value: readonly string[]) => void;
  clearValue: () => void;
  setValueAtIndex: (index: number, value: string) => void;
}

/**
 * Pin-input on the forked FSM: the one-time-code field.
 *
 * The claim under test: Zag's two states (idle, focused) with a long table
 * of pure assigns (filling, focused-index arithmetic, the paste
 * distribution) survives config-first authoring, and the three reflexes
 * Zag runs from its watch blocks — focus follows the index, a completed
 * pin blurs and submits — are the view's.
 */
export default function PinInputFsm() {
  const [value, setValue] = createSignal("none");
  const [completed, setCompleted] = createSignal(0);
  const [refused, setRefused] = createSignal("none");
  const [dots, setDots] = createSignal("none");
  const [disabled, setDisabled] = createSignal(false);

  const pin = createSpin<
    {
      label: string;
      count: number;
      defaultValue: string[];
      name: string;
      blurOnComplete: boolean;
      disabled: boolean;
    },
    PinInputCommands
  >(
    "spin-pin-input-fsm",
    () => ({
      label: "Verification code",
      count: 4,
      defaultValue: ["1", "2"],
      name: "pin",
      blurOnComplete: true,
      disabled: disabled(),
    }),
    {
      "value-change": (event: CustomEvent<PinInputValueChange>) =>
        setValue(event.detail.valueAsString || "none"),
      "value-complete": () => setCompleted((n) => n + 1),
      "value-invalid": (event: CustomEvent<PinInputValueInvalid>) =>
        setRefused(event.detail.value),
    },
  );

  const dotsPin = createSpin<{ label: string; count: number; mask: boolean; otp: boolean }, PinInputCommands>(
    "spin-pin-input-fsm",
    () => ({ label: "Masked, otp", count: 6, mask: true, otp: true }),
    {
      "value-change": (event: CustomEvent<PinInputValueChange>) =>
        setDots(event.detail.valueAsString || "none"),
    },
  );

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Pin input — forked FSM</h2>
      <p class="text-muted mb-4">
        Click a cell and type: the character lands, focus advances, and a paste distributes forward from the first
        empty cell. Backspace clears the focused cell and steps back, Delete clears it in place, the arrows walk the
        cells and Home and End take the extremes. A refused keystroke is reported, not dropped.
      </p>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Verification code</h3>
          <spin-pin-input-fsm
            id="pin"
            ref={pin.ref}
            prop:label="Verification code"
            prop:count={4}
            prop:defaultValue={["1", "2"]}
            prop:name="pin"
            prop:blurOnComplete={true}
            prop:disabled={disabled()}
          />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Masked, otp</h3>
          <spin-pin-input-fsm
            id="dots"
            ref={dotsPin.ref}
            prop:label="Masked, otp"
            prop:count={6}
            prop:mask={true}
            prop:otp={true}
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 mt-6">
        <button type="button" class={button} onClick={() => pin.commands().setValue(["9", "8", "7"])}>
          el.setValue(["9", "8", "7"])
        </button>
        <button type="button" class={button} onClick={() => pin.commands().setValueAtIndex(3, "5")}>
          el.setValueAtIndex(3, "5")
        </button>
        <button type="button" class={button} onClick={() => pin.commands().clearValue()}>
          el.clearValue()
        </button>
        <button type="button" class={button} onClick={() => pin.commands().focus()}>
          el.focus()
        </button>
        <button type="button" class={button} onClick={() => setDisabled((d) => !d)}>
          {disabled() ? "enable" : "disable"}
        </button>
      </div>

      <div class="mt-4 text-sm text-muted font-mono tabular-nums">
        <div>
          value: <span id="pin-value">{value()}</span> · completions: <span id="pin-completions">{completed()}</span> ·
          refused: <span id="pin-refused">{refused()}</span>
        </div>
        <div>
          masked: <span id="pin-dots-value">{dots()}</span>
        </div>
      </div>
    </section>
  );
}
