/**
 * Why spin: the argument, the trade-offs, and what it is not.
 *
 * The features have their own pages. This one is the case for the system,
 * told plainly: the problem it answers, the things it refuses to be, and
 * what adopting it costs. Every claim here is a claim about this tree, and
 * the markup the page shows is markup the lints accept.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Code, Section } from "../bits.tsx";

/** The theme, and the markup it buys. */
const THEME = `{
  "color": {
    "primary": { "$value": "#c8102e" },
    "on-primary": { "$value": "#ffffff" }
  },
  "spacing": {
    "4": { "$value": "1rem" }
  }
}`;

const MARKUP =
  `<article class="rounded-md border border-border bg-surface-raised p-4">
  <p class="text-text-muted">Apricot, jasmine, black tea</p>
  <p class="text-primary">Ethiopia Guji</p>
</article>`;

/** The four layers, in the order they stack. */
const LAYERS: readonly {
  readonly name: string;
  readonly body: JSX.Element;
}[] = [
  {
    name: "The utilities spend the theme",
    body: (
      <>
        <code>bg-primary</code> is your primary. <code>p-4</code>{" "}
        is a step on your spacing scale. A class the theme does not name
        produces no CSS at all, so the vocabulary is not a suggestion.
      </>
    ),
  },
  {
    name: "The elements are finished",
    body: (
      <>
        <code>&lt;button&gt;</code> is a button, <code>&lt;dialog&gt;</code>
        {" "}
        is a dialog, a switch is a checkbox wearing{" "}
        <code>role="switch"</code>. They are styled HTML, so the behaviour a
        control needs is the browser's: the focus trap, Escape, the backdrop.
        Nothing to import, nothing to hydrate.
      </>
    ),
  },
  {
    name: "The lints read the source",
    body: (
      <>
        A class the theme cannot produce. A class that overrides a decision the
        theme made. An ink the palette does not pair with the fill. A custom
        property written by hand. The rules ship as an oxlint plugin, an ESLint
        plugin and a CLI, and all three read the same facts.
      </>
    ),
  },
  {
    name: "The rendered checks read the page",
    body: (
      <>
        A real browser, your app, and the measurements a person would make: the
        contrast of a label against the surface actually painted behind it, in
        every state, the geometry the theme named, the console, the network. The
        harness that drives them is internal to this repository today.
      </>
    ),
  },
];

export default function Why(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-md px-4 py-10 md:py-16">
      <h1>Why spin</h1>
      <p class="text-text-muted">
        An agent writes the markup, and the markup is wrong in ways a review
        does not catch. Spin exists for that case: the decisions are written
        down once, and the output is checked against them mechanically.
      </p>

      <Section id="problem" title="The problem">
        <p>
          An agent writes a page. The layout is right, the copy reads, the
          elements are the ones a person would have chosen. Then, in one line,
          it writes <code>bg-[#c8102e]</code> where the theme has a primary. Or
          {" "}
          <code>p-13</code>, a spacing step nobody declared. Or{" "}
          <code>text-text</code> on a <code>bg-primary</code>{" "}
          fill, where the palette says the ink should be{" "}
          <code>text-on-primary</code>. Or it picks a colour that reads in light
          and disappears in dark.
        </p>
        <p>
          None of that is visible in a diff. Each one is a word long, and a
          reviewer reads a page of them without noticing. The same bug arrives
          in a new shape each time, so it never adds up to a pattern somebody
          can catch. Review removes instances of a bug. It does not remove the
          class of bug.
        </p>
        <p>
          The class of bug is not carelessness. It is that the decision was
          never written down anywhere the agent could be held to, and nothing
          measured the result.
        </p>
      </Section>

      <Section id="what" title="What spin is">
        <p>
          Spin writes the decisions down, and then holds the markup to them. A
          theme is one JSON document on disk. The build reads it and emits CSS
          custom properties, and every utility and every element resolves
          against those properties.
        </p>
        <Code class="mt-3" code={THEME} lang="json" />
        <p>
          The markup names the decision. The theme holds the value.
        </p>
        <Code class="mt-3" code={MARKUP} lang="html" />
        <p>
          Replace the document and the product's look changes. The markup does
          not.
        </p>

        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <For each={LAYERS}>
            {(layer) => (
              <div class="border border-border bg-surface-raised rounded-md p-4">
                <p class="font-semibold text-text">{layer.name}</p>
                <p class="text-sm">{layer.body}</p>
              </div>
            )}
          </For>
        </div>

        <p>
          An agent can also read the project before it writes to it. The MCP
          server answers with the theme on disk, the utilities the preset
          generates and the elements the library ships, so the names it writes
          are names that exist. And the output is checked by something that does
          not get tired.
        </p>
      </Section>

      <Section id="trade-offs" title="The trade-offs">
        <p>
          <strong class="text-text">Not a runtime component library.</strong>
          {" "}
          Spin ships a stylesheet. The elements are HTML the browser already
          knows how to behave; there is no runtime, no hydration, no hook. A
          control that needs behaviour HTML does not have belongs to a component
          runtime, and spin is not one. A runtime that turns these elements into
          custom elements is being built beside spin, not inside it.
        </p>
        <p>
          <strong class="text-text">Not a design tool.</strong>{" "}
          It does not draw. The studio is a theme editor: it edits the JSON
          document, it repaints the app beside it as you type, and it writes the
          file back to disk. It is a better way to author tokens than a text
          editor. It is not Figma, and it does not read Figma files: spin reads
          a JSON document, so if the decisions live somewhere else, something
          has to carry them across.
        </p>
        <p>
          <strong class="text-text">Not Tailwind.</strong>{" "}
          The generator underneath is UnoCSS, and the preset layers wind4's
          rules beneath its own. What spin adds is that the vocabulary belongs
          to the theme. The values are the theme's. The palette is the theme's,
          so there is no <code>bg-red-500</code>{" "}
          in a spin sheet: the theme never declared red-500, and a class it
          cannot produce generates nothing. And the lints are about the theme
          rather than about utility classes. "Is this a valid utility" is a
          different question from "can this project's theme produce this class",
          and only the second one catches the bug that matters.
        </p>
        <p>
          <strong class="text-text">
            The vocabulary is closed.
          </strong>{" "}
          That is the point, and it is the cost. A theme declares tokens under a
          fixed set of types, and a token with an unrecognised type is a parse
          error naming every valid type. A class outside the vocabulary produces
          no CSS. The cost is that a decision the contract does not have cannot
          be written down until the contract changes, and a project with a house
          style spin does not model has to wait for it or fork the theme.
        </p>
        <p>
          <strong class="text-text">
            It is opinionated about what a theme must declare.
          </strong>{" "}
          A theme owes the base roles: the palette, the inks that go on the
          palette, the focus ring every interactive element shares, and the two
          dimensions of the ring. Each role carries the contrast floors it owes.
          Only colour and focus vary by mode, because a dark mode changes ink
          and surface, not space or type. A project that disagrees with any of
          that has to change the contract, fork the package, or use a different
          system. There is no setting where you declare a theme in your own
          shape.
        </p>
        <p>
          <strong class="text-text">
            The primitives claim your markup.
          </strong>{" "}
          By default <code>&lt;button&gt;</code> is a button and{" "}
          <code>&lt;table&gt;</code>{" "}
          is a table, everywhere in your app, including the markup you do not
          control. <code>classless: false</code>{" "}
          is the escape hatch: each primitive then claims only its own class,
          and the same components ask to be named.
        </p>
      </Section>

      <Section id="not" title="What it is not">
        <p>
          <strong class="text-text">Not a substitute for taste.</strong>{" "}
          The machine checks the floor: the roles the document owes, the
          contrast it owes, the ladders that must descend, the modes it must
          serve. It cannot tell you whether a theme is dull. Distinctness,
          restraint with effects, and a dark mode designed rather than inverted
          are judgement, and a person makes it.
        </p>
        <p>
          <strong class="text-text">Not a way to skip design.</strong>{" "}
          You still bring the decisions. A scaffold gives you the required roles
          with deliberately ugly placeholder values: they validate, and they are
          obviously unfinished. A theme that looks finished was not scaffolded,
          it was authored.
        </p>
        <p>
          <strong class="text-text">
            Not a framework you adopt to get one component.
          </strong>{" "}
          The elements are not a catalogue you shop from. They are the theme's
          decisions, expressed as HTML. <code>&lt;button&gt;</code>{" "}
          is a button because the theme says what a button looks like, and take
          the theme away and the elements stop being anything in particular.
        </p>
      </Section>

      <Section id="cost" title="The cost">
        <p>
          There is a bill, and it is worth stating.
        </p>
        <p>
          <strong class="text-text">The theme is work.</strong>{" "}
          A document that has to declare the base roles, pass the legibility
          floors in every mode it serves, hold the spacing and radius ladders in
          order, and decide every token it leaves in. The scaffold takes an hour
          off that. It does not take the day.
        </p>
        <p>
          <strong class="text-text">
            Your palette is the theme's palette.
          </strong>{" "}
          Every value a utility can carry is a token somebody declared, which
          means every value you add is a decision somebody has to make, hold and
          maintain.
        </p>
        <p>
          <strong class="text-text">The lints are a wall by default.</strong>
          {" "}
          <code>prefer-theme-value</code>{" "}
          treats a one-off override as an error, and the message says why: the
          theme is where decisions recur. There is a dial, strict, balanced or
          lenient, and a switch for which elements the rules apply to. The
          default stance is that a second opinion in the markup is a mistake.
        </p>
        <p>
          <strong class="text-text">Nothing is published yet.</strong>{" "}
          v0.1 is source-first. The packages are built and the npm manifests
          exist, and until publishing is somebody's decision you take the code
          from source.
        </p>
        <p>
          <strong class="text-text">
            The checks are only as good as the theme.
          </strong>{" "}
          A theme that declares a bad pairing passes every mechanical check,
          because the check can only measure what the document says. The checks
          hold the floor. They do not know what the product should look like.
        </p>
      </Section>

      <Section id="start" title="Start here">
        <p>Two pages, in this order.</p>
        <ul class="grid gap-2 list-disc">
          <li>
            <A href="/guide/install" class="text-link hover:underline">
              Install
            </A>{" "}
            says what to put in your{" "}
            <code>deno.json</code>, how to wire the plugin, and which recipe
            belongs to your bundler. v0.1 is source-first, so the page is
            explicit about where the packages come from.
          </li>
          <li>
            <A href="/themes" class="text-link hover:underline">Themes</A>{" "}
            says what a theme is, the token language, the roles a theme owes and
            the floors it has to hold, and how to fork a starter. Read it before
            you write one: the contract is the whole thing.
          </li>
        </ul>
        <p>
          The elements are in{" "}
          <A href="/components" class="text-link hover:underline">
            components
          </A>
          , the diagnostics in{" "}
          <A href="/guide/verify" class="text-link hover:underline">verify</A>,
          and the starters side by side in{" "}
          <A href="/tokens" class="text-link hover:underline">tokens</A>.
        </p>
      </Section>
    </main>
  );
}
