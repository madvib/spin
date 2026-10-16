import { assertEquals } from "@std/assert";
import type { TokenRow } from "./tokens.ts";
import { elementOverrides, overrideWrites } from "./elements.ts";

function leaf(
  path: string,
  value: string,
  type = "string",
): TokenRow {
  return {
    path,
    type,
    value,
    variable: `--${path.replace(/\./g, "-")}`,
  };
}

Deno.test("elementOverrides reads the leaves the group holds", () => {
  const rows = [
    leaf("font.element.h1.face", "serif"),
    leaf("font.element.h1.weight", "700", "string"),
  ];
  const overrides = elementOverrides(rows, "h1");
  assertEquals(overrides, { face: "serif", weight: "700" });
});

Deno.test("overrideWrites marks a new field as needing to be minted", () => {
  const rows = [leaf("font.element.h2.face", "heading")];
  const writes = overrideWrites(rows, "h2", { weight: "600" });
  assertEquals(writes, [
    {
      exists: false,
      path: ["font", "element", "h2", "weight"],
      type: "string",
      value: "600",
    },
  ]);
});

Deno.test("overrideWrites edits a field the leaf already holds", () => {
  const rows = [leaf("font.element.h3.face", "heading", "fontFamily")];
  const writes = overrideWrites(rows, "h3", { face: "serif" });
  assertEquals(writes, [
    {
      exists: true,
      path: ["font", "element", "h3", "face"],
      type: "string",
      value: "serif",
    },
  ]);
});

Deno.test("overrideWrites ignores fields that are left unset", () => {
  const rows = [leaf("font.element.p.size", "md")];
  assertEquals(overrideWrites(rows, "p", {}), []);
});
