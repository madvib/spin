/**
 * Meter examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<meter>` carries the base; the tag is the opt-in, and there is
 * no `meter` class. The bands are the platform's: `low` and `high` divide
 * the range and `optimum` points at the good side, so which of the three
 * fills a gauge shows is decided by the attributes, never by the author
 * picking a colour.
 */

export interface MeterExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const meterFixtureNote =
  "A meter is a gauge over a known range: with `optimum` above `high` " +
  "the top band is the good one, the middle band is suboptimal, and " +
  "below `low` is even less good. All three gauges below share one " +
  "range — 0..100, low 40, high 70, optimum 90 — so 90 is optimum, 55 " +
  "suboptimum, 10 even less good. A meter with only a `value` keeps the " +
  "default 0..1 range, and `disabled` is an attribute like on any form " +
  "control.";

export const METER_EXAMPLES: readonly MeterExample[] = [
  {
    name: "Bands · optimum, suboptimum, even less good",
    html: row(
      `          <meter value="90" min="0" max="100" low="40" high="70" optimum="90"></meter>
          <meter value="55" min="0" max="100" low="40" high="70" optimum="90"></meter>
          <meter value="10" min="0" max="100" low="40" high="70" optimum="90"></meter>`,
    ),
  },
  {
    name: "Default range · value only",
    html: row(`          <meter value="0.75"></meter>`),
  },
  {
    name: "Disabled",
    html: row(`          <meter value="0.6" disabled></meter>`),
  },
];
