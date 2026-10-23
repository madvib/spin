/**
 * The transition editor: a duration and an easing.
 *
 * A transition is how long something takes and how it arrives, and the
 * theme already says how long its things take — the durations under
 * `motion.duration` — and how they arrive — the curves under
 * `motion.easing`. So the editor offers the theme's own durations and the
 * theme's own curves, and the property that moves is a field, because a
 * theme that names one names a CSS property and there is no ladder of
 * those.
 *
 * The specimen is a bar that takes the transition when it is pressed, so
 * the duration and the curve are read as the movement they make rather
 * than as two values in a row.
 */

import { createSignal } from "solid-js";
import type { Composite, CompositeLadders } from "../../lib/tokens.ts";
import { StepField, TextField } from "./CompositeEditor.tsx";

/** The parts a transition is made of. */
type Transition = Extract<Composite, { type: "transition" }>;

export default function TransitionEditor(props: {
  composite: Transition;
  ladders: CompositeLadders;
  /** Called with the composite as the parts now stand. */
  onCommit: (composite: Transition) => boolean;
}) {
  const change = (part: Partial<Transition>): boolean =>
    props.onCommit({ ...props.composite, ...part });
  /** Whether the specimen has been pressed — the state the transition shows. */
  const [pressed, setPressed] = createSignal(false);

  /** The transition the specimen runs, as the CSS the composite spells. */
  const transition = (): Record<string, string> => {
    const out: Record<string, string> = {
      "transition-property": props.composite.property === ""
        ? "all"
        : props.composite.property,
    };
    if (props.composite.duration !== "") {
      out["transition-duration"] = props.composite.duration;
    }
    if (props.composite.easing !== "") {
      out["transition-timing-function"] = props.composite.easing;
    }
    if (props.composite.delay !== "") {
      out["transition-delay"] = props.composite.delay;
    }
    return out;
  };

  return (
    <div class="stack-sm">
      <div class="row-sm flex-wrap items-end gap-3">
        <StepField
          label="Duration"
          value={props.composite.duration}
          steps={props.ladders.durations}
          onPick={(value) => change({ duration: value })}
        />
        <StepField
          label="Easing"
          value={props.composite.easing}
          steps={props.ladders.easings}
          onPick={(value) => change({ easing: value })}
        />
        <TextField
          label="Property"
          value={props.composite.property}
          placeholder="all"
          onPick={(value) => change({ property: value })}
        />
      </div>
      <div class="row-sm items-center gap-3">
        <button
          type="button"
          style={{
            ...transition(),
            width: pressed() ? "6rem" : "3rem",
          }}
          aria-pressed={pressed()}
          aria-label="Take the transition this token holds"
          onClick={() => setPressed(!pressed())}
        />
        <span class="text-xs text-text-muted">
          The bar takes the transition when it is pressed.
        </span>
      </div>
    </div>
  );
}
