/**
 * Verify: the diagnostics, and what they check.
 */
import type { JSX } from "solid-js";
import { Code, Section } from "../../bits.tsx";

const GATE = `// deno.json — the gate
{
  "tasks": { "check": "spin check --config path/to/check.ts http://localhost:5173" }
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
        Two kinds of check, both from the same package: the lints, which read
        your source, and the rendered checks, which open your app in a real
        browser and measure what a person would see. Both ship as{" "}
        <code class="font-mono">npx spin</code>.
      </p>
      <div class="mt-4">
        {ORACLES.map(([name, what]) => (
          <div class="flex flex-col gap-1 border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4 mt-2 md:flex-row md:items-baseline md:gap-4">
            <code class="shrink-0 font-mono text-sm">{name}</code>
            <span class="text-sm">{what}</span>
          </div>
        ))}
      </div>
      <p>Running them:</p>
      <Code code={GATE} />
    </Section>
  );
}
