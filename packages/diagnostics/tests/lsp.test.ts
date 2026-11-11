import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { designLanguages } from "@spinjs/theme";
import { lint } from "../src/service.ts";
import { createState, handleMessage, type LspState } from "../../dev/src/lsp/server.ts";
import { completionsAt, hoverAt } from "../../dev/src/lsp/features.ts";
import { encodeFrame, isRequest, readFrames } from "../../dev/src/lsp/protocol.ts";
import { engineAnswers } from "@spinjs/preset";
import { readProjectThemes } from "../src/project.ts";
import { factsForFile, rootOf } from "../src/provider.ts";

/**
 * The LSP, on its own.
 *
 * The server is the lint's third reader: the oxlint and ESLint plugins
 * walk a tree, the CLI walks a path, and the server reads staged text.
 * What matters is that the three agree — the same findings, the same
 * severities — and that hover and completion read the same vocabulary
 * the closed-vocabulary rule enforces.
 */

/** A wire value asserted at the test boundary, then typed. */
function asserted(value: unknown, what: string): Record<string, unknown> {
  assert(typeof value === "object" && value !== null, what);
  return value as Record<string, unknown>;
}

/** Whether a reply carries publishDiagnostics params. */
function isPublish(
  reply: unknown,
): reply is { readonly method: string; readonly params: Record<string, unknown> } {
  if (typeof reply !== "object" || reply === null) return false;
  if (!("method" in reply) || reply.method !== "textDocument/publishDiagnostics") return false;
  return "params" in reply && typeof reply.params === "object" && reply.params !== null;
}

/** The published diagnostics in a params object. */
function diagnosticsOf(params: Record<string, unknown>): Array<Record<string, unknown>> {
  const diagnostics = params["diagnostics"];
  assert(Array.isArray(diagnostics), "expected a diagnostics list");
  return diagnostics.map((entry) => asserted(entry, "expected a diagnostic"));
}

/** A project with one theme, and a file with one unknown class. */
async function fixture(): Promise<{ directory: string; uri: string }> {
  const directory = await mkdtemp(join(tmpdir(), "spin-lsp-"));
  await mkdir(join(directory, "spin"), { recursive: true });
  const doc = structuredClone(designLanguages.minimal) as unknown as Record<string, unknown>;
  await writeFile(join(directory, "spin", "acme.json"), JSON.stringify(doc, null, 2));
  const file = join(directory, "app.tsx");
  await writeFile(
    file,
    `export const App = () => <span className="flex not-a-class" />;\n`,
  );
  return { directory, uri: pathToFileURL(file).toString() };
}

/** What the style engine answers for a fixture project. */
function fixtureAnswers(directory: string) {
  return engineAnswers([...Object.values(designLanguages), ...Object.values(readProjectThemes(directory))]);
}

/** The published diagnostics a message flow ends with. */
async function published(
  state: LspState,
  flow: readonly (readonly [string, Record<string, unknown>?])[],
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let id = 1;
  for (const [method, params] of flow) {
    const message = params === undefined
      ? { jsonrpc: "2.0" as const, id: id++, method, params: {} }
      : method === "textDocument/didOpen" || method === "textDocument/didChange"
      ? { jsonrpc: "2.0" as const, method, params }
      : { jsonrpc: "2.0" as const, id: id++, method, params };
    for (const reply of await handleMessage(state, message)) {
      if (isPublish(reply)) out.push(reply.params);
    }
  }
  return out;
}

const TEXT = `export const App = () => <span className="flex not-a-class" />;\n`;

test("the server opens, changes, and closes a document", async () => {
  const { directory, uri } = await fixture();
  try {
    const state = createState(directory);
    const opened = await published(state, [[
      "textDocument/didOpen",
      { textDocument: { uri, languageId: "typescriptreact", version: 1, text: TEXT } },
    ]]);
    const first = opened[0];
    assert(first !== undefined, "didOpen publishes");
    deepStrictEqual(
      diagnosticsOf(first).map((entry) => entry["code"]),
      ["spin/closed-vocabulary"],
    );

    const changed = await published(state, [[
      "textDocument/didChange",
      {
        textDocument: { uri, version: 2 },
        contentChanges: [{ text: `export const App = () => <span className="flex" />;\n` }],
      },
    ]]);
    const second = changed[0];
    assert(second !== undefined, "didChange publishes");
    deepStrictEqual(diagnosticsOf(second), []);

    const closed = await handleMessage(state, {
      jsonrpc: "2.0",
      method: "textDocument/didClose",
      params: { textDocument: { uri } },
    });
    deepStrictEqual(closed, [{
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics: [] },
    }]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the diagnostics match the CLI on the same file", async () => {
  // The parity the stage promises: the same findings, the same
  // severities. The CLI reads the disk; the server stages the editor's
  // text — and here the two texts are the same text.
  const { directory, uri } = await fixture();
  try {
    const state = createState(directory);
    const opened = await published(state, [[
      "textDocument/didOpen",
      { textDocument: { uri, languageId: "typescriptreact", version: 1, text: TEXT } },
    ]]);
    const first = opened[0];
    assert(first !== undefined, "didOpen publishes");
    const wired = diagnosticsOf(first);
    const file = new URL(uri).pathname;
    const { findings } = await lint(file);
    deepStrictEqual(
      wired.map((entry) => entry["code"]),
      findings.map((finding) => finding.ruleId),
    );
    deepStrictEqual(
      wired.map((entry) => entry["severity"]),
      findings.map((finding) => (finding.severity === "warning" ? 2 : 1)),
    );
    assert(
      wired.every((entry) => typeof entry["message"] === "string" && entry["message"].length > 0),
      "every diagnostic says something",
    );
    deepStrictEqual(wired.length, 1);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("hover resolves a class and suggests for an unknown one", async () => {
  const { directory, uri } = await fixture();
  try {
    const known = hoverAt(uri, TEXT, 0, TEXT.indexOf("flex") + 1, fixtureAnswers(directory));
    assert(known !== undefined, "a known class hovers");
    assert(
      known.contents.value.includes("display"),
      `hover shows the declarations: ${known.contents.value}`,
    );
    const unknown = hoverAt(uri, TEXT, 0, TEXT.indexOf("not-a-class") + 1, fixtureAnswers(directory));
    assert(unknown !== undefined, "an unknown class hovers too");
    assert(
      unknown.contents.value.includes("not in the spin vocabulary"),
      `hover names the miss: ${unknown.contents.value}`,
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("completion names the project vocabulary", async () => {
  const { directory, uri } = await fixture();
  try {
    const file = new URL(uri).pathname;
    const root = rootOf(file) ?? "";
    const facts = factsForFile(file, engineAnswers(Object.values(readProjectThemes(root))));
    assert(facts.readable, "the fixture project reads");
    // The cursor is mid-token: `flex n|` filters the vocabulary to what
    // starts with `n`, and `bg-s|` to what starts with `bg-s`. An empty
    // start offers the vocabulary (capped); a typed start narrows it.
    const nLine = `export const App = () => <span className="flex n" />;\n`;
    const nItems = completionsAt(uri, nLine, 0, nLine.indexOf('n" />') + 1, fixtureAnswers(directory));
    assert(nItems.length > 0, "a typed start narrows the vocabulary");
    assert(
      nItems.every((item) => item.label.startsWith("n")),
      "every narrowed completion starts with what was typed",
    );
    assert(
      nItems.some((item) => facts.utilities.has(item.label)),
      "the narrowed list names vocabulary the theme produces",
    );
    const bgLine = `export const App = () => <span className="bg-s" />;\n`;
    const bgItems = completionsAt(uri, bgLine, 0, bgLine.indexOf('s" />') + 1, fixtureAnswers(directory));
    assert(
      bgItems.some((item) => item.label === "bg-surface"),
      "a typed start completes to bg-surface",
    );
    const empty = completionsAt(uri, TEXT, 0, TEXT.indexOf("not-a-class"), fixtureAnswers(directory));
    const labels = new Set(empty.map((item) => item.label));
    assert(labels.has("flex"), "an empty start offers flex");
    assert(!labels.has("not-a-class"), "an unknown class is not offered");
    // The completion vocabulary is the vocabulary the closed rule
    // enforces: every completion resolves, so completing can never
    // complete to a class the lint flags.
    assert(
      empty.every((item) => facts.utilities.has(item.label) || facts.variants.has(item.label)),
      "every completion is vocabulary the theme produces",
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the CLI names the language server", async () => {
  const { parseArgs } = await import("@spinjs/dev/cli");
  const bare = parseArgs(["lsp"]);
  deepStrictEqual(bare, { kind: "lsp" });
  const rooted = parseArgs(["lsp", "--root", "/tmp/proj"]);
  deepStrictEqual(rooted, { kind: "lsp", root: "/tmp/proj" });
});

test("lifecycle edge: initialize answers, unknown methods fail cleanly", async () => {
  const state = createState(process.cwd());
  const answered = await handleMessage(state, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const first = answered[0];
  assert(first !== undefined, "initialize answers");
  const result = asserted("result" in first ? first.result : undefined, "expected a result");
  const capabilities = asserted(result["capabilities"], "expected capabilities");
  deepStrictEqual(capabilities["hoverProvider"], true);
  const missing = await handleMessage(state, { jsonrpc: "2.0", id: 2, method: "spin/never", params: {} });
  const gone = missing[0];
  assert(gone !== undefined, "unknown methods answer");
  const error = asserted("error" in gone ? gone.error : undefined, "expected an error");
  deepStrictEqual(error["code"], -32601);
});

test("the wire round-trips a frame the server answers", async () => {
  // The framing is the contract with the editor: a request in, an
  // answer out, through bytes that may split anywhere.
  const request = encodeFrame({
    id: 7,
    method: "textDocument/hover",
    params: {
      textDocument: { uri: "file:///app.tsx" },
      position: { line: 0, character: 3 },
    },
  });
  async function* split(): AsyncGenerator<Uint8Array> {
    yield request.subarray(0, 10);
    yield request.subarray(10);
  }
  const messages = [];
  for await (const message of readFrames(split())) messages.push(message);
  deepStrictEqual(messages.length, 1);
  const first = messages[0];
  assert(first !== undefined && isRequest(first), "a framed request parses");
  deepStrictEqual([first.id, first.method], [7, "textDocument/hover"]);
});
