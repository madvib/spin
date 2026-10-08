/**
 * Card examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<card>` carries the base; sizes are classes on the tag. There is
 * no `card` class and never was one — the tag is the opt-in. Seven parts,
 * each its own tag: header, title, description, action, content, footer.
 * Every class used here resolves against the preset's own catalog; the
 * self-resolution test fails the suite if an example demonstrates what the
 * package cannot do.
 */

export interface CardExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const cardFixtureNote =
  "A card is a surface with seven parts, each its own tag: header, title, " +
  "description, action, content, footer. Sizes are classes on the tag — " +
  "card-default, card-narrow, card-wide. The footer holds classless buttons.";

export const CARD_EXAMPLES: readonly CardExample[] = [
  {
    name: "Every part",
    html: row(
      `          <card class="card-narrow">
            <card-header>
              <card-title>Card Title</card-title>
              <card-description>Card Description</card-description>
              <card-action>New</card-action>
            </card-header>
            <card-content>
              <p>Card content. Seven parts, each its own tag.</p>
            </card-content>
            <card-footer>
              <button>Save</button><button class="ghost">Cancel</button>
            </card-footer>
          </card>`,
    ),
  },
  {
    name: "Content only",
    html: row(
      `          <card class="card-narrow">
            <card-content>
              <p>A card needs no header or footer to be a card.</p>
            </card-content>
          </card>`,
    ),
  },
  {
    name: "Sizes",
    html: row(
      `          <card class="card-default">
            <card-content><p>Default</p></card-content>
          </card>
          <card class="card-narrow">
            <card-content><p>Narrow</p></card-content>
          </card>
          <card class="card-wide">
            <card-content><p>Wide</p></card-content>
          </card>`,
    ),
  },
  {
    name: "Header only",
    html: row(
      `          <card class="card-narrow">
            <card-header>
              <card-title>Title</card-title>
              <card-action>Action</card-action>
            </card-header>
          </card>`,
    ),
  },
  {
    name: "Footer actions",
    html: row(
      `          <card class="card-narrow">
            <card-content><p>Actions live in the footer.</p></card-content>
            <card-footer>
              <button class="ghost">Cancel</button>
              <button>Save</button>
            </card-footer>
          </card>`,
    ),
  },
];
