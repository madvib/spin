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

import type { ClassDoc } from "./example.ts";

export interface DetailsExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const detailsFixtureNote =
  "A working disclosure with no class: the tag carries the base and open is the state. A stack of details with a shared name is an exclusive accordion; the platform closes the others.";

export const DETAILS_CLASSES: readonly ClassDoc[] = [
  {
    name: "<details>",
    kind: "Component",
    description: "Disclosure container; block-width surface with its own border and radius",
  },
  {
    name: "<summary>",
    kind: "Part",
    description: "Full-bleed label row with pointer cursor and chevron indicator",
  },
  {
    name: "open",
    kind: "Behavior",
    description: "Reveals the body in place with the platform's animated details-content transition",
  },
  {
    name: 'name="…"',
    kind: "Behavior",
    description: "Groups disclosures into an exclusive accordion: opening one closes the others, no JavaScript",
  },
];

export const DETAILS_EXAMPLES: readonly DetailsExample[] = [
  {
    name: "With icon and badge",
    html: `          <details open>
            <summary><i class="i-lucide-rocket" aria-hidden="true"></i>Deploy #4821<badge variant="success">live</badge></summary>
            <p>Rolled out at 09:14 UTC by Tomas Berg. 12 of 12 health checks passed in 48 seconds.</p>
          </details>`,
  },
  {
    name: "Warning body",
    html: `          <details>
            <summary><i class="i-lucide-triangle-alert" aria-hidden="true"></i>Why did deploy #4820 fail?<badge variant="danger">4 failed</badge></summary>
            <alert role="alert" variant="danger">The canary returned 503 on 4% of requests in us-east-2. The rollout stopped after 90 seconds.</alert>
          </details>`,
  },
  {
    name: "Release train",
    html: `        <div class="flex flex-col items-stretch gap-2">
          <details name="rollout">
            <summary><i class="i-lucide-check" aria-hidden="true"></i>Succeeded · v4.12.0<badge variant="success">4m 12s</badge></summary>
            <p>Tax calculator moved to its own service. 12 of 12 checks passed.</p>
          </details>
          <details name="rollout">
            <summary><i class="i-lucide-x" aria-hidden="true"></i>Failed · v4.11.9<badge variant="danger">rolled back</badge></summary>
            <p>4 health checks failed in us-east-2. Traffic returned in 90 seconds.</p>
          </details>
          <details name="rollout">
            <summary><i class="i-lucide-loader" aria-hidden="true"></i>Running · v4.12.1<badge variant="warning">40%</badge></summary>
            <ul>
              <li>Shift 10% of traffic to eu-west-1</li>
              <li>Hold for 5 minutes</li>
              <li>Promote to 100% or roll back</li>
            </ul>
          </details>
        </div>`,
  },
  {
    name: "Code body",
    html: `          <details>
            <summary><i class="i-lucide-terminal" aria-hidden="true"></i>Roll back from the CLI</summary>
            <pre><code>spin release rollback --to v4.11.2 --region eu-west-1</code></pre>
          </details>`,
  },
  {
    name: "Deploy log",
    html: `          <details open>
            <summary><i class="i-lucide-list" aria-hidden="true"></i>Deploy #4821 · full log<badge>2 checks</badge></summary>
            <details>
              <summary><i class="i-lucide-check" aria-hidden="true"></i>Health checks · 12 of 12 passed</summary>
              <p>Slowest check: db-migrate at 11s. All others under 4s.</p>
            </details>
            <details>
              <summary><i class="i-lucide-activity" aria-hidden="true"></i>Canary · 0 errors in 5 minutes</summary>
              <p>503 rate stayed at 0 across us-east-2 and eu-west-1.</p>
            </details>
          </details>`,
  },
];
