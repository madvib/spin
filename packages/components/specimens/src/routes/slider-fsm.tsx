import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";

/** The element's host surface, from its machine-def's commands. */
interface SliderCommands {
  setValue: (value: readonly number[]) => void;
  focus: () => void;
}

interface SliderValueDetail {
  readonly value: readonly number[];
}

interface SliderFocusDetail {
  readonly focusedIndex: number;
}

const MARKERS = "[25, 50, 75]";
const THUMB = '{"width":20,"height":20}';

/**
 * Slider on the forked FSM: the continuous case, ported.
 *
 * The machine holds the value array and the focus index; the connect owns
 * the pointer flows, the keyboard map and the geometry (custom properties
 * on the parts that consume them). Drag, arrow, PageUp/Home/End and the
 * host's `setValue`/`focus` commands all run through the same machine.
 */
export default function SliderFsm() {
  const [value, setValue] = createSignal(50);
  const [changes, setChanges] = createSignal(0);
  const [ends, setEnds] = createSignal(0);
  const [focused, setFocused] = createSignal(false);
  const [disabled, setDisabled] = createSignal(false);

  const slider = createSpin<
    { label: string; defaultValue: number; markers: string; thumbSize: string; disabled: boolean },
    SliderCommands
  >(
    "spin-slider-fsm",
    () => ({
      label: "Volume",
      defaultValue: 50,
      markers: MARKERS,
      thumbSize: THUMB,
      disabled: disabled(),
    }),
    {
      "value-change": (e: CustomEvent<SliderValueDetail>) => {
        const next = e.detail.value[0];
        if (next !== undefined) setValue(next);
        setChanges((n) => n + 1);
      },
      "value-change-end": () => setEnds((n) => n + 1),
      "focus-change": (e: CustomEvent<SliderFocusDetail>) => setFocused(e.detail.focusedIndex >= 0),
    },
  );

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Slider — forked FSM</h2>
      <p class="text-muted mb-4">
        Drag the track or the thumb; arrows and PageUp/Home/End move from the keyboard. The value
        rides a custom property; the utility classes paint it.
      </p>

      <div class="flex flex-wrap items-center gap-3 mb-4">
        <button type="button" class={button} onClick={() => slider.commands().setValue([75])}>
          el.setValue([75])
        </button>
        <button type="button" class={button} onClick={() => slider.commands().focus()}>
          el.focus()
        </button>
        <button type="button" class={button} onClick={() => setDisabled((d) => !d)}>
          {disabled() ? "enable" : "disable"}
        </button>
      </div>

      <spin-slider-fsm
        prop:label="Volume"
        prop:defaultValue={50}
        prop:markers={MARKERS}
        prop:thumbSize={THUMB}
        prop:disabled={disabled()}
        ref={slider.ref}
      />

      <div class="mt-4 text-sm text-muted font-mono tabular-nums">
        <div>
          value: <span id="slider-value">{value()}</span>
        </div>
        <div>
          value-change: <span id="slider-changes">{changes()}</span> · value-change-end:{" "}
          <span id="slider-ends">{ends()}</span>
        </div>
        <div>
          focused: <span id="slider-focused">{focused() ? "yes" : "no"}</span> · disabled:{" "}
          <span id="slider-disabled">{disabled() ? "yes" : "no"}</span>
        </div>
      </div>
    </section>
  );
}
