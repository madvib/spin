/**
 *Typography guide: loading web fonts, font roles, and named text styles.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, PageHeader, Section } from "../../../ui/index.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

const TEXT_UTILITY_EXAMPLE = `<header class="flex flex-col gap-1">
  <span class="type-overline text-primary">Release 2.4</span>
  <h1>Faster regional edge builds</h1>
  <p class="type-lead text-muted">
    Zero-downtime rollouts across all twelve regions.
  </p>
</header>`;

export default function ThemesFonts(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Typography"
        lede="Load web fonts and apply consistent heading, body, label, and monospace text styles."
      />

      <Section id="styles" title="Named text styles">
        <p class="max-w-prose">
          Instead of repeating <code>text-sm font-medium leading-snug tracking-wide</code>{" "}
          on every label or heading, Spin gives you semantic text classes that
          apply font family, size, weight, line height, and letter spacing
          together. Native tags (<code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code>,{" "}
          <code>&lt;p&gt;</code>, <code>&lt;code&gt;</code>,{" "}
          <code>&lt;label&gt;</code>) already receive their default style
          automatically; reach for a <code>type-*</code> class whenever a UI
          element needs a specific hierarchy level:
        </p>
        <div class="my-3">
          <Code
            code={TEXT_UTILITY_EXAMPLE}
            lang="html"
            title="Using named text styles"
          />
        </div>
        <p class="max-w-prose text-muted">
          Common styles include <code>type-display</code>,{" "}
          <code>type-title</code>, <code>type-heading</code>,{" "}
          <code>type-subtitle</code>, <code>type-lead</code>,{" "}
          <code>type-body</code>, <code>type-body-emphasized</code>,{" "}
          <code>type-label</code>, <code>type-caption</code>,{" "}
          <code>type-overline</code>, and <code>type-code</code>. See live
          specimens on <A href="/docs/styling/prose">Prose</A>.
        </p>
      </Section>

      <Section id="loading" title="Loading web fonts">
        <p class="max-w-prose">
          In Studio's <strong>Type</strong> workbench, pick any typeface from
          the built-in Fontsource catalog to preview it live across your app and
          save its <code>@font-face</code> declaration automatically. You can
          also point to self-hosted <code>.woff2</code> files in{" "}
          <code>spin/&lt;brand&gt;/tokens.json</code>:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.webFonts}
            lang="json"
            title="spin/acme/tokens.json"
          />
        </div>
      </Section>

      <Section id="roles" title="Font families and customizing styles">
        <p class="max-w-prose">
          Themes map loaded fonts to clear roles — <code>sans</code> (UI and
          body), <code>heading</code> (display and section titles),{" "}
          <code>mono</code> (code and metrics), plus optional{" "}
          <code>serif</code> and <code>brand</code>. Updating a role in Studio
          or <code>tokens.json</code> updates every element and{" "}
          <code>type-*</code> utility that references it:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.compositeStyle}
            lang="json"
            title="Customizing a text style in spin/acme/tokens.json"
          />
        </div>
      </Section>
    </main>
  );
}
