/**
 * Typography: the scales the theme builds from, the 16 named styles spent
 * with `type-<name>`, and `.type` style assignment — with `a` and
 * `strong` as inline modifiers over inherited text.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import {
  Code,
  PageHeader,
  Section,
  Specimen,
} from "../../../ui/index.ts";

const SAMPLE = "The quick brown fox jumps over the lazy dog";

const DISPLAY_SNIPPET = `<div class="type-display">The quick brown fox jumps over the lazy dog</div>`;

const HEADING_SNIPPET = `<div class="type-heading">The quick brown fox jumps over the lazy dog</div>`;

const BODY_SNIPPET = `<div class="type-body">The quick brown fox jumps over the lazy dog</div>`;

const CODE_SNIPPET = `<div class="type-body">Traffic shifted away from <span class="type-code">us-east-1</span> within 40 seconds.</div>`;

const FONT_MAP_SNIPPET = `{
  "element": {
    "h1": {
      "type": { "$type": "typography", "$value": "{font.style.title}" }
    }
  }
}`;

const INLINE_SNIPPET = `<div class="type-body">
  Read the <a href="/docs/styling/prose">typography guide</a> before the
  release window, and pin the <strong>canary error budget</strong> first.
</div>`;

export default function StylingProse(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Typography"
        lede="Write semantic HTML and get finished type: every element arrives carrying a named style, and one type-<name> class changes the style — the whole tuple at once, never letter by letter."
      />

      <Section id="scales" title="Scales are the building blocks">
        <p class="max-w-prose">
          Your theme&apos;s <code>font.size</code>,{" "}
          <code>font.family</code>, <code>font.weight</code>,{" "}
          <code>font.tracking</code>, and <code>font.leading</code> scales
          are internal building blocks, not utilities. A theme aliases steps
          from these scales into complete named styles under{" "}
          <code>font.style.*</code>; nothing in your markup names a scale
          step directly. Sizing or weighing by hand names no style the theme
          can remake, so the build fails and names the style to write
          instead. Move a scale step in <code>spin/&lt;brand&gt;/tokens.json</code>{" "}
          (or the <A href="/studio">Studio</A> Fonts section) and every style
          built on it moves together.
        </p>
      </Section>

      <Section id="styles" title="Sixteen styles, spent whole">
        <p class="max-w-prose">
          Each entry under <code>font.style.*</code> is a complete tuple —
          family, size, weight, tracking, and leading in one{" "}
          <code>$type: &quot;typography&quot;</code> token — and one{" "}
          <code>type-&lt;name&gt;</code> class spends the whole tuple at
          once. The theme owns the set; these are the 16 styles every starter
          theme declares: <code>display</code>, <code>title</code>,{" "}
          <code>heading</code>, <code>subtitle</code>, <code>lead</code>,{" "}
          <code>body</code>, <code>quote</code>, <code>code</code>,{" "}
          <code>label</code>, <code>caption</code>, <code>overline</code>,{" "}
          <code>stat</code>, <code>badge</code>,{" "}
          <code>body-strong</code>, <code>caption-strong</code>, and{" "}
          <code>card-title</code>. A style is a name, not a seat: put a
          theme-declared style on any element —{" "}
          <code>&lt;span class=&quot;type-caption&quot;&gt;</code> captions a
          figure from inside a paragraph — and the only constraint is the
          vocabulary. Four representative styles render live below from your
          active starter theme; the full 16-style reference table lives in the{" "}
          <A href="/docs/themes/reference#styles">token reference</A>.
        </p>
        <div class="my-2 flex flex-col gap-4">
          <Specimen
            title="type-display — the loudest statement"
            description="from font.style.display"
            code={DISPLAY_SNIPPET}
            preview={<div class="type-display">{SAMPLE}</div>}
          />
          <Specimen
            title="type-heading — a subsection head"
            description="from font.style.heading"
            code={HEADING_SNIPPET}
            preview={<div class="type-heading">{SAMPLE}</div>}
          />
          <Specimen
            title="type-body — the reading style"
            description="from font.style.body"
            code={BODY_SNIPPET}
            preview={<div class="type-body">{SAMPLE}</div>}
          />
          <Specimen
            title="type-code — machine text beside prose"
            description="from font.style.code"
            code={CODE_SNIPPET}
            preview={
              <div class="type-body">
                Traffic shifted away from{" "}
                <span class="type-code">us-east-1</span> within 40 seconds.
              </div>
            }
          />
        </div>
      </Section>

      <Section id="map" title=".type aliases assign styles; links and strong modify">
        <p class="max-w-prose">
          Every element arrives carrying a style because its{" "}
          <code>.type</code> token aliases one: <code>element.h1.type</code>{" "}
          reads <code>display</code>, <code>element.p.type</code> reads{" "}
          <code>body</code>, <code>card.title.type</code> reads{" "}
          <code>card-title</code>, and so on. Re-point one target by
          aliasing another style in your theme —{" "}
          <code>&quot;{`{font.style.title}`}&quot;</code> on{" "}
          <code>element.h1.type</code> moves first-level headings to the
          title style without touching the display style itself:
        </p>
        <Code
          code={FONT_MAP_SNIPPET}
          lang="json"
          title="Re-pointing an element's type in spin/<brand>/elements.json"
        />
        <p class="max-w-prose">
          While elements carry a style, <code>&lt;a&gt;</code> and{" "}
          <code>&lt;strong&gt;</code> are inline modifiers over the text they
          sit in. A link inherits its surrounding family, size, weight,
          tracking, and leading, and adds only its paint: the{" "}
          <code>link</code> color, an underline of{" "}
          <code>link.underline</code> thickness at{" "}
          <code>link.offset</code> distance, with transition and hover/focus
          states. <code>&lt;strong&gt;</code> adds only weight (
          <code>font.weight.bold</code>), so bolding inside a caption or a
          heading never resets the size, family, or leading around it:
        </p>
        <Code
          code={INLINE_SNIPPET}
          lang="html"
          title="Inline modifiers inherit their surroundings"
        />
      </Section>

      <Section id="escape" title="The escape, honestly">
        <p class="max-w-prose">
          One style on this site is genuinely one-off: the Spin wordmark in
          the corner, set in the brand face at one deliberate size no theme
          scale has reason to name. That element carries{" "}
          <code>data-spin-escape</code>, the author&apos;s explicit word that its
          classes are deliberate — so no warning fires about placement
          there — while the vocabulary rule still fires, because deliberate
          code still names nothing dead. Reach for
          it for a brand lockup or a hero moment, never for copy the theme
          could say; if you reach for it twice, the theme is missing a style
          worth naming. The full contract lives in the{" "}
          <A href="/docs/tooling/lints">lints guide</A>.
        </p>
      </Section>
    </main>
  );
}
