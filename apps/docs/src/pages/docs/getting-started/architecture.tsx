/**
 * Architecture & Layers: which layer owns each decision and which gate verifies it.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";

const layerItems = (): readonly PropEntry[] => [
  {
    name: "1. Your Brand (spin/<brand>/)",
    badge: "colors & type",
    description: (
      <>
        Owns every visual value: your palette with readable inks, your type
        voices, spacing steps, corner radii, shadows, and motion. Shape it in
        the Studio; theme checks keep it complete and legible in both modes.
        See <A href="/docs/themes/overview">Your Brand &amp; Studio</A>.
      </>
    ),
  },
  {
    name: "2. Finished HTML Elements",
    badge: "buttons & cards",
    description: (
      <>
        Native tags (<code>&lt;button&gt;</code>, <code>&lt;input&gt;</code>,{" "}
        <code>&lt;table&gt;</code>, headings) and Spin surfaces (
        <code>&lt;card&gt;</code>, <code>&lt;badge&gt;</code>,{" "}
        <code>&lt;alert&gt;</code>) arrive styled by your brand. Write{" "}
        <code>&lt;button class="primary"&gt;</code> and get a finished control.
        Explore <A href="/docs/styling/elements">HTML Elements &amp; Surfaces</A>.
      </>
    ),
  },
  {
    name: "3. Layout Utilities & Project Shortcuts",
    badge: "arrangement",
    description: (
      <>
        Arrange elements with <code>flex</code>, <code>grid</code>,{" "}
        <code>gap-4</code>, and <code>p-6</code>, reading only steps your brand
        declares. Name the arrangements your app repeats once, and spell them
        the same way everywhere. See{" "}
        <A href="/docs/styling/tailwind">Utility Syntax</A> and{" "}
        <A href="/docs/styling/utilities">Project Shortcuts</A>.
      </>
    ),
  },
  {
    name: "4. Interactive Components",
    badge: "widgets",
    description: (
      <>
        Copy tested templates for selects, dialogs, menus, and date pickers
        into your repo — keyboard navigation, focus management, and state
        included. Browse{" "}
        <A href="/docs/authoring/machines">Statechart Machines</A> and the{" "}
        <A href="/components">Components catalog</A>.
      </>
    ),
  },
  {
    name: "5. Verification",
    badge: "editor & CI",
    description: (
      <>
        Lints check templates against your live brand while you edit, the
        build refuses what cannot render, and the same guards run in CI. See{" "}
        <A href="/docs/tooling/lints">Lints &amp; Guardrails</A>.
      </>
    ),
  },
];

const ownershipStaircase = (): readonly PropEntry[] => [
  {
    name: "Step 1 — Pick a variant (.primary, .secondary, .ghost, .danger)",
    badge: "One control",
    description: (
      <>
        Change emphasis on a <code>&lt;button&gt;</code>,{" "}
        <code>&lt;badge&gt;</code>, or <code>&lt;alert&gt;</code> with the
        element's built-in variants instead of re-styling it by hand.
      </>
    ),
  },
  {
    name: "Step 2 — Clear the skin with .bare",
    badge: "Custom chrome",
    description: (
      <>
        Need <code>&lt;button&gt;</code> semantics and keyboard behavior for a
        custom swatch tile or navigation row, without default control chrome?
        Add <code>class="bare"</code> and compose utilities freely on the
        cleared surface.
      </>
    ),
  },
  {
    name: "Step 3 — Change it once, in the Studio or your brand files",
    badge: "Every screen",
    description: (
      <>
        Want every <code>&lt;button&gt;</code> to wear pill corners, or every{" "}
        <code>&lt;h1&gt;</code> to speak a different type voice? Make the change
        once in the Studio and every screen updates together. See{" "}
        <A href="/docs/themes/customization">Brand Files</A>.
      </>
    ),
  },
  {
    name: "Step 4 — Adopt one element at a time",
    badge: "Migration",
    description: (
      <>
        Migrating an app that already styles bare HTML tags? Tell the plugin
        which elements Spin owns so far, and claim the rest as you go.
      </>
    ),
  },
];
export default function Architecture(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="How Spin Works"
        lede="Your brand tokens, finished HTML elements, layout utilities, and interactive components — and which layer to change when the design moves."
      />

      <Section id="layers" title="The five layers">
        <PropList items={layerItems()} />
      </Section>

      <Section
        id="ownership"
        title="Why elements arrive styled (and how to change them)"
      >
        <p class="max-w-prose">
          When a framework leaves <code>&lt;button&gt;</code> or{" "}
          <code>&lt;h2&gt;</code> unstyled, every template has to carry the
          control's padding, border, radius, focus ring, and typography inline.
          In Spin, the element owns its appearance and utilities own placement
          around it (<code>mt-4</code>, <code>w-full</code>). Restyling one
          button at its callsite forks your design system silently — so the
          lints refuse, and the staircase below shows the honest path whenever
          an element needs a different look:
        </p>
        <div class="mt-3">
          <PropList items={ownershipStaircase()} />
        </div>
        <div class="my-3">
          <Code
            lang="html"
            title="Variants, .bare semantics, and layout utilities working together"
            code={`<!-- 1. Variant + layout placement on a styled <button> -->
<button type="button" class="primary w-full">Save changes</button>

<!-- 2. .bare releases the button skin for a custom swatch trigger -->
<button type="button" class="bare flex w-full items-center justify-between rounded-md border bg-surface-raised p-3">
  <span>Primary ink</span>
  <span class="type-code text-muted">#2563eb</span>
</button>`}
          />
        </div>
      </Section>

      <Section id="flow" title="How a change flows through Spin">
        <p class="max-w-prose">
          Your brand directory is the single source of truth. Elements and
          utilities read it as CSS variables; a class your brand cannot produce
          emits nothing. Components read the same brand while adding keyboard,
          focus, and interaction behavior. Checks verify the brand stays
          complete and legible, and lints verify your templates against the
          brand you shaped.
        </p>
      </Section>
    </main>
  );
}
