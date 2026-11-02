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
import type { ClassDoc } from "./example.ts";


export interface StatExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const statFixtureNote =
  "A labelled number: title, value and description as part classes on a `stat` container. A row of them is a `stat-row`, and a row wraps.";

export const STAT_CLASSES: readonly ClassDoc[] = [
  {
    name: ".stat",
    kind: "Component",
    description: "Labelled number container; flex column with a gap between the parts",
  },
  {
    name: ".stat-row",
    kind: "Modifier",
    description: "Wrapping row of stats aligned on the shared top edge",
  },
  {
    name: ".stat-title",
    kind: "Part",
    description: "Label above the number; small muted semibold with wide tracking",
  },
  {
    name: ".stat-value",
    kind: "Part",
    description: "The number itself; largest type stat carries, set in mono",
  },
  {
    name: ".stat-desc",
    kind: "Part",
    description: "Context below the number; small muted supporting line",
  },
];
export const STAT_EXAMPLES: readonly StatExample[] = [
  {
    name: "Stat · title, value, description",
    html: `        <div class="stat">
          <div class="stat-title">Error rate</div>
          <div class="stat-value">0.42% <badge variant="success">-0.11%</badge></div>
          <div class="stat-desc">last 24 hours</div>
        </div>`,
  },
  {
    name: "Stat · three in a row",
    html: `        <div class="stat-row">
          <div class="stat">
            <div class="stat-title">p95 latency</div>
            <div class="stat-value">214 ms</div>
            <div class="stat-desc">last 24 hours</div>
          </div>
          <div class="stat">
            <div class="stat-title">Deploys</div>
            <div class="stat-value">38</div>
            <div class="stat-desc">last 7 days</div>
          </div>
          <div class="stat">
            <div class="stat-title">Failed checks</div>
            <div class="stat-value">3</div>
            <div class="stat-desc">last 24 hours</div>
          </div>
        </div>`,
  },
  {
    name: "Stat · with a delta",
    html: `        <div class="stat">
          <div class="stat-title">Uptime</div>
          <div class="stat-value">99.98% <badge variant="success">+0.02%</badge></div>
          <div class="stat-desc">vs. last week</div>
        </div>`,
  },
  {
    name: "Stat · in a card",
    html: `        <card>
          <div class="stat">
            <div class="stat-title">Deploy lead time</div>
            <div class="stat-value">14m 32s</div>
            <div class="stat-desc">this week</div>
          </div>
        </card>`,
  },
];
