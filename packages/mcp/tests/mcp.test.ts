import { assert, assertEquals } from "@std/assert";
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
    // round-trip has a $modes slot to lose.
    const moded = setToken(
      scaffoldTheme(),
      ["color", "primary"],
      "#8db9fa",
      undefined,
      "dark",
    );
    assert(moded.ok, "fixture override expected to hold");
    writeFileSync(join(dir, "spin", "sample.json"), treeToJson(moded.tree));

    // And its opposite: a document that declares dark and holds none — the
    // coverage failure analyze exists to report.
    const darkless = JSON.parse(
      treeToJson(scaffoldTheme()),
    ) as Record<string, unknown>;
    darkless.modes = ["dark"];
    writeFileSync(
      join(dir, "spin", "darkless.json"),
      JSON.stringify(darkless, null, 2),
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
    const result = await mcp.callTool({ name: "list_themes", arguments: {} });
    assertEquals(jsonOf(result), [
      { name: "darkless", file: "spin/darkless.json" },
      { name: "sample", file: "spin/sample.json" },
    ]);
  });

  it("reports the project the daemon serves", async () => {
    const result = await mcp.callTool({ name: "project_info", arguments: {} });
    const report = jsonOf(result) as { root: string; themes: string[] };
    assertEquals(report.root, dir);
    assertEquals(report.themes, ["darkless.json", "sample.json"]);
  });

  it("reads a theme document", async () => {
    const result = await mcp.callTool({
      name: "read_theme",
      arguments: { theme: "sample" },
    });
    assertEquals(
      textOf(result),
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    );
  });

  it("sets a token without losing the document's $modes", async () => {
    const result = await mcp.callTool({
      name: "set_token",
      arguments: { theme: "sample", path: "color.primary", value: "#123456" },
    });
    assertEquals(result.isError, undefined);
    const doc = JSON.parse(
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    ) as {
      color: { primary: { $value: string; $modes: Record<string, string> } };
    };
    assertEquals(doc.color.primary.$value, "#123456");
    assertEquals(doc.color.primary.$modes.dark, "#8db9fa");
  });

  it("writes a mode override beside an unchanged base value", async () => {
    const before = JSON.parse(
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    ) as { color: { primary: { $value: string } } };
    await mcp.callTool({
      name: "set_token",
      arguments: {
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
    assertEquals(doc.color.primary.$modes.dark, "#654321");
    assertEquals(doc.color.primary.$value, before.color.primary.$value);
  });

  it("refuses to remove a required token, with the refusal's code", async () => {
    const result = await mcp.callTool({
      name: "remove_token",
      arguments: { theme: "sample", path: "color.primary" },
    });
    assertEquals(result.isError, true);
    const refusal = jsonOf(result) as { error: string; code: string };
    assertEquals(refusal.code, "required-token");
    assert(
      refusal.error.includes("color.primary"),
      `refusal names the path: ${refusal.error}`,
    );
  });

  it("renames a token, carrying its $modes to the new path", async () => {
    await mcp.callTool({
      name: "create_theme",
      arguments: { theme: "rename-me", from: "sample" },
    });
    const result = await mcp.callTool({
      name: "rename_token",
      arguments: {
        theme: "rename-me",
        from: "color.primary",
        to: "color.brand",
      },
    });
    assertEquals(result.isError, undefined);
    const doc = JSON.parse(
      readFileSync(join(dir, "spin", "rename-me.json"), "utf8"),
    ) as {
      color: { brand: { $value: string; $modes: Record<string, string> } };
    };
    assertEquals(doc.color.brand.$value, "#123456");
    assertEquals(doc.color.brand.$modes.dark, "#654321");
    // The rename left the required role unclaimed, and the answer says so.
    const answer = jsonOf(result) as { issues: Array<{ path: string }> };
    assert(
      answer.issues.some((issue) => issue.path === "color.primary"),
      `missing-role issue expected: ${JSON.stringify(answer.issues)}`,
    );
  });

  it("creates a theme from another and deletes it", async () => {
    const created = await mcp.callTool({
      name: "create_theme",
      arguments: { theme: "copy", from: "sample" },
    });
    assertEquals(created.isError, undefined);
    assertEquals(
      readFileSync(join(dir, "spin", "copy.json"), "utf8"),
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    );
    const deleted = await mcp.callTool({
      name: "delete_theme",
      arguments: { theme: "copy" },
    });
    assertEquals(deleted.isError, undefined);
    assertEquals(existsSync(join(dir, "spin", "copy.json")), false);
  });

  it("creates a theme from the scaffold when no source is named", async () => {
    const created = await mcp.callTool({
      name: "create_theme",
      arguments: { theme: "fresh" },
    });
    assertEquals(created.isError, undefined);
    const doc = JSON.parse(
      readFileSync(join(dir, "spin", "fresh.json"), "utf8"),
    ) as { color?: unknown };
    assert(doc.color !== undefined, "the scaffold carries the required roles");
  });

  it("writes a whole document and reports its validation", async () => {
    const text = treeToJson(scaffoldTheme());
    const written = await mcp.callTool({
      name: "write_theme",
      arguments: { theme: "whole", text },
    });
    assertEquals(written.isError, undefined);
    assertEquals(
      readFileSync(join(dir, "spin", "whole.json"), "utf8"),
      text,
    );
    assertEquals(jsonOf(written), { error: null, issues: [] });
  });

  it("reports the coverage failure of a theme that declares dark", async () => {
    const result = await mcp.callTool({
      name: "analyze_theme",
      arguments: { theme: "darkless" },
    });
    const analysis = jsonOf(result) as {
      error: string | null;
      issues: Array<{ path: string; message: string }>;
    };
    assertEquals(analysis.error, null);
    assert(
      analysis.issues.some((issue) =>
        issue.path === "color.primary" && issue.message.includes("$modes.dark")
      ),
      `missing-dark issue expected: ${JSON.stringify(analysis.issues)}`,
    );
  });

  it("lists the components, and one component's contract with its examples", async () => {
    const listed = await mcp.callTool({
      name: "list_components",
      arguments: {},
    });
    const names = (jsonOf(listed) as Array<{ name: string }>).map((c) =>
      c.name
    );
    assert(names.includes("card"), `card among ${names.join(",")}`);

    const one = await mcp.callTool({
      name: "component_contract",
      arguments: { name: "card" },
    });
    const contract = jsonOf(one) as {
      reads: string[];
      examples: { rows: Array<{ name: string }> } | null;
    };
    assert(contract.reads.length > 0, "a contract reads tokens");
    assert(
      (contract.examples?.rows.length ?? 0) > 0,
      "and ships example markup",
    );
  });

  it("lists the utilities under reader intent", async () => {
    const result = await mcp.callTool({
      name: "list_utilities",
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
      name: "search_icons",
      arguments: { query: "arrow-up", collection: "lucide" },
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
      name: "icon_body",
      arguments: { collection: "lucide", name: "arrow-up" },
    });
    const glyph = jsonOf(body) as {
      body: string;
      width: number;
      height: number;
    };
    assert(glyph.body.length > 0, "the glyph draws");
    assert(typeof glyph.width === "number", "and knows its box");
  });

  it("previews a theme's stylesheet", async () => {
    const result = await mcp.callTool({
      name: "preview_css",
      arguments: { theme: "sample", markup: '<button class="btn">Go</button>' },
    });
    assertEquals(result.isError, undefined);
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
    assertEquals(
      contents[0]?.text,
      readFileSync(join(dir, "spin", "sample.json"), "utf8"),
    );
  });
});
