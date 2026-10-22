/**
 * Verify: the diagnostics, and what they check.
 */
import type { JSX } from "solid-js";
import { Code, Section } from "../../bits.tsx";

const COMMANDS = `// package.json or deno.json
{
  "scripts": {
    "lint": "spin lint src/",
    "lint:fix": "spin lint --fix src/",
    "check": "spin check --config path/to/check.ts http://localhost:5173"
  }
}`;

const CHECKS = [
  [
    "spin lint",
    "closed vocabulary, redundant classes, ink pairing, theme values — via oxlint, ESLint, or the CLI",
  ],
  [
    "spin check",
    "contrast (WCAG), state-contrast (hover, focus, active, disabled), geometry and overflow in a real browser",
  ],
] as const;

export default function Verify(): JSX.Element {
  return (
    <Section id="verify" title="Verify">
      <p>
        Two kinds of tooling, both from{" "}
        <code>@spin/diagnostics</code>: the source lints, which inspect your
        markup and class lists against your project's theme, and the rendered
        checks, which open your running app in a browser and measure what a
        person sees.
      </p>
      <div class="mt-4">
        {CHECKS.map(([name, what]) => (
          <div class="flex flex-col gap-1 border-solid border-l-4 border-primary bg-surface-raised rounded-md p-4 mt-2 md:flex-row md:items-baseline md:gap-4">
            <code class="shrink-0">{name}</code>
            <span class="text-sm">{what}</span>
          </div>
        ))}
      </div>
      <p>Running them:</p>
      <Code code={COMMANDS} />
    </Section>
  );
}
