/**
 * Tabs examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<tabs>` carries the base; the rail is radio inputs and the
 * panels are their siblings. There is no `tabs` class and never was one —
 * the tag is the opt-in. Every class used here resolves against the
 * preset's own catalog; the self-resolution test fails the suite if an
 * example demonstrates what the package cannot do.
 */

export interface TabsExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const tabsFixtureNote =
  "No JavaScript at all: radio inputs and :checked drive both the tab's " +
  "appearance and its panel's visibility. The radios stay in the " +
  "accessibility tree — collapsed to a pixel, not hidden — so the tabs " +
  "are keyboard reachable and a screen reader announces them.";

export const TABS_EXAMPLES: readonly TabsExample[] = [
  {
    name: "Horizontal",
    html: `<tabs>
          <div><label><input type="radio" name="t1" checked> Overview</label><section>Panel one. Nothing here is script — the radio is checked and the panel is its sibling.</section></div>
          <div><label><input type="radio" name="t1"> Details</label><section>Panel two.</section></div>
          <div><label><input type="radio" name="t1"> Settings</label><section>Panel three.</section></div>
        </tabs>`,
  },
  {
    name: "Vertical · a structural variant",
    html: `<tabs class="tabs-vertical">
          <div><label><input type="radio" name="t2" checked> One</label><section>The rail runs down and the panel beside it.</section></div>
          <div><label><input type="radio" name="t2"> Two</label><section>Second.</section></div>
        </tabs>`,
  },
  {
    name: "Disabled · an unavailable tab",
    html: `<tabs>
          <div><label><input type="radio" name="t3" checked> Overview</label><section>Panel one. Nothing here is script — the radio is checked and the panel is its sibling.</section></div>
          <div><label><input type="radio" name="t3" disabled> Details</label><section>Panel two.</section></div>
          <div><label><input type="radio" name="t3"> Settings</label><section>Panel three.</section></div>
        </tabs>`,
  },
];
