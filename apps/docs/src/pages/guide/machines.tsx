/**
 * Authoring machines: signals, statecharts, `defineComponent`,
 * `defineController`, and DOM actions.
 *
 * The narrative lives in `../../content/machines.md`. This file keeps the
 * live signal demo — the runtime's own reactivity, read back on the page.
 */
import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { computed, effect, signal } from "@spinjs/runtime";
import { Section } from "../../bits.tsx";
import { Markdown } from "../../markdown.tsx";
import machinesMd from "../../content/machines.md?raw";

/** Signals, live: a counter, its double, and the effect log. */
function SignalDemo(): JSX.Element {
  const count = signal(0);
  const doubled = computed(() => count() * 2);
  const [log, setLog] = createSignal<readonly string[]>([]);
  const [shown, setShown] = createSignal(0);
  effect(() => {
    setLog((prev) => [`count: ${count()}, doubled: ${doubled()}`, ...prev].slice(0, 4));
    setShown(count());
  });
  return (
    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <p>
          Count: <code>{shown()}</code> · Doubled:{" "}
          <code>{shown() * 2}</code>
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="bare rounded-md border border-border px-3 py-1"
            onClick={() => count(count() + 1)}
          >
            count(count() + 1)
          </button>
          <button
            type="button"
            class="bare rounded-md border border-border px-3 py-1"
            onClick={() => count(0)}
          >
            count(0)
          </button>
        </div>
      </div>
      <div>
        <p>Effect log (newest first):</p>
        <ul class="flow-list">
          {log().map((entry) => (
            <li><code>{entry}</code></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function GuideMachines(): JSX.Element {
  return (
    <>
      <Markdown text={machinesMd} />
      <Section id="demo" title="Signals, live">
        <p>
          The counter below is the runtime's own <code>signal</code>,{" "}
          <code>computed</code>, and <code>effect</code> — no framework state
          in the middle. Press the button and watch exactly the subscribers
          re-run.
        </p>
        <SignalDemo />
      </Section>
    </>
  );
}
