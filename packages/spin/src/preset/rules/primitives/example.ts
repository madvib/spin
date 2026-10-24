/**
 * One row of a component's showcase.
 *
 * `name` is the label; `html` is the markup an author would write, which is
 * the only honest example there is. A row is data so it can be rendered in a
 * reference, streamed over RPC, and asserted against in a test without each
 * consumer inventing its own shape.
 */
export interface FixtureExample {
  /** What this row demonstrates, rendered as its label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}
