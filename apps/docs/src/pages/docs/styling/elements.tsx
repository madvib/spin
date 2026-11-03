/**
 * Classless Elements: semantic HTML tags and Spin custom elements dressed by the theme.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import {
  componentExamples,
  primitiveCategories,
  primitiveElements,
} from "@spinjs/spin/preset";
import { ExampleRow } from "../../../example-row.tsx";
import { Markdown } from "../../../markdown.tsx";
import { PageHeader, PlaygroundEmbed, Section } from "../../../ui/index.ts";
import markupMd from "../../../content/markup.md?raw";

export default function StylingElements(): JSX.Element {
  const elementsForCategory = (categoryId: string) =>
    primitiveElements.filter((el) => el.category === categoryId);

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Classless Elements"
        lede="Write standard semantic HTML and Spin custom elements. Your active theme dresses every control, container, and prose element without class boilerplate."
        playgroundExample="elements-form"
      />
      <Markdown text={markupMd} />

      <Section id="directory" title="Element directory by category">
        <p class="max-w-prose">
          Every element rule in <code>@spinjs/spin/preset</code>, grouped by its
          category in the primitive manifest. Click any element to inspect its
          live specimens, variants, and theme token reads.
        </p>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <For each={primitiveCategories}>
            {(cat) => (
              <div class="rounded-lg border border-border bg-surface-raised p-4">
                <p class="overline">{cat.label}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <For each={elementsForCategory(cat.id)}>
                    {(el) => (
                      <A
                        href={`/components/${el.name}`}
                        class="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-text no-underline transition-colors duration-fast hover:border-primary hover:text-primary"
                      >
                        <span class={`${el.icon} icon-sm text-text-muted`} aria-hidden="true" />
                        <span>{el.name}</span>
                      </A>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      <Section id="specimens" title="Live specimens">
        <ExampleRow
          name="buttons"
          html={componentExamples.button.rows[1].html}
        />
        <ExampleRow
          name="cards"
          html={componentExamples.card.rows[0].html}
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
