/**
 * What the theme puts on elements and classes, as the checks read it.
 *
 * Shapes only: the checks ask what an element carries and what a class
 * sets, and the engine answers through these. The Uno implementation that
 * fills them lives preset-side (`../compiler/answers.ts`), reading the
 * same rules the browser's stylesheet comes from.
 */

export type { Ancestor, Surfaces } from "@spinjs/preset";
