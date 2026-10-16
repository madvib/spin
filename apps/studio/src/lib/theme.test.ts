import { assertEquals, assertThrows } from "@std/assert";
import { applyEdits, createToken } from "./theme.ts";

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

Deno.test("applyEdits drops a dark override that says what the base says", () => {
  // Seed an override, then say the base's own word in dark: an override is
  // not a value, it is a difference — and a slot that differs from nothing
  // has no business being in the document.
  const withOverride = applyEdits(fixture(), [
    { path: ["spacing", "4"], value: "1.5rem" },
  ], "dark");
  const back = applyEdits(withOverride, [
    { path: ["spacing", "4"], value: "1rem" },
  ], "dark");
  const doc = JSON.parse(back) as {
    spacing: Record<
      string,
      { $value: string; $modes?: Record<string, string> }
    >;
  };
  assertEquals(doc.spacing["4"]?.$modes, undefined);
  assertEquals(doc.spacing["4"]?.$value, "1rem");
});

Deno.test("createToken inserts a token the document does not have yet", () => {
  // The path may stand on groups nobody wrote: a component's character token
  // (`button.weight`) belongs to a vocabulary the manifest declares and the
  // theme has never had to spell. Creation builds what the path needs and
  // lands the type with the value, so the token is spendable at once.
  const doc = JSON.parse(
    createToken(fixture(), ["button", "weight"], "fontWeight", "600"),
  ) as { button: Record<string, { $type: string; $value: string }> };
  assertEquals(doc.button.weight, { $type: "fontWeight", $value: "600" });
});

Deno.test("createToken adds beside a token the theme already holds", () => {
  const doc = JSON.parse(
    createToken(fixture(), ["spacing", "16"], "dimension", "4rem"),
  ) as {
    spacing: Record<string, { $type?: string; $value: unknown }>;
  };
  assertEquals(doc.spacing["16"], { $type: "dimension", $value: "4rem" });
  // The neighbour keeps its own word: creation adds, it does not rewrite.
  assertEquals(doc.spacing["4"]?.$value, "1rem");
});

Deno.test("createToken refuses to overwrite a token the theme already holds", () => {
  // The page only offers creation for a path the theme is missing, so an
  // existing token under the cursor is a caller's mistake — and the one
  // thing it must not do is quietly reset the author's edited value back to
  // the manifest's scaffold.
  assertThrows(
    () => createToken(fixture(), ["spacing", "4"], "dimension", "9rem"),
    Error,
    "spacing.4",
  );
});
