/**
 * Animation manifest — the contract `animation.css` owns, written down.
 *
 * `variants` are the `animate-*` classes an author may write. `keyframes` are
 * the `@keyframes` names the stylesheet defines — the one global CSS namespace,
 * so a name here is a name nothing else may take. `reads` are the custom
 * properties the CSS consumes, without the leading `--`; every entry must
 * resolve against the theme contract.
 */

export interface AnimationContract {
  /** Class names the stylesheet defines, e.g. `animate-spin`. */
  readonly variants: readonly string[];
  /** Keyframe names the stylesheet defines, e.g. `spin`. */
  readonly keyframes: readonly string[];
  /** Custom properties the stylesheet reads, without the leading `--`. */
  readonly reads: readonly string[];
}

/** The contract for `animation.css`. */
export const animationContract: AnimationContract = {
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
    "motion-duration-loop",
    "motion-duration-slow",
    "motion-easing-decelerate",
    "motion-easing-linear",
    "motion-easing-standard",
  ],
};
