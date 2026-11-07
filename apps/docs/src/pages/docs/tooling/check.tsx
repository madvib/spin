/**
 * Browser Checks: Playwright visual, state-contrast, and geometry probes.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Markdown } from "../../../markdown/markdown.tsx";
import { Chip, PageHeader, Section } from "../../../ui/index.ts";
import checkMd from "../../../content/check.md?raw";

const STATES: readonly string[] = [
  "rest",
  "hover",
  "focus",
  "focus-visible",
  "active",
  "disabled",
];

export default function Check(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Browser Checks"
        lede="Automated Playwright probes that drive your running application through every theme, mode, and interactive control state."
      />
      <Markdown text={checkMd} />

      <Section id="states" title="Interactive states probed by state-contrast">
        <p class="max-w-prose">
          Resting contrast is only one measurement. Every interactive control
          lives in six states, and <code>state-contrast</code> verifies
          legibility across all of them:
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={STATES}>{(state) => <Chip>{state}</Chip>}</For>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-surface-raised p-4">
          <For each={STATES}>
            {(state) => (
              <button
                type="button"
                class={`s-sm ${state === "disabled" ? "opacity-40" : ""}`}
                disabled={state === "disabled"}
              >
                {state}
              </button>
            )}
          </For>
        </div>
      </Section>
    </main>
  );
}
