/**
 * The composed document, judged — the build's single gate.
 *
 * The preset judges every theme it constructs through this surface: required
 * paths plus legibility floors. The wider battery (ladders, loop, modes
 * restraint) is the editor's early courtesy, not the build's refusal — a
 * fixture overlaying one shadow step must still build.
 */

import { requiredPaths } from "./roles.ts";
import { validateLegibility } from "./schema.ts";
import { validateTokens } from "../pipeline/validate.ts";
import type { TokenTree } from "../pipeline/types.ts";

/** Every debt a composed tree still owes, in the judge's own words. */
export function judgeComposedTree(tree: TokenTree): string[] {
  const report = validateTokens(tree, { required: [...requiredPaths()] });
  const issues = [...report.issues, ...validateLegibility(tree)];
  return issues.map((issue) =>
    issue.path ? `${issue.path}: ${issue.message}` : issue.message
  );
}
