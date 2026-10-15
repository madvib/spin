import { assert } from "@std/assert";

/**
 * `src/index.ts` is the browser entry — the studio and the reference app
 * both import it in client code. The plugin and the content pipeline live
 * behind `./plugin` and `./content` for exactly that reason: they reach for
 * `node:fs`, and a node builtin in this graph is a blank page at runtime
 * with an error that only shows up in a browser.
 */
Deno.test("the browser entry reaches no node builtin", async () => {
  const entry = new URL("../src/index.ts", import.meta.url).pathname;
  const command = new Deno.Command("deno", {
    args: ["info", "--json", entry],
    stdout: "piped",
    stderr: "null",
  });
  const { code, stdout } = await command.output();
  assert(code === 0, "deno info should resolve the entry");
  const graph = JSON.parse(new TextDecoder().decode(stdout)) as {
    modules?: { specifier?: string }[];
  };
  const node = (graph.modules ?? [])
    .map((module) => module.specifier ?? "")
    .filter((specifier) => specifier.startsWith("node:"));
  assert(
    node.length === 0,
    `the browser entry must not reach node builtins, found: ${node.join(", ")}`,
  );
});
