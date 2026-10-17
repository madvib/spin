/**
 * The guide: the install story as it honestly is — v0.1 is source-first,
 * npm distributions land at launch — the one-plugin wiring, and the layer
 * boundary: what ships now, what merges after.
 */
import type { JSX } from "solid-js";
import { Code, Section } from "./bits.tsx";
import { componentExamples } from "@spin/preset/rules/primitives/examples-index.ts";
import { ExampleRow } from "../example-row.tsx";

const ADD = `{
  // deno.json / package.json — the packages
  "@spin/theme":    "npm:@spin/theme",
  "@spin/preset":   "npm:@spin/preset"
}`;

const WIRE = `import { spin } from "@spin/preset/plugin";

export default {
  plugins: [spin.vite()],
}`;

const WIRE_THEMES = `import { spin } from "@spin/preset/plugin";
import { starterThemes } from "@spin/theme/themes";
import myDeck from "./deck.json" with { type: "json" };

export default {
  plugins: [spin.vite({
    // Omit this and the plugin owns spin/*.json off your root — the
    // files the studio edits. Pass a map to own the documents yourself.
    themes: { myDeck, ...starterThemes },
  })],
};`;

const PRESET_ESCAPE =
  `// No bundler plugin? Generate the sheet where your pipeline lives.
import { spinPreset } from "@spin/preset";

const unoConfig = {
  presets: [spinPreset({
    themes: { ...starterThemes },
  })],
};`;

const MARKUP =
  `<button>spool prints</button>          <!-- the tag is the opt-in -->
<button class="danger s-sm">reel out</button>
<button class="ghost">quiet</button>
<input placeholder="search the web…" />`;

export function Guide(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1 class="text-2xl tracking-tight">Guide</h1>
      <p class="text-text-muted max-w-screen-md mt-1">
        The whole story, in order: what the layer is, how it lands, how markup
        consumes it, and where its edges are.
      </p>

      <Section id="what" title="What spin is">
        <p>
          spin is the{" "}
          <strong class="text-text">
            styling layer for agent-authored UI
          </strong>. Agents generate markup well; what they lack is a body of
          decisions to draw from. spin is that body: a theme (every decision, as
          tokens), a preset (the utilities and the finished elements that spend
          them), and oracles that verify the result stays inside the system.
        </p>
        <p>
          It is deliberately <em>not</em> a component library. The elements are
          {" "}
          <em>paint</em>: a <code class="font-mono">&lt;button&gt;</code>{" "}
          carries its look from the theme; your app carries its state. The
          behavior layer is a separate stack that lands after v0.1 —{" "}
          <a href="/runtime" class="text-primary underline">runtime</a>
          explains it.
        </p>
      </Section>

      <Section id="install" title="Install">
        <p>
          The two packages a spin app needs:
        </p>
        <Code code={ADD} />
        <p class="mt-3">
          <strong class="text-text">Honesty note:</strong>{" "}
          the npm distributions publish at the v0.1 launch. Until then the
          packages eat from source — point your imports at the modules in the
          repo (every app in the workspace does exactly that, including this
          site) and the npm path will be a one-line change when it lands.
        </p>
      </Section>

      <Section id="wire" title="Wire the plugin">
        <p>
          <code class="font-mono">spin.vite()</code> replaces{" "}
          <code class="font-mono">@unocss/vite</code>. It composes the preset
          itself — no <code class="font-mono">uno.config.ts</code>{" "}
          exists anywhere in a spin app, which is the point: the theme documents
          are the config. Without a <code class="font-mono">themes</code>{" "}
          option, the plugin reads <code class="font-mono">spin/*.json</code>
          {" "}
          at your project root (the same files the studio edits and reloads
          live). With one, you own the documents:
        </p>
        <Code code={WIRE} class="mb-3" />
        <Code code={WIRE_THEMES} class="mb-3" />
        <p>
          Outside a bundler, <code class="font-mono">spinPreset()</code>{" "}
          is the escape hatch — the same preset, handed to whatever runs your
          Uno pipeline:
        </p>
        <Code code={PRESET_ESCAPE} />
      </Section>

      <Section id="markup" title="Write the markup">
        <p>
          <strong class="text-text">Tags are the opt-in.</strong> A bare{" "}
          <code class="font-mono">&lt;button&gt;</code>{" "}
          carries the base the theme decides for buttons; variant and size
          classes are words on the same tag; scale utilities spend the deck. The
          row is the primitives' example data, live:
        </p>
        <ExampleRow
          name="buttons"
          html={componentExamples.button.rows[0].html}
        />
        <ExampleRow
          name="fields"
          html={componentExamples.input.rows[0].html}
        />
        <p>
          And the markup, as written:
        </p>
        <Code code={MARKUP} />
      </Section>

      <Section id="decks" title="Switch decks, switch modes">
        <p>
          Any wrapper element carries the theme and the mode:
        </p>
        <Code
          code={`<html data-theme="widow" data-mode="dark">  <!-- the whole app -->
<div data-theme="console">                 <!-- one island, any subtree -->`}
        />
        <p class="mt-3">
          Modes are data, not themes: a deck either states a{" "}
          <code class="font-mono">$modes.dark</code>{" "}
          group or it has one rendering (the terminal deck has one, on purpose).
          The header switcher on this very site is the product's whole switching
          story.
        </p>
      </Section>

      <Section id="layer" title="What v0.1 ships — and doesn't">
        <p>
          v0.1 ships the styling layer: the theme package (parse, validate,
          emit), the preset (utilities + the finished elements' paint), the lint
          plugin that keeps authored UI inside the vocabulary, and the three
          surfaces — this site, the reference, the studio. The component runtime
          — claimed elements with behavior, the daemon, the live studio loop —
          {" "}
          <a href="/runtime" class="text-primary underline">comes after</a>.
          Nothing you write against the styling layer is thrown away; paint is
          the runtime's skin, not a separate truth.
        </p>
      </Section>

      <Section id="verify" title="Verify">
        <p>
          The layer is checkable, which is the whole reason it exists:{" "}
          <code class="font-mono">@spin/lint</code>{" "}
          refuses utility-name mistakes the compiler cannot see; the theme
          pipeline refuses any fill without a readable foreground; the visual
          and layout oracles render real pages and assert on what came out. If
          an agent wrote your UI, you can know it stayed in the system —
          mechanically.
        </p>
      </Section>
    </main>
  );
}
