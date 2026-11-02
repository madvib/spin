/**
 * Browser Checks: the eight Playwright probes and the config that drives them.
 *
 * The probe reference lives in `../../content/check.md`. This file keeps the
 * state matrix the Markdown cannot render live — the same six states the
 * harness drives every control through.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { Section } from "../../bits.tsx";
import { Markdown } from "../../markdown.tsx";
import checkMd from "../../content/check.md?raw";

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
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1>Browser Checks</h1>
      <Markdown text={checkMd} />

      <Section id="states" title="The states state-contrast drives">
        <p>
          Resting contrast is one measurement. A control lives in six states,
          and the probe visits all of them:
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={STATES}>
            {(state) => (
              <span class="font-mono text-xs border border-border bg-surface-raised rounded-sm px-2 py-1 text-text-muted">
                {state}
              </span>
            )}
          </For>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <For each={STATES}>
            {(state) => (
              <button
                type="button"
                class={`bare px-3 py-2 text-sm ${
                  state === "disabled" ? "opacity-40" : ""
                }`}
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
