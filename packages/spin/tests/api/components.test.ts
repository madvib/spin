import assert, { deepStrictEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Daemon, startDaemon } from "../../src/api/daemon.ts";
import { createSpinClient, type SpinClient } from "../../src/api/index.ts";

/**
 * The mini-shadcn path, end to end: list machines, read one's variants,
 * copy a variant into a fresh project. A real daemon serving over HTTP
 * and the typed client the studio and CLI both use — no mocks.
 */
describe("daemon components over HTTP", () => {
  let dir: string;
  let daemon: Daemon;
  let client: SpinClient;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "spin-components-"));
    daemon = await startDaemon({ root: dir, port: 0 });
    client = createSpinClient(daemon.url);
  });

  after(async () => {
    daemon.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists machines with their variant names and manifests", async () => {
    const listed = await client.components.list({});
    const tree = listed.find((c) => c.name === "tree-view");
    assert(tree !== undefined, "tree-view is listed");
    assert(tree.kind === "machine", "tree-view is a machine");
    if (tree.kind !== "machine") return;
    deepStrictEqual(tree.variants, ["basic", "loading"]);
    assert(tree.manifest.parts.includes("root"), "the manifest names parts");
    assert(tree.manifest.slots.includes("item"), "and slots");
    assert(tree.manifest.readers.length > 0, "and readers");
    assert(tree.manifest.methods.length > 0, "and methods");
  });

  it("wildcards the tag when the served root names no moniker", async () => {
    const listed = await client.components.list({});
    const tree = listed.find((c) => c.name === "tree-view");
    assert(tree !== undefined && tree.kind === "machine");
    if (tree.kind !== "machine") return;
    deepStrictEqual(
      tree.tags,
      ["*-tree-view"],
      "a nameless root gets a wildcard, never an invented prefix",
    );
  });

  it("carries the served project's moniker in the tag", async () => {
    const { writeFileSync, rmSync } = await import("node:fs");
    const manifest = join(dir, "package.json");
    writeFileSync(
      manifest,
      JSON.stringify({ name: "@acme/shopfront" }),
      "utf8",
    );
    try {
      const listed = await client.components.list({});
      const tree = listed.find((c) => c.name === "tree-view");
      assert(tree !== undefined && tree.kind === "machine");
      if (tree.kind !== "machine") return;
      deepStrictEqual(
        tree.tags,
        ["shopfront-tree-view"],
        "the tag carries the project's own moniker",
      );
    } finally {
      rmSync(manifest, { force: true });
    }
  });

  it("serves a machine's variants with copy-ready markup", async () => {
    const { examples } = await client.components.examples({
      name: "tree-view",
    });
    deepStrictEqual(examples.length, 2);
    const basic = examples.find((v) => v.stem === "basic");
    assert(basic !== undefined);
    assert(
      basic.html.includes("getBranchControlProps"),
      "the markup names the element",
    );
  });

  it("serves a machine contract with its tag and reads", async () => {
    const result = await client.components.contract({ name: "tree-view" });
    assert(!("error" in result), "tree-view resolves");
    if ("error" in result) return;
    assert(result.kind === "machine", "tree-view is a machine");
    if (result.kind !== "machine") return;
    deepStrictEqual(
      result.tags,
      ["*-tree-view"],
      "the contract carries the wildcard tag for a nameless root",
    );
    assert(result.reads.length > 0, "the contract names the custom properties");
    deepStrictEqual(result.variants, ["basic", "loading"]);
  });

  it("copies a variant into the project at its known location", async () => {
    const copied = await client.components.copy({
      name: "tree-view",
      example: "basic",
      root: dir,
    });
    deepStrictEqual(copied.error, null);
    deepStrictEqual(copied.file, join("lib", "components", "tree-view", "basic.html"));
    deepStrictEqual(copied.tag, "*-tree-view-basic", "the copy names its wildcard tag for a nameless root");
    const written = join(dir, "lib", "components", "tree-view", "basic.html");
    assert(existsSync(written), "the file lands in the project");
    assert(
      readFileSync(written, "utf8").includes('from "@spinjs/components"'),
      "with the variant's markup rewritten to @spinjs/components",
    );
  });

  it("refuses an unknown example without writing", async () => {
    const copied = await client.components.copy({
      name: "tree-view",
      example: "nope",
      root: dir,
    });
    deepStrictEqual(copied.file, null);
    assert(copied.error !== null);
  });

  it("reports the CSS variables a machine's examples spend", async () => {
    const { reads } = await client.components.reads({ name: "tree-view" });
    assert(reads.length > 0, "tree-view spends variables");
    assert(
      reads.every((name) => name.startsWith("--")),
      "every read is a custom property",
    );
    deepStrictEqual([...reads].sort(), reads, "reads arrive sorted");
  });

  it("reports no reads for a machine that ships no examples", async () => {
    const { reads } = await client.components.reads({ name: "nope" });
    deepStrictEqual(reads, []);
  });
});
