import { assert, assertEquals } from "@std/assert";
import { parseTokens, setToken, treeToJson } from "@spin/theme";
import { scaffold } from "@spin/preset";
import {
  createSpinClient,
  iconsContract,
  iconsRouter,
  presetContract,
  presetRouter,
  previewContract,
  previewRouter,
  primitivesContract,
  primitivesRouter,
  projectContract,
  projectRouter,
  router,
  themeContract,
  themeRouter,
} from "@spin/api";
import { RPCHandler } from "@orpc/server/fetch";

/** Serve the composed daemon router on an ephemeral port. */
function serve() {
  const handler = new RPCHandler(router);
  const server = Deno.serve({ port: 0, onListen: () => {} }, (
    request,
  ): Promise<Response> =>
    handler.handle(request, { prefix: "/rpc" }).then(
      ({ response }) => response ?? new Response("Not Found", { status: 404 }),
    ));
  const addr = server.addr as Deno.NetAddr;
  return {
    server,
    client: createSpinClient(`http://localhost:${addr.port}/rpc`),
  };
}
/**
 * Every procedure a module declares, listed out.
 *
 * An earlier version of this walked the contract and router objects looking
 * for procedures. That reached into oRPC's internals — its builders are
 * self-referential and carry enumerable internals under `~orpc` — so it broke
 * on ordinary structure questions and would break again on an oRPC upgrade.
 * Listing the paths says the same thing and cannot drift into the library.
 */
const DECLARED: Array<[string, readonly string[], unknown, unknown]> = [
  [
    "theme",
    [
      "theme.analyze",
      "theme.css",
      "theme.scaffold",
      "theme.tokens.remove",
      "theme.tokens.rename",
      "theme.tokens.set",
      "theme.types",
      "themes.css",
    ],
    themeContract,
    themeRouter,
  ],
  [
    "preview",
    ["preview.css"],
    previewContract,
    previewRouter,
  ],
  [
    "project",
    [
      "project.detect",
      "project.current",
      "project.init",
      "project.themes.list",
      "project.themes.read",
      "project.themes.write",
      "project.themes.remove",
      "project.themes.copy",
    ],
    projectContract,
    projectRouter,
  ],
  [
    "primitives",
    [
      "primitives.contract",
      "primitives.list",
      "primitives.tokens",
    ],
    primitivesContract,
    primitivesRouter,
  ],
  [
    "preset",
    ["preset.catalog", "preset.organization"],
    presetContract,
    presetRouter,
  ],
  [
    "icons",
    [
      "icons.catalog",
      "icons.body",
      "icons.collections",
      "icons.saved.list",
      "icons.saved.read",
      "icons.saved.save",
      "icons.saved.remove",
    ],
    iconsContract,
    iconsRouter,
  ],
];

/** Follow a dotted path into a nested structure. */
function at(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (node, key) => (node as Record<string, unknown>)?.[key],
    root,
  );
}

Deno.test("every declared procedure has a contract and a handler", () => {
  // Three packages ship procedures. Only one of them was covered by an
  // agreement check, which is how a contract could grow a procedure nothing
  // implements without the suite noticing.
  for (const [name, paths, contract, router] of DECLARED) {
    assert(paths.length > 0, `${name} declares no procedures`);
    for (const path of paths) {
      assert(
        at(contract, path) !== undefined,
        `${name}: contract missing ${path}`,
      );
      assert(at(router, path) !== undefined, `${name}: router missing ${path}`);
    }
  }
});

Deno.test("the router carries nothing the contract does not declare", () => {
  for (const [name, paths, , router] of DECLARED) {
    for (const group of Object.keys(router as Record<string, unknown>)) {
      assert(
        paths.some((path) => path.split(".")[0] === group),
        `${name}: router exposes "${group}", which no contract declares`,
      );
    }
  }
});

Deno.test("typed client talks to the router over serve", async () => {
  const { server, client } = serve();
  try {
    const text = treeToJson(scaffold());

    const analysis = await client.theme.analyze({ text });
    assertEquals(analysis.error, null);
    assertEquals(analysis.issues, []);

    const css = await client.theme.css({ text });
    assertEquals(css.error, null);
    assert(css.css.includes("--color-primary"), `missing var in: ${css.css}`);

    const types = await client.theme.types({ text });
    assertEquals(types.error, null);
    assert(
      types.types.includes("ThemeTokenPath"),
      `missing union in: ${types.types.slice(0, 120)}`,
    );
    assert(
      types.types.includes("--color-primary"),
      `missing var in: ${types.types.slice(0, 200)}`,
    );

    const mutated = await client.theme.tokens.set({
      text,
      path: ["color", "primary"],
      value: "#ff0000",
    });
    assertEquals(mutated.error, null);
    assert(parseTokens(mutated.text ?? "").ok, "mutated text must parse");

    const refused = await client.theme.tokens.remove({
      text,
      path: ["color"],
    });
    assert(refused.error !== null, "expected a group refusal");

    const scaffolded = await client.theme.scaffold({});
    assert(
      parseTokens(scaffolded.text).ok,
      "scaffold text must parse",
    );
  } finally {
    await server.shutdown();
  }
});

Deno.test("analyze reports broken JSON as an error", async () => {
  const { server, client } = serve();
  try {
    const out = await client.theme.analyze({ text: "{nope" });
    assert(out.error !== null, "expected a parse error");
  } finally {
    await server.shutdown();
  }
});

Deno.test("the catalog reflects the theme it is given", async () => {
  const { server, client } = serve();
  try {
    // The scaffold is roles without scales, so a scale-driven family has
    // nothing to resolve and reports empty. That is the contract: the catalog
    // describes the theme in hand, not the vocabulary in general.
    const bare = await client.preset.catalog({ text: treeToJson(scaffold()) });
    assertEquals(bare.error, null);
    const bareIds = bare.sections.map((section) => section.id);
    assert(
      bareIds.includes("background"),
      `colors resolve with no scale: ${bareIds.join(",")}`,
    );
    const barePadding = bare.sections.find((s) => s.id === "padding");
    assertEquals(
      barePadding?.utilities.length,
      0,
      "no spacing scale, no padding",
    );

    // One spacing step is all it takes for the family to populate. The
    // catalog reads the document it is handed, so the step has to be in it.
    const base = JSON.parse(treeToJson(scaffold())) as Record<string, unknown>;
    const withScale = await client.preset.catalog({
      text: JSON.stringify({
        ...base,
        spacing: { $type: "dimension", 4: { $value: "1rem" } },
      }),
    });
    const gap = withScale.sections.find((s) => s.id === "gap");
    assert(
      (gap?.utilities.length ?? 0) > 0,
      "a spacing scale populates the gap family",
    );
  } finally {
    await server.shutdown();
  }
});

Deno.test("preset catalog reports unparseable input", async () => {
  const { server, client } = serve();
  try {
    const out = await client.preset.catalog({ text: "{nope" });
    assert(out.error !== null, "expected a parse error");
    assertEquals(out.sections, []);
  } finally {
    await server.shutdown();
  }
});

Deno.test("a mode override lands in $modes and leaves the base value", async () => {
  const { server, client } = serve();
  try {
    const text = treeToJson(scaffold());
    const before = JSON.parse(text) as {
      color: { primary: { $value: unknown } };
    };
    const mutated = await client.theme.tokens.set({
      text,
      path: ["color", "primary"],
      value: "#8db9fa",
      mode: "dark",
    });
    assertEquals(mutated.error, null);
    const doc = JSON.parse(mutated.text ?? "") as {
      color: { primary: { $value: unknown; $modes: Record<string, unknown> } };
    };
    assertEquals(doc.color.primary.$modes.dark, "#8db9fa");
    assertEquals(doc.color.primary.$value, before.color.primary.$value);
  } finally {
    await server.shutdown();
  }
});

Deno.test("a mutation refusal carries its code over the wire", async () => {
  const { server, client } = serve();
  try {
    const refused = await client.theme.tokens.remove({
      text: treeToJson(scaffold()),
      path: ["color", "primary"],
    });
    assert(refused.error !== null, "expected a required-token refusal");
    assertEquals(refused.code, "required-token");
    assertEquals(refused.text, null);
  } finally {
    await server.shutdown();
  }
});

Deno.test("analyze reports a value written for a mode the theme does not serve", async () => {
  const { server, client } = serve();
  try {
    // A theme that serves light and carries a dark value: the value is never
    // shown, and the analyzer says so. The other direction is fine — a theme
    // that serves a mode it does not override simply renders its base values
    // there.
    const moded = setToken(
      scaffold(),
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
    assertEquals(analysis.error, null);
    assert(
      analysis.issues.some((issue) =>
        issue.path === "color.primary" &&
        issue.message.includes("does not serve")
      ),
      `no dead-override issue: ${JSON.stringify(analysis.issues)}`,
    );
  } finally {
    await server.shutdown();
  }
});

Deno.test("the organization lists the catalog under reader intent", async () => {
  const { server, client } = serve();
  try {
    const text = treeToJson(scaffold());
    const catalog = await client.preset.catalog({ text });
    const organization = await client.preset.organization({ text });
    assertEquals(organization.error, null);
    // Lossless by construction: every utility the catalog emits is claimed by
    // exactly one section, so a reader can always find what they saw.
    assertEquals(
      organization.sections.flatMap((s) => s.utilities).sort(),
      catalog.sections.flatMap((s) => s.utilities).sort(),
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
    await server.shutdown();
  }
});
