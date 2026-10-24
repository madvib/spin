import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
/**
 * The project's source: the findings, the fixes, and the corpus.
 *
 * These are the operations a tool pointed at a project needs: what the
 * lints say about the project's own source, the edit that settles a
 * finding, and the two facts the corpus holds — the compositions the
 * source repeats, and the class lists that are not in the order the sheet
 * writes them.
 *
 * The fixture is a project: a `spin/` directory (the mark of one), a
 * source file, and the build configuration beside it. The themes are the
 * shipped starters, so the vocabulary is the one every project serves.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import {
  applyFix,
  applyOrder,
  corpus,
  declareShortcut,
  lintSource,
} from "../../src/diagnostics/source.ts";

/** A project with the given source, and a configuration beside it. */
async function project(
  source: string,
  config = `export default { plugins: [] };`,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  await mkdir(`${root}/spin`);
  await mkdir(`${root}/src`);
  await writeFile(`${root}/src/app.tsx`, source);
  await writeFile(`${root}/vite.config.ts`, config);
  return root;
}

/** A source with one class nothing can produce, and one the theme owns. */
const DIRTY = `export const App = () => (
  <div className="not-a-class">
    <h1 className="text-lg">Title</h1>
  </div>
);
`;

test("a finding says what is wrong and what to do about it", async () => {
  const root = await project(DIRTY);
  try {
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    const unknown = findings.find((finding) =>
      finding.ruleId === "spin/closed-vocabulary"
    );
    assert(unknown !== undefined, "the unknown class was not reported");
    deepStrictEqual(unknown.file, "src/app.tsx");
    assert(
      unknown.message.includes("not-a-class"),
      `the message names the class: ${unknown.message}`,
    );
    deepStrictEqual(unknown.remedy, "Drop `not-a-class`");
    deepStrictEqual(unknown.fixable, true);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a finding with no mechanical fix says what to do instead", async () => {
  const root = await project(DIRTY);
  try {
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    const override = findings.find((finding) =>
      finding.ruleId === "spin/prefer-theme-value"
    );
    assert(override !== undefined, "the override was not reported");
    deepStrictEqual(override.fixable, false);
    assert(
      override.remedy !== null && override.remedy.length > 0,
      "a finding that cannot be fixed says what to do instead",
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("the findings are grouped by the rule that said them", async () => {
  const root = await project(DIRTY);
  try {
    const report = await lintSource(root);
    deepStrictEqual(report.groups.length, 2);
    deepStrictEqual(
      report.groups.every((group) => group.findings.length > 0),
      true,
    );
    // A group is the rule, and the rule says what it is for.
    assert(
      report.groups.every((group) => group.title.length > 0),
      "every group says what the rule is for",
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a fix changes the file, and the finding is gone because of it", async () => {
  const root = await project(DIRTY);
  try {
    const before = await lintSource(root);
    const finding = before.groups.flatMap((group) => group.findings).find(
      (candidate) => candidate.fixable,
    );
    assert(finding !== undefined, "there was nothing to fix");

    const fixed = await applyFix(root, finding.file, {
      ruleId: finding.ruleId,
      line: finding.line,
      column: finding.column,
    });
    deepStrictEqual(fixed.applied, true);
    deepStrictEqual(fixed.error, null);

    // The file says what the fix settled: the class is gone from the disk.
    const text = await readFile(`${root}/src/app.tsx`, "utf8");
    assert(
      !text.includes("not-a-class"),
      `the class is still in the file: ${text}`,
    );

    // And the finding is gone because the code changed: the rules are run
    // again over the file as it now stands.
    const after = await lintSource(root);
    deepStrictEqual(
      after.groups.flatMap((group) => group.findings).filter((candidate) =>
        candidate.ruleId === "spin/closed-vocabulary"
      ),
      [],
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a finding that cannot be fixed is not written to the file", async () => {
  const root = await project(DIRTY);
  try {
    const before = await lintSource(root);
    const finding = before.groups.flatMap((group) => group.findings).find(
      (candidate) => !candidate.fixable,
    );
    assert(finding !== undefined, "there was nothing that cannot be fixed");
    const text = await readFile(`${root}/src/app.tsx`, "utf8");

    const fixed = await applyFix(root, finding.file, {
      ruleId: finding.ruleId,
      line: finding.line,
      column: finding.column,
    });
    deepStrictEqual(fixed.applied, false);
    assert(fixed.error !== null, "a refused fix says why");
    deepStrictEqual(await readFile(`${root}/src/app.tsx`, "utf8"), text);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a file outside the project is not one the project may write", async () => {
  const root = await project(DIRTY);
  try {
    const fixed = await applyFix(root, "../elsewhere.tsx", {
      ruleId: "spin/closed-vocabulary",
      line: 1,
      column: 1,
    });
    deepStrictEqual(fixed.applied, false);
    assert(fixed.error !== null, "a path outside the project is refused");
  } finally {
    await rm(root, { recursive: true });
  }
});

test("the corpus reports the composition the source repeats", async () => {
  const root = await project(`export const App = () => (
  <div>
    <span className="flex flex-col gap-4" />
    <span className="flex flex-col gap-4" />
  </div>
);
`);
  try {
    const report = await corpus(root);
    deepStrictEqual(report.repetition.length, 1);
    const repetition = report.repetition[0]!;
    deepStrictEqual(repetition.classes, ["flex", "flex-col", "gap-4"]);
    deepStrictEqual(repetition.count, 2);
    deepStrictEqual(repetition.files, ["src/app.tsx"]);
    deepStrictEqual(repetition.suggested, "stack");
  } finally {
    await rm(root, { recursive: true });
  }
});

test("the corpus reports the class lists that are not in order", async () => {
  // The sheet writes the layout before the spacing, so a list that spends
  // the spacing first reads backwards.
  const root = await project(`export const App = () => (
  <div className="gap-4 flex" />
);
`);
  try {
    const report = await corpus(root);
    deepStrictEqual(report.order.length, 1);
    const file = report.order[0]!;
    deepStrictEqual(file.file, "src/app.tsx");
    const attribute = file.attributes[0]!;
    deepStrictEqual(attribute.classes, ["gap-4", "flex"]);
    deepStrictEqual(attribute.ordered, ["flex", "gap-4"]);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("the class lists are written in the order the sheet writes them", async () => {
  const root = await project(`export const App = () => (
  <div className="gap-4 flex" />
);
`);
  try {
    const written = await applyOrder(root, "src/app.tsx");
    deepStrictEqual(written.applied, true);
    deepStrictEqual(written.error, null);
    const text = await readFile(`${root}/src/app.tsx`, "utf8");
    assert(
      text.includes('className="flex gap-4"'),
      `the classes are not in order: ${text}`,
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a shortcut is declared in the project's own configuration", async () => {
  const root = await project(
    `export const App = () => <span className="flex flex-col gap-4" />;
`,
    `import { spin } from "../../src/preset/index.ts";

export default {
  plugins: [
    spin.vite({
      shortcuts: {
        "row": "flex items-center gap-4",
      },
    }),
  ],
};
`,
  );
  try {
    const declared = await declareShortcut(root, "stack", [
      "flex",
      "flex-col",
      "gap-4",
    ]);
    deepStrictEqual(declared.error, null);
    deepStrictEqual(declared.file, "vite.config.ts");
    const text = await readFile(`${root}/vite.config.ts`, "utf8");
    assert(
      text.includes('"stack": "flex flex-col gap-4"'),
      `the shortcut was not declared: ${text}`,
    );
    // And the project's own vocabulary knows it: a class the project
    // declared is a class the project produces.
    const report = await lintSource(root);
    deepStrictEqual(
      report.groups.flatMap((group) => group.findings).filter((finding) =>
        finding.message.includes("flex flex-col gap-4")
      ),
      [],
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a project with no configuration is told where a shortcut would go", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/spin`);
    const declared = await declareShortcut(root, "stack", ["flex"]);
    assert(declared.error !== null, "there is nowhere to declare it");
    deepStrictEqual(declared.file, null);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("the markup beside the source is linted for the classes it carries", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/spin`);
    await mkdir(`${root}/src`);
    await writeFile(
      `${root}/src/card.html`,
      `<div class="p-72">hi</div>\n`,
    );
    await writeFile(
      `${root}/src/broken.html`,
      `<div {{{{\n`,
    );
    await writeFile(`${root}/vite.config.ts`, `export default {};`);
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    assert(
      findings.some((finding) =>
        finding.file.endsWith("card.html") && finding.message.includes("p-72")
      ),
      `the unknown class in markup was not reported: ${
        JSON.stringify(findings.map((finding) => finding.message))
      }`,
    );
    assert(
      findings.every((finding) => !finding.file.endsWith("broken.html")),
      "a file the parser cannot read is a file the lint says nothing about",
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("markup with an expression class list reports what the literals name", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/spin`);
    await mkdir(`${root}/src`);
    await writeFile(
      `${root}/src/panel.html`,
      `<script lang="ts">export const x = 1;</script>\n<button class={["p-72", { "rounded-md": true }]}>Go</button>\n`,
    );
    await writeFile(`${root}/vite.config.ts`, `export default {};`);
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    assert(
      findings.some((finding) =>
        finding.file.endsWith("panel.html") &&
        finding.ruleId === "spin/closed-vocabulary" &&
        finding.message.includes("p-72")
      ),
      `the unknown class inside class={[...]} was not reported: ${
        JSON.stringify(findings.map((finding) => finding.message))
      }`,
    );
    assert(
      findings.some((finding) =>
        finding.file.endsWith("panel.html") &&
        finding.ruleId === "spin/no-redundant-class" &&
        finding.message.includes("rounded-md")
      ),
      `the redundant class on <button> was not reported: ${
        JSON.stringify(findings.map((finding) => `${finding.ruleId}: ${finding.message}`))
      }`,
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a source file with a class expression reports both rules", async () => {
  const root = await project(
    `export const App = () => (\n  <button className={["rounded-md", { "p-72": true }]}>Go</button>\n);\n`,
  );
  try {
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    assert(
      findings.some((finding) =>
        finding.ruleId === "spin/no-redundant-class" &&
        finding.message.includes("rounded-md")
      ),
      `the redundant class in className={[...]} was not reported: ${
        JSON.stringify(findings.map((finding) => `${finding.ruleId}: ${finding.message}`))
      }`,
    );
    assert(
      findings.some((finding) =>
        finding.ruleId === "spin/closed-vocabulary" &&
        finding.message.includes("p-72")
      ),
      `the unknown class in className={[...]} was not reported: ${
        JSON.stringify(findings.map((finding) => finding.message))
      }`,
    );
  } finally {
    await rm(root, { recursive: true });
  }
});
