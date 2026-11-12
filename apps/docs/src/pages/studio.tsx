/**
 * The Studio world: the live editor embedded full-bleed, with the
 * walkthrough beneath it. This page edits the docs' own theme — the
 * preview repaints this site before anything is saved.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Code, Section } from "../ui/index.ts";
import { GETTING_STARTED_SNIPPETS } from "./docs/getting-started/getting-started.snippets.ts";

export default function Studio(): JSX.Element {
  const app = typeof location === "undefined"
    ? ""
    : `?app=${encodeURIComponent(location.origin)}&mode=drawer`;
  return (
    <main class="flex h-full min-h-0 flex-col overflow-y-auto">
      <div class="mx-auto w-full max-w-screen-lg px-6 pt-10">
        <h1>Using the Studio</h1>
        <p class="max-w-prose text-muted">
          The Studio is Spin's visual brand and theme workbench: create your
          brand in four steps, tune colors, type styles, faces, spacing, shape,
          motion, and icons against live specimens, and inspect every primitive
          and statechart machine. Edits repaint your running app in memory
          immediately; pressing <strong>Save</strong> writes clean DTCG JSON to{" "}
          <code>spin/&lt;brand&gt;/</code>. Below is the live Studio, editing
          this site.
        </p>
      </div>
      <div class="mx-auto mt-6 w-full max-w-screen-lg shrink-0 px-6 pb-6">
        <iframe
          title="Spin theme studio, editing this site"
          src={`${import.meta.env.BASE_URL}__spin/studio/${app}`}
          class="h-[70dvh] w-full rounded-md border bg-surface-raised shadow-md"
        />
      </div>
      <div class="mx-auto w-full max-w-screen-lg px-6 pb-10 md:pb-16">

      <Section id="launch" title="Launching the Studio">
        <p>
          During development on Vite, Spin injects a floating{" "}
          <strong>Studio</strong> button in the bottom-right corner of your app
          automatically. Set <code>studio: false</code> in{" "}
          <code>spin.vite(&#123; studio: false &#125;)</code> if you ever want to
          hide the launcher.
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
          <code>spin/&lt;brand&gt;/tokens.json</code>. A broken edit can never corrupt
          the file — the last saved document is always what reload restores.
        </p>
      </Section>

      <Section id="themes" title="Top bar, navigation, and the routes">
        <p>
          The top bar holds three zones: on the left, the page title is the
          menu — rest on it (or click it) and a card names every route, with
          the six token-group cards inline. In the center, the command palette
          searches routes, themes, modes, components, and tokens behind{" "}
          <kbd>⌘K</kbd>. On the right, the edit pill carries undo, redo, and{" "}
          <strong>Save</strong> (plus discard when the editor holds unsaved
          edits, and reload when the file moved on disk), beside the seat pill
          naming the active mode and theme.
        </p>
        <p>
          The <strong>Overview</strong> page (<code>/</code>) is the project
          dashboard: the active brand, its token groups, its components, and
          its diagnostics at a glance. <strong>Brand</strong> (<code>/brand</code>)
          manages identity — the parent design language, the authored layers
          (<code>tokens.json</code>, <code>reference.json</code>,{" "}
          <code>elements.json</code>, <code>primitives/*.json</code>), and the
          runtime facets (<code>*.palette.json</code>, <code>*.spacing.json</code>).
          <strong>Tokens</strong> (<code>/tokens/*</code>) holds the six concern
          workbenches below; <strong>Components</strong> (<code>/components</code>)
          catalogs primitives and machines; <strong>Diagnostics</strong> (<code>
          /diagnostics</code>) reads the theme contract checks and the source
          lints together. Opening <code>/init</code> launches the four-step{" "}
          <strong>Create your brand</strong> wizard (Brand → Design language →
          Color → Type &amp; icons).
        </p>
      </Section>

      <Section id="colors" title="Editing colors">
        <p>
          The Tokens page's Color group (<code>/tokens/colors</code>) edits every{" "}
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

      <Section id="type" title="Type styles, faces, and ramps">
        <p>
          Under <code>Tokens ▾ → Type</code>, typography is split into three
          focused workbenches:
        </p>
        <ul>
          <li>
            <strong>Styles (<code>/tokens/type/styles</code>):</strong> A
            two-column master-detail workbench for the 13 named{" "}
            <code>font.style.*</code> tuples (<code>display</code> through{" "}
            <code>overline</code>), paired with the HTML{" "}
            <strong>Elements</strong> table mapping <code>h1</code>–
            <code>h6</code>, <code>p</code>, <code>code</code>, and{" "}
            <code>blockquote</code> to their default type styles in{" "}
            <code>elements.json</code>.
          </li>
          <li>
            <strong>Faces (<code>/tokens/type/faces</code>):</strong> Curated
            three-face pairings (display, body, mono) and individual{" "}
            <code>font.family.*</code> slots backed by the built-in Fontsource
            catalog, emitting <code>$extensions.spin.fonts</code>{" "}
            <code>@font-face</code> rules automatically.
          </li>
          <li>
            <strong>Ramps (<code>/tokens/type/ramps</code>):</strong> Live
            specimens for the <code>font.size.*</code> scale,{" "}
            <code>font.weight.*</code> steps, <code>font.tracking.*</code>, and{" "}
            <code>font.leading.*</code> ratios.
          </li>
        </ul>
        <p>
          Component-specific typography tokens (<code>button.type</code>,{" "}
          <code>card.title.type</code>, <code>badge.type</code>) live directly on
          each primitive's page under <code>/components/:name</code> beside its
          live specimen.
        </p>
      </Section>

      <Section id="icons" title="Searching and vendoring icons">
        <p>
          The Tokens page's Icons group (<code>/tokens/icons</code>) searches the five installed Iconify collections —{" "}
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
          The Tokens page's Motion group (<code>/tokens/motion</code>) edits <code>motion.*</code>: the{" "}
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
          The Tokens page's Spacing group (<code>/tokens/spacing</code>) edits the <code>spacing.*</code> scale — the
          monotonic ramp every margin, padding, and gap utility spends — and
          the <code>breakpoint.*</code> widths the responsive variants answer
          to. The Tokens page's Style group (<code>/tokens/style</code>) edits <code>radius.*</code>, the{" "}
          <code>shadow.*</code> elevation steps, <code>z-index.*</code>,{" "}
          <code>opacity.*</code>, <code>border.width*</code> with its
          composites, <code>focus.*</code>, and the gradient fills.
        </p>
      </Section>

      <Section id="elements" title="Primitives and Machines">
        <p>
          The <strong>Components</strong> catalog (<code>/components</code>)
          filters between <strong>Primitives</strong> (CSS-only intrinsic HTML
          tags and Spin custom elements that own editable theme tokens) and{" "}
          <strong>Machines</strong> (interactive statechart components from{" "}
          <code>@spinjs/components</code>). Opening a primitive such as{" "}
          <code>/components/button</code> or <code>/components/card</code> shows
          its live variant specimens alongside its editable token table (surface,
          radius, spacing, and typography tokens in{" "}
          <code>spin/&lt;brand&gt;/primitives/&lt;name&gt;.json</code>).
        </p>
        <p>
          Opening a machine component shows its interactive recipes and a{" "}
          <strong>Copy to project</strong> action that vendors the{" "}
          <code>.html</code> template into <code>src/lib/components/</code> —
          the same file written by <code>npx spin component copy</code>.
        </p>
      </Section>

      <Section id="findings" title="Diagnostics">
        <p>
          The Diagnostics page (<code>/diagnostics</code>) reads the theme contract
          checks and what the lints say about the project's own source, grouped by the rule that said them: the same rule firing in
          five files is one problem with five instances, and one kind of edit
          to apply. A fix is applied on demand, to the file — the daemon owns
          the project's files, re-reads before it writes, and the page re-reads
          the lints afterwards. Beside the findings, the corpus answers the
          project-wide questions: the compositions the source repeats (declare
          a shortcut) and the class lists out of order (write them in order).
        </p>
        <p>
          The Studio edits the theme document described on{" "}
          <A href="/docs/themes/overview">Themes</A>, validated against the{" "}
          <A href="/docs/themes/reference">Token Reference</A>. Every token,
          role, and gate it touches is defined there.
        </p>
      </Section>
      </div>
    </main>
  );
}
