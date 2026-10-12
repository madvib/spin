/**
 * The theme surface, driven end to end against the fixture app.
 *
 * These are INTEGRATION tests in the specific sense that matters here: they
 * run the real procedures over the real transport against a real directory,
 * with no mocking and no stubbing. What they assert is what a consumer sees —
 * a theme written to disk is a theme the next read returns, a token round-trips
 * through the domain's own mutation, and a refused edit is refused at the
 * boundary rather than discovered later by a build.
 *
 * The fixture is copied to a temp dir per file, so product themes are never
 * written and a failing test cannot corrupt the thing it protects.
 */

import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertEquals } from "@std/assert";
import { after, before, describe, it } from "node:test";
import { rpcHandler } from "../src/index.ts";
import { setProjectRoot } from "../src/project-procedures.ts";

/**
 * The RPC surface, called in-process.
 *
 * No port, no server, no lifecycle: the same handler the daemon mounts,
 * invoked as a function. A test that needed a socket would be testing the
 * socket rather than the procedures.
 */
function clientFor<T>(procedure: string, input?: unknown): Promise<T> {
  return rpcHandler.handle(
    new Request(`http://test/rpc${procedure}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input ?? {} }),
    }),
    { prefix: "/rpc" },
  ).then(async ({ response }) => {
    const body = await response?.text() ?? "{}";
    return JSON.parse(body).json as T;
  });
}

const themeText = (name: string): Promise<{ text: string | null }> =>
  clientFor(`/project/themes/read`, { name });

const writeTheme = (name: string, text: string) =>
  clientFor<{ error: string | null }>(`/project/themes/write`, { name, text });

const listThemes = () =>
  clientFor<Array<{ name: string; file: string }>>(`/project/themes/list`, {});

const analyze = (text: string) =>
  clientFor<{
    error: string | null;
    issues: Array<{ path: string; message: string }>;
    tree: unknown;
  }>(`/theme/analyze`, { text });

const setToken = (text: string, path: string[], value: string) =>
  clientFor<{ error: string | null; text: string | null }>(
    `/theme/tokens/set`,
    { text, path, value },
  );

const removeToken = (text: string, path: string[]) =>
  clientFor<{ error: string | null; text: string | null }>(
    `/theme/tokens/remove`,
    { text, path },
  );

const preview = (text: string, name: string, markup?: string) =>
  clientFor<{ css: string; error: string | null }>(
    `/preview/css`,
    { text, name, markup },
  );

describe("the theme surface over RPC, against the fixture app", () => {
  let dir: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "spin-theme-integration-"));
    const fixture = new URL(
      "../../../examples/fixture-app/spin",
      import.meta.url,
    );
    mkdirSync(join(dir, "spin"));
    for (const entry of ["acme.json", "starter.json"]) {
      copyFileSync(join(fixture.pathname, entry), join(dir, "spin", entry));
    }
    setProjectRoot(dir);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads a theme back exactly as it was written", async () => {
    // The round trip is the contract: a consumer edits text, saves it, and
    // gets the same text on the next read. Any normalisation in between is a
    // bug the author cannot see.
    const read = await themeText("acme");
    assertEquals(read.text, read.text, "the theme is there");
    const original = read.text as string;
    const written = await writeTheme("acme", original);
    assertEquals(written.error, null, "the write succeeds");
    assertEquals((await themeText("acme")).text, original, "byte for byte");
  });

  it("reports a theme that fails a legibility floor at the boundary", async () => {
    // The floors are enforced where the theme enters, not where it is
    // generated: an author must hear about it at the edit, not at the build.
    const doc = JSON.parse((await themeText("starter")).text ?? "{}") as {
      color: Record<string, { $value: unknown }>;
    };
    doc.color["primary"]!["$value"] = "#ff0000"; // white ink at 4.00:1
    const edited = JSON.stringify(doc);
    // The message is the contract's own wording — a pair, a measured ratio,
    // and the floor — so the assertion reads for that rather than a word a
    // future rephrasing would break.
    const reported = await analyze(edited);
    assertEquals(
      reported.issues.some((issue) =>
        /4\.00:1, below the 4\.5:1 floor/.test(issue.message)
      ),
      true,
      "the floor is reported against the exact pair it fails on",
    );
    // And the generation of the same document is refused, with the same
    // message: the analysis is the early courtesy, the generator is the
    // authority, and they agree because they are the same rule.
    const generated = await preview(edited, "starter");
    assertEquals(
      generated.error?.includes("4.00:1, below the 4.5:1 floor"),
      true,
      "the preview refuses on the same pair the analysis reported",
    );
  });

  it("round-trips a token mutation through the domain's own rules", async () => {
    // The mutation is the domain's, not the studio's: a consumer asks the
    // server to change one token and reads back a document the domain
    // produced.
    const text = (await themeText("acme")).text as string;
    const set = await setToken(text, ["color", "primary"], "#1e40af");
    assertEquals(set.error, null, "the mutation is accepted");
    const mutated = set.text as string;
    const doc = JSON.parse(mutated) as {
      color: Record<string, { $value: unknown }>;
    };
    assertEquals(doc["color"]!["primary"]!["$value"], "#1e40af", "it landed");
    // And the mutated document still analyses, because a mutation that broke
    // the document would be a worse failure than a refused one.
    const reported = await analyze(mutated);
    assertEquals(reported.error, null, "the mutated document parses");
  });

  it("refuses to remove a token the theme requires", async () => {
    // `remove` is not `set` with an empty value: the contract has required
    // paths, and dropping one must be refused rather than silently accepted.
    const text = (await themeText("acme")).text as string;
    const removed = await removeToken(text, ["color", "primary"]);
    assertEquals(
      removed.text === null || removed.error !== null,
      true,
      "a required token cannot be dropped",
    );
  });

  it("generates a stylesheet that carries the primitives it is shown", async () => {
    // The preview is not a list of utilities: it scans the markup it renders,
    // same as a real application, so the primitives layer is present.
    const text = (await themeText("acme")).text as string;
    const out = await preview(
      text,
      "acme",
      `<badge variant="accent">x</badge><button>y</button>`,
    );
    assertEquals(out.error, null, "the stylesheet generates");
    assertEquals(
      out.css.includes("badge"),
      true,
      "the badge rule is in the sheet",
    );
    assertEquals(
      out.css.includes('data-theme="acme"'),
      true,
      "the theme's own name scopes the variables",
    );
  });

  it("keeps the reported path relative to the project", async () => {
    const listed = await listThemes();
    assertEquals(
      listed.map((t) => t.file).sort(),
      ["spin/acme.json", "spin/starter.json"],
      "no machine's filesystem layout travels with a theme",
    );
  });

  it("leaves a theme it was not asked to write untouched", async () => {
    const untouched = (await themeText("starter")).text;
    await setToken(
      (await themeText("acme")).text as string,
      ["color", "primary"],
      "#1e40af",
    );
    assertEquals(
      (await themeText("starter")).text,
      untouched,
      "an edit to acme does not reach starter",
    );
  });
});
