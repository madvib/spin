import { primitiveComponents } from "@spin/preset/rules/primitives/manifest.ts";

export default function CardPage() {
  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Card</h1>
      <p>Groups related content on a raised surface.</p>
      <div class="card">
        <h2 class="text-lg">Card title</h2>
        <p>Cards group related content on a raised surface.</p>
        <p>
          Use them to separate content sections, display metadata, or present a
          single focused piece of information.
        </p>
      </div>
      <h2 class="text-xl">Tokens used</h2>
      <ul>
        {primitiveComponents.card.reads.map((token) => (
          <li>
            <code class="text-sm">{token}</code>
          </li>
        ))}
      </ul>
      <h2 class="text-xl">Example</h2>
      <pre>
        <code class="text-sm">
          {`<div class="card">\n  <h2>Card title</h2>\n  <p>Cards group related content on a raised surface.</p>\n</div>`}
        </code>
      </pre>
    </div>
  );
}
