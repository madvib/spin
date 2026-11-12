import { readFile } from "node:fs/promises";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import {
  authoringStyles,
  authoringStyleTuple,
  renderAuthoringSkill,
} from "./authoring.ts";
import { primitiveComponents } from "@spinjs/preset";
/**
 * The primitives reference is generated from the manifest and the languages:
 * every primitive the rules declare appears with its tags, variants, and
 * painted elements, and every `type-*` style the themes declare appears with
 * its tuple. These tests hold the generation to that.
 */

test("the reference walks every primitive the manifest declares", () => {
  const rendered = renderAuthoringSkill("");
  for (const [name, component] of Object.entries(primitiveComponents)) {
    deepStrictEqual(
      rendered.includes(`### ${name}\n`),
      true,
      `the reference does not walk the ${name} primitive`,
    );
    for (const tag of component.tags) {
      deepStrictEqual(
        rendered.includes(`<${tag}>`),
        true,
        `the reference does not name the ${name} tag <${tag}>`,
      );
    }
    for (const variant of component.variants) {
      deepStrictEqual(
        rendered.includes(`\`${variant}\``),
        true,
        `the reference does not name the ${name} variant ${variant}`,
      );
    }
  }
});

test("the reference walks every type style with its declared tuple", () => {
  const rendered = renderAuthoringSkill("");
  const styles = authoringStyles();
  deepStrictEqual(styles.length > 0, true);
  for (const name of styles) {
    deepStrictEqual(
      rendered.includes(`### type-${name}\n`),
      true,
      `the reference does not walk the type-${name} style`,
    );
    const tuple = authoringStyleTuple(name);
    deepStrictEqual(tuple !== undefined, true);
    for (const value of Object.values(tuple ?? {})) {
      deepStrictEqual(
        rendered.includes(value),
        true,
        `the reference does not carry the type-${name} tuple value ${value}`,
      );
    }
  }
});

test("the generation is deterministic", () => {
  deepStrictEqual(renderAuthoringSkill("anything"), renderAuthoringSkill("other"));
});

test("references/primitives.md on disk is the generated reference", async () => {
  const onDisk = await readFile(
    new URL("../../skill/references/primitives.md", import.meta.url),
    "utf8",
  );
  deepStrictEqual(onDisk, renderAuthoringSkill(""));
});
