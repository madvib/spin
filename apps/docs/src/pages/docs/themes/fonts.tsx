/**
 * Themes Fonts: automatic @font-face generation, font family roles, and the type scale.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, Section } from "../../../bits.tsx";
import { PageHeader } from "../../../ui/index.ts";
import { THEMES_SNIPPETS } from "./themes.snippets.ts";

export default function ThemesFonts(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Fonts"
        lede="Name a font family in your theme and Spin loads it: declare sources in $extensions.spin.fonts, spend the families through font.family roles, and tune the monotonic type scale — no @font-face boilerplate, no bundler font plugin."
      />

      <Section id="loading" title="Automatic @font-face generation">
        <p class="max-w-prose">
          A theme declares what it <em>loads</em> separately from the tokens
          it spends. In the Studio's <strong>Type → Faces</strong> view, pick
          any family from the built-in Fontsource catalog and Spin writes its
          declaration into <code>$extensions.spin.fonts</code>. Prefer
          self-hosted files? Point <code>src</code> at{" "}
          <code>/fonts/*.woff2</code> instead. At build time, Spin emits one{" "}
          <code>@font-face</code> rule per family into <code>@layer theme</code>{" "}
          automatically:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.webFonts}
            lang="json"
            title="Web fonts via $extensions.spin.fonts"
          />
        </div>
        <p class="max-w-prose">
          Each entry names a <code>family</code> and a <code>src</code>, with
          optional <code>weight</code> (a single step or a variable range
          like <code>"300 900"</code>), <code>style</code>, and{" "}
          <code>display</code>. One declaration per distinct family keeps the
          output deduplicated even when heading and body share a face.
        </p>
      </Section>

      <Section id="roles" title="Font family roles">
        <p class="max-w-prose">
          The <code>font.family</code> group spends the loaded faces through
          named roles. Three roles ship with every theme —{" "}
          <code>sans</code>, <code>heading</code>, and <code>mono</code> — and{" "}
          <code>body</code>, <code>serif</code>, and <code>brand</code> are
          available when a design needs them. Classless elements spend the
          roles for you: <code>&lt;body&gt;</code> renders in{" "}
          <code>sans</code>, <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code>{" "}
          render in <code>heading</code>, and <code>&lt;code&gt;</code> and{" "}
          <code>&lt;pre&gt;</code> render in <code>mono</code>. The matching
          utilities — <code>font-sans</code>, <code>font-heading</code>,{" "}
          <code>font-mono</code> — spend the same roles anywhere in your
          markup.
        </p>
      </Section>

      <Section id="scale" title="Type scale, weights, and tracking">
        <p class="max-w-prose">
          The <code>font.size</code> group is a monotonic ramp from{" "}
          <code>2xs</code> through <code>display</code>: every step must read
          larger than the last, and the validation checks enforce it.{" "}
          <code>font.weight.*</code> names the numeric steps,{" "}
          <code>font.line-height.*</code> sets unitless ratios, and{" "}
          <code>font.letter-spacing.*</code> sets tracking. When one element
          needs its own voice — uppercase tracked buttons, tight display
          headings — declare a per-element override such as{" "}
          <code>font.element.h1.family</code> or <code>button.weight</code>{" "}
          instead of forking the global scale. See{" "}
          <A href="/docs/themes/customization#elements">Customization</A> for
          the full per-element story.
        </p>
      </Section>
    </main>
  );
}
