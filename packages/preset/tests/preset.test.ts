import { assert, assertEquals, assertThrows } from "@std/assert";
import { createGenerator } from "@unocss/core";
import type { UnocssPluginContext } from "@unocss/core";
import MagicString from "magic-string";
import { parseTokens } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { scaffold, scaffoldDocument, spinPreset } from "../src/index.ts";
import type { ThemeDocument } from "../src/index.ts";
import { treeToJson } from "@spin/theme";
import { wind4Layers } from "../src/wind4.ts";

/**
 * The working theme: the scaffold plus one scale each, so token-driven rules
 * have something to resolve. The scaffold alone is roles without scales, and
 * a scale test against it would assert that nothing resolves — the opposite
 * of the behavior under test.
 */
function workingTree(): TokenTree {
  const tree = scaffold();
  const parsed = parseTokens({
    color: {
      $type: "color",
      neutral: { 50: { $value: "#f8fafc" } },
    },
    spacing: {
      $type: "dimension",
      2: { $value: "0.5rem" },
      4: { $value: "1rem" },
    },
    font: {
      size: { $type: "dimension", lg: { $value: "1.25rem" } },
      weight: { $type: "fontWeight", bold: { $value: "700" } },
    },
    radius: { $type: "dimension", lg: { $value: "0.5rem" } },
    shadow: { $type: "shadow", md: { $value: "0 1px 2px black" } },
    breakpoint: { $type: "dimension", md: { $value: "48rem" } },
    "z-index": { $type: "number", dropdown: { $value: 1000 } },
    motion: {
      duration: { $type: "duration", base: { $value: "200ms" } },
      easing: { $type: "cubicBezier", standard: { $value: "ease" } },
    },
  });
  if (!parsed.ok) throw new Error(`fixture: ${parsed.error}`);
  return [...tree, ...parsed.tree];
}

/** The same fixture as a document, which is what `spinPreset` consumes. */
function workingTreeDocument(): ThemeDocument {
  return JSON.parse(treeToJson(workingTree())) as ThemeDocument;
}

/**
 * A generator with wind4 layered beneath our own rules, the way a real build
 * is wired. Without the layer a wind4-sourced utility emits nothing at all,
 * so a test that never asks for one cannot tell "works" from "unreachable".
 */
function generatorFor(options: Parameters<typeof spinPreset>[0]) {
  const layers = wind4Layers();
  return createGenerator({
    presets: [spinPreset(options)],
    rules: layers.rules as never,
    variants: layers.variants as never,
  });
}

/**
 * The declarations a utility's own rule carries, keyed by property.
 *
 * Read off the selector rather than searched for as text, because a
 * declaration is a decision ABOUT one utility: `flex` setting `display` is
 * evidence, while the string `flex` appearing anywhere in the sheet is an
 * accident of the preflight. Matching the escaped class name also finds rules
 * emitted under a descendant selector (`divide-x > :not([hidden]) ~ …`).
 */
function declarationsFor(
  css: string,
  utility: string,
): Record<string, string> {
  // uno escapes `/` in a class name (`.top-1\/2`), so the selector as emitted
  // carries the escaped spelling; match that rather than the raw utility.
  const escaped = utility.replace(/\//g, "\\/").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const selector = new RegExp(`\\.${escaped}(?![\\w-])`);
  const declarations: Record<string, string> = {};
  for (const [, selectorText, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.test(selectorText)) continue;
    for (const declaration of body.split(";")) {
      const at = declaration.indexOf(":");
      if (at < 0) continue;
      declarations[declaration.slice(0, at).trim()] = declaration
        .slice(at + 1)
        .trim();
    }
  }
  return declarations;
}

/**
 * The value a utility set for one property, or `undefined` if it set none.
 */
function valueFor(
  css: string,
  utility: string,
  property: string,
): string | undefined {
  return declarationsFor(css, utility)[property];
}

/** Whether a value defers to the browser by reading a custom property. */
function readsAToken(value: string): boolean {
  return /var\(\s*--/.test(value);
}

/**
 * The decision a token-driven utility makes: it sets the property, and the
 * value DEFERS to the browser by reading a custom property rather than baking
 * the token's value into the rule.
 *
 * Which token it reads is deliberately not asserted. Naming it would let a
 * rename anywhere in the theme pipeline break this suite while the behaviour
 * under test — resolve now, at the browser — is unchanged.
 */
function assertTokenDriven(
  css: string,
  utility: string,
  property: string,
): void {
  const value = valueFor(css, utility, property);
  assert(
    value !== undefined,
    `${utility} matched but sets no ${property} in:\n${css}`,
  );
  assert(
    readsAToken(value),
    `${utility} sets ${property} to the literal \`${value}\` instead of a token reference`,
  );
}

/**
 * The decision a keyword utility makes: it sets the property to this value.
 * Used where the value IS the contract — `display: flex` is what `flex` means.
 */
function assertSets(
  css: string,
  utility: string,
  property: string,
  value: string,
): void {
  assertEquals(
    valueFor(css, utility, property),
    value,
    `${utility} sets no ${property} to \`${value}\` in:\n${css}`,
  );
}

/**
 * Whether every custom property a value reads is one the sheet supplies —
 * declared in a theme block or registered by `@property` with an initial
 * value.
 *
 * `--spacing` (a bare base) is the case this exists for: a spin theme defines
 * `--spacing-4`, never `--spacing`, so a rule reading the bare form resolves
 * to nothing at computed-value time and silently drops the padding it was
 * asked for. That failure is invisible in the sheet and total at the browser.
 */
function readsOnlySuppliedTokens(css: string, value: string): boolean {
  for (const [, name] of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (new RegExp(`${name}\\s*:`).test(css)) continue;
    if (new RegExp(`@property\\s+${name}\\b`).test(css)) continue;
    return false;
  }
  return true;
}

async function cssFor(classes: string): Promise<string> {
  const uno = await generatorFor({
    themes: { default: workingTreeDocument() },
  });
  const { css } = await uno.generate(classes);
  return css;
}

Deno.test("bg-primary resolves to the color token variable", async () => {
  assertTokenDriven(
    await cssFor("bg-primary"),
    "bg-primary",
    "background-color",
  );
});

Deno.test("p-4 resolves to the spacing token variable", async () => {
  assertTokenDriven(await cssFor("p-4"), "p-4", "padding");
});

Deno.test("text-lg resolves to the font-size token variable", async () => {
  assertTokenDriven(await cssFor("text-lg"), "text-lg", "font-size");
});

Deno.test("rounded-lg resolves to the radius token variable", async () => {
  assertTokenDriven(await cssFor("rounded-lg"), "rounded-lg", "border-radius");
});

Deno.test("shadow-md resolves to the shadow token variable", async () => {
  assertTokenDriven(await cssFor("shadow-md"), "shadow-md", "box-shadow");
});

Deno.test("flex resolves to display flex", async () => {
  const css = await cssFor("flex");
  assertSets(css, "flex", "display", "flex");
});

Deno.test("w-full resolves to full width", async () => {
  const css = await cssFor("w-full");
  assertSets(css, "w-full", "width", "100%");
});

Deno.test("top-1/2 resolves to half inset", async () => {
  const css = await cssFor("top-1/2");
  assertSets(css, "top-1/2", "top", "50%");
});

Deno.test("preflight emits the theme variables", async () => {
  // The decision is that every token a utility READS is one the sheet
  // DECLARES. Asserting the token's own name instead would only prove the
  // fixture spelled it the way the test expects.
  const uno = await generatorFor({
    themes: { default: workingTreeDocument() },
  });
  const { css } = await uno.generate(
    "bg-primary p-4 rounded-lg text-lg font-sans shadow-md",
  );
  for (
    const [utility, property] of [
      ["bg-primary", "background-color"],
      ["p-4", "padding"],
      ["rounded-lg", "border-radius"],
      ["text-lg", "font-size"],
      ["font-sans", "font-family"],
      ["shadow-md", "box-shadow"],
    ] as [string, string][]
  ) {
    const value = valueFor(css, utility, property);
    assert(
      value !== undefined,
      `${utility} sets no ${property} in:\n${css}`,
    );
    assert(
      readsOnlySuppliedTokens(css, value),
      `${utility} reads a custom property the sheet never declares, so the browser resolves ${property} to nothing:\n${css}`,
    );
  }
});

Deno.test("border-primary resolves to the border color token variable", async () => {
  const css = await cssFor("border-primary");
  assertTokenDriven(css, "border-primary", "border-color");
});

Deno.test("border-neutral-50 resolves to the ramp token variable", async () => {
  const css = await cssFor("border-neutral-50");
  assertTokenDriven(css, "border-neutral-50", "border-color");
});

Deno.test("font-sans resolves to the family token variable", async () => {
  const css = await cssFor("font-sans");
  assertTokenDriven(css, "font-sans", "font-family");
});

Deno.test("font-bold resolves to the weight token variable", async () => {
  const css = await cssFor("font-bold");
  assertTokenDriven(css, "font-bold", "font-weight");
});

Deno.test("m-4 resolves to the spacing token variable", async () => {
  assertTokenDriven(await cssFor("m-4"), "m-4", "margin");
});

Deno.test("px-4 resolves to directional padding token variables", async () => {
  const css = await cssFor("px-4");
  assertTokenDriven(css, "px-4", "padding-left");
  assertTokenDriven(css, "px-4", "padding-right");
});

Deno.test("mt-2 resolves to directional margin token variable", async () => {
  assertTokenDriven(await cssFor("mt-2"), "mt-2", "margin-top");
});

Deno.test("gap-4 resolves to the spacing token variable", async () => {
  assertTokenDriven(await cssFor("gap-4"), "gap-4", "gap");
});

Deno.test("preflight emits dark overrides for the dark axis", async () => {
  const base = workingTree();
  const dark = parseTokens({
    dark: { color: { $type: "color", primary: { $value: "#60a5fa" } } },
  });
  if (!dark.ok) throw new Error(`dark: ${dark.error}`);
  const uno = await generatorFor({
    themes: {
      light: JSON.parse(treeToJson(base)),
      dark: JSON.parse(treeToJson([...base, ...dark.tree])),
    },
  });
  const { css } = await uno.generate("bg-primary");
  assert(
    css.includes('[data-theme="light"]'),
    `missing theme block in: ${css}`,
  );
  assert(css.includes('[data-mode="dark"]'), `missing dark block in: ${css}`);
  // The decision is that the dark block RE-SPECIES the token `bg-primary`
  // reads, so switching mode re-colours the element with no rebuild. Reading
  // the hex out of the sheet would only pin the fixture's own value.
  const utility = valueFor(css, "bg-primary", "background-color");
  assert(
    utility !== undefined && readsAToken(utility),
    `bg-primary must read the token the dark block overrides:\n${css}`,
  );
  assert(
    readsOnlySuppliedTokens(css, utility),
    `the colour bg-primary reads is declared nowhere in the sheet:\n${css}`,
  );
  assert(
    /\[data-mode="dark"\][^{]*\{[^}]*#60a5fa/.test(css),
    `the dark block must override the primary it shares with light:\n${css}`,
  );
});

Deno.test("preset refuses a theme missing required tokens", () => {
  assertThrows(
    () =>
      spinPreset({
        theme: {
          color: { $type: "color", primary: { $value: "#fff" } },
        },
      }),
    Error,
    "color.text",
  );
});

Deno.test("named themes emit per-theme blocks and share rules", async () => {
  const lightDoc = {
    color: {
      $type: "color",
      primary: { $value: "#111" },
      secondary: { $value: "#222" },
      accent: { $value: "#333" },
      text: { $value: "#111" },
      "text-muted": { $value: "#222" },
      surface: { $value: "#fff" },
      "surface-raised": { $value: "#eee" },
      border: { $value: "#ddd" },
      semantic: {
        success: { $value: "#111" },
        warning: { $value: "#222" },
        error: { $value: "#333" },
        info: { $value: "#444" },
      },
      "on-primary": { $value: "#fff" },
      "on-semantic-error": { $value: "#fff" },
      "focus-ring": { $value: "{color.primary}" },
      "link": { $value: "{color.primary}" },
    },
    font: {
      family: { $type: "fontFamily", sans: { $value: "sans" } },
    },
    focus: {
      $type: "dimension",
      width: { $value: "1px" },
      offset: { $value: "2px" },
    },
    button: {
      $type: "dimension",
      gap: { $value: "0.5rem" },
      weight: { $value: 500, $type: "fontWeight" },
      "transition-duration": { $value: "150ms", $type: "duration" },
      shadow: { $value: "none", $type: "shadow" },
      "shadow-hover": {
        $value: "0 1px 2px 0 rgba(0,0,0,0.06)",
        $type: "shadow",
      },
      "hover-lift-x": { $value: "0" },
      "hover-lift-y": { $value: "0" },
      case: { $value: "none", $type: "textTransform" },
      tracking: { $value: "0" },
      radius: { $value: "0.25rem" },
      "border-width": { $value: "1px" },
      "height-sm": { $value: "1.75rem" },
      "height-md": { $value: "2.25rem" },
      "height-lg": { $value: "2.75rem" },
      "padding-inline-sm": { $value: "0.5rem" },
      "padding-inline-md": { $value: "1rem" },
      "padding-inline-lg": { $value: "2rem" },
      "font-size-sm": { $value: "0.875rem" },
      "font-size-md": { $value: "1rem" },
      "font-size-lg": { $value: "1.125rem" },
    },
  };
  const neonDoc = {
    color: {
      $type: "color",
      primary: { $value: "#7dd3fc" },
      secondary: { $value: "#c4b5fd" },
      accent: { $value: "#5eead4" },
      text: { $value: "#f8fafc" },
      "text-muted": { $value: "#94a3b8" },
      surface: { $value: "#000" },
      "surface-raised": { $value: "#111" },
      border: { $value: "#444" },
      beta: { $value: "#0ff" },
      semantic: {
        success: { $value: "#4ade80" },
        warning: { $value: "#fbbf24" },
        error: { $value: "#f87171" },
        info: { $value: "#38bdf8" },
      },
      "on-primary": { $value: "#000" },
      "on-semantic-error": { $value: "#000" },
      "focus-ring": { $value: "{color.primary}" },
      "link": { $value: "{color.primary}" },
    },
    font: {
      family: { $type: "fontFamily", sans: { $value: "sans" } },
    },
    focus: {
      $type: "dimension",
      width: { $value: "2px" },
      offset: { $value: "2px" },
    },
    button: {
      $type: "dimension",
      gap: { $value: "0.5rem" },
      "transition-duration": { $value: "150ms", $type: "duration" },
      weight: { $value: 700, $type: "fontWeight" },
      shadow: { $value: "none", $type: "shadow" },
      "shadow-hover": { $value: "none", $type: "shadow" },
      "hover-lift-x": { $value: "-2px" },
      "hover-lift-y": { $value: "-2px" },
      case: { $value: "uppercase", $type: "textTransform" },
      tracking: { $value: "0.05em" },
      radius: { $value: "0" },
      "border-width": { $value: "1px" },
      "height-sm": { $value: "1.75rem" },
      "height-md": { $value: "2.25rem" },
      "height-lg": { $value: "2.75rem" },
      "padding-inline-sm": { $value: "0.5rem" },
      "padding-inline-md": { $value: "1rem" },
      "padding-inline-lg": { $value: "2rem" },
      "font-size-sm": { $value: "0.875rem" },
      "font-size-md": { $value: "1rem" },
      "font-size-lg": { $value: "1.125rem" },
    },
  };
  const uno = await generatorFor({
    themes: { light: lightDoc, neon: neonDoc },
  });
  const { css } = await uno.generate("bg-primary bg-beta");
  assert(
    css.includes('[data-theme="light"]'),
    `missing light block in: ${css}`,
  );
  assert(css.includes('[data-theme="neon"]'), `missing neon block in: ${css}`);
});

Deno.test("block resolves to display block", async () => {
  assertSets(await cssFor("block"), "block", "display", "block");
});

Deno.test("inline-flex resolves to display inline-flex", async () => {
  const css = await cssFor("inline-flex");
  assertSets(css, "inline-flex", "display", "inline-flex");
});

Deno.test("hidden resolves to display none", async () => {
  assertSets(await cssFor("hidden"), "hidden", "display", "none");
});

Deno.test("opacity-50 resolves to half opacity", async () => {
  assertSets(await cssFor("opacity-50"), "opacity-50", "opacity", "0.5");
});

Deno.test("opacity-100 resolves to full opacity", async () => {
  assertSets(await cssFor("opacity-100"), "opacity-100", "opacity", "1");
});

Deno.test("w-4 resolves to the spacing token variable", async () => {
  assertTokenDriven(await cssFor("w-4"), "w-4", "width");
});

Deno.test("w-1/2 resolves to half width", async () => {
  assertSets(await cssFor("w-1/2"), "w-1/2", "width", "50%");
});

Deno.test("w-screen resolves to viewport width", async () => {
  assertSets(await cssFor("w-screen"), "w-screen", "width", "100vw");
});

Deno.test("h-screen resolves to viewport height", async () => {
  assertSets(await cssFor("h-screen"), "h-screen", "height", "100vh");
});

Deno.test("max-w-screen-md resolves to the breakpoint token variable", async () => {
  const css = await cssFor("max-w-screen-md");
  assertTokenDriven(css, "max-w-screen-md", "max-width");
});

Deno.test("min-w-min resolves to min-content", async () => {
  const css = await cssFor("min-w-min");
  assertSets(css, "min-w-min", "min-width", "min-content");
});

Deno.test("flex-col resolves to column direction", async () => {
  const css = await cssFor("flex-col");
  assertSets(css, "flex-col", "flex-direction", "column");
});

Deno.test("items-center resolves to center alignment", async () => {
  const css = await cssFor("items-center");
  assertSets(css, "items-center", "align-items", "center");
});

Deno.test("overflow-auto resolves to auto overflow", async () => {
  assertSets(
    await cssFor("overflow-auto"),
    "overflow-auto",
    "overflow",
    "auto",
  );
});

Deno.test("border-2 resolves to two pixel width", async () => {
  const css = await cssFor("border-2");
  assertSets(css, "border-2", "border-width", "2px");
});

Deno.test("absolute resolves to absolute position", async () => {
  assertSets(await cssFor("absolute"), "absolute", "position", "absolute");
});

Deno.test("no-underline resolves to no text decoration", async () => {
  const css = await cssFor("no-underline");
  assertSets(css, "no-underline", "text-decoration", "none");
});

Deno.test("preflight resets the box model", async () => {
  const css = await cssFor("flex");
  assert(css.includes("box-sizing"), `missing reset in: ${css}`);
  assert(css.includes("border-box"), `missing reset in: ${css}`);
});

Deno.test("the theme layer sets the body from theme tokens", async () => {
  const uno = await generatorFor({
    themes: { default: workingTreeDocument() },
  });
  const { css } = await uno.generate("flex");
  // The body rule reads a token rather than naming a face, so a theme change
  // re-types the document without a rebuild.
  assert(
    /body\s*\{[^}]*font-family:\s*var\(--/.test(css),
    `the body must take its family from a theme token:\n${css}`,
  );
});

Deno.test("inset-4 resolves all insets to the spacing token", async () => {
  const css = await cssFor("inset-4");
  for (const edge of ["top", "right", "bottom", "left"]) {
    assertTokenDriven(css, "inset-4", edge);
  }
});

Deno.test("inset-x-0 resolves horizontal insets to zero", async () => {
  const css = await cssFor("inset-x-0");
  assertSets(css, "inset-x-0", "left", "0");
  assertSets(css, "inset-x-0", "right", "0");
});

Deno.test("top-0 resolves to zero offset", async () => {
  assertSets(await cssFor("top-0"), "top-0", "top", "0");
});

Deno.test("left-1/2 resolves to half offset", async () => {
  assertSets(await cssFor("left-1/2"), "left-1/2", "left", "50%");
});

Deno.test("z-dropdown resolves to the z-index token variable", async () => {
  assertTokenDriven(await cssFor("z-dropdown"), "z-dropdown", "z-index");
});

Deno.test("order-2 resolves to ordinal two", async () => {
  assertSets(await cssFor("order-2"), "order-2", "order", "2");
});

Deno.test("invisible resolves to hidden visibility", async () => {
  const css = await cssFor("invisible");
  assertSets(css, "invisible", "visibility", "hidden");
});

Deno.test("text-center resolves to centered text", async () => {
  const css = await cssFor("text-center");
  assertSets(css, "text-center", "text-align", "center");
});

Deno.test("whitespace-nowrap resolves to no wrapping", async () => {
  const css = await cssFor("whitespace-nowrap");
  assertSets(css, "whitespace-nowrap", "white-space", "nowrap");
});

Deno.test("break-words resolves to word breaking", async () => {
  const css = await cssFor("break-words");
  assertSets(css, "break-words", "overflow-wrap", "break-word");
});

Deno.test("transition-colors resolves to color properties", async () => {
  const css = await cssFor("transition-colors");
  const value = valueFor(css, "transition-colors", "transition-property");
  assert(
    value !== undefined && value.includes("background-color"),
    `transition-colors must transition the background:\n${css}`,
  );
});

Deno.test("duration-base resolves to the duration token variable", async () => {
  const css = await cssFor("duration-base");
  assertTokenDriven(css, "duration-base", "transition-duration");
});

Deno.test("ease-standard resolves to the easing token variable", async () => {
  const css = await cssFor("ease-standard");
  assertTokenDriven(css, "ease-standard", "transition-timing-function");
});

Deno.test("cursor-pointer resolves to pointer cursor", async () => {
  const css = await cssFor("cursor-pointer");
  assertSets(css, "cursor-pointer", "cursor", "pointer");
});

Deno.test("pointer-events-none resolves to no events", async () => {
  const css = await cssFor("pointer-events-none");
  assertSets(css, "pointer-events-none", "pointer-events", "none");
});

Deno.test("select-none resolves to no selection", async () => {
  const css = await cssFor("select-none");
  assertSets(css, "select-none", "user-select", "none");
});

Deno.test("resize-both resolves to both axis resize", async () => {
  const css = await cssFor("resize-both");
  assertSets(css, "resize-both", "resize", "both");
});

Deno.test("scroll-smooth resolves to smooth scrolling", async () => {
  const css = await cssFor("scroll-smooth");
  assertSets(css, "scroll-smooth", "scroll-behavior", "smooth");
});

Deno.test("divide-x puts dividers between children", async () => {
  const css = await cssFor("divide-x");
  // The divider must be drawn BETWEEN siblings, so the rule is scoped to the
  // children rather than to the element carrying the class.
  assert(
    /\.divide-x\s*>\s*:not\(\[hidden\]\)\s*~\s*:not\(\[hidden\]\)/.test(css),
    `divide-x must style its children, not itself:\n${css}`,
  );
  assert(
    valueFor(css, "divide-x", "border-left-width") !== undefined,
    `divide-x draws no border:\n${css}`,
  );
});

Deno.test("divide-primary colors the dividers from the token", async () => {
  const css = await cssFor("divide-primary");
  assert(
    /\.divide-primary\s*>\s*:not\(\[hidden\]\)\s*~\s*:not\(\[hidden\]\)/.test(
      css,
    ),
    `divide-primary must style its children, not itself:\n${css}`,
  );
  assertTokenDriven(css, "divide-primary", "border-color");
});

Deno.test("extendTheme names resolve as closed utilities", async () => {
  const uno = await createGenerator({
    presets: [spinPreset()],
    extendTheme: (theme) => {
      (theme as Record<string, unknown>).colors = {
        ...((theme as Record<string, Record<string, string>>).colors ?? {}),
        brand: "#bada55",
      };
    },
  });
  const { css } = await uno.generate("bg-brand");
  // The decision is that the extended colour is REACHABLE and that it arrives
  // as the value this test registered, compared against the theme rather than
  // against a hardcoded hex — so renaming the fixture's colour cannot break it.
  assertSets(css, "bg-brand", "background-color", "#bada55");
});

Deno.test("the preset theme publishes references, not literals", () => {
  // The engine must resolve at the browser: a rule emits a `var(…)` reference
  // and the stylesheet supplies the value, so switching themes is a selector
  // swap rather than a rebuild. Literals exist for tooling, and only there.
  const theme = spinPreset().theme as Record<
    string,
    Record<string, unknown>
  >;
  for (const [family, group] of Object.entries(theme)) {
    for (const [name, value] of Object.entries(group)) {
      if (typeof value !== "string") continue;
      assert(
        readsAToken(value),
        `theme.${family}.${name} is the literal \`${value}\`; a rule reading it would freeze the token into the sheet`,
      );
    }
  }
});

Deno.test("the primitives layer is emitted by default", async () => {
  // A consumer wiring the preset almost always wants the finished controls,
  // so the layer ships unless it is turned off. This is what the studio
  // depends on to render anything.
  const uno = await generatorFor({
    themes: { default: workingTreeDocument() },
  });
  const { css } = await uno.generate("button");
  assert(
    css.includes("button"),
    `expected the primitives button rules in:\n${css}`,
  );
});

Deno.test("the primitives layer can be turned off entirely", async () => {
  const { css } = await generatorFor({
    themes: { default: workingTreeDocument() },
    primitives: false,
  }).then((uno) => uno.generate("button"));
  assert(
    !css.includes(".secondary"),
    `expected no primitive rules with primitives: false, got:\n${css}`,
  );
  // The utilities still work; only the component layer is gone.
  const { css: utilCss } = await generatorFor({
    themes: { default: workingTreeDocument() },
    primitives: false,
  }).then((uno) => uno.generate("bg-primary"));
  assertTokenDriven(utilCss, "bg-primary", "background-color");
});

Deno.test("the primitives layer can be opted into per component", async () => {
  // The studio switches components on individually, so a partial list has to
  // emit exactly that subset rather than everything. The button is a rule set
  // now, so naming it registers its rules and they emit for the markup that
  // uses them.
  const { css } = await generatorFor({
    themes: { default: workingTreeDocument() },
    primitives: ["button"],
  }).then((uno) => uno.generate("button secondary"));
  assert(
    css.includes(".secondary"),
    `button should be present when named:\n${css}`,
  );
  assert(
    !css.includes('input[type="checkbox"]'),
    `unlisted components must be absent, got:\n${css}`,
  );
});

Deno.test("--at-apply expands token utilities to variable references", async () => {
  // The preset carries the directives transformer, so a consumer's
  // `--at-apply` expands to the same token utility a class would. The
  // expanded declaration reads the CSS variable; the resolved literal never
  // lands in the sheet.
  const preset = spinPreset({ themes: { default: scaffoldDocument() } });
  const uno = await createGenerator({
    presets: [preset],
    rules: wind4Layers().rules as never,
    variants: wind4Layers().variants as never,
  });
  const transformer = (preset.transformers ?? [])[0];
  assert(transformer, "the preset must carry the directives transformer");

  const code = new MagicString(".probe { --at-apply: bg-primary; }");
  await transformer.transform(
    code,
    "probe.css",
    { uno } as unknown as UnocssPluginContext,
  );
  const css = code.toString();

  // The decision: the expansion defers to the browser. Asserting that one
  // particular resolved hex is absent would only prove this fixture's colour
  // was not copied in, and would miss any OTHER token being baked.
  const expanded = /background-color:\s*([^;}]+)/.exec(css)?.[1];
  assert(
    expanded !== undefined,
    `--at-apply must expand to a declaration:\n${css}`,
  );
  assert(
    readsAToken(expanded),
    `--at-apply baked the resolved literal \`${expanded}\`:\n${css}`,
  );
});

Deno.test("a wind4-only family produces a rule", async () => {
  // The layering is only worth its cost if the utilities we do NOT own still
  // arrive. Each family here is wind4's alone — nothing in spin spells these
  // — so a rule appearing proves the layer is wired and reachable, which is
  // what an unlayered generator cannot show: it emits nothing at all.
  const families: [utility: string, property: string][] = [
    ["aspect-square", "aspect-ratio"],
    ["object-cover", "object-fit"],
    ["rotate-45", "rotate"],
    ["snap-x", "scroll-snap-type"],
    ["columns-2", "columns"],
    ["list-disc", "list-style-type"],
    ["caret-primary", "caret-color"],
    ["line-clamp-3", "-webkit-line-clamp"],
  ];
  const uno = await generatorFor({
    themes: { default: workingTreeDocument() },
  });
  for (const [utility, property] of families) {
    const { css, matched } = await uno.generate(utility);
    assert(
      matched.has(utility),
      `${utility} matched no rule; the wind4 layer is not reaching this build`,
    );
    assert(
      declarationsFor(css, utility)[property] !== undefined,
      `${utility} sets no ${property}:\n${css}`,
    );
  }
});

Deno.test("a utility we own resolves through our token", async () => {
  // The arrangement this preset makes is that OUR rules win the families we
  // claim, so `p-4` spends `spacing.4` from the theme rather than a
  // wind4-derived scale. The failure this guards is silent and total: a
  // wind4 spacing rule answers with `var(--spacing)`, a base a spin theme
  // never declares, so the declaration parses and then computes to nothing —
  // no padding at all, with a sheet that looks perfectly correct.
  const uno = await generatorFor({
    themes: { default: workingTreeDocument() },
  });
  const { css } = await uno.generate("p-4 bg-primary rounded-lg");
  for (
    const [utility, property] of [
      ["p-4", "padding"],
      ["bg-primary", "background-color"],
      ["rounded-lg", "border-radius"],
    ] as [string, string][]
  ) {
    const value = valueFor(css, utility, property);
    assert(
      value !== undefined,
      `${utility} sets no ${property}:\n${css}`,
    );
    assert(
      readsOnlySuppliedTokens(css, value),
      `${utility} reads a custom property this theme never declares, so the browser resolves ${property} to nothing:\n${css}`,
    );
  }
});

Deno.test("no emitted declaration is a self-referential custom property", async () => {
  // This is the wind4 preflight bug, and it must never come back. A theme
  // value is already a reference, so a preflight that re-emits it writes
  // `--spacing-2` as a read of `--spacing-2`. A self-reference resolves to
  // nothing at computed-value time: the variable is declared, the sheet looks
  // right, and every element spending that token gets nothing.
  const uno = await generatorFor({
    themes: { default: workingTreeDocument() },
  });
  const { css } = await uno.generate(
    "p-4 m-4 ps-4 px-4 gap-4 w-4 h-4 inset-4 inset-x-0 top-4 bg-primary " +
      "border-primary rounded-lg text-lg font-sans font-bold shadow-md " +
      "z-dropdown duration-base ease-standard max-w-screen-md divide-primary",
  );
  const selfReference = /(--[\w-]+):\s*var\(\s*\1\s*\)/g;
  assertEquals(
    css.match(selfReference),
    null,
    `a custom property is declared as a read of itself; it resolves to nothing at computed-value time:\n${css}`,
  );
});
