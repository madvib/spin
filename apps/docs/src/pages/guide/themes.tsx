/**
 * Theme modes: data-theme scopes a document, data-mode picks its rendering —
 * with the live probe as the proof.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { mode } from "@spin/kit";
import { Code, Probe, Section } from "../../bits.tsx";

const WIRE_THEMES = `import { spin } from "@spin/preset/plugin";

export default {
  plugins: [spin.vite({
    // No themes option: the shipped starters are served, and a file in
    // spin/ forks one. A host that owns its documents passes a map.
  })],
};`;

export default function Themes(): JSX.Element {
  return (
    <Section id="themes" title="Theme modes">
      <p>
        Documents validate against the legibility floor — a fill without a
        readable foreground is an error, not a preference.
      </p>
      <Code code={WIRE_THEMES} />
      <p>
        Every starter, side by side — and what each one decides differently:
        {" "}
        <A href="/tokens" class="text-link hover:underline">/tokens</A>
      </p>
      <div class="mt-4 border border-border rounded-md bg-surface-raised p-4">
        <Probe>
          {
            /* Each chip is the element the theme types for that role: the
            * badge wears the primary and the accent fills, the link wears
            * the link ink, and the heading wears the display face. The same
            * markup, the other mode. */
          }
          <div class="flex flex-wrap items-center gap-2">
            <badge variant="primary">primary</badge>
            <badge variant="accent">accent</badge>
            <span class="bg-surface text-text rounded-sm px-3 py-2 text-sm border border-border">
              surface
            </span>
            <a href="/tokens" class="px-3 py-2 text-sm">link</a>
            <span class="font-heading text-lg">Aa</span>
            <span class="text-xs text-text-muted">
              this block re-declares the theme as{" "}
              {mode() === "dark" ? "light" : "dark"} — same CSS, other rendering
            </span>
          </div>
        </Probe>
      </div>
    </Section>
  );
}
