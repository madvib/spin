import { assert, assertEquals } from "@std/assert";
import { parseTokens } from "./parse.ts";
import { everyTokenTypeIsDecided, validateTokens } from "./validate.ts";
import type {
  TokenTree,
  TokenType,
  ValidationIssue,
  ValidationReport,
} from "./types.ts";

/** Finds the issue reported for a token, failing loudly when none was. */
function issueAt(report: ValidationReport, path: string): ValidationIssue {
  const found = report.issues.find((issue) => issue.path === path);
  if (!found) {
    throw new Error(
      `expected an issue at "${path}", got: ${JSON.stringify(report.issues)}`,
    );
  }
  return found;
}

const VALID: TokenTree = [
  {
    kind: "group",
    name: "color",
    path: ["color"],
    children: [
      {
        kind: "token",
        name: "brand",
        path: ["color", "brand"],
        type: "color",
        value: "#ff0000",
      },
      {
        kind: "token",
        name: "action",
        path: ["color", "action"],
        type: "color",
        value: "{color.brand}",
      },
    ],
  },
  {
    kind: "group",
    name: "space",
    path: ["space"],
    children: [
      {
        kind: "token",
        name: "sm",
        path: ["space", "sm"],
        type: "dimension",
        value: "4px",
      },
    ],
  },
];

Deno.test("validateTokens accepts a well-formed token tree", () => {
  const report = validateTokens(VALID);

  assertEquals(report.valid, true);
});

Deno.test("validateTokens accepts a tree once every required token is present", () => {
  const report = validateTokens(VALID, {
    required: ["color.brand", "space.sm"],
  });

  assertEquals(report.valid, true);
});

Deno.test("validateTokens reports a required token that is absent", () => {
  const report = validateTokens(VALID, { required: ["color.muted"] });

  assertEquals(report.valid, false);
  assert(issueAt(report, "color.muted").message.trim().length > 0);
});

Deno.test("validateTokens matches required tokens by exact path, not by leaf name", () => {
  const elsewhere: TokenTree = [{
    kind: "group",
    name: "surface",
    path: ["surface"],
    children: [
      {
        kind: "token",
        name: "brand",
        path: ["surface", "brand"],
        type: "color",
        value: "#fff",
      },
    ],
  }];
  const report = validateTokens(elsewhere, { required: ["color.brand"] });

  assertEquals(report.valid, false);
  assert(issueAt(report, "color.brand").message.trim().length > 0);
});

Deno.test("validateTokens names every absent required token", () => {
  const report = validateTokens(VALID, {
    required: ["color.muted", "space.xl"],
  });

  assertEquals(report.valid, false);
  for (const path of ["color.muted", "space.xl"]) {
    assert(issueAt(report, path).message.trim().length > 0);
  }
});

Deno.test("validateTokens rejects a token whose type is not a known DTCG type", () => {
  const bogus: TokenTree = [{
    kind: "group",
    name: "color",
    path: ["color"],
    children: [
      {
        kind: "token",
        name: "brand",
        path: ["color", "brand"],
        // Stands in for a document that bypassed the parser's own type check.
        type: "sparkles" as TokenType,
        value: "#ff0000",
      },
    ],
  }];
  const report = validateTokens(bogus);

  assertEquals(report.valid, false);
  assert(issueAt(report, "color.brand").message.trim().length > 0);
});

Deno.test("validateTokens rejects an alias that points at a token which is not in the tree", () => {
  const dangling: TokenTree = [{
    kind: "group",
    name: "color",
    path: ["color"],
    children: [
      {
        kind: "token",
        name: "action",
        path: ["color", "action"],
        type: "color",
        value: "{color.nowhere}",
      },
    ],
  }];
  const report = validateTokens(dangling);

  assertEquals(report.valid, false);
  assert(issueAt(report, "color.action").message.trim().length > 0);
});

Deno.test("validateTokens gives every reported issue a message and a path", () => {
  const report = validateTokens(VALID, { required: ["color.muted"] });

  for (const issue of report.issues) {
    assert(
      issue.path.length > 0,
      `an issue is missing its path: ${JSON.stringify(issue)}`,
    );
    assert(
      issue.message.trim().length > 0,
      `the issue at "${issue.path}" has a blank message`,
    );
  }
});

Deno.test("every token type has a validation decision", () => {
  // Adding a type to the vocabulary without deciding whether it is checked
  // would otherwise pass silently: the rule table is a partial record, so a
  // missing key reads as "no rule" rather than "not yet decided".
  assert(
    everyTokenTypeIsDecided(),
    "every TOKEN_TYPES member is either in VALUE_RULES or declared UNCHECKED",
  );
});

Deno.test("an unchecked type accepts any non-empty value", () => {
  // The deliberate half of the decision: a type with no rule must not reject a
  // value that is structurally fine, or the split above is a lie.
  const parsed = parseTokens({
    font: {
      family: {
        $type: "fontFamily",
        serif: { $value: "Iowan Old Style, Charter, serif" },
        mono: { $value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      },
    },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  assertEquals(
    validateTokens(parsed.tree).issues.filter((issue) =>
      issue.path.startsWith("font.family")
    ),
    [],
    "an unchecked type is not policed for syntax",
  );

  // The other half: a checked type still is. `dimension` requires a unit, so
  // an unevaluated expression is a theme author's mistake worth reporting.
  const checked = parseTokens({
    spacing: { $type: "dimension", loose: { $value: "calc(1rem + 2px)" } },
  });
  if (!checked.ok) throw new Error(checked.error);
  assert(
    validateTokens(checked.tree).issues.some((issue) =>
      issue.path === "spacing.loose"
    ),
    "a checked type keeps its rule",
  );
});
