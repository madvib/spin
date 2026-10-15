import { assertEquals } from "@std/assert";
import { after, before, describe, it } from "node:test";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "@spin/api/daemon";
import { parseTokens, themeModes, validateTokens } from "@spin/theme";
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
  const fixture = new URL(
    "../../../examples/fixture-app/spin",
    import.meta.url,
  );
  let daemon: ReturnType<typeof startDaemon>;
  let client: SpinClient;

  before(async () => {
    // The daemon reads themes from `<root>/spin`, so the fixture is
    // copied into a temp dir shaped like a project: root with a themes/
    // directory inside it. The product's own themes are never touched.
    dir = mkdtempSync(join(tmpdir(), "spin-daemon-"));
    mkdirSync(join(dir, "spin"));
    for (const entry of readdirSync(fixture)) {
      copyFileSync(join(fixture.pathname, entry), join(dir, "spin", entry));
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

  it("keeps the fixtures in the shape the pipeline currently speaks", async () => {
    // The fixtures were copied from the starters before per-token `$modes`
    // existed, so a dark-mode edit in the studio showed the light value while
    // it wrote the override. A guard, because a stale fixture is exactly the
    // kind of thing that passes every other test.
    const listed = await client.project.themes.list({});
    for (const theme of listed) {
      const doc = JSON.parse(theme.text) as Record<string, unknown>;
      assertEquals(
        "dark" in doc,
        false,
        `${theme.name}: no dark group — a token carries its own $modes`,
      );
      const parsed = parseTokens(theme.text);
      assertEquals(parsed.ok, true, `${theme.name}: parses`);
      if (!parsed.ok) return;
      const modes = themeModes(doc as never);
      assertEquals(
        modes.includes("dark"),
        true,
        `${theme.name}: declares dark`,
      );
      assertEquals(
        validateTokens(parsed.tree, { modes: [...modes] }).issues,
        [],
        `${theme.name}: every color and focus leaf has a dark value`,
      );
    }
  });

  it("lists the fixture themes", async () => {
    const listed = await client.project.themes.list({});
    const names = listed.map((t) => t.name).sort();
    assertEquals(names, ["acme", "starter"]);
    // Project-relative, never absolute: a path a developer sees carries no
    // machine with it — no screenshot, log line, or issue report says where
    // the files live on someone's disk.
    assertEquals(
      listed.every((t) => !t.file.startsWith("/") && !t.file.includes(":\\")),
      true,
      "a reported path is relative to its project, not to a machine",
    );
    assertEquals(
      listed.map((t) => t.file).sort(),
      ["spin/acme.json", "spin/starter.json"],
      "the path is the project's own layout",
    );
    assertEquals(
      listed.every((t) => t.file.endsWith(".json")),
      true,
      "every entry names the file on disk it came from",
    );
  });

  it("detects a project by its spin directory, and by an uno config", async () => {
    // Registration is presence, not a list: a project is a root with `spin/`
    // in it, and the uno config answers the second half without being the
    // mark of one — a project can hold themes it has not wired up yet.
    const report = await client.project.detect({ root: dir });
    assertEquals(report.spin, true, "the fixture's spin directory is seen");
    assertEquals(report.uno, false, "the fixture has no uno config");
    assertEquals(report.themes, ["acme.json", "starter.json"]);

    const bare = mkdtempSync(join(tmpdir(), "spin-bare-"));
    const empty = await client.project.detect({ root: bare });
    assertEquals(empty.spin, false, "a root without spin is not a project");
    assertEquals(empty.themes, []);

    writeFileSync(join(bare, "uno.config.ts"), "export default []");
    const noPlugin = await client.project.detect({ root: bare });
    assertEquals(noPlugin.uno, true);
    assertEquals(noPlugin.wired, false, "an uno config without the preset");
    writeFileSync(
      join(bare, "uno.config.ts"),
      'import { spinPreset } from "@spin/preset";',
    );
    const wired = await client.project.detect({ root: bare });
    assertEquals(wired.wired, true, "an uno config naming the preset");
    rmSync(bare, { recursive: true, force: true });
  });

  it("serves two projects from one daemon, named per call", async () => {
    // One process, many projects: a client names the root it means. Two
    // daemons in one process used to stomp on each other, which is exactly
    // what a shared module root would do — and this test failed until the
    // root became a per-call answer.
    const other = mkdtempSync(join(tmpdir(), "spin-other-"));
    mkdirSync(join(other, "spin"));
    copyFileSync(
      join(fixture.pathname, "acme.json"),
      join(other, "spin", "solo.json"),
    );
    const theirs = await client.project.themes.list({ root: other });
    assertEquals(theirs.map((t) => t.name), ["solo"]);
    // The daemon's own project is unchanged, which is the point.
    const mine = await client.project.themes.list({});
    assertEquals(mine.map((t) => t.name).sort(), ["acme", "starter"]);
    rmSync(other, { recursive: true, force: true });
  });

  it("inits a project by making the spin directory and seeding a theme", async () => {
    // The one act that makes a project spin's: no add, no registry to edit.
    // Its own daemon, because the fixture's daemon is pointed elsewhere and
    // a project's themes resolve against the root it was started with.
    const fresh = mkdtempSync(join(tmpdir(), "spin-init-"));
    const init = await client.project.init({
      root: fresh,
      name: "first",
      starter: "default",
    });
    assertEquals(init.error, null);
    const detect = await client.project.detect({ root: fresh });
    assertEquals(detect.spin, true, "init created the directory");
    assertEquals(detect.themes, ["first.json"], "and seeded one theme");
    // And the build config, which is the other half of a project: the daemon
    // composes theme's document with the preset's config because it is the
    // only thing that knows a project needs both.
    assertEquals(detect.uno, true, "init wrote an uno config");
    assertEquals(detect.wired, true, "and that config wires the preset");
    const config = readFileSync(join(fresh, "uno.config.ts"), "utf8");
    assertEquals(
      config.includes('"@spin/config"'),
      true,
      "it applies the encapsulated form",
    );
    assertEquals(
      config.includes("spin()"),
      true,
      "with the spin config, not raw uno",
    );
    const listed = await client.project.themes.list({ root: fresh });
    assertEquals(listed.map((t) => t.name), ["first"]);
    const seeded = await client.project.themes.read({
      name: "first",
      root: fresh,
    });
    assertEquals(
      JSON.parse(seeded.text ?? "{}").color !== undefined,
      true,
      "the seeded theme is a real document, not an empty file",
    );
    rmSync(fresh, { recursive: true, force: true });
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

  it("serves the same app the dev server mounts", async () => {
    // One Hono app, every host: the daemon's procedures answer at the same
    // path the middleware claims, so a client written against one works
    // against the other without a second address to discover.
    const res = await fetch(daemon.url + "/overlay/get", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });
    assertEquals(res.status, 200, "the daemon answers its own procedures");
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
