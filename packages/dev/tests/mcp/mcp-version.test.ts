import { describe, it } from "node:test";
import { deepStrictEqual } from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createInProcessSpinClient } from "../../src/api/index.ts";
import { buildSpinMcpServer } from "../../src/mcp/server.ts";
import manifest from "../../package.json";

/** The MCP handshake answers with the server's own version. */
async function serverVersion(): Promise<string> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "spin-mcp-version-test", version: "0.0.0" });
  const server = buildSpinMcpServer(createInProcessSpinClient());
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const version = client.getServerVersion();
    deepStrictEqual(version?.name, "spin");
    deepStrictEqual(typeof version?.version, "string");
    return version?.version as string;
  } finally {
    await client.close();
  }
}

describe("the spin MCP server version", () => {
  it("answers the handshake with the package version", async () => {
    deepStrictEqual(await serverVersion(), manifest.version);
    deepStrictEqual(manifest.version, "0.2.0-alpha.1");
  });
});
