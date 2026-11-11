import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  parseTokens,
  setToken,
  treeToJson,
  designLanguages,
} from "@spinjs/theme";
import { describeCatalog } from "@spinjs/preset";
import {
  createSpinClient,
  componentsContract,
  componentsRouter,
  findingsContract,
  findingsRouter,
  fontsContract,
  fontsRouter,
  iconsContract,
  iconsRouter,
  overlayContract,
  overlayRouter,
  presetContract,
  presetRouter,
  previewContract,
  previewRouter,
  projectContract,
  projectRouter,
  router,
  themeContract,
  themeRouter,
} from "../../src/api/index.ts";
import { RPCHandler } from "@orpc/server/fetch";

/** Serve the composed daemon router on an ephemeral port. */
function serve() {
  const handler = new RPCHandler(router);
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const { response } = await handler.handle(request, { prefix: "/rpc" });
      return response ?? new Response("Not Found", { status: 404 });
    },
  });
  return {
    server,
    client: createSpinClient(`http://localhost:${server.port}/rpc`),
  };
}
/**
 * The module routers, beside their contracts.
 *
 * Modules, not procedures: a new procedure inside a module is picked up
 * by the walk, so growing the API changes implementation only. A new
 * MODULE is registered here — that is the one list this file keeps.
 */
const MODULES: Readonly<Record<string, { contract: unknown; router: unknown }>> = {
  theme: { contract: themeContract, router: themeRouter },
  preview: { contract: previewContract, router: previewRouter },
  project: { contract: projectContract, router: projectRouter },
  components: { contract: componentsContract, router: componentsRouter },
  preset: { contract: presetContract, router: presetRouter },
  icons: { contract: iconsContract, router: iconsRouter },
  findings: { contract: findingsContract, router: findingsRouter },
  fonts: { contract: fontsContract, router: fontsRouter },
  overlay: { contract: overlayContract, router: overlayRouter },
};

/**
 * The procedure paths a router or contract object carries.
 *
 * Groups are plain nested objects; procedures are the leaves oRPC built,
 * marked `~orpc`. Enumerable internals under `~` are skipped, and the
 * visited set guards the builders' self-references.
 */
function proceduresOf(root: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown, prefix: string): void => {
    if (typeof node !== "object" || node === null || seen.has(node)) return;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("~")) continue;
      const path = prefix === "" ? key : `${prefix}.${key}`;
      if (
        typeof value === "object" && value !== null && !("~orpc" in value)
      ) {
        walk(value, path);
      } else if (typeof value === "object" && value !== null) {
        out.push(path);
      }
    }
  };
  walk(root, "");
  return out.toSorted();
}

/** Every procedure the daemon serves, derived from the live router. */
function declaredProcedures(): Set<string> {
  return new Set(proceduresOf(router));
}

test("every module's contract and router agree on its procedures", () => {
  // The agreement, not a mirror of it: both sides are walked live, so a
  // contract that grows a procedure nothing implements fails here — and
  // growing both together passes without touching this file.
  for (const [name, { contract, router: moduleRouter }] of Object.entries(MODULES)) {
    const contracted = proceduresOf(contract);
    const routed = proceduresOf(moduleRouter);
    assert(contracted.length > 0, `${name} declares no procedures`);
    deepStrictEqual(routed, contracted, `${name}: router and contract differ`);
  }
});

test("the composed router carries every module's procedures", () => {
  const composed = declaredProcedures();
  for (const [name, { router: moduleRouter }] of Object.entries(MODULES)) {
    for (const path of proceduresOf(moduleRouter)) {
      assert(composed.has(path), `${name}: composed router drops ${path}`);
    }
  }
 });

test("typed client talks to the router over serve", async () => {
  const { server, client } = serve();
  try {
    const text = JSON.stringify(designLanguages.minimal, null, 2);

    const analysis = await client.theme.analyze({ text });
    deepStrictEqual(analysis.error, null);
    deepStrictEqual(analysis.issues, []);

    const mutated = await client.theme.tokens.set({
      text,
      path: ["color", "primary"],
      value: "#ff0000",
    });
    deepStrictEqual(mutated.error, null);
    assert(parseTokens(mutated.text ?? "").ok, "mutated text must parse");

    const refused = await client.theme.tokens.remove({
      text,
      path: ["color"],
    });
    assert(refused.error !== null, "expected a group refusal");

    const copied = parseTokens(JSON.stringify(designLanguages.minimal, null, 2));
    assert(copied.ok, "starter text must parse");
  } finally {
    await server.stop();
  }
});

test("analyze reports broken JSON as an error", async () => {
  const { server, client } = serve();
  try {
    const out = await client.theme.analyze({ text: "{nope" });
    assert(out.error !== null, "expected a parse error");
  } finally {
    await server.stop();
  }
});

test("preset organization reports unparseable input", async () => {
  const { server, client } = serve();
  try {
    const out = await client.preset.organization({ text: "{nope" });
    assert(out.error !== null, "expected a parse error");
    deepStrictEqual(out.sections, []);
  } finally {
    await server.stop();
  }
});

test("a mode override lands in $modes and leaves the base value", async () => {
  const { server, client } = serve();
  try {
    const text = JSON.stringify(designLanguages.minimal, null, 2);
    const before = JSON.parse(text) as {
      color: { primary: { $value: unknown } };
    };
    const mutated = await client.theme.tokens.set({
      text,
      path: ["color", "primary"],
      value: "#8db9fa",
      mode: "dark",
    });
    deepStrictEqual(mutated.error, null);
    const doc = JSON.parse(mutated.text ?? "") as {
      color: { primary: { $value: unknown; $modes: Record<string, unknown> } };
    };
    deepStrictEqual(doc.color.primary.$modes.dark, "#8db9fa");
    deepStrictEqual(doc.color.primary.$value, before.color.primary.$value);
  } finally {
    await server.stop();
  }
});

test("a mutation refusal carries its code over the wire", async () => {
  const { server, client } = serve();
  try {
    const refused = await client.theme.tokens.remove({
      text: JSON.stringify(designLanguages.minimal, null, 2),
      path: ["color", "primary"],
    });
    assert(refused.error !== null, "expected a required-token refusal");
    deepStrictEqual(refused.code, "required-token");
    deepStrictEqual(refused.text, null);
  } finally {
    await server.stop();
  }
});

test("analyze reports a value written for a mode the theme does not serve", async () => {
  const { server, client } = serve();
  try {
    // A theme that serves light and carries a dark value: the value is never
    // shown, and the analyzer says so. The other direction is fine — a theme
    // that serves a mode it does not override simply renders its base values
    // there.
    const silkParsed = parseTokens(JSON.stringify(designLanguages.minimal));
    if (!silkParsed.ok) throw new Error(silkParsed.error);
    const moded = setToken(
      silkParsed.tree,
      ["color", "primary"],
      "#8db9fa",
      undefined,
      "dark",
    );
    assert(moded.ok, "the fixture override holds");
    const analysis = await client.theme.analyze({
      text: treeToJson(moded.tree),
      modes: ["light"],
    });
    deepStrictEqual(analysis.error, null);
    assert(
      analysis.issues.some((issue) =>
        issue.path === "color.primary" &&
        issue.message.includes("does not serve")
      ),
      `no dead-override issue: ${JSON.stringify(analysis.issues)}`,
    );
  } finally {
    await server.stop();
  }
});

test("the organization lists the catalog under reader intent", async () => {
  const { server, client } = serve();
  try {
    const text = JSON.stringify(designLanguages.minimal, null, 2);
    const parsed = parseTokens(text);
    assert(parsed.ok, "starter text must parse");
    const catalog = describeCatalog(parsed.tree);
    const organization = await client.preset.organization({ text });
    deepStrictEqual(organization.error, null);
    // Lossless by construction: every utility the catalog emits is claimed by
    // exactly one section, so a reader can always find what they saw.
    deepStrictEqual(
      organization.sections.flatMap((s) => s.utilities).sort(),
      catalog.flatMap((s) => s.utilities).sort(),
    );
    const colors = organization.sections.find((s) => s.id === "colors");
    assert(
      (colors?.utilities.length ?? 0) > 0,
      "role colors resolve to background utilities",
    );
    assert(
      organization.sections.every((s) => s.blurb.length > 0),
      "every section explains itself",
    );
  } finally {
    await server.stop();
  }
});

/**
 * Procedures no CLI or MCP surface calls, and why.
 *
 * Studio-called (`apps/studio/src`): `project.themes.facets`,
 * `project.config.read`, `project.config.write`, `components.tokens`,
 * `icons.collections`, `overlay.set`, `overlay.get` (via the injected
 * badge script). Daemon machinery: `overlay.clear`, `project.detect`. A new
 * procedure lands here only with its reason — the default is exposure, not
 * silence.
 */
const INTERNAL: ReadonlySet<string> = new Set([
  "overlay.set",
  "overlay.clear",
  "overlay.get",
  "project.detect",
  "project.themes.facets",
  "project.config.read",
  "project.config.write",
  "components.tokens",
  "icons.collections",
]);

/** The procedures a surface's source calls through the typed client. */
async function calledBy(surface: URL): Promise<Set<string>> {
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(surface, "utf8");
  const out = new Set<string>();
  for (const match of text.matchAll(/client\.([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+)\s*\(/g)) {
    out.add(match[1] as string);
  }
  return out;
}

test("every procedure is claimed by a surface or disclaimed as internal", async () => {
  // The router is the upstream; the CLI and MCP are its surfaces. A
  // procedure neither surface calls is a migration that missed: the walk
  // above derives the live set, and this fails when a live procedure
  // reaches no surface. Claim it in a surface, or disclaim it in
  // INTERNAL with the reason it stays inside.
  const declared = declaredProcedures();
  const cli = await calledBy(new URL("../../src/cli/main.ts", import.meta.url));
  const mcp = await calledBy(new URL("../../src/mcp/server.ts", import.meta.url));
  for (const path of [...declared].sort()) {
    assert(
      cli.has(path) || mcp.has(path) || INTERNAL.has(path),
      `${path} is implemented but no surface calls it — claim it or disclaim it in INTERNAL`,
    );
  }
  for (const path of [...INTERNAL].sort()) {
    assert(
      declared.has(path),
      `${path} is disclaimed but the router no longer declares it — drop the disclaimer`,
    );
  }
 });
