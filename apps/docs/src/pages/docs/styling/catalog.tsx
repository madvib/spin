/**
 * Utility Reference: structured grammar reference for every utility rule family
 * and the CSS declarations it emits. Token steps live on Token Reference;
 * this page links out instead of duplicating them.
 */
import { createMemo, createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { animationContract } from "@spinjs/spin/animation";
import { PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";

interface UtilityGroupSpec {
  readonly id: string;
  readonly title: string;
  readonly summary: JSX.Element;
  readonly rules: readonly PropEntry[];
}


function useReferenceGroups(): readonly UtilityGroupSpec[] {
  const groups: readonly UtilityGroupSpec[] = [
  {
    id: "layout",
    title: "Layout",
    summary:
      "Flexbox, CSS Grid, and the list layout utilities. Stacks and split bars are not utilities the preset ships — declare them in your project's shortcuts and read more on Utilities & Layout.",
    rules: [
      {
        name: "row-list / flow-list",
        badge: "list rules",
        description: (
          <>
            List layout utilities that strip <code>list-style</code>,{" "}
            <code>margin</code>, and <code>padding</code> while zeroing{" "}
            <code>li + li</code> block offset (<code>row-list</code>) or
            applying theme block rhythm (<code>flow-list</code>).
          </>
        ),
      },
      {
        name: "flex / inline-flex / grid / inline-grid / block / hidden",
        badge: "display",
        description: (
          <>
            Standard display, flex-direction (<code>flex-row</code>,{" "}
            <code>flex-col</code>, <code>flex-wrap</code>), alignment (
            <code>items-*</code>, <code>justify-*</code>, <code>self-*</code>),
            and grid column/span utilities (<code>grid-cols-1</code>–
            <code>grid-cols-12</code>, <code>col-span-*</code>).
          </>
        ),
      },
      {
        name: "project shortcuts (stack, row, split)",
        badge: "project vocabulary",
        description: (
          <>
            Not preset utilities — a project declares its own compositions
            in <code>spin.vite({"{"} shortcuts {"}"})</code> (the worked
            example lives on <A href="/docs/getting-started/install#config">Install</A>),
            and <code>spin/closed-vocabulary</code> flags any undeclared name.
          </>
        ),
      },
    ],
  },
  {
    id: "spacing",
    title: "Spacing (Padding, Margin & Gap)",
    summary: (
      <>
        Every spatial utility spends a step from your theme's{" "}
        <code>spacing.*</code> scale — the full step list lives on{" "}
        <A href="/docs/themes/reference#groups">Token Reference</A>.
      </>
    ),
    rules: [
      {
        name: "p-<step> / px-<step> / py-<step>",
        badge: "padding",
        description: (
          <>
            Sets all-side (<code>padding</code>), inline (
            <code>padding-inline</code>), or block (<code>padding-block</code>)
            padding to <code>var(--spacing-&lt;step&gt;)</code>.
          </>
        ),
      },
      {
        name: "pt-<step> / pr-<step> / pb-<step> / pl-<step> / ps-<step> / pe-<step>",
        badge: "directional padding",
        description: (
          <>
            Sets physical or logical side padding (
            <code>padding-inline-start</code> for <code>ps-*</code>,{" "}
            <code>padding-inline-end</code> for <code>pe-*</code>) to{" "}
            <code>var(--spacing-&lt;step&gt;)</code>.
          </>
        ),
      },
      {
        name: "m-<step> / mx-<step> / my-<step> / mt|mr|mb|ml|ms|me-<step>",
        badge: "margin",
        description: (
          <>
            Sets margin to <code>var(--spacing-&lt;step&gt;)</code> or{" "}
            <code>auto</code> (<code>mx-auto</code>, <code>ms-auto</code>).
            Supports negative steps (<code>-mt-&lt;step&gt;</code>).
          </>
        ),
      },
      {
        name: "gap-<step> / gap-x-<step> / gap-y-<step>",
        badge: "flex & grid gap",
        description: (
          <>
            Sets <code>gap</code>, <code>column-gap</code>, or{" "}
            <code>row-gap</code> to <code>var(--spacing-&lt;step&gt;)</code>.
          </>
        ),
      },
    ],
  },
  {
    id: "colors",
    title: "Colors (Backgrounds, Inks, Borders & Alpha)",
    summary: (
      <>
        Color utilities resolve against <code>color.*</code> roles in your
        theme and switch automatically under{" "}
        <code>[data-mode="dark"]</code> — the full role list lives on{" "}
        <A href="/docs/themes/reference#roles">Token Reference</A>.
      </>
    ),
    rules: [
      {
        name: "bg-<role> / bg-<role>/<0-100>",
        badge: "background-color",
        description: (
          <>
            Sets <code>background-color: var(--color-&lt;role&gt;)</code>. Adding
            an alpha percentage (<code>bg-surface/80</code>) emits{" "}
            <code>color-mix(in srgb, var(--color-surface) 80%, transparent)</code>.
            Also accepts <code>bg-transparent</code> and <code>bg-current</code>.
          </>
        ),
      },
      {
        name: "text-<role> / text-<role>/<0-100>",
        badge: "color",
        description: (
          <>
            Sets foreground <code>color: var(--color-&lt;role&gt;)</code> (for
            example <code>text-text-muted</code>,{" "}
            <code>text-on-primary</code>,{" "}
            <code>text-on-semantic-success</code> — the default ink needs
            no naming).
          </>
        ),
      },
      {
        name: "border-<role> / divide-<role> / ring-<role> / outline-<role> / accent-<role>",
        badge: "stroke & accent",
        description: (
          <>
            Sets <code>border-color</code>, child divider color,{" "}
            <code>--un-ring-color</code>, <code>outline-color</code>, or form{" "}
            <code>accent-color</code> to <code>var(--color-&lt;role&gt;)</code>.
          </>
        ),
      },
    ],
  },
  {
    id: "sizing",
    title: "Sizing & Measure",
    summary:
      "Width, height, and container measure utilities backed by spacing.*, breakpoint.*, and intrinsic keywords.",
    rules: [
      {
        name: "w-<step> / h-<step> / size-<step> / min-w-<step> / min-h-<step> / max-w-<step> / max-h-<step>",
        badge: "spacing scale",
        description: (
          <>
            Sizes width and/or height from{" "}
            <code>var(--spacing-&lt;step&gt;)</code>.
          </>
        ),
      },
      {
        name: "w-full / w-fit / w-min / w-max / w-screen / h-full / h-screen / min-w-0 / min-h-0",
        badge: "intrinsic keywords",
        description: (
          <>
            Standard percentage, viewport (<code>100vw</code> /{" "}
            <code>100vh</code> / <code>100dvh</code>), and intrinsic sizing (
            <code>fit-content</code>, <code>min-content</code>,{" "}
            <code>max-content</code>).
          </>
        ),
      },
      {
        name: "max-w-prose / max-w-screen-<bp> / max-w-<xs|sm|md|lg|xl|2xl>",
        badge: "reading & container measure",
        description: (
          <>
            <code>max-w-prose</code> caps reading measure at <code>65ch</code>;{" "}
            <code>max-w-screen-sm</code> through <code>max-w-screen-xl</code>{" "}
            read your theme's <code>breakpoint.*</code> tokens.
          </>
        ),
      },
    ],
  },
  {
    id: "typography",
    title: "Typography & Icons",
    summary: (
      <>
        Font family, size, weight, tracking, and icon sizing utilities for UI
        chrome outside semantic prose elements — steps live on{" "}
        <A href="/docs/themes/reference#groups">Token Reference</A>.
      </>
    ),
    rules: [
      {
        name: "font-<sans|heading|mono|serif|body|brand>",
        badge: "font-family",
        description: (
          <>
            Sets <code>font-family: var(--font-family-&lt;role&gt;)</code> for
            every role declared under <code>font.family</code> in your theme.
          </>
        ),
      },
      {
        name: "text-<step>",
        badge: "font-size",
        description: (
          <>
            Sets <code>font-size: var(--font-size-&lt;step&gt;)</code> from your
            theme&apos;s monotonic <code>font.size</code> ramp — type sizes come
            from the scale, and <code>text-[…]</code> renders nothing.
          </>
        ),
      },
      {
        name: "font-<weight> / tracking-<step>",
        badge: "weight & tracking",
        description: (
          <>
            Spends <code>font.weight.*</code> and{" "}
            <code>font.tracking.*</code>. (<code>overline</code> is the
            static <code>text-decoration: overline</code> utility — Tailwind
            vocabulary, not a caption composition.)
          </>
        ),
      },
      {
        name: "icon-sm / icon-md / icon-lg & i-<collection>-<glyph>",
        badge: "icons",
        description: (
          <>
            <code>icon-sm</code>, <code>icon-md</code>, and <code>icon-lg</code>{" "}
            size icons from your theme's <code>icon.size.*</code> tokens;{" "}
            <code>i-lucide-*</code>, <code>i-ph-*</code>,{" "}
            <code>i-tabler-*</code>, <code>i-carbon-*</code>, and{" "}
            <code>i-material-symbols-*</code> render offline Iconify glyphs.
          </>
        ),
      },
    ],
  },
  {
    id: "borders-effects",
    title: "Borders, Radii, Shadows & Opacity",
    summary: (
      <>
        Surface edges, corner radii, elevation shadows, and opacity steps —
        declared under <code>radius.*</code>, <code>shadow.*</code>, and{" "}
        <code>opacity.*</code> on{" "}
        <A href="/docs/themes/reference#groups">Token Reference</A>.
      </>
    ),
    rules: [
      {
        name: "border / border-<0|2|4|8> / border-<t|r|b|l|x|y|s|e>",
        badge: "border-width",
        description: (
          <>
            <code>border</code> sets <code>1px solid var(--color-border)</code>{" "}
            (or directional edges <code>border-b</code>, <code>border-t</code>,{" "}
            <code>border-s</code>, <code>border-e</code>).{" "}
            <code>divide-x</code> and <code>divide-y</code> add borders between
            adjacent children.
          </>
        ),
      },
      {
        name: "rounded-<step> / rounded-<t|r|b|l>-<step>",
        badge: "border-radius",
        description: (
          <>
            Sets <code>border-radius: var(--radius-&lt;step&gt;)</code> for steps
            declared under <code>radius.*</code> (<code>none</code>,{" "}
            <code>sm</code>, <code>md</code>, <code>lg</code>,{" "}
            <code>xl</code>, <code>full</code>).
          </>
        ),
      },
      {
        name: "shadow-<step> / opacity-<step>",
        badge: "elevation & opacity",
        description: (
          <>
            <code>shadow-&lt;step&gt;</code> sets{" "}
            <code>box-shadow: var(--shadow-&lt;step&gt;)</code> (
            <code>none</code>, <code>sm</code>, <code>md</code>,{" "}
            <code>lg</code>); <code>opacity-&lt;step&gt;</code> reads{" "}
            <code>opacity.*</code>.
          </>
        ),
      },
    ],
  },
  {
    id: "positioning",
    title: "Positioning, Z-Index & CSS Anchor",
    summary: (
      <>
        Offsets, theme z-index layers, and native CSS Anchor Positioning
        utilities — layers live on{" "}
        <A href="/docs/themes/reference#groups">Token Reference</A>.
      </>
    ),
    rules: [
      {
        name: "relative / absolute / fixed / sticky & inset-<step> / top|right|bottom|left|start|end-<step>",
        badge: "position & offsets",
        description: (
          <>
            Standard positioning modes with offsets backed by{" "}
            <code>var(--spacing-&lt;step&gt;)</code> or <code>0</code> /{" "}
            <code>full</code> / <code>auto</code>.
          </>
        ),
      },
      {
        name: "z-<layer>",
        badge: "z-index",
        description: (
          <>
            Sets <code>z-index: var(--z-index-&lt;layer&gt;)</code> for layers
            declared under <code>z-index.*</code> in your theme.
          </>
        ),
      },
      {
        name: "anchor-<name> / position-anchor-<name> / position-area-<side>",
        badge: "CSS anchor positioning",
        description: (
          <>
            Pins floating panels to triggers via native CSS anchor positioning (
            <code>anchor-name: --&lt;name&gt;</code>,{" "}
            <code>position-anchor: --&lt;name&gt;</code>, and{" "}
            <code>position-area: top|right|bottom|left|center</code>).
          </>
        ),
      },
    ],
  },
  {
    id: "motion",
    title: "Transitions, Transforms & Animations",
    summary: (
      <>
        State transitions, hardware transforms, and{" "}
        <code>@spinjs/spin/animation</code> keyframe utilities — tokens live
        on <A href="/docs/themes/reference#groups">Token Reference</A> and
        the live previews on{" "}
        <A href="/docs/styling/animation">Animations & Motion</A>.
      </>
    ),
    rules: [
      {
        name: "transition / transition-<colors|opacity|transform|all> & duration-<step> & ease-<curve>",
        badge: "transitions",
        description: (
          <>
            Composes transition properties with{" "}
            <code>var(--motion-duration-&lt;step&gt;)</code> and{" "}
            <code>var(--motion-easing-&lt;curve&gt;)</code>.
          </>
        ),
      },
      {
        name: "translate-x-<step> / translate-y-<step> / scale-<pct> / rotate-<deg>",
        badge: "transforms",
        description: (
          <>
            Translates by <code>var(--spacing-&lt;step&gt;)</code> (or{" "}
            <code>full</code> / <code>1/2</code>) and scales/rotates elements.
          </>
        ),
      },
      {
        name: animationContract.variants.join(" / "),
        badge: "@spinjs/spin/animation",
        description: (
          <>
            Keyframe utilities spending <code>--motion-distance</code>,{" "}
            <code>--motion-duration-*</code>, and{" "}
            <code>--motion-easing-*</code>.
          </>
        ),
      },
    ],
  },
  ];
  return groups;
}

export default function Catalog(): JSX.Element {
  const groups = useReferenceGroups();
  const [query, setQuery] = createSignal("");

  const filteredGroups = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (q === "") return groups;
    return groups.map((group) => {
      if (group.title.toLowerCase().includes(q)) return group;
      const rules = group.rules.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.badge?.toLowerCase().includes(q) ?? false),
      );
      return { ...group, rules };
    }).filter((g) => g.rules.length > 0);
  });

  const projectShortcuts: readonly PropEntry[] = [
    {
      name: "stack / stack-xs / stack-sm / stack-lg",
      badge: "project shortcut",
      description: <code>flex flex-col</code>,
    },
    {
      name: "row / row-sm / split",
      badge: "project shortcut",
      description: <code>flex items-center (+ justify-between on split)</code>,
    },
  ];

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Utility Reference"
        lede="Grammar reference for every utility class family in @spinjs/spin/preset: the class pattern you write, the CSS declarations it emits, and the active theme token steps that back it."
      />

      <Section id="search" title="Filter utility rules">
        <input
          type="search"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search utility patterns — e.g. p-, bg-, rounded-, stack, anchor-, duration-"
          aria-label="Search utility patterns"
          class="w-full max-w-screen-sm"
        />
      </Section>

      <For each={filteredGroups()}>
        {(group) => (
          <Section id={group.id} title={group.title}>
            <p class="max-w-prose">{group.summary}</p>
            <PropList items={group.rules} />
          </Section>
        )}
      </For>

      <Section id="shortcuts-table" title="Project shortcuts, not preset utilities">
        <p class="max-w-prose">
          Spin ships no compositions of its own. The rows below are the ones
          this docs site declares in its own <code>vite.config.ts</code> via{" "}
          <code>spin.vite({"{"} shortcuts {"}"})</code> — the worked example
          on <A href="/docs/getting-started/install#config">Install</A>. Your
          project declares its own the same way.
        </p>
        <PropList items={projectShortcuts} />
      </Section>
    </main>
  );
}
