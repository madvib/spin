import { assert, assertEquals } from "@std/assert";
import {
  createGenerator,
  type ExtendedTokenInfo,
  type GenerateResult,
} from "@unocss/core";
import { readFileSync } from "node:fs";
import { spinPreset } from "../src/index.ts";
import { splitTopLevel } from "../src/rules/primitives/derive.ts";

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
    (match) => match[1],
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

Deno.test("two tone utilities are each honoured in one document", async () => {
  // Breaks if a tone utility is dropped or shadowed, or if two tone rules
  // collapse into one — the collision that made a component's tones invisible.
  const result = await generate(
    '<button class="tone-accent">Go</button>' +
      '<card class="tone-danger">Body</card>',
  );
  for (const tone of ["tone-accent", "tone-danger"]) {
    const info = result.matched.get(tone);
    assert(
      info !== undefined && info.data.length > 0,
      `${tone} must emit in a document that uses it`,
    );
    const shim = fakeElement("div", [tone]);
    assert(
      selectorsFor(result, tone).some((selector) => shim.matches(selector)),
      `${tone} must claim its class`,
    );
  }
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

Deno.test("a badge with no badge group in the theme renders from global tokens", async () => {
  // Breaks if the badge rule stops falling back to global tokens when the
  // theme has no badge group — the badge would emit no border-radius,
  // font-size, or padding, rendering as an unstyled element.
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
    "border-radius" in decls,
    "border-radius must come from the global radius token",
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
