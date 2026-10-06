import { createSignal, Show } from "solid-js";
import { primitiveComponents } from "@spin/preset/rules/primitives/manifest.ts";

export default function FieldPage() {
  const [name, setName] = createSignal("");
  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Field</h1>
      <p>Labelled inputs with hint text and live values.</p>
      <div class="card">
        <label>
          Theme name
          <span>Shown to agents picking themes.</span>
          <input
            value={name()}
            placeholder="my-brand"
            onInput={setName}
          />
        </label>
        <Show when={name().trim() !== ""}>
          <p>Hello, {name()}.</p>
        </Show>
      </div>
      <h2 class="text-xl">Tokens used</h2>
      <ul>
        {primitiveComponents.form.reads.map((token) => (
          <li>
            <code class="text-sm">{token}</code>
          </li>
        ))}
      </ul>
      <h2 class="text-xl">Example</h2>
      <pre>
        <code class="text-sm">
          {`<label>\n  Theme name\n  <span>Shown to agents picking themes.</span>\n  <input value={name()} placeholder="my-brand" onInput={setName} />\n</label>`}
        </code>
      </pre>
    </div>
  );
}
