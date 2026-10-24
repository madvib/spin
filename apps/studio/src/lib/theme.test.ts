import { test } from "bun:test";
import assert from "node:assert/strict";
import { deepStrictEqual } from "node:assert/strict";
import { applyEdits, createToken, deleteToken } from "./theme.ts";

/** A document small enough to read and real enough for setToken to walk. */
function fixture(): string {
  return JSON.stringify(
    {
      spacing: {
        "4": { $type: "dimension", $value: "1rem" },
        "8": { $type: "dimension", $value: "2rem" },
      },
      badge: {
        pill: { $type: "boolean", $value: true },
      },
    },
    null,
    2,
  );
}

test("applyEdits writes every edit into one document", () => {
  const next = applyEdits(fixture(), [
    { path: ["spacing", "4"], value: "0.5rem" },
    { path: ["spacing", "8"], value: "4rem" },
  ], "base");
  const doc = JSON.parse(next) as {
    spacing: Record<string, { $value: string }>;
  };
  deepStrictEqual(doc.spacing["4"]!.$value, "0.5rem");
  deepStrictEqual(doc.spacing["8"]!.$value, "4rem");
});

test("applyEdits writes a dark batch into the mode slot", () => {
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
  deepStrictEqual(doc.spacing["4"]!.$value, "1rem");
  deepStrictEqual(doc.spacing["4"]!.$modes?.["dark"], "0.75rem");
  deepStrictEqual(doc.spacing["8"]!.$modes?.["dark"], "1.5rem");
});

test("applyEdits refuses the whole batch when one path does not resolve", () => {
  // All or nothing: a scale that half-landed would leave the group scaled
  // by a factor only some of its steps accepted. The refusal is the throw —
  // a partial document is never handed back for the store to commit.
  assert.throws(() =>
    applyEdits(fixture(), [
      { path: ["spacing", "4"], value: "0.5rem" },
      { path: ["spacing", "16"], value: "8rem" },
    ], "base")
  );
});

test("applyEdits drops a dark override that says what the base says", () => {
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
  deepStrictEqual(doc.spacing["4"]?.$modes, undefined);
  deepStrictEqual(doc.spacing["4"]?.$value, "1rem");
});

test("createToken inserts a token the document does not have yet", () => {
  // The path may stand on groups nobody wrote: a component token
  // (`button.weight`) belongs to a vocabulary the manifest declares and the
  // theme has never had to spell. Creation builds what the path needs and
  // lands the type with the value, so the token is spendable at once.
  const doc = JSON.parse(
    createToken(fixture(), ["button", "weight"], "fontWeight", "600"),
  ) as { button: Record<string, { $type: string; $value: string }> };
  deepStrictEqual(doc.button.weight, { $type: "fontWeight", $value: "600" });
});

test("createToken adds beside a token the theme already holds", () => {
  const doc = JSON.parse(
    createToken(fixture(), ["spacing", "16"], "dimension", "4rem"),
  ) as {
    spacing: Record<string, { $type?: string; $value: unknown }>;
  };
  deepStrictEqual(doc.spacing["16"], { $type: "dimension", $value: "4rem" });
  // The neighbour keeps its own word: creation adds, it does not rewrite.
  deepStrictEqual(doc.spacing["4"]?.$value, "1rem");
});

test("createToken refuses to overwrite a token the theme already holds", () => {
  // The page only offers creation for a path the theme is missing, so an
  // existing token under the cursor is a caller's mistake — and the one
  // thing it must not do is quietly reset the author's edited value back to
  // the manifest's scaffold.
  assert.throws(
    () => createToken(fixture(), ["spacing", "4"], "dimension", "9rem"),
    Error,
    "spacing.4",
  );
});

test("an edit lands as the JSON type the token already holds", () => {
  // Controls speak strings, but a boolean is a boolean in the document:
  // `"false"` written over `true` would change the token's type, and the
  // reader that asks the value's JSON type — the validator, every rule that
  // branches on it — would see a string where the theme declared a boolean.
  const doc = JSON.parse(
    applyEdits(
      fixture(),
      [{ path: ["badge", "pill"], value: "false" }],
      "base",
    ),
  ) as { badge: { pill: { $value: unknown } } };
  deepStrictEqual(doc.badge.pill.$value, false);
});

test("a creation lands its scaffold as the type it declares", () => {
  // A component token's scaffold crosses from the manifest as text; the
  // declared type is what makes it JSON. `checkbox.depth` is a number, and
  // a number written as `"1"` stops comparing like one.
  const boolean = JSON.parse(
    createToken(fixture(), ["badge", "dot"], "boolean", "true"),
  ) as { badge: { dot: { $value: unknown } } };
  deepStrictEqual(boolean.badge.dot.$value, true);
  const number = JSON.parse(
    createToken(fixture(), ["checkbox", "depth"], "number", "1"),
  ) as { checkbox: { depth: { $value: unknown } } };
  deepStrictEqual(number.checkbox.depth.$value, 1);
});

test("deleteToken removes a leaf and prunes groups that hold nothing else", () => {
  const withElement = createToken(
    fixture(),
    ["font", "element", "h1", "size"],
    "dimension",
    "{font.size.3xl}",
  );
  const after = JSON.parse(
    deleteToken(withElement, ["font", "element", "h1", "size"]),
  ) as Record<string, unknown>;
  deepStrictEqual(after["font"], undefined);
  deepStrictEqual(
    (after["spacing"] as Record<string, { $value: string }>)["4"]?.$value,
    "1rem",
  );
});

test("deleteToken leaves sibling tokens in the same group untouched", () => {
  const after = JSON.parse(
    deleteToken(fixture(), ["spacing", "4"]),
  ) as { spacing: Record<string, { $value: string } | undefined> };
  deepStrictEqual(after.spacing["4"], undefined);
  deepStrictEqual(after.spacing["8"]?.$value, "2rem");
});
