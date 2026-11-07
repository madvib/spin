/**
 * Machines & Signals: `@spinjs/runtime` signals, statecharts, `defineComponent`,
 * `defineController`, and DOM actions.
 */
import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { computed, effect, signal } from "@spinjs/runtime";
import { Markdown } from "../../../markdown/markdown.tsx";
import { PageHeader, Section } from "../../../ui/index.ts";
import machinesMd from "../../../content/machines.md?raw";

function SignalDemo(): JSX.Element {
  const count = signal(0);
  const doubled = computed(() => count() * 2);
  const [log, setLog] = createSignal<readonly string[]>([]);
  const [shown, setShown] = createSignal(0);
  effect(() => {
    setLog((prev) =>
      [`count: ${count()}, doubled: ${doubled()}`, ...prev].slice(0, 4),
    );
    setShown(count());
  });
  return (
    <div class="grid gap-4 rounded-lg border bg-surface-raised p-4 md:grid-cols-2">
      <div>
        <p>
          Count: <code>{shown()}</code> · Doubled:{" "}
          <code>{shown() * 2}</code>
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="bare rounded-md border bg-surface px-3 py-1 type-code"
            onClick={() => count(count() + 1)}
          >
            count(count() + 1)
          </button>
          <button
            type="button"
            class="bare rounded-md border bg-surface px-3 py-1 type-code"
            onClick={() => count(0)}
          >
            count(0)
          </button>
        </div>
      </div>
      <div>
        <p class="uppercase text-muted">
          Effect log (newest first)
        </p>
        <ul class="flow-list">
          {log().map((entry) => (
            <li>
              <code>{entry}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AuthoringMachines(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Machines & Signals"
        lede="Everything interactive in Spin is a headless statechart over fine-grained signals: @spinjs/runtime provides signals, finite-state machines, component synthesis, and DOM directives."
      />
      <Markdown text={machinesMd} />

      <Section id="demo" title="Signals, live">
        <p class="max-w-prose">
          The counter below runs on <code>@spinjs/runtime</code>'s own{" "}
          <code>signal</code>, <code>computed</code>, and <code>effect</code>.
        </p>
        <div class="mt-3">
          <SignalDemo />
        </div>
      </Section>
    </main>
  );
}
