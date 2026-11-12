/**
 * Utility Reference: scannable reference for Spin's utility class families.
 */
import { createMemo, createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { animationContract } from "@spinjs/preset";
import {
  PageHeader,
  PropList,
  Section,
  languageDoc,
  type PropEntry,
} from "../../../ui/index.ts";

function typeStyleNames(): readonly string[] {
  const font = (languageDoc() as Record<string, unknown>)["font"] as
    | Record<string, unknown>
    | undefined;
  const style = font?.["style"] as Record<string, unknown> | undefined;
  if (style === undefined) return [];
  return Object.keys(style)
    .filter((key) => !key.startsWith("$"))
    .sort();
}

interface UtilityGroupSpec {
  readonly id: string;
  readonly title: string;
  readonly summary: JSX.Element;
  readonly rules: readonly PropEntry[];
}

function useReferenceGroups(): readonly UtilityGroupSpec[] {
  void languageDoc();
  return [
    {
      id: "layout",
      title: "Display, Flexbox & Grid",
      summary: (
        <>
          Standard CSS display, flexbox, grid, and list layout classes. Declare
          reusable multi-class helpers on{" "}
          <A href="/docs/styling/utilities">Shortcuts</A>.
        </>
      ),
      rules: [
        {
          name: "flex / inline-flex / grid / inline-grid / block / hidden",
          badge: "display",
          description:
            "Display modes, flex direction and wrapping, alignment (items-*, justify-*, self-*), and 1–12 column CSS Grid layout.",
        },
        {
          name: "row-list / flow-list",
          badge: "lists",
          description:
            "Clean horizontal navigation lists (row-list) and unbulleted vertical lists (flow-list) without marker or spacing resets.",
        },
      ],
    },
    {
      id: "spacing",
      title: "Spacing (Padding, Margin & Gap)",
      summary: (
        <>
          Padding, margin, and gap classes backed by your theme's spacing scale.
          See <A href="/docs/themes/reference#groups">Token Reference</A> for
          exact step values.
        </>
      ),
      rules: [
        {
          name: "p-<step> / px-<step> / py-<step> / pt|pr|pb|pl|ps|pe-<step>",
          badge: "padding",
          description:
            "All-side, horizontal/vertical, and single-side padding (including logical inline-start ps-* and inline-end pe-*).",
        },
        {
          name: "m-<step> / mx-<step> / my-<step> / mt|mr|mb|ml|ms|me-<step>",
          badge: "margin",
          description:
            "Outer margin from your spacing scale, auto centering (mx-auto, ms-auto), and negative offsets (-mt-2).",
        },
        {
          name: "gap-<step> / gap-x-<step> / gap-y-<step>",
          badge: "gap",
          description:
            "Row and column spacing inside flex and grid containers.",
        },
      ],
    },
    {
      id: "colors",
      title: "Backgrounds, Text & Borders",
      summary: (
        <>
          Semantic color utilities that switch automatically between light and
          dark modes. Live examples on{" "}
          <A href="/docs/styling/color">Surfaces</A>.
        </>
      ),
      rules: [
        {
          name: "bg-<role> / bg-<role>/<0-100>",
          badge: "background",
          description:
            "Surface, brand, and semantic status backgrounds, with optional /0–/100 opacity percentage modifiers.",
        },
        {
          name: "text-<role> / text-<role>/<0-100>",
          badge: "text color",
          description:
            "Foreground text roles such as text-muted, text-primary, and paired text-on-* roles.",
        },
        {
          name: "border-<role> / divide-<role> / ring-<role>",
          badge: "strokes",
          description:
            "Border, child divider, and focus-ring colors from your theme palette.",
        },
      ],
    },
    {
      id: "sizing",
      title: "Sizing & Containers",
      summary:
        "Width, height, viewport, and reading-width container classes.",
      rules: [
        {
          name: "w-<step> / h-<step> / size-<step> / min-w-* / max-w-*",
          badge: "scale",
          description:
            "Fixed and bounded dimensions backed by your theme's spacing scale.",
        },
        {
          name: "w-full / w-fit / h-full / h-dvh / min-w-0 / min-h-0",
          badge: "keywords",
          description:
            "Percentage, dynamic viewport, and intrinsic content sizing.",
        },
        {
          name: "max-w-prose / max-w-screen-<sm|md|lg|xl>",
          badge: "containers",
          description:
            "Readable 65ch prose measure and responsive page container widths.",
        },
      ],
    },
    {
      id: "typography",
      title: "Typography & Icons",
      summary: (
        <>
          Named typographic voices and offline Iconify icon classes. Live
          specimens on <A href="/docs/styling/prose">Prose</A>.
        </>
      ),
      rules: [
        {
          name: "type-<style>",
          badge: "type voices",
          description: (
            <div class="flex flex-col gap-2">
              <span>
                Applies a complete typographic style (font family, size, weight,
                line height, and letter spacing) in a single class:
              </span>
              <span class="flex flex-wrap gap-1">
                <For each={typeStyleNames()}>
                  {(name) => <code>type-{name}</code>}
                </For>
              </span>
            </div>
          ),
        },
        {
          name: "uppercase / lowercase / capitalize / truncate / underline",
          badge: "text helpers",
          description:
            "Case transforms, single-line ellipsis truncation, alignment, and text decoration.",
        },
        {
          name: "icon-sm / icon-md / icon-lg & i-<collection>-<name>",
          badge: "icons",
          description:
            "Theme-scaled icon sizes paired with offline Iconify glyphs (such as i-lucide-search).",
        },
      ],
    },
    {
      id: "borders-effects",
      title: "Borders, Radii & Shadows",
      summary: "Hairline edges, corner rounding, and elevation shadows.",
      rules: [
        {
          name: "border / border-strong / border-<t|r|b|l|x|y|s|e>",
          badge: "borders",
          description:
            "1px theme borders on all or individual sides, plus divide-x and divide-y between children.",
        },
        {
          name: "rounded-<none|sm|md|lg|xl|full>",
          badge: "radius",
          description: "Corner radii from your theme's shape scale.",
        },
        {
          name: "shadow-<none|sm|md|lg> / opacity-<step>",
          badge: "elevation",
          description: "Elevation box shadows and element opacity steps.",
        },
      ],
    },
    {
      id: "positioning",
      title: "Positioning & Z-Index",
      summary: "Layout positioning, inset offsets, and named z-index layers.",
      rules: [
        {
          name: "relative / absolute / fixed / sticky & inset-* / top|right|bottom|left-*",
          badge: "position",
          description:
            "Positioning modes and edge offsets from your spacing scale.",
        },
        {
          name: "z-<base|dropdown|sticky|modal|popover|toast>",
          badge: "z-index",
          description:
            "Named stacking layers so menus, modals, and toasts never fight arbitrary z-index numbers.",
        },
      ],
    },
    {
      id: "motion",
      title: "Transitions & Animations",
      summary: (
        <>
          Theme-paced state transitions and entrance keyframes. Interactive
          demos on <A href="/docs/styling/animation">Motion</A>.
        </>
      ),
      rules: [
        {
          name: "transition-colors / transition-all & duration-<fast|base|slow> & ease-<curve>",
          badge: "transitions",
          description:
            "Smooth property transitions timed by your theme's motion scale.",
        },
        {
          name: animationContract.variants.join(" / "),
          badge: "keyframes",
          description:
            "Ready-to-use entrance and feedback animations that respect prefers-reduced-motion.",
        },
      ],
    },
  ];
}

export default function Catalog(): JSX.Element {
  const groups = useReferenceGroups();
  const [query, setQuery] = createSignal("");

  const filteredGroups = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (q === "") return groups;
    return groups
      .map((group) => {
        if (group.title.toLowerCase().includes(q)) return group;
        const rules = group.rules.filter((rule) =>
          rule.name.toLowerCase().includes(q),
        );
        return { ...group, rules };
      })
      .filter((g) => g.rules.length > 0);
  });

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Utility Reference"
        lede="Quick lookup for Spin's layout, spacing, surface, typography, and motion utility classes."
      />

      <div class="mb-6">
        <label class="flex items-center gap-2">
          <input
            type="search"
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            placeholder="Filter utility families (e.g. grid, gap, bg-, type-, z-)…"
            aria-label="Filter utility families"
          />
        </label>
      </div>

      <For each={filteredGroups()}>
        {(group) => (
          <Section id={group.id} title={group.title}>
            <p class="max-w-prose text-muted">{group.summary}</p>
            <PropList items={group.rules} />
          </Section>
        )}
      </For>
    </main>
  );
}
