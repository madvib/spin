/**
 * Markup: HTML the theme dresses, and the elements with no native tag.
 *
 * The narrative lives in `../../content/markup.md`. This file keeps the
 * live specimens — the rows' code tabs carry the markup.
 */
import type { JSX } from "solid-js";
import { componentExamples } from "@spinjs/preset";
import { Section } from "../../bits.tsx";
import { ExampleRow } from "../../example-row.tsx";
import { Markdown } from "../../markdown.tsx";
import markupMd from "../../content/markup.md?raw";

export default function Markup(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <Markdown text={markupMd} />
      <Section id="specimens" title="Live specimens">
        <ExampleRow
          name="buttons"
          html={componentExamples.button.rows[0].html}
        />
        <ExampleRow name="badges" html={componentExamples.badge.rows[0].html} />
        <ExampleRow name="fields" html={componentExamples.input.rows[0].html} />
      </Section>
    </main>
  );
}
