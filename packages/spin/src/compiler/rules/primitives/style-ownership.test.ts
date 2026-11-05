import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../../index.ts";
import {
  parseTokens,
  resolveTheme,
  validateTokens,
} from "../../../theme/index.ts";

/**
 * Styles own type: emitters spend `font.style.*`, never atoms.
 *
 * The 99px probe is the regression test for the whole stage: a theme that
 * moves a style's size moves every element that reads the style, because the
 * rules spend the style's variable rather than the ladder's. The assertions
 * are about WHICH variable a rule spends, never about a value's text.
 */

const SILK = new URL(
  "../../../theme/themes/silk.json",
  import.meta.url,
);
const silk = (): Record<string, unknown> =>
  JSON.parse(readFileSync(SILK, "utf8")) as Record<string, unknown>;

/** The silk theme with the value at a dotted path replaced. */
function withValue(
  path: string,
  value: unknown,
): Record<string, unknown> {
  const doc = silk();
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    node = (node[segment] as Record<string, unknown>);
  }
  node[segments[segments.length - 1] as string] = value;
  return doc;
}

/**
 * The silk theme with a new leaf added, creating groups as needed. A leaf is
 * written the way a theme writes one: its `$type` beside its `$value`.
 */
function withLeaf(
  path: string,
  type: string,
  value: unknown,
): Record<string, unknown> {
  const doc = silk();
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
    "var(--font-style-body-size)",
    "a paragraph spends the body style's size, not the ladder's",
  );
  deepStrictEqual(
    resolveTheme(JSON.parse(JSON.stringify(doc))).values["font.style.body.size"],
    "99px",
    "and the stylesheet resolves that variable to the theme's answer",
  );
});

test("a heading spends its default style, not the ladder step", async () => {
  const css = (await sheetFor("<h1>a</h1><h2>a</h2>", silk())).css;
  deepStrictEqual(
    declsFor(css, "h1")["font-size"],
    "var(--font-style-display-size)",
  );
  deepStrictEqual(
    declsFor(css, "h2")["font-size"],
    "var(--font-style-title-size)",
  );
});

test("small print, code, links, strong and quotations spend their styles", async () => {
  const css = (
    await sheetFor(
      "<small>a</small><code>a</code><a href=\"#\">a</a><strong>a</strong><blockquote>a</blockquote><figcaption>a</figcaption>",
      silk(),
    )
  ).css;
  deepStrictEqual(declsFor(css, "small")["font-size"], "var(--font-style-caption-size)");
  deepStrictEqual(declsFor(css, "code")["font-size"], "var(--font-style-code-size)");
  deepStrictEqual(declsFor(css, "a")["font-size"], "var(--font-style-link-size)");
  deepStrictEqual(
    declsFor(css, "strong")["font-weight"],
    "var(--font-style-body-strong-weight)",
  );
  deepStrictEqual(
    declsFor(css, "blockquote")["font-family"],
    "var(--font-style-quote-family)",
  );
  deepStrictEqual(
    declsFor(css, "figcaption")["font-size"],
    "var(--font-style-caption-strong-size)",
  );
});

test("a button spends the label style as a whole tuple", async () => {
  const css = (await sheetFor("<button>a</button>", silk())).css;
  const decls = declsFor(css, ":is(button,");
  deepStrictEqual(decls["font-family"], "var(--font-style-label-family)");
  deepStrictEqual(decls["font-size"], "var(--font-style-label-size)");
  deepStrictEqual(decls["font-weight"], "var(--font-style-label-weight)");
  deepStrictEqual(decls["letter-spacing"], "var(--font-style-label-tracking)");
  deepStrictEqual(decls["line-height"], "var(--font-style-label-leading)");
});

test("moving the label style moves the button", async () => {
  const doc = withValue("font.style.label.size", {
    $type: "dimension",
    $value: "99px",
  });
  const css = (await sheetFor("<button>a</button>", doc)).css;
  deepStrictEqual(
    declsFor(css, ":is(button,")["font-size"],
    "var(--font-style-label-size)",
  );
  deepStrictEqual(
    resolveTheme(JSON.parse(JSON.stringify(doc))).values["font.style.label.size"],
    "99px",
  );
});

test("a button re-points by naming another style", async () => {
  const doc = withLeaf("button.type", "typography", "body");
  const css = (await sheetFor("<button>a</button>", doc)).css;
  deepStrictEqual(
    declsFor(css, ":is(button,")["font-size"],
    "var(--font-style-body-size)",
    "button.type names the style the button reads",
  );
});

test("a stat's number, label and context spend their styles", async () => {
  const css = (
    await sheetFor(
      "<div class=\"stat\"><div class=\"stat-title\">a</div><div class=\"stat-value\">1</div><div class=\"stat-desc\">a</div></div>",
      silk(),
    )
  ).css;
  deepStrictEqual(
    declsFor(css, ".stat-value")["font-size"],
    "var(--font-style-stat-size)",
  );
  deepStrictEqual(
    declsFor(css, ".stat-title")["font-size"],
    "var(--font-style-stat-label-size)",
  );
  deepStrictEqual(
    declsFor(css, ".stat-desc")["font-size"],
    "var(--font-style-caption-size)",
  );
});

test("a table header spends the caption-strong style", async () => {
  const css = (
    await sheetFor("<table><tr><th>a</th></tr></table>", silk())
  ).css;
  deepStrictEqual(declsFor(css, "th")["font-size"], "var(--font-style-caption-strong-size)");
  deepStrictEqual(
    declsFor(css, "th")["font-weight"],
    "var(--font-style-caption-strong-weight)",
  );
});

test("one worked per-variant case: a danger button re-points on its own", async () => {
  const doc = withLeaf("button.danger.type", "typography", "body-strong");
  const css = (
    await sheetFor("<button class=\"danger\">a</button>", doc)
  ).css;
  deepStrictEqual(
    declsFor(css, ".danger")["font-size"],
    "var(--font-style-body-strong-size)",
    "the variant reads the style its reference names",
  );
  const plain = (await sheetFor("<button class=\"danger\">a</button>", silk())).css;
  assert(
    !("font-size" in declsFor(plain, ".danger")),
    "a variant with no reference inherits the base and states no type of its own",
  );
});

test("a dangling style reference is a theme error", async () => {
  const doc = withLeaf("button.type", "typography", "no-such-style");
  const parsed = parseTokens(JSON.parse(JSON.stringify(doc)));
  assert(parsed.ok, `fixture must parse: ${!parsed.ok ? parsed.error : ""}`);
  if (!parsed.ok) return;
  const report = validateTokens(parsed.tree);
  assert(
    report.issues.some(
      (issue) => issue.path === "button.type" && /no-such-style/.test(issue.message),
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
  const doc = withLeaf("button.danger.type", "typography", "body-strong");
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
