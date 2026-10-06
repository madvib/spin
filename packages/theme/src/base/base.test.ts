import { assert, assertEquals } from "@std/assert";
import { basePreflights, fontFaces, readFonts } from "./index.ts";
import { documentDefaults } from "./css.ts";
import type { FontResult } from "./fonts.ts";

/**
 * The document a theme makes before any component exists.
 *
 * The tests below are about the two things a theme author would get wrong:
 * declaring a font in a way that does not load, and declaring one the system
 * silently ignores.
 */

const INTER = {
  family: "Inter",
  src: "url(/fonts/inter.woff2)",
  display: "swap",
} as const;

Deno.test("a declared font becomes one @font-face block", () => {
  const { fonts } = readFonts({ $extensions: { spin: { fonts: [INTER] } } });
  const css = fontFaces({ fonts, issues: [] });
  assert(css.startsWith("@font-face {"), css);
  assert(css.includes('font-family: "Inter"'), css);
  assert(css.includes("src: url(/fonts/inter.woff2)"), css);
  assert(css.includes("font-display: swap"), css);
});

Deno.test("a theme that declares no fonts emits nothing", () => {
  assertEquals(readFonts({}).fonts, []);
  assertEquals(fontFaces(readFonts({})), "");
  assertEquals(fontFaces(readFonts({ $extensions: {} })), "");
});

Deno.test("the same family is emitted once however often it is declared", () => {
  // A theme listing Inter for weights 400 and 700 wants two blocks, but two
  // identical blocks under one name would be a conflict.
  const result = readFonts({
    $extensions: {
      spin: {
        fonts: [
          { family: "Inter", src: "url(/inter-400.woff2)" },
          { family: "Inter", src: "url(/inter-700.woff2)" },
        ],
      },
    },
  });
  const css = fontFaces(result);
  assertEquals(css.split("@font-face").length - 1, 1);
});

Deno.test("a malformed font is reported, not dropped", () => {
  // The failure this exists to prevent: a font the studio silently ignores is
  // one the author never learns is missing.
  const result = readFonts({
    $extensions: {
      spin: { fonts: [INTER, { family: "Broken" }, { src: "url(/x.woff2)" }] },
    },
  });
  assertEquals(result.fonts.length, 1, "the sound declaration survives");
  assertEquals(result.issues.length, 2, "one issue per malformed entry");
  const paths = result.issues.map((issue) => issue.path);
  assert(paths.includes("$extensions.spin.fonts[1].src"), paths.join(", "));
  assert(paths.includes("$extensions.spin.fonts[2].family"), paths.join(", "));
});

Deno.test("an invalid font-display is refused", () => {
  const result: FontResult = readFonts({
    $extensions: {
      spin: { fonts: [{ ...INTER, display: "whenever" }] },
    },
  });
  assertEquals(result.fonts, []);
  assertEquals(result.issues.length, 1);
});

Deno.test("document defaults spend theme tokens and nothing else", () => {
  const css = documentDefaults();
  assert(css.includes("var(--font-family-sans)"), css);
  assert(css.includes("var(--color-text)"), css);
  assert(css.includes("var(--color-surface)"), css);
  // A default that hardcoded a value would be a house style, not an identity.
  assert(!/#[0-9a-f]{3,6}/i.test(css), `no literals in: ${css}`);
});

Deno.test("the theme contributes document layers below the components", () => {
  const providers = basePreflights({
    $extensions: { spin: { fonts: [INTER] } },
  });
  const names = providers.map((provider) => provider.name);
  assert(names.includes("theme/document-defaults"), names.join(", "));
  assert(names.includes("theme/fonts"), names.join(", "));
  for (const provider of providers) {
    assert(
      provider.order < 0,
      `${provider.name} must sit below the utilities`,
    );
  }
  const fonts = providers.find((provider) => provider.name === "theme/fonts");
  assertEquals(
    fonts?.getCSS(),
    fontFaces(readFonts({
      $extensions: { spin: { fonts: [INTER] } },
    })),
  );
});

Deno.test("a theme with no fonts still contributes its defaults", () => {
  const providers = basePreflights({});
  const fonts = providers.find((provider) => provider.name === "theme/fonts");
  assertEquals(fonts?.getCSS(), "", "the font layer is present but empty");
  const defaults = providers.find((provider) =>
    provider.name === "theme/document-defaults"
  );
  assert((defaults?.getCSS().length ?? 0) > 0, "defaults are unconditional");
});
