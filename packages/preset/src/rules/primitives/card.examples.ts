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

import type { ClassDoc } from "./example.ts";
import { sample } from "./sample-copy.ts";

export const CARD_CLASSES: readonly ClassDoc[] = [
  {
    name: "<card>",
    kind: "Component",
    description: "Raised surface that groups a topic",
  },
  {
    name: "<card-header>",
    kind: "Part",
    description: "Top row holding title, description, and action",
  },
  {
    name: "<card-title>",
    kind: "Part",
    description: "Name of what the card is about",
  },
  {
    name: "<card-description>",
    kind: "Part",
    description: "One-line summary under the title",
  },
  {
    name: "<card-action>",
    kind: "Part",
    description: "Control or state pinned to the header's end",
  },
  {
    name: "<card-content>",
    kind: "Part",
    description: "Body of the card",
  },
  {
    name: "<card-footer>",
    kind: "Part",
    description: "Action row along the bottom edge",
  },
  {
    name: "<card-figure>",
    kind: "Part",
    description: "Media band across the top of the card",
  },
  {
    name: ".card-narrow",
    kind: "Size",
    description: "Sidebar-width card (24rem)",
  },
  {
    name: ".card-wide",
    kind: "Size",
    description: "Main-column card (48rem)",
  },
  {
    name: ".card-ghost",
    kind: "Style",
    description: "Drops the chrome; keeps the parts",
  },
];

export interface CardExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center justify-center gap-2">
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
              <card-title>${sample.service.name}</card-title>
              <card-description>${sample.service.instances} instances across ${sample.service.regions} regions</card-description>
              <card-action>${sample.service.status}</card-action>
            </card-header>
            <card-content>
              <p>Running ${sample.service.version} since 09:14 UTC. p95 latency is
              214 ms and the error rate is 0.42%.</p>
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
              <p>${sample.article.paragraphs[0]}</p>
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
              <card-title>Service</card-title>
              <card-description>24rem wide</card-description>
            </card-header>
            <card-content><p>A service card in a sidebar.</p></card-content>
          </card>
          <card class="card-default">
            <card-header>
              <card-title>Release</card-title>
              <card-description>32rem wide</card-description>
            </card-header>
            <card-content><p>A release card in the main column.</p></card-content>
          </card>
          <card class="card-wide">
            <card-header>
              <card-title>Deploy</card-title>
              <card-description>48rem wide</card-description>
            </card-header>
            <card-content><p>A deploy card with its build log.</p></card-content>
          </card>
        </div>`,
  },
  {
    name: "Header only",
    html: row(
      `          <card class="card-narrow">
            <card-header>
              <card-title>${sample.service.name}</card-title>
              <card-action>${sample.service.status}</card-action>
            </card-header>
          </card>`,
    ),
  },
  {
    name: "Footer actions",
    html: row(
      `          <card class="card-narrow">
            <card-content><p>Approve the release, or send it back to the author.</p></card-content>
            <card-footer>
              <button class="ghost">Cancel</button>
              <button>Approve</button>
            </card-footer>
          </card>`,
    ),
  },
  {
    name: "Image on top",
    html: row(
      `          <card class="card-narrow">
            <card-figure>
              <div class="flex h-20 w-full items-center justify-center bg-surface-sunken text-primary"><i class="i-lucide-rocket icon-lg" aria-hidden="true"></i></div>
            </card-figure>
            <card-header>
              <card-title>Deploy #4821</card-title>
            </card-header>
            <card-content>
              <p>Ten per cent of traffic is on v4.12.0. The share grows in five minutes.</p>
            </card-content>
          </card>`,
    ),
  },
  {
    name: "Ghost",
    html: row(
      `          <card class="card-ghost">
            <card-header>
              <card-title>Release notes</card-title>
            </card-header>
            <card-content>
              <p>Deploy #4821 runs v4.12.0 in production: twelve instances, three
              regions, no failed health checks.</p>
            </card-content>
          </card>`,
    ),
  },
];
