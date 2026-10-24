import assert, { deepStrictEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Daemon, startDaemon } from "@spin/api/daemon";
import { createSpinClient, type SpinClient } from "@spin/api";
import { scaffoldTheme, setToken, treeToJson } from "@spin/theme";
import { Client, InMemoryTransport } from "../src/sdk.ts";
import { buildSpinMcpServer } from "../src/server.ts";

/**
 * The MCP surface, end to end: a real daemon serving a temp project over
 * HTTP, the server built the way main.ts builds it, and an MCP client on the
 * other end of an in-memory transport. No mocks — a tool that lies about what
 * it wrote would be caught by the file it did or did not change.
 */

function textOf(result: unknown): string {
  const content = (result as {
    content?: Array<{ type: string; text?: string }>;
  }).content;
  const first = content?.[0];
  if (first?.text === undefined) {
    throw new Error(`no text content: ${JSON.stringify(result)}`);
  }
  return first.text;
}

function jsonOf(result: unknown): unknown {
  return JSON.parse(textOf(result));
}

describe("the spin MCP server", () => {
  let dir: string;
  let daemon: Daemon;
  let rpc: SpinClient;
  let mcp: Client;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "spin-mcp-"));
    mkdirSync(join(dir, "spin"));

    // The fixture theme: the scaffold, with one dark override so the
    // round-trip has a $modes slot to lose. It serves both modes, so the
    // override it carries is one a reader will see.
    const moded = setToken(
      scaffoldTheme(),
      ["color", "primary"],
      "#8db9fa",
      undefined,
      "dark",
    );
    assert(moded.ok, "fixture override expected to hold");
    const sample = JSON.parse(treeToJson(moded.tree)) as Record<
      string,
      unknown
    >;
    sample.modes = ["light", "dark"];
    writeFileSync(
      join(dir, "spin", "sample.json"),
      JSON.stringify(sample, null, 2),
    );

    // And its opposite: a document that serves light alone and carries a dark
    // value — the dead override analyze exists to report. A mode a theme
    // serves but does not override is fine; a value for a mode it does not
    // serve is a promise nothing keeps.
    const unlighted = JSON.parse(
      treeToJson(moded.tree),
    ) as Record<string, unknown>;
    unlighted.modes = ["light"];
    writeFileSync(
      join(dir, "spin", "unlighted.json"),
      JSON.stringify(unlighted, null, 2),
    );

    daemon = startDaemon({ root: dir, port: 0 });
    rpc = createSpinClient(daemon.url);

    const [clientTransport, serverTransport] = InMemoryTransport
      .createLinkedPair();
    mcp = new Client({ name: "spin-mcp-test", version: "0.0.0" });
    await Promise.all([
      buildSpinMcpServer(rpc).connect(serverTransport),
      mcp.connect(clientTransport),
    ]);
  });

  after(async () => {
    await mcp.close();
    daemon.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists the themes the project holds", async () => {
    const result = await mcp.callTool({
      name: "theme",
      arguments: { action: "list" },
    });
    deepStrictEqual(jsonOf(result), [
      { name: "console", file: null },
      { name: "neobrut", file: null },
      { name: "sample", file: "spin/sample.json" },
      { name: "silk", file: null },
      { name: "spin", file: null },
      { name: "synthwave", file: null },
      { name: "unlighted", file: "spin/unlighted.json" },
    ]);
  });

  it("refuses a read that names no theme", async () => {
    const result = await mcp.callTool({
      name: "theme",
      arguments: { action: "read" },
    });
    deepStrictEqual(result.isError, true);
    const refusal = jsonOf(result) as { error: string };
    assert(
      refusal.error.includes("theme name"),
      `the refusal names what is missing: ${refusal.error}`,
    );
  });

  it("reads a theme document", async () => {
    const result = await mcp.callTool({
      name: "theme",
      arguments: { action: "read", name: "sample" },
    });
    deepStrictEqual(
      textOf(result),
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    );
  });

  it("sets a token without losing the document's $modes", async () => {
    const result = await mcp.callTool({
      name: "token",
      arguments: {
        action: "set",
        theme: "sample",
        path: "color.primary",
        value: "#123456",
      },
    });
    deepStrictEqual(result.isError, undefined);
    const doc = JSON.parse(
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    ) as {
      color: { primary: { $value: string; $modes: Record<string, string> } };
    };
    deepStrictEqual(doc.color.primary.$value, "#123456");
    deepStrictEqual(doc.color.primary.$modes.dark, "#8db9fa");
  });

  it("writes a mode override beside an unchanged base value", async () => {
    const before = JSON.parse(
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    ) as { color: { primary: { $value: string } } };
    await mcp.callTool({
      name: "token",
      arguments: {
        action: "set",
        theme: "sample",
        path: "color.primary",
        value: "#654321",
        mode: "dark",
      },
    });
    const doc = JSON.parse(
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    ) as {
      color: { primary: { $value: string; $modes: Record<string, string> } };
    };
    deepStrictEqual(doc.color.primary.$modes.dark, "#654321");
    deepStrictEqual(doc.color.primary.$value, before.color.primary.$value);
  });

  it("refuses to remove a required token, with the refusal's code", async () => {
    const result = await mcp.callTool({
      name: "token",
      arguments: { action: "remove", theme: "sample", path: "color.primary" },
    });
    deepStrictEqual(result.isError, true);
    const refusal = jsonOf(result) as { error: string; code: string };
    deepStrictEqual(refusal.code, "required-token");
    assert(
      refusal.error.includes("color.primary"),
      `refusal names the path: ${refusal.error}`,
    );
  });

  it("renames a token, carrying its $modes to the new path", async () => {
    await mcp.callTool({
      name: "theme",
      arguments: { action: "create", name: "rename-me", from: "sample" },
    });
    const result = await mcp.callTool({
      name: "token",
      arguments: {
        action: "rename",
        theme: "rename-me",
        from: "color.primary",
        to: "color.brand",
      },
    });
    deepStrictEqual(result.isError, undefined);
    const doc = JSON.parse(
      readFileSync(join(dir, "spin", "rename-me.json"), "utf8"),
    ) as {
      color: { brand: { $value: string; $modes: Record<string, string> } };
    };
    deepStrictEqual(doc.color.brand.$value, "#123456");
    deepStrictEqual(doc.color.brand.$modes.dark, "#654321");
    // The rename left the required role unclaimed, and the answer says so.
    const answer = jsonOf(result) as { issues: Array<{ path: string }> };
    assert(
      answer.issues.some((issue) => issue.path === "color.primary"),
      `missing-role issue expected: ${JSON.stringify(answer.issues)}`,
    );
  });

  it("creates a theme from another and deletes it", async () => {
    const created = await mcp.callTool({
      name: "theme",
      arguments: { action: "create", name: "copy", from: "sample" },
    });
    deepStrictEqual(created.isError, undefined);
    deepStrictEqual(
      readFileSync(join(dir, "spin", "copy.json"), "utf8"),
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    );
    const deleted = await mcp.callTool({
      name: "theme",
      arguments: { action: "delete", name: "copy" },
    });
    deepStrictEqual(deleted.isError, undefined);
    deepStrictEqual(existsSync(join(dir, "spin", "copy.json")), false);
  });

  it("creates a theme from the scaffold when no source is named", async () => {
    const created = await mcp.callTool({
      name: "theme",
      arguments: { action: "create", name: "fresh" },
    });
    deepStrictEqual(created.isError, undefined);
    const doc = JSON.parse(
      readFileSync(join(dir, "spin", "fresh.json"), "utf8"),
    ) as { color?: unknown };
    assert(doc.color !== undefined, "the scaffold carries the required roles");
  });

  it("writes a whole document and reports its validation", async () => {
    const text = treeToJson(scaffoldTheme());
    const written = await mcp.callTool({
      name: "theme",
      arguments: { action: "write", name: "whole", text },
    });
    deepStrictEqual(written.isError, undefined);
    deepStrictEqual(
      readFileSync(join(dir, "spin", "whole.json"), "utf8"),
      text,
    );
    deepStrictEqual(jsonOf(written), { error: null, issues: [] });
  });

  it("reports the dead override of a theme that does not serve the mode", async () => {
    const result = await mcp.callTool({
      name: "theme",
      arguments: { action: "analyze", name: "unlighted" },
    });
    const analysis = jsonOf(result) as {
      error: string | null;
      issues: Array<{ path: string; message: string }>;
    };
    deepStrictEqual(analysis.error, null);
    assert(
      analysis.issues.some((issue) =>
        issue.path === "color.primary" &&
        issue.message.includes("does not serve")
      ),
      `no dead-override issue expected: ${JSON.stringify(analysis.issues)}`,
    );
  });

  it("lists the components, and one component's contract with its examples", async () => {
    const listed = await mcp.callTool({
      name: "component",
      arguments: { action: "list" },
    });
    const names = (jsonOf(listed) as Array<{ name: string }>).map((c) =>
      c.name
    );
    const one = await mcp.callTool({
      name: "component",
      arguments: { action: "contract", name: "card" },
    });
    const contract = jsonOf(one) as {
      reads: string[];
      component: unknown[];
    };
    assert(contract.reads.length > 0, "a contract reads tokens");
    assert(contract.component.length > 0, "and declares component tokens");
  });

  it("lists machine components, and one machine's contract, examples, and copy", async () => {
    const listed = await mcp.callTool({
      name: "component",
      arguments: { action: "list" },
    });
    const entries = jsonOf(listed) as Array<{ name: string; kind: string }>;
    assert(
      entries.some((c) => c.name === "card" && c.kind === "primitive"),
      "card stays a primitive",
    );
    assert(
      entries.some((c) => c.name === "tree-view" && c.kind === "machine"),
      "tree-view lists as a machine",
    );
    assert(
      entries.some((c) => c.name === "select" && c.kind === "machine"),
      "select lists as a machine",
    );

    const one = await mcp.callTool({
      name: "component",
      arguments: { action: "contract", name: "tree-view" },
    });
    const contract = jsonOf(one) as {
      kind: string;
      manifest: {
        parts: string[];
        slots: string[];
        readers: string[];
        methods: string[];
      };
      examples: { rows: Array<{ name: string; html: string }> };
    };
    deepStrictEqual(contract.kind, "machine");
    assert(
      contract.manifest.parts.includes("root"),
      "the manifest names parts",
    );
    assert(contract.manifest.slots.includes("item"), "and slots");
    assert(contract.manifest.readers.length > 0, "and readers");
    assert(contract.examples.rows.length === 2, "and ships two examples");

    const copied = await mcp.callTool({
      name: "component",
      arguments: {
        action: "copy",
        name: "tree-view",
        example: "basic",
        root: dir,
      },
    });
    deepStrictEqual(copied.isError, undefined);
    deepStrictEqual(
      (jsonOf(copied) as { file: string }).file,
      join("spin", "tree-view", "basic.html"),
    );
    assert(
      existsSync(join(dir, "spin", "tree-view", "basic.html")),
      "the file lands in the project",
    );
  });

  it("lists the utilities under reader intent", async () => {
    const result = await mcp.callTool({
      name: "utility",
      arguments: { theme: "sample" },
    });
    const sections = (jsonOf(result) as {
      sections: Array<{ id: string; utilities: string[] }>;
    }).sections;
    const colors = sections.find((section) => section.id === "colors");
    assert(
      (colors?.utilities.length ?? 0) > 0,
      `colors resolve to utilities: ${
        JSON.stringify(
          sections.map((s) => s.id),
        )
      }`,
    );
  });

  it("finds an icon and draws its body", async () => {
    const found = await mcp.callTool({
      name: "icon",
      arguments: { action: "search", query: "arrow-up", collection: "lucide" },
    });
    const icons = (jsonOf(found) as {
      icons: Array<{ collection: string; name: string }>;
    }).icons;
    assert(
      icons.some((row) =>
        row.collection === "lucide" && row.name === "arrow-up"
      ),
      `lucide arrow-up expected: ${JSON.stringify(icons.slice(0, 5))}`,
    );

    const body = await mcp.callTool({
      name: "icon",
      arguments: { action: "body", collection: "lucide", name: "arrow-up" },
    });
    const glyph = jsonOf(body) as {
      body: string;
      width: number;
      height: number;
    };
    assert(glyph.body.length > 0, "the glyph draws");
    assert(typeof glyph.width === "number", "and knows its box");
  });

  it("keeps an icon in the project's library, and takes it away again", async () => {
    const markup =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12h14"/></svg>';
    const saved = await mcp.callTool({
      name: "savedIcon",
      arguments: {
        action: "save",
        name: "arrow-up",
        markup,
        collection: "lucide",
        author: "Lucide Contributors",
        license: "ISC",
      },
    });
    deepStrictEqual(saved.isError, undefined);

    // The library is project data: the file the tool wrote is what the
    // project now holds.
    const document = JSON.parse(
      readFileSync(join(dir, "spin", "icons", "arrow-up.json"), "utf8"),
    ) as {
      markup: string;
      attribution: { collection: string; author: string; license: string };
    };
    deepStrictEqual(document.markup, markup);
    deepStrictEqual(document.attribution.collection, "lucide");
    deepStrictEqual(document.attribution.author, "Lucide Contributors");
    deepStrictEqual(document.attribution.license, "ISC");

    const listed = await mcp.callTool({
      name: "savedIcon",
      arguments: { action: "list" },
    });
    const icons = jsonOf(listed) as Array<{
      name: string;
      attribution: { collection: string };
    }>;
    const kept = icons.find((icon) => icon.name === "arrow-up");
    assert(
      kept !== undefined,
      `arrow-up among ${icons.map((i) => i.name).join(",")}`,
    );
    deepStrictEqual(kept.attribution.collection, "lucide");

    const read = await mcp.callTool({
      name: "savedIcon",
      arguments: { action: "read", name: "arrow-up" },
    });
    const answer = jsonOf(read) as { markup: string; attribution: unknown };
    deepStrictEqual(answer.markup, markup);

    const removed = await mcp.callTool({
      name: "savedIcon",
      arguments: { action: "remove", name: "arrow-up" },
    });
    deepStrictEqual(removed.isError, undefined);
    deepStrictEqual(
      existsSync(join(dir, "spin", "icons", "arrow-up.json")),
      false,
    );
  });

  it("previews a theme's stylesheet", async () => {
    const result = await mcp.callTool({
      name: "preview",
      arguments: { theme: "sample", markup: '<button class="btn">Go</button>' },
    });
    deepStrictEqual(result.isError, undefined);
    const { css } = jsonOf(result) as { css: string };
    assert(
      css.includes("--color-primary"),
      `the sheet carries the theme's variables: ${css.slice(0, 200)}`,
    );
  });

  it("serves the project and its themes as resources", async () => {
    const listed = await mcp.listResources();
    assert(
      listed.resources.some((resource) =>
        resource.uri === "spin://themes/sample"
      ),
      `sample theme expected among ${
        listed.resources.map((r) => r.uri).join(",")
      }`,
    );
    const read = await mcp.readResource({ uri: "spin://themes/sample" });
    const contents = read.contents as Array<{ text?: string }>;
    deepStrictEqual(
      contents[0]?.text,
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    );

    // The project's own facts live here rather than on a tool: a client that
    // renders resources looks, and one that acts calls.
    const project = await mcp.readResource({ uri: "spin://project" });
    const facts = project.contents as Array<{ text?: string }>;
    const report = JSON.parse(facts[0]?.text ?? "") as {
      root: string;
      themes: string[];
    };
    deepStrictEqual(report.root, dir);
    assert(
      report.themes.includes("sample.json"),
      `sample.json among ${report.themes.join(",")}`,
    );
  });
});
