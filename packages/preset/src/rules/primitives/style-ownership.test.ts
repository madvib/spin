import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../../index.ts";
import {
  parseTokens,
  resolveTheme,
  validateTokens,
} from "@spinjs/theme";

/**
 * Type styles own type: emitters spend element and component tuples, never atoms.
 *
 * The 99px probe is the regression test for the whole stage: a theme that
 * moves a style's size moves every element whose type defaults to the style,
 * because the rules spend the element type's variable. The assertions
 * are about WHICH variable a rule spends, never about a value's text.
 */

const MINIMAL = new URL(
  "../../../../theme/src/languages/minimal.json",
  import.meta.url,
);
const minimalThemeDoc = (): Record<string, unknown> =>
  JSON.parse(readFileSync(MINIMAL, "utf8")) as Record<string, unknown>;

/** The minimal theme with the value at a dotted path replaced. */
function withValue(
  path: string,
  value: unknown,
): Record<string, unknown> {
  const doc = minimalThemeDoc();
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    node = (node[segment] as Record<string, unknown>);
  }
  const leaf = segments[segments.length - 1] as string;
  // A composite `$type: "typography"` style carries its fields inside one
  // `$value` object rather than as child tokens: writing a child beside it
  // is a document that claims both, and the parser rejects it.
  if (
    segments.length === 4 && segments[0] === "font" && segments[1] === "style" &&
    typeof node["$value"] === "object" && node["$value"] !== null
  ) {
    const tuple = node["$value"] as Record<string, unknown>;
    const inner = value as Record<string, unknown>;
    tuple[leaf] = "$value" in inner ? inner["$value"] : value;
    return doc;
  }
  node[leaf] = value;
  return doc;
}

/**
 * The minimal theme with a new leaf added, creating groups as needed. A leaf is
 * written the way a theme writes one: its `$type` beside its `$value`.
 */
function withLeaf(
  path: string,
  type: string,
  value: unknown,
): Record<string, unknown> {
  const doc = minimalThemeDoc();
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    const next = (node[segment] ?? {}) as Record<string, unknown>;
    node[segment] = next;
    node = next;
  }
  node[segments[segments.length - 1] as string] = {
    $type: type,
    $value: value,
  };
  return doc;
}

/** Generate a document against one theme. */
async function sheetFor(markup: string, doc: Record<string, unknown>) {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: doc } })],
  });
  return await uno.generate(markup, { preflights: false });
}

/**
 * The declarations emitted under a target selector, merged across yields.
 *
 * Tag rules emit under bare tags (`p`, `a`), the button under its group
 * (`:is(button, …)`), variants under their class (`.danger`). A selector
 * matches when one of its comma-separated parts IS the target — substring
 * matching would let `caption` answer for `a`. Merging is what the cascade
 * does, and a font declaration on any of the yields is a font the element
 * wears.
 */
function declsFor(css: string, target: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, selectorText, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Substring matching is what the cascade does, except for the bare `a`:
    // `caption` contains one, so the link matches on selector parts instead.
    const hit = target === "a"
      ? selectorText.split(",").map((part) => part.trim()).some((part) =>
        part === "a" || part.startsWith("a:") || part.startsWith("a[")
      )
      : selectorText.includes(target);
    if (!hit) continue;
    for (const entry of body.split(";")) {
      const text = entry.trim();
      if (text.length === 0) continue;
      const colon = text.indexOf(":");
      if (colon < 0) continue;
      out[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
    }
  }
  return out;
}

test("the 99px probe: moving the body style's size moves the paragraph", async () => {
  const doc = withValue("font.style.body.size", {
    $type: "dimension",
    $value: "99px",
  });
  const css = (await sheetFor("<p>a</p>", doc)).css;
  deepStrictEqual(
    declsFor(css, "p")["font-size"],
    "var(--element-p-type-size)",
    "a paragraph spends its element type's size, which defaults to the body style",
  );
  deepStrictEqual(
    resolveTheme(JSON.parse(JSON.stringify(doc))).values["font.style.body.size"],
    "99px",
    "and the stylesheet resolves that variable to the theme's answer",
  );
});

test("a heading spends its element type, not the ladder step", async () => {
  const css = (await sheetFor("<h1>a</h1><h2>a</h2>", minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, "h1")["font-size"],
    "var(--element-h1-type-size)",
  );
  deepStrictEqual(
    declsFor(css, "h2")["font-size"],
    "var(--element-h2-type-size)",
  );
});

test("small print, code, strong and quotations spend their element types; links inherit", async () => {
  const css = (
    await sheetFor(
      "<small>a</small><code>a</code><a href=\"#\">a</a><strong>a</strong><blockquote>a</blockquote><figcaption>a</figcaption>",
      minimalThemeDoc(),
    )
  ).css;
  deepStrictEqual(declsFor(css, "small")["font-size"], "var(--element-small-type-size)");
  deepStrictEqual(declsFor(css, "code")["font-size"], "var(--element-code-type-size)");
  // A link is an inline modifier over inherited prose: it reads no type style,
  // so it resets no face, size, weight, tracking or leading of its own.
  const link = declsFor(css, "a");
  assert(!("font-size" in link), `a link inherits its size, got: ${JSON.stringify(link)}`);
  assert(!("font-family" in link), `a link inherits its face, got: ${JSON.stringify(link)}`);
  assert(!("font-weight" in link), `a link inherits its weight, got: ${JSON.stringify(link)}`);
  assert(!("letter-spacing" in link), `a link inherits its tracking, got: ${JSON.stringify(link)}`);
  assert(!("line-height" in link), `a link inherits its leading, got: ${JSON.stringify(link)}`);
  deepStrictEqual(link["color"], "var(--color-link)");
  deepStrictEqual(link["text-decoration-line"], "underline");
  // The resting rule wears the theme's thickness (`a`); the hover yield
  // thickens it (`a:hover`), and declsFor merges yields the way the cascade
  // does — so the resting declaration is read off the bare selector.
  deepStrictEqual(
    declsFor(css.split("a:hover")[0] as string, "a")["text-decoration-thickness"],
    "var(--link-underline)",
  );
  deepStrictEqual(link["text-underline-offset"], "var(--link-offset)");
  // Strong is the other inline modifier: weight only, never a tuple reset.
  // (`b` shares the weight rule; it is covered by the rule, not re-asserted
  // here — the bare `b` tag also matches prose selectors, so its merged
  // declarations carry the surrounding prose, not the rule alone.)
  const weight = declsFor(css, "strong");
  deepStrictEqual(weight["font-weight"], "var(--font-style-body-emphasized-weight)");
  assert(!("font-size" in weight), `strong keeps its size, got: ${JSON.stringify(weight)}`);
  assert(!("font-family" in weight), `strong keeps its face, got: ${JSON.stringify(weight)}`);
  assert(!("line-height" in weight), `strong keeps its leading, got: ${JSON.stringify(weight)}`);
  deepStrictEqual(
    declsFor(css, "blockquote")["font-family"],
    "var(--element-blockquote-type-family)",
  );
  deepStrictEqual(
    declsFor(css, "figcaption")["font-size"],
    "var(--element-figcaption-type-size)",
  );
});

test("a button spends the label style as a whole tuple", async () => {
  const css = (await sheetFor("<button>a</button>", minimalThemeDoc())).css;
  const decls = declsFor(css, ":is(button:not([role]),");
  deepStrictEqual(decls["font-family"], "var(--button-type-family)");
  deepStrictEqual(decls["font-size"], "var(--button-type-size)");
  deepStrictEqual(decls["font-weight"], "var(--button-type-weight)");
  deepStrictEqual(decls["letter-spacing"], "var(--button-type-tracking)");
  deepStrictEqual(decls["line-height"], "var(--button-type-leading)");
});

test("moving the label style moves the button", async () => {
  const doc = withValue("font.style.label.size", {
    $type: "dimension",
    $value: "99px",
  });
  const css = (await sheetFor("<button>a</button>", doc)).css;
  deepStrictEqual(
    declsFor(css, ":is(button:not([role]),")["font-size"],
    "var(--button-type-size)",
  );
  deepStrictEqual(
    resolveTheme(JSON.parse(JSON.stringify(doc))).values["font.style.label.size"],
    "99px",
  );
});

test("a button re-points by aliasing another style", async () => {
  const doc = withLeaf("button.type", "typography", "{font.style.body}");
  const css = (await sheetFor("<button>a</button>", doc)).css;
  deepStrictEqual(
    declsFor(css, ":is(button:not([role]),")["font-size"],
    "var(--button-type-size)",
    "button.type is the tuple the button reads",
  );
});

test("a stat's number, label and context spend their styles", async () => {
  const css = (
    await sheetFor(
      "<div class=\"stat\"><div class=\"stat-title\">a</div><div class=\"stat-value\">1</div><div class=\"stat-desc\">a</div></div>",
      minimalThemeDoc(),
    )
  ).css;
  deepStrictEqual(
    declsFor(css, ".stat-value")["font-size"],
    "var(--stat-value-type-size)",
  );
  deepStrictEqual(
    declsFor(css, ".stat-title")["font-size"],
    "var(--stat-title-type-size)",
    "stat.title.type is the tuple the label reads",
  );
  deepStrictEqual(
    declsFor(css, ".stat-desc")["font-size"],
    "var(--stat-desc-type-size)",
  );
});

test("a stat label re-points by aliasing another style", async () => {
  const doc = withLeaf("stat.title.type", "typography", "{font.style.overline}");
  const css = (
    await sheetFor(
      "<div class=\"stat\"><div class=\"stat-title\">a</div></div>",
      doc,
    )
  ).css;
  deepStrictEqual(
    declsFor(css, ".stat-title")["font-size"],
    "var(--stat-title-type-size)",
    "stat.title.type is the tuple the label reads",
  );
});

test("a dangling stat title reference is a theme error", async () => {
  const doc = withLeaf("stat.title.type", "typography", "{font.style.no-such-style}");
  const parsed = parseTokens(JSON.parse(JSON.stringify(doc)));
  assert(parsed.ok, `fixture must parse: ${!parsed.ok ? parsed.error : ""}`);
  if (!parsed.ok) return;
  const report = validateTokens(parsed.tree);
  assert(
    report.issues.some(
      (issue) => issue.path === "stat.title.type.family" && /no-such-style/.test(issue.message),
    ),
    `dangling stat.title.type must be reported, got: ${
      JSON.stringify(report.issues)
    }`,
  );
  await assert.rejects(
    () => sheetFor("<div class=\"stat\"><div class=\"stat-title\">a</div></div>", doc),
    /stat\.title\.type/,
    "and the preset refuses to build the theme",
  );
});

test("a badge spends the label style, not the ladder step", async () => {
  const css = (await sheetFor('<badge>Tag</badge>', minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, "badge")["font-size"],
    "var(--badge-type-size)",
  );
  deepStrictEqual(
    declsFor(css, "badge")["font-weight"],
    "var(--badge-type-weight)",
  );
});

test("moving the label style moves the badge", async () => {
  const doc = withValue("font.style.label.size", {
    $type: "dimension",
    $value: "99px",
  });
  const css = (await sheetFor("<badge>Tag</badge>", doc)).css;
  deepStrictEqual(
    declsFor(css, "badge")["font-size"],
    "var(--badge-type-size)",
    "a badge spends the label style's size, not the ladder's",
  );
  deepStrictEqual(
    resolveTheme(JSON.parse(JSON.stringify(doc))).values["font.style.label.size"],
    "99px",
    "and the stylesheet resolves that variable to the theme's answer",
  );
});

test("a label spends its element type as a whole tuple", async () => {
  const css = (await sheetFor("<label>a</label>", minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, "label")["font-size"],
    "var(--element-label-type-size)",
  );
  deepStrictEqual(
    declsFor(css, "label")["font-weight"],
    "var(--element-label-type-weight)",
  );
});

test("moving the label style moves the label", async () => {
  const doc = withValue("font.style.label.size", {
    $type: "dimension",
    $value: "99px",
  });
  const css = (await sheetFor("<label>a</label>", doc)).css;
  deepStrictEqual(
    declsFor(css, "label")["font-size"],
    "var(--element-label-type-size)",
    "a label spends its element type's size, which defaults to the label style",
  );
  deepStrictEqual(
    resolveTheme(JSON.parse(JSON.stringify(doc))).values["font.style.label.size"],
    "99px",
    "and the stylesheet resolves that variable to the theme's answer",
  );
});

test("a card title and description spend their styles", async () => {
  const css = (
    await sheetFor(
      "<card-title>a</card-title><card-description>a</card-description>",
      minimalThemeDoc(),
    )
  ).css;
  deepStrictEqual(
    declsFor(css, "card-title")["font-size"],
    "var(--card-title-type-size)",
  );
  deepStrictEqual(
    declsFor(css, "card-description")["font-size"],
    "var(--card-description-type-size)",
  );
});

test("a fieldset legend spends its element type", async () => {
  const css = (await sheetFor("<fieldset><legend>a</legend></fieldset>", minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, "legend")["font-size"],
    "var(--element-legend-type-size)",
  );
  deepStrictEqual(
    declsFor(css, "legend")["font-weight"],
    "var(--element-legend-type-weight)",
  );
});

test("an alert spends the label style", async () => {
  const css = (await sheetFor('<alert role="status">a</alert>', minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, "alert")["font-size"],
    "var(--alert-type-size)",
  );
  deepStrictEqual(
    declsFor(css, 'alert[role="alert"]')["font-weight"],
    "var(--font-style-body-emphasized-weight)",
  );
});

test("breadcrumbs spend the label style", async () => {
  const css = (
    await sheetFor('<nav class="breadcrumbs"><ol><li>a</li></ol></nav>', minimalThemeDoc())
  ).css;
  deepStrictEqual(
    declsFor(css, ".breadcrumbs")["font-size"],
    "var(--font-style-label-size)",
  );
});

test("a disclosure summary spends the body-emphasized weight", async () => {
  const css = (await sheetFor("<details><summary>a</summary></details>", minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, "summary")["font-weight"],
    "var(--font-style-body-emphasized-weight)",
  );
});

test("a meter spends the label style", async () => {
  const css = (await sheetFor("<meter>a</meter>", minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, "meter")["font-size"],
    "var(--font-style-label-size)",
  );
});
test("a tooltip spends the caption style", async () => {
  const css = (await sheetFor("<tooltip>a</tooltip>", minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, "tooltip")["font-size"],
    "var(--font-style-caption-size)",
  );
});

test("a tooltip sizes to its text up to the token cap", async () => {
  const css = (await sheetFor("<tooltip>a</tooltip>", minimalThemeDoc())).css;
  const decls = declsFor(css, "tooltip");
  deepStrictEqual(decls["width"], "max-content");
  deepStrictEqual(decls["max-width"], "var(--tooltip-max-width)");
});

test("a skeleton text line spends the body style's size", async () => {
  const css = (await sheetFor('<div class="skeleton skeleton-text"></div>', minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(css, ".skeleton.skeleton-text")["height"],
    "var(--font-style-body-size)",
  );
});

test("a table header spends its element type", async () => {
  const css = (
    await sheetFor("<table><tr><th>a</th></tr></table>", minimalThemeDoc())
  ).css;
  deepStrictEqual(declsFor(css, "th")["font-size"], "var(--element-th-type-size)");
  deepStrictEqual(
    declsFor(css, "th")["font-weight"],
    "var(--element-th-type-weight)",
  );
});

test("one worked per-variant case: a danger button re-points on its own", async () => {
  const doc = withLeaf("button.danger.type", "typography", "{font.style.body-emphasized}");
  const css = (
    await sheetFor("<button class=\"danger\">a</button>", doc)
  ).css;
  deepStrictEqual(
    declsFor(css, ".danger")["font-size"],
    "var(--button-danger-type-size)",
    "the variant reads its own tuple",
  );
  const plain = (await sheetFor("<button class=\"danger\">a</button>", minimalThemeDoc())).css;
  deepStrictEqual(
    declsFor(plain, ".danger")["font-size"],
    "var(--button-danger-type-size)",
    "the base declares danger.type, so the plain silk case reads the tuple too",
  );
});

test("a variant with no tuple of its own reads the base button's tuple", async () => {
  // Self-contained: expanded silk minus the danger group, so no layer
  // inherits the tuple back. The variant falls through to button.type.
  const { baseDocument, expandExtends } = await import("@spinjs/theme");
  const doc = expandExtends(structuredClone(minimalThemeDoc()), { base: baseDocument });
  delete (doc["button"] as Record<string, unknown>)["danger"];
  const css = (await sheetFor("<button class=\"danger\">a</button>", doc)).css;
  deepStrictEqual(
    declsFor(css, ".danger")["font-size"],
    "var(--button-type-size)",
    "a variant with no tuple follows the base button's re-pointing",
  );
});

test("a variant with no tuple anywhere states no type and inherits", async () => {
  const { baseDocument, expandExtends } = await import("@spinjs/theme");
  const doc = expandExtends(structuredClone(minimalThemeDoc()), { base: baseDocument });
  const button = doc["button"] as Record<string, unknown>;
  delete button["danger"];
  delete button["type"];
  const css = (await sheetFor("<button class=\"danger\">a</button>", doc)).css;
  assert(
    !("font-size" in declsFor(css, ".danger")),
    "with no tuple to read, the variant states no type and the cascade carries the base",
  );
});

test("a dangling style reference is a theme error", async () => {
  const doc = withLeaf("button.type", "typography", "{font.style.no-such-style}");
  const parsed = parseTokens(JSON.parse(JSON.stringify(doc)));
  assert(parsed.ok, `fixture must parse: ${!parsed.ok ? parsed.error : ""}`);
  if (!parsed.ok) return;
  const report = validateTokens(parsed.tree);
  assert(
    report.issues.some(
      (issue) => issue.path === "button.type.family" && /no-such-style/.test(issue.message),
    ),
    `dangling button.type must be reported, got: ${
      JSON.stringify(report.issues)
    }`,
  );
  await assert.rejects(
    () => sheetFor("<button>a</button>", doc),
    /button\.type/,
    "and the preset refuses to build the theme",
  );
});

test("a reference to a declared style validates clean", async () => {
  const doc = withLeaf("button.danger.type", "typography", "{font.style.body-emphasized}");
  const parsed = parseTokens(JSON.parse(JSON.stringify(doc)));
  assert(parsed.ok, `fixture must parse: ${!parsed.ok ? parsed.error : ""}`);
  if (!parsed.ok) return;
  deepStrictEqual(
    validateTokens(parsed.tree).issues.filter((issue) =>
      issue.path.startsWith("button.")
    ),
    [],
  );
});
