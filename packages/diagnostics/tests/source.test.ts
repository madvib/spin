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
 * The fixture is a project: a `spin/` directory (the mark of one) holding
 * one named theme, a source file, and the build configuration beside it.
 * The sheet the order is read from is the project's own.
 */

import spinStarter from "../../theme/src/languages/editorial.json" with {
  type: "json",
};

import assert, { deepStrictEqual } from "node:assert/strict";
import {
  applyFix,
  applyOrder,
  corpus,
  declareShortcut,
  lintSource,
} from "../src/source.ts";

/** A project with the given source, a theme, and a configuration beside it. */
async function project(
  source: string,
  config = `export default { plugins: [] };`,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  await mkdir(`${root}/spin`);
  await mkdir(`${root}/src`);
  await writeFile(`${root}/src/app.tsx`, source);
  await writeFile(`${root}/spin/spin.json`, JSON.stringify(spinStarter));
  await writeFile(`${root}/vite.config.ts`, config);
  return root;
}

/** A source with one class nothing can produce, and one the theme owns. */
// TYPE-b: the override wears a named style — raw sizes are vocabulary
// warnings now, not theme fights.
const DIRTY = `export const App = () => (
  <div className="not-a-class">
    <h1 className="type-body">Title</h1>
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
    `import { spin } from "@spinjs/preset";

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

test("classList, variant attribute, dynamic interpolation, inline style, and Vue/Svelte files are linted", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/spin`);
    await mkdir(`${root}/src`);
    await writeFile(`${root}/vite.config.ts`, `export default {};`);
    await writeFile(
      `${root}/src/app.tsx`,
      [
        `export const App = (props: { active: boolean; tone: string }) => (`,
        `  <div>`,
        `    <div classList={{ "bg-primary": props.active, "text-primary": props.active, "bg-accent": props.tone }}>Mismatched</div>`,
        `    <div classList={{ "bg-primary": props.active, "text-on-primary": props.active }}>Paired</div>`,
        `    <button variant="primary" class="text-on-primary">Redundant</button>`,
        `    <span class={\`bg-\${props.tone}\`}>Dynamic</span>`,
        `    <p style={{ color: "#ff0000", top: "4px" }}>Inline</p>`,
        `    <style>{".a { color: red; }"}</style>`,
        `  </div>`,
        `);`,
      ].join("\n"),
    );
    await writeFile(
      `${root}/src/card.vue`,
      `<template>\n  <div :class="{ 'bg-primary': active, 'text-primary': active }">Vue</div>\n</template>\n`,
    );
    await writeFile(
      `${root}/src/item.svelte`,
      `<div class:bg-primary={active} class:text-primary={active} class:bg-accent={other}>Svelte</div>\n`,
    );
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    assert(
      findings.some(
        (f) => f.file.endsWith("app.tsx") && f.ruleId === "spin/no-unpaired-ink" && f.line === 3,
      ),
      `expected unpaired ink on classList at line 3, got: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.some(
        (f) =>
          f.file.endsWith("app.tsx") &&
          f.ruleId === "spin/no-redundant-class" &&
          f.message.includes("text-on-primary"),
      ),
      `expected redundant text-on-primary on <button variant="primary">, got: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.some(
        (f) =>
          f.file.endsWith("app.tsx") &&
          f.ruleId === "spin/closed-vocabulary" &&
          f.message.includes("bg-${…}"),
      ),
      `expected dynamic interpolation finding, got: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.some(
        (f) =>
          f.file.endsWith("app.tsx") &&
          f.ruleId === "spin/no-handwritten-tokens" &&
          f.message.includes("color"),
      ),
      `expected inline style color finding, got: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.some(
        (f) =>
          f.file.endsWith("app.tsx") &&
          f.ruleId === "spin/no-handwritten-tokens" &&
          f.message.includes("<style>"),
      ),
      `expected <style> finding, got: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.some(
        (f) => f.file.endsWith("card.vue") && f.ruleId === "spin/no-unpaired-ink",
      ),
      `expected Vue :class unpaired ink finding, got: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.some(
        (f) => f.file.endsWith("item.svelte") && f.ruleId === "spin/no-unpaired-ink",
      ),
      `expected Svelte class:bg-primary unpaired ink finding, got: ${JSON.stringify(findings)}`,
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("markup files report style blocks and inline theme styles, not document shells", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    await mkdir(`${root}/spin`);
    await mkdir(`${root}/src`);
    await writeFile(`${root}/spin/spin.json`, JSON.stringify(spinStarter));
    await writeFile(`${root}/vite.config.ts`, `export default {};`);
    await writeFile(
      `${root}/src/card.html`,
      `<card>\n  <span style="color: #2563eb">Pinned</span>\n  <span style="top: 4px">Placed</span>\n</card>\n<style>.a { color: red }</style>\n`,
    );
    await writeFile(
      `${root}/src/shell.html`,
      `<!doctype html>\n<html lang="en">\n<head><style>body { margin: 0 }</style></head>\n<body></body>\n</html>\n`,
    );
    const report = await lintSource(root);
    const findings = report.groups.flatMap((group) => group.findings);
    assert(
      findings.some(
        (f) =>
          f.file.endsWith("card.html") &&
          f.ruleId === "spin/no-handwritten-tokens" &&
          f.message.includes("`color`"),
      ),
      `expected inline style color finding in markup, got: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.some(
        (f) =>
          f.file.endsWith("card.html") &&
          f.ruleId === "spin/no-handwritten-tokens" &&
          f.message.includes("<style>"),
      ),
      `expected <style> finding in markup, got: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.every((f) => !f.file.endsWith("shell.html")),
      `a document shell owns its own head: ${JSON.stringify(findings)}`,
    );
    assert(
      findings.every((f) => !f.message.includes("`top`")),
      `runtime geometry stays legal inline: ${JSON.stringify(findings)}`,
    );
  } finally {
    await rm(root, { recursive: true });
  }
});
