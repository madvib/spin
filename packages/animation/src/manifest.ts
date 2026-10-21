/**
 * Primitives manifest — the contract the CSS owns, written down.
 *
 * Previously derived at module scope by parsing the stylesheets with postcss.
 * That put a CSS parser in the shipped graph for what is really an authoring
 * fact: when someone writes a new selector they know whether it claims an
 * element or defines a variant. This file is that knowledge, beside the CSS
 * instead of extracted from it, and `animation.test.ts` fails the suite when
 * the two disagree.
 *
 * `tags` are bare elements the component styles; a utility class on one is a
 * conflict, enforced by the lint plugin. `variants` are the classes an author
 * may write. `keyframes` are the names the stylesheet defines — the global
 * namespace, so a name here is a name nothing else may take. `reads` are the
 * custom properties the CSS consumes, without the leading `--`; every entry
 * must resolve against the theme contract.
 */

export interface PrimitiveContract {
  /** Bare tag names the component styles, e.g. `button`, `h1`. */
  tags: readonly string[];
  /** Class names the component defines, e.g. `secondary`. */
  variants: readonly string[];
  /** Keyframe names the stylesheet defines, e.g. `spin`. */
  keyframes: readonly string[];
  /** Custom properties the stylesheet reads, without the leading `--`. */
  reads: readonly string[];
  /**
   * Tokens the theme genuinely authors for this component, as dotted paths.
   * A theme that enables the component is required to declare these; a theme
   * that spends shared scales declares none.
   */
  character: readonly string[];
}

/** The contract per component, keyed by file stem. */
export const primitiveContracts: Record<string, PrimitiveContract> = {
  animation: {
    tags: [],
    variants: [
      "animate-fade-in",
      "animate-none",
      "animate-ping",
      "animate-pulse",
      "animate-slide-up",
      "animate-spin",
    ],
    keyframes: [
      "backdrop-in",
      "dialog-in",
      "fade-in",
      "ping",
      "progress-indeterminate",
      "pulse",
      "slide-up",
      "spin",
      "spin-skeleton-pulse",
    ],
    reads: [
      "motion-distance",
      "motion-duration-base",
      "motion-duration-slow",
      "motion-easing-decelerate",
      "motion-easing-linear",
      "motion-easing-standard",
    ],
    character: [],
  },
};
