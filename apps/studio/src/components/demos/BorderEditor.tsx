/**
 * The border editor: a width, a style and a colour.
 *
 * A border is the edge a control draws with, and the theme already says
 * how thick its edges are — the widths under `border` — and what colour
 * they wear: the roles of the palette. So the editor offers the theme's
 * own widths and the theme's own colours, and the style comes from the
 * closed set of line styles CSS has, because a theme's edges are drawn in
 * one of those and nowhere else.
 *
 * The specimen is a box with that edge on it, so the three parts are read
 * as the edge they make rather than as three values in a row.
 */

import { STROKE_STYLES } from "../../lib/tokens.ts";
import type { Composite, CompositeLadders } from "../../lib/tokens.ts";
import { ChoiceField, ColourField, StepField } from "./CompositeEditor.tsx";

/** The parts a border is made of. */
type Border = Extract<Composite, { type: "border" }>;

/**
 * The line styles a control's edge may be drawn in.
 *
 * The set CSS has, and the set the theme's `strokeStyle` type accepts. The
 * first is the one an edge is drawn in; the rest are the ways an edge says
 * it is not really there.
 */
const STYLES = STROKE_STYLES;

export default function BorderEditor(props: {
  composite: Border;
  ladders: CompositeLadders;
  /** Called with the composite as the parts now stand. */
  onCommit: (composite: Border) => boolean;
}) {
  const change = (part: Partial<Border>): boolean =>
    props.onCommit({ ...props.composite, ...part });

  /** The specimen: a box with the edge the composite spells. */
  const specimen = (): Record<string, string> => {
    const out: Record<string, string> = {};
    if (props.composite.width !== "") {
      out["border-width"] = props.composite.width;
    }
    if (props.composite.style !== "") {
      out["border-style"] = props.composite.style;
    }
    if (props.composite.color !== "") {
      out["border-color"] = props.composite.color;
    }
    return out;
  };

  return (
    <div class="stack-sm">
      <div class="row-sm flex-wrap items-end gap-3">
        <StepField
          label="Width"
          value={props.composite.width}
          steps={props.ladders.widths}
          onPick={(value) => change({ width: value })}
        />
        <ChoiceField
          label="Style"
          value={props.composite.style}
          choices={STYLES}
          onPick={(value) => change({ style: value })}
        />
        <ColourField
          label="Colour"
          value={props.composite.color}
          steps={props.ladders.colors}
          onPick={(value) => change({ color: value })}
        />
      </div>
      <div
        class="h-10 w-24 rounded-md bg-surface-raised"
        style={specimen()}
        aria-hidden="true"
      />
    </div>
  );
}
