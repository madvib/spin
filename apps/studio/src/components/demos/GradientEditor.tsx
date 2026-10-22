/**
 * The gradient editor: a direction and a list of stops.
 *
 * A gradient is a fill that runs from one colour to another, and the theme
 * says which colours it has — the roles of the palette. So the editor
 * offers the theme's own colours for the stops, and a field for where each
 * stop sits, because a position is a measurement the theme keeps no scale
 * for.
 *
 * The direction is a field too: CSS writes it as an angle or as a word
 * (`to right`), and the theme has no ladder of them.
 *
 * The specimen is painted with the gradient the composite spells, so the
 * stops and the direction are read as the fill they make.
 */

import { For, Show } from "solid-js";
import type {
  Composite,
  CompositeLadders,
  GradientStop,
} from "../../lib/tokens.ts";
import { ColourField, TextField } from "./CompositeEditor.tsx";

/** The parts a gradient is made of. */
type Gradient = Extract<Composite, { type: "gradient" }>;

export default function GradientEditor(props: {
  composite: Gradient;
  ladders: CompositeLadders;
  /** Called with the composite as the parts now stand. */
  onCommit: (composite: Gradient) => boolean;
}) {
  const change = (part: Partial<Gradient>): boolean =>
    props.onCommit({ ...props.composite, ...part });

  const changeStop = (index: number, stop: GradientStop): boolean =>
    props.onCommit({
      ...props.composite,
      stops: props.composite.stops.map((existing, i) =>
        i === index ? stop : existing
      ),
    });

  const removeStop = (index: number): boolean =>
    props.onCommit({
      ...props.composite,
      stops: props.composite.stops.filter((_, i) => i !== index),
    });

  const addStop = (): boolean =>
    props.onCommit({
      ...props.composite,
      stops: [
        ...props.composite.stops,
        {
          color: props.ladders.colors[0]?.value ?? "#000000",
          position: "100%",
        },
      ],
    });

  /** The specimen, painted with the gradient the composite spells. */
  const specimen = (): Record<string, string> => {
    const stops = props.composite.stops.map((stop) =>
      stop.position === "" ? stop.color : `${stop.color} ${stop.position}`
    );
    const parts = [props.composite.direction, ...stops].filter((part) =>
      part !== ""
    );
    return {
      "background-image": `linear-gradient(${parts.join(", ")})`,
    };
  };

  return (
    <div class="stack-sm">
      <div class="row-sm flex-wrap items-end gap-3">
        <TextField
          label="Direction"
          value={props.composite.direction}
          placeholder="90deg"
          onPick={(value) => change({ direction: value })}
        />
      </div>
      <ul class="stack-sm">
        <For each={props.composite.stops}>
          {(stop, index) => (
            <li class="row-sm flex-wrap items-end gap-3">
              <ColourField
                label={`Stop ${index() + 1}`}
                value={stop.color}
                steps={props.ladders.colors}
                onPick={(value) =>
                  changeStop(index(), { ...stop, color: value })}
              />
              <TextField
                label="Position"
                value={stop.position}
                placeholder="0%"
                onPick={(value) =>
                  changeStop(index(), { ...stop, position: value })}
              />
              <button
                type="button"
                class="secondary s-sm shrink-0 text-text-muted hover:border-primary hover:text-text"
                title="Remove this stop"
                aria-label={`Remove stop ${index() + 1}`}
                onClick={() => removeStop(index())}
              >
                <span class="i-lucide-trash-2 icon-sm" aria-hidden="true" />
              </button>
            </li>
          )}
        </For>
      </ul>
      <div class="row-sm items-center gap-3">
        <button
          type="button"
          class="secondary s-sm shrink-0 text-text-muted hover:border-primary hover:text-text"
          onClick={() => addStop()}
        >
          add a stop
        </button>
        <span
          class="block h-10 w-32 rounded-md border border-border"
          style={specimen()}
          aria-hidden="true"
        />
      </div>
      <Show when={props.composite.stops.length === 0}>
        <p class="text-xs text-text-muted">
          A gradient with no stops paints nothing.
        </p>
      </Show>
    </div>
  );
}
