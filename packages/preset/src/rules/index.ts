import type { Rule } from "@unocss/core";
import { primitiveRules } from "./primitives/index.ts";
import type { Mode } from "./primitives/shared.ts";
import { borderRules } from "./border.ts";
import { colorRules } from "./color.ts";
import { componentRules } from "./component.ts";
import { iconRules } from "./primitives/icon.ts";
import { displayRules } from "./display.ts";
import { divideRules } from "./divide.ts";
import { gridRules } from "./grid.ts";
import { interactivityRules } from "./interactivity.ts";
import { layoutRules } from "./layout.ts";
import { opacityRules } from "./opacity.ts";
import { overflowRules } from "./overflow.ts";
import { positionRules } from "./position.ts";
import { radiusRules } from "./radius.ts";
import { shadowRules } from "./shadow.ts";
import { sizingRules } from "./sizing.ts";
import { spacingRules } from "./spacing.ts";
import { stackingRules } from "./stacking.ts";
import { textRules } from "./text.ts";
import { transitionRules } from "./transitions.ts";
import { typographyRules } from "./typography.ts";

export function spinRules(roots: readonly string[], mode: Mode): Rule[] {
  return [
    ...layoutRules(),
    ...displayRules(),
    ...gridRules(),
    ...opacityRules(),
    ...overflowRules(),
    ...textRules(),
    ...stackingRules(),
    ...transitionRules(),
    ...interactivityRules(),
    ...divideRules(),
    ...borderRules(),
    ...positionRules(),
    ...colorRules(),
    ...spacingRules(),
    ...sizingRules(),
    ...typographyRules(),
    ...radiusRules(),
    ...primitiveRules(roots, mode),
    ...shadowRules(),
    ...componentRules(roots),
    ...iconRules(roots),
  ];
}
