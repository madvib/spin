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
        title="Typography & Voices"
        lede="Load web fonts and spend complete type styles — display, body, caption — with one class each."
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
          <code>type-code</code> for the mono style anywhere in your markup.
        </p>
      </Section>

      <Section id="styles" title="Thirteen styles, spent whole">
        <p class="max-w-prose">
          A theme declares thirteen named styles in{" "}
          <code>font.style.&lt;name&gt;</code>, each a composite{" "}
          <code>$type: "typography"</code> tuple of family, size, weight,
          tracking, and leading — written once, spent with{" "}
          <code>type-&lt;name&gt;</code> anywhere in your markup. The scales
          from the previous sections are the building blocks those tuples
          alias; the styles are what your markup wears:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.compositeStyle}
            lang="json"
            title="One style in spin/<brand>/tokens.json"
          />
        </div>
        <p class="max-w-prose">
          Thirteen styles ship with every language — <code>display</code>,{" "}
          <code>title</code>, <code>heading</code>, <code>subtitle</code>,{" "}
          <code>lead</code>, <code>body</code>, <code>body-emphasized</code>,{" "}
          <code>quote</code>, <code>code</code>, <code>label</code>,{" "}
          <code>caption</code>, <code>caption-emphasized</code>, and{" "}
          <code>overline</code>. Four carry the page —{" "}
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
          its own style — uppercase tracked buttons, tight display headings
          — re-point its <code>.type</code> alias instead of forking the
          global scale:
        </p>
        <div class="my-3">
          <Code
            code={THEMES_SNIPPETS.typeAlias}
            lang="json"
            title="Type aliases in spin/<brand>/elements.json and primitives/card.json"
          />
        </div>
        <p class="max-w-prose">
          Each element and component carries a <code>.type</code> token
          aliasing its default style (<code>element.h1.type</code> reads{" "}
          <code>display</code>, <code>card.title.type</code> reads{" "}
          <code>title</code>). While elements carry a style,{" "}
          <code>&lt;a&gt;</code> and <code>&lt;strong&gt;</code> are inline
          modifiers over inherited text — a link adds only its paint
          (<code>color.link</code>, an
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
