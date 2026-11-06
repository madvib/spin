/**
 * Primitives guide (Stage D2): bare-tag primitives, measured atomic CSS
 * bundle sizes, variants vs. component tokens and the three-step staircase,
 * the four markup promises with live diagnostics, and incremental adoption.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import type { JSX } from "solid-js";
import {
  Code,
  PageHeader,
  PropList,
  Section,
  Specimen,
  starterDoc,
  type PropEntry,
} from "../../../ui/index.ts";

const BUTTONS_ROW_SNIPPET = `<div class="flex flex-wrap items-center gap-2">
  <button type="button" class="primary">Save changes</button>
  <button type="button">Neutral</button>
  <button type="button" class="secondary">Secondary</button>
  <button type="button" class="outline">Outline</button>
  <button type="button" class="ghost">Ghost</button>
  <button type="button" class="danger">Delete</button>
</div>`;

const CARD_ANATOMY_SNIPPET = `<card>
  <card-header>
    <card-title>Alert routing</card-title>
    <card-description>Notify on-call engineers when error budgets burn.</card-description>
    <card-action>
      <badge variant="success">Active</badge>
    </card-action>
  </card-header>
  <card-content class="flex flex-col gap-2">
    <label for="oncall-channel">Escalation channel</label>
    <input id="oncall-channel" type="text" value="#incidents-primary" />
    <label for="webhook-url">Webhook endpoint</label>
    <field>
      <span class="i-lucide-webhook icon-sm" aria-hidden="true"></span>
      <input id="webhook-url" type="url" placeholder="https://hooks.acme.dev/incidents" />
    </field>
  </card-content>
  <card-footer class="justify-end">
    <button type="button" class="ghost">Cancel</button>
    <button type="button" class="primary">Save rule</button>
  </card-footer>
</card>`;

const VARIANTS_SNIPPET = `<div class="flex flex-wrap items-center gap-2">
  <button type="button" class="primary s-sm">Small primary (.s-sm)</button>
  <button type="button" class="primary">Default primary</button>
  <button type="button" class="primary s-lg">Large primary (.s-lg)</button>
  <button type="button" class="ghost">Ghost (.ghost)</button>
  <button type="button" class="danger">Delete (.danger)</button>
  <button type="button" class="bare inline-flex items-center gap-1">
    <span>Chrome-free (.bare)</span>
  </button>
</div>`;

const LISTS_SNIPPET = `<!-- Long-form article or Markdown container -->
<prose>
  <h2>Incident postmortem</h2>
  <p>
    Traffic shifted away from <code>us-east-1</code> within 40 seconds. Follow-up
    actions before the next release window:
  </p>
  <ul>
    <li>Lower health-check interval to 5 seconds</li>
    <li>Pin canary error budget in <code>spin/default.json</code></li>
  </ul>
</prose>

<!-- Horizontal navigation list outside <prose>: use row-list -->
<nav aria-label="Primary">
  <ul class="row-list gap-4">
    <li><a href="/overview">Overview</a></li>
    <li><a href="/deployments">Deployments</a></li>
    <li><a href="/settings">Settings</a></li>
  </ul>
</nav>`;

const LIST_PATTERNS: readonly PropEntry[] = [
  {
    name: "Bare <ul> / <ol>",
    badge: "reset layer",
    description: (
      <>
        Reset to <code>margin: 0; padding: 0; list-style: none</code> in the
        base stylesheet so navigation rails, menus, comboboxes, and tab bars
        never have to strip browser bullets or indentation.
      </>
    ),
  },
  {
    name: "<prose> <ul> / <ol>",
    badge: "document lists",
    description: (
      <>
        Inside <code>&lt;prose&gt;</code> (or <code>.prose</code>),{" "}
        <code>&lt;ul&gt;</code> restores <code>list-style-type: disc</code> and{" "}
        <code>&lt;ol&gt;</code> restores <code>list-style-type: decimal</code>{" "}
        with inline-start padding and item spacing.
      </>
    ),
  },
  {
    name: "class=\"row-list\"",
    badge: "horizontal list",
    description: (
      <>
        Expands to a horizontal flex row (<code>display: flex; align-items: center; list-style-type: none; margin: 0; padding: 0</code>) and zeroes{" "}
        <code>li + li</code> top margin so the first item and subsequent items
        align on the exact same baseline. Use on horizontal navs,
        breadcrumbs, and steppers.
      </>
    ),
  },
  {
    name: "class=\"flow-list\"",
    badge: "vertical list",
    description: (
      <>
        Vertical list with markers and indentation off and theme-spaced{" "}
        <code>li + li</code> block gaps. Use for stacked sidebar links, feeds,
        and settings lists outside <code>&lt;prose&gt;</code>.
      </>
    ),
  },
];

const INCREMENTAL_ADOPTION_SNIPPET = `// vite.config.ts
import { defineConfig } from "vite";
import { spin } from "@spinjs/spin/vite";

export default defineConfig({
  plugins: [
    spin.vite({
      // Opt in to specific primitives while migrating an existing app:
      primitives: ["button", "card", "field"],
    }),
  ],
});`;

interface BundleComparisonRow {
  readonly workload: JSX.Element;
  readonly spinRules: string;
  readonly daisyRules: string;
  readonly spinFull: string;
  readonly daisyFull: string;
}

const BUNDLE_ROWS: readonly BundleComparisonRow[] = [
  {
    workload: (
      <>
        Single <code>&lt;card&gt;</code> vs <code>.card</code> +{" "}
        <code>.card-body</code>
      </>
    ),
    spinRules: "0.33 kB min (0.20 kB gz)",
    daisyRules: "4.70 kB min (1.54 kB gz)",
    spinFull: "14.80 kB min (2.67 kB gz)",
    daisyFull: "12.68 kB min (3.26 kB gz)",
  },
  {
    workload: (
      <>
        3 controls (<code>button</code> + <code>card</code> +{" "}
        <code>input</code>)
      </>
    ),
    spinRules: "8.09 kB min (1.60 kB gz)",
    daisyRules: "18.40 kB min (3.49 kB gz)",
    spinFull: "22.56 kB min (3.97 kB gz)",
    daisyFull: "26.37 kB min (5.09 kB gz)",
  },
  {
    workload: <>All 22 shared primitives (base markup)</>,
    spinRules: "23.65 kB min (4.02 kB gz)",
    daisyRules: "75.67 kB min (10.03 kB gz)",
    spinFull: "38.12 kB min (6.27 kB gz)",
    daisyFull: "83.64 kB min (11.62 kB gz)",
  },
];

interface PromiseExhibit {
  readonly title: string;
  readonly summary: JSX.Element;
  readonly rule: string;
  readonly flaggedCode: string;
  readonly diagnostic: string;
  readonly remedyCode: string;
  readonly renderLive: () => JSX.Element;
}

const PROMISE_EXHIBITS: readonly PromiseExhibit[] = [
  {
    title: "1. Elements arrive with their look decided",
    summary: (
      <>
        Write <code>&lt;button&gt;</code> or <code>&lt;h1&gt;</code> and its
        default weight, size, and surface are already set; restating the same
        value in a utility class adds noise without changing a pixel, so{" "}
        <code>spin/no-redundant-class</code> flags the duplicate class and
        removes it on <code>--fix</code>.
      </>
    ),
    rule: "spin/no-redundant-class",
    flaggedCode: `<p class="type-body">Release notes for v4.12.0</p>`,
    diagnostic:
      "`type-body` sets `font-family, font-size, font-weight, letter-spacing, line-height` to what `<p>` already sets. Drop the class. (Remedy: Drop `type-body`)",
    remedyCode: `<p>Release notes for v4.12.0</p>`,
    renderLive: () => <p>Release notes for v4.12.0</p>,
  },
  {
    title: "2. Recurring look changes belong to variants or the theme",
    summary: (
      <>
        Change how a control is painted or sized by choosing one of its
        variants (<code>.primary</code>, <code>.ghost</code>,{" "}
        <code>.danger</code>, <code>.s-sm</code>, <code>.s-lg</code>) or by
        updating its tokens in <code>spin/&lt;name&gt;.json</code>; when a
        utility class overrides an element&apos;s fill, size, or typography for
        a one-off, <code>spin/prefer-theme-value</code> flags the collision and
        names the variants or theme value to use instead.
      </>
    ),
    rule: "spin/prefer-theme-value",
    flaggedCode: `<button type="button" class="bg-accent text-on-accent">Publish</button>`,
    diagnostic:
      "`<button>` sets its own fill; `bg-accent` fights it. Use a variant (`primary`, `secondary`, `outline`, `ghost`, `contrast`, `danger`, or `bare`) or the theme's value.",
    remedyCode: `<button type="button" class="primary">Publish</button>`,
    renderLive: () => (
      <button type="button" class="primary">
        Publish
      </button>
    ),
  },
  {
    title: "3. Semantic tags carry the typography the theme gave them",
    summary: (
      <>
        Reach for <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code>,{" "}
        <code>&lt;p&gt;</code>, or <code>&lt;code&gt;</code> when text plays
        that role on the page rather than styling a <code>&lt;div&gt;</code> to
        imitate one; when an unstyled box reaches for a named style that
        belongs to a heading,{" "}
        <code>spin/prefer-element</code> names the tag to write instead, and a
        named style attaches anywhere without drawing that warning.
      </>
    ),
    rule: "spin/prefer-element",
    flaggedCode: `<div class="type-display">Incident summary</div>`,
    diagnostic:
      "the theme gives `<h1>` that style; `<div>` is not the element that carries it. Put the class on `<h1>`.",
    remedyCode: `<h1>Incident summary</h1>`,
    renderLive: () => <h1>Incident summary</h1>,
  },
  {
    title: "4. Layout is free, look is owned",
    summary: (
      <>
        Position, align, and space primitives freely with layout utilities (
        <code>flex</code>, <code>grid</code>, <code>items-center</code>,{" "}
        <code>justify-between</code>, <code>gap-3</code>, <code>w-full</code>,{" "}
        <code>mt-4</code>) — where an element sits on the page is always your
        template&apos;s call, while how the control itself is painted and typed
        stays with the primitive and your theme.
      </>
    ),
    rule: "0 findings",
    flaggedCode: `<card-footer class="justify-end">
  <button type="button" class="ghost">Inspect</button>
  <button type="button" class="primary">Promote</button>
</card-footer>`,
    diagnostic:
      "Clean — `justify-end` places the actions inside `<card-footer>` without touching the card or button look.",
    remedyCode: `<card>
  <card-content class="flex flex-wrap items-center justify-between gap-3">
    <strong>Production traffic</strong>
    <badge variant="success">Healthy</badge>
  </card-content>
  <card-footer class="justify-end">
    <button type="button" class="ghost">Inspect</button>
    <button type="button" class="primary">Promote</button>
  </card-footer>
</card>`,
    renderLive: () => (
      <card>
        <card-content class="flex flex-wrap items-center justify-between gap-3">
          <strong>Production traffic</strong>
          <badge variant="success">Healthy</badge>
        </card-content>
        <card-footer class="justify-end">
          <button type="button" class="ghost">
            Inspect
          </button>
          <button type="button" class="primary">
            Promote
          </button>
        </card-footer>
      </card>
    ),
  },
];

function readComponentToken(
  group: string,
  step: string,
  fallbackGroup: string,
  fallbackStep: string,
  defaultLiteral: string,
): string {
  const doc = starterDoc() as Record<string, unknown>;
  const primaryTable = doc[group] as
    | Record<string, { $value?: unknown }>
    | undefined;
  const direct = primaryTable?.[step]?.$value;
  if (typeof direct === "string" || typeof direct === "number") {
    return String(direct);
  }
  const fallbackTable = doc[fallbackGroup] as
    | Record<string, { $value?: unknown }>
    | undefined;
  const fb = fallbackTable?.[fallbackStep]?.$value;
  if (typeof fb === "string" || typeof fb === "number") {
    return String(fb);
  }
  return defaultLiteral;
}

function readStyleToken(
  style: string,
  field: string,
  fallbackGroup: string,
  fallbackStep: string,
  defaultLiteral: string,
): string {
  const doc = starterDoc() as Record<string, unknown>;
  const font = doc["font"] as Record<string, unknown> | undefined;
  const styles = font?.["style"] as
    | Record<string, Record<string, { $value?: unknown }>>
    | undefined;
  const direct = styles?.[style]?.[field]?.$value;
  if (typeof direct === "string" || typeof direct === "number") {
    return String(direct);
  }
  const fallbackTable = font?.[fallbackGroup] as
    | Record<string, { $value?: unknown }>
    | undefined;
  const fb = fallbackTable?.[fallbackStep]?.$value;
  if (typeof fb === "string" || typeof fb === "number") {
    return String(fb);
  }
  return defaultLiteral;
}

export default function StylingElements(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Classless Elements"
        lede="What are primitives and how do I build with them? Write semantic HTML tags and Spin custom elements — <button>, <card>, <input> — and get finished controls that agree across your page. Ship only the rules your markup actually uses, adjust emphasis with variants or customize the component's own tokens in your theme, and adopt one element at a time."
      />

      <Section id="tags-arrive-finished" title="Tags arrive finished">
        <p class="max-w-prose">
          Write <code>&lt;button&gt;</code>, <code>&lt;card&gt;</code>, or{" "}
          <code>&lt;input&gt;</code> directly in your template and get a
          finished control with its padding, border, corner radius, focus ring,
          and interactive states already in place. Because your theme decides
          how a control looks once in <code>spin/&lt;name&gt;.json</code>,
          every <code>&lt;button&gt;</code>, <code>&lt;card&gt;</code>, and{" "}
          <code>&lt;input&gt;</code> across your application agrees without a
          utility list repeated on every tag. Switch starter themes or toggle
          light and dark mode in the top bar to see the live controls below
          update together:
        </p>

        <div class="my-2 flex flex-col gap-4">
          <Specimen
            title="Button variants row"
            code={BUTTONS_ROW_SNIPPET}
            preview={
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" class="primary">
                  Save changes
                </button>
                <button type="button">Neutral</button>
                <button type="button" class="secondary">
                  Secondary
                </button>
                <button type="button" class="outline">
                  Outline
                </button>
                <button type="button" class="ghost">
                  Ghost
                </button>
                <button type="button" class="danger">
                  Delete
                </button>
              </div>
            }
          />

          <Specimen
            title="Card anatomy with field and input"
            code={CARD_ANATOMY_SNIPPET}
            preview={
              <card>
                <card-header>
                  <card-title>Alert routing</card-title>
                  <card-description>
                    Notify on-call engineers when error budgets burn.
                  </card-description>
                  <card-action>
                    <badge variant="success">Active</badge>
                  </card-action>
                </card-header>
                <card-content class="flex flex-col gap-2">
                  <label for="demo-oncall-channel">Escalation channel</label>
                  <input
                    id="demo-oncall-channel"
                    type="text"
                    value="#incidents-primary"
                  />
                  <label for="demo-webhook-url">Webhook endpoint</label>
                  <field>
                    <span
                      class="i-lucide-webhook icon-sm"
                      aria-hidden="true"
                    />
                    <input
                      id="demo-webhook-url"
                      type="url"
                      placeholder="https://hooks.acme.dev/incidents"
                    />
                  </field>
                </card-content>
                <card-footer class="justify-end">
                  <button type="button" class="ghost">
                    Cancel
                  </button>
                  <button type="button" class="primary">
                    Save rule
                  </button>
                </card-footer>
              </card>
            }
          />
        </div>

        <p class="max-w-prose">
          Compose <code>&lt;card&gt;</code> with{" "}
          <code>&lt;card-header&gt;</code>, <code>&lt;card-title&gt;</code>,{" "}
          <code>&lt;card-description&gt;</code>,{" "}
          <code>&lt;card-action&gt;</code>, <code>&lt;card-content&gt;</code>,{" "}
          <code>&lt;card-footer&gt;</code>, and{" "}
          <code>&lt;card-figure&gt;</code> when a surface needs structured
          regions, or wrap an <code>&lt;input&gt;</code> and an inline icon
          inside <code>&lt;field&gt;</code> so the outer box carries the single
          border and focus ring instead of drawing a box inside a box. Every
          primitive tag is registered in <code>src/spin-components.d.ts</code>{" "}
          when your bundler runs <code>spin.vite()</code>, so TypeScript and
          JSX autocomplete <code>&lt;card&gt;</code>,{" "}
          <code>&lt;field&gt;</code>, <code>&lt;badge&gt;</code>, and{" "}
          <code>&lt;alert&gt;</code> alongside native HTML elements (browse all
          28 primitives in the{" "}
          <A href="/components?kind=elements">Components catalog</A>).
        </p>
      </Section>

      <Section id="atomic-css" title="Atomic CSS: you ship what you use">
        <p class="max-w-prose">
          Use <code>&lt;card&gt;</code> on a page without{" "}
          <code>&lt;card-footer&gt;</code> or <code>&lt;card-figure&gt;</code>{" "}
          and your stylesheet emits <code>326 B</code> minified (
          <code>200 B</code> gzipped) for <code>&lt;card&gt;</code> alone —
          unused child tags and variants emit zero bytes because each primitive
          tag, child part, and variant class is an independent atomic rule
          generated on demand by UnoCSS. Across the 3-control slice above (
          <code>&lt;button class=&quot;primary&quot;&gt;</code>,{" "}
          <code>&lt;card&gt;</code> with <code>&lt;card-header&gt;</code>,{" "}
          <code>&lt;card-title&gt;</code>, and{" "}
          <code>&lt;card-content&gt;</code>, and <code>&lt;input&gt;</code>)
          and across the 22 components shared by both libraries (
          <code>alert</code>, <code>badge</code>, <code>breadcrumbs</code>,{" "}
          <code>button</code>, <code>card</code>, <code>checkbox</code>,{" "}
          <code>details</code>/<code>collapse</code>, <code>dialog</code>/
          <code>modal</code>, <code>field</code>/<code>input</code>+
          <code>textarea</code>+<code>select</code>, <code>fieldset</code>,{" "}
          <code>hr</code>/<code>divider</code>, <code>join</code>,{" "}
          <code>kbd</code>, <code>label</code>, <code>progress</code>,{" "}
          <code>radio</code>, <code>range</code>, <code>skeleton</code>,{" "}
          <code>stat</code>, <code>switch</code>/<code>toggle</code>,{" "}
          <code>table</code>, and <code>tooltip</code>), compiling equivalent
          markup against <code>@spinjs/spin</code> (
          <code>starterThemes.spin</code>) versus daisyUI <code>5.7.50</code>{" "}
          on <code>@tailwindcss/node</code> <code>4.3.2</code> measures as
          follows (on an empty page with zero components, Spin&apos;s reset,
          light/dark token variables, and base document typography start at{" "}
          <code>14.47 kB</code> minified / <code>2.55 kB</code> gzipped versus
          daisyUI&apos;s <code>10.56 kB</code> minified / <code>2.76 kB</code>{" "}
          gzipped):
        </p>

        <div class="my-2 overflow-x-auto rounded-lg border bg-surface">
          <table>
            <thead>
              <tr>
                <th>Workload</th>
                <th>Spin (rules only)</th>
                <th>daisyUI 5.7.50 (rules only)</th>
                <th>Spin (full sheet)</th>
                <th>daisyUI 5.7.50 (full sheet)</th>
              </tr>
            </thead>
            <tbody>
              <For each={BUNDLE_ROWS}>
                {(row) => (
                  <tr>
                    <td>{row.workload}</td>
                    <td>
                      <code>{row.spinRules}</code>
                    </td>
                    <td>
                      <code>{row.daisyRules}</code>
                    </td>
                    <td>
                      <code>{row.spinFull}</code>
                    </td>
                    <td>
                      <code>{row.daisyFull}</code>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="variants-and-tokens"
        title="Variants change paint; tokens customize your component"
      >
        <p class="max-w-prose">
          Add <code>.primary</code>, <code>.secondary</code>,{" "}
          <code>.outline</code>, <code>.ghost</code>, <code>.contrast</code>,
          or <code>.danger</code> (or <code>variant=&quot;primary&quot;</code>{" "}
          on elements like <code>&lt;badge&gt;</code> and{" "}
          <code>&lt;alert&gt;</code>) when one instance on the page needs a
          different emphasis or status tone, and add <code>.s-sm</code> or{" "}
          <code>.s-lg</code> when a control needs a compact or prominent size.
          When a custom trigger — a tab chip, a disclosure header, or an inline
          command button — needs native <code>&lt;button&gt;</code> semantics
          and keyboard focus without wearing button chrome, add{" "}
          <code>.bare</code> to strip the fill, border, radius, shadow, and
          minimum height (see{" "}
          <A href="/docs/styling/space#bare-escape">The bare escape</A>):
        </p>

        <div class="my-2">
          <Specimen
            title="Emphasis variants, sizes, and bare"
            code={VARIANTS_SNIPPET}
            preview={
              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" class="primary s-sm">
                    Small primary (.s-sm)
                  </button>
                  <button type="button" class="primary">
                    Default primary
                  </button>
                  <button type="button" class="primary s-lg">
                    Large primary (.s-lg)
                  </button>
                  <button type="button" class="ghost">
                    Ghost (.ghost)
                  </button>
                  <button type="button" class="danger">
                    Delete (.danger)
                  </button>
                  <button
                    type="button"
                    class="bare inline-flex items-center gap-1"
                  >
                    <span>Chrome-free (.bare)</span>
                  </button>
                </div>
                <div class="flex flex-col gap-2 border-t pt-3">
                  <small>
                    Active starter component tokens on <code>&lt;button&gt;</code>{" "}
                    and <code>&lt;card&gt;</code>:
                  </small>
                  <div class="flex flex-wrap items-center gap-2">
                    <code>
                      button.radius ={" "}
                      {readComponentToken(
                        "button",
                        "radius",
                        "radius",
                        "md",
                        "0.375rem",
                      )}
                    </code>
                    <code>
                      label.weight ={" "}
                      {readStyleToken("label", "weight", "weight", "medium", "500")}
                    </code>
                    <code>
                      card.radius ={" "}
                      {readComponentToken(
                        "card",
                        "radius",
                        "radius",
                        "lg",
                        "0.5rem",
                      )}
                    </code>
                  </div>
                </div>
              </div>
            }
          />
        </div>

        <p class="max-w-prose">
          Reach for a variant when one button on a screen plays a different
          role; reach for component tokens in{" "}
          <code>spin/&lt;name&gt;.json</code> (<code>button.radius</code>,{" "}
          <code>button.shadow</code>, <code>card.radius</code>,{" "}
          <code>card.padding</code>, <code>field.radius</code>) when you want
          to change what <em>your</em> button, card, or field looks like
          everywhere (see{" "}
          <A href="/docs/themes/customization#elements">Theme Customization</A>{" "}
          and{" "}
          <A href="/docs/themes/reference#elements">
            Per-Element Token Overrides
          </A>
          ). Every UI surface in Spin climbs one three-step staircase so no
          layer pretends the others don&apos;t exist: your{" "}
          <strong>theme</strong> (<code>spin/*.json</code>) sets the palette,
          scales, and per-element tokens; <strong>primitives</strong> (
          <code>&lt;button&gt;</code>, <code>&lt;card&gt;</code>,{" "}
          <code>&lt;input&gt;</code>, <code>&lt;field&gt;</code>) turn single
          HTML and custom tags into finished controls for static and native
          interactions; and when a widget needs multi-part state orchestration,
          keyboard navigation, and roving focus — a combobox, select, tabs,
          dialog, or menu — you <strong>vendor a state-machine component</strong>{" "}
          into <code>lib/components/</code> with{" "}
          <code>npx spin component copy &lt;name&gt; &lt;example&gt;</code> so
          you own its markup the same way shadcn/ui vendors templates while the
          theme and primitives still style every part inside it (see the{" "}
          <A href="/components">Components catalog</A>).
        </p>
      </Section>

      <Section
        id="promises"
        title="How the system reasons about your markup"
      >
        <p class="max-w-prose">
          Write markup against primitives and utilities and run{" "}
          <code>npx spin lint .</code> (documented in{" "}
          <A href="/docs/tooling/lints">Lints</A>) to verify four promises that
          keep your templates consistent across theme and mode switches:
        </p>

        <div class="my-2 flex flex-col gap-4">
          <For each={PROMISE_EXHIBITS}>
            {(item) => (
              <Specimen
                title={`${item.title} — ${item.rule}`}
                description={item.diagnostic}
                code={`<!-- Authored markup -->\n${item.flaggedCode}\n\n<!-- Remedy markup -->\n${item.remedyCode}`}
                preview={
                  <div class="flex flex-col gap-3">
                    <p class="max-w-prose">{item.summary}</p>
                    <div>{item.renderLive()}</div>
                  </div>
                }
              />
            )}
          </For>
        </div>
      </Section>

      <Section id="lists" title="Lists">
        <p class="max-w-prose">
          Most <code>&lt;ul&gt;</code> and <code>&lt;ol&gt;</code> elements in
          an application are UI chrome (menus, nav rails, steppers, combobox
          options), not bulleted prose. Spin resets bare lists to{" "}
          <code>list-style: none; margin: 0; padding: 0</code> by default,
          restores markers inside <code>&lt;prose&gt;</code>, and ships{" "}
          <code>row-list</code> and <code>flow-list</code> for structured UI
          lists:
        </p>
        <PropList items={LIST_PATTERNS} />
        <Code
          code={LISTS_SNIPPET}
          lang="html"
          title="Prose container vs. row-list navigation"
        />
      </Section>

      <Section id="incremental-adoption" title="Incremental adoption">
        <p class="max-w-prose">
          Pass <code>primitives: [...]</code> to <code>spin.vite()</code> (or{" "}
          <code>spinPreset()</code>) when introducing Spin into an existing
          application so only the element rules you name are active while you
          migrate screen by screen, or pass <code>primitives: false</code> for
          a utility-only stylesheet that keeps the reset and base document
          typography (<code>h1</code>–<code>h6</code>, <code>p</code>, lists,{" "}
          <code>blockquote</code>, <code>code</code>) without styling any
          control or container tags:
        </p>

        <div class="my-2">
          <Code
            code={INCREMENTAL_ADOPTION_SNIPPET}
            lang="ts"
            title="Narrowing active primitives in vite.config.ts"
          />
        </div>
      </Section>
    </main>
  );
}
