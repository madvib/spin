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

export type ClassDocKind =
  | "Component"
  | "Color"
  | "Style"
  | "Size"
  | "Modifier"
  | "Part"
  | "Behavior";

/** One row in a component's class & tag reference table. */
export interface ClassDoc {
  /** The tag (`<button>`) or class (`.secondary`) an author writes. */
  readonly name: string;
  /** Category badge shown in the Type column. */
  readonly kind: ClassDocKind;
  /** Concise description of what this tag or class does. */
  readonly description: string;
}
