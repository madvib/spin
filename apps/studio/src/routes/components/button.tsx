import { primitiveComponents } from "@spin/preset/rules/primitives/manifest.ts";

const TOKENS = primitiveComponents.button.reads;

export default function ButtonPage() {
  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Button</h1>
      <p>Actions in three variants with semantic styling.</p>
      <h2 class="text-xl">Variants</h2>
      <div class="flex items-center gap-4">
        <button type="button">Save</button>
        <button type="button" class="secondary">Cancel</button>
        <button type="button" class="ghost">Delete</button>
        <button type="button" disabled>Disabled</button>
      </div>
      <h2 class="text-xl">States</h2>
      <div class="flex items-center gap-4">
        <button type="button">Default</button>
        <button type="button" class="secondary">Secondary</button>
        <button type="button" class="ghost">Ghost</button>
        <button type="button" disabled>Disabled</button>
      </div>
      <h2 class="text-xl">Tokens used</h2>
      <ul>
        {TOKENS.map((token) => (
          <li>
            <code class="text-sm">{token}</code>
          </li>
        ))}
      </ul>
      <h2 class="text-xl">Example</h2>
      <pre>
        <code class="text-sm">
          {`<button type="button">Save</button>\n<button type="button" class="secondary">Cancel</button>\n<button type="button" class="ghost">Delete</button>\n<button type="button" disabled>Disabled</button>`}
        </code>
      </pre>
    </div>
  );
}
