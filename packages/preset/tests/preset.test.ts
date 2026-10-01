import { assert, assertThrows } from "@std/assert";
import { createGenerator } from "@unocss/core";
import type { UnocssPluginContext } from "@unocss/core";
import MagicString from "magic-string";
import { parseTokens } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { scaffold, scaffoldDocument, spinPreset } from "../src/index.ts";
import type { ThemeDocument } from "../src/index.ts";
import { treeToJson } from "@spin/theme";

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

async function cssFor(classes: string): Promise<string> {
  const uno = await createGenerator({
    presets: [spinPreset({ theme: workingTreeDocument() })],
  });
  const { css } = await uno.generate(classes);
  return css;
}

Deno.test("bg-primary resolves to the color token variable", async () => {
  const css = await cssFor("bg-primary");
  assert(css.includes("background-color"), `missing property in: ${css}`);
  assert(css.includes("var(--color-primary)"), `missing var in: ${css}`);
});

Deno.test("p-4 resolves to the spacing token variable", async () => {
  const css = await cssFor("p-4");
  assert(css.includes("padding"), `missing property in: ${css}`);
  assert(css.includes("var(--spacing-4)"), `missing var in: ${css}`);
});

Deno.test("text-lg resolves to the font-size token variable", async () => {
  const css = await cssFor("text-lg");
  assert(css.includes("font-size"), `missing property in: ${css}`);
  assert(css.includes("var(--font-size-lg)"), `missing var in: ${css}`);
});

Deno.test("rounded-lg resolves to the radius token variable", async () => {
  const css = await cssFor("rounded-lg");
  assert(css.includes("border-radius"), `missing property in: ${css}`);
  assert(css.includes("var(--radius-lg)"), `missing var in: ${css}`);
});

Deno.test("shadow-md resolves to the shadow token variable", async () => {
  const css = await cssFor("shadow-md");
  assert(css.includes("box-shadow"), `missing property in: ${css}`);
  assert(css.includes("var(--shadow-md)"), `missing var in: ${css}`);
});

Deno.test("flex resolves to display flex", async () => {
  const css = await cssFor("flex");
  assert(css.includes("display"), `missing property in: ${css}`);
  assert(css.includes("flex"), `missing value in: ${css}`);
});

Deno.test("w-full resolves to full width", async () => {
  const css = await cssFor("w-full");
  assert(css.includes("width"), `missing property in: ${css}`);
  assert(css.includes("100%"), `missing value in: ${css}`);
});

Deno.test("top-1/2 resolves to half inset", async () => {
  const css = await cssFor("top-1/2");
  assert(css.includes("top"), `missing property in: ${css}`);
  assert(css.includes("50%"), `missing value in: ${css}`);
});

Deno.test("preflight emits the theme variables", async () => {
  const css = await cssFor("bg-primary");
  assert(css.includes("--color-primary"), `missing token var in: ${css}`);
  assert(css.includes("--spacing-4"), `missing token var in: ${css}`);
  assert(css.includes("--font-family-sans"), `missing token var in: ${css}`);
});

Deno.test("border-primary resolves to the border color token variable", async () => {
  const css = await cssFor("border-primary");
  assert(css.includes("border-color"), `missing property in: ${css}`);
  assert(css.includes("var(--color-primary)"), `missing var in: ${css}`);
});

Deno.test("border-neutral-50 resolves to the ramp token variable", async () => {
  const css = await cssFor("border-neutral-50");
  assert(css.includes("border-color"), `missing property in: ${css}`);
  assert(css.includes("var(--color-neutral-50)"), `missing var in: ${css}`);
});

Deno.test("font-sans resolves to the family token variable", async () => {
  const css = await cssFor("font-sans");
  assert(css.includes("font-family"), `missing property in: ${css}`);
  assert(css.includes("var(--font-family-sans)"), `missing var in: ${css}`);
});

Deno.test("font-bold resolves to the weight token variable", async () => {
  const css = await cssFor("font-bold");
  assert(css.includes("font-weight"), `missing property in: ${css}`);
  assert(css.includes("var(--font-weight-bold)"), `missing var in: ${css}`);
});

Deno.test("m-4 resolves to the spacing token variable", async () => {
  const css = await cssFor("m-4");
  assert(css.includes("margin"), `missing property in: ${css}`);
  assert(css.includes("var(--spacing-4)"), `missing var in: ${css}`);
});

Deno.test("px-4 resolves to directional padding token variables", async () => {
  const css = await cssFor("px-4");
  assert(css.includes("padding-left"), `missing property in: ${css}`);
  assert(css.includes("padding-right"), `missing property in: ${css}`);
  assert(css.includes("var(--spacing-4)"), `missing var in: ${css}`);
});

Deno.test("mt-2 resolves to directional margin token variable", async () => {
  const css = await cssFor("mt-2");
  assert(css.includes("margin-top"), `missing property in: ${css}`);
  assert(css.includes("var(--spacing-2)"), `missing var in: ${css}`);
});

Deno.test("gap-4 resolves to the spacing token variable", async () => {
  const css = await cssFor("gap-4");
  assert(css.includes("gap"), `missing property in: ${css}`);
  assert(css.includes("var(--spacing-4)"), `missing var in: ${css}`);
});

Deno.test("preflight emits dark overrides for the dark axis", async () => {
  const base = workingTree();
  const dark = parseTokens({
    dark: { color: { $type: "color", primary: { $value: "#60a5fa" } } },
  });
  if (!dark.ok) throw new Error(`dark: ${dark.error}`);
  const uno = await createGenerator({
    presets: [
      spinPreset({
        themes: {
          light: JSON.parse(treeToJson(base)),
          dark: JSON.parse(treeToJson([...base, ...dark.tree])),
        },
      }),
    ],
  });
  const { css } = await uno.generate("bg-primary");
  assert(
    css.includes('[data-theme="light"]'),
    `missing theme block in: ${css}`,
  );
  assert(css.includes('[data-mode="dark"]'), `missing dark block in: ${css}`);
  assert(css.includes("#60a5fa"), `missing dark primary value in: ${css}`);
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
      "on-danger": { $value: "#fff" },
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
      "on-danger": { $value: "#000" },
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
  const uno = await createGenerator({
    presets: [
      spinPreset({
        themes: { light: lightDoc, neon: neonDoc },
      }),
    ],
  });
  const { css } = await uno.generate("bg-primary bg-beta");
  assert(
    css.includes('[data-theme="light"]'),
    `missing light block in: ${css}`,
  );
  assert(css.includes('[data-theme="neon"]'), `missing neon block in: ${css}`);
  assert(css.includes("var(--color-beta)"), `missing union var in: ${css}`);
});

Deno.test("block resolves to display block", async () => {
  const css = await cssFor("block");
  assert(css.includes("display"), `missing property in: ${css}`);
  assert(css.includes("block"), `missing value in: ${css}`);
});

Deno.test("inline-flex resolves to display inline-flex", async () => {
  const css = await cssFor("inline-flex");
  assert(css.includes("display"), `missing property in: ${css}`);
  assert(css.includes("inline-flex"), `missing value in: ${css}`);
});

Deno.test("hidden resolves to display none", async () => {
  const css = await cssFor("hidden");
  assert(css.includes("display"), `missing property in: ${css}`);
  assert(css.includes("none"), `missing value in: ${css}`);
});

Deno.test("opacity-50 resolves to half opacity", async () => {
  const css = await cssFor("opacity-50");
  assert(css.includes("opacity"), `missing property in: ${css}`);
  assert(css.includes("0.5"), `missing value in: ${css}`);
});

Deno.test("opacity-100 resolves to full opacity", async () => {
  const css = await cssFor("opacity-100");
  assert(css.includes("opacity"), `missing property in: ${css}`);
  assert(css.includes(": 1") || css.includes(":1"), `missing value in: ${css}`);
});

Deno.test("w-4 resolves to the spacing token variable", async () => {
  const css = await cssFor("w-4");
  assert(css.includes("width"), `missing property in: ${css}`);
  assert(css.includes("var(--spacing-4)"), `missing var in: ${css}`);
});

Deno.test("w-1/2 resolves to half width", async () => {
  const css = await cssFor("w-1/2");
  assert(css.includes("width"), `missing property in: ${css}`);
  assert(css.includes("50%"), `missing value in: ${css}`);
});

Deno.test("w-screen resolves to viewport width", async () => {
  const css = await cssFor("w-screen");
  assert(css.includes("width"), `missing property in: ${css}`);
  assert(css.includes("100vw"), `missing value in: ${css}`);
});

Deno.test("h-screen resolves to viewport height", async () => {
  const css = await cssFor("h-screen");
  assert(css.includes("height"), `missing property in: ${css}`);
  assert(css.includes("100vh"), `missing value in: ${css}`);
});

Deno.test("max-w-screen-md resolves to the breakpoint token variable", async () => {
  const css = await cssFor("max-w-screen-md");
  assert(css.includes("max-width"), `missing property in: ${css}`);
  assert(css.includes("var(--breakpoint-md)"), `missing var in: ${css}`);
});

Deno.test("min-w-min resolves to min-content", async () => {
  const css = await cssFor("min-w-min");
  assert(css.includes("min-width"), `missing property in: ${css}`);
  assert(css.includes("min-content"), `missing value in: ${css}`);
});

Deno.test("flex-col resolves to column direction", async () => {
  const css = await cssFor("flex-col");
  assert(css.includes("flex-direction"), `missing property in: ${css}`);
  assert(css.includes("column"), `missing value in: ${css}`);
});

Deno.test("items-center resolves to center alignment", async () => {
  const css = await cssFor("items-center");
  assert(css.includes("align-items"), `missing property in: ${css}`);
  assert(css.includes("center"), `missing value in: ${css}`);
});

Deno.test("overflow-auto resolves to auto overflow", async () => {
  const css = await cssFor("overflow-auto");
  assert(css.includes("overflow"), `missing property in: ${css}`);
  assert(css.includes("auto"), `missing value in: ${css}`);
});

Deno.test("border-2 resolves to two pixel width", async () => {
  const css = await cssFor("border-2");
  assert(css.includes("border-width"), `missing property in: ${css}`);
  assert(css.includes("2px"), `missing value in: ${css}`);
});

Deno.test("absolute resolves to absolute position", async () => {
  const css = await cssFor("absolute");
  assert(css.includes("position"), `missing property in: ${css}`);
  assert(css.includes("absolute"), `missing value in: ${css}`);
});

Deno.test("no-underline resolves to no text decoration", async () => {
  const css = await cssFor("no-underline");
  assert(css.includes("text-decoration"), `missing property in: ${css}`);
  assert(css.includes("none"), `missing value in: ${css}`);
});

Deno.test("preflight resets the box model", async () => {
  const css = await cssFor("flex");
  assert(css.includes("box-sizing"), `missing reset in: ${css}`);
  assert(css.includes("border-box"), `missing reset in: ${css}`);
});

Deno.test("the theme layer sets the body from theme tokens", async () => {
  const uno = await createGenerator({ presets: [spinPreset()] });
  const { css } = await uno.generate("flex");
  assert(css.includes("font-family"), `missing base in: ${css}`);
  assert(css.includes("var(--font-family-sans)"), `missing var in: ${css}`);
  assert(css.includes("var(--color-text)"), `missing var in: ${css}`);
});

Deno.test("inset-4 resolves all insets to the spacing token", async () => {
  const css = await cssFor("inset-4");
  assert(css.includes("top"), `missing property in: ${css}`);
  assert(css.includes("var(--spacing-4)"), `missing var in: ${css}`);
});

Deno.test("inset-x-0 resolves horizontal insets to zero", async () => {
  const css = await cssFor("inset-x-0");
  assert(css.includes("left"), `missing property in: ${css}`);
  assert(css.includes("right"), `missing property in: ${css}`);
});

Deno.test("top-0 resolves to zero offset", async () => {
  const css = await cssFor("top-0");
  assert(css.includes("top"), `missing property in: ${css}`);
  assert(css.includes(": 0") || css.includes(":0"), `missing value in: ${css}`);
});

Deno.test("left-1/2 resolves to half offset", async () => {
  const css = await cssFor("left-1/2");
  assert(css.includes("left"), `missing property in: ${css}`);
  assert(css.includes("50%"), `missing value in: ${css}`);
});

Deno.test("z-dropdown resolves to the z-index token variable", async () => {
  const css = await cssFor("z-dropdown");
  assert(css.includes("z-index"), `missing property in: ${css}`);
  assert(css.includes("var(--z-index-dropdown)"), `missing var in: ${css}`);
});

Deno.test("order-2 resolves to ordinal two", async () => {
  const css = await cssFor("order-2");
  assert(css.includes("order"), `missing property in: ${css}`);
  assert(css.includes("2"), `missing value in: ${css}`);
});

Deno.test("invisible resolves to hidden visibility", async () => {
  const css = await cssFor("invisible");
  assert(css.includes("visibility"), `missing property in: ${css}`);
  assert(css.includes("hidden"), `missing value in: ${css}`);
});

Deno.test("text-center resolves to centered text", async () => {
  const css = await cssFor("text-center");
  assert(css.includes("text-align"), `missing property in: ${css}`);
  assert(css.includes("center"), `missing value in: ${css}`);
});

Deno.test("whitespace-nowrap resolves to no wrapping", async () => {
  const css = await cssFor("whitespace-nowrap");
  assert(css.includes("white-space"), `missing property in: ${css}`);
  assert(css.includes("nowrap"), `missing value in: ${css}`);
});

Deno.test("break-words resolves to word breaking", async () => {
  const css = await cssFor("break-words");
  assert(css.includes("overflow-wrap"), `missing property in: ${css}`);
  assert(css.includes("break-word"), `missing value in: ${css}`);
});

Deno.test("transition-colors resolves to color properties", async () => {
  const css = await cssFor("transition-colors");
  assert(css.includes("transition-property"), `missing property in: ${css}`);
  assert(css.includes("background-color"), `missing value in: ${css}`);
});

Deno.test("duration-base resolves to the duration token variable", async () => {
  const css = await cssFor("duration-base");
  assert(css.includes("transition-duration"), `missing property in: ${css}`);
  assert(css.includes("var(--motion-duration-base)"), `missing var in: ${css}`);
});

Deno.test("ease-standard resolves to the easing token variable", async () => {
  const css = await cssFor("ease-standard");
  assert(
    css.includes("transition-timing-function"),
    `missing property in: ${css}`,
  );
  assert(
    css.includes("var(--motion-easing-standard)"),
    `missing var in: ${css}`,
  );
});

Deno.test("cursor-pointer resolves to pointer cursor", async () => {
  const css = await cssFor("cursor-pointer");
  assert(css.includes("cursor"), `missing property in: ${css}`);
  assert(css.includes("pointer"), `missing value in: ${css}`);
});

Deno.test("pointer-events-none resolves to no events", async () => {
  const css = await cssFor("pointer-events-none");
  assert(css.includes("pointer-events"), `missing property in: ${css}`);
  assert(css.includes("none"), `missing value in: ${css}`);
});

Deno.test("select-none resolves to no selection", async () => {
  const css = await cssFor("select-none");
  assert(css.includes("user-select"), `missing property in: ${css}`);
  assert(css.includes("none"), `missing value in: ${css}`);
});

Deno.test("resize-both resolves to both axis resize", async () => {
  const css = await cssFor("resize-both");
  assert(css.includes("resize"), `missing property in: ${css}`);
  assert(css.includes("both"), `missing value in: ${css}`);
});

Deno.test("scroll-smooth resolves to smooth scrolling", async () => {
  const css = await cssFor("scroll-smooth");
  assert(css.includes("scroll-behavior"), `missing property in: ${css}`);
  assert(css.includes("smooth"), `missing value in: ${css}`);
});

Deno.test("divide-x puts dividers between children", async () => {
  const css = await cssFor("divide-x");
  assert(css.includes(":not([hidden])"), `missing combinator in: ${css}`);
  assert(css.includes("border-left-width"), `missing property in: ${css}`);
  assert(css.includes("1px"), `missing value in: ${css}`);
});

Deno.test("divide-primary colors the dividers from the token", async () => {
  const css = await cssFor("divide-primary");
  assert(css.includes(":not([hidden])"), `missing combinator in: ${css}`);
  assert(css.includes("border-color"), `missing property in: ${css}`);
  assert(css.includes("var(--color-primary)"), `missing var in: ${css}`);
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
  assert(css.includes("background-color"), `missing property in: ${css}`);
  assert(css.includes("#bada55"), `missing extended value in: ${css}`);
});

Deno.test("preset theme publishes resolved token values", () => {
  const preset = spinPreset();
  const theme = preset.theme as Record<string, Record<string, unknown>>;
  assert(
    (theme.colors as Record<string, unknown>).primary === "#333333",
    "theme.colors.primary carries the resolved value for tooling",
  );
});

Deno.test("the primitives layer is emitted by default", async () => {
  // A consumer wiring the preset almost always wants the finished controls,
  // so the layer ships unless it is turned off. This is what the studio
  // depends on to render anything.
  const { css } = await createGenerator({ presets: [spinPreset()] })
    .then((uno) => uno.generate("button"));
  assert(
    css.includes("button"),
    `expected the primitives button rules in:\n${css}`,
  );
});

Deno.test("the primitives layer can be turned off entirely", async () => {
  const { css } = await createGenerator({
    presets: [spinPreset({ primitives: false })],
  }).then((uno) => uno.generate("button"));
  assert(
    !css.includes(".secondary"),
    `expected no primitive rules with primitives: false, got:\n${css}`,
  );
  // The utilities still work; only the component layer is gone.
  const { css: utilCss } = await createGenerator({
    presets: [spinPreset({ theme: workingTreeDocument(), primitives: false })],
  }).then((uno) => uno.generate("bg-primary"));
  assert(
    utilCss.includes("var(--color-primary)"),
    `utilities should survive primitives: false:\n${utilCss}`,
  );
});

Deno.test("the primitives layer can be opted into per component", async () => {
  // The studio switches components on individually, so a partial list has to
  // emit exactly that subset rather than everything.
  const { css } = await createGenerator({
    presets: [spinPreset({ primitives: ["button"] })],
  }).then((uno) => uno.generate("button"));
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
  const preset = spinPreset({ theme: scaffoldDocument() });
  const uno = await createGenerator({ presets: [preset] });
  const transformer = (preset.transformers ?? [])[0];
  assert(transformer, "the preset must carry the directives transformer");

  const code = new MagicString(".probe { --at-apply: bg-primary; }");
  await transformer.transform(
    code,
    "probe.css",
    { uno } as unknown as UnocssPluginContext,
  );
  const css = code.toString();

  assert(
    css.includes("var(--color-primary)"),
    `--at-apply should expand to the token variable:\n${css}`,
  );
  assert(
    !css.includes("#333333"),
    `--at-apply must not bake the resolved literal:\n${css}`,
  );
});
