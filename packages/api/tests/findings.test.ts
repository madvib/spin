/**
 * The findings procedures, over the wire.
 *
 * The daemon is the transport: the rules are the diagnostics' own and the
 * files are the project's own, and what is tested here is the crossing —
 * that a caller learns what the lints say, that a fix lands in the file,
 * and that the corpus's two facts arrive with the actions that settle
 * them.
 */

import { assert, assertEquals } from "@std/assert";
import { createSpinClient, setProjectRoot } from "@spin/api";
import { RPCHandler } from "@orpc/server/fetch";
import { router } from "@spin/api";

/** The daemon, served on an ephemeral port, over a project. */
function serve(root: string) {
  setProjectRoot(root);
  const handler = new RPCHandler(router);
  const server = Deno.serve({ port: 0, onListen: () => {} }, (
    request,
  ): Promise<Response> =>
    handler.handle(request, { prefix: "/rpc" }).then(
      ({ response }) => response ?? new Response("Not Found", { status: 404 }),
    ));
  const addr = server.addr as Deno.NetAddr;
  return {
    server,
    client: createSpinClient(`http://localhost:${addr.port}/rpc`),
  };
}

/** A project with a source file that has something to report. */
async function project(): Promise<string> {
  const root = await Deno.makeTempDir();
  await Deno.mkdir(`${root}/spin`);
  await Deno.mkdir(`${root}/src`);
  await Deno.writeTextFile(
    `${root}/src/app.tsx`,
    `export const App = () => (
  <div className="not-a-class">
    <span className="flex flex-col gap-4" />
    <span className="flex flex-col gap-4" />
  </div>
);
`,
  );
  await Deno.writeTextFile(
    `${root}/vite.config.ts`,
    `import { spin } from "@spin/preset";

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

Deno.test("the findings cross the wire, grouped by the rule that said them", async () => {
  const root = await project();
  const { server, client } = serve(root);
  try {
    const report = await client.findings.list({});
    const findings = report.groups.flatMap((group) => group.findings);
    const unknown = findings.find((finding) =>
      finding.ruleId === "spin/closed-vocabulary"
    );
    assert(unknown !== undefined, "the finding did not cross");
    assertEquals(unknown.file, "src/app.tsx");
    assertEquals(unknown.remedy, "Drop `not-a-class`");
    assertEquals(unknown.fixable, true);
    assertEquals(report.files, 2);
  } finally {
    await server.shutdown();
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a fix crosses the wire and lands in the file", async () => {
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
    assertEquals(fixed.applied, true);
    assertEquals(fixed.error, null);

    const text = await Deno.readTextFile(`${root}/src/app.tsx`);
    assert(
      !text.includes("not-a-class"),
      `the class is still in the file: ${text}`,
    );

    // The finding is gone because the code changed: the lints are run
    // again over the file as it now stands.
    const after = await client.findings.list({});
    assertEquals(
      after.groups.flatMap((group) => group.findings).filter((candidate) =>
        candidate.ruleId === "spin/closed-vocabulary"
      ),
      [],
    );
  } finally {
    await server.shutdown();
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("the corpus crosses the wire with the actions that settle it", async () => {
  const root = await project();
  const { server, client } = serve(root);
  try {
    const corpus = await client.findings.corpus({});
    assertEquals(corpus.repetition.length, 1);
    const repetition = corpus.repetition[0]!;
    assertEquals(repetition.classes, ["flex", "flex-col", "gap-4"]);
    assertEquals(repetition.count, 2);
    assertEquals(repetition.suggested, "stack");

    // The composition becomes a shortcut the project declares.
    const declared = await client.findings.shortcut({
      name: repetition.suggested,
      classes: repetition.classes,
    });
    assertEquals(declared.error, null);
    assertEquals(declared.file, "vite.config.ts");
    const config = await Deno.readTextFile(`${root}/vite.config.ts`);
    assert(
      config.includes('"stack": "flex flex-col gap-4"'),
      `the shortcut was not declared: ${config}`,
    );
  } finally {
    await server.shutdown();
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a file's class lists are written in the order the sheet writes them", async () => {
  const root = await project();
  await Deno.writeTextFile(
    `${root}/src/app.tsx`,
    `export const App = () => <div className="gap-4 flex" />;
`,
  );
  const { server, client } = serve(root);
  try {
    const corpus = await client.findings.corpus({});
    assertEquals(corpus.order.length, 1);
    assertEquals(corpus.order[0]?.file, "src/app.tsx");

    const written = await client.findings.order({ file: "src/app.tsx" });
    assertEquals(written.applied, true);
    const text = await Deno.readTextFile(`${root}/src/app.tsx`);
    assert(
      text.includes('className="flex gap-4"'),
      `the classes are not in order: ${text}`,
    );
  } finally {
    await server.shutdown();
    await Deno.remove(root, { recursive: true });
  }
});
