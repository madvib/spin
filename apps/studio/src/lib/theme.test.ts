import { assertEquals, assertThrows } from "@std/assert";
import { applyEdits } from "./theme.ts";

/** A document small enough to read and real enough for setToken to walk. */
function fixture(): string {
  return JSON.stringify(
    {
      spacing: {
        "4": { $type: "dimension", $value: "1rem" },
        "8": { $type: "dimension", $value: "2rem" },
      },
    },
    null,
    2,
  );
}

Deno.test("applyEdits writes every edit into one document", () => {
  const next = applyEdits(fixture(), [
    { path: ["spacing", "4"], value: "0.5rem" },
    { path: ["spacing", "8"], value: "4rem" },
  ], "base");
  const doc = JSON.parse(next) as {
    spacing: Record<string, { $value: string }>;
  };
  assertEquals(doc.spacing["4"]!.$value, "0.5rem");
  assertEquals(doc.spacing["8"]!.$value, "4rem");
});

Deno.test("applyEdits writes a dark batch into the mode slot", () => {
  const next = applyEdits(fixture(), [
    { path: ["spacing", "4"], value: "0.75rem" },
    { path: ["spacing", "8"], value: "1.5rem" },
  ], "dark");
  const doc = JSON.parse(next) as {
    spacing: Record<
      string,
      { $value: string; $modes?: Record<string, string> }
    >;
  };
  assertEquals(doc.spacing["4"]!.$value, "1rem");
  assertEquals(doc.spacing["4"]!.$modes?.["dark"], "0.75rem");
  assertEquals(doc.spacing["8"]!.$modes?.["dark"], "1.5rem");
});

Deno.test("applyEdits refuses the whole batch when one path does not resolve", () => {
  // All or nothing: a scale that half-landed would leave the group scaled
  // by a factor only some of its steps accepted. The refusal is the throw —
  // a partial document is never handed back for the store to commit.
  assertThrows(() =>
    applyEdits(fixture(), [
      { path: ["spacing", "4"], value: "0.5rem" },
      { path: ["spacing", "16"], value: "8rem" },
    ], "base")
  );
});
