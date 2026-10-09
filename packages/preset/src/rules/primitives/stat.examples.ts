/**
 * Stat examples — the markup a consumer writes, beside the rule that styles
 * it.
 *
 * A stat is a class-entry composite: the container is `class="stat"` and its
 * children carry the part classes — title, value, description — because no
 * semantic element means a number with a label. There is no `stat` tag; the
 * class is the opt-in. Every class used here resolves against the preset's
 * own catalog; the self-resolution test fails the suite if an example
 * demonstrates what the package cannot do.
 */

export interface StatExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const statFixtureNote =
  "A stat is a labelled number: the value is the point, the title names it, " +
  "the description gives it context. It is a class-entry composite — a `stat` " +
  "container whose children carry `stat-title`, `stat-value` and `stat-desc` — " +
  "and any number of them sit side by side in a flex row. A delta rides " +
  "inside the value as plain text.";

export const STAT_EXAMPLES: readonly StatExample[] = [
  {
    name: "Stat · title, value, description",
    html:
      `        <div class="stat">
          <div class="stat-title">Revenue</div>
          <div class="stat-value">$48,290</div>
          <div class="stat-desc">vs. last month</div>
        </div>`,
  },
  {
    name: "Stat · three in a row",
    html:
      `        <div class="flex items-start gap-2">
          <div class="stat">
            <div class="stat-title">Revenue</div>
            <div class="stat-value">$48,290</div>
            <div class="stat-desc">vs. last month</div>
          </div>
          <div class="stat">
            <div class="stat-title">Orders</div>
            <div class="stat-value">1,204</div>
            <div class="stat-desc">vs. last month</div>
          </div>
          <div class="stat">
            <div class="stat-title">Refunds</div>
            <div class="stat-value">31</div>
            <div class="stat-desc">vs. last month</div>
          </div>
        </div>`,
  },
  {
    name: "Stat · with a delta",
    html:
      `        <div class="stat">
          <div class="stat-title">Conversion</div>
          <div class="stat-value">3.2% <span>+0.4%</span></div>
          <div class="stat-desc">vs. last month</div>
        </div>`,
  },
  {
    name: "Stat · in a card",
    html:
      `        <card>
          <div class="stat">
            <div class="stat-title">Active users</div>
            <div class="stat-value">8,120</div>
            <div class="stat-desc">this week</div>
          </div>
        </card>`,
  },
];
