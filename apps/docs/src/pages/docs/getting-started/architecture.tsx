/**
 * Architecture & Layers: which layer owns each decision and which gate verifies it.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";

const layerItems = (): readonly PropEntry[] => [
  {
    name: "1. Brand & Theme (spin/<brand>/)",
    badge: "themeGates",
    description: (
      <>
        Owns every visual value: starting design language (<code>$extends</code>),
        palette roles and paired <code>on-*</code> inks, 13 named{" "}
        <code>font.style.*</code> tuples, spacing steps, radii, shadows, and
        motion curves. Verified at build time by the contract gates in{" "}
        <A href="/docs/themes/validation">Validation</A>.
      </>
    ),
  },
  {
    name: "2. Primitives (Intrinsic HTML & Spin Elements)",
    badge: "spin/prefer-theme-value",
    description: (
      <>
        Claims native HTML tags (<code>&lt;button&gt;</code>,{" "}
        <code>&lt;input&gt;</code>, <code>&lt;select&gt;</code>,{" "}
        <code>&lt;dialog&gt;</code>, <code>&lt;table&gt;</code>,{" "}
        <code>&lt;h1&gt;</code>–<code>&lt;p&gt;</code>) and Spin elements (
        <code>&lt;card&gt;</code>, <code>&lt;badge&gt;</code>,{" "}
        <code>&lt;alert&gt;</code>). Elements own their skin and typography —
        write <code>&lt;button class="primary"&gt;</code> and get a finished
        control. Explore <A href="/docs/styling/elements">Primitives</A>.
      </>
    ),
  },
  {
    name: "3. Closed-Scale Utilities & Shortcuts (spin/styles.css)",
    badge: "spin/closed-vocabulary",
    description: (
      <>
        Arranges layout and placement between elements (<code>flex</code>,{" "}
        <code>grid</code>, <code>gap-4</code>, <code>p-6</code>) and styles
        unowned <code>&lt;div&gt;</code> or <code>&lt;span&gt;</code> containers
        using only steps declared in your theme. Repeated compositions live in{" "}
        <code>spin.vite({"{"} shortcuts {"}"})</code>. See{" "}
        <A href="/docs/styling/tailwind">Spin vs Tailwind</A> and{" "}
        <A href="/docs/styling/utilities">Shortcuts &amp; Compositions</A>.
      </>
    ),
  },
  {
    name: "4. Machine Components (@spinjs/components)",
    badge: "src/lib/components/",
    description: (
      <>
        Headless finite-state machines paired with copyable <code>.html</code>{" "}
        templates that compile into custom elements with ARIA attributes,
        keyboard navigation, and focus management. Browse{" "}
        <A href="/docs/authoring/machines">Machines</A> and the{" "}
        <A href="/components">Components catalog</A>.
      </>
    ),
  },
  {
    name: "5. Verification (spin lint)",
    badge: "CI & MCP",
    description: (
      <>
        <code>spin lint</code> verifies templates and theme layers statically:
        closed vocabulary, theme-value ownership, and paired inks. See{" "}
        <A href="/docs/tooling/lints">Lints &amp; Diagnostics</A>.
      </>
    ),
  },
];

const ownershipStaircase = (): readonly PropEntry[] => [
  {
    name: "Step 1 — Pick a variant (.primary, .secondary, .outline, .ghost, .danger, .s-sm, .s-lg)",
    badge: "Callsite",
    description: (
      <>
        Change emphasis or size on <code>&lt;button&gt;</code>,{" "}
        <code>&lt;badge&gt;</code>, <code>&lt;alert&gt;</code>, or{" "}
        <code>&lt;card&gt;</code> with the element's built-in variants instead
        of utility overrides.
      </>
    ),
  },
  {
    name: "Step 2 — Clear the skin with .bare (or .ghost / .card-ghost)",
    badge: "Unstyled semantics",
    description: (
      <>
        Need <code>&lt;button&gt;</code> or <code>&lt;input&gt;</code> semantics
        and keyboard behavior for a custom swatch tile, combobox input, or
        navigation row without default control chrome? Add{" "}
        <code>class="bare"</code>. The element's visual skin clears to zero and{" "}
        <code>spin/prefer-theme-value</code> stands down so you can compose
        utilities freely.
      </>
    ),
  },
  {
    name: "Step 3 — Change the token in spin/<brand>/ (elements.json & primitives/*.json)",
    badge: "System-wide",
    description: (
      <>
        Want every <code>&lt;button&gt;</code> to wear pill corners or{" "}
        <code>&lt;h1&gt;</code> to use a different type style? Edit{" "}
        <code>button.radius</code> in{" "}
        <code>spin/&lt;brand&gt;/primitives/button.json</code> or{" "}
        <code>element.h1.type</code> in{" "}
        <code>spin/&lt;brand&gt;/elements.json</code> (or tune them live in the
        Studio). See <A href="/docs/themes/customization">Layers &amp; Overrides</A>.
      </>
    ),
  },
  {
    name: "Step 4 — Adopt incrementally (primitives: [\"button\", \"card\"])",
    badge: "Migration",
    description: (
      <>
        Migrating an existing app that already styles bare HTML tags? Pass{" "}
        <code>primitives: ["button", "card"]</code> to <code>spin.vite()</code>{" "}
        so Spin only claims and lints the elements you have opted into so far.
      </>
    ),
  },
];
export default function Architecture(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Ownership"
        lede="Which layer owns each visual or behavioral change, why the lints refuse callsite overrides, and the four-step customization staircase."
      />

      <Section id="layers" title="Ownership by layer">
        <PropList items={layerItems()} />
      </Section>

      <Section
        id="ownership"
        title="Why Spin claims HTML elements (and how to customize them)"
      >
        <p class="max-w-prose">
          When a framework leaves <code>&lt;button&gt;</code> or{" "}
          <code>&lt;h2&gt;</code> unstyled, every template has to carry the
          control's padding, border, radius, focus ring, and typography inline.
          In Spin, the element rule owns the control's appearance and utilities
          own placement around it (<code>mt-4</code>, <code>w-full</code>,{" "}
          <code>self-end</code>). Putting <code>px-4 rounded-lg type-display</code>{" "}
          on a styled <code>&lt;button&gt;</code> triggers{" "}
          <code>spin/prefer-theme-value</code> because restyling one button at a
          callsite silently forks your design system. Follow the four-step
          staircase whenever an element needs a different look:
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
          Your brand directory (<code>spin/&lt;brand&gt;/</code>) is the single
          source of truth. Utilities and intrinsic HTML elements read it through
          CSS custom properties; a class outside the vocabulary emits no CSS.
          Machine components read the same tokens while adding keyboard, focus,
          and statechart behavior. Source lints verify your templates against
          the active theme, and browser checks verify the rendered geometry.
        </p>
      </Section>
    </main>
  );
}
