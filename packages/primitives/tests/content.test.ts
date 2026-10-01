import { assert, assertEquals } from "@std/assert";
import {
  contrastRatio,
  indexTree,
  parseTokens,
  resolveAliases,
  validateTokens,
} from "@spin/theme";
import type { TokenLeaf, TokenTree } from "@spin/theme";

/**
 * The content surface spends the scales and mints no tokens. Prose rhythm, type
 * scale and list indentation are decisions every theme would answer the same
 * way, so they are spent bindings read out of the CSS.
 *
 * What makes prose worth testing is different from what makes a form worth
 * testing. A form has states a theme can get wrong; prose has a *scale* it can
 * get wrong, and a scale that is not monotonic produces a document that looks
 * broken in a way no single-token check would attribute to the type system.
 */

const EXAMPLES = new URL("../../theme/examples/", import.meta.url);
const THEMES = ["default/light.json", "neobrut.json", "console.json"] as const;

/** Scale steps the content CSS spends. */
const SPENT = [
  "spacing-1",
  "spacing-2",
  "spacing-4",
  "radius-sm",
  "radius-md",
  "font-size-xs",
  "font-size-sm",
  "font-size-md",
  "font-size-lg",
  "font-size-xl",
  "font-size-2xl",
  "font-size-3xl",
  "font-weight-semibold",
  "font-weight-bold",
  "font-family-sans",
  "font-family-mono",
  "border-width",
  "color-surface",
  "color-surface-raised",
  "color-text",
  "color-text-muted",
  "color-border",
  "color-primary",
  "color-accent",
  "color-semantic-success",
  "color-semantic-error",
] as const;

function parse(name: string): TokenTree {
  const doc = JSON.parse(Deno.readTextFileSync(new URL(name, EXAMPLES)));
  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  return parsed.tree;
}

function flatten(nodes: TokenTree): TokenLeaf[] {
  const out: TokenLeaf[] = [];
  for (const node of nodes) {
    if (node.kind === "token") out.push(node);
    else out.push(...flatten(node.children));
  }
  return out;
}

function resolved(tree: TokenTree, path: string): string | undefined {
  const hit = new Map(
    flatten(resolveAliases(tree).tree).map((l) =>
      [l.path.join("."), String(l.value)] as const
    ),
  );
  return hit.get(path);
}

/** A length in px, so a rem value and a px value can be compared. */
function toPx(value: string | undefined): number {
  if (value === undefined) return NaN;
  const rem = value.match(/^([\d.]+)rem$/);
  if (rem) return Number(rem[1]) * 16;
  const px = value.match(/^([\d.]+)px$/);
  if (px) return Number(px[1]);
  return Number(value);
}

for (const name of THEMES) {
  Deno.test(`${name} declares every scale step the content surface spends`, () => {
    const declared = new Set(Object.keys(indexTree(parse(name)).vars));
    const missing = SPENT.filter((token) => !declared.has(token));
    assertEquals(
      missing,
      [],
      `${name} is missing scale steps the content surface reads: ${
        missing.join(", ")
      }`,
    );
  });

  Deno.test(`${name} type descends from h1 to body`, () => {
    // The heading scale is what makes a document read as structured. A theme
    // that ships h2 larger than h1 is syntactically valid and visually broken,
    // and nothing else in the system would notice.
    const tree = parse(name);
    const headings = ["3xl", "2xl", "xl", "lg", "md"].map((step) =>
      toPx(resolved(tree, `font.size.${step}`))
    );
    const body = toPx(resolved(tree, "font.size.md"));
    for (let i = 1; i < headings.length; i++) {
      assert(
        headings[i - 1] > headings[i],
        `${name}: font.size is not ordered at ${i} (${headings.join(", ")})`,
      );
    }
    assert(
      headings[headings.length - 1] >= body,
      `${name}: the smallest heading is smaller than body text`,
    );
  });

  Deno.test(`${name} prose is legible on the page surface`, () => {
    const tree = parse(name);
    const surface = resolved(tree, "color.surface");
    const ink = resolved(tree, "color.text");
    const muted = resolved(tree, "color.text-muted");
    assert(surface !== undefined, `${name} has no surface`);
    assert(ink !== undefined, `${name} has no text color`);
    assert(muted !== undefined, `${name} has no muted color`);
    assert(
      contrastRatio(surface, ink) >= 4.5,
      `${name}: body text is ${
        contrastRatio(surface, ink).toFixed(2)
      }:1 on the page`,
    );
    // Secondary prose still has to be readable, so it answers to the text
    // floor rather than the 3:1 a non-text indicator needs.
    assert(
      contrastRatio(surface, muted) >= 4.5,
      `${name}: muted prose is ${
        contrastRatio(surface, muted).toFixed(2)
      }:1 on the page`,
    );
  });

  Deno.test(`${name} a link is distinguishable from body text`, () => {
    // A link is the one piece of prose that is also a control. If it resolves
    // to the same color as the text around it, colour stops carrying the
    // meaning and the underline is the only cue left. This is why `color.link`
    // is its own role rather than a reuse of the primary: a theme may
    // legitimately make its primary equal its text, which is correct for a
    // filled button and wrong for a link.
    const tree = parse(name);
    const link = resolved(tree, "color.link");
    const ink = resolved(tree, "color.text");
    assert(ink !== undefined, `${name} has no text color`);
    assert(
      link !== ink,
      `${name}: links resolve to the same color as body text, so a link is ` +
        `only findable by its underline`,
    );
  });
}

Deno.test("a theme missing a scale step the content surface spends is reported", () => {
  // With no content-owned tokens, the scales are the only way prose can break.
  const doc = JSON.parse(
    Deno.readTextFileSync(new URL("default/light.json", EXAMPLES)),
  ) as { font: { size: Record<string, unknown> } };
  delete doc.font.size["xl"];

  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);

  const report = validateTokens(parsed.tree, {
    required: ["font.size.xl"],
  });
  assert(
    report.issues.some((issue) => issue.path === "font.size.xl"),
    "a theme missing font.size.xl should be reported, since prose spends it",
  );
});
