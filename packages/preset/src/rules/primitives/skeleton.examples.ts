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

export interface SkeletonExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const skeletonFixtureNote =
  "A skeleton is a placeholder block that pulses — a loader with no " +
  "JavaScript in it. It is one material: the `field` surface a control " +
  "takes, an inset hole the content has not filled yet, at the small radius " +
  "of a boxed thing. The block takes the size the content will take — here " +
  "the three lines it stands for give a card its height — because only the " +
  "consumer knows how big the real thing is. `skeleton-text` shapes it into " +
  "a line of copy: the height is the text's own size, so a loading paragraph " +
  "occupies the line boxes the paragraph will occupy and nothing reflows " +
  "when the words land, and the space under each line is the theme's own, " +
  "so stacked lines carry the rhythm the real text will carry. " +
  "`skeleton-circle` shapes it into a face, its edge read from the avatar " +
  "ladder so a loading face and a real one fill the same square. The pulse " +
  "spends the motion scale's fast duration and standard easing, and the " +
  "global reduced-motion clamp stops it for a reader who asks.";

export const SKELETON_EXAMPLES: readonly SkeletonExample[] = [
  {
    name: "Skeleton · a card-shaped block",
    html: `        <div class="skeleton">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>`,
  },
  {
    name: "Skeleton · text lines and their rhythm",
    html: `        <div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>`,
  },
  {
    name: "Skeleton · a circle beside two lines",
    html: `        <div class="flex items-center gap-2">
          <div class="skeleton skeleton-circle"></div>
          <div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>`,
  },
];
