/**
 * The icon procedures, over RPC.
 *
 * A real server, a real client, a real project directory: the saved icons
 * are project data, and a procedure that answers with an icon the project
 * does not hold would be caught by the file it did or did not write.
 */

import { assert, assertEquals } from "@std/assert";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RPCHandler } from "@orpc/server/fetch";
import { createSpinClient, router } from "@spin/api";

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

/** The markup of a glyph, as it is saved. */
const MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12h14"/></svg>';

Deno.test("a saved icon is listed, read and removed over the wire", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-api-icons-"));
  const { server, client } = serve();
  try {
    const saved = await client.icons.saved.save({
      name: "arrow-up",
      markup: MARKUP,
      attribution: {
        collection: "lucide",
        author: "Lucide Contributors",
        license: "ISC",
      },
      root: dir,
    });
    assertEquals(saved.error, null);

    const listed = await client.icons.saved.list({ root: dir });
    assertEquals(listed.map((icon) => icon.name), ["arrow-up"]);
    assertEquals(listed[0]?.attribution, {
      collection: "lucide",
      author: "Lucide Contributors",
      license: "ISC",
    });

    const read = await client.icons.saved.read({
      name: "arrow-up",
      root: dir,
    });
    assertEquals(read.icon?.markup, MARKUP);

    const removed = await client.icons.saved.remove({
      name: "arrow-up",
      root: dir,
    });
    assertEquals(removed.error, null);
    assertEquals(await client.icons.saved.list({ root: dir }), []);
  } finally {
    await server.shutdown();
  }
});

Deno.test("a saved icon reaches the project's own files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-api-icons-"));
  const { server, client } = serve();
  try {
    await client.icons.saved.save({
      name: "arrow-up",
      markup: MARKUP,
      attribution: { collection: "lucide", author: null, license: null },
      root: dir,
    });

    const document = JSON.parse(
      await readFile(join(dir, "spin", "icons", "arrow-up.json"), "utf8"),
    ) as { markup: string; attribution: { collection: string } };
    assertEquals(document.markup, MARKUP);
    assertEquals(document.attribution.collection, "lucide");
  } finally {
    await server.shutdown();
  }
});

Deno.test("an icon saved without a source keeps its name and markup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-api-icons-"));
  const { server, client } = serve();
  try {
    const saved = await client.icons.saved.save({
      name: "drawn",
      markup: MARKUP,
      root: dir,
    });
    assertEquals(saved.error, null);

    const read = await client.icons.saved.read({
      name: "drawn",
      root: dir,
    });
    assertEquals(read.icon?.name, "drawn");
    assertEquals(read.icon?.attribution, {
      collection: null,
      author: null,
      license: null,
    });
  } finally {
    await server.shutdown();
  }
});

Deno.test("the installed collections say who made them", async () => {
  const { server, client } = serve();
  try {
    const collections = await client.icons.collections({});
    const prefixes = collections.map((collection) => collection.prefix);
    assert(
      prefixes.includes("lucide"),
      `lucide among the installed collections: ${prefixes.join(",")}`,
    );
    for (const collection of collections) {
      assert(
        collection.name.length > 0,
        `${collection.prefix} names itself`,
      );
    }
  } finally {
    await server.shutdown();
  }
});
