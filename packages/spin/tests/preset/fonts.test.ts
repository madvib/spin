import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { scaffoldDocument, spinPreset } from "../../src/compiler/index.ts";
import type { ThemeDocument } from "../../src/compiler/index.ts";

/**
 * A theme's declared faces are CSS the sheet must carry — whatever the theme
 * is called.
 *
 * `$extensions.spin.fonts` is a document's own statement that the family it
 * names is a family it loads. The assembler once read `documents.light`, so a
 * project whose themes were named anything else shipped no `@font-face` at
 * all and every stack silently fell back to a system face. These tests are
 * about the name not mattering, and about two themes sharing one family
 * shipping one face.
 */

function docWithFace(family: string): ThemeDocument {
  const doc = scaffoldDocument() as unknown as Record<string, unknown>;
  doc["$extensions"] = {
    spin: {
      fonts: [{
        family,
        src: `url(https://example.test/${
          family.toLowerCase().replaceAll(" ", "-")
        }.woff2) format("woff2")`,
        weight: "100 900",
        display: "swap",
      }],
    },
  };
  return doc as unknown as ThemeDocument;
}

async function cssWith(themes: Record<string, ThemeDocument>): Promise<string> {
  const uno = await createGenerator({ presets: [spinPreset({ themes })] });
  const { css } = await uno.generate("bg-primary");
  return css;
}

test("a theme's declared face ships whatever the theme is named", async () => {
  const css = await cssWith({ brand: docWithFace("Brand Face") });
  assert(
    css.includes('font-family: "Brand Face";'),
    `no face for the theme in:\n${css}`,
  );
  assert(
    css.includes("https://example.test/brand-face.woff2"),
    "the face's source must ship with it",
  );
});

test("two themes declaring one family ship one face", async () => {
  const css = await cssWith({
    first: docWithFace("Shared Face"),
    second: docWithFace("Shared Face"),
  });
  deepStrictEqual((css.match(/@font-face/g) ?? []).length, 1);
});
