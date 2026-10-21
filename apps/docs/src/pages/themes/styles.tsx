/**
 * The style references: the directions a theme can be built in.
 *
 * The house skill is the method, and it is the same method for every style.
 * A style reference is the direction: what to spend the axes on. A theme is
 * the house, one style, and the decisions only the product's owner can make.
 *
 * Every word below is read out of the reference files themselves, which are
 * also the files an agent installs. The page cannot describe a reference
 * that has been revised.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Section } from "../../bits.tsx";
import { Markdown } from "./_markdown.tsx";
import { SKILL_PATH, styleReferences } from "../../style-docs.ts";
import type { StyleReference } from "../../style-docs.ts";

const LAYERS: readonly (readonly [string, string])[] = [
  [
    "The house skill",
    "The method, and it does not vary: the order of the work, the checklist of the theme's own groups, the gates and what each failure means, and the judgement at the end. One file, and it is the same for every style.",
  ],
  [
    "The style reference",
    "The direction. It says what to spend the axes on: the type voice, the palette, the shape, the depth, the motion and the density, and the two or three decisions that make the style recognisable. It says nothing about the product.",
  ],
  [
    "The theme",
    "The house, the style, and the decisions nobody could have guessed: the name of the product's primary action, the colour the brand already owns, the density its users work at. This is the part the references cannot write for you.",
  ],
];

export default function Styles(): JSX.Element {
  const styles = styleReferences();
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <h1 class="text-2xl tracking-tight">Style references</h1>
      <p class="mt-1 max-w-screen-md text-text-muted">
        A style reference is a direction, not a theme. It names a look, says
        what makes that look recognisable, and says what would pull it back
        towards the house style. Pick one, read it, and spend the axes
        accordingly.
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <A href="/themes/authoring" class="text-link hover:underline">
          authoring a theme
        </A>
        <A href={SKILL_PATH} class="text-link hover:underline">
          the skill file
        </A>
      </div>

      <Section id="layers" title="How the three fit">
        <p>
          Three things, and it is worth keeping them apart. The house skill is
          the method and never varies. A style reference is a direction, and
          there is one per style. A theme is the house, one style, and the
          decisions only the product's owner can make.
        </p>
        <ol class="mt-4 grid gap-3 md:grid-cols-3">
          <For each={LAYERS}>
            {([name, what]) => (
              <li class="border border-border bg-surface-raised rounded-md p-4">
                <p class="m-0 font-semibold text-text">{name}</p>
                <p class="m-0 mt-2 text-sm">{what}</p>
              </li>
            )}
          </For>
        </ol>
        <p class="mt-4">
          The references are written for an agent to follow, so they are
          installed beside the skill rather than read here and remembered. The
          file each card names is the whole reference, and it is the file the
          page above is rendering.
        </p>
      </Section>

      <Section id="references" title="The references">
        <p>
          {styles.length}{" "}
          directions, and they do not overlap much. A theme built from one of
          them should not be mistakable for a theme built from another, and the
          last section of each reference says what would pull it back.
        </p>
        <div class="mt-5">
          <For each={styles}>
            {(style) => <StyleCard style={style} />}
          </For>
        </div>
      </Section>
    </main>
  );
}

/**
 * One reference, in full.
 *
 * The card carries the facts the file states at the top, and the body is the
 * file's own text, rendered.
 */
function StyleCard(props: { style: StyleReference }): JSX.Element {
  const style = props.style;
  return (
    <article class="mb-8 overflow-hidden rounded-md border border-border bg-surface text-text">
      <header class="border-b border-border bg-surface-raised p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 class="m-0 font-heading text-xl tracking-tight">{style.name}</h2>
          <a
            href={style.href}
            class="font-mono text-xs text-link hover:underline break-all"
          >
            {style.href}
          </a>
        </div>
        <p class="m-0 mt-2 text-sm">{style.mood}</p>
        <p class="m-0 mt-1 text-sm text-text-muted">{style.audience}</p>
        <p class="m-0 mt-1 text-xs text-text-muted">
          anchor: {style.anchor}
        </p>
      </header>
      <div class="p-4">
        <Markdown text={style.body} />
      </div>
    </article>
  );
}
