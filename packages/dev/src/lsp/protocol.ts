/**
 * The wire: JSON-RPC frames over stdio, the way LSP speaks.
 *
 * An editor that launches `spin lsp` reads and writes the same framing
 * every language server uses: each message is JSON behind a
 * `Content-Length` header, read from stdin and answered on stdout. Logs
 * go to stderr — a byte on stdout that is not a frame corrupts the
 * conversation. Nothing here knows a rule or a theme: the framing is the
 * framing, and the server decides what the messages mean.
 */

import { Buffer } from "node:buffer";

/** A request an editor made: answered exactly once, under its id. */
export interface LspRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: unknown;
}

/** A notification an editor sent: no answer expected. */
export interface LspNotification {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: unknown;
}

/** Anything an editor can send. */
export type LspIncoming = LspRequest | LspNotification;

/** An answer, or a pushed diagnostic list — everything the server sends. */
export type LspOutgoing =
  | { readonly id: string | number; readonly result: unknown }
  | { readonly id: string | number; readonly error: { readonly code: number; readonly message: string } }
  | { readonly method: string; readonly params: unknown };

/** Whether an incoming message expects an answer. */
export function isRequest(message: LspIncoming): message is LspRequest {
  return "id" in message && message.id !== undefined && message.id !== null;
}

/** A message behind its header, ready for stdout. */
export function encodeFrame(message: LspOutgoing): Buffer {
  const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", ...message }), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"),
    body,
  ]);
}

/**
 * A frame body as a message, when it is one.
 *
 * A body that is not JSON, or not an object naming a method, is skipped
 * rather than thrown on: one bad frame must not take down the server the
 * editor holds open. The params travel through untouched — the server
 * validates what it reads at its own boundary.
 */
function incomingOf(body: string): LspIncoming | undefined {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  if (!("method" in value) || typeof value.method !== "string") return undefined;
  const params = "params" in value ? value.params : undefined;
  if (
    "id" in value &&
    (typeof value.id === "string" || typeof value.id === "number")
  ) {
    return params === undefined
      ? { jsonrpc: "2.0", id: value.id, method: value.method }
      : { jsonrpc: "2.0", id: value.id, method: value.method, params };
  }
  return params === undefined
    ? { jsonrpc: "2.0", method: value.method }
    : { jsonrpc: "2.0", method: value.method, params };
}

/**
 * The frames arriving on stdin, parsed.
 *
 * Chunks split anywhere — inside a header, between header and body, inside
 * the body — so the bytes accumulate until a whole frame is there.
 */
export async function* readFrames(
  stream: AsyncIterable<Uint8Array>,
): AsyncGenerator<LspIncoming> {
  let buffered = Buffer.alloc(0);
  for await (const chunk of stream) {
    buffered = Buffer.concat([buffered, Buffer.from(chunk)]);
    for (;;) {
      const split = buffered.indexOf("\r\n\r\n");
      if (split < 0) break;
      const header = buffered.subarray(0, split).toString("utf8");
      const length = /^Content-Length:\s*(\d+)\s*$/im.exec(header)?.[1];
      if (length === undefined) break;
      const size = Number(length);
      const start = split + 4;
      if (buffered.length < start + size) break;
      const body = buffered.subarray(start, start + size).toString("utf8");
      buffered = buffered.subarray(start + size);
      const message = incomingOf(body);
      if (message !== undefined) yield message;
    }
  }
}
