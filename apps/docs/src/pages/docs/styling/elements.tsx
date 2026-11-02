/**
 * Classless Elements: semantic HTML tags and Spin custom elements dressed by the theme.
 */
import type { JSX } from "solid-js";
import { componentExamples } from "@spinjs/preset";
import { Section } from "../../../bits.tsx";
import { ExampleRow } from "../../../example-row.tsx";
import { Markdown } from "../../../markdown.tsx";
import { PageHeader, PlaygroundEmbed } from "../../../ui/index.ts";
import markupMd from "../../../content/markup.md?raw";

export default function StylingElements(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Classless Elements"
        lede="Write standard semantic HTML and Spin custom elements. Your active theme dresses every control, container, and prose element without class boilerplate."
        playgroundExample="elements-form"
      />
      <Markdown text={markupMd} />

      <Section id="specimens" title="Live specimens">
        <ExampleRow
          name="buttons"
          html={componentExamples.button.rows[0].html}
        />
        <ExampleRow
          name="badges"
          html={componentExamples.badge.rows[0].html}
        />
        <ExampleRow
          name="fields"
          html={componentExamples.field.rows[0].html}
        />
      </Section>

      <Section id="playground" title="Try classless markup live">
        <PlaygroundEmbed exampleId="elements-form" compact />
      </Section>
    </main>
  );
}
