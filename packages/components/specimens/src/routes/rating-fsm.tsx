import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";

/** The element's host surface, from its machine-def's commands. */
interface RatingCommands {
  setValue(value: number): void;
  clearValue(): void;
}

interface RatingValueDetail {
  readonly value: number;
}

interface RatingHoverDetail {
  readonly hoveredValue: number;
}

const COUNT = 5;

/**
 * Rating group on the forked FSM: three states, one value.
 *
 * Zag's idle/focus/hover survive the port untouched — none of them exists to
 * hold a timer — so what the route exercises is the part that carries the
 * behaviour: the controlled value, the half-star precision from the pointer's
 * position over an item, the keyboard map (arrows, Home/End, Space) and the
 * hover preview, which leaves through the `--rating-fill` geometry channel
 * and is painted by the recipe.
 *
 * The fieldset and form reflexes are live here: the two ratings sit in a
 * form, so a reset returns them to their seeded defaults, and disabling the
 * group shows a control inside a disabled fieldset going inert.
 */
export default function RatingFsm() {
  const [value, setValue] = createSignal(3);
  const [hovered, setHovered] = createSignal(-1);
  const [changes, setChanges] = createSignal(0);
  const [allowHalf, setAllowHalf] = createSignal(false);
  const [readOnly, setReadOnly] = createSignal(false);
  const [disabled, setDisabled] = createSignal(false);

  const rating = createSpin<
    {
      label: string;
      count: number;
      allowHalf: boolean;
      defaultValue: number;
      readOnly: boolean;
      disabled: boolean;
    },
    RatingCommands
  >(
    "spin-rating-group-fsm",
    () => ({
      label: "How was it?",
      count: COUNT,
      allowHalf: allowHalf(),
      defaultValue: 3,
      readOnly: readOnly(),
      disabled: disabled(),
    }),
    {
      "value-change": (event: CustomEvent<RatingValueDetail>) => {
        setValue(event.detail.value);
        setChanges((n) => n + 1);
      },
      "hover-change": (event: CustomEvent<RatingHoverDetail>) => setHovered(event.detail.hoveredValue),
    },
  );

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Rating — forked FSM</h2>
      <p class="text-muted mb-4">
        Click a star, or focus the group and use ArrowLeft/ArrowRight, Home/End and Space. With "allow half"
        on, the pointer's position inside a star picks the half. Hovering previews without committing.
      </p>

      <form
        id="rating-form"
        class="mb-4 flex flex-wrap items-center gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <spin-rating-group-fsm
          id="rating-a"
          ref={rating.ref}
          prop:label="How was it?"
          prop:count={COUNT}
          prop:allowHalf={allowHalf()}
          prop:defaultValue={3}
          prop:readOnly={readOnly()}
          prop:disabled={disabled()}
        />

        <fieldset disabled={disabled()} class="flex items-center gap-3 border-0 p-0">
          <spin-rating-group-fsm
            id="rating-b"
            prop:label="Fieldset copy"
            prop:count={COUNT}
            prop:defaultValue={1}
            prop:allowHalf={true}
          />
        </fieldset>
      </form>

      <div class="flex flex-wrap items-center gap-3 mb-4">
        <button type="button" class={button} onClick={() => rating.commands().setValue(5)}>
          el.setValue(5)
        </button>
        <button type="button" class={button} onClick={() => rating.commands().clearValue()}>
          el.clearValue()
        </button>
        <button type="button" class={button} onClick={() => setAllowHalf((half) => !half)}>
          {allowHalf() ? "whole stars" : "allow half"}
        </button>
        <button type="button" class={button} onClick={() => setReadOnly((ro) => !ro)}>
          {readOnly() ? "make editable" : "read only"}
        </button>
        <button type="button" class={button} onClick={() => setDisabled((d) => !d)}>
          {disabled() ? "enable" : "disable"}
        </button>
        <button type="reset" form="rating-form" class={button}>
          reset form
        </button>
      </div>

      <div class="text-sm text-muted font-mono tabular-nums">
        <div>
          value: <span id="rating-value">{value()}</span>
        </div>
        <div>
          hovered: <span id="rating-hovered">{hovered()}</span> · value-change:{" "}
          <span id="rating-changes">{changes()}</span>
        </div>
      </div>
    </section>
  );
}
