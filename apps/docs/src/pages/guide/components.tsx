/**
 * Components & templates: the `.html` component compiler and the
 * `@spinjs/components` library.
 *
 * The narrative lives in `../../content/components.md`. This file keeps the
 * live controller demo — the docs' own vendored `<docs-select>`, driven
 * through `createSpinComponent` with its state read back in real time.
 */
import { createEffect, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { select } from "@spinjs/components";
import { Code, Section } from "../../bits.tsx";
import { Markdown } from "../../markdown.tsx";
import componentsMd from "../../content/components.md?raw";

const ITEMS = [
  { value: "bun", label: "bun" },
  { value: "npm", label: "npm" },
  { value: "pnpm", label: "pnpm" },
  { value: "yarn", label: "yarn" },
  { value: "deno", label: "deno" },
] as const;

/** The vendored select, driven live: state up, commands down, events out. */
function ControllerDemo(): JSX.Element {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, select);
  const [value, setValue] = createSignal<readonly string[]>(["bun"]);
  const [events, setEvents] = createSignal<readonly string[]>([]);
  createEffect(() =>
    ctl.bind({ items: [...ITEMS] }, {
      "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
        setValue(event.detail.value);
        setEvents((prev) => [
          `value-change → ${event.detail.value.join(", ")}`,
          ...prev,
        ].slice(0, 4));
      },
    })
  );
  return (
    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <docs-select ref={setElement} id="guide-components-demo" />
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="bare rounded-md border border-border px-3 py-1"
            onClick={() => ctl.commands.setOpen(true)}
          >
            ctl.commands.setOpen(true)
          </button>
          <button
            type="button"
            class="bare rounded-md border border-border px-3 py-1"
            onClick={() => ctl.commands.close()}
          >
            ctl.commands.close()
          </button>
          <button
            type="button"
            class="bare rounded-md border border-border px-3 py-1"
            onClick={() => ctl.commands.clearValue()}
          >
            ctl.commands.clearValue()
          </button>
        </div>
      </div>
      <div>
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
            <li><code>{entry}</code></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function GuideComponents(): JSX.Element {
  return (
    <>
      <Markdown text={componentsMd} />
      <Section id="demo" title="Live controller demo">
        <p>
          The select below is <code>lib/components/select.html</code> in this
          very docs app — copied, owned, compiled to{" "}
          <code>&lt;docs-select&gt;</code>, and driven through{" "}
          <code>createSpinComponent</code>. Pick a value, invoke a command, and
          watch the state and the <code>value-change</code> events.
        </p>
        <ControllerDemo />
      </Section>
      <Section id="contracts" title="Reading a contract">
        <p>
          Every component page under <code>/components/machine-*</code> reads
          the same contract this demo drives: parts, slots, props, events,
          commands, and state readers, straight from the{" "}
          <code>DefinedComponent</code>. Copy the recipe it shows with:
        </p>
        <Code code="npx spin component copy select basic" lang="bash" />
      </Section>
    </>
  );
}
