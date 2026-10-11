import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDaemonApp, serveDaemon } from "@spin/api/daemon";
import { createSpinClient, type SpinClient } from "@spin/api";

/**
 * The production path for theme add/remove/rename, end to end: a real daemon
 * serving over HTTP, a fixture project copied to a temp dir, and the typed
 * client the studio and CLI both use. No mocks — the test proves the daemon
 * does what the contract advertises, through the transport it will ship on.
 *
 * The fixture is a COPY, never the product's own themes: a test that writes
 * to `packages/theme/src/themes` would pass by corrupting the thing it is
 * meant to protect.
 */
describe("daemon project.themes over HTTP", () => {
  let dir: string;
  let server: Deno.HttpServer<Deno.NetAddr>;
  let client: SpinClient;

  before(async () => {
    // The daemon reads themes from `<root>/themes`, so the fixture is
    // copied into a temp dir shaped like a project: root with a themes/
    // directory inside it. The product's own themes are never touched.
    dir = mkdtempSync(join(tmpdir(), "spin-daemon-"));
    const fixture = new URL(
      "../../../examples/fixture-app/themes",
      import.meta.url,
    );
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(dir, "themes"));
    for (const entry of readdirSync(fixture)) {
      copyFileSync(join(fixture.pathname, entry), join(dir, "themes", entry));
    }
    server = serveDaemon(createDaemonApp({ root: dir }), 0);
    const addr = server.addr;
    client = createSpinClient(`http://localhost:${addr.port}/rpc`);
  });

  after(async () => {
    await server.shutdown();
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists the fixture themes", async () => {
    const listed = await client.project.themes.list({});
    const names = listed.map((t) => t.name).sort();
    assert.deepEqual(names, ["acme", "starter"]);
    assert(
      listed.every((t) => t.file.endsWith(".json")),
      "every entry names the file on disk it came from",
    );
  });

  it("copies a starter into a new theme", async () => {
    const copied = await client.project.themes.copy({
      from: "starter",
      to: "acme-dark",
    });
    assert.equal(copied.error, null);
    const names = (await client.project.themes.list({})).map((t) => t.name);
    assert(names.includes("acme-dark"), "the copy appears in the list");
    const read = await client.project.themes.read({ name: "acme-dark" });
    const source = await client.project.themes.read({ name: "starter" });
    assert.equal(read.text, source.text);
  });

  it("writes a theme and reads it back", async () => {
    const before = await client.project.themes.read({ name: "acme" });
    assert(before.text !== null, "the fixture theme reads");
    const edited = (before.text as string).replace(
      '"#0ea5e9"',
      '"#ff0000"',
    );
    const written = await client.project.themes.write({
      name: "acme",
      text: edited,
    });
    assert.equal(written.error, null);
    const after = await client.project.themes.read({ name: "acme" });
    assert(after.text?.includes("#ff0000"), "the write landed on disk");
  });

  it("removes a theme", async () => {
    const removed = await client.project.themes.remove({ name: "acme-dark" });
    assert.equal(removed.error, null);
    const names = (await client.project.themes.list({})).map((t) => t.name);
    assert(!names.includes("acme-dark"), "the removed theme is gone");
  });

  it("refuses a name that escapes the themes directory", async () => {
    // The contract's name regex rejects the separator before any handler
    // runs: the refusal is validation, not a filesystem miss, so the error
    // is an input error rather than a null read.
    let refused = false;
    try {
      await client.project.themes.read({ name: "../package" });
    } catch {
      refused = true;
    }
    assert(refused, "a name with a separator must be refused");
  });
});
