import { assertEquals } from "@std/assert";
import {
  CliUsageError,
  collectFiles,
  formatJson,
  lint,
  parseArgs,
  run,
} from "../src/cli.ts";

/**
 * The CLI, on its own.
 *
 * The CLI is the checks without a linter: a project runs them over its own
 * source and reads what they say. What matters here is that the readings
 * are the rules' readings — the same decisions the linters deliver — and
 * that a script can read the answer, whether it is a person or a pipeline.
 */

/** A file with something to report, and a file with nothing. */
const DIRTY = `export function App() {
  return <span className="not-a-class" />;
}
`;

const CLEAN = `export function App() {
  return <span className="flex gap-2" />;
}
`;

/** A directory holding the two files. */
async function fixture(): Promise<string> {
  const directory = await Deno.makeTempDir();
  await Deno.writeTextFile(`${directory}/dirty.tsx`, DIRTY);
  await Deno.writeTextFile(`${directory}/clean.tsx`, CLEAN);
  return directory;
}

/** The CLI's findings, over a directory. */
function findingsOf(
  directory: string,
  argv: readonly string[] = [],
): ReturnType<typeof lint>["findings"] {
  const options = parseArgs([...argv, directory]);
  return lint(collectFiles(options.paths), options).findings;
}

Deno.test("the CLI reports what the rules decided", async () => {
  const directory = await fixture();
  try {
    const findings = findingsOf(directory);
    assertEquals(findings.map((finding) => finding.ruleId), [
      "spin/closed-vocabulary",
    ]);
    assertEquals(findings.map((finding) => finding.messageId), ["unknown"]);
    assertEquals(findings.map((finding) => finding.line), [2]);
    assertEquals(findings.map((finding) => finding.column), [16]);
    assertEquals(findings.map((finding) => finding.file), [
      `${directory}/dirty.tsx`,
    ]);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("the CLI reads the files under a path, not the ones beside it", async () => {
  const directory = await fixture();
  try {
    const files = collectFiles([directory]);
    assertEquals(files.toSorted(), [
      `${directory}/clean.tsx`,
      `${directory}/dirty.tsx`,
    ]);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("the dials are the rule's own", async () => {
  const directory = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(
      `${directory}/app.tsx`,
      `export const App = () => <button className="text-sm bg-primary" />;\n`,
    );
    const strict = findingsOf(directory, ["--strictness", "strict"]);
    const balanced = findingsOf(directory, ["--strictness", "balanced"]);
    assertEquals(strict.map((finding) => finding.message), [
      "`bg-primary` sets `background-color` to what `<button>` already sets. Drop the class.",
      "the theme sets the size of `<button>`; `text-sm` fights it. Use the theme's value.",
    ]);
    assertEquals(balanced.map((finding) => finding.message), [
      "`bg-primary` sets `background-color` to what `<button>` already sets. Drop the class.",
    ]);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("the CLI applies the edits its findings carry", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const file = `${directory}/app.tsx`;
    await Deno.writeTextFile(
      file,
      `export const App = () => <span className="not-a-class" />;\n`,
    );
    // A class the theme cannot produce styles nothing, so dropping it
    // changes nothing — and the CLI drops it.
    const code = run([file, "--fix"], () => {});
    assertEquals(code, 0);
    assertEquals(
      await Deno.readTextFile(file),
      `export const App = () => <span className="" />;\n`,
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("the CLI says what it fixed", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const file = `${directory}/app.tsx`;
    await Deno.writeTextFile(
      file,
      `export const App = () => <span className="not-a-class" />;\n`,
    );
    const lines: string[] = [];
    const code = run([file, "--fix"], (line) => lines.push(line));
    // The finding was settled by the edit, so there is nothing left to
    // report: the exit code says so.
    assertEquals(code, 0);
    assertEquals(lines, [""]);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("the JSON format is a machine's answer", async () => {
  const directory = await fixture();
  try {
    const findings = findingsOf(directory);
    const report = JSON.parse(formatJson(findings)) as {
      findings: { ruleId: string; line: number; column: number }[];
      summary: { findings: number; files: number };
    };
    assertEquals(report.findings.map((finding) => finding.ruleId), [
      "spin/closed-vocabulary",
    ]);
    assertEquals(report.findings.map((finding) => finding.line), [2]);
    assertEquals(report.findings.map((finding) => finding.column), [16]);
    assertEquals(report.summary, { findings: 1, files: 1 });
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("the exit code is what a script reads", async () => {
  const directory = await fixture();
  try {
    const lines: string[] = [];
    const dirty = run([`${directory}/dirty.tsx`], (line) => lines.push(line));
    assertEquals(dirty, 1);
    assertEquals(
      lines.join("\n"),
      [
        `${directory}/dirty.tsx`,
        "  2:16  spin/closed-vocabulary  `not-a-class` is not in the spin vocabulary and generates no CSS. Use a token, or drop it.",
        "",
        "1 finding",
      ].join("\n"),
    );

    const clean = run([`${directory}/clean.tsx`], (line) => lines.push(line));
    assertEquals(clean, 0);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("a path that cannot be read is a usage error", () => {
  let thrown: unknown;
  try {
    collectFiles(["/nowhere/at/all"]);
  } catch (error) {
    thrown = error;
  }
  assertEquals(thrown instanceof CliUsageError, true);

  const lines: string[] = [];
  const warnings: string[] = [];
  const code = run(
    ["/nowhere/at/all"],
    (line) => lines.push(line),
    (line) => warnings.push(line),
  );
  assertEquals(code, 2);
  assertEquals(warnings, ['Cannot read "/nowhere/at/all".']);
});

Deno.test("a file that does not parse is reported, not swallowed", async () => {
  // The CLI has no linter to fall back on, so a file it cannot read is
  // something the person running it has to know about.
  const directory = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(`${directory}/broken.tsx`, `export const = ;\n`);
    const warnings: string[] = [];
    const code = run(
      [`${directory}/broken.tsx`],
      () => {},
      (line) => warnings.push(line),
    );
    assertEquals(code, 2);
    assertEquals(warnings, [`Could not read "${directory}/broken.tsx".`]);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("an advisory is reported and does not fail the run", async () => {
  // The wrong element cannot be banned: a span carrying the size the theme
  // gives the heading may be deliberate. So the rule is a suggestion, the
  // finding is a warning, and the run still passes.
  const directory = await Deno.makeTempDir();
  try {
    const file = `${directory}/app.tsx`;
    await Deno.writeTextFile(
      file,
      `export const App = () => <span className="text-3xl" />;\n`,
    );
    const findings = findingsOf(directory);
    assertEquals(
      findings.map((finding) => [finding.ruleId, finding.severity]),
      [
        ["spin/prefer-element", "warning"],
      ],
    );
    const lines: string[] = [];
    assertEquals(run([file], (line) => lines.push(line)), 0);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("an error fails the run", async () => {
  // The other way round: an override of a decision the system made is
  // banned, and a banned thing fails the run.
  const directory = await Deno.makeTempDir();
  try {
    const file = `${directory}/app.tsx`;
    await Deno.writeTextFile(
      file,
      `export const App = () => <h3 className="text-sm" />;\n`,
    );
    const findings = findingsOf(directory);
    assertEquals(
      findings.map((finding) => [finding.ruleId, finding.severity]),
      [
        ["spin/prefer-theme-value", "error"],
      ],
    );
    const lines: string[] = [];
    assertEquals(run([file], (line) => lines.push(line)), 1);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("an option the CLI does not know is a usage error", () => {
  let thrown: unknown;
  try {
    parseArgs(["--nonsense", "src"]);
  } catch (error) {
    thrown = error;
  }
  assertEquals(thrown instanceof CliUsageError, true);
});
