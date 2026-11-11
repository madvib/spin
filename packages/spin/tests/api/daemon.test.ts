import { deepStrictEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Daemon, startDaemon } from "@spinjs/server/daemon";
import { parseTokens, themeModes, validateTokens } from "@spinjs/theme";
import { createSpinApp, createSpinClient, type SpinClient } from "../../src/api/index.ts";

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
    "../../../../examples/fixture-app/spin",
    import.meta.url,
  );
  let daemon: Daemon;
  let client: SpinClient;

  before(async () => {
    // The daemon reads themes from `<root>/spin`, so the fixture is
    // copied into a temp dir shaped like a project: root with a themes/
    // directory inside it. The product's own themes are never touched.
    dir = mkdtempSync(join(tmpdir(), "spin-daemon-"));
    cpSync(fixture.pathname, join(dir, "spin"), { recursive: true });
    daemon = await startDaemon({ root: dir, app: createSpinApp({ root: dir, base: "/rpc" }), port: 0 });
    client = createSpinClient(daemon.url);
  });

  after(() => {
    // close() removes the discovery document too, which is half of what it
    // exists to be tested for.
    daemon.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the fixtures in the shape the pipeline currently speaks", async () => {
    // Sparse brands over a shipped starter: the composed document is what
    // parses, serves modes, and carries dark values — the layer text is a
    // diff, never judged alone. A guard, because a stale fixture is exactly
    // the kind of thing that passes every other test.
    const listed = (await client.project.themes.list({}))
      .filter((theme) => theme.file !== null);
    for (const theme of listed) {
      const doc = JSON.parse(theme.text) as Record<string, unknown>;
      deepStrictEqual(
        "dark" in doc,
        false,
        `${theme.name}: no dark group — a token carries its own $modes`,
      );
      const parsed = parseTokens(theme.text);
      deepStrictEqual(parsed.ok, true, `${theme.name}: parses with its parent`);
      if (!parsed.ok) return;
      const modes = themeModes(doc as never);
      deepStrictEqual(
        modes.includes("dark"),
        true,
        `${theme.name}: serves dark`,
      );
      deepStrictEqual(
        validateTokens(parsed.tree, { modes: [...modes] }).issues,
        [],
        `${theme.name}: every color and focus leaf has a dark value`,
      );
    }
  });

  it("lists the project's own files, and no brand it never named", async () => {
    const listed = await client.project.themes.list({});
    deepStrictEqual(
      listed.map((t) => [t.name, t.file]),
      [
        ["acme", "spin/acme"],
        ["starter", "spin/starter"],
      ],
      "a brand carries its identity path; a fixture with no brand lists nothing else",
    );
    // Project-relative, never absolute: a path a developer sees carries no
    // machine with it — no screenshot, log line, or issue report says where
    // the files live on someone's disk.
    deepStrictEqual(
      listed.every((t) =>
        t.file === null ||
        (!t.file.startsWith("/") && !t.file.includes(":\\"))
      ),
      true,
      "a reported path is relative to its project, not to a machine",
    );
  });

  it("serves a brand theme until a copy forks it, over HTTP", async () => {
    // A second root, named per call: the fixture's own root stays
    // config-free so the detect test keeps proving what it proves.
    const branded = mkdtempSync(join(tmpdir(), "spin-branded-"));
    mkdirSync(join(branded, "spin"));
    copyFileSync(
      join(fixture.pathname, "acme", "tokens.json"),
      join(branded, "brand.json"),
    );
    writeFileSync(
      join(branded, "brand.ts"),
      `import doc from "./brand.json";\nexport const acmeBrand = { themes: { brand: doc } };\n`,
    );
    writeFileSync(
      join(branded, "vite.config.ts"),
      `import { acmeBrand } from "./brand.ts";\nimport { spin } from "@spinjs/spin/vite";\nexport default { plugins: [spin.vite({ extends: acmeBrand })] };\n`,
    );
    try {
      const served = await client.project.themes.read({
        name: "brand",
        root: branded,
      });
      const doc = JSON.parse(served.text ?? "{}") as {
        color: { primary: { $value: string } };
      };
      deepStrictEqual(
        typeof doc.color.primary.$value,
        "string",
        "the unforked brand reads as its document",
      );
      const refused = await client.project.themes.write({
        name: "brand",
        text: "{}",
        root: branded,
      });
      deepStrictEqual(
        refused.error,
        "Brand theme 'brand' is read-only here; save as a local theme to fork it.",
        "a save does not silently fork the brand",
      );
      const copied = await client.project.themes.copy({
        from: "brand",
        to: "brand",
        root: branded,
      });
      deepStrictEqual(copied.error, null, "the copy forks the brand");
      deepStrictEqual(
        (await client.project.themes.list({ root: branded })).find(
          (t) => t.name === "brand",
        )?.file,
        "spin/brand.json",
        "the fork is the project's own file",
      );
      const removed = await client.project.themes.remove({
        name: "brand",
        root: branded,
      });
      deepStrictEqual(removed.error, null, "the fork is removable");
      deepStrictEqual(
        (await client.project.themes.read({ name: "brand", root: branded }))
          .text,
        served.text,
        "and removing it puts the brand document back",
      );
    } finally {
      rmSync(branded, { recursive: true, force: true });
    }
  });

  it("detects a project by its spin directory, and by an uno config", async () => {
    // Registration is presence, not a list: a project is a root with `spin/`
    // in it, and the uno config answers the second half without being the
    // mark of one — a project can hold themes it has not wired up yet.
    const report = await client.project.detect({ root: dir });
    deepStrictEqual(report.spin, true, "the fixture's spin directory is seen");
    deepStrictEqual(report.uno, false, "the fixture has no uno config");
    deepStrictEqual(report.themes, ["acme", "starter"]);

    const bare = mkdtempSync(join(tmpdir(), "spin-bare-"));
    const empty = await client.project.detect({ root: bare });
    deepStrictEqual(empty.spin, false, "a root without spin is not a project");
    deepStrictEqual(empty.themes, []);

    writeFileSync(join(bare, "vite.config.ts"), "export default []");
    const noPlugin = await client.project.detect({ root: bare });
    deepStrictEqual(noPlugin.uno, true);
    deepStrictEqual(noPlugin.wired, false, "a build config without the preset");
    writeFileSync(
      join(bare, "vite.config.ts"),
      'import { spin } from "@spinjs/spin/vite";\nspin.vite();',
    );
    const wired = await client.project.detect({ root: bare });
    deepStrictEqual(wired.wired, true, "a build config naming the plugin");
    rmSync(bare, { recursive: true, force: true });
  });

  it("reports the project it was started with", async () => {
    // `current` is `detect` without the question: the daemon already knows
    // which root it serves, and a client that dialed a port — the studio, an
    // MCP client — has no other way to learn it. `detect` stays for roots the
    // caller names.
    const report = await client.project.current({});
    deepStrictEqual(report.root, dir);
    deepStrictEqual(report.spin, true);
    deepStrictEqual(report.themes, ["acme", "starter"]);
  });

  it("serves two projects from one daemon, named per call", async () => {
    // One process, many projects: a client names the root it means. Two
    // daemons in one process used to stomp on each other, which is exactly
    // what a shared module root would do — and this test failed until the
    // root became a per-call answer.
    const other = mkdtempSync(join(tmpdir(), "spin-other-"));
    mkdirSync(join(other, "spin"));
    copyFileSync(
      join(fixture.pathname, "acme", "tokens.json"),
      join(other, "spin", "solo.json"),
    );
    const theirs = await client.project.themes.list({ root: other });
    deepStrictEqual(
      theirs.map((t) => t.name),
      ["solo"],
      "the named root's own file, and no brand it never named",
    );
    // The daemon's own project is unchanged, which is the point.
    const mine = await client.project.themes.list({});
    deepStrictEqual(mine.map((t) => t.name), [
      "acme",
      "starter",
    ]);
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
      starter: "minimal",
    });
    deepStrictEqual(init.error, null);
    const detect = await client.project.detect({ root: fresh });
    deepStrictEqual(detect.spin, true, "init created the directory");
    deepStrictEqual(detect.themes, ["first"], "and seeded one theme");
    // And the build config, which is the other half of a project: the daemon
    // composes theme's document with the preset's config because it is the
    // only thing that knows a project needs both.
    deepStrictEqual(detect.uno, true, "init wrote a build config");
    deepStrictEqual(detect.wired, true, "and that config wires the preset");
    const config = readFileSync(join(fresh, "vite.config.ts"), "utf8");
    deepStrictEqual(
      config.includes('"@spinjs/spin/vite"'),
      true,
      "it applies the spin plugin",
    );
    deepStrictEqual(
      config.includes("spin.vite()"),
      true,
      "with the vite stage, not raw uno",
    );
    const listed = await client.project.themes.list({ root: fresh });
    deepStrictEqual(
      listed.map((t) => t.name),
      ["first"],
      "the seeded theme stands alone — init names no brand",
    );
    const seeded = await client.project.themes.read({
      name: "first",
      root: fresh,
    });
    deepStrictEqual(
      JSON.parse(seeded.text ?? "{}").$extends,
      "minimal",
      "the seeded theme extends its starter, not an empty file",
    );
    rmSync(fresh, { recursive: true, force: true });
  });

  it("a write creates the themes directory a fresh project lacks", async () => {
    // The first write into a project that has never held a theme: `spin/` is
    // made on the way rather than demanded of the caller — the failure this
    // replaces was an ENOENT surfacing as a dialog on a fresh checkout.
    const fresh = mkdtempSync(join(tmpdir(), "spin-write-"));
    const source = await client.project.themes.read({ name: "starter" });
    const written = await client.project.themes.write({
      name: "first",
      text: source.text as string,
      root: fresh,
    });
    deepStrictEqual(written.error, null);
    deepStrictEqual(readdirSync(join(fresh, "spin")), ["first.json"]);
    const detected = await client.project.detect({ root: fresh });
    deepStrictEqual(detected.spin, true, "the write made the project");
    rmSync(fresh, { recursive: true, force: true });
  });

  it("copies a starter into a new theme", async () => {
    const copied = await client.project.themes.copy({
      from: "starter",
      to: "acme-dark",
    });
    deepStrictEqual(copied.error, null);
    const names = (await client.project.themes.list({})).map((t) => t.name);
    deepStrictEqual(
      names.includes("acme-dark"),
      true,
      "the copy appears in the list",
    );
    const read = await client.project.themes.read({ name: "acme-dark" });
    const source = await client.project.themes.read({ name: "starter" });
    deepStrictEqual(read.text, source.text);
  });

  it("writes a theme and reads it back", async () => {
    const before = await client.project.themes.read({ name: "acme" });
    deepStrictEqual(
      before.text !== null,
      true,
      "the fixture theme reads",
    );
    const edited = (before.text as string).replace(
      "#3355ff",
      "#ff0000",
    );
    const written = await client.project.themes.write({
      name: "acme",
      text: edited,
    });
    deepStrictEqual(written.error, null);
    const after = await client.project.themes.read({ name: "acme" });
    deepStrictEqual(
      after.text?.includes("#ff0000"),
      true,
      "the write landed on disk",
    );
  });

  it("removes a theme", async () => {
    const removed = await client.project.themes.remove({ name: "acme-dark" });
    deepStrictEqual(removed.error, null);
    const names = (await client.project.themes.list({})).map((t) => t.name);
    deepStrictEqual(
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
    deepStrictEqual(res.status, 200, "the daemon answers its own procedures");
  });

  it("writes a config and reads it back, over HTTP", async () => {
    // The studio's seat and order persist through the daemon, not around it:
    // the write lands in spin/config.json and the read names the file, so a
    // client can tell an author their values are written rather than default.
    const wrote = await client.project.config.write({
      config: { activeTheme: "acme", themeOrder: ["acme", "starter"] },
    });
    deepStrictEqual(wrote.error, null);
    const read = await client.project.config.read({});
    deepStrictEqual(read.config, {
      activeTheme: "acme",
      themeOrder: ["acme", "starter"],
    });
    deepStrictEqual(read.file, "spin/config.json");
  });

  it("serves the studio entry with mount-absolute assets on a nested route", async () => {
    // The bundle's asset references are relative (`./assets/…`): served
    // verbatim on `/studio/themes/type`, the browser resolves them against
    // the nested route and the page loads no script. The fallback rewrites
    // them to the mount, so a nested studio route boots from anywhere.
    // The daemon's own bundle serves when one is built; absent, the mount
    // skips it — so this builds the smallest bundle that proves the rule.
    const studio = join(dir, "studio-fixture");
    mkdirSync(join(studio, "assets"), { recursive: true });
    writeFileSync(
      join(studio, "index.html"),
      '<script src="./assets/app.js"></script><link href="./assets/app.css">',
    );
    writeFileSync(join(studio, "assets", "app.js"), "ok");
    const { createSpinApp } = await import("../../src/api/index.ts");
    const app = createSpinApp({ root: dir, base: "/rpc", studioDir: studio });
    const res = await app.request("/studio/themes/type");
    deepStrictEqual(res.status, 200);
    deepStrictEqual(
      await res.text(),
      '<script src="/studio/assets/app.js"></script><link href="/studio/assets/app.css">',
    );
    const root = await app.request("/studio/");
    deepStrictEqual(root.status, 200);
    deepStrictEqual(
      await root.text(),
      '<script src="/studio/assets/app.js"></script><link href="/studio/assets/app.css">',
    );
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
    deepStrictEqual(refused, true, "a name with a separator must be refused");
  });
});
