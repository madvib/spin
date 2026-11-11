/**
 * The quick fixes: the findings' own edits, over the wire.
 *
 * The server delivers diagnostics; it never invents them. A code action
 * is the same shape of question — what does the lint say about the text
 * under the cursor — and the answer is the finding's own edit, in the
 * coordinates the editor applies. What is tested here is the crossing:
 * that a redundant class offers its removal, that the edit drops exactly
 * the class, and that the frameworks the diagnostics read are the ones
 * the server admits.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  createState,
  handleMessage,
  readableLanguage,
} from "../../src/lsp/index.ts";
import spinStarter from "../../../theme/src/themes/editorial.json" with {
  type: "json",
};

/** A project with a theme, holding a document with a redundant class. */
async function project(): Promise<{ root: string; uri: string; text: string }> {
  const root = await mkdtemp(join(tmpdir(), "spin-lsp-"));
  await mkdir(`${root}/spin`);
  await writeFile(`${root}/spin/spin.json`, JSON.stringify(spinStarter));
  await mkdir(`${root}/src`);
  const text = `export const App = () => (
  <p className="type-body">Hello</p>
);
`;
  await writeFile(`${root}/src/app.tsx`, text);
  return { root, uri: `file://${root}/src/app.tsx`, text };
}

test("initialize advertises the code action provider", async () => {
  const state = createState("/tmp");
  const [reply] = await handleMessage(state, {
    jsonrpc: "2.0",
    method: "initialize",
    id: 1,
    params: {},
  });
  const capabilities = (reply as { result: { capabilities: Record<string, unknown> } })
    .result.capabilities;
  deepStrictEqual(capabilities["codeActionProvider"], true);
});

test("a redundant class offers its removal under the cursor", async () => {
  const { root, uri, text } = await project();
  try {
    const state = createState(root);
    await handleMessage(state, {
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: { uri, version: 1, languageId: "typescriptreact", text },
      },
    });
    const [reply] = await handleMessage(state, {
      jsonrpc: "2.0",
      method: "textDocument/codeAction",
      id: 2,
      params: {
        textDocument: { uri },
        range: { start: { line: 0, character: 0 }, end: { line: 5, character: 0 } },
        context: { diagnostics: [] },
      },
    });
    const actions = (reply as { result: unknown[] }).result;
    deepStrictEqual(actions.length, 1);
    const action = actions[0] as {
      title: string;
      kind: string;
      edit: { changes: Record<string, readonly { range: unknown; newText: string }[]> };
    };
    deepStrictEqual(action.kind, "quickfix");
    deepStrictEqual(action.title, "Drop `type-body`");
    const edits = action.edit.changes[uri] ?? [];
    deepStrictEqual(edits.length, 1);
    // The edit drops exactly the redundant class: applying it leaves the
    // attribute empty, and nothing else in the document moves.
    const edit = edits[0] as {
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      newText: string;
    };
    const line = text.split("\n")[edit.range.start.line] as string;
    deepStrictEqual(
      line.slice(edit.range.start.character, edit.range.end.character),
      "type-body",
    );
    deepStrictEqual(edit.newText, "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a removed type utility offers its style as the quick fix", async () => {
  const root = await mkdtemp(join(tmpdir(), "spin-lsp-"));
  try {
    await mkdir(`${root}/spin`);
    await writeFile(`${root}/spin/spin.json`, JSON.stringify(spinStarter));
    await mkdir(`${root}/src`);
    const uri = `file://${root}/src/app.tsx`;
    const text = `export const App = () => (
  <p className="text-sm">Hello</p>
);
`;
    await writeFile(`${root}/src/app.tsx`, text);
    const state = createState(root);
    await handleMessage(state, {
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: { uri, version: 1, languageId: "typescriptreact", text },
      },
    });
    const [reply] = await handleMessage(state, {
      jsonrpc: "2.0",
      method: "textDocument/codeAction",
      id: 4,
      params: {
        textDocument: { uri },
        range: { start: { line: 0, character: 0 }, end: { line: 5, character: 0 } },
        context: { diagnostics: [] },
      },
    });
    const actions = (reply as { result: unknown[] }).result;
    deepStrictEqual(actions.length, 1);
    const action = actions[0] as {
      kind: string;
      edit: { changes: Record<string, readonly { range: unknown; newText: string }[]> };
    };
    deepStrictEqual(action.kind, "quickfix");
    const edits = action.edit.changes[uri] ?? [];
    deepStrictEqual(edits.length, 1);
    const edit = edits[0] as {
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      newText: string;
    };
    // The edit replaces the removed utility in place: the range covers
    // exactly the class, and the text names the style to wear instead.
    const line = text.split("\n")[edit.range.start.line] as string;
    deepStrictEqual(
      line.slice(edit.range.start.character, edit.range.end.character),
      "text-sm",
    );
    assert(edit.newText.startsWith("type-"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a range away from the finding offers nothing", async () => {
  const { root, uri, text } = await project();
  try {
    const state = createState(root);
    await handleMessage(state, {
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: { uri, version: 1, languageId: "typescriptreact", text },
      },
    });
    const [reply] = await handleMessage(state, {
      jsonrpc: "2.0",
      method: "textDocument/codeAction",
      id: 3,
      params: {
        textDocument: { uri },
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 30 } },
        context: { diagnostics: [] },
      },
    });
    deepStrictEqual((reply as { result: unknown[] }).result, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the server reads the documents the diagnostics read", () => {
  assert(readableLanguage("typescriptreact"));
  assert(readableLanguage("html"));
  assert(readableLanguage("vue"));
  assert(readableLanguage("svelte"));
  assert(readableLanguage("astro"));
  deepStrictEqual(readableLanguage("python"), false);
});
