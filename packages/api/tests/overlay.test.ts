/**
 * The overlay surface, driven end to end in-process.
 *
 * What a consumer sees: a document written over RPC is what the preset
 * generates from until the overlay is cleared, and nothing here touches
 * disk. No socket — the same handler the middleware mounts, invoked as a
 * function.
 */

import { assert, assertEquals } from "@std/assert";
import { after, before, describe, it } from "node:test";
import { rpcHandler } from "../src/index.ts";
import { clearOverlay } from "@spin/preset";

function clientFor<T>(procedure: string, input?: unknown): Promise<T> {
  return rpcHandler.handle(
    new Request(`http://test/rpc${procedure}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input ?? {} }),
    }),
    { prefix: "/rpc" },
  ).then(async ({ response }) => {
    const body = await response?.text() ?? "{}";
    return JSON.parse(body).json as T;
  });
}

const openOverlay = (themes: Record<string, unknown>) =>
  clientFor<{ names: string[]; open: boolean }>(`/overlay/set`, { themes });

const readOverlay = () =>
  clientFor<{ open: boolean; themes: Record<string, unknown> }>(`/overlay/get`);

const closeOverlay = () => clientFor<{ open: boolean }>(`/overlay/clear`);

describe("the overlay", () => {
  before(() => clearOverlay());
  after(() => clearOverlay());

  it("starts closed, with disk in charge", async () => {
    const state = await readOverlay();
    assertEquals(state.open, false);
    assertEquals(state.themes, {});
  });

  it("a document written over RPC is what the cell holds", async () => {
    const opened = await openOverlay({ default: { color: { primary: "#b91c1c" } } });
    assertEquals(opened.names, ["default"]);
    assertEquals(opened.open, true);

    const state = await readOverlay();
    assertEquals(state.open, true);
    assertEquals(
      (state.themes.default as Record<string, Record<string, string>>).color.primary,
      "#b91c1c",
    );
  });

  it("closing the overlay puts disk back in charge", async () => {
    await openOverlay({ default: { color: { primary: "#b91c1c" } } });
    const closed = await closeOverlay();
    assertEquals(closed.open, false);

    const state = await readOverlay();
    assert(state.open === false);
    assertEquals(state.themes, {});
  });
});
