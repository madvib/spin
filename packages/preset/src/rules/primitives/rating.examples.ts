/**
 * Rating examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A rating is a class-entry composite with no element behind it: a `.rating`
 * container of five `.rating-star` radios sharing a name. The container is
 * `row-reverse`, which is what makes `:checked ~ input` fill the stars at or
 * below the checked one in reading order, and the `name` is what keeps two
 * ratings on a page independent of each other. Every class used here
 * resolves against the preset's own catalog; the self-resolution test fails
 * the suite if an example demonstrates what the package cannot do.
 */

export interface RatingExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

/** One star: an input named for its group, labelled by the value it stands for. */
const star = (name: string, label: string, attrs: readonly string[]): string =>
  `          <input type="radio" class="rating-star" name="${name}" aria-label="${label}"${
    attrs.length > 0 ? ` ${attrs.join(" ")}` : ""
  }>`;

/**
 * Five stars under one `name`, which is the whole group a rating reads its
 * value from. States are attributes: `checked` is the value, `disabled` is
 * the platform's.
 */
const stars = (
  name: string,
  group: string,
  options: { readonly checked?: number; readonly disabled?: boolean } = {},
): string => {
  const attrs = (index: number): readonly string[] => [
    ...(options.checked === index ? ["checked"] : []),
    ...(options.disabled ? ["disabled"] : []),
  ];
  return `        <div class="rating" role="radiogroup" aria-label="${group}">
${
    [1, 2, 3, 4, 5].map((n) =>
      star(name, `${n} star${n === 1 ? "" : "s"}`, attrs(n))
    ).join("\n")
  }
        </div>`;
};

export const ratingFixtureNote =
  "A rating is five radios read as stars: a `.rating` container of " +
  "`.rating-star` radios sharing a name, so the value, the keyboard " +
  "behaviour and the disabled state all belong to the platform. The container " +
  "is `row-reverse` — DOM order 1..5 renders 5..1, so a later sibling is a " +
  "star further left and `:checked ~ input` fills exactly the stars at or " +
  "below the checked one in reading order. An empty star is `text-muted`, a " +
  "filled one is the warning colour: a rating is a judgement, and a judgement " +
  "is an attention. The `name` is the whole group — two ratings side by side " +
  "are two names, never one.";

export const RATING_EXAMPLES: readonly RatingExample[] = [
  {
    name: "Rating · unrated",
    html: stars("rating", "Rating"),
  },
  {
    name: "Rating · preset to 3",
    html: stars("rating", "Rating", { checked: 3 }),
  },
  {
    name: "Rating · disabled",
    html: stars("rating", "Rating", { disabled: true }),
  },
  {
    name: "Rating · two independent ratings",
    html: row(
      `          ${stars("quality", "Quality")}
          ${stars("delivery", "Delivery")}`,
    ),
  },
];
