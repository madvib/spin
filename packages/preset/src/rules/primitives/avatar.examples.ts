/**
 * Avatar examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * An avatar is a face in a fixed square, its edge a step of the theme's
 * ladder and its crop filling that square. It is written two ways: the face
 * itself — an `<img>` carrying the `avatar` class — and a wrapper carrying
 * the same class around the face and a status dot, which is how a presence
 * indicator gets a corner to sit in. Four variants give the component its
 * range: the three ladder steps, `avatar-circle`, `avatar-ring` (a ring drawn
 * from the border tokens, painted outside the face so the theme's edge is the
 * image's edge), and `avatar-status` (the dot itself, a child of the avatar,
 * reading the semantic success token).
 *
 * The faces are inline data URIs: a head and shoulders on a gradient, so an
 * example is self-contained and no asset is fetched. Every class used here
 * resolves against the preset's own catalog; the self-resolution test fails
 * the suite if an example demonstrates what the package cannot do.
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

/** A portrait, inline: a silhouette on a gradient, no asset to fetch. */
const GRACE_FACE = "https://i.pravatar.cc/96?u=grace-mtan";
const ADA_FACE = "https://i.pravatar.cc/96?u=ada-mtan";
const ALAN_FACE = "https://i.pravatar.cc/96?u=alan-mtan";
const KATHERINE_FACE = "https://i.pravatar.cc/96?u=katherine-mtan";

const img = (classes: string, src: string, alt: string): string =>
  `<img class="${classes}" src="${src}" alt="${alt}">`;

/**
 * The wrapper form: the avatar class on a container, so a status dot has a
 * corner to sit in. The dot is a plain span with the `avatar-status` class —
 * it is placed against the avatar, so the avatar has to be its containing
 * block, which is the rule's job and not the caller's.
 */
const withStatus = (
  classes: string,
  src: string,
  alt: string,
): string =>
  `<span class="${classes}">
          <img src="${src}" alt="${alt}">
          <span class="avatar-status"></span>
        </span>`;

export const avatarFixtureNote =
  "A face in a fixed square: its edge a step of the theme's ladder, cropped " +
  "to fill the square and set inline so it sits beside text — an <img> " +
  "carrying the avatar class, or a wrapper carrying the same class around " +
  "the face and a status dot. avatar-circle trades the theme's radius for a " +
  "full circle, avatar-ring frames the face from the border tokens, and the " +
  "status dot reads the semantic success token. alt is required: the face is " +
  "content, and without alt it is invisible to assistive tech.";

export const AVATAR_EXAMPLES: readonly AvatarExample[] = [
  {
    name: "Sizes",
    html: row(
      `          ${img("avatar avatar-sm", GRACE_FACE, "Priya Raman")}
          ${img("avatar avatar-md", ADA_FACE, "Dan Okafor")}
          ${img("avatar avatar-lg", ALAN_FACE, "Mira Lindqvist")}`,
    ),
  },
  {
    name: "Circle",
    html: row(
      `          ${
        img("avatar avatar-circle avatar-md", ADA_FACE, "Tomas Berg")
      }
          ${
        img(
          "avatar avatar-circle avatar-lg",
          KATHERINE_FACE,
          "Aisha Farouk",
        )
      }`,
    ),
  },
  {
    name: "Beside a name",
    html: `        <div class="flex items-center gap-2">
          ${img("avatar avatar-md", ADA_FACE, "Tomas Berg")}
          <span>Tomas Berg</span>
        </div>`,
  },
  {
    name: "Ring",
    html: row(
      `          ${
        img("avatar avatar-ring avatar-md", GRACE_FACE, "Dan Okafor")
      }
          ${
        img(
          "avatar avatar-ring avatar-circle avatar-md",
          ALAN_FACE,
          "Mira Lindqvist",
        )
      }`,
    ),
  },
  {
    name: "Status",
    html: row(
      `          ${withStatus("avatar avatar-md", ADA_FACE, "Aisha Farouk")}
          ${
        withStatus(
          "avatar avatar-circle avatar-lg",
          KATHERINE_FACE,
          "Jonah Weiss",
        )
      }`,
    ),
  },
  {
    name: "Ring and status",
    html: row(
      `          ${
        withStatus("avatar avatar-ring avatar-md", GRACE_FACE, "Priya Raman")
      }`,
    ),
  },
];
