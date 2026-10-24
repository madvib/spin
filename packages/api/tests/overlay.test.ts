/**
 * The overlay surface, driven end to end in-process.
 *
 * What a consumer sees: a document written over RPC is what the preset
 * generates from until the overlay is cleared, and nothing here touches
 * disk. No socket — the same handler the middleware mounts, invoked as a
 * function.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rpcHandler } from "../src/index.ts";
import { setProjectRoot } from "../src/project-procedures.ts";
import { clearOverlay } from "@spinjs/preset";

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
  clientFor<
    { open: boolean; themes: Record<string, unknown>; dirty: string[] }
  >(
    `/overlay/get`,
  );

const closeOverlay = () => clientFor<{ open: boolean }>(`/overlay/clear`);

describe("the overlay", () => {
  let dir: string;
  before(() => {
    clearOverlay();
    // The save test writes a theme: a temp project, never the product.
    dir = mkdtempSync(join(tmpdir(), "spin-overlay-"));
    mkdirSync(join(dir, "spin"));
    setProjectRoot(dir);
  });
  after(() => {
    clearOverlay();
    rmSync(dir, { recursive: true, force: true });
  });

  it("starts closed, with disk in charge", async () => {
    const state = await readOverlay();
    deepStrictEqual(state.open, false);
    deepStrictEqual(state.themes, {});
  });

  it("a document written over RPC is what the cell holds", async () => {
    const opened = await openOverlay({
      default: { color: { primary: "#b91c1c" } },
    });
    deepStrictEqual(opened.names, ["default"]);
    deepStrictEqual(opened.open, true);

    const state = await readOverlay();
    deepStrictEqual(state.open, true);
    const themes = state.themes.default as Record<
      string,
      Record<string, string>
    >;
    deepStrictEqual(themes.color?.primary, "#b91c1c");
  });

  it("a saved theme reads clean and survives a fresh boot", async () => {
    // The badge's whole promise: what was written is what a reload shows,
    // and the overlay agrees it matches. Uses the temp project the suite
    // already points at, so no product theme is touched.
    const doc = { color: { primary: { $value: "#b91c1c" } } };
    await openOverlay({ app: doc });
    const written = await clientFor<{ error: string | null }>(
      `/project/themes/write`,
      { name: "app", text: JSON.stringify(doc) },
    );
    deepStrictEqual(written.error, null);
    const state = await readOverlay();
    deepStrictEqual(state.dirty, [], "a save clears the dirty set");
    await closeOverlay();
    const reread = await clientFor<{ text: string | null }>(
      `/project/themes/read`,
      { name: "app" },
    );
    deepStrictEqual(
      JSON.parse(reread.text ?? "{}").color.primary.$value,
      "#b91c1c",
      "disk holds what was written",
    );
  });

  it("closing the overlay puts disk back in charge", async () => {
    await openOverlay({ default: { color: { primary: "#b91c1c" } } });
    const closed = await closeOverlay();
    deepStrictEqual(closed.open, false);

    const state = await readOverlay();
    assert(state.open === false);
    deepStrictEqual(state.themes, {});
  });
});
