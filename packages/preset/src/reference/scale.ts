/**
 * A SCALE is steps multiplied by axes — `p-*` is seven steps across seven axes,
 * forty-two names, and one thing to look at.
 *
 * Rendering forty-two entries is not a reference. It is an inventory with a
 * preview bolted on every row, and the preview is identical in all of them,
 * which is the tell: when a list's rows look the same, the list is showing you
 * the WIDTH of a set rather than its SHAPE.
 *
 * So a scale is shown once, with its steps as the visible axis and its
 * modifiers as controls on it. The reader changes `px` to `pb` and watches the
 * same value move to a different edge, which is the thing they actually came
 * to find out — and forty-two rows become one preview and a handful of buttons.
 */

import type { Sample } from "../organization.ts";

/** One step of a scale: the suffix and what it resolves to. */
export interface Step {
  /** The suffix a consumer writes: `4` in `p-4`. */
  readonly key: string;
  /**
   * The class, which depends on the axis the reader has chosen — `p-4` on the
   * bare axis and `px-4` on the inline one. Built at render time rather than
   * held here, because a step is a key and the axis is a view.
   */
  readonly value?: string;
}

/** One axis a scale applies along: `px` in `px-4`. */
export interface Axis {
  /** The prefix, empty for the bare scale. */
  readonly key: string;
  /** What it does, in a word rather than a code fragment. */
  readonly label: string;
}

/**
 * A scale, shaped for display.
 *
 * `steps` and `axes` are the two things a list of names hides. A reader who
 * sees forty-two `p-*` names learns nothing; a reader who sees seven steps
 * along four edges learns the whole shape of the scale in one glance.
 */
export interface Scale {
  /** The name of the scale, for the heading. */
  readonly id: string;
  readonly title: string;
  /** What the scale does, in a line. */
  readonly blurb: string;
  /** The steps, in scale order. Never sorted alphabetically. */
  readonly steps: readonly Step[];
  /** The axes it can apply along. */
  readonly axes: readonly Axis[];
  /**
   * The sample, once.
   *
   * One element carrying the class, so a scale costs one preview rather than
   * one per name.
   */
  readonly sample?: Sample;
  /** Scales with a continuous value get a slider instead of named stops. */
  readonly continuum?: {
    min: number;
    max: number;
    step: number;
    name: (n: number) => string;
  };
}

/**
 * The axes every spacing scale shares.
 *
 * Declared ONCE, because `px-4` and `py-4` and `pt-4` differ only in which
 * word precedes the step, and typing the seven axes four times is how one of
 * them ends up wrong.
 */
export const EDGES: readonly Axis[] = [
  { key: "", label: "all" },
  { key: "x", label: "inline" },
  { key: "y", label: "block" },
  { key: "t", label: "top" },
  { key: "r", label: "right" },
  { key: "b", label: "bottom" },
  { key: "l", label: "left" },
];
