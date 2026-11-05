/**
 * Themes Fonts: automatic @font-face generation, font family roles, and the type scale.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, PageHeader, Section } from "../../../ui/index.ts";
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
          available when a design needs them. Elements spend the roles for
          you: <code>&lt;body&gt;</code> renders in <code>sans</code>,{" "}
          <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code> render in{" "}
          <code>heading</code>, and <code>&lt;code&gt;</code> and{" "}
          <code>&lt;pre&gt;</code> render in <code>mono</code>. Families
          arrive inside named type styles — write{" "}
          <code>type-code</code> for the mono voice anywhere in your markup.
        </p>
      </Section>

      <Section id="voices" title="Sixteen voices, spent whole">
        <p class="max-w-prose">
          A theme declares sixteen named voices in{" "}
          <code>font.style.&lt;name&gt;</code>, each a composite{" "}
          <code>$type: "typography"</code> tuple of family, size, weight,
          tracking, and leading — written once, spent with{" "}
          <code>type-&lt;name&gt;</code> anywhere in your markup. The scales
          from the previous sections are the building blocks those tuples
          alias; the voices are what your markup wears:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.compositeVoice}
            lang="json"
            title="One voice in spin/<name>.json"
          />
        </div>
        <p class="max-w-prose">
          Sixteen voices ship with every starter — <code>display</code>,{" "}
          <code>title</code>, <code>heading</code>, <code>subtitle</code>,{" "}
          <code>lead</code>, <code>body</code>, <code>quote</code>,{" "}
          <code>code</code>, <code>label</code>, <code>caption</code>,{" "}
          <code>overline</code>, <code>stat</code>, <code>badge</code>,{" "}
          <code>body-strong</code>, <code>caption-strong</code>, and{" "}
          <code>card-title</code>. Four carry the page —{" "}
          <code>type-display</code>, <code>type-heading</code>,{" "}
          <code>type-body</code>, <code>type-code</code> — and the full set
          with live specimens lives in the{" "}
          <A href="/docs/styling/prose">Typography guide</A> and the{" "}
          <A href="/docs/themes/reference#styles">Token Reference</A>.
        </p>
      </Section>

      <Section id="scale" title="Type scale, weights, tracking, and leading">
        <p class="max-w-prose">
          The <code>font.size</code> group is a monotonic ramp from{" "}
          <code>2xs</code> through <code>display</code>: every step must read
          larger than the last, and the validation checks enforce it.{" "}
          <code>font.weight.*</code> names the numeric steps,{" "}
          <code>font.leading.*</code> sets unitless ratios, and{" "}
          <code>font.tracking.*</code> sets tracking. When one element needs
          its own voice — uppercase tracked buttons, tight display headings
          — re-point it in <code>font.map</code> instead of forking the
          global scale:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.fontMap}
            lang="json"
            title="Re-pointing voices in spin/<name>.json"
          />
        </div>
        <p class="max-w-prose">
          <code>font.map</code> assigns a default voice to each element and
          component (<code>h1</code> reads <code>display</code>,{" "}
          <code>card.title</code> reads <code>card-title</code>); state{" "}
          <code>null</code> to opt a target out of Spin voicing entirely.
          While elements carry a voice, <code>&lt;a&gt;</code> and{" "}
          <code>&lt;strong&gt;</code> are inline modifiers over inherited
          text — a link adds only its paint (<code>color.link</code>, an
          underline of <code>link.underline</code> thickness at{" "}
          <code>link.offset</code> distance), and{" "}
          <code>&lt;strong&gt;</code> adds only{" "}
          <code>font.weight.bold</code> — so emphasis inside a caption or a
          heading never resets the size, family, or leading around it. See{" "}
          <A href="/docs/themes/customization#elements">Customization</A> for
          the full per-element story.
        </p>
      </Section>
    </main>
  );
}
