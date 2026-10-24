import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { defaultFaceFor } from "./faces.ts";

test("a role's default face is the theme's own word for it", () => {
  const declared = ["sans", "serif", "mono"];
  deepStrictEqual(defaultFaceFor("h1", declared), "sans");
  deepStrictEqual(defaultFaceFor("p", declared), "sans");
  // Editorial text and code read the family that matches them when the theme
  // has one, never a family the page invented.
  deepStrictEqual(defaultFaceFor("blockquote", declared), "serif");
  deepStrictEqual(defaultFaceFor("code", declared), "mono");
  deepStrictEqual(defaultFaceFor("pre", declared), "mono");
});

test("a theme that names the roles' families gives them to the elements", () => {
  // The display face belongs to the headings and the body face to the body
  // copy, because that is what the rules spend: a theme that names a display
  // voice has it read by the headings.
  const declared = ["sans", "heading", "body", "serif", "mono"];
  deepStrictEqual(defaultFaceFor("h1", declared), "heading");
  deepStrictEqual(defaultFaceFor("h6", declared), "heading");
  deepStrictEqual(defaultFaceFor("p", declared), "body");
  deepStrictEqual(defaultFaceFor("blockquote", declared), "serif");
  deepStrictEqual(defaultFaceFor("code", declared), "mono");
});

test("a theme that does not declare a role's family reads the base face", () => {
  const declared = ["sans"];
  deepStrictEqual(defaultFaceFor("blockquote", declared), "sans");
  deepStrictEqual(defaultFaceFor("code", declared), "sans");
});

test("a theme with no declared families falls back to the built-in base face", () => {
  deepStrictEqual(defaultFaceFor("h1", []), "sans");
});
