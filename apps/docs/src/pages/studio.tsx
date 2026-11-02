/**
 * The Studio world: the live editor embedded full-bleed, with the
 * walkthrough beneath it. This page edits the docs' own theme — the
 * preview repaints this site before anything is saved.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Code, Section } from "../bits.tsx";
import { GETTING_STARTED_SNIPPETS } from "./docs/getting-started/getting-started.snippets.ts";

export default function Studio(): JSX.Element {
  const app = typeof location === "undefined"
    ? ""
    : `?app=${encodeURIComponent(location.origin)}&mode=drawer`;
  return (
    <main class="flex h-full min-h-0 flex-col">
      <div class="mx-auto w-full max-w-screen-lg px-6 pt-10">
        <h1>Using the Studio</h1>
        <p class="max-w-prose text-text-muted">
          The Studio is Spin's theme editor: change a color, a type ramp, an
          icon, or a spacing step, and the running page repaints before anything
          is saved. When it is right, save; the theme document lands in{" "}
          <code>spin/</code>. Below is the live editor, editing this site.
        </p>
      </div>
      <div class="mx-auto mt-6 w-full max-w-screen-lg flex-1 px-6 pb-6">
        <iframe
          title="Spin theme studio, editing this site"
          src={`${import.meta.env.BASE_URL}__spin/studio/${app}`}
          class="h-[70dvh] w-full rounded-md border border-border bg-surface-raised shadow-md"
        />
      </div>
      <div class="mx-auto w-full max-w-screen-lg px-6 pb-10 md:pb-16">

      <Section id="launch" title="Launching the Studio">
        <p>
          The plugin mounts the Studio itself beside the app, on the
          app's own origin — no <code>mount</code> to name. The editor
          opens from the <code>Studio</code> launcher in the
          bottom-right corner of your dev page, or directly at{" "}
          <code>/__spin/studio/</code>. Only name the mount to turn it
          off: <code>studio: false</code> disables the mount and the
          launcher entirely.
        </p>
        <Code class="mt-3" code={GETTING_STARTED_SNIPPETS.studio} lang="ts" />
        <p>
          Every other bundler — and no bundler at all — runs the Studio
          standalone from the CLI, at{" "}
          <code>http://localhost:7463/studio/</code> by default:
        </p>
        <Code class="mt-3" code={GETTING_STARTED_SNIPPETS.studioServe} lang="bash" />
        <p>
          Either way the editing model is the same. Your keystrokes update an
          in-memory overlay that the preview repaints from immediately; nothing
          touches disk until you press <strong>Save</strong>, which writes{" "}
          <code>spin/&lt;name&gt;.json</code>. A broken edit can never corrupt
          the file — the last saved document is always what reload restores.
        </p>
      </Section>

      <Section id="themes" title="Managing themes">
        <p>
          The Overview page (the mark at the top of the rail) lists every
          theme the project serves, with live swatches painted by the
          stylesheet's own cascade. The top bar switches the active theme and
          its light or dark mode; the preview below follows both. Its
          middle reads the document's state — the theme, the mode, the
          token count, and whether the file agrees.
        </p>
        <p>
          A theme the project serves from its brand or from verbatim
          options is read-only here: saving it offers a copy into{" "}
          <code>spin/</code> under a name you choose, and the copy is
          what the project then edits. A theme the project owns saves
          in place.
        </p>
        <p>
          The Overview's Project section edits <code>spin/config.json</code>:
          a select names the active theme, and up and down verbs order
          the list. With no file the Studio serves its defaults and
          says so — saving writes the file.
        </p>
        <p>
          <strong>New theme</strong> opens a stepped dialog: pick a starter
          (or Blank, which scaffolds the required roles), choose the primary,
          secondary, and accent fills plus the body and heading faces, name
          the theme, and the Studio writes the new{" "}
          <code>spin/&lt;name&gt;.json</code> beside the others.
        </p>
      </Section>

      <Section id="colors" title="Editing colors">
        <p>
          The Themes page's Color group (<code>/themes/colors</code>) edits every{" "}
          <code>color.*</code> role in both modes: the base surfaces (<code>surface</code>,{" "}
          <code>surface-raised</code>, <code>surface-sunken</code>), the acting fills (<code>primary</code>,{" "}
          <code>secondary</code>, <code>accent</code>), the semantic fills
          (<code>success</code>, <code>warning</code>, <code>error</code>,{" "}
          <code>info</code>), and each fill's paired <code>on-*</code> ink.
          Roles that follow another role flip in one click from the role card.
        </p>
        <p>
          Every fill-and-ink pair carries a live contrast badge. A pair below
          its floor opens a one-click fix: the value the token would have to
          take to pass, with the ratio it would land on. A finding that names
          the value is an offer, not a complaint — accepting it writes the
          token.
        </p>
      </Section>

      <Section id="type" title="Changing fonts and type">
        <p>
          The Themes page's Type group (<code>/themes/type</code>) edits everything under <code>font.*</code>. The{" "}
          <strong>Faces</strong> section picks the family ladder —{" "}
          <code>sans</code>, <code>heading</code>, <code>body</code>,{" "}
          <code>serif</code>, and <code>mono</code> — from the built-in
          Fontsource catalog. Choosing a face writes its declaration into the
          theme's <code>$extensions.spin.fonts</code>, and Spin emits the
          matching <code>@font-face</code> blocks into the sheet.
        </p>
        <p>
          The <strong>Scale</strong>, <strong>Weight</strong>, and{" "}
          <strong>Tracking</strong> sections tune the <code>font.size.*</code>{" "}
          ramp (<code>xs</code> through <code>4xl</code>), the{" "}
          <code>font.weight.*</code> steps, and the{" "}
          <code>font.letter-spacing.*</code> steps. The{" "}
          <strong>Element map</strong> sets per-element overrides —{" "}
          <code>font.element.h1.family</code>,{" "}
          <code>font.element.button.weight</code>,{" "}
          <code>font.element.code.size</code> — so a heading, a button, or a
          code run carries its own voice where the theme means it to. Elements
          inherit from the scale unless overridden.
        </p>
      </Section>

      <Section id="icons" title="Searching and vendoring icons">
        <p>
          The Themes page's Icons group (<code>/themes/icons</code>) searches the five installed Iconify collections —{" "}
          <code>lucide</code>, <code>material-symbols</code>, <code>tabler</code>,{" "}
          <code>carbon</code>, and <code>ph</code> — tens of thousands of names
          between them. Filter by collection, size the glyphs, and search by
          name or keyword.
        </p>
        <p>
          A glyph you choose is vendored, not hot-linked: pressing{" "}
          <strong>Keep in library</strong> writes its SVG into{" "}
          <code>spin/icons/&lt;collection&gt;.json</code> with the collection's
          license attribution. Spend it in markup with{" "}
          <code>&lt;span class="i-lucide-check icon-sm" aria-hidden="true" /&gt;</code>,
          sized by the theme's own <code>icon.*</code> ladder.
        </p>
      </Section>

      <Section id="motion" title="Editing animations">
        <p>
          The Themes page's Motion group (<code>/themes/motion</code>) edits <code>motion.*</code>: the{" "}
          <strong>Durations</strong> ramp (<code>fast</code>, <code>base</code>,{" "}
          <code>slow</code>, and the endless <code>loop</code> period), the{" "}
          <strong>Easings</strong> curves (<code>linear</code>,{" "}
          <code>standard</code>, <code>decelerate</code>,{" "}
          <code>accelerate</code>) with an interactive cubic-bezier editor, and
          the <strong>Transitions</strong> each pair produces. Every lane plays
          live under one loop control, so durations compare as lengths and
          curves compare as speed.
        </p>
        <p>
          Spend them in markup with <code>transition-colors duration-fast</code>,{" "}
          <code>ease-standard</code>, and the <code>animate-*</code> utilities.
          A theme moves its motion by moving these two ramps, and every
          transition follows.
        </p>
      </Section>

      <Section id="geometry" title="Spacing, radius, borders, and elevation">
        <p>
          The Themes page's Spacing group (<code>/themes/spacing</code>) edits the <code>spacing.*</code> scale — the
          monotonic ramp every margin, padding, and gap utility spends — and
          the <code>breakpoint.*</code> widths the responsive variants answer
          to. The Themes page's Style group (<code>/themes/style</code>) edits <code>radius.*</code>, the{" "}
          <code>shadow.*</code> elevation steps, <code>z-index.*</code>,{" "}
          <code>opacity.*</code>, <code>border.width*</code> with its
          composites, <code>focus.*</code>, and the gradient fills.
        </p>
      </Section>

      <Section id="elements" title="Component recipes">
        <p>
          The Components page (the Elements entry in the rail) lists every primitive and every statechart machine
          under the active theme, grouped by what each is for, each row wearing
          its glyph. Open one to see its live specimens, the classes they
          read, and the tokens they spend — a theme that has never spelled{" "}
          <code>button.weight</code> meets that token here, on the page for
          the button.
        </p>
        <p>
          Each machine example carries <strong>copy to project</strong>, which
          writes the recipe into <code>lib/components/</code> through the
          daemon — the same bytes <code>npx spin component copy</code> writes,
          vendored from the page that shows them.
        </p>
      </Section>

      <Section id="findings" title="Source findings">
        <p>
          The Findings page reads what the lints say about the project's own
          source, grouped by the rule that said them: the same rule firing in
          five files is one problem with five instances, and one kind of edit
          to apply. A fix is applied on demand, to the file — the daemon owns
          the project's files, re-reads before it writes, and the page re-reads
          the lints afterwards. Beside the findings, the corpus answers the
          project-wide questions: the compositions the source repeats (declare
          a shortcut) and the class lists out of order (write them in order).
        </p>
        <p>
          The Studio edits the theme document described on{" "}
          <A href="/docs/themes/overview">Themes &amp; modes</A>, validated against the{" "}
          <A href="/docs/themes/schema">Token schema</A>. Every token, role, and
          gate it touches is defined there.
        </p>
      </Section>
      </div>
    </main>
  );
}
