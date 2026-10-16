import { assertEquals } from "@std/assert";
import { defaultFaceFor } from "./faces.ts";

Deno.test("a role's default face is the theme's own word for it", () => {
  const declared = ["sans", "serif", "mono"];
  assertEquals(defaultFaceFor("h1", declared), "sans");
  assertEquals(defaultFaceFor("p", declared), "sans");
  // Editorial text and code read the family that matches them when the theme
  // has one, never the silent `heading` family the page used to invent.
  assertEquals(defaultFaceFor("blockquote", declared), "serif");
  assertEquals(defaultFaceFor("code", declared), "mono");
  assertEquals(defaultFaceFor("pre", declared), "mono");
});

Deno.test("a theme that does not declare a role's family reads the base face", () => {
  const declared = ["sans"];
  assertEquals(defaultFaceFor("blockquote", declared), "sans");
  assertEquals(defaultFaceFor("code", declared), "sans");
});

Deno.test("a theme with no declared families falls back to the built-in base face", () => {
  assertEquals(defaultFaceFor("h1", []), "sans");
});
