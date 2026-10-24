/**
 * @spinjs/animation — keyframes and the utilities that name them.
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

import type { PreflightProvider } from "../theme/base/index.ts";
import { type AnimationContract, animationContract } from "./manifest.ts";
import { animationCss } from "./styles.ts";

export type { AnimationContract };
export { animationContract, animationCss };

/** Every `animate-*` utility class name the stylesheet defines. */
export function animationVariants(): Set<string> {
  return new Set(animationContract.variants);
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
