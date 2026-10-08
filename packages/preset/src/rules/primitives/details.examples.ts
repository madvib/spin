/**
 * Details examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<details>` carries the base; the `open` attribute is the state.
 * There is no class to opt in and never was one — the tag is the opt-in.
 * Every class used here resolves against the preset's own catalog; the
 * self-resolution test fails the suite if an example demonstrates what the
 * package cannot do.
 */

export interface DetailsExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const detailsFixtureNote =
  "A details is a working disclosure with no class at all: the tag carries " +
  "the base, and the open attribute is the state. The platform owns the " +
  "behaviour — it works with scripting disabled, is keyboard operable, and " +
  "is announced through its native role — so everything here is the surface " +
  "and none of it is the mechanism.";

export const DETAILS_EXAMPLES: readonly DetailsExample[] = [
  {
    name: "Closed",
    html: row(
      `          <details>
            <summary>What is this component?</summary>
            <p>A disclosure. The body is inset from the label.</p>
          </details>`,
    ),
  },
  {
    name: "Open",
    html: row(
      `          <details open>
            <summary>Does it need JavaScript?</summary>
            <p>No. The platform owns the behaviour.</p>
          </details>`,
    ),
  },
  {
    name: "With a list",
    html: row(
      `          <details>
            <summary>Keyboard</summary>
            <ul>
              <li>Tab to reach</li>
              <li>Enter or Space to toggle</li>
            </ul>
          </details>`,
    ),
  },
  {
    name: "Nested",
    html: row(
      `          <details>
            <summary>Outer</summary>
            <p>Outer content.</p>
            <details>
              <summary>Inner</summary>
              <p>Inner content.</p>
            </details>
          </details>`,
    ),
  },
  {
    name: "In a group",
    html:
      `        <span class="flex flex-wrap items-center gap-2" role="group">
          <details>
            <summary>First</summary>
            <p>First body.</p>
          </details>
          <details>
            <summary>Second</summary>
            <p>Second body.</p>
          </details>
          <details>
            <summary>Third</summary>
            <p>Third body.</p>
          </details>
        </span>`,
  },
];
