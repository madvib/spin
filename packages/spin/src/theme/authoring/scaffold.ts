/**
 * The smallest theme that satisfies the contract.
 *
 * One consumer, three call sites: the preset falls back to it when given no
 * input, the studio seeds it for "new theme", and tests build fixtures from
 * it. A single function rather than three copies, so they cannot disagree
 * about what "minimal but valid" means.
 *
 * The palette arrives as neutral placeholders an author must replace — the
 * scaffold validates, but it is deliberately ugly. The scales arrive at
 * baseline values: the shared ruler is not the author's decision, and a
 * placeholder step is a collapsed specimen. A theme that looks finished was
 * not scaffolded; it was authored.
 */

import { ELEMENT_ROLES } from "../contract/elements.ts";
import { BASE_ROLES, baselineScales } from "../contract/roles.ts";
import { STYLE_FLOOR, styleFloorFields } from "../contract/typography.ts";
import type { TokenLeaf, TokenTree, TokenType } from "../pipeline/types.ts";

/** A declaration a scaffold can write: the path, the type, the value. */
interface Scaffoldable {
  readonly path: string;
  readonly type: TokenType;
  readonly value: string | number | boolean;
}

/** Every declaration a scaffold knows, base roles first. */
function declarations(): readonly Scaffoldable[] {
  return [...BASE_ROLES, ...ELEMENT_ROLES, ...floorDeclarations()];
}

/**
 * The style floor, written as literals.
 *
 * The floor names are stable API, so a scaffold carries every one: a new
 * theme starts complete, and the author meets the decisions rather than the
 * gaps. The values are literals, never aliases into the scales — a scaffold
 * declares no scales, so an alias would point at a token the scaffold
 * itself does not carry. The tuple is the theme's to author, and the
 * scaffold's is deliberately unfinished.
 */
function floorDeclarations(): readonly Scaffoldable[] {
  return STYLE_FLOOR.flatMap((style) =>
    styleFloorFields().map((field) => ({
      path: `font.style.${style.name}.${field}`,
      type: floorFieldType(field),
      value: floorLiteral(style.name, field),
    }))
  );
}

/** The token type one floor field carries. */
function floorFieldType(field: string): TokenType {
  if (field === "family") return "fontFamily";
  if (field === "weight") return "fontWeight";
  return "dimension";
}

/** The literal value one floor leaf carries. */
function floorLiteral(name: string, field: string): string | number {
  const literals: Record<string, Record<string, string | number>> = {
    display: { family: "system-ui, sans-serif", size: "1.875rem", weight: 700, tracking: "-0.025em", leading: 1.25 },
    title: { family: "system-ui, sans-serif", size: "1.5rem", weight: 600, tracking: "0em", leading: 1.375 },
    heading: { family: "system-ui, sans-serif", size: "1.25rem", weight: 600, tracking: "0em", leading: 1.375 },
    subtitle: { family: "system-ui, sans-serif", size: "1.125rem", weight: 500, tracking: "0em", leading: 1.375 },
    lead: { family: "system-ui, sans-serif", size: "1.125rem", weight: 400, tracking: "0em", leading: 1.625 },
    body: { family: "system-ui, sans-serif", size: "1rem", weight: 400, tracking: "0em", leading: 1.625 },
    quote: { family: "ui-serif, Georgia, serif", size: "1rem", weight: 400, tracking: "0em", leading: 1.625 },
    code: { family: "ui-monospace, monospace", size: "0.875rem", weight: 400, tracking: "0em", leading: 1.5 },
    link: { family: "system-ui, sans-serif", size: "1rem", weight: 400, tracking: "0em", leading: 1.625 },
    label: { family: "system-ui, sans-serif", size: "0.875rem", weight: 500, tracking: "0.025em", leading: 1.375 },
    caption: { family: "system-ui, sans-serif", size: "0.75rem", weight: 400, tracking: "0em", leading: 1.375 },
    overline: { family: "system-ui, sans-serif", size: "0.75rem", weight: 600, tracking: "0.05em", leading: 1.375 },
    stat: { family: "ui-monospace, monospace", size: "1.5rem", weight: 600, tracking: "0em", leading: 1.25 },
    badge: { family: "system-ui, sans-serif", size: "0.625rem", weight: 500, tracking: "0.025em", leading: 1 },
    "body-strong": { family: "system-ui, sans-serif", size: "1rem", weight: 600, tracking: "0em", leading: 1.625 },
    "caption-strong": { family: "system-ui, sans-serif", size: "0.75rem", weight: 600, tracking: "0.025em", leading: 1.375 },
    "stat-label": { family: "system-ui, sans-serif", size: "0.75rem", weight: 600, tracking: "0.025em", leading: 1.375 },
    "card-title": { family: "system-ui, sans-serif", size: "1.125rem", weight: 600, tracking: "0em", leading: 1.375 },
  };
  return literals[name]?.[field] ?? "1rem";
}

/**
 * The shared ruler, written at baseline values.
 *
 * Scales are not the author's decisions — the palette is — so they arrive
 * ready rather than as placeholders. A scaffold without them validates
 * under roles but breaks every utility that spends a step, which is the
 * failure the required paths exist to prevent.
 */
function scaleDeclarations(): readonly Scaffoldable[] {
  return baselineScales().map((entry) => ({
    path: entry.path,
    type: entry.type,
    value: entry.value as string | number | boolean,
  }));
}

/**
 * A token tree with every role in `roles` and nothing else: no dark axis.
 * Enough to validate and render; everything an author adds from here is a
 * decision, not backfill.
 *
 * With no `roles`, the scaffold carries the whole surface the contract
 * knows: the base roles a theme must declare, and the per-element tokens the
 * elements spend. A theme that omits a per-element token is still valid —
 * the rules fall back to the shared scales — but a scaffold is the document
 * an author edits, and an author should meet the decisions rather than the
 * gaps. The studio writes this document when a theme is created, so the
 * per-element groups arrive with it.
 *
 * Base and per-element roles carry their own type and placeholder, declared
 * once in `@spinjs/spin/theme`. A path that is neither is an error: a scaffold
 * cannot invent a role it does not know.
 */
export function scaffoldTheme(roles?: readonly string[]): TokenTree {
  const declared = new Set(declarations().map((role) => role.path));
  const known = [
    ...declarations(),
    ...scaleDeclarations().filter((scale) => !declared.has(scale.path)),
  ];
  const wanted = roles ?? known.map((role) => role.path);
  const byRoot = new Map<string, TokenLeaf[]>();
  for (const path of wanted) {
    const role = known.find((candidate) => candidate.path === path);
    if (role === undefined) {
      throw new Error(
        `scaffoldTheme: no declaration for required role ${path}`,
      );
    }
    const segments = path.split(".");
    const leaf: TokenLeaf = {
      kind: "token",
      name: segments[segments.length - 1] as string,
      path: segments,
      type: role.type,
      value: role.value,
    };
    const root = segments[0] as string;
    byRoot.set(root, [...(byRoot.get(root) ?? []), leaf]);
  }
  return [...byRoot.entries()].map(([root, leaves]) => ({
    kind: "group" as const,
    name: root,
    path: [root],
    children: leaves,
  }));
}
