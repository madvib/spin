/**
 * @spin/animation — keyframes and the utilities that name them.
 *
 * A separate concern from primitives because motion is the one global
 * namespace in CSS. `@keyframes` cannot be scoped or tree-shaken, so every
 * keyframe in the system lives here, adjacent to the class that names it —
 * a definition separated from its caller is a definition that can ship
 * without it.
 *
 * Shapes are the library's; timing is the theme's. Every utility spends the
 * motion scale rather than naming a duration, so a theme sets the feel once
 * and every animation inherits it. Ships unconditionally: it is small, and a
 * component that references a keyframe must never be shipped without it.
 */

import type { PreflightProvider } from "@spin/theme/base";
import { primitiveContracts } from "./manifest.ts";
import type { PrimitiveContract } from "./manifest.ts";
import { animationCss } from "./styles.ts";

export type { PrimitiveContract };
export { primitiveContracts } from "./manifest.ts";
export { animationCss };

/** The stylesheets, keyed by component name. */
export const primitiveModules: Record<string, string> = {
  animation: animationCss,
};

/**
 * A component's contract, declared in the manifest beside its stylesheet.
 *
 * `tags` is what the component styles and therefore owns: a utility class on
 * one of these is a conflict rather than an extension. `reads` is every custom
 * property the stylesheet consumes, which is the set a theme has to satisfy.
 */
export interface PrimitiveComponent extends PrimitiveContract {
  /** Component name, matching the file stem. */
  name: string;
  /** The stylesheet. */
  css: string;
}

/** Every component's contract, keyed by name. */
export const primitiveComponents: Record<string, PrimitiveComponent> = Object
  .fromEntries(
    Object.entries(primitiveContracts).map(([name, contract]) => [
      name,
      { ...contract, name, css: primitiveModules[name] as string },
    ]),
  );

/**
 * Tags any component owns. A utility class on one of these is a conflict,
 * because the component already decides how that element looks.
 */
export function claimedElements(): Set<string> {
  const out = new Set<string>();
  for (const component of Object.values(primitiveComponents)) {
    for (const tag of component.tags) out.add(tag);
  }
  return out;
}

/** Every class name the primitives define, across all components. */
export function primitiveVariants(): Set<string> {
  const out = new Set<string>();
  for (const component of Object.values(primitiveComponents)) {
    for (const variant of component.variants) out.add(variant);
  }
  return out;
}

/**
 * Custom properties the primitives read, grouped by the top-level token
 * group they belong to (`button`, `color`, `font`, ...).
 */
export function primitiveReadsByGroup(): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const component of Object.values(primitiveComponents)) {
    for (const token of component.reads) {
      const [group, ...rest] = token.split("-");
      // A multi-segment name like `on-primary` belongs to the group that
      // precedes it; a single-segment name like `white` has no group.
      const key = rest.length > 0 ? group : "color";
      (out[key] ??= new Set<string>()).add([key, ...rest].join("-"));
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, [...v].sort()]),
  );
}

/**
 * Concatenate the selected stylesheets. `undefined` means all of them; the
 * preset passes straight through.
 */
export function generatePrimitivesCss(components?: string[]): string {
  const selected = components ?? Object.keys(primitiveModules);
  return selected
    .filter((name) => name in primitiveModules)
    .map((name) => primitiveModules[name])
    .join("\n\n");
}

/**
 * The motion layer. Sits with the primitives at the component layer rather
 * than below them: an `animate-*` class is a default an author overrides, and
 * putting it lower would let a component's own transitions beat it.
 */
export function animationPreflights(): PreflightProvider[] {
  return [
    {
      name: "animation",
      order: -50,
      getCSS: () => animationCss,
    },
  ];
}
