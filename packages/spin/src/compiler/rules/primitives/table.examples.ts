/**
 * Table examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<table>` carries the base: figures align on the digit, the header
 * stays put when the table scrolls, and cells are separated by a rule rather
 * than boxed. `striped` and `wrap` are the two classes: no element expresses
 * "every other row", and no element says "this table carries sentences".
 * Every class used here resolves against the preset's own
 * catalog; the self-resolution test fails the suite if an example demonstrates
 * what the package cannot do.
 */
import type { ClassDoc } from "./example.ts";


export interface TableExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const tableFixtureNote =
  "A document, not a spreadsheet: figures align on the digit, cells are separated by a rule. `striped` stripes rows, `wrap` wraps prose cells.";
export const TABLE_CLASSES: readonly ClassDoc[] = [
  {
    name: "<table>",
    kind: "Component",
    description: "Full-width document table; tabular figures, collapsed row rules, scrolling container",
  },
  {
    name: "<caption>",
    kind: "Part",
    description: "Table title; muted small type above the header row",
  },
  {
    name: "<th>",
    kind: "Part",
    description: "Header cell; semibold sticky header that stays put while the body scrolls",
  },
  {
    name: ".striped",
    kind: "Modifier",
    description: "Zebra fill on every other body row for long tables",
  },
  {
    name: ".wrap",
    kind: "Modifier",
    description: "Cells re-wrap and top-align, for reference tables that carry sentences",
  },
];

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
            <tr><td>checkout-api</td><td>128</td><td>214</td><td><badge variant="success">+12%</badge></td></tr>
            <tr><td>payments-worker</td><td>96</td><td>198</td><td><badge variant="success">+4%</badge></td></tr>
            <tr><td>search-indexer</td><td>61</td><td>176</td><td><badge variant="danger">-3%</badge></td></tr>
            <tr><td>webhooks-relay</td><td>24</td><td>203</td><td><badge variant="warning">+21%</badge></td></tr>
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
  {
    name: "Wrapping prose cells",
    html: `<table class="wrap">
          <thead>
            <tr><th scope="col">Command</th><th scope="col">What it does</th></tr>
          </thead>
          <tbody>
            <tr><td><code>spin init</code></td><td>Makes a project: detects the bundler, writes the first theme, and wires the plugin into the bundler config.</td></tr>
            <tr><td><code>spin studio</code></td><td>Opens the standalone theme editor: the API at <code>/rpc</code> and the Studio at <code>/studio/</code>.</td></tr>
          </tbody>
        </table>`,
  },
];
