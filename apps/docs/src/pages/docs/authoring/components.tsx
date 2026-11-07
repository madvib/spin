/**
 * Components & Controllers: the `.html` component compiler and framework adapters.
 */
import { createEffect, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { select } from "@spinjs/components";
import { Markdown } from "../../../markdown/markdown.tsx";
import { Code, PageHeader, Section } from "../../../ui/index.ts";
import { AUTHORING_SNIPPETS } from "./authoring.snippets.ts";
import componentsMd from "../../../content/components.md?raw";

const ITEMS = [
  { value: "bun", label: "bun" },
  { value: "npm", label: "npm" },
  { value: "pnpm", label: "pnpm" },
  { value: "yarn", label: "yarn" },
  { value: "deno", label: "deno" },
] as const;

function ControllerDemo(): JSX.Element {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, select);
  const [value, setValue] = createSignal<readonly string[]>(["bun"]);
  const [events, setEvents] = createSignal<readonly string[]>([]);
  createEffect(() =>
    ctl.bind(
      { items: [...ITEMS] },
      {
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          setValue(event.detail.value);
          setEvents((prev) =>
            [
              `value-change → ${event.detail.value.join(", ")}`,
              ...prev,
            ].slice(0, 4),
          );
        },
      },
    ),
  );
  return (
    <div class="grid gap-4 rounded-lg border bg-surface-raised p-4 md:grid-cols-2">
      <div>
        <docs-select ref={setElement} id="guide-components-demo" />
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="bare rounded-md border bg-surface px-3 py-1 type-code"
            onClick={() => ctl.commands.setOpen(true)}
          >
            ctl.commands.setOpen(true)
          </button>
          <button
            type="button"
            class="bare rounded-md border bg-surface px-3 py-1 type-code"
            onClick={() => ctl.commands.close()}
          >
            ctl.commands.close()
          </button>
          <button
            type="button"
            class="bare rounded-md border bg-surface px-3 py-1 type-code"
            onClick={() => ctl.commands.clearValue()}
          >
            ctl.commands.clearValue()
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-2 type-body">
        <p>
          <code>ctl.state.value</code>: <code>{JSON.stringify(value())}</code>
        </p>
        <p>
          Open: <code>{String(ctl.state.open)}</code> · Focused:{" "}
          <code>{String(ctl.state.focused)}</code> · Disabled:{" "}
          <code>{String(ctl.state.disabled)}</code>
        </p>
        <ul class="flow-list">
          {events().map((entry) => (
            <li>
              <code>{entry}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AuthoringComponents(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Components & Controllers"
        lede="Author interactive components once in HTML + TypeScript, compile them into standard custom elements, and drive them from React, Solid, Vue, or Svelte."
        playgroundExample="components-select"
      />
      <Markdown text={componentsMd} />

      <Section id="demo" title="Live controller demo">
        <p class="max-w-prose">
          The select below is <code>src/lib/components/select.html</code> in this
          docs app — compiled to <code>&lt;docs-select&gt;</code> and driven
          through <code>createSpinComponent</code>.
        </p>
        <div class="mt-3">
          <ControllerDemo />
        </div>
      </Section>

      <Section id="contracts" title="Reading a contract">
        <p class="max-w-prose">
          Every component page under <code>/components/machine-*</code> reads
          the same contract this demo drives: parts, slots, props, events,
          commands, and state readers. Copy any recipe into your project with:
        </p>
        <div class="mt-3">
          <Code
            code={AUTHORING_SNIPPETS.copySelect}
            lang="bash"
            title="Terminal"
          />
        </div>
      </Section>
    </main>
  );
}
