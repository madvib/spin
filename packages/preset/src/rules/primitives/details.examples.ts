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
  "A working disclosure with no class: the tag carries the base and `open` is the state. The platform owns the behavior, so this is only the surface.";

export const DETAILS_EXAMPLES: readonly DetailsExample[] = [
  {
    name: "Closed",
    html: row(
      `          <details>
            <summary>What changed in v4.12.0?</summary>
            <p>The tax calculator moved to its own service. Deploy #4821 rolled it out to eu-west-1 first.</p>
          </details>`,
    ),
  },
  {
    name: "Open",
    html: row(
      `          <details open>
            <summary>Why did deploy #4820 fail?</summary>
            <p>The canary returned 503 on 4% of requests in us-east-2. The rollout stopped after 90 seconds.</p>
          </details>`,
    ),
  },
  {
    name: "With a list",
    html: row(
      `          <details>
            <summary>Rollout steps</summary>
            <ul>
              <li>Shift 10% of traffic to eu-west-1</li>
              <li>Hold for 5 minutes</li>
            </ul>
          </details>`,
    ),
  },
  {
    name: "Nested",
    html: row(
      `          <details>
            <summary>Deploy #4821</summary>
            <p>Deployed at 09:14 UTC by Tomas Berg.</p>
            <details>
              <summary>Health checks</summary>
              <p>12 of 12 passed in 48 seconds.</p>
            </details>
          </details>`,
    ),
  },
  {
    name: "In a group",
    html: `        <span class="flex flex-wrap items-center gap-2" role="group">
          <details>
            <summary>Succeeded</summary>
            <p>Finished in 4m 12s.</p>
          </details>
          <details>
            <summary>Failed</summary>
            <p>4 health checks failed in us-east-2.</p>
          </details>
          <details>
            <summary>Running</summary>
            <p>At 40% of traffic in eu-west-1.</p>
          </details>
        </span>`,
  },
];
