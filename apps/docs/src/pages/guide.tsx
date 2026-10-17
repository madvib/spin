/**
 * The guide: the install story as it honestly is — v0.1 is source-first,
 * npm distributions land at launch — the one-plugin wiring, and the
 * vocabulary rules.
 */
import type { JSX } from "solid-js";
import { Code, Section } from "../bits.tsx";
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
import myTheme from "./theme.json" with { type: "json" };

export default {
  plugins: [spin.vite({
    // Omit this and the plugin owns spin/*.json off your root — the
    // files the studio edits. Pass a map to own the documents yourself.
    themes: { myTheme, ...starterThemes },
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

export default function Guide(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1 class="text-2xl tracking-tight">Guide</h1>
      <p class="text-text-muted max-w-screen-md mt-1">
        Install it, wire it, write markup, ship. Every section is the real
        product — this site runs on it.
      </p>

      <Section id="what" title="What spin is">
        <p>
          Agents write markup all day. What they don't have is a system of
          decisions that makes every screen look like it belongs together. spin
          gives them one: bring your design as a theme, and every button, badge,
          and input your agent writes comes out consistent, accessible, and
          yours.
        </p>
        <p>
          spin is not a component library. The elements carry paint only — a
          {" "}
          <code class="font-mono">&lt;button&gt;</code>{" "}
          gets its look from the theme, and state stays in your app.
        </p>
      </Section>

      <Section id="install" title="Install">
        <p>
          The two packages a spin app needs:
        </p>
        <Code code={ADD} />
        <p class="mt-3">
          <strong class="text-text">Heads-up:</strong>{" "}
          the npm packages publish at the v0.1 launch. Until then, point your
          imports at the modules in the repo — the same map you see above.
          Moving to npm later is that one line again.
        </p>
      </Section>

      <Section id="wire" title="Wire the plugin">
        <p>
          <code class="font-mono">spin.vite()</code> replaces{" "}
          <code class="font-mono">@unocss/vite</code>{" "}
          and that's all the Uno config you'll ever write — your theme documents
          {" "}
          <em>are</em>{" "}
          the config. Point it at your own documents, or let it read{" "}
          <code class="font-mono">spin/*.json</code>{" "}
          from your project root (the studio edits those files and reloads
          live):
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
          already carries your theme; variant and size classes change it;
          utilities fine-tune it. Live, with the markup to copy below:
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

      <Section id="themes" title="Theme anything, including one island">
        <p>
          One attribute themes anything — the whole app or a single card:
        </p>
        <Code
          code={`<html data-theme="widow" data-mode="dark">  <!-- the whole app -->
<div data-theme="console">                 <!-- one island, any subtree -->`}
        />
        <p class="mt-3">
          Add <code class="font-mono">data-mode="dark"</code>{" "}
          and the same markup flips to its dark rendering. There is no second
          system: the switch in this site's rail is the product's, unchanged.
        </p>
      </Section>

      <Section id="layer" title="What's in the box">
        <p>
          Your starter kit: the theme pipeline (parse, validate, emit), the
          utility preset with the finished elements, and a lint plugin that
          keeps agent-written UI inside your vocabulary. State and behavior stay
          yours — spin only paints.
        </p>
      </Section>

      <Section id="verify" title="Verify">
        <p>
          You don't have to take any of it on faith: the pipeline rejects
          unreadable contrast at build time,{" "}
          <code class="font-mono">
            @spin/lint
          </code>{" "}
          catches the utility-name mistakes no compiler sees, and the visual and
          layout oracles render real pages and assert on what came out. When an
          agent writes your UI, you can prove it stayed inside the system.
        </p>
      </Section>
    </main>
  );
}
