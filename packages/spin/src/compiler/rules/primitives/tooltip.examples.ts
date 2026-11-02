/**
 * Tooltip examples — the markup a consumer writes, beside the rule that styles it.
 *
 * A bare `<tooltip>` is a hover chip: hidden at rest, small by construction,
 * floating beside the control it explains. Position comes from the caller
 * (the chip sits beside whatever anchors it) and reveal comes from hover
 * utilities — the examples below hold the chip open with a wrapping row so
 * the gallery can show it, exactly as a consumer would during development.
 */

import type { ClassDoc } from "./example.ts";

export interface TooltipExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const TOOLTIP_CLASSES: readonly ClassDoc[] = [
  {
    name: "<tooltip>",
    kind: "Component",
    description: "Hover chip; hidden at rest, small, floating beside its anchor",
  },
];

export const tooltipFixtureNote =
  "A hover chip for one-line notes — hidden until its anchor is hovered or focused, never body copy.";

export const TOOLTIP_EXAMPLES: readonly TooltipExample[] = [
  {
    name: "Tooltip · the chip",
    html: `<span class="relative inline-flex items-center">
  <button type="button" class="bare peer inline-flex items-center">Deploy</button>
  <tooltip class="visible start-0 top-full whitespace-nowrap">Ships the canary to one region</tooltip>
</span>`,
  },
  {
    name: "Tooltip · revealed on hover",
    html: `<span class="relative inline-flex items-center">
  <button type="button" class="bare peer inline-flex items-center">Deploy</button>
  <tooltip class="start-0 top-full whitespace-nowrap peer-hover:visible peer-focus-visible:visible">Ships the canary to one region</tooltip>
</span>`,
  },
  {
    name: "Tooltip · a longer note wraps",
    html: `<span class="relative inline-flex items-center">
  <button type="button" class="bare peer inline-flex items-center">Linked</button>
  <tooltip class="start-0 top-full whitespace-normal peer-hover:visible peer-focus-visible:visible">One step moves every step by the same ratio</tooltip>
</span>`,
  },
];
