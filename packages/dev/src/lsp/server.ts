/**
 * The server: the lifecycle, and the four features.
 *
 * Thin by design: it holds the open documents, and every question is
 * asked of the core the linters and the CLI read. `didOpen` and
 * `didChange` lint the staged text and push the findings; hover resolves
 * the class under the cursor through the preset's own rules; completion
 * names the project vocabulary the closed-vocabulary rule enforces; a
 * code action is the finding's own edit, in the shape the editor
 * applies. The answers cannot disagree with the CLI by construction —
 * there is only one core, and this is its third reader.
 */

import { z } from "zod";
import { engineAnswers } from "@spinjs/preset";
import type { EngineAnswers } from "@spinjs/diagnostics";
import { readProjectThemes } from "@spinjs/diagnostics";
import {
  actionsFor,
  completionsAt,
  diagnosticsFor,
  hoverAt,
  type OpenDocument,
  readableLanguage,
} from "./features.ts";
import { isRequest, type LspIncoming, type LspOutgoing } from "./protocol.ts";

/** What the server remembers between messages. */
export interface LspState {
  /** The documents the editor holds open. */
  readonly documents: Map<string, OpenDocument>;
  /** The root the server was started in. */
  readonly root: string;
  /** What the style engine answers, filled once per root. */
  answers?: EngineAnswers;
}

/** A server pointed at a project root, holding no documents. */
export function createState(root: string): LspState {
  return { documents: new Map(), root };
}

/* --------------------------------------------------------------- the params -- */

/**
 * The params shapes, parsed once at the boundary.
 *
 * An editor that sends something else gets silence, not a crash: a
 * failed parse drops the message, and the next keystroke asks again.
 * Unknown fields pass through — the wire carries what the client
 * carries, and the server reads only what it needs.
 */
const DidOpen = z.object({
  textDocument: z.object({
    uri: z.string(),
    version: z.number().optional(),
    languageId: z.string().optional(),
    text: z.string().optional(),
  }).catchall(z.unknown()),
}).catchall(z.unknown());

const DidChange = z.object({
  textDocument: z.object({
    uri: z.string(),
    version: z.number().optional(),
  }).catchall(z.unknown()),
  contentChanges: z.array(
    z.object({ text: z.string() }).catchall(z.unknown()),
  ),
}).catchall(z.unknown());

const UriOnly = z.object({
  textDocument: z.object({ uri: z.string() }).catchall(z.unknown()),
}).catchall(z.unknown());

const AtPosition = z.object({
  textDocument: z.object({ uri: z.string() }).catchall(z.unknown()),
  position: z.object({ line: z.number(), character: z.number() }),
}).catchall(z.unknown());

const AtRange = z.object({
  textDocument: z.object({ uri: z.string() }).catchall(z.unknown()),
  range: z.object({
    start: z.object({ line: z.number(), character: z.number() }),
    end: z.object({ line: z.number(), character: z.number() }),
  }),
  context: z.object({
    diagnostics: z.array(z.unknown()).optional(),
  }).catchall(z.unknown()).optional(),
}).catchall(z.unknown());

/**
 * One message in, zero or more messages out.
 *
 * Lifecycle first — `initialize`, `initialized`, `shutdown`, `exit` —
 * then the document sync the diagnostics ride on, then the two reads.
 * An unknown method on a request is answered with `MethodNotFound`, and
 * a notification is never answered: a reply to one would corrupt the
 * framing the editor parses.
 */
export async function handleMessage(
  state: LspState,
  message: LspIncoming,
): Promise<LspOutgoing[]> {
  switch (message.method) {
    case "initialize": {
      if (!isRequest(message)) return [];
      return [{
        id: message.id,
        result: {
          capabilities: {
            textDocumentSync: 1,
            hoverProvider: true,
            completionProvider: { triggerCharacters: ["\"", "'", "`", " ", "-"] },
            codeActionProvider: true,
          },
          serverInfo: { name: "spin", version: "0.1.0" },
        },
      }];
    }
    case "initialized":
    case "$/cancelRequest":
      return [];
    case "textDocument/didOpen": {
      const parsed = DidOpen.safeParse(message.params);
      if (!parsed.success) return [];
      const document = parsed.data.textDocument;
      state.documents.set(document.uri, {
        version: document.version ?? 0,
        languageId: document.languageId ?? "",
        text: document.text ?? "",
      });
      return await diagnose(state, document.uri);
    }
    case "textDocument/didChange": {
      const parsed = DidChange.safeParse(message.params);
      if (!parsed.success) return [];
      const held = state.documents.get(parsed.data.textDocument.uri);
      if (held === undefined) return [];
      const text = parsed.data.contentChanges.at(-1)?.text;
      if (text === undefined) return [];
      state.documents.set(parsed.data.textDocument.uri, {
        ...held,
        version: parsed.data.textDocument.version ?? held.version,
        text,
      });
      return await diagnose(state, parsed.data.textDocument.uri);
    }
    case "textDocument/didClose": {
      const parsed = UriOnly.safeParse(message.params);
      if (!parsed.success) return [];
      const uri = parsed.data.textDocument.uri;
      state.documents.delete(uri);
      return [{ method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } }];
    }
    case "textDocument/hover": {
      if (!isRequest(message)) return [];
      const parsed = AtPosition.safeParse(message.params);
      if (!parsed.success) return [{ id: message.id, result: null }];
      const held = state.documents.get(parsed.data.textDocument.uri);
      if (held === undefined) return [{ id: message.id, result: null }];
      const hovered = hoverAt(
        parsed.data.textDocument.uri,
        held.text,
        parsed.data.position.line,
        parsed.data.position.character,
        answersFor(state),
      );
      return [{ id: message.id, result: hovered ?? null }];
    }
    case "textDocument/completion": {
      if (!isRequest(message)) return [];
      const parsed = AtPosition.safeParse(message.params);
      if (!parsed.success) return [{ id: message.id, result: null }];
      const held = state.documents.get(parsed.data.textDocument.uri);
      if (held === undefined) return [{ id: message.id, result: null }];
      const items = completionsAt(
        parsed.data.textDocument.uri,
        held.text,
        parsed.data.position.line,
        parsed.data.position.character,
        answersFor(state),
      );
      return [{ id: message.id, result: { isIncomplete: false, items } }];
    }
    case "textDocument/codeAction": {
      if (!isRequest(message)) return [];
      const parsed = AtRange.safeParse(message.params);
      if (!parsed.success) return [{ id: message.id, result: null }];
      const held = state.documents.get(parsed.data.textDocument.uri);
      if (held === undefined) return [{ id: message.id, result: null }];
      const actions = await actionsFor(
        parsed.data.textDocument.uri,
        held,
        parsed.data.range,
        answersFor(state),
      );
      return [{ id: message.id, result: actions }];
    }
    case "shutdown": {
      if (!isRequest(message)) return [];
      return [{ id: message.id, result: null }];
    }
    case "exit":
      return [];
    default: {
      if (!isRequest(message)) return [];
      return [{ id: message.id, error: { code: -32601, message: `Unknown method "${message.method}".` } }];
    }
  }
}

/** What the style engine answers for the server's root, filled once. */
function answersFor(state: LspState): EngineAnswers {
  if (state.answers === undefined) {
    state.answers = engineAnswers(Object.values(readProjectThemes(state.root)));
  }
  return state.answers;
}

/** The diagnostics for an open document, pushed to the editor. */
async function diagnose(state: LspState, uri: string): Promise<LspOutgoing[]> {
  const held = state.documents.get(uri);
  if (held === undefined) return [];
  if (!readableLanguage(held.languageId)) {
    return [{ method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } }];
  }
  try {
    const diagnostics = await diagnosticsFor(uri, held, answersFor(state));
    return [{ method: "textDocument/publishDiagnostics", params: { uri, diagnostics } }];
  } catch {
    // A document the lint cannot read gets no diagnostics, not a broken
    // server: the editor stays alive and the next keystroke asks again.
    return [{ method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } }];
  }
}
