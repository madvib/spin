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
          <caption>Q3 by region</caption>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Units</th>
              <th scope="col">Revenue</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>North</td><td>1,204</td><td>18,400</td><td>+12%</td></tr>
            <tr><td>South</td><td>987</td><td>14,910</td><td>+4%</td></tr>
            <tr><td>East</td><td>2,310</td><td>35,120</td><td>-3%</td></tr>
            <tr><td>West</td><td>744</td><td>10,880</td><td>+21%</td></tr>
          </tbody>
        </table>`,
  },
  {
    name: "A sticky header in a scroller",
    html: `<div class="h-16 overflow-auto">
          <table>
            <thead>
              <tr><th scope="col">Unit</th><th scope="col">ms</th></tr>
            </thead>
            <tbody>
              <tr><td>parse</td><td>2.1</td></tr>
              <tr><td>resolve</td><td>0.8</td></tr>
              <tr><td>generate</td><td>4.6</td></tr>
              <tr><td>emit</td><td>1.2</td></tr>
              <tr><td>link</td><td>9.3</td></tr>
              <tr><td>minify</td><td>3.7</td></tr>
              <tr><td>ship</td><td>0.4</td></tr>
            </tbody>
          </table>
        </div>`,
  },
  {
    name: "Striped rows",
    html: `<table class="striped">
          <thead>
            <tr><th scope="col">Region</th><th scope="col">Units</th></tr>
          </thead>
          <tbody>
            <tr><td>North</td><td>1,204</td></tr>
            <tr><td>South</td><td>987</td></tr>
            <tr><td>East</td><td>2,310</td></tr>
            <tr><td>West</td><td>744</td></tr>
          </tbody>
        </table>`,
  },
];
