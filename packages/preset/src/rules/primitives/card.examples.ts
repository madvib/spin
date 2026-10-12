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

import { sample } from "./sample-copy.ts";

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
  "A surface with eight parts, each its own tag. Sizes are classes on the tag; `card-ghost` drops the chrome.";

export const CARD_EXAMPLES: readonly CardExample[] = [
  {
    name: "Every part",
    html: row(
      `          <card class="card-narrow">
            <card-header>
              <card-title>${sample.product.name}</card-title>
              <card-description>${sample.product.notes}</card-description>
              <card-action>In season</card-action>
            </card-header>
            <card-content>
              <p>${sample.product.origin}. ${sample.product.process}. Roasted
              this week and shipped the next.</p>
            </card-content>
            <card-footer>
              <button>${sample.actions.primary}</button><button class="ghost">${sample.actions.secondary}</button>
            </card-footer>
          </card>`,
    ),
  },
  {
    name: "Content only",
    html: row(
      `          <card class="card-narrow">
            <card-content>
              <p>${sample.article.body[0]}</p>
            </card-content>
          </card>`,
    ),
  },
  {
    name: "Sizes",
    // The size variants are three objects, so they are spaced as three
    // objects: the wrapper's step is the largest the scale owns, not the
    // hairline a row of parts sits at. A tight row reads as one ragged
    // strip with a seam in it, which is the opposite of what a comparison
    // of sizes is for.
    html: `<div class="flex flex-wrap items-center gap-8">
          <card class="card-narrow">
            <card-header>
              <card-title>Narrow</card-title>
              <card-description>24rem — a column card</card-description>
            </card-header>
            <card-content><p>Sidebars, rails, tight grids.</p></card-content>
          </card>
          <card class="card-default">
            <card-header>
              <card-title>Default</card-title>
              <card-description>32rem — the page measure</card-description>
            </card-header>
            <card-content><p>Dialogs, settings panels, forms.</p></card-content>
          </card>
          <card class="card-wide">
            <card-header>
              <card-title>Wide</card-title>
              <card-description>48rem — a spanning card</card-description>
            </card-header>
            <card-content><p>Dashboards, tables, galleries.</p></card-content>
          </card>
        </div>`,
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
  {
    name: "Image on top",
    html: row(
      `          <card class="card-narrow">
            <card-figure>
              <img src="https://picsum.photos/400/200" alt="A placeholder photograph" class="block w-full">
            </card-figure>
            <card-header>
              <card-title>Card Title</card-title>
            </card-header>
            <card-content>
              <p>The figure bleeds to the surface edge; the corners hold.</p>
            </card-content>
          </card>`,
    ),
  },
  {
    name: "Ghost",
    html: row(
      `          <card class="card-ghost">
            <card-header>
              <card-title>Ungrouped</card-title>
            </card-header>
            <card-content>
              <p>Grouping without a box: no border, no surface, no shadow.</p>
            </card-content>
          </card>`,
    ),
  },
];
