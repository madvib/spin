/**
 * Skeleton examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A skeleton is class-entry and element-agnostic: any element carrying
 * `skeleton` is a placeholder block, and it keeps that meaning wherever it is
 * put. The variants shape the block into the thing it waits for — a line of
 * copy, a face — and the size itself is the consumer's, because only the
 * consumer knows how big the content will be. Every class used here resolves
 * against the preset's own catalog; the self-resolution test fails the suite
 * if an example demonstrates what the package cannot do.
 */

import type { ClassDoc } from "./example.ts";

export const SKELETON_CLASSES: readonly ClassDoc[] = [
  {
    name: ".skeleton",
    kind: "Component",
    description: "Pulsing placeholder block; the size is the consumer's",
  },
  {
    name: ".skeleton-text",
    kind: "Part",
    description: "Line-height block that stands in for a line of copy",
  },
  {
    name: ".skeleton-circle",
    kind: "Part",
    description: "Face-sized circle for avatar slots",
  },
];

export interface SkeletonExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const skeletonFixtureNote =
  "A placeholder block that pulses — no JavaScript. `skeleton-text` takes a line's height, `skeleton-circle` is face-sized.";

export const SKELETON_EXAMPLES: readonly SkeletonExample[] = [
  {
    name: "Skeleton · a card waiting for its release",
    html: `        <div class="flex w-full max-w-sm flex-col gap-2">
          <div class="skeleton h-36 w-full"></div>
          <div class="skeleton skeleton-text w-3/4"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>`,
  },
  {
    name: "Skeleton · text lines and their spacing",
    html: `        <div class="w-full">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>`,
  },
  {
    name: "Skeleton · a circle beside two lines",
    html: `        <div class="flex w-full items-center gap-2">
          <div class="skeleton skeleton-circle"></div>
          <div class="flex grow flex-col">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>`,
  },
];
