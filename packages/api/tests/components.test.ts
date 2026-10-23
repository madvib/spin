import { assert, assertEquals } from "@std/assert";
import { after, before, describe, it } from "node:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "@spin/api/daemon";
import { createSpinClient, type SpinClient } from "@spin/api";

/**
 * The mini-shadcn path, end to end: list machines, read one's variants,
 * copy a variant into a fresh project. A real daemon serving over HTTP
 * and the typed client the studio and CLI both use — no mocks.
 */
describe("daemon components over HTTP", () => {
  let dir: string;
  let daemon: ReturnType<typeof startDaemon>;
  let client: SpinClient;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "spin-components-"));
    daemon = startDaemon({ root: dir, port: 0 });
    client = createSpinClient(daemon.url);
  });

  after(async () => {
    daemon.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists machines with their example names and manifests", async () => {
    const listed = await client.components.list({});
    const tree = listed.find((c) => c.name === "tree-view");
    assert(tree !== undefined, "tree-view is listed");
    assertEquals(tree.examples, ["basic", "loading"]);
    assert(tree.manifest.parts.includes("root"), "the manifest names parts");
    assert(tree.manifest.slots.includes("item"), "and slots");
    assert(tree.manifest.readers.length > 0, "and readers");
    assert(tree.manifest.methods.length > 0, "and methods");
  });

  it("serves a machine's variants with copy-ready markup", async () => {
    const { examples } = await client.components.examples({ name: "tree-view" });
    assertEquals(examples.length, 2);
    const basic = examples.find((v) => v.name === "basic");
    assert(basic !== undefined);
    assert(basic.html.includes("getBranchControlProps"), "the markup names the element");
  });

  it("copies a variant into the project at its known location", async () => {
    const copied = await client.components.copy({
      name: "tree-view",
      example: "basic",
      root: dir,
    });
    assertEquals(copied.error, null);
    assertEquals(copied.file, join("spin", "tree-view", "basic.html"));
    const written = join(dir, "spin", "tree-view", "basic.html");
    assert(existsSync(written), "the file lands in the project");
    assert(
      readFileSync(written, "utf8").includes('from "@spin/components"'),
      "with the variant's markup rewritten to @spin/components",
    );
  });

  it("refuses an unknown example without writing", async () => {
    const copied = await client.components.copy({
      name: "tree-view",
      example: "nope",
      root: dir,
    });
    assertEquals(copied.file, null);
    assert(copied.error !== null);
  });
});
