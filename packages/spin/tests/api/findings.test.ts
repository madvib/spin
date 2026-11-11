import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
/**
 * The findings procedures, over the wire.
 *
 * The daemon is the transport: the rules are the diagnostics' own and the
 * files are the project's own, and what is tested here is the crossing —
 * that a caller learns what the lints say, that a fix lands in the file,
 * and that the corpus's two facts arrive with the actions that settle
 * them.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { createSpinClient, setProjectRoot } from "../../src/api/index.ts";
import spinStarter from "../../../theme/src/themes/editorial.json" with {
  type: "json",
};
import { RPCHandler } from "@orpc/server/fetch";
import { router } from "../../src/api/index.ts";

/** The daemon, served on an ephemeral port, over a project. */
function serve(root: string) {
  setProjectRoot(root);
  const handler = new RPCHandler(router);
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const { response } = await handler.handle(request, { prefix: "/rpc" });
      return response ?? new Response("Not Found", { status: 404 });
    },
  });
  return {
    server,
    client: createSpinClient(`http://localhost:${server.port}/rpc`),
  };
}

/** A project with a theme and a source file that has something to report. */
async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spin-"));
  await mkdir(`${root}/spin`);
  await writeFile(`${root}/spin/spin.json`, JSON.stringify(spinStarter));
  await mkdir(`${root}/src`);
  await writeFile(
    `${root}/src/app.tsx`,
    `export const App = () => (
  <div className="not-a-class">
    <span className="flex flex-col gap-4" />
    <span className="flex flex-col gap-4" />
  </div>
);
`,
  );
  await writeFile(
    `${root}/vite.config.ts`,
    `import { spin } from "@spinjs/preset";

export default {
  plugins: [
    spin.vite({
      shortcuts: {},
    }),
  ],
};
`,
  );
  return root;
}

test("the findings cross the wire, grouped by the rule that said them", async () => {
  const root = await project();
  const { server, client } = serve(root);
  try {
    const report = await client.findings.list({});
    const findings = report.groups.flatMap((group) => group.findings);
    const unknown = findings.find((finding) =>
      finding.ruleId === "spin/closed-vocabulary"
    );
    assert(unknown !== undefined, "the finding did not cross");
    deepStrictEqual(unknown.file, "src/app.tsx");
    deepStrictEqual(unknown.remedy, "Drop `not-a-class`");
    deepStrictEqual(unknown.fixable, true);
    deepStrictEqual(report.files, 2);
  } finally {
    await server.stop();
    await rm(root, { recursive: true });
  }
});

test("a fix crosses the wire and lands in the file", async () => {
  const root = await project();
  const { server, client } = serve(root);
  try {
    const report = await client.findings.list({});
    const finding = report.groups.flatMap((group) => group.findings).find(
      (candidate) => candidate.fixable,
    );
    assert(finding !== undefined, "there was nothing to fix");

    const fixed = await client.findings.fix({
      file: finding.file,
      ruleId: finding.ruleId,
      line: finding.line,
      column: finding.column,
    });
    deepStrictEqual(fixed.applied, true);
    deepStrictEqual(fixed.error, null);

    const text = await readFile(`${root}/src/app.tsx`, "utf8");
    assert(
      !text.includes("not-a-class"),
      `the class is still in the file: ${text}`,
    );

    // The finding is gone because the code changed: the lints are run
    // again over the file as it now stands.
    const after = await client.findings.list({});
    deepStrictEqual(
      after.groups.flatMap((group) => group.findings).filter((candidate) =>
        candidate.ruleId === "spin/closed-vocabulary"
      ),
      [],
    );
  } finally {
    await server.stop();
    await rm(root, { recursive: true });
  }
});

test("the corpus crosses the wire with the actions that settle it", async () => {
  const root = await project();
  const { server, client } = serve(root);
  try {
    const corpus = await client.findings.corpus({});
    deepStrictEqual(corpus.repetition.length, 1);
    const repetition = corpus.repetition[0]!;
    deepStrictEqual(repetition.classes, ["flex", "flex-col", "gap-4"]);
    deepStrictEqual(repetition.count, 2);
    deepStrictEqual(repetition.suggested, "stack");

    // The composition becomes a shortcut the project declares.
    const declared = await client.findings.shortcut({
      name: repetition.suggested,
      classes: repetition.classes,
    });
    deepStrictEqual(declared.error, null);
    deepStrictEqual(declared.file, "vite.config.ts");
    const config = await readFile(`${root}/vite.config.ts`, "utf8");
    assert(
      config.includes('"stack": "flex flex-col gap-4"'),
      `the shortcut was not declared: ${config}`,
    );
  } finally {
    await server.stop();
    await rm(root, { recursive: true });
  }
});

test("a file's class lists are written in the order the sheet writes them", async () => {
  const root = await project();
  await writeFile(
    `${root}/src/app.tsx`,
    `export const App = () => <div className="gap-4 flex" />;
`,
  );
  const { server, client } = serve(root);
  try {
    const corpus = await client.findings.corpus({});
    deepStrictEqual(corpus.order.length, 1);
    deepStrictEqual(corpus.order[0]?.file, "src/app.tsx");

    const written = await client.findings.order({ file: "src/app.tsx" });
    deepStrictEqual(written.applied, true);
    const text = await readFile(`${root}/src/app.tsx`, "utf8");
    assert(
      text.includes('className="flex gap-4"'),
      `the classes are not in order: ${text}`,
    );
  } finally {
    await server.stop();
    await rm(root, { recursive: true });
  }
});
