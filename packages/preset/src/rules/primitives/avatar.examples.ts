/**
 * Avatar examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * An avatar is an `<img>` carrying the `avatar` class: a face in a fixed
 * square, its edge a step of the theme's ladder, cropped to fill the square
 * and set inline so it sits beside a name. `avatar-circle` trades the
 * theme's radius for a full circle. Every class used here resolves against
 * the preset's own catalog; the self-resolution test fails the suite if an
 * example demonstrates what the package cannot do.
 */

export interface AvatarExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

const img = (classes: string, src: string, alt: string): string =>
  `<img class="${classes}" src="${src}" alt="${alt}">`;

export const avatarFixtureNote =
  "A face in a fixed square: an <img> carrying the avatar class, its " +
  "edge a step of the theme's ladder — sm in a list, md beside a name, " +
  "lg as the page's subject — cropped to fill the square and set inline " +
  "so it sits beside text. avatar-circle trades the theme's radius for " +
  "a full circle. alt is required: the face is content, and without " +
  "alt it is invisible to assistive tech.";

export const AVATAR_EXAMPLES: readonly AvatarExample[] = [
  {
    name: "Sizes",
    html: row(
      `          ${img("avatar avatar-sm", "avatar-grace.png", "Grace Hopper")}
          ${img("avatar avatar-md", "avatar-ada.png", "Ada Lovelace")}
          ${img("avatar avatar-lg", "avatar-alan.png", "Alan Turing")}`,
    ),
  },
  {
    name: "Circle",
    html: row(
      `          ${img("avatar avatar-circle", "avatar-ada.png", "Ada Lovelace")}`,
    ),
  },
  {
    name: "Beside a name",
    html: `        <div class="flex items-center gap-2">
          ${img("avatar avatar-md", "avatar-ada.png", "Ada Lovelace")}
          <span>Ada Lovelace</span>
        </div>`,
  },
];
