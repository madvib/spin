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

import { assert, assertEquals } from "@std/assert";
import {
  applyFix,
  applyOrder,
  corpus,
  declareShortcut,
  lintSource,
} from "../src/source.ts";

/** A project with the given source, and a configuration beside it. */
async function project(
  source: string,
  config = `export default { plugins: [] };`,
): Promise<string> {
  const root = await Deno.makeTempDir();
  await Deno.mkdir(`${root}/spin`);
  await Deno.mkdir(`${root}/src`);
  await Deno.writeTextFile(`${root}/src/app.tsx`, source);
  await Deno.writeTextFile(`${root}/vite.config.ts`, config);
  return root;
}

/** A source with one class nothing can produce, and one the theme owns. */
const DIRTY = `export const App = () => (
  <div className="not-a-class">
    <h1 className="text-lg">Title</h1>
  </div>
);
`;

Deno.test("a finding says what is wrong and what to do about it", async () => {
  const root = await project(DIRTY);
  try {
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    const unknown = findings.find((finding) =>
      finding.ruleId === "spin/closed-vocabulary"
    );
    assert(unknown !== undefined, "the unknown class was not reported");
    assertEquals(unknown.file, "src/app.tsx");
    assert(
      unknown.message.includes("not-a-class"),
      `the message names the class: ${unknown.message}`,
    );
    assertEquals(unknown.remedy, "Drop `not-a-class`");
    assertEquals(unknown.fixable, true);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a finding with no mechanical fix says what to do instead", async () => {
  const root = await project(DIRTY);
  try {
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    const override = findings.find((finding) =>
      finding.ruleId === "spin/prefer-theme-value"
    );
    assert(override !== undefined, "the override was not reported");
    assertEquals(override.fixable, false);
    assert(
      override.remedy !== null && override.remedy.length > 0,
      "a finding that cannot be fixed says what to do instead",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("the findings are grouped by the rule that said them", async () => {
  const root = await project(DIRTY);
  try {
    const report = await lintSource(root);
    assertEquals(report.groups.length, 2);
    assertEquals(
      report.groups.every((group) => group.findings.length > 0),
      true,
    );
    // A group is the rule, and the rule says what it is for.
    assert(
      report.groups.every((group) => group.title.length > 0),
      "every group says what the rule is for",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a fix changes the file, and the finding is gone because of it", async () => {
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
    assertEquals(fixed.applied, true);
    assertEquals(fixed.error, null);

    // The file says what the fix settled: the class is gone from the disk.
    const text = await Deno.readTextFile(`${root}/src/app.tsx`);
    assert(
      !text.includes("not-a-class"),
      `the class is still in the file: ${text}`,
    );

    // And the finding is gone because the code changed: the rules are run
    // again over the file as it now stands.
    const after = await lintSource(root);
    assertEquals(
      after.groups.flatMap((group) => group.findings).filter((candidate) =>
        candidate.ruleId === "spin/closed-vocabulary"
      ),
      [],
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a finding that cannot be fixed is not written to the file", async () => {
  const root = await project(DIRTY);
  try {
    const before = await lintSource(root);
    const finding = before.groups.flatMap((group) => group.findings).find(
      (candidate) => !candidate.fixable,
    );
    assert(finding !== undefined, "there was nothing that cannot be fixed");
    const text = await Deno.readTextFile(`${root}/src/app.tsx`);

    const fixed = await applyFix(root, finding.file, {
      ruleId: finding.ruleId,
      line: finding.line,
      column: finding.column,
    });
    assertEquals(fixed.applied, false);
    assert(fixed.error !== null, "a refused fix says why");
    assertEquals(await Deno.readTextFile(`${root}/src/app.tsx`), text);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a file outside the project is not one the project may write", async () => {
  const root = await project(DIRTY);
  try {
    const fixed = await applyFix(root, "../elsewhere.tsx", {
      ruleId: "spin/closed-vocabulary",
      line: 1,
      column: 1,
    });
    assertEquals(fixed.applied, false);
    assert(fixed.error !== null, "a path outside the project is refused");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("the corpus reports the composition the source repeats", async () => {
  const root = await project(`export const App = () => (
  <div>
    <span className="flex flex-col gap-4" />
    <span className="flex flex-col gap-4" />
  </div>
);
`);
  try {
    const report = await corpus(root);
    assertEquals(report.repetition.length, 1);
    const repetition = report.repetition[0]!;
    assertEquals(repetition.classes, ["flex", "flex-col", "gap-4"]);
    assertEquals(repetition.count, 2);
    assertEquals(repetition.files, ["src/app.tsx"]);
    assertEquals(repetition.suggested, "stack");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("the corpus reports the class lists that are not in order", async () => {
  // The sheet writes the layout before the spacing, so a list that spends
  // the spacing first reads backwards.
  const root = await project(`export const App = () => (
  <div className="gap-4 flex" />
);
`);
  try {
    const report = await corpus(root);
    assertEquals(report.order.length, 1);
    const file = report.order[0]!;
    assertEquals(file.file, "src/app.tsx");
    const attribute = file.attributes[0]!;
    assertEquals(attribute.classes, ["gap-4", "flex"]);
    assertEquals(attribute.ordered, ["flex", "gap-4"]);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("the class lists are written in the order the sheet writes them", async () => {
  const root = await project(`export const App = () => (
  <div className="gap-4 flex" />
);
`);
  try {
    const written = await applyOrder(root, "src/app.tsx");
    assertEquals(written.applied, true);
    assertEquals(written.error, null);
    const text = await Deno.readTextFile(`${root}/src/app.tsx`);
    assert(
      text.includes('className="flex gap-4"'),
      `the classes are not in order: ${text}`,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a shortcut is declared in the project's own configuration", async () => {
  const root = await project(
    `export const App = () => <span className="flex flex-col gap-4" />;
`,
    `import { spin } from "@spin/preset";

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
    assertEquals(declared.error, null);
    assertEquals(declared.file, "vite.config.ts");
    const text = await Deno.readTextFile(`${root}/vite.config.ts`);
    assert(
      text.includes('"stack": "flex flex-col gap-4"'),
      `the shortcut was not declared: ${text}`,
    );
    // And the project's own vocabulary knows it: a class the project
    // declared is a class the project produces.
    const report = await lintSource(root);
    assertEquals(
      report.groups.flatMap((group) => group.findings).filter((finding) =>
        finding.message.includes("flex flex-col gap-4")
      ),
      [],
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a project with no configuration is told where a shortcut would go", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(`${root}/spin`);
    const declared = await declareShortcut(root, "stack", ["flex"]);
    assert(declared.error !== null, "there is nowhere to declare it");
    assertEquals(declared.file, null);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
