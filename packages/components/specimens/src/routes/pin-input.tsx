import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import {
  DEMO_BUTTON,
  DemoCard,
  DemoControls,
  DemoGrid,
  DemoReadout,
} from "../demo.tsx";

interface PinCommands {
  setValue(values: string[]): void;
  setValueAtIndex(index: number, value: string): void;
  clearValue(): void;
  focus(): void;
}

/**
 * Pin input: the one-time-code field — per-cell state, paste distribution,
 * the completion edge. Each example is a bounded card: a code field at the
 * width a code field is actually used at, not the width of the page.
 */
export default function PinInput() {
  const [value, setValue] = createSignal<string[]>([]);
  const [completions, setCompletions] = createSignal(0);
  const [refused, setRefused] = createSignal("");
  const [masked, setMasked] = createSignal("");
  const [dotsValue, setDotsValue] = createSignal("");
  const [disabled, setDisabled] = createSignal(false);

  const [pinEl, setPin] = createSignal<HTMLElement>();
  const pin = createSpinComponent<PinCommands>(pinEl);
  createEffect(() => {
    const ctl = pin();
    if (ctl === undefined) return undefined;
    return ctl.bind({ count: 4, label: "Verification code", name: "pin" }, {
      "value-change": (e: CustomEvent<{ value: string[] }>) =>
        setValue(e.detail.value),
      "value-complete": () => setCompletions((n) => n + 1),
      "value-invalid": (e: CustomEvent<{ value: string }>) => {
        setRefused(e.detail.value);
        setMasked(e.detail.value);
      },
    });
  });
;

  const [dotsEl, setDots] = createSignal<HTMLElement>();
  const dots = createSpinComponent<PinCommands>(dotsEl);
  createEffect(() => {
    const ctl = dots();
    if (ctl === undefined) return undefined;
    return ctl.bind({ count: 6, mask: true, otp: true, label: "Masked, otp" }, {
      "value-change": (e: CustomEvent<{ value: string[] }>) =>
        setDotsValue(e.detail.value.join("")),
    });
  });
;

  return (
    <DemoGrid>
      <DemoCard
        title="Four cells"
        width="sm"
        note={
          <>
            Type or paste; the completion edge fires once the last cell lands.
          </>
        }
      >
        <spin-pin-input
          id="pin"
          ref={setPin}
          prop:count={4}
          prop:label="Verification code"
          prop:defaultValue={["1", "2"]}
          prop:name="pin"
          prop:blurOnComplete={true}
          prop:disabled={disabled()}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => pin()?.commands.setValue(["9", "8", "7"])}
          >
            el.setValue(["9", "8", "7"])
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => pin()?.commands.setValueAtIndex(3, "5")}
          >
            el.setValueAtIndex(3, "5")
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => pin()?.commands.clearValue()}
          >
            el.clearValue()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => pin()?.commands.focus()}
          >
            el.focus()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => setDisabled((value) => !value)}
          >
            {disabled() ? "enable" : "disable"}
          </button>
        </DemoControls>
        <DemoReadout>
          value: <span id="pin-value">{value().join("") || "none"}</span>{" "}
          · completions: <span id="pin-completions">{completions()}</span>{" "}
          · refused: <span id="pin-refused">{refused() || "none"}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Masked, otp"
        width="md"
        note="Six masked cells, one-time-code: a paste fills the row, a refused key is dropped."
      >
        <spin-pin-input
          id="dots"
          ref={setDots}
          prop:count={6}
          prop:mask={true}
          prop:otp={true}
          prop:label="Masked, otp"
        />
        <DemoReadout>
          value: <span id="pin-dots-value">{dotsValue() || "none"}</span>{" "}
          · last refused: <span id="pin-masked">{masked() || "none"}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
