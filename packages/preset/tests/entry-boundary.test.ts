import { test } from "bun:test";
import assert from "node:assert/strict";

/**
 * `src/index.ts` is the browser entry — the studio and the reference app
 * both import it in client code. The plugin and the content pipeline live
 * behind `./plugin` and `./content` for exactly that reason: they reach for
 * `node:fs`, and a node builtin in this graph is a blank page at runtime
 * with an error that only shows up in a browser.
 */
test("the browser entry reaches no node builtin", async () => {
  const entry = new URL("../src/index.ts", import.meta.url).pathname;
  const proc = Bun.spawn(["bun", "build", entry, "--external:node:*", "--dry-run"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stderr, code] = await Promise.all([
    new Response(proc.stderr).arrayBuffer(),
    proc.exited,
  ]);
  const text = new TextDecoder().decode(stderr);
  assert(code === 0, `bun build should resolve the entry: ${text}`);
  const node = [...text.matchAll(/\bnode:[a-z0-9_-]+/gi)].map((m) => m[0]);
  assert(
    node.length === 0,
    `the browser entry must not reach node builtins, found: ${node.join(", ")}`,
  );
});
