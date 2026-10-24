import { test } from "bun:test";
/**
 * The studio's own rules about a theme's document and its file.
 *
 * Three of them, and all three are decisions the studio makes rather than
 * facts it reads: what a document is judged against, which mode a theme
 * may be shown in, and what the studio knows about the file behind the
 * editor. Each was a rule the studio did not have — a panel that said
 * "nothing to report" about a theme that cannot build, a mode a clamp took
 * and never gave back, a status line that claimed "saved" while the file
 * said something else.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { scaffoldTheme, treeToJson } from "@spin/theme";
import {
  analyzeTheme,
  declaredModes,
  fileMoved,
  fileState,
  resolveMode,
  stateLabel,
} from "./theme.ts";

/** A document that declares every role a theme owes. */
function complete(): string {
  return treeToJson(scaffoldTheme());
}

/** A document with one role taken out of it. */
function withoutRole(path: string): string {
  const doc = JSON.parse(complete()) as Record<string, unknown>;
  const segments = path.split(".");
  let node: Record<string, unknown> = doc;
  for (const segment of segments.slice(0, -1)) {
    node = node[segment] as Record<string, unknown>;
  }
  delete node[segments[segments.length - 1] as string];
  return JSON.stringify(doc, null, 2);
}

test("a document missing a required role is reported, not waved through", () => {
  // The preview refuses to build a theme that is missing a role, so the
  // panel that reports on the document has to agree with it: a theme the
  // preview will not build cannot be one the studio says nothing is wrong
  // with.
  const state = analyzeTheme(withoutRole("color.text"));
  assert(
    state.issues.some((issue) => issue.path === "color.text"),
    `the missing role is not reported: ${JSON.stringify(state.issues)}`,
  );
  deepStrictEqual(state.error, undefined);
});

test("a document that declares every required role reports nothing", () => {
  const state = analyzeTheme(complete());
  deepStrictEqual(state.error, undefined);
  deepStrictEqual(state.issues, []);
});

test("a document that does not parse is reported as such", () => {
  const state = analyzeTheme("{ not json at all\n");
  assert(state.error !== undefined, "a broken document was not reported");
});

test("the modes a document declares are the modes it serves", () => {
  const light = declaredModes(
    JSON.stringify({ modes: ["light"], color: {} }),
  );
  deepStrictEqual(light, ["light"]);
  // A document that declares nothing serves both: the pair is the system's
  // own default, and a document that cannot be read is caught by the parse.
  deepStrictEqual(declaredModes("{}"), ["light", "dark"]);
  deepStrictEqual(declaredModes("{ not json"), ["light", "dark"]);
});

test("a theme that serves the chosen mode wears it", () => {
  deepStrictEqual(resolveMode(["light", "dark"], "dark"), "dark");
});

test("a theme that does not serve the chosen mode wears its own first", () => {
  // The clamp: a theme that serves one mode cannot be shown in the other,
  // so it stands in the mode it does serve.
  deepStrictEqual(resolveMode(["light"], "dark"), "light");
  deepStrictEqual(resolveMode(["dark"], "light"), "dark");
});

test("the file state says unsaved while the editor holds edits", () => {
  deepStrictEqual(fileState("edited", "written", "written"), "unsaved");
  deepStrictEqual(
    stateLabel(fileState("edited", "written", "written")),
    "unsaved changes",
  );
});

test("the file state says changed when the file moved under the studio", () => {
  // Nothing of the author's own is at stake: the editor, the last write and
  // the file all agree — and the file is not what the studio wrote.
  deepStrictEqual(fileState("written", "written", "moved"), "changed");
  deepStrictEqual(
    stateLabel(fileState("written", "written", "moved")),
    "changed on disk",
  );
});

test("a document that holds edits and a file that moved says changed", () => {
  // Two facts can hold at once, and the one that bites is the world's: the
  // save that would overwrite the file is refused, so the state has to say
  // so even while the author holds edits of their own. Answering "unsaved"
  // here would hide the refusal behind the author's own work.
  deepStrictEqual(fileState("edited", "written", "moved"), "changed");
  deepStrictEqual(
    stateLabel(fileState("edited", "written", "moved")),
    "changed on disk",
  );
});

test("the file state says saved only when all three agree", () => {
  deepStrictEqual(fileState("written", "written", "written"), "saved");
  deepStrictEqual(
    stateLabel(fileState("written", "written", "written")),
    "saved",
  );
});

test("a file that is not what the studio wrote has moved", () => {
  // The world's fact, on its own: the file holds something the studio never
  // wrote, so writing over it would destroy a change the studio never saw.
  // The editor's own edits are beside the question — they can hold at the
  // same time, and they do not make the file less moved.
  deepStrictEqual(fileMoved("written", "moved"), true);
  deepStrictEqual(fileMoved("written", "written"), false);
  // A file the studio has not written, or cannot see, has not moved: there
  // is nothing for it to have moved away from.
  deepStrictEqual(fileMoved(undefined, "moved"), false);
  deepStrictEqual(fileMoved("written", undefined), false);
});
