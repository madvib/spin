/**
 * Popover examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<popover>` carries the base; the tag is the opt-in. There is no
 * `popover` class and never was one — the platform owns the mechanism and
 * this component owns the surface. Every class used here resolves against
 * the preset's own catalog; the self-resolution test fails the suite if an
 * example demonstrates what the package cannot do.
 */

export interface PopoverExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const popoverFixtureNote =
  "A card in the top layer: `popovertarget` shows it without script, and light-dismiss is the platform's.";

export const POPOVER_SURFACE_EXAMPLES: readonly PopoverExample[] = [
  {
    name: "Popover",
    html: row(
      `          <button popovertarget="menu">Actions</button>
          <popover id="menu" popover="">Copy link, re-run, view logs</popover>`,
    ),
  },
  {
    name: "Popover with content",
    html: row(
      `          <button popovertarget="profile">Account</button>
          <popover id="profile" popover="">
            <div class="flex flex-col gap-2">
              <strong>Tomas Berg</strong>
              <span>tomas@lodestar.dev</span>
            </div>
          </popover>`,
    ),
  },
];

export const tooltipFixtureNote =
  "The popover surface in a smaller box, revealed on hover or focus of the element before it.";

export const TOOLTIP_EXAMPLES: readonly PopoverExample[] = [
  {
    name: "Tooltip",
    html: row(
      `          <button>Rollback</button>
          <tooltip>Returns traffic to v4.11.2 in under two minutes.</tooltip>`,
    ),
  },
  {
    name: "Tooltip · focus reveals",
    html: row(
      `          <a href="#">Release notes</a>
          <tooltip>Every change between v4.11.2 and v4.12.0.</tooltip>`,
    ),
  },
  {
    name: "Tooltip · inline in prose",
    html: row(
      `          <p>A canary moves <span>10%<tooltip>Share of traffic on the new release.</tooltip></span> of requests to eu-west-1.</p>`,
    ),
  },
  {
    name: "Tooltip · long text",
    html: row(
      `          <button>Rollback</button>
          <tooltip>The previous release keeps serving 90% of traffic until the rollout is promoted or rolled back.</tooltip>`,
    ),
  },
];

export const POPOVER_EXAMPLES: readonly PopoverExample[] = [
  ...POPOVER_SURFACE_EXAMPLES,
  ...TOOLTIP_EXAMPLES,
];
