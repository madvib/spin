/**
 * Architecture & Layers: which layer owns each decision and which gate verifies it.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Section } from "../../../bits.tsx";
import { PageHeader, PropList, type PropEntry } from "../../../ui/index.ts";

const layerItems = (): readonly PropEntry[] => [
  {
    name: "1. Theme (spin/*.json)",
    badge: "themeGates",
    description: (
      <>
        Owns every visual value: palette, typography scale, spacing steps,
        radii, shadows, and motion curves. Verified at build time by the six
        contract gates in <A href="/docs/themes/validation">Validation</A>.
      </>
    ),
  },
  {
    name: "2. Closed-Scale Utilities (spin/styles.css)",
    badge: "spin lint",
    description: (
      <>
        Handles layout and composition using only steps declared in your theme (
        <code>stack</code>, <code>row</code>, <code>split</code>,{" "}
        <code>p-4</code>, <code>gap-2</code>). Unrecognized classes and
        arbitrary brackets emit zero CSS and fail <code>spin lint</code>. See{" "}
        <A href="/docs/styling/utilities">Utilities &amp; Animations</A>.
      </>
    ),
  },
  {
    name: "3. Elements (primitives)",
    badge: "classless: true",
    description: (
      <>
        Styles native HTML tags (<code>&lt;button&gt;</code>,{" "}
        <code>&lt;input&gt;</code>, <code>&lt;dialog&gt;</code>,{" "}
        <code>&lt;table&gt;</code>) and Spin elements (<code>&lt;card&gt;</code>
        , <code>&lt;badge&gt;</code>, <code>&lt;alert&gt;</code>) from theme CSS
        variables. Enabled by default (<code>classless: true</code>), or opt-in
        by class with <code>classless: false</code>. Explore{" "}
        <A href="/docs/styling/elements">Classless Elements</A>.
      </>
    ),
  },
  {
    name: "4. Interactive Components (@spinjs/components)",
    badge: "lib/components/",
    description: (
      <>
        Headless state machines paired with copyable <code>.html</code>{" "}
        templates that compile into custom elements with ARIA attributes,
        keyboard navigation, and focus management. Browse the{" "}
        <A href="/components">Components catalog</A>.
      </>
    ),
  },
  {
    name: "5. Verification (spin lint & spin check)",
    badge: "CI & MCP",
    description: (
      <>
        <code>spin lint</code> checks templates and themes statically, while{" "}
        <code>spin check</code> drives a real browser across your routes and
        modes to verify contrast, hit targets, and clipping. See{" "}
        <A href="/docs/tooling/check">Browser Checks</A>.
      </>
    ),
  },
];

export default function Architecture(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Architecture & Layers"
        lede="How Spin turns a theme file into a verified UI — from design tokens and utilities up through elements, interactive components, and automated checks."
      />

      <Section id="layers" title="Ownership & verification by layer">
        <PropList items={layerItems()} />
      </Section>

      <Section id="flow" title="How a change flows through Spin">
        <p class="max-w-prose">
          The theme is the single source of truth. Utilities and native
          elements read it through CSS custom properties; a class outside the
          vocabulary emits no CSS. Machine components read the same tokens
          while adding keyboard, focus, and statechart behavior. Source lints
          verify your templates against the active theme, and browser checks
          verify the rendered geometry.
        </p>
      </Section>
    </main>
  );
}
