import { assertEquals } from "@std/assert";
import { after, before, describe, it } from "node:test";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DISCOVERY_FILE, startDaemon } from "@spin/api/daemon";
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
  let daemon: ReturnType<typeof startDaemon>;
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
    mkdirSync(join(dir, "themes"));
    for (const entry of readdirSync(fixture)) {
      copyFileSync(join(fixture.pathname, entry), join(dir, "themes", entry));
    }
    daemon = startDaemon({ root: dir, port: 0 });
    client = createSpinClient(daemon.url);
  });

  after(async () => {
    // close() removes the discovery document too, which is half of what it
    // exists to be tested for.
    daemon.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists the fixture themes", async () => {
    const listed = await client.project.themes.list({});
    const names = listed.map((t) => t.name).sort();
    assertEquals(names, ["acme", "starter"]);
    assertEquals(
      listed.every((t) => t.file.endsWith(".json")),
      true,
      "every entry names the file on disk it came from",
    );
  });

  it("copies a starter into a new theme", async () => {
    const copied = await client.project.themes.copy({
      from: "starter",
      to: "acme-dark",
    });
    assertEquals(copied.error, null);
    const names = (await client.project.themes.list({})).map((t) => t.name);
    assertEquals(
      names.includes("acme-dark"),
      true,
      "the copy appears in the list",
    );
    const read = await client.project.themes.read({ name: "acme-dark" });
    const source = await client.project.themes.read({ name: "starter" });
    assertEquals(read.text, source.text);
  });

  it("writes a theme and reads it back", async () => {
    const before = await client.project.themes.read({ name: "acme" });
    assertEquals(
      before.text !== null,
      true,
      "the fixture theme reads",
    );
    const edited = (before.text as string).replace(
      "#0369a1",
      "#ff0000",
    );
    const written = await client.project.themes.write({
      name: "acme",
      text: edited,
    });
    assertEquals(written.error, null);
    const after = await client.project.themes.read({ name: "acme" });
    assertEquals(
      after.text?.includes("#ff0000"),
      true,
      "the write landed on disk",
    );
  });

  it("removes a theme", async () => {
    const removed = await client.project.themes.remove({ name: "acme-dark" });
    assertEquals(removed.error, null);
    const names = (await client.project.themes.list({})).map((t) => t.name);
    assertEquals(
      names.includes("acme-dark"),
      false,
      "the removed theme is gone",
    );
  });

  it("publishes discovery so a client can find the port", async () => {
    // A client cannot guess a port it was never told. The daemon writes one,
    // and it is gone on close.
    const bound = new URL(daemon.url).port;
    const doc = JSON.parse(readFileSync(join(dir, DISCOVERY_FILE), "utf8")) as {
      port: number;
      path: string;
    };
    assertEquals(doc.port, Number(bound), "discovery names the bound port");
    assertEquals(doc.path, "/rpc");
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
    assertEquals(refused, true, "a name with a separator must be refused");
  });
});
