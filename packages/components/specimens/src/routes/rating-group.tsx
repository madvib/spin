import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { RatingGroupValueChange } from "../../../src/rating-group/rating-group.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-rating-group.html";
interface RatingGroupCommands {
  setValue: (value: number) => void;
  clearValue: () => void;
}

/**
 * Rating-group on the owned machine: idle, focused, hovering — with the
 * value, the hover preview and the half-step math in the machine, and focus
 * plus the halfway flag in the view.
 */
export default function RatingGroup() {
  const [rating, setRating] = createSignal("unrated");

  const [starsEl, setStars] = createSignal<HTMLElement>();
  const stars = createSpinComponent<RatingGroupCommands>(starsEl);
  createEffect(() => {
    const ctl = stars();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Quality", name: "quality" }, {
      "value-change": (e: CustomEvent<RatingGroupValueChange>) =>
        setRating(e.detail.value <= 0 ? "unrated" : String(e.detail.value)),
    });
  });

  const [halfEl, setHalf] = createSignal<HTMLElement>();
  const half = createSpinComponent<RatingGroupCommands>(halfEl);
  createEffect(() => {
    const ctl = half();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Half steps", allowHalf: true }, undefined);
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Rate, hover, keys"
        width="sm"
        note="Click a star to commit, hover to preview, arrows to walk, Home and End to jump."
      >
        <spin-rating-group
          id="stars"
          ref={setStars}
          prop:label="Quality"
          prop:name="quality"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stars()?.commands.setValue(4)}
          >
            el.setValue(4)
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stars()?.commands.clearValue()}
          >
            el.clearValue()
          </button>
        </DemoControls>
        <DemoReadout>
          rating: {rating()}
        </DemoReadout>
      </DemoCard>
      <DemoCard
        title="Half steps"
        width="sm"
        note="Halfway across a star previews the half value."
      >
        <spin-rating-group
          id="half"
          ref={setHalf}
          prop:label="Half steps"
          prop:allowHalf={true}
        />
      </DemoCard>
    </DemoGrid>
  );
}
