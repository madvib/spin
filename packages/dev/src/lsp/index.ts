/**
 * The editor surface: hover, completion, and diagnostics over LSP.
 *
 * Thin by design: the server holds open documents, and every question is
 * asked of the checks the linters and the CLI read. Nobody reaches past
 * this index.
 */

export {
  actionsFor,
  completionsAt,
  diagnosticsFor,
  filePathOf,
  hoverAt,
  type LspAction,
  type LspCompletion,
  type LspDiagnostic,
  type OpenDocument,
  readableLanguage,
  suggestionFor,
  wordAt,
} from "./features.ts";
export {
  createState,
  handleMessage,
  type LspState,
} from "./server.ts";
export {
  encodeFrame,
  isRequest,
  type LspIncoming,
  type LspOutgoing,
  readFrames,
} from "./protocol.ts";
