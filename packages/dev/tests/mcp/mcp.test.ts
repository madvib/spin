import assert, { deepStrictEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Daemon, startDaemon } from "@spinjs/server/daemon";
import { createSpinClient, type SpinClient, createSpinApp } from "../../src/api/index.ts";
import { designLanguages, parseTokens, setToken, treeToJson } from "@spinjs/theme";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { buildSpinMcpServer, createSpinMcpServer } from "../../src/mcp/server.ts";

/**
 * The MCP surface, end to end: a real daemon serving a temp project over
 * HTTP, the server built the way main.ts builds it, and an MCP client on the
 * other end of an in-memory transport.
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
    mkdirSync(join(dir, "spin", "sample"), { recursive: true });

    const minimalParsed = parseTokens(JSON.stringify(designLanguages.minimal));
    if (!minimalParsed.ok) throw new Error(minimalParsed.error);
    const moded = setToken(
      minimalParsed.tree,
      ["color", "primary"],
      "#8db9fa",
      undefined,
      "dark",
    );
    assert(moded.ok, "fixture override expected to hold");
    const sample = JSON.parse(treeToJson(moded.tree)) as Record<string, unknown>;
    sample.modes = ["light", "dark"];
    writeFileSync(
      join(dir, "spin", "sample", "tokens.json"),
      JSON.stringify(sample, null, 2),
    );

    daemon = await startDaemon({
      root: dir,
      app: createSpinApp({ root: dir, base: "/rpc" }),
      port: 0,
    });
    rpc = createSpinClient(daemon.url);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
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

  it("exposes only component, icon, and utility when Studio is inactive", async () => {
    const listed = await mcp.listTools();
    deepStrictEqual(
      listed.tools.map((t) => t.name).sort(),
      ["component", "icon", "issues", "utility"],
    );
  });

  it("lists components and reads a component contract", async () => {
    const listed = jsonOf(
      await mcp.callTool({ name: "component", arguments: { action: "list" } }),
    ) as Array<{ name: string; kind: string }>;
    assert(listed.some((entry) => entry.name === "button" && entry.kind === "primitive"));

    const contract = jsonOf(
      await mcp.callTool({
        name: "component",
        arguments: { action: "contract", name: "button" },
      }),
    ) as { name: string };
    deepStrictEqual(contract.name, "button");
  });

  it("returns utility sections for a project theme", async () => {
    const result = jsonOf(
      await mcp.callTool({ name: "utility", arguments: { theme: "sample" } }),
    ) as { sections: Array<{ title: string }> };
    assert(result.sections.length > 0);
  });

  it("searches icons and fetches a glyph body", async () => {
    const searched = jsonOf(
      await mcp.callTool({
        name: "icon",
        arguments: { action: "search", collection: "lucide", query: "home", limit: 5 },
      }),
    ) as { matching: number; icons: Array<{ collection: string; name: string }> };
    assert(searched.matching > 0);
    deepStrictEqual(searched.icons[0]?.collection, "lucide");
  });

  it("reads spin://project and spin://themes/sample resources", async () => {
    const projectRes = await mcp.readResource({ uri: "spin://project" });
    const projectText = (projectRes.contents[0] as { text?: string } | undefined)?.text ?? "{}";
    const project = JSON.parse(projectText) as { root: string };
    deepStrictEqual(project.root, dir);

    const themeRes = await mcp.readResource({ uri: "spin://themes/sample" });
    const themeText = (themeRes.contents[0] as { text?: string } | undefined)?.text;
    deepStrictEqual(
      themeText,
      readFileSync(join(dir, "spin", "sample", "tokens.json"), "utf8"),
    );
  });
  it("registers brand_draft when Studio is active and stages drafts in overlay without touching disk", async () => {
    const originalDisk = readFileSync(join(dir, "spin", "sample", "tokens.json"), "utf8");
    const ping = await rpc.overlay.studioPing({});
    deepStrictEqual(ping.studioActive, true);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const studioMcp = new Client({ name: "spin-mcp-studio-test", version: "0.0.0" });
    const server = await createSpinMcpServer(rpc);
    await Promise.all([
      server.connect(serverTransport),
      studioMcp.connect(clientTransport),
    ]);

    try {
      const listed = await studioMcp.listTools();
      deepStrictEqual(
        listed.tools.map((t) => t.name).sort(),
        ["brand_draft", "component", "icon", "issues", "utility"],
      );

      const drafted = jsonOf(
        await studioMcp.callTool({
          name: "brand_draft",
          arguments: {
            brand: "sample",
            palette: { primary: "#0f766e" },
            type: { display: "Space Grotesk" },
          },
        }),
      ) as { drafted?: boolean; brand?: string; dirty?: string[]; error?: string };

      assert(drafted.drafted === true, `expected drafted=true, got: ${JSON.stringify(drafted)}`);
      deepStrictEqual(drafted.brand, "sample");
      deepStrictEqual(drafted.dirty, ["sample"]);

      const overlay = await rpc.overlay.get({});
      deepStrictEqual(overlay.open, true);
      deepStrictEqual(overlay.dirty, ["sample"]);

      const afterDisk = readFileSync(join(dir, "spin", "sample", "tokens.json"), "utf8");
      deepStrictEqual(afterDisk, originalDisk);
    } finally {
      await studioMcp.close();
    }
  });

  it("creates, lists, and resolves issues via the issues MCP tool", async () => {
    const created = jsonOf(
      await mcp.callTool({
        name: "issues",
        arguments: {
          action: "create",
          route: "/dashboard",
          annotations: [
            {
              selector: "card > footer button",
              boundingBox: { x: 10, y: 20, width: 100, height: 36 },
              route: "/dashboard",
              tag: "button",
              comment: "Align footer action button",
            },
          ],
        },
      }),
    ) as { issue?: { id: string; status: string } };
    assert(created.issue?.id.startsWith("iss_"));
    deepStrictEqual(created.issue?.status, "open");

    const listed = jsonOf(
      await mcp.callTool({ name: "issues", arguments: { action: "list" } }),
    ) as { issues: Array<{ id: string }> };
    assert(listed.issues.some((i) => i.id === created.issue?.id));

    const resolved = jsonOf(
      await mcp.callTool({
        name: "issues",
        arguments: { action: "resolve", id: created.issue?.id },
      }),
    ) as { issue?: { status: string } };
    deepStrictEqual(resolved.issue?.status, "resolved");
  });

  it("spin mcp CLI stays alive over stdio and answers initialize", async () => {
    const { spawn } = await import("node:child_process");
    // Reuses suite temp project `dir`
    const child = spawn(
      process.execPath,
      ["packages/dev/src/cli/main.ts", "mcp", "--root", dir],
      { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] },
    );
    const out = await new Promise<string>((resolve, reject) => {
      let buf = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`spin mcp timed out; stdout=${buf}`));
      }, 5000);
      child.stdout.on("data", (chunk: Buffer) => {
        buf += String(chunk);
        if (buf.includes('"protocolVersion"')) {
          clearTimeout(timer);
          child.kill();
          resolve(buf);
        }
      });
      child.on("exit", (code) => {
        if (!buf.includes('"protocolVersion"')) {
          clearTimeout(timer);
          reject(new Error(`spin mcp exited early (${code}); stdout=${buf}`));
        }
      });
      child.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0" },
          },
        }) + "\n",
      );
    });
    assert(out.includes('"protocolVersion"'), "MCP initialize response received over stdio");
  });
});
