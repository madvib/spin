/**
 * The stdio entry point: what an editor launches.
 *
 * No configuration file required: the server reads the project the way
 * the linters do — the nearest ancestor holding a `spin/` directory —
 * and a file outside any project falls back to the starters. The root
 * flag only says where the server was started; stdin carries the rest.
 *
 *   spin lsp [--root <dir>]
 */

import { createState, handleMessage } from "./server.ts";
import { encodeFrame, readFrames } from "./protocol.ts";

const args = process.argv.slice(2);
const flagValue = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const root = flagValue("--root") ?? process.cwd();
const state = createState(root);

let shutdown = false;
process.stdin.on("end", () => process.exit(shutdown ? 0 : 1));

for await (const message of readFrames(process.stdin)) {
  const outgoing = await handleMessage(state, message);
  for (const reply of outgoing) {
    process.stdout.write(encodeFrame(reply));
  }
  if (message.method === "shutdown") shutdown = true;
  if (message.method === "exit") process.exit(shutdown ? 0 : 1);
}
