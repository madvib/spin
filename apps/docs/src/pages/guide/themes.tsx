/**
 * Theme modes: data-theme scopes a document, data-mode picks its rendering —
 * with the live probe as the proof.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { mode } from "@spin/kit";
import { Code, Probe, Section } from "../../bits.tsx";

const WIRE_THEMES = `import { spin } from "@spin/preset/plugin";
import { starterThemes } from "@spin/theme/themes";
import myTheme from "./theme.json" with { type: "json" };

export default {
  plugins: [spin.vite({
    themes: { myTheme, ...starterThemes },
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
          <div class="flex flex-wrap items-center gap-2">
            <span class="bg-primary text-on-primary rounded-sm px-3 py-2 text-sm">
              primary
            </span>
            <span class="bg-accent text-on-accent rounded-sm px-3 py-2 text-sm">
              accent
            </span>
            <span class="bg-surface text-text rounded-sm px-3 py-2 text-sm border border-border">
              surface
            </span>
            <span class="text-link rounded-sm px-3 py-2 text-sm">link</span>
            <span class="font-heading text-lg tracking-tight">Aa</span>
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
