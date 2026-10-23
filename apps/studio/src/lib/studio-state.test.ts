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

import { assert, assertEquals } from "@std/assert";
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

Deno.test("a document missing a required role is reported, not waved through", () => {
  // The preview refuses to build a theme that is missing a role, so the
  // panel that reports on the document has to agree with it: a theme the
  // preview will not build cannot be one the studio says nothing is wrong
  // with.
  const state = analyzeTheme(withoutRole("color.text"));
  assert(
    state.issues.some((issue) => issue.path === "color.text"),
    `the missing role is not reported: ${JSON.stringify(state.issues)}`,
  );
  assertEquals(state.error, undefined);
});

Deno.test("a document that declares every required role reports nothing", () => {
  const state = analyzeTheme(complete());
  assertEquals(state.error, undefined);
  assertEquals(state.issues, []);
});

Deno.test("a document that does not parse is reported as such", () => {
  const state = analyzeTheme("{ not json at all\n");
  assert(state.error !== undefined, "a broken document was not reported");
});

Deno.test("the modes a document declares are the modes it serves", () => {
  const light = declaredModes(
    JSON.stringify({ modes: ["light"], color: {} }),
  );
  assertEquals(light, ["light"]);
  // A document that declares nothing serves both: the pair is the system's
  // own default, and a document that cannot be read is caught by the parse.
  assertEquals(declaredModes("{}"), ["light", "dark"]);
  assertEquals(declaredModes("{ not json"), ["light", "dark"]);
});

Deno.test("a theme that serves the chosen mode wears it", () => {
  assertEquals(resolveMode(["light", "dark"], "dark"), "dark");
});

Deno.test("a theme that does not serve the chosen mode wears its own first", () => {
  // The clamp: a theme that serves one mode cannot be shown in the other,
  // so it stands in the mode it does serve.
  assertEquals(resolveMode(["light"], "dark"), "light");
  assertEquals(resolveMode(["dark"], "light"), "dark");
});

Deno.test("the file state says unsaved while the editor holds edits", () => {
  assertEquals(fileState("edited", "written", "written"), "unsaved");
  assertEquals(
    stateLabel(fileState("edited", "written", "written")),
    "unsaved changes",
  );
});

Deno.test("the file state says changed when the file moved under the studio", () => {
  // Nothing of the author's own is at stake: the editor, the last write and
  // the file all agree — and the file is not what the studio wrote.
  assertEquals(fileState("written", "written", "moved"), "changed");
  assertEquals(
    stateLabel(fileState("written", "written", "moved")),
    "changed on disk",
  );
});

Deno.test("a document that holds edits and a file that moved says changed", () => {
  // Two facts can hold at once, and the one that bites is the world's: the
  // save that would overwrite the file is refused, so the state has to say
  // so even while the author holds edits of their own. Answering "unsaved"
  // here would hide the refusal behind the author's own work.
  assertEquals(fileState("edited", "written", "moved"), "changed");
  assertEquals(
    stateLabel(fileState("edited", "written", "moved")),
    "changed on disk",
  );
});

Deno.test("the file state says saved only when all three agree", () => {
  assertEquals(fileState("written", "written", "written"), "saved");
  assertEquals(
    stateLabel(fileState("written", "written", "written")),
    "saved",
  );
});

Deno.test("a file that is not what the studio wrote has moved", () => {
  // The world's fact, on its own: the file holds something the studio never
  // wrote, so writing over it would destroy a change the studio never saw.
  // The editor's own edits are beside the question — they can hold at the
  // same time, and they do not make the file less moved.
  assertEquals(fileMoved("written", "moved"), true);
  assertEquals(fileMoved("written", "written"), false);
  // A file the studio has not written, or cannot see, has not moved: there
  // is nothing for it to have moved away from.
  assertEquals(fileMoved(undefined, "moved"), false);
  assertEquals(fileMoved("written", undefined), false);
});
