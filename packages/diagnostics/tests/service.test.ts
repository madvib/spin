import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { join, relative } from "node:path";
import type { RenderedFinding, RenderedHarness } from "../src/check.ts";
import type { TextEdit } from "../src/core.ts";
import { applyFixes } from "../src/engine.ts";
import { check, lint } from "../src/service.ts";

/**
 * The service, on its own.
 *
 * The service is the package's front door: the rules over a path, and the
 * rendered checks over a running app. What matters here is that the
 * service answers for WHAT IT WAS ASKED ABOUT — the disk or the text a
 * caller holds — and that it never writes: the finding carries the edit,
 * and the caller applies it.
 */

/** A file with something to report. */
const DIRTY = `export const App = () => <span className="not-a-class" />;
`;

/** The same file, with nothing to report. */
const CLEAN = `export const App = () => <span className="flex gap-2" />;
`;

test("the lint reads the disk when it is given nothing else", async () => {
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(file, DIRTY);
    const { findings } = await lint(file);
    deepStrictEqual(findings.map((finding) => finding.ruleId), [
      "spin/closed-vocabulary",
    ]);
    deepStrictEqual(findings.map((finding) => finding.file), [file]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("a staged document is read instead of the file on disk", async () => {
  // The studio's panel reports on what the editor holds; the editor's
  // linter reports on what is saved. So the same file, staged with
  // different text, gives different findings.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(file, DIRTY);

    const staged = await lint(file, {
      kind: "staged",
      documents: [{ path: file, text: CLEAN }],
    });
    deepStrictEqual(staged.findings, []);

    const saved = await lint(file);
    deepStrictEqual(saved.findings.map((finding) => finding.messageId), [
      "unknown",
    ]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("a staged document is found by the path it resolves to", async () => {
  // The caller may hand a path absolute or relative; the lint compares the
  // paths as they resolve, so either is understood.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(file, CLEAN);
    const staged = await lint(file, {
      kind: "staged",
      documents: [{ path: relative(process.cwd(), file), text: DIRTY }],
    });
    deepStrictEqual(staged.findings.map((finding) => finding.messageId), [
      "unknown",
    ]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the findings carry the edit that settles them", async () => {
  // The service does not write: the decision about what to change belongs
  // to the core, and the change belongs to whoever holds the file. So the
  // edit the finding carries is the one that drops the class.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const file = `${directory}/app.tsx`;
    await writeFile(file, DIRTY);
    const { findings } = await lint(file);
    const fix = findings[0]?.fix;
    deepStrictEqual(fix === undefined, false);
    deepStrictEqual(
      applyFixes(DIRTY, [fix as TextEdit]).code,
      `export const App = () => <span className="" />;\n`,
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the check answers with what the harness found", async () => {
  // The checks are the harness's: the service calls it and reads back what
  // it measured. It never looks at a page itself.
  const found: RenderedFinding[] = [{
    route: "/components/button",
    theme: "default",
    mode: "base",
    check: "contrast",
    subject: 'button "Save"',
    detail: "3.90:1 — #333 on #fff",
    state: "rest",
  }];
  const harness: RenderedHarness = {
    run: (url: string) =>
      Promise.resolve({
        findings: url === "http://localhost:5173" ? found : [],
        code: url === "http://localhost:5173" ? 1 : 0,
      }),
  };

  const report = await check("http://localhost:5173", harness);
  deepStrictEqual(report.findings, found);
  deepStrictEqual(report.failed, ["contrast"]);
  deepStrictEqual(report.code, 1);

  const quiet = await check("http://localhost:5174", harness);
  deepStrictEqual(quiet.findings, []);
  deepStrictEqual(quiet.failed, []);
  deepStrictEqual(quiet.code, 0);
});
