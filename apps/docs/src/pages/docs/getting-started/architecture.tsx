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
    name: "2. Classless Elements (@spinjs/spin/preset)",
    badge: "prefer-theme-value",
    description: (
      <>
        Styles native HTML tags (<code>&lt;button&gt;</code>,{" "}
        <code>&lt;input&gt;</code>, <code>&lt;dialog&gt;</code>,{" "}
        <code>&lt;table&gt;</code>) and Spin custom elements directly from theme
        CSS variables. Explore{" "}
        <A href="/docs/styling/elements">Classless Elements</A>.
      </>
    ),
  },
  {
    name: "3. Closed-Scale Utilities (uno.css)",
    badge: "spin lint",
    description: (
      <>
        Handles layout and composition using only steps declared in your theme.
        Unrecognized classes and arbitrary brackets emit zero CSS and are
        flagged by <code>spin lint</code>. See{" "}
        <A href="/docs/styling/utilities">Utilities &amp; Animations</A>.
      </>
    ),
  },
  {
    name: "4. State Machines (@spinjs/components)",
    badge: "machine tests",
    description: (
      <>
        Headless statecharts that wire ARIA attributes, keyboard navigation,
        and focus management into your markup. Browse the{" "}
        <A href="/components">Components catalog</A>.
      </>
    ),
  },
  {
    name: "5. Rendered Verification (spin check)",
    badge: "spin check",
    description: (
      <>
        Drives a real browser against your routes and themes to verify
        contrast, hit targets, and clipping. See{" "}
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
        lede="One theme feeds CSS variables; elements and utilities spend those variables; state machines add interactive behavior without owning styles."
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
