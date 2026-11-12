/**
 * How Spin Works: clear mental model for themes, HTML elements, utilities, and interactive components.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";

const layerItems = (): readonly PropEntry[] => [
  {
    name: "1. Brand & Theme",
    badge: "Studio",
    description: (
      <>
        Defines your colors, typography, spacing, corner radii, shadows, and
        motion in both light and dark modes. You shape it visually in{" "}
        <A href="/docs/themes/overview">Studio</A> and check it into git.
      </>
    ),
  },
  {
    name: "2. HTML Elements",
    badge: "CSS only",
    description: (
      <>
        Buttons, inputs, dialogs, tables, cards, badges, and alerts arrive
        styled from your theme with zero client JavaScript. Browse{" "}
        <A href="/docs/styling/elements">HTML Elements</A>.
      </>
    ),
  },
  {
    name: "3. Layout Utilities",
    badge: "CSS only",
    description: (
      <>
        Flexbox, grid, spacing, and surface classes position elements on the
        page using steps from your theme. Repeated layouts can be named once as{" "}
        <A href="/docs/styling/utilities">Shortcuts</A>.
      </>
    ),
  },
  {
    name: "4. Interactive Components",
    badge: "Statecharts",
    description: (
      <>
        Accessible state machines for selects, comboboxes, menus, tabs, and date
        pickers that copy into your repository and work across React, Solid,
        Vue, Svelte, and HTML. See{" "}
        <A href="/docs/authoring/components">Interactive Components</A>.
      </>
    ),
  },
  {
    name: "5. Lints & Checks",
    badge: "Editor & CI",
    description: (
      <>
        Contrast gates verify every color pair in your theme, and static lints
        flag unknown classes or conflicting overrides before they ship. See{" "}
        <A href="/docs/tooling/lints">Lints &amp; Guardrails</A>.
      </>
    ),
  },
];

export default function Architecture(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="How Spin Works"
        lede="How your theme, HTML elements, layout utilities, and interactive components divide the work."
      />

      <Section id="layers" title="The five pieces">
        <PropList items={layerItems()} />
      </Section>

      <Section id="ownership" title="Elements handle appearance; utilities handle layout">
        <p class="max-w-prose">
          In Spin, standard HTML tags and custom surfaces carry their own visual
          design — padding, borders, focus rings, hover states, and typography
          all come straight from your theme. Utility classes arrange those
          elements on the screen with grids, flex rows, gaps, and widths.
        </p>
        <p class="max-w-prose">
          When a control needs different emphasis, pick one of its built-in
          variants like <code>primary</code>, <code>secondary</code>,{" "}
          <code>ghost</code>, or <code>danger</code>. When you want every button
          or card across your product to look rounder, tighter, or bolder,
          adjust it once in Studio and every screen updates together.
        </p>
        <div class="my-3">
          <Code
            lang="html"
            title="Elements carry appearance; utilities arrange the layout"
            code={`<card class="max-w-md">
  <card-header>
    <card-title>Production environment</card-title>
    <card-description>Automatic deploys from main are enabled.</card-description>
  </card-header>
  <card-footer class="justify-end gap-2">
    <button type="button" class="ghost">Pause</button>
    <button type="button" class="primary">Deploy now</button>
  </card-footer>
</card>`}
          />
        </div>
      </Section>

      <Section id="flow" title="From Studio to the browser">
        <ol class="flex max-w-prose flex-col gap-3">
          <li>
            <strong>Shape your brand in Studio.</strong> Pick one of six
            starting design languages, tune colors, typefaces, and spacing
            against live previews, and save to your project's <code>spin/</code>{" "}
            folder.
          </li>
          <li>
            <strong>Compile only what you use.</strong> During development and
            production builds, the bundler plugin compiles your theme and scans
            your templates to emit CSS only for the elements and utilities your
            app actually renders.
          </li>
          <li>
            <strong>Verify in editor and CI.</strong> If a color tweak breaks
            readability or a template uses a class outside your theme scale,
            Studio and <code>spin lint</code> point straight to the fix.
          </li>
        </ol>
      </Section>
    </main>
  );
}
