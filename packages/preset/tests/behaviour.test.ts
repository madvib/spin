import { assert, assertEquals } from "@std/assert";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { parseTokens } from "@spin/theme";
import { spinPreset } from "../src/index.ts";
import { splitTopLevel } from "../src/rules/primitives/derive.ts";
import { primitiveContracts } from "../src/rules/primitives/manifest.ts";

/**
 * The behavioural proof.
 *
 * Every assertion here is about a DECISION the preset makes — whether a
 * component ships for a document, which element it claims, whether a
 * declaration is stated at all — never about the spelling of a generated
 * value. A token reference in the output is the theme pipeline's business:
 * a test that reads one breaks the day the pipeline renames it, for no
 * behavioural reason. So no assertion below looks at the text of a value,
 * and the file contains no reference to a custom property.
 *
 * Where a decision needs the raw CSS (a merged selector list), it is parsed
 * structurally rather than matched as a string.
 */

const DEFAULT = new URL(
  "../../theme/src/themes/default.json",
  import.meta.url,
);
const theme = JSON.parse(readFileSync(DEFAULT, "utf8")) as Record<
  string,
  unknown
>;

type Options = Parameters<typeof spinPreset>[0];
type Result = GenerateResult<Map<string, ExtendedTokenInfo>>;

/** Generate a document, keeping the per-token rule data for inspection. */
async function generate(markup: string, extra: Options = {}): Promise<Result> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: theme }, ...extra })],
  });
  return await uno.generate(markup, { extendedInfo: true });
}

/** The selectors a token's winning rule emitted, in order. */
function selectorsFor(result: Result, token: string): string[] {
  const info = result.matched.get(token);
  if (info === undefined) return [];
  return info.data
    .map((util) => util[1])
    .filter((selector): selector is string => typeof selector === "string");
}

/** The declarations a token's winning rule emitted, as one body. */
function bodyFor(result: Result, token: string): string {
  const info = result.matched.get(token);
  assert(info !== undefined, `${token} must be matched by a rule`);
  assert(info.data.length > 0, `${token} must emit a declaration`);
  return info.data.map((util) => util[2]).join("");
}

/** A body's declarations as a property -> value table. */
function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of body.split(";")) {
    const text = entry.trim();
    if (text.length === 0) continue;
    const colon = text.indexOf(":");
    if (colon < 0) continue;
    out[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
  }
  return out;
}

/**
 * A document-free element, for asking which generated rules would apply.
 *
 * `matches` is enough of a CSS matcher for the question at hand: which
 * compound a selector's subject targets, and whether the element carries
 * the classes it requires. Pseudo-classes and combinators do not change
 * which element a selector claims, so they are ignored.
 */
interface FakeElement {
  matches(selector: string): boolean;
}

function fakeElement(
  tag: string,
  classes: readonly string[] = [],
): FakeElement {
  return {
    matches(selector: string): boolean {
      return splitTopLevel(selector).some((part) =>
        matchesSubject(subjectOf(part), tag, classes)
      );
    },
  };
}

/** The compound a selector ultimately targets, past any combinators. */
function subjectOf(selector: string): string {
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index];
    if (quote !== "") {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (
      depth === 0 &&
      (char === " " || char === ">" || char === "+" || char === "~")
    ) {
      start = index + 1;
    }
  }
  return selector.slice(start).trim();
}

/** Whether a compound (possibly a `:is()` group) targets the element. */
function matchesSubject(
  subject: string,
  tag: string,
  classes: readonly string[],
): boolean {
  const trimmed = subject.trim();
  if (trimmed.startsWith(":is(")) {
    const end = trimmed.lastIndexOf(")");
    if (end > 4) {
      return splitTopLevel(trimmed.slice(4, end)).some((alternative) =>
        matchesSubject(alternative, tag, classes)
      );
    }
  }
  const type = /^([a-zA-Z][a-zA-Z0-9-]*)/.exec(trimmed)?.[1];
  const required = [...trimmed.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map(
    ([, name = ""]) => name,
  );
  if (!required.every((name) => classes.includes(name))) return false;
  if (type !== undefined) return type === tag;
  // A class-only selector targets any element carrying the class.
  return required.length > 0;
}

/** Every selector list in a stylesheet, as its comma-separated parts. */
function cssSelectorLists(css: string): string[][] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const lists: string[][] = [];
  const pattern = /([^{}]*)\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutComments)) !== null) {
    if (match[1] === undefined) continue;
    const prelude = match[1].trim();
    if (prelude.length === 0 || prelude.startsWith("@")) continue;
    lists.push(splitTopLevel(prelude));
  }
  return lists;
}

/** The components the surface ships, and the markup that names each. */
const COMPONENTS: ReadonlyArray<
  { name: string; token: string; markup: string }
> = [
  { name: "button", token: "button", markup: "<button>Go</button>" },
  { name: "card", token: "card", markup: "<card>Body</card>" },
  { name: "badge", token: "badge", markup: "<badge>New</badge>" },
  { name: "checkbox", token: "checkbox", markup: "<checkbox></checkbox>" },
  { name: "switch", token: "switch", markup: "<switch></switch>" },
  {
    name: "details",
    token: "details",
    markup: "<details><summary>More</summary></details>",
  },
  { name: "progress", token: "progress", markup: "<progress></progress>" },
  { name: "dialog", token: "dialog", markup: "<dialog>Hi</dialog>" },
  {
    name: "table",
    token: "table",
    markup: "<table><tbody><tr><td>1</td></tr></tbody></table>",
  },
];

Deno.test("a component ships for the document that names it, and only then", async () => {
  // Breaks if a component's rules stop being registered for its tag, or if
  // the element extractor stops turning a tag into a token.
  const none = await generate("<div>plain</div>");
  for (const component of COMPONENTS) {
    const used = await generate(component.markup);
    const info = used.matched.get(component.token);
    assert(
      info !== undefined && info.data.length > 0,
      `${component.name} must emit its rules for its own markup`,
    );
    assert(
      !none.matched.has(component.token),
      `${component.name} must emit nothing for a document that never names it`,
    );
  }
});

Deno.test("primitives: false ships no component rules", async () => {
  // Breaks if the primitives option stops gating rule registration.
  const markup = COMPONENTS.map((component) => component.markup).join("");
  const result = await generate(markup, { primitives: false });
  for (const component of COMPONENTS) {
    assert(
      !result.matched.has(component.token),
      `${component.name} must ship nothing in a utility-only build`,
    );
  }
});

Deno.test("a primitives list enables only the components it names", async () => {
  // Breaks if a partial list enables everything, or enables the wrong set.
  const result = await generate("<button>Go</button><badge>New</badge>", {
    primitives: ["button"],
  });
  const named = result.matched.get("button");
  assert(
    named !== undefined && named.data.length > 0,
    "the named component must ship",
  );
  assert(
    !result.matched.has("badge"),
    "a component absent from the list must ship nothing",
  );
});

Deno.test("classless: false makes a primitive claim its class, not its tag", async () => {
  // Breaks if claim() ignores the mode, or returns the tag when classless
  // is off — either way the wrong element matches the rule.
  const markup = "<details><summary>More</summary></details>";
  const bare = fakeElement("details");
  const classed = fakeElement("details", ["details"]);

  const byDefault = await generate(markup);
  const defaultSelectors = selectorsFor(byDefault, "details");
  assert(
    defaultSelectors.some((selector) => bare.matches(selector)),
    "the bare element must be claimed while classless",
  );

  const byClass = await generate(markup, { classless: false });
  const classSelectors = selectorsFor(byClass, "details");
  assert(
    classSelectors.some((selector) => classed.matches(selector)),
    "the classed element must be claimed with classless off",
  );
  assert(
    !classSelectors.some((selector) => bare.matches(selector)),
    "the bare element must not be claimed with classless off",
  );
});

Deno.test("a cross-engine pseudo-element never shares a selector list", async () => {
  // Breaks if two yields carrying a -moz- pseudo-element get identical
  // bodies, because uno merges them into one selector list and the engine
  // that does not understand the selector drops the whole rule.
  const { css } = await generate("<progress></progress><meter></meter>");
  const crossEngine = cssSelectorLists(css).filter((parts) =>
    parts.some((part) => part.includes("-moz-"))
  );
  assert(
    crossEngine.length > 0,
    "the -moz- pseudo-element rules must ship at all",
  );
  for (const parts of crossEngine) {
    assertEquals(
      parts.length,
      1,
      `a -moz- pseudo-element shares a selector list: ${parts.join(", ")}`,
    );
  }
});

Deno.test("a theme that omits a token omits its declaration and nothing else", async () => {
  // Breaks if a missing token is emitted anyway — a dangling reference or an
  // invented fallback adds a declaration the full theme never stated — or if
  // the component drops its other declarations with it.
  const reduced = JSON.parse(
    readFileSync(DEFAULT, "utf8"),
  ) as Record<string, unknown>;
  delete (reduced["radius"] as Record<string, unknown>)["lg"];
  const reserialised = JSON.parse(JSON.stringify(reduced)) as Record<
    string,
    unknown
  >;

  const full = declarations(
    bodyFor(await generate("<card>Body</card>"), "card"),
  );
  const partial = declarations(
    bodyFor(
      await generate("<card>Body</card>", { themes: { light: reserialised } }),
      "card",
    ),
  );

  assert(
    Object.keys(partial).length > 0,
    "the card must still emit without the token",
  );
  assert(
    "display" in partial && "background-color" in partial,
    "the card must still state its other properties",
  );
  assert(
    "border-radius" in full,
    "the full theme must spend the token the reduced one omits",
  );
  for (const [property, value] of Object.entries(partial)) {
    assert(
      full[property] === value,
      `the card must not invent ${property} when the theme omits a token`,
    );
  }
  assert(
    Object.keys(partial).length < Object.keys(full).length,
    "omitting a token must actually omit its declaration",
  );
});

Deno.test("the motion clamp ships whenever an animated component does", async () => {
  // Breaks if the motion policy preflight is removed, or made conditional on
  // the component set rather than shipping with the animated component.
  const { css, matched } = await generate("<progress></progress>");
  assert(matched.has("progress"), "the animated component must ship");
  assert(
    css.includes("prefers-reduced-motion"),
    "the motion clamp must ship alongside it",
  );
});

Deno.test("a boolean token decides a component's shape", async () => {
  // The mechanism the studio surface will lean on: a theme answers a
  // yes/no question about a component and the rule reads the answer. A flag
  // that is on ships the styling that goes with it; a theme that omits the
  // flag ships nothing, so the component keeps whatever the browser does.
  const pill = structuredClone(theme) as Record<string, unknown>;
  (pill["badge"] as Record<string, unknown>)["pill"] = {
    $type: "boolean",
    $value: true,
  };
  const on = await generate("<badge>New</badge>", { themes: { light: pill } });
  const flat = structuredClone(theme) as Record<string, unknown>;
  delete (flat["badge"] as Record<string, unknown>)["pill"];
  const off = await generate("<badge>New</badge>", { themes: { light: flat } });
  const onRadius = declarations(bodyFor(on, "badge"))["border-radius"];
  const offDecls = declarations(bodyFor(off, "badge"));
  assert(
    onRadius !== undefined && onRadius.includes("radius-full"),
    "a theme that declares the flag pill gets the pill radius",
  );
  assert(
    !("border-radius" in offDecls),
    "a theme that does not declare the flag ships no radius",
  );
});

Deno.test("a badge with no badge group in the theme renders from global tokens", async () => {
  // Breaks if the badge rule stops falling back to global tokens when the
  // theme has no badge group — the badge would emit no font-size or padding,
  // rendering as an unstyled element.
  //
  // `border-radius` is deliberately NOT in that list any more: the pill is a
  // boolean token, and a flag has no value to fall back to. A theme that
  // declares no `badge.pill` has made no rounding decision, so the badge gets
  // the browser's square box rather than a radius nobody chose.
  const { badge: _omit, ...themeWithoutBadge } = theme;
  const result = await generate("<badge>New</badge>", {
    themes: { light: themeWithoutBadge },
  });
  const info = result.matched.get("badge");
  assert(
    info !== undefined && info.data.length > 0,
    "the badge must still match and emit rules without a badge group",
  );
  const decls = declarations(bodyFor(result, "badge"));
  assert(
    !("border-radius" in decls),
    "an undecided pill emits no radius rather than a default nobody chose",
  );
  assert(
    "font-size" in decls,
    "font-size must come from the global font-size token",
  );
  assert(
    "padding-inline-start" in decls || "padding-block-start" in decls,
    "padding must come from the global spacing token",
  );
});

/** A rule's yields as selector -> declaration tables, in emission order. */
function yieldsOf(
  result: Result,
  token: string,
): { selector: string; body: Record<string, string> }[] {
  const info = result.matched.get(token);
  assert(info !== undefined, `${token} must be matched by a rule`);
  return info.data
    .filter((util) =>
      typeof util[1] === "string" && typeof util[2] === "string"
    )
    .map((util) => ({
      selector: util[1] as string,
      body: declarations(util[2] as string),
    }));
}

Deno.test("the disclosure reveals its content instead of popping", async () => {
  // Breaks if the `::details-content` clamp and its transition are dropped:
  // the content then appears in one frame, which is the layout jump the
  // platform path exists to remove. Both states must ship, because the
  // interpolable pair — clamped while closed, restated while open — is the
  // whole animation.
  const result = await generate(
    "<details><summary>More</summary><p>Body</p></details>",
  );
  const yields = yieldsOf(result, "details").filter((yield_) =>
    yield_.selector.includes("::details-content")
  );
  assert(
    yields.length >= 2,
    "the closed and open states of the content must each ship a rule",
  );
  const closed = yields.find((yield_) => !yield_.selector.includes("[open]"));
  const open = yields.find((yield_) => yield_.selector.includes("[open]"));
  assert(
    closed !== undefined && open !== undefined,
    "the open state is a separate rule from the closed one",
  );
  assert(
    closed.body["block-size"] === "0",
    "the content is clamped while the disclosure is closed",
  );
  assert(
    "overflow" in closed.body,
    "the collapse needs a clip, or the content spills while it shrinks",
  );
  assert(
    closed.body["block-size"] !== open.body["block-size"],
    "the open state must restate the size, and that pair is what interpolates",
  );
  assert(
    closed.body["transition"]?.includes("block-size"),
    "the size is the property that moves",
  );
  assert(
    closed.body["transition"]?.includes("content-visibility"),
    "the visibility moves too, and discretely",
  );
  assert(
    closed.body["transition"]?.includes("allow-discrete"),
    "allow-discrete is what lets the visibility change at all",
  );
});

Deno.test("the divider turns on its side without carrying its horizontal edge", async () => {
  // Breaks if the vertical variant states no length, no room beside it, or
  // draws its line on the block edge — which is where the horizontal divider
  // draws its own.
  const result = await generate('<hr class="divider-vertical">');
  const selector = selectorsFor(result, "divider-vertical")[0];
  assert(selector !== undefined, "the vertical divider must ship its rule");
  assert(
    fakeElement("hr", ["divider-vertical"]).matches(selector),
    "the variant must claim the element it is written on",
  );
  const body = declarations(bodyFor(result, "divider-vertical"));
  assert(
    "inline-size" in body,
    "the zero inline size is what makes it a rule rather than a block",
  );
  assert("block-size" in body, "a rule needs a length");
  assert("margin-inline" in body, "a rule between items needs room beside it");
  assert(
    "margin-block" in body,
    "the base divider's block margin must be reset",
  );
  assert(
    "border-inline-start" in body,
    "the line is drawn on the inline edge, the one the base leaves bare",
  );
});

Deno.test("the divider ships a dashed rule beside the solid one", async () => {
  // Breaks if the dashed variant drops the border, or draws nothing the base
  // rule does not — a second tone of separation is the whole point of it.
  const body = declarations(
    bodyFor(await generate('<hr class="divider-dashed">'), "divider-dashed"),
  );
  assert(
    "border-block-start" in body,
    "the dashed rule still draws the horizontal line the base draws",
  );
  assert(
    body["border-block-start"]?.includes("dashed"),
    "the rule is dashed rather than a restatement of the solid base",
  );
});

Deno.test("an avatar is the containing block its status dot positions against", async () => {
  // Breaks if the face stops being positioned: the dot then measures itself
  // against the nearest positioned ancestor, which is not the face.
  const body = declarations(
    bodyFor(
      await generate('<img class="avatar" src="a.svg" alt="">'),
      "avatar",
    ),
  );
  assert(
    body["position"] === "relative",
    "the face is the containing block the dot is placed against",
  );
});

Deno.test("an avatar ring is painted outside the face", async () => {
  // Breaks if the ring becomes a border: a face is fixed to the theme's edge
  // in a border-box, so a border inside it shrinks the image the rule exists
  // to frame.
  const body = declarations(
    bodyFor(
      await generate('<img class="avatar avatar-ring" src="a.svg" alt="">'),
      "avatar-ring",
    ),
  );
  assert(
    "box-shadow" in body,
    "a shadow paints outside the border box, which leaves the edge intact",
  );
});

Deno.test("an avatar's status dot is placed in the trailing corner", async () => {
  // Breaks if the dot returns to flow — it would then push the face's box
  // instead of sitting on it — or stops spending the success token.
  const body = declarations(
    bodyFor(
      await generate('<span class="avatar-status"></span>'),
      "avatar-status",
    ),
  );
  assert(
    body["position"] === "absolute",
    "the dot is placed against the face rather than laid out beside it",
  );
  assert(
    "inset-block-end" in body && "inset-inline-end" in body,
    "the dot sits in the trailing corner, where a status reads at a glance",
  );
  assert(
    "background-color" in body,
    "the dot reads the semantic success token",
  );
  assert(
    "aspect-ratio" in body,
    "the dot scales with the face it sits on, and stays a dot",
  );
});

/**
 * The type ladder is the product's; nothing in it may out-size a page's
 * own heading. A button bigger than the h2 above it is an app that cannot
 * say what its hierarchy is — and the fix is the ladder, not a local
 * override.
 *
 * The semantic-typography components are exempt because they ARE the ladder:
 * `prose` renders h1 through h6 and the code family shares its type helper.
 */
Deno.test("no component's type out-sizes the page's own heading", () => {
  const EXEMPT = new Set(["prose", "hr", "kbd"]);
  const parsed = parseTokens(
    JSON.stringify({ font: theme["font"] }),
  );
  assert(parsed.ok, "the theme's type ladder must parse");
  const sizeOf: Record<string, number> = {};
  const font = (theme["font"] ?? {}) as Record<string, never>;
  const size = (font as unknown as { size: Record<string, never> }).size;
  for (const [step, token] of Object.entries(size)) {
    const raw = (token as unknown as { $value?: string }).$value ?? "";
    const match = /^([\d.]+)rem$/.exec(raw);
    if (match) sizeOf[step] = Number(match[1]) * 16;
  }
  const heading = sizeOf["2xl"];
  assert(heading !== undefined && heading > 0, "the ladder must state the h2 step");
  for (const [name, contract] of Object.entries(primitiveContracts)) {
    if (EXEMPT.has(name)) continue;
    for (const read of contract.reads) {
      const step = /^--font-size-(.+)$/.exec(read);
      if (step === null) continue;
      const px = sizeOf[step[1] as string];
      assert(px !== undefined, `${name} reads a size the ladder omits`);
      assert(
        px <= heading,
        `${name} sets type at ${px}px, larger than the page's h2 (${heading}px)`,
      );
    }
  }
});
