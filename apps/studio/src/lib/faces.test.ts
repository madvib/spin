import { assertEquals } from "@std/assert";
import { defaultFaceFor } from "./faces.ts";

Deno.test("a role's default face is the theme's own word for it", () => {
  const declared = ["sans", "serif", "mono"];
  assertEquals(defaultFaceFor("h1", declared), "sans");
  assertEquals(defaultFaceFor("p", declared), "sans");
  // Editorial text and code read the family that matches them when the theme
  // has one, never a family the page invented.
  assertEquals(defaultFaceFor("blockquote", declared), "serif");
  assertEquals(defaultFaceFor("code", declared), "mono");
  assertEquals(defaultFaceFor("pre", declared), "mono");
});

Deno.test("a theme that names the roles' families gives them to the elements", () => {
  // The display face belongs to the headings and the body face to the body
  // copy, because that is what the rules spend: a theme that names a display
  // voice has it read by the headings.
  const declared = ["sans", "heading", "body", "serif", "mono"];
  assertEquals(defaultFaceFor("h1", declared), "heading");
  assertEquals(defaultFaceFor("h6", declared), "heading");
  assertEquals(defaultFaceFor("p", declared), "body");
  assertEquals(defaultFaceFor("blockquote", declared), "serif");
  assertEquals(defaultFaceFor("code", declared), "mono");
});

Deno.test("a theme that does not declare a role's family reads the base face", () => {
  const declared = ["sans"];
  assertEquals(defaultFaceFor("blockquote", declared), "sans");
  assertEquals(defaultFaceFor("code", declared), "sans");
});

Deno.test("a theme with no declared families falls back to the built-in base face", () => {
  assertEquals(defaultFaceFor("h1", []), "sans");
});
