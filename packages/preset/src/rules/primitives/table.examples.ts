/**
 * Table examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<table>` carries the base: figures align on the digit, the header
 * stays put when the table scrolls, and cells are separated by a rule rather
 * than boxed. `striped` is the one class, because no element expresses
 * "every other row". Every class used here resolves against the preset's own
 * catalog; the self-resolution test fails the suite if an example demonstrates
 * what the package cannot do.
 */

export interface TableExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const tableFixtureNote =
  "A document, not a spreadsheet: figures align on the digit, cells are separated by a rule. `striped` is the only class.";

export const TABLE_EXAMPLES: readonly TableExample[] = [
  {
    name: "Figures align",
    html: `<table>
          <caption>Deploys by service, last 7 days</caption>
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Deploys</th>
              <th scope="col">p95 (ms)</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>checkout-api</td><td>128</td><td>214</td><td>+12%</td></tr>
            <tr><td>payments-worker</td><td>96</td><td>198</td><td>+4%</td></tr>
            <tr><td>search-indexer</td><td>61</td><td>176</td><td>-3%</td></tr>
            <tr><td>webhooks-relay</td><td>24</td><td>203</td><td>+21%</td></tr>
          </tbody>
        </table>`,
  },
  {
    name: "A sticky header in a scroller",
    html: `<div class="h-16 overflow-auto">
          <table>
            <thead>
              <tr><th scope="col">Stage</th><th scope="col">ms</th></tr>
            </thead>
            <tbody>
              <tr><td>build</td><td>18</td></tr>
              <tr><td>test</td><td>42</td></tr>
              <tr><td>push</td><td>7</td></tr>
              <tr><td>canary</td><td>12</td></tr>
              <tr><td>promote</td><td>3</td></tr>
              <tr><td>verify</td><td>9</td></tr>
              <tr><td>notify</td><td>1</td></tr>
            </tbody>
          </table>
        </div>`,
  },
  {
    name: "Striped rows",
    html: `<table class="striped">
          <thead>
            <tr><th scope="col">Service</th><th scope="col">Deploys</th></tr>
          </thead>
          <tbody>
            <tr><td>checkout-api</td><td>128</td></tr>
            <tr><td>payments-worker</td><td>96</td></tr>
            <tr><td>search-indexer</td><td>61</td></tr>
            <tr><td>webhooks-relay</td><td>24</td></tr>
          </tbody>
        </table>`,
  },
];
