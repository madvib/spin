/**
 * The typography editor: a family, a size, a weight and a tracking.
 *
 * These are the four decisions the type page already shows as separate
 * scales, and a typography token is a theme that has made all four at
 * once. So the editor offers the theme's own steps — the faces under
 * `font.family`, the sizes under `font.size`, the weights under
 * `font.weight` and the trackings under `font.tracking` — and the
 * specimen is set in the result, because a typography is read rather than
 * measured.
 *
 * The specimen wears the composite's own values, so the reader sees the
 * face, the size, the weight and the tracking together — which is the only
 * way a reader can tell whether the four belong to each other.
 */

import type { Composite, CompositeLadders } from "../../lib/tokens.ts";
import { PANGRAM } from "../../lib/specimen-copy.ts";
import { StepField } from "./CompositeEditor.tsx";

/** The parts a typography is made of. */
type Typography = Extract<Composite, { type: "typography" }>;

export default function TypographyEditor(props: {
  composite: Typography;
  ladders: CompositeLadders;
  /** Called with the composite as the parts now stand. */
  onCommit: (composite: Typography) => boolean;
}) {
  const change = (part: Partial<Typography>): boolean =>
    props.onCommit({ ...props.composite, ...part });

  /** The specimen, set in the composite's own four decisions. */
  const specimen = (): Record<string, string> => {
    const out: Record<string, string> = {};
    if (props.composite.family !== "") {
      out["font-family"] = props.composite.family;
    }
    if (props.composite.size !== "") out["font-size"] = props.composite.size;
    if (props.composite.weight !== "") {
      out["font-weight"] = props.composite.weight;
    }
    if (props.composite.tracking !== "") {
      out["letter-spacing"] = props.composite.tracking;
    }
    return out;
  };

  return (
    <div class="stack-sm">
      <div class="row-sm flex-wrap items-end gap-3">
        <StepField
          label="Family"
          value={props.composite.family}
          steps={props.ladders.families}
          onPick={(value) => change({ family: value })}
        />
        <StepField
          label="Size"
          value={props.composite.size}
          steps={props.ladders.sizes}
          onPick={(value) => change({ size: value })}
        />
        <StepField
          label="Weight"
          value={props.composite.weight}
          steps={props.ladders.weights}
          onPick={(value) => change({ weight: value })}
        />
        <StepField
          label="Tracking"
          value={props.composite.tracking}
          steps={props.ladders.trackings}
          onPick={(value) => change({ tracking: value })}
        />
      </div>
      <p class="max-w-[32rem]" style={specimen()}>
        {PANGRAM}
      </p>
    </div>
  );
}
