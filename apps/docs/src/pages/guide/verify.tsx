/**
 * Verify: the four oracles and the gate they run in.
 */
import type { JSX } from "solid-js";
import { Code, Section } from "../../bits.tsx";

const GATE = `// deno.json — the gate
{
  "tasks": { "gate": "spin-gate --app . --themes spin" }
}`;

const ORACLES = [
  [
    "visual",
    "contrast (WCAG), appearance (theme agreement, geometry)",
  ],
  ["layout", "overflow, intersection, alignment, stacking"],
] as const;

export default function Verify(): JSX.Element {
  return (
    <Section id="verify" title="Verify">
      <p>
        Two oracles — visual and layout — rendering your app in a real browser.
        Both are installed and tested like every other package in this
        repository.
      </p>
      <div class="mt-4">
        {ORACLES.map(([name, what]) => (
          <div class="flex flex-col gap-1 border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4 mt-2 md:flex-row md:items-baseline md:gap-4">
            <code class="shrink-0 font-mono text-sm">{name}</code>
            <span class="text-sm">{what}</span>
          </div>
        ))}
      </div>
      <p>The gate:</p>
      <Code code={GATE} />
    </Section>
  );
}
