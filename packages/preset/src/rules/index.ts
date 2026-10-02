import type { Rule } from "@unocss/core";
import { borderRules } from "./border.ts";
import { colorRules } from "./color.ts";
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
import { textRules } from "./text.ts";
import { transitionRules } from "./transitions.ts";
import { typographyRules } from "./typography.ts";

export function spinRules(): Rule[] {
  return [
    ...layoutRules(),
    ...displayRules(),
    ...gridRules(),
    ...opacityRules(),
    ...overflowRules(),
    ...textRules(),
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
    ...shadowRules(),
  ];
}
