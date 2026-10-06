import type { Rule } from "@unocss/core";
import { primitiveContracts } from "./primitives/manifest.ts";
import { type ThemeContext, themeOf } from "../utils/lookup.ts";

/**
 * Component character tokens, spent as utilities.
 *
 * A component's character tokens are a customisation axis, not a parallel
 * vocabulary: `button.weight` is spent as `button-weight`, reading the same
 * `theme.button.weight` the preflight emitted. The utility is the component
 * root plus the step the theme declared — never a hardcoded list per
 * component, so a token added to the manifest is spendable by the same change
 * that added it.
 *
 * One rule per declared component root, generated at preset construction. A
 * blanket `^(?<comp>[a-z][a-z0-9]*)-(?<step>.+)$` would swallow `font-sans`,
 * `text-lg`, `border-x` and every other utility, so each rule matches only its
 * own root: `^button-(.+)$`, `^form-(.+)$`, …. The root is the only thing that
 * distinguishes a component token from a scale utility, and it comes from the
 * manifest rather than a list here.
 */
export function componentRules(roots: readonly string[]): Rule[] {
  return roots.flatMap((root): Rule[] => {
    const character = primitiveContracts[root]?.character ?? [];
    const typeByStep: Record<string, string> = {};
    for (const token of character) {
      const step = stepOf(root, token.path);
      if (step !== undefined) typeByStep[step] = token.type;
    }
    return [
      [
        new RegExp(`^${root}-(.+)$`),
        ([, step]: string[], ctx?: ThemeContext) => {
          const value = themeOf(ctx)?.[root]?.[step];
          if (value === undefined) return undefined;
          const type = typeByStep[step];
          if (type === undefined) return undefined;
          const property = propertyFor(type, step);
          if (property === undefined) return undefined;
          return { [property]: valueFor(type, step, value) };
        },
        { autocomplete: `${root}-$${root}` },
      ],
    ];
  });
}

/** The step below a root, from the token's dotted path. */
function stepOf(root: string, path: string): string | undefined {
  const prefix = `${root}.`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : undefined;
}

/**
 * The property a token's type sets, when the type alone decides it.
 *
 * A token does not know what it styles — `button.weight` is a number whether
 * it is a font weight or a border width — so the type is the first signal.
 * `dimension` and `number` are absent because their property depends on the
 * step: a dimension under `tracking` is a letter-spacing, under `border-width`
 * a border-width, under `hover-lift` a translate.
 */
const TYPE_PROPERTY: Record<string, string> = {
  color: "color",
  fontFamily: "font-family",
  fontWeight: "font-weight",
  shadow: "box-shadow",
  textTransform: "text-transform",
  gradient: "background-image",
  duration: "transition-duration",
  cubicBezier: "transition-timing-function",
  transition: "transition",
  strokeStyle: "border-style",
  border: "border-width",
  typography: "font",
};

/** The property a token sets, from its type and step. */
function propertyFor(type: string, step: string): string | undefined {
  if (type === "dimension" || type === "number") {
    if (step.includes("hover-lift")) return "transform";
    if (step.includes("tracking")) return "letter-spacing";
    return step;
  }
  return TYPE_PROPERTY[type];
}

/** The value a token emits, from its type and step. */
function valueFor(type: string, step: string, value: string): string {
  // A dimension under a hover-lift step is a translate along that axis: the
  // x step lifts horizontally, the y step vertically, each zeroing the other.
  if (type === "dimension" && step.includes("hover-lift")) {
    if (step.endsWith("-x")) return `translate(${value}, 0)`;
    if (step.endsWith("-y")) return `translate(0, ${value})`;
    return `translate(${value})`;
  }
  return value;
}
