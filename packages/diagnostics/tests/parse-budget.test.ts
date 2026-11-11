import { test } from "bun:test";
import assert from "node:assert/strict";
import { lintMarkup } from "../src/engine.ts";
import { engineAnswers } from "@spinjs/preset";
import { starterThemes } from "@spinjs/theme/themes";

/**
 * A document the component parser rejects still gets findings.
 *
 * The mismatch below throws out of `parse`, and the lint answers through
 * the text walk instead: the unknown class is reported rather than the
 * file dying the lint. The budget branch shares this `catch` by
 * construction, so the fallback this proves is the fallback a slow file
 * takes too.
 */
test("a fragment the parser rejects falls back to the text walk", async () => {
  const run = {
    rules: ["closed-vocabulary"] as const,
    semantic: { strictness: "strict", semanticTags: "all" } as const,
    answers: engineAnswers(Object.values(starterThemes)),
  };
  const findings = await lintMarkup(
    "panel.html",
    `<div><span class="not-a-class">x</div>`,
    run,
  );
  assert(
    findings.some((finding) =>
      finding.ruleId === "spin/closed-vocabulary" &&
      finding.message.includes("not-a-class")
    ),
    `the unknown class in the rejected fragment was not reported: ${
      JSON.stringify(findings.map((finding) => finding.message))
    }`,
  );
});
